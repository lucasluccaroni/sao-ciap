# DOCUMENTO MAESTRO DEFINITIVO V1.5: SISTEMA SAO BAR 2026

## 1. RESUMEN EJECUTIVO Y ALCANCE TÉCNICO

El sistema SAO Bar 2026 se define como una infraestructura web multi-terminal de alto rendimiento diseñada para la gestión operativa y administrativa de jornadas nocturnas. Su propósito central es garantizar la integridad transaccional y el control de inventario en un entorno de alta demanda, eliminando las discrepancias de los registros manuales.

El propósito por el cual se desarrolla este proyecto es para probar cómo implementar un stack tecnológico robusto utilizando Next.js 16, Supabase, Tailwind CSS 4 y Server Actions, optimizando el diseño, el flujo de usuario y garantizando la consistencia de datos a nivel de base de datos a través de una colaboración estrecha con asistentes de IA agénticos.

### Concepto de Jornada Nocturna No-Calendario
Dada la naturaleza operativa del establecimiento, el sistema ignora la linealidad de la fecha calendario del servidor. La actividad que inicia un viernes por la noche y concluye la madrugada del sábado se agrupa bajo un identificador único de "Jornada". Esto permite consolidar métricas financieras y de stock sin la fragmentación que causaría un cambio de fecha a medianoche.

### Entorno Operativo y Concurrencia
El sistema está dimensionado para la operación simultánea de 4 terminales activas bajo un modelo de datos centralizado:
- **3 Terminales de Comandas**: Dispositivos móviles o laptops destinados a la toma de pedidos en salón y barra por parte de los mozos.
- **1 Terminal de Administración**: Estación central (macOS/Windows) para el monitoreo de caja, auditoría física y cierre de jornada.

### Stack Tecnológico
- **Framework**: Next.js 16 (App Router) para una gestión de rutas y estados optimizada.
- **Base de Datos**: Supabase (PostgreSQL) para persistencia relacional con integridad ACID.
- **Lógica de Servidor**: Server Actions para el procesamiento de reglas de negocio seguras.
- **Estilos**: TailwindCSS 4 para un diseño ligero, responsivo y de alta velocidad de renderizado.

---

## 2. ARQUITECTURA DE DATOS Y CONCURRENCIA

Para mitigar riesgos de sobreventa y colisiones de datos en un entorno de 4 terminales, la arquitectura traslada la lógica crítica al motor de la base de datos.

### Lógica de Stock y Bloqueo Pesimista
El sistema implementa el Procedimiento Almacenado (RPC) `procesar_comanda()`. Este procedimiento ejecuta una transacción atómica que utiliza la cláusula `FOR UPDATE` (Bloqueo Pesimista). Al recibir un pedido, el sistema bloquea las filas de los productos involucrados, valida el stock disponible (únicamente para productos con seguimiento de stock), descuenta las unidades y registra la venta. Si el stock es insuficiente, se ejecuta un Rollback inmediato, informando al operario sin corromper la base de datos.

### Sincronización Realtime
Se utiliza Supabase Realtime (WebSockets) para la actualización instantánea de las interfaces de los mozos. Cuando el `stockActual` cambia en la base de datos tras una venta o reposición, todas las terminales reflejan el nuevo estado de los badges de stock sin necesidad de refrescar el navegador.

---

## 3. LÓGICA DE SEGURIDAD REFORZADA Y ROLES

### Jerarquía de Roles
- **Rol Admin**: Acceso total, incluyendo Auditoría, Historial, ABM de Productos y Cierre de Caja.
- **Rol Empleado**: Acceso limitado exclusivamente a la toma de comandas y consulta de stock disponible.

### JornadaGuard y Protección de Terminales
El sistema implementa el middleware `JornadaGuard`. Este componente bloquea la navegación y funcionalidad de las terminales si no existe una jornada marcada como "Abierta". Esto evita registros accidentales fuera del horario operativo.

