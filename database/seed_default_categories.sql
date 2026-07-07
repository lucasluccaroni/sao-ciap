-- ============================================================================
-- SAO BAR 2026 - INICIALIZACIÓN DE CATEGORÍAS POR DEFECTO
-- Ejecutar en el editor SQL de Supabase para poblar las categorías de negocio.
-- ============================================================================

BEGIN;

-- 1. Insertar Categorías de Productos
-- Cumple con la restricción CHECK (color_fondo ~ '^#[0-9A-Fa-f]{6}$')
-- Colores diseñados bajo estética premium oscura de marca.
INSERT INTO public."Categorias_Productos" (nombre, color_fondo, color_texto, activo) VALUES
  ('Tragos', '#3A1C24', '#F2F2F2', true),
  ('Cerveza', '#4A3515', '#F2F2F2', true),
  ('Comida', '#441C15', '#F2F2F2', true),
  ('Cafetería', '#2D1E18', '#F2F2F2', true),
  ('Postres', '#3C1B33', '#F2F2F2', true),
  ('Sin Alcohol', '#162E3B', '#F2F2F2', true)
ON CONFLICT (nombre) DO UPDATE SET
  color_fondo = EXCLUDED.color_fondo,
  color_texto = EXCLUDED.color_texto,
  activo = EXCLUDED.activo;

-- 2. Insertar Categorías de Gastos
INSERT INTO public."Categorias_Gastos" (nombre, activo) VALUES
  ('Insumos', true),
  ('Limpieza', true),
  ('Servicios', true),
  ('Otros', true),
  ('Personal', true),
  ('Mantenimiento', true)
ON CONFLICT (nombre) DO UPDATE SET
  activo = EXCLUDED.activo;

COMMIT;
