-- ============================================================================
-- SAO BAR 2026 - POLÍTICAS DE SEGURIDAD RLS (Row Level Security) - PRODUCCIÓN
-- ============================================================================

-- Otorgar permisos de esquema y tablas a los roles de Supabase (Requerido para RLS)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 0. Crear función auxiliar con privilegios elevados para evitar bucles recursivos en RLS
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public."Usuarios"
    WHERE id = auth.uid() AND rol = 'Admin'
  );
END;
$$ LANGUAGE plpgsql;

-- 1. Tabla: Usuarios
ALTER TABLE public."Usuarios" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total autenticados en Usuarios" ON public."Usuarios";
DROP POLICY IF EXISTS "Lectura perfiles para autenticados" ON public."Usuarios";
DROP POLICY IF EXISTS "Escritura perfiles solo admin" ON public."Usuarios";

CREATE POLICY "Lectura perfiles para autenticados" 
ON public."Usuarios" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura perfiles solo admin" 
ON public."Usuarios" FOR ALL TO authenticated USING (public.es_admin());

-- 2. Tabla: Categorias_Productos
ALTER TABLE public."Categorias_Productos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total autenticados en Categorias_Productos" ON public."Categorias_Productos";
DROP POLICY IF EXISTS "Lectura categorias para autenticados" ON public."Categorias_Productos";
DROP POLICY IF EXISTS "Escritura categorias solo admin" ON public."Categorias_Productos";

CREATE POLICY "Lectura categorias para autenticados" 
ON public."Categorias_Productos" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura categorias solo admin" 
ON public."Categorias_Productos" FOR ALL TO authenticated USING (public.es_admin());

-- 3. Tabla: Categorias_Gastos
ALTER TABLE public."Categorias_Gastos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total autenticados en Categorias_Gastos" ON public."Categorias_Gastos";
DROP POLICY IF EXISTS "Lectura categorias gastos para autenticados" ON public."Categorias_Gastos";
DROP POLICY IF EXISTS "Escritura categorias gastos solo admin" ON public."Categorias_Gastos";

CREATE POLICY "Lectura categorias gastos para autenticados" 
ON public."Categorias_Gastos" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura categorias gastos solo admin" 
ON public."Categorias_Gastos" FOR ALL TO authenticated USING (public.es_admin());

-- 4. Tabla: Productos
ALTER TABLE public."Productos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total autenticados en Productos" ON public."Productos";
DROP POLICY IF EXISTS "Lectura productos para autenticados" ON public."Productos";
DROP POLICY IF EXISTS "Escritura productos solo admin" ON public."Productos";

CREATE POLICY "Lectura productos para autenticados" 
ON public."Productos" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura productos solo admin" 
ON public."Productos" FOR ALL TO authenticated USING (public.es_admin());

-- 5. Tabla: Jornadas
ALTER TABLE public."Jornadas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total autenticados en Jornadas" ON public."Jornadas";
DROP POLICY IF EXISTS "Lectura jornadas para autenticados" ON public."Jornadas";
DROP POLICY IF EXISTS "Escritura jornadas solo admin" ON public."Jornadas";

CREATE POLICY "Lectura jornadas para autenticados" 
ON public."Jornadas" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura jornadas solo admin" 
ON public."Jornadas" FOR ALL TO authenticated USING (public.es_admin());

-- 6. Tabla: Comandas
ALTER TABLE public."Comandas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total autenticados en Comandas" ON public."Comandas";
DROP POLICY IF EXISTS "Lectura comandas para autenticados" ON public."Comandas";
DROP POLICY IF EXISTS "Insercion comandas para autenticados" ON public."Comandas";
DROP POLICY IF EXISTS "Modificacion y borrado comandas solo admin" ON public."Comandas";

CREATE POLICY "Lectura comandas para autenticados" 
ON public."Comandas" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insercion comandas para autenticados" 
ON public."Comandas" FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Modificacion y borrado comandas solo admin" 
ON public."Comandas" FOR ALL TO authenticated USING (public.es_admin());

-- 7. Tabla: Comanda_Items
ALTER TABLE public."Comanda_Items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total autenticados en Comanda_Items" ON public."Comanda_Items";
DROP POLICY IF EXISTS "Lectura items comanda para autenticados" ON public."Comanda_Items";
DROP POLICY IF EXISTS "Insercion items comanda para autenticados" ON public."Comanda_Items";
DROP POLICY IF EXISTS "Modificacion y borrado items comanda solo admin" ON public."Comanda_Items";

CREATE POLICY "Lectura items comanda para autenticados" 
ON public."Comanda_Items" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insercion items comanda para autenticados" 
ON public."Comanda_Items" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Modificacion y borrado items comanda solo admin" 
ON public."Comanda_Items" FOR ALL TO authenticated USING (public.es_admin());

-- 8. Tabla: Gastos
ALTER TABLE public."Gastos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total autenticados en Gastos" ON public."Gastos";
DROP POLICY IF EXISTS "Acceso gastos solo admin" ON public."Gastos";

CREATE POLICY "Acceso gastos solo admin" 
ON public."Gastos" FOR ALL TO authenticated USING (public.es_admin());

-- 9. Tabla: Auditoria_Inventario
ALTER TABLE public."Auditoria_Inventario" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total autenticados en Auditoria_Inventario" ON public."Auditoria_Inventario";
DROP POLICY IF EXISTS "Acceso auditoria solo admin" ON public."Auditoria_Inventario";

CREATE POLICY "Acceso auditoria solo admin" 
ON public."Auditoria_Inventario" FOR ALL TO authenticated USING (public.es_admin());
