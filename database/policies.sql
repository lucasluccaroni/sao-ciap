-- ============================================================================
-- SAO BAR 2026 - POLÍTICAS DE SEGURIDAD RLS (Row Level Security)
-- ============================================================================
-- Como la lógica de negocio y validación de roles (Admin/Empleado) se
-- controla estrictamente a nivel de servidor en Next.js (Server Actions),
-- estas políticas a nivel de base de datos aseguran que:
-- 1. Nadie sin una sesión iniciada pueda leer o escribir datos (bloqueo público).
-- 2. Los usuarios autenticados tengan los permisos necesarios para que las
--    Server Actions puedan operar en la base de datos en su nombre.

-- 1. Categorías de Productos
CREATE POLICY "Acceso total autenticados en Categorias_Productos" 
ON public."Categorias_Productos" FOR ALL TO authenticated USING (true);

-- 2. Categorías de Gastos
CREATE POLICY "Acceso total autenticados en Categorias_Gastos" 
ON public."Categorias_Gastos" FOR ALL TO authenticated USING (true);

-- 3. Usuarios
-- Permite que las Server Actions puedan leer los roles y validar el PIN.
CREATE POLICY "Acceso total autenticados en Usuarios" 
ON public."Usuarios" FOR ALL TO authenticated USING (true);

-- 4. Productos
CREATE POLICY "Acceso total autenticados en Productos" 
ON public."Productos" FOR ALL TO authenticated USING (true);

-- 5. Jornadas
CREATE POLICY "Acceso total autenticados en Jornadas" 
ON public."Jornadas" FOR ALL TO authenticated USING (true);

-- 6. Comandas
CREATE POLICY "Acceso total autenticados en Comandas" 
ON public."Comandas" FOR ALL TO authenticated USING (true);

-- 7. Comanda Items
CREATE POLICY "Acceso total autenticados en Comanda_Items" 
ON public."Comanda_Items" FOR ALL TO authenticated USING (true);

-- 8. Gastos
CREATE POLICY "Acceso total autenticados en Gastos" 
ON public."Gastos" FOR ALL TO authenticated USING (true);

-- 9. Auditoria Inventario
CREATE POLICY "Acceso total autenticados en Auditoria_Inventario" 
ON public."Auditoria_Inventario" FOR ALL TO authenticated USING (true);
