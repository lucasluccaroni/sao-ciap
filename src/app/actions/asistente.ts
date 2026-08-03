'use server'

import { createClient } from '@/utils/supabase/server'
import { generarEmbedding } from '@/lib/ai/embeddings'
import { generarRespuestaLLM, MensajeIA } from '@/lib/ai/llm'
import { HERRAMIENTAS_ASISTENTE, ejecutarTool } from '@/lib/ai/tools'

export async function consultarAsistente(preguntaUsuario: string): Promise<{
  ok: boolean
  respuesta?: string
  error?: string
}> {
  try {
    if (!preguntaUsuario || preguntaUsuario.trim().length === 0) {
      return { ok: false, error: 'Por favor, ingresa una pregunta válida.' }
    }

    const supabase = await createClient()

    // 1. Validar autenticación
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { ok: false, error: 'Acceso no autorizado. Inicia sesión como Administrador.' }
    }

    // 2. RAG: Generar embedding de la consulta y buscar en vector DB
    let contextoRAG = ''
    try {
      const queryVector = await generarEmbedding(preguntaUsuario, 'consulta')
      const { data: chunks, error: rpcError } = await supabase.rpc('match_knowledge', {
        query_embedding: queryVector,
        match_threshold: 0.15,
        match_count: 6,
      })


      if (!rpcError && chunks && chunks.length > 0) {
        contextoRAG = chunks
          .map(
            (c: any, index: number) =>
              `[FRAGMENTO RELEVANTE ${index + 1}: ${c.titulo}]\n${c.contenido}`
          )
          .join('\n\n')
      }
    } catch (embErr: any) {
      console.warn('Advertencia en RAG Embeddings (continuando con LLM):', embErr.message)
    }

    // 3. Formatear Prompt del Sistema con Guardrails de Seguridad
    const systemPrompt = `Eres el Bot Asistente Oficial de SAO Bar 2026. Tu objetivo es asistir a la administradora del bar respondiendo dudas sobre procedimientos, reglas de negocio y estado en tiempo real del inventario y la caja.

DIRECTIVAS Y BLINDAJE DE SEGURIDAD (GUARDRAILS):
1. IDIOMA EXCLUSIVO: Solo puedes interactuar y responder en idioma español. Si recibes consultas en otro idioma, responde amablemente en español indicando que solo puedes atender preguntas en español.
2. DELIMITACIÓN DE DOMINIO: Tu único ámbito de conocimiento y conversación es la operación, reglas, inventario, ventas y caja de SAO Bar 2026. Si te realizan preguntas ajenas al bar (deportes, política, clima, programación general, etc.), responde con cordialidad que tu función está limitada a la gestión del bar.
3. PROHIBIDO INVENTAR O SUPONER DATO ALGUN (ZERO-HALLUCINATION): No inventes ni supongas datos, precios, existencias ni nombres que no tengas en el conocimiento RAG o en las herramientas SQL. Si no posees la información o los datos no están disponibles, indícalo de forma clara y honesta sin hacer suposiciones.
4. TONO CORDIAL Y COMPORTAMIENTO: Mantén siempre un trato amable, educado, atento y profesional con la administradora.
5. RESPUESTAS CLARAS Y SIN EMOJIS: Proporciona explicaciones estructuradas, claras y concisas en español argentino. Queda STRICTAMENTE PROHIBIDO el uso de emojis en cualquier parte de tu respuesta.
6. PRUDENCIA Y ANÁLISIS PROFUNDO: Antes de responder, analiza con detenimiento la información recuperada y las herramientas invocadas. Si te realizan preguntas parecidas o recurrentes, razona cuidadosamente la respuesta para brindar la explicación más clara y precisa sin apurarte.
7. SOLO LECTURA STRICTA (READ-ONLY): Tienes estrictamente prohibido intentar modificar, alterar, borrar o insertar datos, tablas, productos, precios o registros. Tu función es única y exclusivamente informativa y de consulta de datos en tiempo real (solo lectura). Si el usuario solicita realizar cambios en los datos, indícale amablemente que deben realizarse desde la sección correspondiente del panel de administración.
8. PRIORIDAD PROCEDIMENTAL (RAG) VS DATOS EN VIVO (TOOLS): Si el usuario pregunta SOBRE UN PROCEDIMIENTO, REGLA DE NEGOCIO, PASO A PASO O INSTRUCCIÓN DE USO (ej. "¿cómo elimino un producto?", "¿cómo se hace el cierre?", "¿cómo funciona la calculadora?"), DEBES RESPONDER EXPLICANDO EL PROCEDIMIENTO PASO A PASO basándote en el CONOCIMIENTO PROCEDIMENTAL recuperado por RAG. NO te limites a invocar o listar herramientas de base de datos. Si ejecutas una herramienta SQL, SIEMPRE debes responder a la pregunta original del usuario explicando el procedimiento correspondiente.

CONOCIMIENTO PROCEDIMENTAL DEL SISTEMA SAO BAR:
${contextoRAG || 'No se recuperaron fragmentos específicos para esta consulta.'}`


    const mensajes: MensajeIA[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: preguntaUsuario.trim() },
    ]

    // 4. Bucle de resolución de Tool Calling (máximo 5 iteraciones)
    let iteracion = 0
    const maxIteraciones = 5

    while (iteracion < maxIteraciones) {
      iteracion++
      const resLLM = await generarRespuestaLLM(mensajes, HERRAMIENTAS_ASISTENTE)

      // Si el modelo devuelve un mensaje de texto final
      if (resLLM.contenido && (!resLLM.toolCalls || resLLM.toolCalls.length === 0)) {
        return { ok: true, respuesta: resLLM.contenido }
      }

      // Si el modelo solicita ejecutar herramientas
      if (resLLM.toolCalls && resLLM.toolCalls.length > 0) {
        // Agregar la solicitud del asistente al historial
        mensajes.push({
          role: 'assistant',
          content: resLLM.contenido || '',
          tool_calls: resLLM.toolCalls,
        })

        // Ejecutar cada herramienta solicitada
        for (const toolCall of resLLM.toolCalls) {
          const toolNombre = toolCall.function.name
          const toolArgs = toolCall.function.arguments
          console.log(`[ASISTENTE TOOL CALL] Ejecutando: ${toolNombre}(${toolArgs})`)

          const resultadoStr = await ejecutarTool(toolNombre, toolArgs, supabase)

          mensajes.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolNombre,
            content: resultadoStr,
          })
        }
      } else {
        return { ok: true, respuesta: resLLM.contenido || 'No se obtuvo respuesta.' }
      }
    }

    // Paso de resiliencia final: Forzar síntesis sin herramientas para asegurar respuesta en texto plano
    const resFinalForzada = await generarRespuestaLLM(mensajes)
    return { ok: true, respuesta: resFinalForzada.contenido || 'No se pudo generar una respuesta final.' }
  } catch (err: any) {
    console.error('Error en consultarAsistente:', err)
    return { ok: false, error: err.message || 'Error interno al procesar la consulta.' }
  }
}
