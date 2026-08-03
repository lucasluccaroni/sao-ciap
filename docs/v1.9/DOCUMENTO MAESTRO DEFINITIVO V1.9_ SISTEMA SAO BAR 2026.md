# DOCUMENTO MAESTRO DEFINITIVO V1.9: SISTEMA SAO BAR 2026

## 1. RESUMEN EJECUTIVO Y ALCANCE TÉCNICO

El sistema SAO Bar 2026 se define como una infraestructura web multi-terminal de alto rendimiento diseñada para la gestión operativa y administrativa de jornadas nocturnas. Su propósito central es garantizar la integridad transaccional y el control de inventario en un entorno de alta demanda, eliminando las discrepancias de los registros manuales.

La versión **v1.9** incorpora el **Módulo Bot Asistente de IA (RAG + Tool Use + Capa de Abstracción Multi-Proveedor)**, permitiendo a la administración interactuar mediante lenguaje natural con el conocimiento procedural del bar y con el estado de inventario/caja en tiempo real.

### Concepto de Jornada Nocturna No-Calendario
Dada la naturaleza operativa del establecimiento, el sistema ignora la linealidad de la fecha calendario del servidor. La actividad que inicia un viernes por la noche y concluye la madrugada del sábado se agrupa bajo un identificador único de "Jornada". Esto permite consolidar métricas financieras y de stock sin la fragmentación que causaría un cambio de fecha a medianoche.

### Entorno Operativo y Concurrencia
El sistema está dimensionado para la operación simultánea de 4 terminales activas bajo un modelo de datos centralizado:
- **3 Terminales de Comandas**: Dispositivos móviles o laptops destinados a la toma de pedidos en salón y barra por parte de los mozos.
- **1 Terminal de Administración**: Estación central (macOS/Windows) para el monitoreo de caja, auditoría física, cierre de jornada y asistente de IA.

### Stack Tecnológico
- **Framework**: Next.js 16 (App Router) para una gestión de rutas y estados optimizada.
- **Base de Datos**: Supabase (PostgreSQL) para la persistencia relacional con integridad ACID y extensión `vector` (`pgvector`).
- **Motor de Inteligencia Artificial (v1.9)**:
  - **Embeddings**: OpenRouter / OpenAI (`openai/text-embedding-3-small` a 768 dimensiones) / Hugging Face.
  - **LLM**: Groq Cloud Native (`llama-3.3-70b-versatile`) / OpenRouter (`meta-llama/llama-3.3-70b-instruct`).
  - **Arquitectura de IA**: Patrón Adapter + Factory con Interfaces Puras TypeScript (`src/lib/ai/types.ts`).
- **Lógica de Servidor**: Server Actions para el procesamiento de reglas de negocio seguras.
- **Estilos**: TailwindCSS 4 para un diseño ligero, responsivo y de alta velocidad de renderizado.

---

## 2. ARQUITECTURA DE DATOS Y CONCURRENCIA

Para mitigar riesgos de sobreventa y colisiones de datos en un entorno de 4 terminales, la arquitectura traslada la lógica crítica al motor de la base de datos.

### Lógica de Stock y Bloqueo Pesimista
El sistema implementa el Procedimiento Almacenado (RPC) `procesar_comanda()`. Este procedimiento ejecuta una transacción atómica que utiliza la cláusula `FOR UPDATE` (Bloqueo Pesimista). Al recibir un pedido, el sistema realiza una pasada preliminar sobre las filas de los productos o insumos origen involucrados bloqueándolas y validando la disponibilidad de stock *antes* de realizar la inserción de la cabecera en la tabla `Comandas`. De esta manera, si el stock es insuficiente, se ejecuta un Rollback inmediato sin alterar ni consumir números de la secuencia autoincremental (`numero_ticket`) del ticket de barra. Si todas las validaciones son correctas, el sistema descuenta las existencias, inserta el registro de cabecera consumiendo el número de ticket y graba los ítems de venta.

