# DOCUMENTO MAESTRO DEFINITIVO V1.7: SISTEMA SAO BAR 2026

## 1. RESUMEN EJECUTIVO Y ALCANCE TÉCNICO

El sistema SAO Bar 2026 se define como una infraestructura web multi-terminal de alto rendimiento diseñada para la gestión operativa y administrativa de jornadas nocturnas. Su propósito central es garantizar la integridad transaccional y el control de inventario en un entorno de alta demanda, eliminando las discrepancias de los registros manuales.

El propósito por el cual se desarrolla este proyecto es para probar cómo implementar un stack tecnológico robusto utilizando Next.js 16, Supabase, Tailwind CSS 4 y Server Actions, optimizando el diseño, el flujo de usuario y garantizando la consistencia de datos a nivel de base de datos a través de una colaboración estrecha con asistentes de IA agénticos.

### Concepto de Jornada Nocturna No-Calendario
Dada la naturaleza operativa del establecimiento, el sistema ignora la linealidad de la fecha calendario del servidor. La actividad que inicia un viernes por la noche y concluye la madrugada del sábado se agrupa bajo un identificador único de "Jornada". Esto permite consolidar métricas financieras y de stock sin la fragmentación que causaría un cambio de fecha a midnight.

### Entorno Operativo y Concurrencia
El sistema está dimensionado para la operación simultánea de 4 terminales activas bajo un modelo de datos centralizado:
- **3 Terminales de Comandas**: Dispositivos móviles o laptops destinados a la toma de pedidos en salón y barra por parte de los mozos.
- **1 Terminal de Administración**: Estación central (macOS/Windows) para el monitoreo de caja, auditoría física y cierre de jornada.

### Stack Tecnológico
- **Framework**: Next.js 16 (App Router) para una gestión de rutas y estados optimizada.
- **Base de Datos**: Supabase (PostgreSQL) para la persistencia relacional con integridad ACID.
- **Lógica de Servidor**: Server Actions para el procesamiento de reglas de negocio seguras.
- **Estilos**: TailwindCSS 4 para un diseño ligero, responsivo y de alta velocidad de renderizado.

---

## 2. ARQUITECTURA DE DATOS Y CONCURRENCIA

Para mitigar riesgos de sobreventa y colisiones de datos en un entorno de 4 terminales, la arquitectura traslada la lógica crítica al motor de la base de datos.

### Lógica de Stock y Bloqueo Pesimista
El sistema implementa el Procedimiento Almacenado (RPC) `procesar_comanda()`. Este procedimiento ejecuta una transacción atómica que utiliza la cláusula `FOR UPDATE` (Bloqueo Pesimista). Al recibir un pedido, el sistema realiza una pasada preliminar sobre las filas de los productos involucrados bloqueándolas y validando la disponibilidad de stock *antes* de realizar la inserción de la cabecera en la tabla `Comandas`. De esta manera, si el stock es insuficiente, se ejecuta un Rollback inmediato sin alterar ni consumir números de la secuencia autoincremental (`numero_ticket`) del ticket de barra. Si todas las validaciones son correctas, el sistema descuenta las existencias, inserta el registro de cabecera consumiendo el número de ticket y graba los ítems de venta.

### Sincronización Realtime
Se utiliza Supabase Realtime (WebSockets) agregando las tablas `Comandas` y `Productos` a la publicación `supabase_realtime`. Cuando el `stockActual` cambia en la base de datos tras una venta o reposición, o se inserta una nueva comanda, todas las terminales reflejan el nuevo estado de los badges de stock y del listado de historial en tiempo real sin necesidad de refrescar el navegador.

---

## 3. LÓGICA DE SEGURIDAD REFORZADA Y ROLES

### Jerarquía de Roles
- **Rol Admin**: Acceso total, incluyendo Auditoría, Historial, ABM de Productos y Cierre de Caja.
- **Rol Empleado**: Acceso limitado exclusivamente a la toma de comandas y consulta de stock disponible.

