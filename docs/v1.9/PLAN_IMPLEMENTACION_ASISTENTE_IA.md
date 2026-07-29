# Plan de Implementacion: Asistente IA - SAO Bar

## Fase 0: Preparacion del entorno de desarrollo aislado

### Paso 0.1 — Crear proyecto Supabase de desarrollo
Crear un segundo proyecto gratuito en Supabase exclusivo para desarrollo del asistente.
Ejecutar el schema.sql existente para replicar la estructura de tablas.
Insertar datos de prueba (productos, categorias, jornadas de ejemplo, comandas ficticias)
para poder probar consultas en vivo del asistente.

### Paso 0.2 — Crear rama feature/asistente-ia
Crear la rama desde production. Todo el desarrollo del asistente se hace aca.
Vercel va a generar automaticamente un Preview Deployment con una URL propia.

### Paso 0.3 — Configurar env vars del Preview Deployment
En el dashboard de Vercel, configurar las variables de entorno del Preview Deployment
para que apunten a la base de Supabase de desarrollo (no a la de produccion).
Agregar las API keys de Groq y OpenRouter como env vars del preview.
Las env vars de produccion no se tocan.

### Paso 0.4 — Configurar env vars locales
En el archivo local D:\secrets\sao-ciap\.env.local, agregar las claves de Groq,
OpenRouter, y los datos de conexion de la base de desarrollo de Supabase.
Mantener un comentario claro indicando que son las credenciales de desarrollo,
no de produccion.

---

## Fase 1: Infraestructura vectorial (pgvector + ingesta)

### Paso 1.1 — Habilitar pgvector en Supabase de desarrollo
Desde el dashboard de Supabase del proyecto de desarrollo:
Extensions > buscar "vector" > habilitar.
Esto agrega el tipo de dato vector() a PostgreSQL.

### Paso 1.2 — Crear la tabla knowledge_chunks
Ejecutar el SQL de creacion de la tabla en Supabase.
La tabla incluye:
- id (UUID, PK)
- titulo (text): el heading del chunk, sirve como metadata
- contenido (text): el texto plano del chunk
- embedding (vector(768)): el vector generado por nomic-embed-text-v1.5
  (o la dimension que corresponda al modelo de embedding elegido)
- categoria (text): clasificacion tematica (procedimiento, regla, faq)
- created_at (timestamptz)

Crear indice vectorial HNSW sobre la columna embedding para busquedas eficientes.
Habilitar RLS con politica de lectura restringida al rol Admin.

### Paso 1.3 — Crear funcion SQL de busqueda por similitud
Crear una funcion PostgreSQL (match_knowledge) que reciba un vector de consulta,
un umbral de similitud y un limite de resultados, y devuelva los chunks mas
similares usando el operador de distancia coseno (<=>).

### Paso 1.4 — Escribir script de ingesta
Script TypeScript (ejecutable con tsx o ts-node) que:
1. Lee el archivo sao_bar_conocimiento_estable.md
2. Lo splitea por headings ## (cada heading = un chunk)
3. Para cada chunk, llama al proveedor de embeddings (OpenRouter / Nemotron
   o Groq, segun lo que se defina) con el prefijo "search_document: "
4. Inserta el chunk con su embedding en la tabla knowledge_chunks via Supabase

El script se ejecuta una vez desde la maquina local del desarrollador.
Es repetible: si se corre de nuevo, limpia la tabla y re-inserta todo.

### Paso 1.5 — Ejecutar ingesta y verificar
Correr el script contra la base de desarrollo.
Verificar en el dashboard de Supabase que los 20 chunks estan insertados
con sus vectores de 768 dimensiones.
Hacer una consulta SQL manual de prueba con match_knowledge para validar
que la busqueda por similitud devuelve resultados coherentes.

---

## Fase 2: Backend de consulta (Server Actions + orquestacion LLM)

### Paso 2.1 — Crear adapter de embeddings
Modulo TypeScript con interfaz generica:
  generarEmbedding(texto: string): Promise<number[]>
Implementacion concreta para OpenRouter/Nemotron (o Groq si se confirma soporte).
Usa el prefijo "search_query: " para consultas del usuario.

### Paso 2.2 — Crear adapter de generacion LLM
Modulo TypeScript con interfaz generica:
  generarRespuesta(mensajes: Mensaje[], herramientas?: Tool[]): Promise<string>
Implementacion concreta para Groq con llama-3.3-70b-versatile.
Soporte de streaming para respuestas progresivas.
Soporte de tool use para que el modelo pueda pedir datos en vivo.

### Paso 2.3 — Crear funciones de datos en vivo (tools)
Server Actions que consultan datos volatiles de la base de datos:
- consultarStockActual(productoNombre?: string): stock de uno o todos los productos
- consultarVentasJornada(jornadaId?: string): ventas de la jornada activa o especifica
- consultarCajaJornada(): estado financiero de la jornada activa
- consultarProductos(filtro?: string): catalogo con precios y categorias

Estas funciones son las "herramientas" que el LLM puede invocar via tool use
cuando la pregunta requiere datos operativos en tiempo real.