### Flujo de Cierre y Seguridad Criptográfica
La transición de una jornada de 'Cerrada' a 'Abierta' y de 'Abierta' a 'En Auditoría' es un punto crítico que bloquea preventivamente la creación de nuevas comandas en las 3 terminales de mozos. Este paso requiere la validación obligatoria del PIN de Administrador, el cual se procesa mediante un Hash SHA-256 en el cliente, asegurando que la clave nunca viaje en texto plano.

### Seguridad a Nivel de Fila (RLS)
Se implementa Row Level Security (RLS) en Supabase, garantizando que las políticas de acceso se ejecuten en el motor de la base de datos, blindando la información contra accesos no autorizados vía API.

---

## 4. DICCIONARIO DE DATOS RELACIONAL

A continuación, se detalla la estructura relacional obligatoria para asegurar la integridad referencial.

### Entidad: Usuarios
- `id`: UUID (Primary Key).
- `email`: String (Único).
- `contraseña`: Hash.
- `nombre`: String.
- `rol`: Enum ('Admin', 'Empleado').
- `pin`: Hash SHA-256 (Exclusivo Admin).

### Entidad: Categorias_Productos
- `id`: UUID (Primary Key).
- `nombre`: String (Único).
- `color_fondo`: String (Formato hexadecimal).
- `color_texto`: String (Formato hexadecimal).
- `activo`: Boolean.

### Entidad: Productos
- `id`: UUID (Primary Key).
- `nombre`: String.
- `categoria_id`: Foreign Key (`Categorías_Productos`).
- `precio`: Numeric.
- `stockIdeal`: Integer (Referencia visual semanal).
- `stockInicial`: Integer (Actualizado solo en reposición o creación).
- `stockActual`: Integer (Afectado por `procesar_comanda()` únicamente si `controla_stock` es `true`).
- `unidad`: String (u, lt, ml).
- `activo`: Boolean.
- `vendible`: Boolean (Determina si se muestra en el menú de comandas de los mozos).
- `controla_stock`: Boolean (Determina si el producto realiza seguimiento y descuento dinámico de existencias).

### Entidad: Jornadas
- `jornada_id`: UUID (Primary Key).
- `estado`: Enum ('abierta', 'en_auditoria', 'cerrada').
  - *Constraint*: no puede existir más de una jornada con estado 'abierta' o 'en_auditoria' simultáneamente. La apertura de una nueva jornada solo es válida cuando la jornada más reciente tiene estado 'cerrada'.
- `fecha_inicio`: Timestamp.
- `fecha_fin`: Timestamp.
- `total_efectivo`: Numeric.
- `total_mp_lista`: Numeric (Total teórico de ventas por Mercado Pago calculado en base al precio de lista).
- `total_mp_real`: Numeric (Monto ingresado manualmente por el Admin al cierre).
- `comision_mp`: Numeric (`total_mp_lista - total_mp_real`).
- `total_general`: Numeric (`total_efectivo + total_mp_real`).
- `gastos_totales`: Numeric.
- `ganancia_neta`: Numeric (`total_efectivo + total_mp_real - gastos_totales`).

### Entidad: Comandas
- `comanda_id`: UUID (Primary Key).
- `jornada_id`: Foreign Key (`Jornadas`).
- `usuario_id`: Foreign Key (`Usuarios`).
- `numero_ticket`: SERIAL (Incremental para control de barra/cocina).
- `nro_beeper`: Integer (Opcional).
- `fecha`: Timestamp.
- `total`: Numeric.
- `medio_pago`: Enum ('Efectivo', 'Mercado Pago').

### Entidad: Comanda_Items (N:N Break)
- `id`: UUID (Primary Key).
- `comanda_id`: Foreign Key (`Comandas`).
- `producto_id`: Foreign Key (`Productos`).
- `cantidad`: Integer.
- `precio_unitario_historico`: Numeric (Snapshot del precio al momento de la venta).

