-- ============================================================================
-- SAO BAR 2026 - SCRIPT DE INICIALIZACIÓN DE USUARIOS DE PRUEBA
-- Ejecutar este script en el editor SQL de Supabase para crear las cuentas.
-- ============================================================================

-- 1. Crear usuario Administrador de Pruebas
-- Cuenta admin de ejemplo - reemplazar valores antes de ejecutar
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3',
  'authenticated',
  'authenticated',
  'REEMPLAZAR_EMAIL_ADMIN',
  crypt('REEMPLAZAR_PASSWORD_ADMIN', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"nombre":"Administrador de Pruebas","rol":"Admin"}',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- Setear el PIN del administrador
-- NOTA: El trigger handle_new_user ya copió al usuario a public."Usuarios". Aquí se actualiza su PIN.
-- Reemplazar por el hash SHA-256 del PIN elegido para el entorno correspondiente.
UPDATE public."Usuarios"
SET pin = 'REEMPLAZAR_HASH_PIN_SHA256'
WHERE email = 'REEMPLAZAR_EMAIL_ADMIN';


-- 2. Crear usuario Empleado de Pruebas
-- Cuenta empleado de ejemplo - reemplazar valores antes de ejecutar
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5',
  'authenticated',
  'authenticated',
  'REEMPLAZAR_EMAIL_EMPLEADO',
  crypt('REEMPLAZAR_PASSWORD_EMPLEADO', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"nombre":"Empleado de Pruebas","rol":"Empleado"}',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;