### JornadaGuard y Protección de Terminales (Bloqueo Realtime)
El sistema implementa el middleware `JornadaGuard` y un sistema de WebSockets para bloquear la navegación y funcionalidad de las terminales si no existe una jornada marcada como "Abierta". Esto evita registros accidentales fuera del horario operativo. Si el administrador cambia el estado de la jornada a `en_auditoria` o `cerrada` desde su terminal, la pantalla de los mozos es cubierta de inmediato por un banner opaco bloqueando la interfaz en tiempo real.

### Flujo de Cierre y Seguridad Criptográfica
La transición de una jornada de 'Cerrada' a 'Abierta' y de 'Abierta' a 'En Auditoría' requiere la validación obligatoria del PIN de Administrador, el cual se procesa mediante un Hash SHA-256 en el cliente, asegurando que la clave nunca viaje en texto plano por la red.

### Seguridad a Nivel de Fila (RLS)
Se implementa Row Level Security (RLS) en Supabase, garantizando que las políticas de acceso se ejecuten en el motor de la base de datos, blindando la información contra accesos no autorizados vía API.

---

## 4. DICCIONARIO DE DATOS RELACIONAL

A continuación, se detalla la estructura relacional obligatoria para asegurar la integridad referencial.

### Entidad: Usuarios
*   `id`: UUID (Primary Key). Mapeado directamente a la tabla interna de usuarios de Supabase Auth (`auth.users`) mediante FK.
*   `email`: String (Único).
*   `nombre`: String.
*   `rol`: Enum ('Admin', 'Empleado').
*   `pin`: Hash SHA-256 de 64 caracteres. Utilizado únicamente para validación de PIN en terminales de seguridad del administrador.
*   `activo`: Boolean. Default `true`.

### Entidad: Categorias_Productos
*   `id`: UUID (Primary Key).
*   `nombre`: String (Único).
*   `color_fondo`: String (Formato hexadecimal de 7 caracteres, ej. `#FF0000`. Validado por CHECK regex `^#[0-9A-Fa-f]{6}$`).
*   `color_texto`: String (Formato hexadecimal de 7 caracteres. Validado por CHECK regex `^#[0-9A-Fa-f]{6}$`).
*   `activo`: Boolean. Default `true`.

### Entidad: Categorias_Gastos
*   `id`: UUID (Primary Key).
*   `nombre`: String (Único, ej. *Insumos, Limpieza, Servicios, Otros, Personal, Mantenimiento*).
*   `activo`: Boolean. Default `true`.

### Entidad: Productos
*   `id`: UUID (Primary Key).
*   `nombre`: String.
*   `categoria_id`: Foreign Key (`Categorías_Productos`) ON DELETE RESTRICT.
*   `precio`: Numeric(10,2).
*   `stockIdeal`: Integer (Referencia visual semanal).
*   `stockInicial`: Integer (Actualizado solo en reposición o creación).
*   `stockActual`: Integer. Afectado por `procesar_comanda()` únicamente si `controla_stock` es `true`.
*   `unidad`: String (u, lt, ml).
*   `activo`: Boolean. Default `true` (Maneja la baja lógica del catálogo).
*   `vendible`: Boolean (Determina si se muestra en el menú de comandas de los mozos. False equivale a insumo interno).
*   `controla_stock`: Boolean (Determina si el producto realiza seguimiento y descuento dinámico de existencias).

### Entidad: Jornadas
*   `jornada_id`: UUID (Primary Key).
*   `estado`: Enum ('abierta', 'en_auditoria', 'cerrada').
    *   *Constraint de Unicidad Parcial*: `CREATE UNIQUE INDEX unique_active_jornada ON Jornadas (estado) WHERE estado IN ('abierta', 'en_auditoria');`. Garantiza que no exista más de una jornada activa o en revisión a la vez.
*   `fecha_inicio`: Timestamp con zona horaria.
*   `fecha_fin`: Timestamp con zona horaria.
*   `total_efectivo`: Numeric(10,2).
*   `total_mp_lista`: Numeric(10,2).
*   `total_mp_real`: Numeric(10,2).
*   `comision_mp`: Numeric(10,2) (`total_mp_lista - total_mp_real`).
*   `total_general`: Numeric(10,2) (`total_efectivo + total_mp_real`).
*   `gastos_totales`: Numeric(10,2).
*   `ganancia_neta`: Numeric(10,2) (`total_efectivo + total_mp_real - gastos_totales`).