### Paso 2.4 — Crear Server Action principal: consultarAsistente
Esta es la funcion central que orquesta todo el flujo:
1. Recibe la pregunta del usuario
2. Genera el embedding de la pregunta (adapter de embeddings)
3. Busca chunks similares en pgvector (match_knowledge)
4. Ensambla el prompt aumentado con los chunks recuperados
5. Llama al LLM con el prompt y las herramientas disponibles (adapter de generacion)
6. Si el LLM invoca una herramienta, ejecuta la funcion y re-invoca al LLM con el resultado
7. Devuelve la respuesta final

### Paso 2.5 — Probar el flujo completo sin UI
Escribir un test manual (script o ruta API de prueba) que llame a consultarAsistente
con preguntas de ejemplo y verifique:
- Que el RAG recupera chunks relevantes
- Que el LLM usa tool use cuando corresponde (preguntas de datos en vivo)
- Que las respuestas son coherentes y en castellano
- Que no hay alucinaciones evidentes

---

## Fase 3: Interfaz de chat (/admin/asistente)

### Paso 3.1 — Crear pagina /admin/asistente
Nueva ruta en el panel de administracion, accesible solo para el rol Admin.
Agregar el enlace en la barra de navegacion AdminNav.

### Paso 3.2 — Componente de chat
Interfaz de chat con:
- Historial de mensajes (usuario y asistente) en React state
- Input de texto para escribir la pregunta
- Boton de envio
- Indicador de carga mientras el asistente procesa
- Renderizado de la respuesta con formato basico

Usar los design tokens del proyecto: fondo #1A1A1A, texto #F2F2F2,
acciones en naranja #F26A1B, acentos cian #30CFF2, tipografia Livvic.

### Paso 3.3 — Integrar streaming (opcional, mejora de UX)
Si el adapter de Groq soporta streaming, mostrar la respuesta del asistente
caracter por caracter en tiempo real en vez de esperar a que termine.
Esto mejora la percepcion de velocidad.

### Paso 3.4 — Mensaje de bienvenida y sugerencias
Al abrir la pantalla del asistente, mostrar un mensaje de bienvenida
y 3-4 preguntas sugeridas clickeables para que la administradora
entienda que tipo de cosas puede preguntar.

---

## Fase 4: Ajuste y validacion

### Paso 4.1 — System prompt del asistente
Redactar el prompt de sistema que define el comportamiento del asistente:
- Personalidad: asistente del bar SAO, responde en castellano argentino
- Restricciones: no inventar datos, si no sabe algo decirlo
- Formato: respuestas concisas, directas, sin jerga tecnica
- Contexto: siempre tiene acceso al conocimiento del bar y puede
  consultar datos en vivo cuando se le pide informacion operativa

### Paso 4.2 — Calibrar temperatura
Probar con temperatura baja (0.1-0.3) para respuestas factuales.
Evaluar si las respuestas son demasiado rigidas o demasiado creativas.
Ajustar segun el resultado.

### Paso 4.3 — Guardrails contra alucinaciones
Implementar verificacion de que el asistente no inventa datos:
- Si el RAG no devuelve chunks relevantes (similitud baja),
  el asistente debe decir que no tiene informacion suficiente
- Si una herramienta devuelve un error, el asistente debe informarlo
  en vez de inventar un numero

### Paso 4.4 — Pruebas con preguntas reales
Bateria de pruebas con preguntas que la administradora haria:
- Procedimientos: "como abro una jornada", "como hago el cierre"
- Datos en vivo: "cuanto hay en stock de fernet", "cuanto vendimos hoy"
- Reglas de negocio: "que es el stock compartido", "que pasa si regalo algo"
- Edge cases: preguntas fuera del dominio, preguntas ambiguas, preguntas
  que mezclan conocimiento estable con datos en vivo

### Paso 4.5 — Validacion con la administradora (opcional pre-merge)
Si es posible, darle acceso a la URL de preview a la administradora
para que pruebe el asistente con preguntas reales antes de mergear
a produccion.

---

## Merge a produccion

Una vez validado todo en el Preview Deployment:
1. Habilitar pgvector en la base de Supabase de produccion
2. Crear la tabla knowledge_chunks en produccion
3. Crear la funcion match_knowledge en produccion
4. Correr el script de ingesta contra la base de produccion
5. Agregar las API keys de Groq y OpenRouter como env vars de produccion en Vercel
6. Mergear feature/asistente-ia a production
7. Vercel despliega automaticamente
8. Verificar que el asistente funciona en produccion

---

## Dependencias externas

| Servicio   | Uso                    | Tier   | Limite relevante              |
|------------|------------------------|--------|-------------------------------|
| Groq       | Generacion de texto    | Free   | 14.400 req/dia, 30 RPM       |
| OpenRouter | Embeddings (Nemotron)  | Free   | 50 req/dia (sin balance)      |
| Supabase   | Base de datos + vector | Free   | 500 MB DB, extensiones gratis |
| Vercel     | Hosting + preview      | Free   | Preview deployments incluidos |
