import { IEmbeddingProvider, EmbeddingProviderType } from './types'

/**
 * Adaptador de Embeddings para OpenRouter.
 */
class OpenRouterEmbeddingAdapter implements IEmbeddingProvider {
  async generarEmbedding(texto: string): Promise<number[]> {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.EMBEDDINGS_API_KEY
    if (!apiKey) {
      throw new Error('Falta OPENROUTER_API_KEY en las variables de entorno.')
    }

    const model = process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-small'
    const baseUrl = process.env.EMBEDDINGS_BASE_URL || 'https://openrouter.ai/api/v1'

    const res = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://saobar.local',
        'X-Title': 'SAO Bar AI Assistant',
      },
      body: JSON.stringify({
        model,
        input: texto.trim(),
        dimensions: 768,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Error OpenRouter Embeddings (${res.status}): ${errText}`)
    }

    const data = await res.json()
    return data?.data?.[0]?.embedding as number[]
  }
}

/**
 * Adaptador de Embeddings para Hugging Face Serverless Inference.
 */
class HuggingFaceEmbeddingAdapter implements IEmbeddingProvider {
  async generarEmbedding(texto: string, modo: 'documento' | 'consulta'): Promise<number[]> {
    const apiKey = process.env.HUGGINGFACE_API_KEY
    if (!apiKey) {
      throw new Error('Falta HUGGINGFACE_API_KEY en las variables de entorno.')
    }

    const model = process.env.EMBEDDING_MODEL || 'BAAI/bge-base-en-v1.5'
    const prefijo = modo === 'documento' ? 'search_document: ' : 'search_query: '
    const textWithPrefix = `${prefijo}${texto.trim()}`

    const res = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          inputs: textWithPrefix,
          options: { wait_for_model: true },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Error HuggingFace Embeddings (${res.status}): ${errText}`)
    }

    const data = await res.json()
    return data as number[]
  }
}

/**
 * Fabrica de Proveedores de Embeddings (Factory Pattern).
 * Resuelve el motor según la variable AI_EMBEDDING_PROVIDER en .env.local
 */
export function obtenerProveedorEmbeddings(): IEmbeddingProvider {
  const providerType = (process.env.AI_EMBEDDING_PROVIDER || 'openrouter').toLowerCase() as EmbeddingProviderType

  switch (providerType) {
    case 'huggingface':
      return new HuggingFaceEmbeddingAdapter()
    case 'openrouter':
    case 'openai':
    default:
      return new OpenRouterEmbeddingAdapter()
  }
}

/**
 * Función principal exportada compatible con todo el sistema.
 */
export async function generarEmbedding(
  texto: string,
  modo: 'documento' | 'consulta' = 'consulta'
): Promise<number[]> {
  const provider = obtenerProveedorEmbeddings()
  return provider.generarEmbedding(texto, modo)
}
