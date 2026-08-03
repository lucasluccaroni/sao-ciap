-- ============================================================================
-- SAO BAR 2026 - MIGRACIÓN Y PARCHE DE PRODUCCIÓN V1.9 (SAFE & IDEMPOTENT)
-- ============================================================================
-- Este script actualiza la Base de Datos de Producción desde la v1.0 a la v1.9
-- SIN BORRAR NI ALTERAR DATOS EXISTENTES (Ventas, Productos, Jornadas, Usuarios).
--
-- Modo de uso: Copiar y ejecutar íntegramente en el SQL Editor de Supabase
-- del proyecto de PRODUCCIÓN.
-- ============================================================================

-- 1. EXTENSIONES DE BASE DE DATOS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. PARCHES DE COLUMNAS EN TABLAS EXISTENTES
-- Tabla: Productos
ALTER TABLE public."Productos" ADD COLUMN IF NOT EXISTS vendible BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE public."Productos" ADD COLUMN IF NOT EXISTS controla_stock BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE public."Productos" ADD COLUMN IF NOT EXISTS insumo_compartido_id UUID REFERENCES public."Productos"(id) ON DELETE SET NULL;

-- Tabla: Auditoria_Inventario
ALTER TABLE public."Auditoria_Inventario" ADD COLUMN IF NOT EXISTS unidades_utilizadas INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE public."Auditoria_Inventario" ADD COLUMN IF NOT EXISTS unidades_regaladas INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE public."Auditoria_Inventario" ADD COLUMN IF NOT EXISTS stock_inicial INTEGER DEFAULT 0 NOT NULL;

-- Tabla: Comandas (Permitir medio_pago 'Regalo')
ALTER TABLE public."Comandas" DROP CONSTRAINT IF EXISTS "Comandas_medio_pago_check";
ALTER TABLE public."Comandas" ADD CONSTRAINT "Comandas_medio_pago_check" 
    CHECK (medio_pago IN ('Efectivo', 'Mercado Pago', 'Regalo'));

-- Tabla: Jornadas (Índice único para evitar múltiples jornadas abiertas simultáneas)
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_jornada ON public."Jornadas" (estado) 
WHERE estado IN ('abierta', 'en_auditoria');

-- 3. INFRAESTRUCTURA DE CONOCIMIENTO VECTORIAL (ASISTENTE IA)
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'procedimiento',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx 
ON public.knowledge_chunks 
USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a conocimiento" ON public.knowledge_chunks;

CREATE POLICY "Acceso total a conocimiento" 
ON public.knowledge_chunks FOR ALL TO authenticated, anon, service_role 
USING (true) WITH CHECK (true);

GRANT ALL ON public.knowledge_chunks TO authenticated, anon, service_role;

-- 4. FUNCIONES RPC SQL Y TRIGGERS (CREATE OR REPLACE)

-- 4.1 Trigger de sincronización auth.users -> public.Usuarios
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
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4.2 RPC Procesar Comanda con Bloqueo Pesimista e Insumo Compartido
CREATE OR REPLACE FUNCTION public.procesar_comanda(
    p_jornada_id UUID,
    p_usuario_id UUID,
    p_nro_beeper INT,
    p_medio_pago VARCHAR(20),
    p_items JSONB
) RETURNS UUID AS $$
DECLARE
    v_comanda_id UUID;
    v_item RECORD;
    v_producto_id UUID;
    v_cantidad INT;
    v_precio_unitario NUMERIC(10,2);
    v_stock_actual INT;
    v_controla_stock BOOLEAN;
    v_nombre_producto VARCHAR(255);
    v_total_comanda NUMERIC(10,2) := 0.00;
    v_jornada_estado VARCHAR(20);
    v_insumo_id UUID;
