-- ============================================================================
-- SAO BAR 2026 - SCRIPT DE LIMPIEZA DE TRANSACCIONES (PRESERVANDO CATÁLOGO)
-- Ejecutar en el editor SQL de Supabase para borrar el historial de pruebas.
-- Conserva intacto el catálogo: Productos, Categorías de Productos y Categorías de Gastos.
-- Conserva intactos los usuarios y sus roles/PINs.
-- Reinicia la secuencia de tickets de comandas a 1.
-- ============================================================================

BEGIN;

-- Vaciar las tablas de transacciones y auditorías del día a día.
-- La cláusula RESTART IDENTITY reinicia las secuencias a 1 (resetea el contador de comandas).
-- La cláusula CASCADE asegura la remoción de dependencias internas (ej: items de comandas).
TRUNCATE TABLE 
  public."Auditoria_Inventario",
  public."Comanda_Items",
  public."Comandas",
  public."Gastos",
  public."Jornadas"
RESTART IDENTITY CASCADE;

COMMIT;
