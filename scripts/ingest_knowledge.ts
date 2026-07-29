import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Cargar variables de entorno del archivo .env.local externo
const envPath = process.env.DOTENV_CONFIG_PATH || 'D:\\secrets\\sao-ciap-asistente\\.env.local'
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

// Importar módulo de embeddings
import { generarEmbedding } from '../src/lib/ai/embeddings'

interface ChunkData {
  titulo: string
  contenido: string
  categoria: string
}

async function runIngestion() {
  console.log('====================================================')
  console.log('  SAO BAR 2026 - INGESTA DE CONOCIMIENTO VECTORIAL  ')
  console.log('====================================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Falta NEXT_PUBLIC_SUPABASE_URL o llaves de Supabase en las variables de entorno.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Leer el archivo de conocimiento estable
  const filePath = path.join(process.cwd(), 'docs', 'v1.9', 'sao_bar_conocimiento_estable.md')
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: No se encontró el archivo de conocimiento en ${filePath}`)
    process.exit(1)
  }

  const rawText = fs.readFileSync(filePath, 'utf-8')
  console.log(`Archivo de conocimiento leído correctamente (${rawText.length} caracteres).`)

  // 2. Parsear el Markdown en chunks por secciones ##
  const rawSections = rawText.split(/^##\s+/m)
  const chunks: ChunkData[] = []

  for (const section of rawSections) {
    const trimmed = section.trim()
    if (!trimmed || trimmed.startsWith('# Base de conocimiento')) continue

    const lines = trimmed.split('\n')
    const titulo = lines[0].trim()
    const contenido = lines.slice(1).join('\n').trim()

    if (!titulo || !contenido) continue

    // Determinar categoría básica según el título
    let categoria = 'procedimiento'
    const tituloLower = titulo.toLowerCase()
    if (tituloLower.includes('faq') || tituloLower.includes('preguntas frecuentes')) {
      categoria = 'faq'
    } else if (tituloLower.includes('rol') || tituloLower.includes('regla')) {
      categoria = 'regla'
    }

    chunks.push({
      titulo,
      contenido: `${titulo}\n\n${contenido}`, // Incluir título en el contenido para mayor densidad semántica
      categoria,
    })
  }

  console.log(`Se identificaron ${chunks.length} chunks atómicos para vectorizar.\n`)

  // 3. Limpiar tabla previa (Idempotencia)
  console.log('Limpiando registros antiguos de la tabla knowledge_chunks...')
  const { error: deleteError } = await supabase
    .from('knowledge_chunks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Eliminar todo

  if (deleteError) {
    console.warn('Advertencia al limpiar la tabla (puede estar vacía):', deleteError.message)
  }

  // 4. Vectorizar e insertar cada chunk
  let insertados = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`[${i + 1}/${chunks.length}] Generando vector para: "${chunk.titulo}"...`)

    try {
      const embedding = await generarEmbedding(chunk.contenido, 'documento')

      const { error: insertError } = await supabase.from('knowledge_chunks').insert({
        titulo: chunk.titulo,
        contenido: chunk.contenido,
        embedding: embedding,
        categoria: chunk.categoria,
      })

      if (insertError) {
        console.error(`  -> Error al insertar chunk "${chunk.titulo}":`, insertError.message)
      } else {
        insertados++
        console.log(`  -> OK! Vector de ${embedding.length}d insertado.`)
      }
    } catch (err: any) {
      console.error(`  -> Error generando embedding para "${chunk.titulo}":`, err.message)
    }

    // Pequeña pausa para no saturar la API
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  console.log('\n====================================================')
  console.log(`  INGESTA FINALIZADA: ${insertados}/${chunks.length} chunks insertados exitosamente.`)
  console.log('====================================================')
}

runIngestion()