### Entidad: Comandas
*   `comanda_id`: UUID (Primary Key).
*   `jornada_id`: Foreign Key (`Jornadas`).
*   `usuario_id`: Foreign Key (`Usuarios`).
*   `numero_ticket`: SERIAL (Incremental autogestionado por la base de datos).
*   `nro_beeper`: Integer. Opcional (Constraint: valor numérico entero del 1 al 20 inclusive).
*   `fecha`: Timestamp con zona horaria.
*   `total`: Numeric(10,2).
*   `medio_pago`: Enum ('Efectivo', 'Mercado Pago').

### Entidad: Comanda_Items (N:N Break)
*   `id`: UUID (Primary Key).
*   `comanda_id`: Foreign Key (`Comandas`) ON DELETE CASCADE.
*   `producto_id`: Foreign Key (`Productos`).
*   `cantidad`: Integer.
*   `precio_unitario_historico`: Numeric(10,2) (Snapshot del precio al momento de la venta).

### Entidad: Gastos
*   `id`: UUID (Primary Key).
*   `jornada_id`: Foreign Key (`Jornadas`).
*   `categoria_id`: Foreign Key (`Categorías_Gastos`).
*   `descripcion`: String/Text.
*   `monto`: Numeric(10,2).

### Entidad: Auditoria_Inventario
*   `id`: UUID (Primary Key).
*   `jornada_id`: Foreign Key (`Jornadas`).
*   `producto_id`: Foreign Key (`Productos`).
*   `conteo_fisico`: Integer. Ingresado por el Admin en el Cierre de Caja; solo aplica para productos con `controla_stock = true`.
*   `unidades_utilizadas`: Integer.
*   `stock_inicial`: Integer. Guarda la foto del stock de apertura de cada producto al iniciar la jornada. Resuelve inconsistencias financieras en el historial de desvíos.

---

## 5. MÓDULO DE REPORTES Y ANALÍTICA

### Generación Dinámica y Auditoría Anti-Robo
Los reportes se generan mediante JOINs relacionales en tiempo real. El motor de auditoría aplica la siguiente fórmula de conciliación de stock para productos con `controla_stock = true`:
*   **Stock Teórico = Stock Inicial - Unidades Vendidas** (Leídos directamente de la foto en `Auditoria_Inventario`).
*   **Desvío = Conteo Físico - Stock Teórico**.

### Visualización de Desvíos y Ordenamiento
*   **Token Error**: Si el Conteo Físico difiere del Stock Teórico (para productos con seguimiento de stock), la interfaz resalta el registro con el color funcional Error (`#E2484A`).
*   **Jerarquía de Datos**: Los reportes de stock se ordenan descendentemente por volumen de ventas, priorizando los productos de mayor rotación.

### Conciliación de Mercado Pago
Se realiza el cotejo financiero de Mercado Pago en el cierre:
*   `comision_mp = total_mp_lista - total_mp_real`.
*   **Token Advertencia**: Si `comision_mp` supera el 10% del `total_mp_lista`, se resalta en color Advertencia (`#BA7517`).

### Módulo de Rendimiento y Rotación de Ventas
*   **Consolidación en Memoria**: El sistema agrupa relacionalmente en tiempo real todas las comandas de la jornada por `producto_id`, sumando las unidades vendidas e ingresos brutos por cada artículo.
*   **Exclusión de Insumos**: Este reporte filtra de forma automática únicamente los productos marcados como vendibles (`vendible = true`), eliminando insumos operativos para mantener la claridad analítica.
*   **Visualización de Rendimiento**: Se presenta en el historial una pestaña dedicada ("Rendimiento") que lista todos los productos vendidos ordenados descendentemente por rotación (unidades vendidas) para evaluar de forma directa el volumen e ingresos del menú de la noche.

---

## 6. SISTEMA DE TOKENS VISUALES (SIN TABLAS)