BEGIN
    SELECT estado INTO v_jornada_estado 
    FROM public."Jornadas" 
    WHERE jornada_id = p_jornada_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La jornada especificada no existe.';
    END IF;
    
    IF v_jornada_estado <> 'abierta' THEN
        RAISE EXCEPTION 'La jornada no está abierta. No se admiten comandas.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad INT)
    LOOP
        SELECT insumo_compartido_id INTO v_insumo_id
        FROM public."Productos"
        WHERE id = v_item.producto_id;

        IF v_insumo_id IS NOT NULL THEN
            SELECT nombre, "stockActual", controla_stock 
            INTO v_nombre_producto, v_stock_actual, v_controla_stock
            FROM public."Productos"
            WHERE id = v_insumo_id
            FOR UPDATE;
        ELSE
            SELECT nombre, "stockActual", controla_stock 
            INTO v_nombre_producto, v_stock_actual, v_controla_stock
            FROM public."Productos"
            WHERE id = v_item.producto_id
            FOR UPDATE;
        END IF;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con ID % no existe.', v_item.producto_id;
        END IF;

        IF v_controla_stock AND v_stock_actual < v_item.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, Solicitado: %.', 
                v_nombre_producto, v_stock_actual, v_item.cantidad;
        END IF;
    END LOOP;

    INSERT INTO public."Comandas" (
        jornada_id, usuario_id, nro_beeper, medio_pago, total
    ) VALUES (
        p_jornada_id, p_usuario_id, p_nro_beeper, p_medio_pago, 0.00
    ) RETURNING comanda_id INTO v_comanda_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad INT)
    LOOP
        v_producto_id := v_item.producto_id;
        v_cantidad := v_item.cantidad;

        SELECT precio, controla_stock, insumo_compartido_id 
        INTO v_precio_unitario, v_controla_stock, v_insumo_id
        FROM public."Productos"
        WHERE id = v_producto_id;

        IF v_controla_stock THEN
            IF v_insumo_id IS NOT NULL THEN
                UPDATE public."Productos"
                SET "stockActual" = "stockActual" - v_cantidad
                WHERE id = v_insumo_id;
            ELSE
                UPDATE public."Productos"
                SET "stockActual" = "stockActual" - v_cantidad
                WHERE id = v_producto_id;
            END IF;
        END IF;

        INSERT INTO public."Comanda_Items" (
            comanda_id, producto_id, cantidad, precio_unitario_historico
        ) VALUES (
            v_comanda_id, v_producto_id, v_cantidad, v_precio_unitario
        );

        v_total_comanda := v_total_comanda + (v_precio_unitario * v_cantidad);
    END LOOP;

    IF p_medio_pago = 'Regalo' THEN
        UPDATE public."Comandas" SET total = 0.00 WHERE comanda_id = v_comanda_id;
    ELSE
        UPDATE public."Comandas" SET total = v_total_comanda WHERE comanda_id = v_comanda_id;
    END IF;

    RETURN v_comanda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.3 RPC Cerrar Jornada
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

    SELECT COALESCE(SUM(total), 0.00) INTO v_total_efectivo
    FROM public."Comandas"
    WHERE jornada_id = p_jornada_id AND medio_pago = 'Efectivo';

    SELECT COALESCE(SUM(total), 0.00) INTO v_total_mp_lista
    FROM public."Comandas"
    WHERE jornada_id = p_jornada_id AND medio_pago = 'Mercado Pago';

    SELECT COALESCE(SUM(monto), 0.00) INTO v_gastos_totales
    FROM public."Gastos"
    WHERE jornada_id = p_jornada_id;

    v_total_general := v_total_efectivo + p_total_mp_real;
    v_ganancia_neta := v_total_general - v_gastos_totales;

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

    UPDATE public."Productos" p
    SET 
        "stockActual" = a.conteo_fisico,
        "stockInicial" = a.conteo_fisico
    FROM public."Auditoria_Inventario" a
    WHERE a.jornada_id = p_jornada_id 
      AND a.producto_id = p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.4 RPC Búsqueda Semántica de Conocimiento (match_knowledge)
CREATE OR REPLACE FUNCTION public.match_knowledge(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    titulo TEXT,
    contenido TEXT,
    categoria TEXT,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.titulo,
        kc.contenido,
        kc.categoria,
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_chunks kc
    WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
    ORDER BY kc.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge(vector(768), float, int) TO authenticated, service_role;

-- 5. POLÍTICAS DE SEGURIDAD RLS (RE-APLICACIÓN SEGURA)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public."Usuarios"
    WHERE id = auth.uid() AND rol = 'Admin'
  );
