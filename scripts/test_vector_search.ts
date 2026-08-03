import fs from 'fs'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Cargar variables de entorno del archivo .env.local externo
const envPath = process.env.DOTENV_CONFIG_PATH || 'D:\\secrets\\sao-ciap\\.env.local'
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}


import { generarEmbedding } from '../src/lib/ai/embeddings'

async function probarBusquedaVectorial() {
  const preguntasEjemplo = [
    '¿Cómo se abre una nueva jornada?',
    '¿Cuándo debo usar stock compartido y cuándo no?',
    '¿Qué pasa con el stock cuando hago una comanda de regalo?',
    '¿Cómo se calcula el desvío de inventario en el cierre?',
  ]

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Falta NEXT_PUBLIC_SUPABASE_URL o llaves de Supabase.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('====================================================')
  console.log('  PRUEBA DE BÚSQUEDA SEMÁNTICA CON PGVECTOR (RPC)   ')
  console.log('====================================================\n')

  for (const pregunta of preguntasEjemplo) {
    console.log(`\n----------------------------------------------------`)
    console.log(`Pregunta: "${pregunta}"`)
    console.log(`----------------------------------------------------`)

    try {
      const queryVector = await generarEmbedding(pregunta, 'consulta')

      const { data: resultados, error } = await supabase.rpc('match_knowledge', {
        query_embedding: queryVector,
        match_threshold: 0.2,
        match_count: 2,
      })

      if (error) {
        console.error('Error invocando match_knowledge RPC:', error.message)
        continue
      }

      if (!resultados || resultados.length === 0) {
        console.log('No se encontraron chunks similares por encima del umbral.')
        continue
      }

      resultados.forEach((res: any, index: number) => {
        const simPorcentaje = (res.similarity * 100).toFixed(2)
        console.log(`[Resultado ${index + 1}] Similitud: ${simPorcentaje}% | Título: "${res.titulo}"`)
        console.log(`Extracto: ${res.contenido.substring(0, 150)}...\n`)
      })
    } catch (err: any) {
      console.error('Error procesando pregunta:', err.message)
    }
  }
}

probarBusquedaVectorial()