### Tipografía (Google Fonts)
*   **Creepster**: Estilo Display para Logotipo "SAO Bar" y elementos decorativos de alta identidad.
*   **Livvic**: Estilo UI para toda la interfaz (botones, tablas, inputs, lecturas, reportes, historial).

### Colores de Marca
*   **Negro**: `#080A0D` (Fondo primario).
*   **Naranja**: `#F26A1B` (Acciones primarias y paneles).
*   **Naranja Alternativo**: `#F25922` (Interacciones y estados activos).
*   **Cyan**: `#30CFF2` (Énfasis de navegación y logo).
*   **Blanco**: `#F2F2F2` (Texto principal y contrastes).

### Colores Funcionales
*   **Efectivo**: `#1D9E75` (Confirmación y éxito).
*   **Mercado Pago**: `#378ADD` (Pagos digitales).
*   **Error/Peligro**: `#E2484A` (Desvíos, alertas y errores).
*   **Advertencia**: `#BA7517` (Alerta de stock bajo o comisiones fuera de lo normal).
*   **Gris UI**: `#9D9D9D` (Textos secundarios y deshabilitados).

---

## 7. ESPECIFICACIONES DE INTERFAZ

### Layout General (Shell) y Menú Activo
*   **Topnav (56px) / AdminNav**: Se utiliza el componente interactivo de cliente `<AdminNav />` para la navegación administrativa. Identifica mediante `usePathname` la pestaña activa (Productos, Comandas, Caja, Cierre, Historial, Calculadora) y le asigna color blanco `#F2F2F2` y un borde inferior cian `#30CFF2`. Oculto en impresión (`print:hidden`).

### Módulo ABM de Productos (Patrón Master-Detail)
*   **Fondo y Tarjeta Central**: Posee un fondo de pantalla naranja corporativo (`bg-[#F26A1B]`) con todo el menú administrativo flotando dentro de una gran tarjeta oscura central (`bg-[#1A1A1A]`) de bordes redondeados y sombras pronunciadas.
*   **Grilla de Productos**: Muestra el catálogo categorizado. Los productos con `activo = false` se muestran al 40% de opacidad.
*   **Barra de Filtros**: Incluye búsqueda en vivo por texto, selector por categoría, selector por clasificación de ítem («Insumos», «Productos (Vendibles Cerrados)», «Elaboración Instantánea», «Todos los Items») y un checkbox reactivo para elegir si listar o no productos inactivos/dados de baja.
*   **Formulario de Edición/Alta de Producto**:
    *   Toggle de clasificación: *«Producto para la venta»* (`vendible = true`) vs. *«Insumos»* (`vendible = false`).
    *   Checkbox de inventario: *«Seguimiento de stock»* (`controla_stock = true`). Si el tipo es *Insumo*, el checkbox se fuerza a `true` y se deshabilita.
    *   El campo `stockActual` es de solo lectura durante la visualización general, pero permite ingresos de reabastecimiento directo si se edita.
*   **Edición y Creación de Categorías**:
    *   Modal flotante para dar altas y bajas lógicas.
    *   Los colores de fondo y texto de la categoría son configurados por el administrador y validados estrictamente bajo expresión regular hexadecimal en el cliente.
    *   Regla de consistencia: No se puede activar o guardar un producto vendible si su categoría asociada se encuentra desactivada (`activo = false`).

### Terminal de Comandas
*   **Sidebar Izquierdo (80px)**: Selector de categorías vertical (solo categorías activas).
*   **Grilla de Productos**: Muestra tarjetas de productos con `vendible = true`. Los badges de stock dinámico solo se calculan e interactúan si `controla_stock = true`. Al vender la última unidad, la interfaz descuenta el stock local de forma optimista e instantánea deshabilitando la tarjeta al microsegundo antes de realizar la recarga silenciosa de fondo.
*   **Carrito y Medio de Pago**: Detalle del pedido, selector de beeper opcional (1 al 20) y selección de medio de pago (Efectivo/MP).
*   **Scroll Adaptativo por Altura (Zoom/Pantallas Pequeñas)**: Mide mediante listener de `resize` el alto útil (`window.innerHeight`). Si este es inferior a `780px` (por zoom de 150-175% o pantallas pequeñas), desactiva las alturas fijas y el bloqueo de desborde del contenedor raíz, permitiendo scroll general de navegador, y restringe el listado de pedidos a un máximo de `max-h-[350px]` para asegurar la visibilidad total de los controles de pago e historial.
*   **Cierre de Sesión Seguro**: La acción de «Salir» (mozo y administrador) despliega un modal con fondo desenfocado (`backdrop-blur-sm`) que requiere confirmación explícita.