### Entidad: Gastos
- `id`: UUID (Primary Key).
- `jornada_id`: Foreign Key (`Jornadas`).
- `categoria_id`: Foreign Key (`Categorías_Gastos`).
- `descripcion`: String.
- `monto`: Numeric.

### Entidad: Auditoria_Inventario
- `id`: UUID (Primary Key).
- `jornada_id`: Foreign Key (`Jornadas`).
- `producto_id`: Foreign Key (`Productos`).
- `conteo_fisico`: Integer (Ingresado por el Admin en el Cierre de Caja; solo aplica para productos con `controla_stock = true`).
- `unidades_utilizadas`: Integer (Persiste la cantidad de unidades vendidas teóricas de comandas o las utilizadas ingresadas manualmente para insumos, determinando el stock teórico de la jornada).

---

## 5. MÓDULO DE REPORTES Y ANALÍTICA

### Generación Dinámica y Auditoría Anti-Robo
Los reportes se generan mediante JOINs relacionales en tiempo real. El motor de auditoría aplica la siguiente fórmula de conciliación de stock para productos con `controla_stock = true`:
- **Stock Teórico = Stock Inicial - Unidades Vendidas** (Agregado de las terminales).

### Visualización de Desvíos y Ordenamiento
- **Token Error**: Si el Conteo Físico difiere del Stock Teórico (para productos con seguimiento de stock), la interfaz resalta el registro con el color funcional Error (`#E2484A`).
- **Jerarquía de Datos**: Los reportes de stock se ordenan descendentemente por volumen de ventas, priorizando los productos de mayor rotación.

### Conciliación de Mercado Pago
Se realiza el cotejo financiero de Mercado Pago en el cierre:
- `comision_mp = total_mp_lista - total_mp_real`.
- **Token Advertencia**: Si `comision_mp` supera un porcentaje configurable (ej: 8-10%), se resalta en color Advertencia (`#BA7517`).

---

## 6. SISTEMA DE TOKENS VISUALES (SIN TABLAS)

### Tipografía (Google Fonts)
- **Creepster**: Estilo Display para Logotipo "SAO Bar" y elementos decorativos.
- **Livvic**: Estilo UI para toda la interfaz (botones, tablas, inputs, lecturas).

### Colores de Marca
- **Negro**: `#080A0D` (Fondo primario).
- **Naranja**: `#F26A1B` (Acciones primarias y paneles).
- **Naranja Alternativo**: `#F25922` (Interacciones y estados activos).
- **Cyan**: `#30CFF2` (Énfasis de navegación y logo).
- **Blanco**: `#F2F2F2` (Texto principal y contrastes).

### Colores Funcionales
- **Efectivo**: `#1D9E75` (Confirmación y éxito).
- **Mercado Pago**: `#378ADD` (Pagos digitales).
- **Error/Peligro**: `#E2484A` (Desvíos, alertas y errores).
- **Advertencia**: `#BA7517` (Alerta de stock bajo o comisiones fuera de lo normal).
- **Gris UI**: `#9D9D9D` (Textos secundarios y deshabilitados).

---

## 7. ESPECIFICACIONES DE INTERFAZ

### Layout General (Shell)
- **Topnav (56px)**: Navegación global con indicadores de rol.
- **Barra de Título (56px)**: Contexto de pantalla y acciones rápidas.

### Módulo ABM de Productos (Patrón Master-Detail)
- **Grilla de Productos**: Muestra el catálogo categorizado. Los productos con `activo = false` se muestran al 40% de opacidad.
- **Formulario de Edición/Alta**:
  - Toggle de clasificación: *«Producto para la venta»* (mapea a `vendible = true`) vs. *«Insumos»* (mapea a `vendible = false`).
  - Checkbox de inventario: *«Seguimiento de stock»* (mapea a `controla_stock = true`).
  - Si el tipo es *Insumo*, el checkbox de *Seguimiento de stock* se fuerza a `true` y se deshabilita.
  - El campo `stockActual` es de solo lectura durante la visualización general, pero permite ingresos de reabastecimiento directo si se edita.

