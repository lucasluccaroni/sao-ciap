-- ============================================================================
-- SAO BAR 2026 - TRIGGERS Y FUNCIONES DE BASE DE DATOS
-- ============================================================================

-- 1. Sincronización Automática: auth.users -> public.Usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public."Usuarios" (id, email, nombre, rol, activo, pin)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nombre', 'Nuevo Usuario'),
    COALESCE(new.raw_user_meta_data->>'rol', 'Empleado'),
    true,
    NULL -- El PIN de Administrador se debe setear/hashear manualmente tras la creación
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el Trigger asociado en el esquema auth (ejecutado después de insertar en auth.users)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Transacción Atómica: Procesamiento de Comanda con Bloqueo Pesimista (RPC)
CREATE OR REPLACE FUNCTION public.procesar_comanda(
    p_jornada_id UUID,
    p_usuario_id UUID,
    p_nro_beeper INT,
    p_medio_pago VARCHAR(20),
    p_items JSONB -- Formato: [{"producto_id": "UUID", "cantidad": INT}]
) RETURNS UUID AS $$
DECLARE
    v_comanda_id UUID;
    v_item RECORD;
    v_producto_id UUID;
    v_cantidad INT;
    v_precio_unitario NUMERIC(10,2);
    v_stock_actual INT;
    v_nombre_producto VARCHAR(255);
    v_total_comanda NUMERIC(10,2) := 0.00;
    v_jornada_estado VARCHAR(20);
BEGIN
    -- A. Validar que la jornada exista y esté 'abierta'
    SELECT estado INTO v_jornada_estado 
    FROM public."Jornadas" 
    WHERE jornada_id = p_jornada_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La jornada especificada no existe.';
    END IF;
    
    IF v_jornada_estado <> 'abierta' THEN
        RAISE EXCEPTION 'La jornada no está abierta. No se admiten comandas.';
    END IF;

    -- B. Crear la cabecera de la Comanda con total temporal de 0.00
    INSERT INTO public."Comandas" (
        jornada_id,
        usuario_id,
        nro_beeper,
        medio_pago,
        total
    ) VALUES (
        p_jornada_id,
        p_usuario_id,
        p_nro_beeper,
        p_medio_pago,
        0.00
    ) RETURNING comanda_id INTO v_comanda_id;

    -- C. Iterar sobre cada ítem enviado en el JSONB
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad INT)
    LOOP
        v_producto_id := v_item.producto_id;
        v_cantidad := v_item.cantidad;

        -- 1. Aplicar BLOQUEO PESIMISTA (FOR UPDATE) sobre el producto específico
        SELECT nombre, precio, "stockActual" 
        INTO v_nombre_producto, v_precio_unitario, v_stock_actual
        FROM public."Productos"
        WHERE id = v_producto_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con ID % no existe.', v_producto_id;
        END IF;

        -- 2. Validar disponibilidad de stock
        IF v_stock_actual < v_cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, Solicitado: %.', 
                v_nombre_producto, v_stock_actual, v_cantidad;
        END IF;

        -- 3. Descontar stock del producto
        UPDATE public."Productos"
        SET "stockActual" = "stockActual" - v_cantidad
        WHERE id = v_producto_id;

        -- 4. Registrar el ítem histórico en la comanda
        INSERT INTO public."Comanda_Items" (
            comanda_id,
            producto_id,
            cantidad,
            precio_unitario_historico
        ) VALUES (
            v_comanda_id,
            v_producto_id,
            v_cantidad,
            v_precio_unitario
        );

        -- 5. Acumular al total de la comanda
        v_total_comanda := v_total_comanda + (v_precio_unitario * v_cantidad);
    END LOOP;

    -- D. Actualizar la cabecera de la comanda con el total real calculado
    UPDATE public."Comandas"
    SET total = v_total_comanda
    WHERE comanda_id = v_comanda_id;

    -- E. Retornar el ID de la comanda procesada con éxito
    RETURN v_comanda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 3. Transaccion Atomica: Cierre de Jornada con Calculo de Balance Final (RPC)
-- Transiciona la jornada de 'en_auditoria' a 'cerrada' y persiste todos los
-- totales calculados en una sola operacion. Recibe los valores de Mercado Pago
-- confirmados manualmente por el administrador (p_total_mp_real, p_comision_mp).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cerrar_jornada(
    p_jornada_id    UUID,
    p_total_mp_real NUMERIC(10,2),
    p_comision_mp   NUMERIC(10,2)
) RETURNS VOID AS $$
DECLARE
    v_estado          VARCHAR(20);
    v_total_efectivo  NUMERIC(10,2);
    v_total_mp_lista  NUMERIC(10,2);
    v_gastos_totales  NUMERIC(10,2);
    v_total_general   NUMERIC(10,2);
    v_ganancia_neta   NUMERIC(10,2);
BEGIN
    -- A. Verificar estado y aplicar bloqueo pesimista para evitar doble cierre
    SELECT estado INTO v_estado
    FROM public."Jornadas"
    WHERE jornada_id = p_jornada_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La jornada con ID % no existe.', p_jornada_id;
    END IF;

    IF v_estado <> 'en_auditoria' THEN
        RAISE EXCEPTION 'Solo se puede cerrar una jornada en estado "en_auditoria". Estado actual: %.', v_estado;
    END IF;

    -- B. Calcular ingresos por medio de pago a partir de las comandas registradas
    SELECT COALESCE(SUM(total), 0.00) INTO v_total_efectivo
    FROM public."Comandas"
    WHERE jornada_id = p_jornada_id AND medio_pago = 'Efectivo';

    SELECT COALESCE(SUM(total), 0.00) INTO v_total_mp_lista
    FROM public."Comandas"
    WHERE jornada_id = p_jornada_id AND medio_pago = 'Mercado Pago';

    -- C. Calcular total de gastos operativos de la jornada
    SELECT COALESCE(SUM(monto), 0.00) INTO v_gastos_totales
    FROM public."Gastos"
    WHERE jornada_id = p_jornada_id;

    -- D. Calcular totales derivados
    --    total_general: lo que realmente ingreso en caja (efectivo + monto real cobrado por MP)
    --    ganancia_neta: ingresos reales menos gastos operativos y comision de la plataforma MP
    v_total_general := v_total_efectivo + p_total_mp_real;
    v_ganancia_neta := v_total_general - v_gastos_totales - p_comision_mp;

    -- E. Persistir el balance completo y cerrar la jornada en una unica operacion atomica
    UPDATE public."Jornadas"
    SET
        estado         = 'cerrada',
        fecha_fin      = now(),
        total_efectivo = v_total_efectivo,
        total_mp_lista = v_total_mp_lista,
        total_mp_real  = p_total_mp_real,
        comision_mp    = p_comision_mp,
        total_general  = v_total_general,
        gastos_totales = v_gastos_totales,
        ganancia_neta  = v_ganancia_neta
    WHERE jornada_id = p_jornada_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
