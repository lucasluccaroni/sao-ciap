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
import { generarRespuestaLLM, MensajeIA } from '../src/lib/ai/llm'
import { HERRAMIENTAS_ASISTENTE, ejecutarTool } from '../src/lib/ai/tools'

async function probarFlujoCompletoAsistente() {
  const preguntasPrueba = [
    '¿Cuál es la diferencia entre stock compartido y producto de elaboración instantánea?',
    '¿Cómo debo proceder si una comanda fue enviada por error?',
  ]

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Falta NEXT_PUBLIC_SUPABASE_URL o llaves de Supabase.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('====================================================')
  console.log('  PRUEBA DEL FLUJO COMPLETO RAG + LLM + FAILOVER    ')
  console.log('====================================================\n')

  for (const pregunta of preguntasPrueba) {
    console.log(`\n----------------------------------------------------`)
    console.log(`PREGUNTA USUARIO: "${pregunta}"`)
    console.log(`----------------------------------------------------`)

    // 1. RAG Vector Search
    const queryVector = await generarEmbedding(pregunta, 'consulta')
    const { data: chunks } = await supabase.rpc('match_knowledge', {
      query_embedding: queryVector,
      match_threshold: 0.25,
      match_count: 3,
    })

    const contextoRAG = chunks
      ? chunks.map((c: any) => `[${c.titulo}]\n${c.contenido}`).join('\n\n')
      : 'Sin contexto.'

    // 2. Prompt del sistema
    const systemPrompt = `Eres el Bot Asistente Oficial de SAO Bar 2026. Responde de forma clara, directa y profesional sin emojis.

CONOCIMIENTO RECUPERADO:
${contextoRAG}`

    const mensajes: MensajeIA[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: pregunta },
    ]

    // 3. Bucle de resolución de Tool Calls
    let iteracion = 0
    const maxIter = 3
    let respuestaFinal = ''

    while (iteracion < maxIter) {
      iteracion++
      const res = await generarRespuestaLLM(mensajes, HERRAMIENTAS_ASISTENTE)

      if (res.contenido && (!res.toolCalls || res.toolCalls.length === 0)) {
        respuestaFinal = res.contenido
        break
      }

      if (res.toolCalls && res.toolCalls.length > 0) {
        mensajes.push({
          role: 'assistant',
          content: res.contenido || '',
          tool_calls: res.toolCalls,
        })

        for (const toolCall of res.toolCalls) {
          console.log(`[TOOL INVOCADO] ${toolCall.function.name}(${toolCall.function.arguments})`)
          const toolResultStr = await ejecutarTool(toolCall.function.name, toolCall.function.arguments, supabase)

          mensajes.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: toolResultStr,
          })
        }
      } else {
        respuestaFinal = res.contenido || 'Sin respuesta'
        break
      }
    }

    console.log(`\nRESPUESTA FINAL DEL ASISTENTE:\n${respuestaFinal}\n`)
  }
}

probarFlujoCompletoAsistente()