### Lógica de Insumos y Stock Compartido (1:1)
Para optimizar el control de productos elaborados en el momento a partir de un recurso común y unitario (ej. pizzas de diversas variedades elaboradas a partir de una cantidad limitada de bollos de masa), el sistema soporta la asociación de stock compartido:
- **Enlace Relacional**: Un producto vendible (Pizza Muzza, Pizza Jamón) puede tener asociado un `insumo_compartido_id` apuntando al insumo origen (Bollo Pizza).
- **Deducción de Inventario**: Al venderse un producto enlazado, la deducción física del stock actual ocurre de forma automática y atómica sobre el insumo común en la base de datos.
- **Blindaje de Terminal contra Sobreventas**: El frontend realiza una acumulación en caliente de todos los ítems agregados al carrito de la terminal que compartan el mismo recurso. Si la sumatoria total del recurso iguala o supera su stock disponible, el sistema deshabilita las tarjetas de todas las variedades correspondientes e impide incrementar cantidades en el carrito local, bloqueando transacciones inválidas en caliente.

### Stock Compartido vs. Productos de Elaboración Instantánea (Regla v1.9)
- **Stock Compartido (1 a 1)**: Aplica exclusivamente cuando la relación insumo-producto es fija y previsible (ej. 1 bollo = 1 pizza de cualquier variedad).
- **Elaboración Instantánea (Venta Directa)**: Productos finales con consumo variable de insumo (ej. Leche en Café, Hielo o Frutas en Coctelería) se configuran como vendibles sin seguimiento directo de stock (`controla_stock = false`). El insumo variable se controla como insumo interno y se audita manualmente durante el Cierre de Jornada.

### Sincronización Realtime
Se utiliza Supabase Realtime (WebSockets) agregando las tablas `Comandas` y `Productos` a la publicación `supabase_realtime`. Cuando el `stockActual` cambia en la base de datos tras una venta o reposición, o se inserta una nueva comanda, todas las terminales reflejan el nuevo estado de los badges de stock y del listado de historial en tiempo real sin necesidad de refrescar el navegador.

---

## 3. LÓGICA DE SEGURIDAD REFORZADA Y ROLES

### Jerarquía de Roles
- **Rol Admin**: Acceso total, incluyendo Auditoría, Historial, ABM de Productos, Cierre de Caja y Bot Asistente de IA.
- **Rol Empleado**: Acceso limitado exclusivamente a la toma de comandas y consulta de stock disponible.

### JornadaGuard y Protección de Terminales (Bloqueo Realtime)
El sistema implementa el middleware `JornadaGuard` y un sistema de WebSockets para bloquear la navegación y funcionalidad de las terminales si no existe una jornada marcada como "Abierta". Esto evita registros accidentales fuera del horario operativo. Si el administrador cambia el estado de la jornada a `en_auditoria` o `cerrada` desde su terminal, la pantalla de los mozos es cubierta de inmediato por un banner opaco bloqueando la interfaz en tiempo real.

---

## 4. ESQUEMA DE BASE DE DATOS (PGSQL)

### Entidad: Usuarios
*   `id`: UUID (Primary Key, Foreign Key -> `auth.users`).
*   `email`: Text (Unique, Not Null).
*   `nombre`: Text (Not Null).
*   `rol`: Text (Check constraint: `'Admin'` o `'Empleado'`).
*   `pin`: Text (Nullable. Almacena Hash SHA-256 del PIN numérico para el login en caja y cierres de jornada).
*   `activo`: Boolean (Default: `true`).

### Entidad: Categorias_Productos
*   `id`: UUID (Primary Key).
*   `nombre`: Text (Unique, Not Null).
*   `color`: Text (Not Null. Código hexadecimal de color UI para badges).
*   `color_texto`: Text (Not Null. Código hexadecimal de color de texto).
*   `activo`: Boolean (Default: `true`).

### Entidad: Productos
*   `id`: UUID (Primary Key).
*   `nombre`: Text (Not Null).
*   `precio`: Numeric(10,2) (Not Null).
*   `categoria_id`: Foreign Key (`Categorias_Productos`).
*   `stockActual`: Integer (Default: `0`).
*   `stockIdeal`: Integer (Default: `0`).
*   `stockInicial`: Integer (Default: `0`).
*   `unidad`: Text (Default: `'unidades'`).
*   `activo`: Boolean (Default: `true`).
*   `vendible`: Boolean (Default: `true`).
*   `controla_stock`: Boolean (Default: `true`).
*   `insumo_compartido_id`: Foreign Key Nullable (`Productos.id`).

