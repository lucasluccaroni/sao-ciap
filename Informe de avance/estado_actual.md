# Estado Actual del Proyecto: Sistema de Gestión de Bar

Este archivo sirve como punto de control (handoff) en tiempo real. Se actualiza incrementalmente durante el desarrollo para que, en caso de interrupción repentina o relevo de IA, la siguiente sesión pueda continuar sin pérdida de contexto.

---

## 📌 Resumen de Situación
*   **Fase Actual**: Frontend / UI - Desarrollo de pantallas.
*   **Último Hito Completado**: Pantalla de Login, Layout administrativo `/admin`, Caja del Día (`/admin/caja`), Flujo de Cierre de Caja (`/admin/cierre`), Módulo de Gestión de Productos y Categorías (ABM) en `/admin/productos`, y Terminal de Comandas en `/comandas` 100% integrados con backend y base de datos, con soporte para concurrencia, responsive scroll por zoom y control de cierre de sesión interactivo.
*   **Estado de la Sesión**: Listo para el maquetado de Historiales de Jornadas e Informes de Stock o el módulo de la Calculadora de Costos.

---

## 🛠️ Tareas y Progreso Detallado

### 1. Inicialización y Preparación
- [x] Crear sistema de control de estado en `/Informe de avance`
- [x] Analizar requerimientos en `/docs`
- [x] Analizar diseños en `/design`

### 2. Base de Datos
- [x] Diseñar esquema de la base de datos (Plan conceptual aprobado)
- [x] Crear scripts de migración/inicialización (`schema.sql` y `triggers.sql`)
- [x] Crear políticas de seguridad Row Level Security (`policies.sql`)
- [x] Optimizar la función SQL RPC `procesar_comanda` para validar stock en un bucle preliminar antes de insertar la cabecera en `Comandas`, evitando saltos/huecos numéricos en la secuencia autoincremental de tickets.

### 3. Backend / API
- [x] Configurar servidor Next.js y dependencias (Next.js 16 + Tailwind 4 + Supabase configurado en package.json)
- [x] Implementar rutas de negocio / Server Actions
    - [x] `validarPinAdmin` — verificacion SHA-256 del PIN del Admin autenticado
    - [x] `obtenerJornadaActiva` — lectura de jornada activa para inicializacion de terminales
    - [x] `abrirJornada` — insercion con control de duplicado via restriccion unica
    - [x] `iniciarAuditoria` — transicion de estado `abierta` a `en_auditoria`
    - [x] `registrarConteosAuditoria` — persiste conteos físicos y unidades utilizadas reales
    - [x] `cerrarJornada` — invoca RPC SQL `cerrar_jornada` para balance atomico y consolidación de stock físico en el catálogo
    - [x] Server Actions de Productos y Categorías (`src/app/actions/productos.ts`) para consultas y modificaciones
- [x] Agregar funcion SQL RPC `cerrar_jornada` a `database/triggers.sql` (Consolidación atómica de finanzas y stock físico en Productos)

### 4. Frontend / UI
- [x] Implementar pantallas segun disenos en `/design`
    - [x] Pantalla de Login (Maquetado e integración de acciones completados; pendiente copia local de assets por parte del usuario)
    - [x] Panel de Control de Jornada (Layout de administración, Caja del Día, Carga de Gastos y flujo secuencial de Cierre de Caja completados en código)
        - [x] Habilitación de la edición manual de consumo de insumos en la auditoría física, recalculando el stock teórico reactivamente.
        - [x] Corrección ortográfica en la leyenda informativa del footer de auditoría.
    - [x] ABM de Productos y Gestión de Categorías (Pantalla en `/admin/productos`, modales de nuevo/editar, confirmación de baja y gestión de categorías completados en código)
        - [x] Clasificación de productos (Toggle: Ventas/Insumos) y Checkbox reactivo de Seguimiento de Stock.
        - [x] Integración de barra de filtros avanzada (por categoría, búsqueda en vivo, tipo de item: Insumos/Productos/Elaboración Instantánea, y checkbox de inactivos).
        - [x] Rediseño estético con fondo naranja corporativo (`bg-[#F26A1B]`) y módulo administrativo central en tarjeta oscura flotante.
    - [x] Interfaz Principal de Ventas (Toma de Comandas en `/comandas` integrada con beeper, medio de pago y bloqueo Realtime de estado de jornada)
        - [x] Sincronización local optimista de stock del catálogo al vender la última unidad antes del refresco de red.
        - [x] Implementación de scroll adaptativo responsive y detector de altura física de viewport (`window.innerHeight`) ante zoom del navegador.
        - [x] Remoción de número secuencial preliminar en título y del borde superior redundante del historial pequeño.
        - [x] Corrección de contraste crítico y simplificación de leyendas en banners de jornada bloqueada y auditoría.
        - [x] Modal interactivo de confirmación de cierre de sesión («Salir») para mozos y administradores (componente `<BotonSalirAdmin />`).

---

## 📐 Especificación del Esquema Acordado
La base de datos se estructurará de la siguiente manera:

