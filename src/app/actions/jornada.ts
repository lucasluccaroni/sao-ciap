'use server'

import crypto from 'crypto'
import { createClient } from '@/utils/supabase/server'

/**
 * Hashea un PIN usando SHA-256.
 */
function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex')
}

/**
 * Valida si el PIN ingresado pertenece al administrador que inició sesión.
 * @param pin PIN en texto plano ingresado por el usuario.
 */
export async function validarPinAdmin(pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // 1. Obtener usuario autenticado actual
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado.' }
    }

    // 2. Obtener datos de la tabla Usuarios
    const { data: dbUser, error: dbError } = await supabase
      .from('Usuarios')
      .select('rol, pin, activo')
      .eq('id', user.id)
      .single()

    if (dbError || !dbUser) {
      return { success: false, error: 'No se encontraron datos del usuario en la base de datos.' }
    }

    // 3. Validar rol
    if (dbUser.rol !== 'Admin') {
      return { success: false, error: 'Acción no autorizada: requiere rol de Administrador.' }
    }

    // 4. Validar estado activo
    if (!dbUser.activo) {
      return { success: false, error: 'El usuario administrador se encuentra inactivo.' }
    }

    // 5. Comparar hash del PIN
    const hashedPin = hashPin(pin)
    if (dbUser.pin !== hashedPin) {
      return { success: false, error: 'PIN incorrecto.' }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al validar el PIN.' }
  }
}

/**
 * Abre una nueva jornada en el sistema.
 * Debe ser ejecutado por un administrador previamente logueado y validado.
 */
export async function abrirJornada(): Promise<{ success: boolean; error?: string; jornadaId?: string }> {
  try {
    const supabase = await createClient()

    // 1. Obtener usuario autenticado actual
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado.' }
    }

    // 2. Obtener datos de rol de la tabla Usuarios
    const { data: dbUser, error: dbError } = await supabase
      .from('Usuarios')
      .select('rol, activo')
      .eq('id', user.id)
      .single()

    if (dbError || !dbUser) {
      return { success: false, error: 'Error al verificar permisos del usuario.' }
    }

    if (dbUser.rol !== 'Admin' || !dbUser.activo) {
      return { success: false, error: 'Acción no autorizada: requiere un Administrador activo.' }
    }

    // 3. Insertar la nueva jornada
    const { data: nuevaJornada, error: insertError } = await supabase
      .from('Jornadas')
      .insert({})
      .select('jornada_id')
      .single()

    if (insertError) {
      // Manejar el caso de violación de restricción única (ya hay jornada abierta o en auditoría)
      if (insertError.code === '23505') {
        return { success: false, error: 'No se puede abrir una nueva jornada: ya existe una jornada activa (abierta o en auditoría).' }
      }
      return { success: false, error: insertError.message }
    }

    return { success: true, jornadaId: nuevaJornada.jornada_id }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al abrir la jornada.' }
  }
}