### Entidad: Jornadas
*   `jornada_id`: UUID (Primary Key).
*   `fecha_inicio`: Timestamp.
*   `fecha_cierre`: Timestamp (Nullable).
*   `estado`: Text (Check: `'abierta'`, `'en_auditoria'`, `'cerrada'`).
*   `saldo_inicial_efectivo`: Numeric(10,2).
*   `saldo_inicial_mp`: Numeric(10,2).
*   `total_efectivo`: Numeric(10,2).
*   `total_mp_real`: Numeric(10,2).
*   `total_mp_lista`: Numeric(10,2).
*   `comision_mp`: Numeric(10,2).
*   `total_gastos`: Numeric(10,2).
*   `ganancia_neta`: Numeric(10,2).

### Entidad: Comandas
*   `comanda_id`: UUID (Primary Key).
*   `jornada_id`: Foreign Key (`Jornadas`).
*   `numero_ticket`: Integer (Sequence Autoincremental por comanda enviada).
*   `beeper`: Integer (Nullable. Rango 1 al 20 inclusive).
*   `usuario_id`: Foreign Key (`Usuarios`).
*   `fecha`: Timestamp (Default: `now()`).
*   `medio_pago`: Text (Check: `'Efectivo'`, `'Mercado Pago'`, `'Regalo'`).
*   `total`: Numeric(10,2).

### Entidad: Comanda_Items
*   `id`: UUID (Primary Key).
*   `comanda_id`: Foreign Key (`Comandas`).
*   `producto_id`: Foreign Key (`Productos`).
*   `cantidad`: Integer.
*   `precio_unitario`: Numeric(10,2).

### Entidad: Gastos_Jornada
*   `id`: UUID (Primary Key).
*   `jornada_id`: Foreign Key (`Jornadas`).
*   `categoria`: Text (Check: `'Insumos'`, `'Limpieza'`, `'Servicios'`, `'Otros'`, `'Personal'`, `'Mantenimiento'`).
*   `descripcion`: Text.
*   `monto`: Numeric(10,2).

### Entidad: Auditoria_Inventario
*   `id`: UUID (Primary Key).
*   `jornada_id`: Foreign Key (`Jornadas`).
*   `producto_id`: Foreign Key (`Productos`).
*   `conteo_fisico`: Integer.
*   `unidades_utilizadas`: Integer.
*   `unidades_regaladas`: Integer.
*   `stock_inicial`: Integer.

### Entidad: Knowledge_Chunks (Infraestructura Vectorial v1.9)
*   `id`: UUID (Primary Key, Default: `uuid_generate_v4()`).
*   `titulo`: Text (Not Null).
*   `contenido`: Text (Not Null).
*   `embedding`: Vector(768) (Not Null. Almacena el vector generado de 768d).
*   `categoria`: Text (Default: `'procedimiento'`).
*   `created_at`: Timestamptz (Default: `now()`).
*   **Índice HNSW**: `knowledge_chunks_embedding_hnsw_idx` sobre `embedding` usando `vector_cosine_ops`.

---

## 5. MÓDULO BOT ASISTENTE DE IA (v1.9)

### Arquitectura RAG + Tool Use + Abstracción de Proveedores
El Asistente de IA combina dos fuentes de información en tiempo real:
1. **RAG Procedimental (Base de Conocimiento Vectorizada)**:
   - Consulta la tabla `knowledge_chunks` mediante la función RPC `match_knowledge` utilizando similitud coseno sobre vectores de 768 dimensiones.
   - Proporciona respuestas precisas sobre reglas de negocio, apertura, cierre, auditoría y comandas.
2. **Herramientas en Tiempo Real y Analítica Histórica (Tools SQL)**:
   - `consultarStockActual({ productoNombre })`
   - `consultarCajaJornada({ tipo })`
   - `consultarGastosJornada({ tipo })`
   - `consultarVentasJornada({ tipo })`
   - `consultarCategorias()`
   - `consultarCatalogoProductos({ categoriaNombre })`
   - `consultarHistorialJornadas({ limite })`
   - `consultarRendimientoHistoricoProducto({ productoNombre, limiteJornadas })`

