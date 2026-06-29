-- ============================================================================
-- SAO BAR 2026 - SCRIPT DE INICIALIZACIÓN DE USUARIOS DE PRUEBA
-- Ejecutar este script en el editor SQL de Supabase para crear las cuentas.
-- ============================================================================

-- 1. Crear usuario Administrador de Pruebas
-- Email: admin@test.com
-- Contraseña: admin123
-- PIN de seguridad: 1234
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
  'admin@test.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"nombre":"Administrador de Pruebas","rol":"Admin"}',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- Setear el PIN del administrador (PIN: "1234" -> SHA-256: "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4")
-- NOTA: El trigger handle_new_user ya copió al usuario a public."Usuarios". Aquí actualizamos su PIN.
UPDATE public."Usuarios"
SET pin = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
WHERE email = 'admin@test.com';


-- 2. Crear usuario Empleado de Pruebas
-- Email: empleado@test.com
-- Contraseña: empleado123
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
  'empleado@test.com',
  crypt('empleado123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"nombre":"Empleado de Pruebas","rol":"Empleado"}',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;