### Terminal de Comandas
- **Sidebar Izquierdo (80px)**: Selector de categorías vertical (solo categorías activas).
- **Grilla de Productos**: Muestra tarjetas de productos con `vendible = true`. Los badges de stock dinámico solo se calculan e interactúan si `controla_stock = true`.
- **Carrito Flotante**: Resumen del pedido y selección de medio de pago (Efectivo/MP).
- **Validación de Stock**: Impide la venta de artículos con `controla_stock = true` si supera el stock disponible.

---

## 8. PROCEDIMIENTOS OPERATIVOS CRÍTICOS

### Envío de Comanda (Transacción Atómica)
Al invocar `procesar_comanda()`:
1. Validación de estado de jornada (Debe ser 'Abierta').
2. Bloqueo de filas en productos vía `FOR UPDATE`.
3. Validación de disponibilidad (`stockActual >= cantidad`) — **solo si `controla_stock = true`**.
4. Inserción en comandas.
5. Inserción en `comanda_items` (Capturando precio actual).
6. Deducción del `stockActual` — **solo si `controla_stock = true`**.

### Flujo de Cierre de Jornada
Este proceso debe ser ejecutado en orden estrictamente atómico:
1. **Validación de PIN**: Validación obligatoria mediante Hash SHA-256.
2. **Transición de Estado**: Cambio de jornada a 'En Auditoría', bloqueando comandas nuevas.
3. **Carga de Gastos + Stock real MP**: Registro de egresos y conciliación manual de posnet de Mercado Pago (`total_mp_real`).
4. **Auditoría Física**: Carga del conteo manual en `Auditoria_Inventario` — **únicamente para productos con `controla_stock = true`**.
5. **Consolidación Final**: El sistema calcula totales de efectivo, Mercado Pago, comisiones y ganancia neta, y transiciona la jornada a 'Cerrada'. Atómicamente, se actualiza el `stockActual` y `stockInicial` de todos los productos auditados en la tabla `Productos` con su correspondiente `conteo_fisico`, sirviendo este último como el stock de partida para la apertura de la siguiente jornada.

---

## 9. ESPECIFICACIÓN TÉCNICA: MÓDULO CALCULADORA DE COSTOS (STATELESS)

### Resumen Funcional y Objetivos del Módulo
La Calculadora de Costos permite a la administración simular costos de insumos de manera volátil (React State local en el cliente) sin impactar el inventario o finanzas oficiales en Supabase. Al refrescar la aplicación, los datos se eliminan.

---

## 10. CASOS DE USO

### Caso de Uso: Tomar comanda (CDU-SAO-001)
- **Actor/es**: Empleado (Mozo).
- **Precondiciones**: Jornada en estado 'abierta'. Productos seleccionados con `controla_stock = true` tienen `stockActual >= cantidad`.
- **Postcondiciones**: Registro de comanda e ítems. El `stockActual` es decrementado únicamente para productos que tengan `controla_stock = true`.

### Caso de Uso: Gestionar productos (CDU-SAO-006)
- **Actor/es**: Administrador.
- **Descripción**: El administrador realiza altas, bajas lógicas y modificaciones en productos.
- **Flujo normal**: Carga de datos categorizando el producto como Venta o Insumo, e indicando si requiere Seguimiento de Stock. El stock actual se inicializa en la creación y se puede modificar por reabastecimiento directo al editar.

### Caso de Uso: Auditoría inventario (CDU-SAO-009)
- **Actor/es**: Administrador.
- **Descripción**: El administrador ingresa el conteo físico real de los insumos y productos que tengan activado el Seguimiento de Stock. El sistema calcula y expone diferencias contra el Stock Teórico calculado.