### Capa de Abstracción Multi-Proveedor (Adapter + Factory Pattern + Failover)
Para garantizar la independencia tecnológica (Vendor Lock-in zero) y la continuidad operativa a futuro:
- **`src/lib/ai/types.ts`**: Define los contratos `IEmbeddingProvider` e `ILLMProvider`.
- **`src/lib/ai/embeddings.ts`**: Implementa la fábrica `obtenerProveedorEmbeddings()`, soportando OpenRouter (`openai/text-embedding-3-small` / `nomic-embed-text`), Hugging Face Serverless (`BAAI/bge-base-en-v1.5`) y OpenAI directo.
- **`src/lib/ai/llm.ts`**: Implementa la fábrica `obtenerProveedorLLM()`, soportando OpenRouter (`meta-llama/llama-3.3-70b-instruct`) como motor primario principal y Groq Cloud Native (`llama-3.3-70b-versatile`) como respaldo.
- **Resiliencia y Failover Bidireccional**: Cada petición es apátrida (*Stateless*). El sistema siempre intenta primero el proveedor primario (`openrouter`). Si este falla o carece de saldo, conmuta en caliente a Groq. En la siguiente consulta, el sistema intentará nuevamente OpenRouter de forma automática sin quedar bloqueado en el motor de respaldo.
- **Homogeneización de Hiperparámetros**: Todos los adaptadores transmiten explícitamente `temperature: 0.2`, `top_p: 0.9` y `max_tokens: 1024` para garantizar respuestas idénticas y deterministas ante eventos de failover.
- **Configuración Dinámica**: El cambio de preferencia principal se realiza en `.env.local` sin tocar el código fuente:
  ```env
  AI_EMBEDDING_PROVIDER=openrouter
  AI_LLM_PROVIDER=openrouter
  LLM_MODEL=meta-llama/llama-3.3-70b-instruct
  ```

### Interfaz de Usuario Widget (Solapa de Archivero Emergente)
* **Ubicación & Acceso**: Implementado en `src/components/admin/AsistenteWidgetAdmin.tsx` e integrado en `AdminLayout.tsx`. Disponible exclusivamente para el rol Administrador en la zona centro-derecha al pie (`fixed bottom-0 right-[432px] z-50`), despejando holgadamente los botones de acción primarios de la esquina.
* **Estado Plegado**: Se presenta como una solapa/etiqueta de archivero industrial mate (`#1A1A1A`) con bordes superiores redondeados (`rounded-t-lg`), el texto en mayúsculas **ASISTENTE**, indicador de estado pulsante cian (`#30CFF2`) y la flecha de despliegue (`▲`).
* **Estado Desplegado**: Al hacer clic en la solapa, se expande una tarjeta emergente de chat (`w-[410px] h-[520px]`) con la cabecera, indicador de estado **"En línea"**, historial de conversación con scroll automático, chips de preguntas rápidas sugeridas, indicador de pensamiento y campo de entrada de texto.
* **Comportamiento Re-minimizable**: Un clic secundario en la solapa o en el botón de cerrar repliega el chat dejando únicamente la etiqueta visible al pie de pantalla.