---

## 8. PROCEDIMIENTOS OPERATIVOS CRÍTICOS

### Envío de Comanda (Transacción Atómica)
Al invocar `procesar_comanda()`:
1. Validación de estado de jornada (Debe ser 'Abierta').
2. Bloqueo de filas en productos vía `FOR UPDATE`.
3. Validación de disponibilidad (`stockActual >= cantidad`) — **solo si `controla_stock = true`**.
4. Validación del número de beeper (Si está presente, debe estar en el rango de 1 a 20 inclusive).
5. Inserción en comandas.
6. Inserción en `comanda_items` (Capturando precio actual).
7. Deducción del `stockActual` — **solo si `controla_stock = true`**.

### Flujo de Cierre de Jornada
Este proceso debe ser ejecutado en orden estrictamente atómico:
1. **Validación de PIN**: Validación obligatoria mediante Hash SHA-256 en cliente.
2. **Transición de Estado**: Cambio de jornada a 'En Auditoría', bloqueando comandas nuevas.
3. **Carga de Gastos + Stock real MP**: Registro de egresos y conciliación manual de posnet de Mercado Pago (`total_mp_real`).
4. **Auditoría Física**: Carga de conteos en `Auditoria_Inventario` — **únicamente para productos con `controla_stock = true`**. Persiste el conteo manual físico, las unidades utilizadas y el snapshot del `stock_inicial` con el que inició la jornada activa para blindar la reconstrucción del historial.
5. **Consolidación Final**: El sistema calcula totales de efectivo, Mercado Pago, comisiones y ganancia neta, y transiciona la jornada a 'Cerrada'. Atómicamente, se actualiza el `stockActual` y `stockInicial` de todos los productos auditados en la tabla `Productos` con su correspondiente `conteo_fisico`, sirviendo este último como el stock de partida para la apertura de la siguiente jornada.

---

## 9. ESPECIFICACIÓN TÉCNICA: MÓDULO CALCULADORA DE COSTOS (STATELESS)

### Resumen Funcional
La Calculadora de Costos permite a la administración simular costos de insumos de manera volátil (React State local en el cliente) sin impactar el inventario o finanzas oficiales en Supabase. Al refrescar la aplicación, los datos se eliminan.

### Flujo en Pantalla
*   **Grilla Libre**: Fila de inputs vacíos que permite al usuario registrar libremente el Nombre del Insumo, Cantidad y Precio Unitario, calculando de manera instantánea el subtotal e incrementando el Total General.
*   **Autocompletado Sugerido**: Al escribir en el nombre del insumo, un dropdown dinámico consulta en caliente el catálogo real del servidor (`obtenerProductos`) para autocompletar rápidamente.
*   **Aviso en Cursiva**: Muestra en pantalla el texto simple en cursiva gris: *«Aviso: Esta calculadora es una herramienta de simulación.»*.
*   **Interacciones**: Botón «+ Agregar insumo» para sumar filas al estado y botones «X» para remover filas.

### Estilos de Impresión A4
Al presionar el botón «Guardar / Imprimir» (o mediante `Ctrl+P`), el navegador activa directivas `@media print`:
*   El fondo naranja de pantalla y la tarjeta oscura se transforman en una hoja de reporte blanca.
*   Se oculta la barra de navegación lateral, el menú superior administrativo global, y todos los controles interactivos de edición (los botones de eliminar fila y agregar insumo).
*   Los inputs cambian a texto plano (sin bordes ni parches de formulario) en el PDF.
*   Se dibuja un membrete con el logotipo circular del bar `/images/sao-logo.png` con fondo blanco, título, subtítulo, fecha y hora de impresión.
*   Se renderiza al pie del reporte A4 una firma institucional gris: *«Este documento es una simulación generada por la Calculadora de Costos de SAO Bar.»*