END;
$$ LANGUAGE plpgsql;

-- Re-aplicación limpia de RLS
ALTER TABLE public."Usuarios" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura perfiles para autenticados" ON public."Usuarios";
DROP POLICY IF EXISTS "Escritura perfiles solo admin" ON public."Usuarios";
CREATE POLICY "Lectura perfiles para autenticados" ON public."Usuarios" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escritura perfiles solo admin" ON public."Usuarios" FOR ALL TO authenticated USING (public.es_admin());

ALTER TABLE public."Categorias_Productos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura categorias para autenticados" ON public."Categorias_Productos";
DROP POLICY IF EXISTS "Escritura categorias solo admin" ON public."Categorias_Productos";
CREATE POLICY "Lectura categorias para autenticados" ON public."Categorias_Productos" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escritura categorias solo admin" ON public."Categorias_Productos" FOR ALL TO authenticated USING (public.es_admin());

ALTER TABLE public."Categorias_Gastos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura categorias gastos para autenticados" ON public."Categorias_Gastos";
DROP POLICY IF EXISTS "Escritura categorias gastos solo admin" ON public."Categorias_Gastos";
CREATE POLICY "Lectura categorias gastos para autenticados" ON public."Categorias_Gastos" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escritura categorias gastos solo admin" ON public."Categorias_Gastos" FOR ALL TO authenticated USING (public.es_admin());

ALTER TABLE public."Productos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura productos para autenticados" ON public."Productos";
DROP POLICY IF EXISTS "Escritura productos solo admin" ON public."Productos";
CREATE POLICY "Lectura productos para autenticados" ON public."Productos" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escritura productos solo admin" ON public."Productos" FOR ALL TO authenticated USING (public.es_admin());

ALTER TABLE public."Jornadas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura jornadas para autenticados" ON public."Jornadas";
DROP POLICY IF EXISTS "Escritura jornadas solo admin" ON public."Jornadas";
CREATE POLICY "Lectura jornadas para autenticados" ON public."Jornadas" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escritura jornadas solo admin" ON public."Jornadas" FOR ALL TO authenticated USING (public.es_admin());

ALTER TABLE public."Comandas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura comandas para autenticados" ON public."Comandas";
DROP POLICY IF EXISTS "Insercion comandas para autenticados" ON public."Comandas";
DROP POLICY IF EXISTS "Modificacion y borrado comandas solo admin" ON public."Comandas";
CREATE POLICY "Lectura comandas para autenticados" ON public."Comandas" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insercion comandas para autenticados" ON public."Comandas" FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Modificacion y borrado comandas solo admin" ON public."Comandas" FOR ALL TO authenticated USING (public.es_admin());

ALTER TABLE public."Comanda_Items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura items comanda para autenticados" ON public."Comanda_Items";
DROP POLICY IF EXISTS "Insercion items comanda para autenticados" ON public."Comanda_Items";
DROP POLICY IF EXISTS "Modificacion y borrado items comanda solo admin" ON public."Comanda_Items";
CREATE POLICY "Lectura items comanda para autenticados" ON public."Comanda_Items" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insercion items comanda para autenticados" ON public."Comanda_Items" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Modificacion y borrado items comanda solo admin" ON public."Comanda_Items" FOR ALL TO authenticated USING (public.es_admin());

ALTER TABLE public."Gastos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso gastos solo admin" ON public."Gastos";
CREATE POLICY "Acceso gastos solo admin" ON public."Gastos" FOR ALL TO authenticated USING (public.es_admin());

ALTER TABLE public."Auditoria_Inventario" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso auditoria solo admin" ON public."Auditoria_Inventario";
CREATE POLICY "Acceso auditoria solo admin" ON public."Auditoria_Inventario" FOR ALL TO authenticated USING (public.es_admin());