### Directivas de Seguridad y Guardrails del Asistente
El sistema aplica un blindaje de seguridad en el Prompt de Sistema mediante 8 directivas strictly enforced:
1. **Idioma Exclusivo**: Interacción y respuestas en idioma español únicamente.
2. **Delimitación de Dominio (Out-of-Domain)**: Respuestas circunscritas exclusivamente a la operación, inventario, ventas y caja de SAO Bar 2026. Consultas ajenas son rechazadas con cordialidad.
3. **Prohibición Estricta de Alucinación (Zero-Hallucination)**: Prohibido inventar datos, precios o existencias no presentes en el RAG o en las consultas SQL de las herramientas.
4. **Tono Cordial y Profesional**: Trato amable, educado y atento con la administradora.
5. **Formato Claro y Sin Emojis**: Respuestas estructuradas en español argentino sin el uso de emojis.
6. **Prudencia y Análisis**: Razonamiento reflexivo de la información antes de generar respuestas apresuradas.
7. **Solo Lectura Estricta (Read-Only)**: Prohibición absoluta de modificar, alterar o borrar registros. El asistente opera en modo de consulta de datos en tiempo real.
8. **Prioridad Procedimental (RAG) vs Datos en Vivo (Tools)**: Ante consultas sobre procedimientos, reglas de negocio o guías paso a paso (ej. ¿cómo elimino/desactivo un producto?, ¿cómo se hace el cierre?, ¿cómo funciona la calculadora?), se obliga al LLM a priorizar la explicación procedimental paso a paso del RAG. Si ejecuta una herramienta SQL, la respuesta final debe integrar obligatoriamente la explicación procedimental para evitar que volcar unicamente datos tape o reemplace la respuesta al usuario.


---

## 6. MÓDULO DE REPORTES Y ANALÍTICA

### Generación Dinámica y Auditoría Anti-Robo
Los reportes se generan mediante JOINs relacionales en tiempo real. El motor de auditoría aplica la siguiente fórmula de conciliación de stock para productos con `controla_stock = true`:
*   **Stock Teórico = Stock Inicial - Unidades Vendidas - Unidades Regaladas**.
*   **Desvío = Conteo Físico - Stock Teórico**.

### Visualización de Desvíos y Ordenamiento
*   **Token Error**: Si el Conteo Físico difiere del Stock Teórico, la interfaz resalta el registro con el color funcional Error (`#E2484A`).
*   **Jerarquía de Datos**: Los reportes de stock se ordenan descendentemente por volumen de ventas.

---

## 7. SISTEMA DE TOKENS VISUALES (SIN TABLAS)

### Tipografía (Google Fonts)
*   **Creepster**: Estilo Display para Logotipo "SAO Bar".
*   **Livvic**: Estilo UI para toda la interfaz (botones, tablas, inputs, lecturas, reportes, historial, chat de IA).

### Colores de Marca
*   **Negro**: `#080A0D` (Fondo primario).
*   **Naranja**: `#F26A1B` (Acciones primarias y paneles).
*   **Cyan**: `#30CFF2` (Énfasis de navegación, logo y distintivos de IA).
*   **Blanco**: `#F2F2F2` (Texto principal).

---

## 8. PROCEDIMIENTOS OPERATIVOS CRÍTICOS

### Ingesta de Conocimiento Vectorial
1. El archivo `docs/v1.9/sao_bar_conocimiento_estable.md` se divide por encabezados `##`.
2. Se ejecuta `npx tsx scripts/ingest_knowledge.ts`.
3. Cada chunk se vectoriza mediante la capa de abstracción de embeddings y se persiste en `knowledge_chunks`.

### Consulta del Asistente de IA
1. La Server Action `consultarAsistente(pregunta)` valida la sesión de administrador.
2. Genera el vector de la pregunta y consulta `match_knowledge` en Supabase.
3. Ensambla el prompt aumentado y llama a `generarRespuestaLLM` con las herramientas activas.
4. Si el LLM solicita ejecutar una herramienta (ej. `consultarStockActual`), la Server Action ejecuta la consulta SQL y le devuelve los datos al LLM para la respuesta final.

---

## 9. CASOS DE USO DESTACADOS (v1.9)

### Caso de Uso: Consulta Asistida al Bot de IA (CDU-SAO-007)
*   **Actor/es**: Administrador.
*   **Precondiciones**: Usuario autenticado como Administrador.
*   **Flujo principal**:
    1. El administrador ingresa a `/admin/asistente` o activa el modal de consulta.
    2. Escribe una pregunta en lenguaje natural (ej. *"¿Cuánto vendimos hoy y cómo viene el stock de Fernet?"*).
    3. La Server Action ejecuta RAG + Tool Use de datos en tiempo real.
    4. El bot responde de forma profesional y concisa sin emojis.
*   **Postcondiciones**: Respuesta visualizada en el chat con datos en tiempo real.