---

## 10. CASOS DE USO DETALLADOS

### Caso de Uso: Tomar comanda (CDU-SAO-001)
*   **Actor/es**: Empleado (Mozo).
*   **Precondiciones**: Jornada en estado 'abierta'. Productos seleccionados con `controla_stock = true` tienen `stockActual >= cantidad`. Beeper ingresado está en el rango de 1 a 20.
*   **Flujo principal**:
    1. El mozo selecciona artículos del menú clasificados por categoría.
    2. El sistema actualiza optimistamente el stock en caliente deshabilitando temporalmente el botón si las unidades caen a 0.
    3. Asigna beeper opcional.
    4. Envía la comanda.
*   **Postcondiciones**: Registro de comanda e ítems. El `stockActual` es decrementado en base de datos. El ticket se imprime en la comandera en barra.

### Caso de Uso: Apertura de jornada (CDU-SAO-002)
*   **Actor/es**: Administrador.
*   **Precondiciones**: La jornada anterior se encuentra en estado 'cerrada'. No existen jornadas activas.
*   **Flujo principal**:
    1. El administrador ingresa el PIN correspondiente.
    2. Define el saldo inicial de caja en efectivo y Mercado Pago.
    3. Presiona abrir jornada.
*   **Postcondiciones**: Transición a estado 'abierta', permitiendo la toma de comandas en todas las terminales.

### Caso de Uso: Gestionar productos (CDU-SAO-003)
*   **Actor/es**: Administrador.
*   **Descripción**: Alta, modificación y baja lógica de productos del menú o insumos.
*   **Flujo principal**:
    1. El administrador accede a `/admin/productos`.
    2. Define nombre, precio, categoría, tipo (Venta/Insumo) y seguimiento de stock.
    3. Al editar, se puede actualizar el stock por reabastecimiento directo.
*   **Postcondiciones**: Actualización en base de datos. Si se da de baja un producto, pasa a `activo = false` ocultándose del menú pero preservando la integridad del historial.

### Caso de Uso: Gestionar categorías (CDU-SAO-004)
*   **Actor/es**: Administrador.
*   **Descripción**: Gestión de categorías de productos y sus colores de visualización.
*   **Flujo principal**:
    1. El administrador abre el modal de categorías.
    2. Carga el nombre y los colores en formato Hexadecimal (validado por regex).
*   **Postcondiciones**: Si una categoría es desactivada, los productos vendibles pertenecientes a ella quedan bloqueados para su venta de forma automática.

### Caso de Uso: Cierre de jornada (CDU-SAO-005)
*   **Actor/es**: Administrador.
*   **Precondiciones**: Jornada en estado 'abierta'.
*   **Flujo principal**:
    1. Ingreso de PIN de Administrador (Validado localmente mediante hash SHA-256).
    2. Bloqueo transaccional de comandas (Jornada pasa a 'en_auditoria').
    3. Registro de egresos y el ingreso manual de posnet de Mercado Pago.
    4. Auditoría de inventario físico ingresando conteo de insumos.
    5. Cierre definitivo.
*   **Postcondiciones**: El sistema consolida la ganancia neta (`efectivo + MP real - gastos`), guarda la foto del stock de apertura y actualiza el stock actual de catálogo con los conteos físicos para servir de base para la próxima jornada.

### Caso de Uso: Simulación de Costos (CDU-SAO-006)
*   **Actor/es**: Administrador.
*   **Descripción**: Simulación de compra o consumo en caliente de insumos y exportación en formato A4.
*   **Flujo principal**:
    1. Ingresa a la calculadora.
    2. Carga filas de insumos con autocompletado y define cantidades e importes unitarios.
    3. Compara totales recalculados.
    4. Presiona Guardar / Imprimir.
*   **Postcondiciones**: Se lanza el cuadro de diálogo de impresión del navegador renderizando el PDF A4 limpio en blanco, sin persistencia en base de datos.
