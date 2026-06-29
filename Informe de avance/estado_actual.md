# Estado Actual del Proyecto: Sistema de Gestión de Bar

Este archivo sirve como punto de control (handoff) en tiempo real. Se actualiza incrementalmente durante el desarrollo para que, en caso de interrupción repentina o relevo de IA, la siguiente sesión pueda continuar sin pérdida de contexto.

---

## 📌 Resumen de Situación
*   **Fase Actual**: Diseño y Preparación de la Base de Datos.
*   **Último Hito Completado**: Análisis de requerimientos y diseños + Plan de implementación estructurado y aprobado.
*   **Estado de la Sesión**: Listo para relevo / Próxima fase.

---

## 🛠️ Tareas y Progreso Detallado

### 1. Inicialización y Preparación
- [x] Crear sistema de control de estado en `/Informe de avance`
- [x] Analizar requerimientos en `/docs`
- [x] Analizar diseños en `/design`

### 2. Base de Datos
- [x] Diseñar esquema de la base de datos (Plan conceptual aprobado)
- [x] Crear scripts de migración/inicialización (Archivos schema.sql y triggers.sql creados en /database)

### 3. Backend / API
- [x] Configurar servidor Next.js y dependencias (Next.js 16 + Tailwind 4 + Supabase configurado en package.json)
- [ ] Implementar rutas de negocio / Server Actions (Conexión a base de datos y CRUDs base)

### 4. Frontend / UI
- [ ] Implementar pantallas según diseños en `/design`

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

---

## 🚀 Instrucciones para la Siguiente IA (Relevo)
Si la sesión anterior se interrumpió:
1.  **Entorno**: Revisa que te encuentras en el workspace local (`D:\repositorios\sao-ciap`). El proyecto ha sido migrado fuera de Google Drive para evitar problemas de sincronización y symlinks.
2.  **Punto de Partida**: Las dependencias ya han sido instaladas de manera limpia y tradicional utilizando `npm install` (generando `node_modules` y `package-lock.json` locales). Se ha enlazado el repositorio local con GitHub para el control de versiones.
3.  **Siguiente Hito (Fase 3: Backend / API - Configuración y Conexión)**:
    *   Configurar los clientes de Supabase para el cliente y el servidor (e.g. en `src/utils/supabase/` utilizando `@supabase/ssr` para manejar cookies en Server Actions).
    *   Comenzar la implementación de las Server Actions básicas para el control de la jornada (Abrir Jornada y validar PIN).
4.  **Confirmación**: Asegúrate de que las credenciales locales de Supabase se carguen correctamente y la conexión inicial a la base de datos responda.

