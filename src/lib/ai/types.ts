/**
 * Contratos de Interfaz (Abstracción) para el Ecosistema de IA de SAO Bar 2026.
 * Permite cambiar de proveedor (OpenRouter, Groq, HuggingFace, OpenAI) sin tocar
 * la lógica del negocio ni el código de las Server Actions.
 */

export type EmbeddingProviderType = 'openrouter' | 'huggingface' | 'openai' | 'groq'
export type LLMProviderType = 'openrouter' | 'groq' | 'openai' | 'anthropic'

export interface MensajeIA {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_call_id?: string
  tool_calls?: any[]
}

export interface DefinicionTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
}

export interface RespuestaLLM {
  contenido: string | null
  toolCalls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
}

/**
 * Contrato genérico para motores de Embeddings.
 */
export interface IEmbeddingProvider {
  generarEmbedding(texto: string, modo: 'documento' | 'consulta'): Promise<number[]>
}

/**
 * Contrato genérico para motores de Procesamiento LLM.
 */
export interface ILLMProvider {
  generarRespuesta(mensajes: MensajeIA[], herramientas?: DefinicionTool[]): Promise<RespuestaLLM>
}
