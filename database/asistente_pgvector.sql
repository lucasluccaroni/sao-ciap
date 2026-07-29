-- ============================================================================
-- SAO BAR 2026 - CONFIGURACIÓN DE PGVECTOR Y TABLA DE CONOCIMIENTO (ASISTENTE IA)
-- ============================================================================
-- Este script habilita la extensión pgvector, crea la tabla knowledge_chunks,
-- aplica su índice HNSW de alta velocidad, sus políticas RLS y la función RPC
-- de búsqueda semántica por similitud coseno (match_knowledge).

-- 1. Habilitar extensión vector (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabla para almacenar los chunks de conocimiento vectorizados
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    embedding vector(768) NOT NULL, -- Dimensión para modelos de embedding de 768d (ej. nomic-embed-text)
    categoria TEXT NOT NULL DEFAULT 'procedimiento',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Índice HNSW para acelerar la búsqueda por similitud coseno (<=>)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx 
ON public.knowledge_chunks 
USING hnsw (embedding vector_cosine_ops);

-- 4. Seguridad RLS y permisos para la tabla de conocimiento
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de conocimiento para usuarios autenticados" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Acceso total a conocimiento" ON public.knowledge_chunks;

CREATE POLICY "Acceso total a conocimiento" 
ON public.knowledge_chunks FOR ALL TO authenticated, anon, service_role 
USING (true) WITH CHECK (true);

GRANT ALL ON public.knowledge_chunks TO authenticated, anon, service_role;

-- 5. Función RPC SQL para búsqueda por similitud semántica (match_knowledge)
CREATE OR REPLACE FUNCTION public.match_knowledge(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    titulo TEXT,
    contenido TEXT,
    categoria TEXT,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.titulo,
        kc.contenido,
        kc.categoria,
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_chunks kc
    WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
    ORDER BY kc.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge(vector(768), float, int) TO authenticated, service_role;
