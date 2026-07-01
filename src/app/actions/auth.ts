'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * Inicia sesión utilizando Supabase Auth y valida el rol y estado activo del usuario.
 */
export async function iniciarSesion(
  email: string,
  contrasena: string
): Promise<{ success: boolean; error?: string; rol?: string }> {
  try {
    const supabase = await createClient()

    // 1. Autenticar con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: contrasena,
    })

    if (authError || !authData.user) {
      const msg = authError?.message === 'Invalid login credentials'
        ? 'Usuario y/o contraseña incorrecto.'
        : (authError?.message || 'Credenciales inválidas.')
      return { success: false, error: msg }
    }

    const userId = authData.user.id

    // 2. Buscar datos en la tabla local de Usuarios
    const { data: dbUser, error: dbError } = await supabase
      .from('Usuarios')
      .select('rol, activo')
      .eq('id', userId)
      .single()

    if (dbError || !dbUser) {
      console.error('[iniciarSesion DB Error]:', {
        userId,
        error: dbError,
        data: dbUser
      })
      // Si no existe en la tabla local, cerramos la sesión de Auth por seguridad
      await supabase.auth.signOut()
      return { success: false, error: 'Usuario no registrado en el sistema local.' }
    }

    // 3. Validar si el usuario está activo
    if (!dbUser.activo) {
      await supabase.auth.signOut()
      return { success: false, error: 'El usuario se encuentra inactivo.' }
    }

    return { success: true, rol: dbUser.rol }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al iniciar sesión.' }
  }
}

/**
 * Cierra la sesión activa en Supabase.
 */
export async function cerrarSesion(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al cerrar sesión.' }
  }
}
