-- ============================================================================
-- SAO BAR 2026 - SCRIPT DE LIMPIEZA Y RESETEO DE DATOS OPERATIVOS
-- Ejecutar en el editor SQL de Supabase para volver el sistema a cero.
-- Conserva la tabla "Usuarios" intacta (incluyendo roles, emails y hashes de PIN).
-- ============================================================================

BEGIN;

-- 1. Vaciar tablas operativas y de parametrización en orden jerárquico inverso.
-- La cláusula RESTART IDENTITY reinicia todas las secuencias asociadas a 1.
-- La cláusula CASCADE asegura que se limpien las relaciones dependientes sin conflictos.
TRUNCATE TABLE 
  public."Auditoria_Inventario",
  public."Comanda_Items",
  public."Comandas",
  public."Gastos",
  public."Jornadas",
  public."Productos",
  public."Categorias_Productos",
  public."Categorias_Gastos"
RESTART IDENTITY CASCADE;

COMMIT;