1.  **`Categorias_Productos`**:
    *   `id` UUID PK
    *   `nombre` VARCHAR(100) UNIQUE
    *   `color_fondo` VARCHAR(7) (Hexadecimal)
    *   `color_texto` VARCHAR(7) (Hexadecimal)
    *   `activo` BOOLEAN (Default true)
2.  **`Categorias_Gastos`**:
    *   `id` UUID PK
    *   `nombre` VARCHAR(100) UNIQUE
    *   `activo` BOOLEAN (Default true)
3.  **`Usuarios`** (Perfil local mapeado a Supabase Auth):
    *   `id` UUID PK (FK a `auth.users` ON DELETE CASCADE)
    *   `email` VARCHAR(255) UNIQUE
    *   `nombre` VARCHAR(100)
    *   `rol` VARCHAR(50) (Constraint: 'Admin', 'Empleado')
    *   `pin` VARCHAR(64) NULL (Hash SHA-256 de administrador)
    *   `activo` BOOLEAN (Default true)
4.  **`Productos`**:
    *   `id` UUID PK
    *   `nombre` VARCHAR(255)
    *   `categoria_id` UUID (FK a `Categorias_Productos` ON DELETE RESTRICT)
    *   `precio` NUMERIC(10,2)
    *   `stockIdeal` INTEGER
    *   `stockInicial` INTEGER
    *   `stockActual` INTEGER (Default 0)
    *   `unidad` VARCHAR(10) (Constraint: 'u', 'lt', 'ml')
    *   `activo` BOOLEAN (Default true)
    *   `vendible` BOOLEAN (Default true)
    *   `controla_stock` BOOLEAN (Default true)
5.  **`Jornadas`**:
    *   `jornada_id` UUID PK
    *   `estado` VARCHAR(20) (Constraint: 'abierta', 'en_auditoria', 'cerrada')
    *   `fecha_inicio` TIMESTAMP WITH TIME ZONE (Default now())
    *   `fecha_fin` TIMESTAMP WITH TIME ZONE
    *   Totales y balances: `total_efectivo`, `total_mp_lista`, `total_mp_real`, `comision_mp`, `total_general`, `gastos_totales`, `ganancia_neta`.
    *   *Índice Único Parcial*: `CREATE UNIQUE INDEX unique_active_jornada ON Jornadas (estado) WHERE estado IN ('abierta', 'en_auditoria');`
6.  **`Comandas`**:
    *   `comanda_id` UUID PK
    *   `jornada_id` UUID (FK a `Jornadas`)
    *   `usuario_id` UUID (FK a `Usuarios`)
    *   `numero_ticket` SERIAL
    *   `nro_beeper` INTEGER OPTIONAL
    *   `fecha` TIMESTAMP WITH TIME ZONE
    *   `total` NUMERIC(10,2)
    *   `medio_pago` VARCHAR(20) (Constraint: 'Efectivo', 'Mercado Pago')
7.  **`Comanda_Items`**:
    *   `id` UUID PK
    *   `comanda_id` UUID (FK a `Comandas` ON DELETE CASCADE)
    *   `producto_id` UUID (FK a `Productos`)
    *   `cantidad` INTEGER
    *   `precio_unitario_historico` NUMERIC(10,2)
8.  **`Gastos`**:
    *   `id` UUID PK
    *   `jornada_id` UUID (FK a `Jornadas`)
    *   `categoria_id` UUID (FK a `Categorias_Gastos`)
    *   `descripcion` TEXT
    *   `monto` NUMERIC(10,2)
9.  **`Auditoria_Inventario`**:
    *   `id` UUID PK
    *   `jornada_id` UUID (FK a `Jornadas`)
    *   `producto_id` UUID (FK a `Productos`)
    *   `conteo_fisico` INTEGER
    *   `unidades_utilizadas` INTEGER (Default 0)

---

## Instrucciones para la Siguiente IA (Relevo)
Si eres la IA que retoma el desarrollo en un nuevo chat:
1.  **Entorno**: Workspace local `D:\repositorios\sao-ciap`. La base de datos Supabase ya está 100% inicializada y configurada.
2.  **Estado actual**: Las pantallas de Login (`/`), Panel de Control de Jornada (`/admin/caja` y `/admin/cierre`), gestión de Productos/Categorías (`/admin/productos`) y la Terminal de Comandas (`/comandas`) están 100% integradas y robustecidas. La base de datos cuenta con bloqueo pesimista `FOR UPDATE` libre de huecos de ticket ante fallas. Se añadieron filtros por clasificación (Insumos, Productos, Elaboración), responsive scroll ante zoom vertical, alertas de alto contraste y modales de confirmación al cerrar sesión.
3.  **Siguiente Paso Obligatorio**: Estás en la **Fase 4: Frontend / UI**. Debes maquetar e integrar la pantalla de **Historial de Jornadas e Informes de Stock** (`/admin/historial`) o el módulo de la **Calculadora de Costos** volátil de insumos (`/admin/calculadora`).
4.  **Estética**: Recuerda utilizar Tailwind 4 y aplicar los lineamientos de diseño moderno (oscuro premium mate, bordes de vidrio `#9D9D9D/15`, tonos ocre/dorado y naranja quemado para acciones). Revisa `/design` para obtener el contexto visual.
