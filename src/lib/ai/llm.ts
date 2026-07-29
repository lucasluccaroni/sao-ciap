import { ILLMProvider, LLMProviderType, MensajeIA, DefinicionTool, RespuestaLLM } from './types'

export type { MensajeIA, DefinicionTool, RespuestaLLM }

/**
 * Adaptador de LLM para OpenRouter / OpenAI Compatible REST APIs.
 */
class OpenRouterLLMAdapter implements ILLMProvider {
  async generarRespuesta(mensajes: MensajeIA[], herramientas?: DefinicionTool[]): Promise<RespuestaLLM> {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY
    if (!apiKey) {
      throw new Error('Falta OPENROUTER_API_KEY en las variables de entorno.')
    }

    let model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct'
    if (process.env.LLM_MODEL && process.env.LLM_MODEL.includes('/')) {
      model = process.env.LLM_MODEL
    }
    const baseUrl = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'

    const bodyPayload: any = {
      model,
      messages: mensajes,
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 1024,
    }

    if (herramientas && herramientas.length > 0) {
      bodyPayload.tools = herramientas
      bodyPayload.tool_choice = 'auto'
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://saobar.local',
        'X-Title': 'SAO Bar AI Assistant',
      },
      body: JSON.stringify(bodyPayload),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Error OpenRouter LLM (${res.status}): ${errText}`)
    }

    const data = await res.json()
    const choice = data?.choices?.[0]?.message

    return {
      contenido: choice?.content || null,
      toolCalls: choice?.tool_calls || undefined,
    }
  }
}

/**
 * Adaptador de LLM para Groq Cloud Native REST API.
 */
class GroqLLMAdapter implements ILLMProvider {
  async generarRespuesta(mensajes: MensajeIA[], herramientas?: DefinicionTool[]): Promise<RespuestaLLM> {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error('Falta GROQ_API_KEY en las variables de entorno.')
    }

    const model = process.env.LLM_MODEL || 'llama-3.3-70b-versatile'

    const bodyPayload: any = {
      model,
      messages: mensajes,
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 1024,
    }

    if (herramientas && herramientas.length > 0) {
      bodyPayload.tools = herramientas
      bodyPayload.tool_choice = 'auto'
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Error Groq LLM (${res.status}): ${errText}`)
    }

    const data = await res.json()
    const choice = data?.choices?.[0]?.message

    return {
      contenido: choice?.content || null,
      toolCalls: choice?.tool_calls || undefined,
    }
  }
}

/**
 * Fábrica de Proveedores de LLM (Factory Pattern).
 * Resuelve el motor según la variable AI_LLM_PROVIDER en .env.local
 */
export function obtenerProveedorLLM(): ILLMProvider {
  const providerType = (process.env.AI_LLM_PROVIDER || 'openrouter').toLowerCase() as LLMProviderType

  switch (providerType) {
    case 'groq':
      return new GroqLLMAdapter()
    case 'openrouter':
    case 'openai':
    default:
      return new OpenRouterLLMAdapter()
  }
}

/**
 * Función principal exportada compatible con las Server Actions.
 * Implementa resiliencia y Failover Automático: si el proveedor primario (ej. Groq)
 * agota su cuota diaria (429 Rate Limit) o falla, deriva instantáneamente la consulta a OpenRouter.
 */
export async function generarRespuestaLLM(
  mensajes: MensajeIA[],
  herramientas?: DefinicionTool[]
): Promise<RespuestaLLM> {
  const providerType = (process.env.AI_LLM_PROVIDER || 'openrouter').toLowerCase()

  try {
    const provider = obtenerProveedorLLM()
    return await provider.generarRespuesta(mensajes, herramientas)
  } catch (primaryErr: any) {
    console.warn(`[LLM ALERTA PRIMARIA] Proveedor principal (${providerType}) falló: ${primaryErr.message}`)

    // 1. Si el principal es OpenRouter y falla (sin crédito o error), deriva temporalmente a Groq
    if ((providerType === 'openrouter' || providerType === 'openai') && process.env.GROQ_API_KEY) {
      console.warn(
        `[LLM FAILOVER AUTOMÁTICO] OpenRouter inalcanzable. Derivando consulta a Groq Cloud (llama-3.3-70b-versatile)...`
      )
      try {
        const groqFallback = new GroqLLMAdapter()
        return await groqFallback.generarRespuesta(mensajes, herramientas)
      } catch (secErr: any) {
        throw new Error(`Ambos proveedores de IA (OpenRouter y Groq) fallaron. ${secErr.message}`)
      }
    }

    // 2. Si el principal es Groq y falla (rate limit 429), deriva temporalmente a OpenRouter
    if (providerType === 'groq' && process.env.OPENROUTER_API_KEY) {
      console.warn(
        `[LLM FAILOVER AUTOMÁTICO] Groq inalcanzable. Derivando consulta a OpenRouter (meta-llama/llama-3.3-70b-instruct)...`
      )
      try {
        const openRouterFallback = new OpenRouterLLMAdapter()
        return await openRouterFallback.generarRespuesta(mensajes, herramientas)
      } catch (secErr: any) {
        throw new Error(`Ambos proveedores de IA (Groq y OpenRouter) fallaron. ${secErr.message}`)
      }
    }

    throw primaryErr
  }
}
