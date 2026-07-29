-- ============================================================================
-- SAO BAR 2026 - ESQUEMA DE BASE DE DATOS MAESTRO
-- ============================================================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: Categorias_Productos (Tablas dinámicas sin hardcoding)
CREATE TABLE public."Categorias_Productos" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    color_fondo VARCHAR(7) NOT NULL CHECK (color_fondo ~ '^#[0-9A-Fa-f]{6}$'),
    color_texto VARCHAR(7) NOT NULL CHECK (color_texto ~ '^#[0-9A-Fa-f]{6}$'),
    activo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. TABLA: Categorias_Gastos
CREATE TABLE public."Categorias_Gastos" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. TABLA: Usuarios (Mapeada a Supabase Auth)
CREATE TABLE public."Usuarios" (
    id UUID PRIMARY KEY, -- FK a auth.users, se vincula mediante el trigger
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(50) NOT NULL CHECK (rol IN ('Admin', 'Empleado')),
    pin VARCHAR(64) NULL, -- Hash SHA-256 (Exclusivo para rol Admin)
    activo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. TABLA: Productos
CREATE TABLE public."Productos" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    categoria_id UUID NOT NULL REFERENCES public."Categorias_Productos"(id) ON DELETE RESTRICT,
    precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    "stockIdeal" INTEGER NOT NULL CHECK ("stockIdeal" >= 0),
    "stockInicial" INTEGER NOT NULL CHECK ("stockInicial" >= 0),
    "stockActual" INTEGER NOT NULL CHECK ("stockActual" >= 0),
    unidad VARCHAR(10) NOT NULL CHECK (unidad IN ('u', 'lt', 'ml')),
    activo BOOLEAN DEFAULT true NOT NULL,
    vendible BOOLEAN DEFAULT true NOT NULL,
    controla_stock BOOLEAN DEFAULT true NOT NULL,
    insumo_compartido_id UUID REFERENCES public."Productos"(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 5. TABLA: Jornadas
CREATE TABLE public."Jornadas" (
    jornada_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estado VARCHAR(20) DEFAULT 'abierta' NOT NULL CHECK (estado IN ('abierta', 'en_auditoria', 'cerrada')),
    fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    total_efectivo NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (total_efectivo >= 0),
    total_mp_lista NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (total_mp_lista >= 0),
    total_mp_real NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (total_mp_real >= 0),
    comision_mp NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    total_general NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (total_general >= 0),
    gastos_totales NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (gastos_totales >= 0),
    ganancia_neta NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Índice único parcial para garantizar que solo exista MÁXIMO una jornada activa ('abierta' o 'en_auditoria')
CREATE UNIQUE INDEX unique_active_jornada ON public."Jornadas" (estado) 
WHERE estado IN ('abierta', 'en_auditoria');

-- 6. TABLA: Comandas
CREATE TABLE public."Comandas" (
    comanda_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jornada_id UUID NOT NULL REFERENCES public."Jornadas"(jornada_id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES public."Usuarios"(id) ON DELETE RESTRICT,
    numero_ticket SERIAL NOT NULL,
    nro_beeper INTEGER CHECK (nro_beeper > 0),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    medio_pago VARCHAR(20) NOT NULL CHECK (medio_pago IN ('Efectivo', 'Mercado Pago', 'Regalo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 7. TABLA: Comanda_Items (N:N Break)
CREATE TABLE public."Comanda_Items" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comanda_id UUID NOT NULL REFERENCES public."Comandas"(comanda_id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES public."Productos"(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario_historico NUMERIC(10, 2) NOT NULL CHECK (precio_unitario_historico >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 8. TABLA: Gastos
CREATE TABLE public."Gastos" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jornada_id UUID NOT NULL REFERENCES public."Jornadas"(jornada_id) ON DELETE RESTRICT,
    categoria_id UUID NOT NULL REFERENCES public."Categorias_Gastos"(id) ON DELETE RESTRICT,
    descripcion TEXT NOT NULL,
    monto NUMERIC(10, 2) NOT NULL CHECK (monto >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 9. TABLA: Auditoria_Inventario
CREATE TABLE public."Auditoria_Inventario" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jornada_id UUID NOT NULL REFERENCES public."Jornadas"(jornada_id) ON DELETE RESTRICT,
    producto_id UUID NOT NULL REFERENCES public."Productos"(id) ON DELETE RESTRICT,
    conteo_fisico INTEGER NOT NULL CHECK (conteo_fisico >= 0),
    unidades_utilizadas INTEGER DEFAULT 0 NOT NULL,
    unidades_regaladas INTEGER DEFAULT 0 NOT NULL,
    stock_inicial INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Habilitar Row Level Security (RLS) en todas las tablas
ALTER TABLE public."Categorias_Productos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Categorias_Gastos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Productos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Jornadas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Comandas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Comanda_Items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Gastos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Auditoria_Inventario" ENABLE ROW LEVEL SECURITY;
