'use server'

import crypto from 'crypto'
import { createClient } from '@/utils/supabase/server'

// ============================================================================
// UTILIDAD INTERNA
// ============================================================================

/**
 * Hashea un PIN usando SHA-256.
 */
function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex')
}

/**
 * Verifica que el usuario autenticado sea un administrador activo.
 * Retorna el objeto del usuario de la DB o un error.
 */
async function verificarAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: 'Usuario no autenticado.' }
  }

  const { data: dbUser, error: dbError } = await supabase
    .from('Usuarios')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  if (dbError || !dbUser) {
    return { ok: false, error: 'No se encontraron datos del usuario en la base de datos.' }
  }

  if (dbUser.rol !== 'Admin') {
    return { ok: false, error: 'Accion no autorizada: requiere rol de Administrador.' }
  }

  if (!dbUser.activo) {
    return { ok: false, error: 'El usuario administrador se encuentra inactivo.' }
  }

  return { ok: true, userId: user.id }
}

// ============================================================================
// ACCIONES DE AUTENTICACION Y SEGURIDAD
// ============================================================================

/**
 * Valida si el PIN ingresado pertenece al administrador que inicio sesion.
 * El PIN se compara contra el hash SHA-256 almacenado en la base de datos.
 */
export async function validarPinAdmin(
  pin: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    const { data: dbUser, error: dbError } = await supabase
      .from('Usuarios')
      .select('pin')
      .eq('id', adminCheck.userId)
      .single()

    if (dbError || !dbUser) {
      return { success: false, error: 'Error al recuperar el PIN del usuario.' }
    }

    if (dbUser.pin !== hashPin(pin)) {
      return { success: false, error: 'PIN incorrecto.' }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al validar el PIN.' }
  }
}

// ============================================================================
// ACCIONES DE CICLO DE VIDA DE JORNADA
// ============================================================================

/**
 * Consulta la jornada activa actual (estado 'abierta' o 'en_auditoria').
 * Puede ser invocada por cualquier usuario autenticado para conocer el estado
 * del sistema al cargar la aplicacion.
 */
export async function obtenerJornadaActiva(): Promise<{
  success: boolean
  error?: string
  jornada?: { jornada_id: string; estado: string; fecha_inicio: string }
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Usuario no autenticado.' }

    const { data, error } = await supabase
      .from('Jornadas')
      .select('jornada_id, estado, fecha_inicio')
      .in('estado', ['abierta', 'en_auditoria'])
      .maybeSingle()

    if (error) return { success: false, error: error.message }

    return { success: true, jornada: data ?? undefined }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al obtener la jornada activa.' }
  }
}

/**
 * Abre una nueva jornada de trabajo.
 * Solo puede ejecutarse si no existe ninguna jornada activa (restriccion unica de DB).
 * Requiere usuario Admin activo y PIN previamente validado en el cliente.
 */
export async function abrirJornada(): Promise<{
  success: boolean
  error?: string
  jornadaId?: string
}> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    const { data: nuevaJornada, error: insertError } = await supabase
      .from('Jornadas')
      .insert({})
      .select('jornada_id')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return {
          success: false,
          error: 'No se puede abrir una nueva jornada: ya existe una jornada activa o en auditoria.',
        }
      }
      return { success: false, error: insertError.message }
    }

    return { success: true, jornadaId: nuevaJornada.jornada_id }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al abrir la jornada.' }
  }
}

/**
 * Transiciona la jornada de 'abierta' a 'en_auditoria'.
 * A partir de este punto el sistema deja de aceptar nuevas comandas
 * y el administrador puede iniciar el conteo fisico del inventario.
 */
export async function iniciarAuditoria(
  jornadaId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    const { data: updatedRows, error: updateError } = await supabase
      .from('Jornadas')
      .update({ estado: 'en_auditoria' })
      .eq('jornada_id', jornadaId)
      .eq('estado', 'abierta')
      .select('jornada_id')

    if (updateError) return { success: false, error: updateError.message }

    // Si no se retorno ninguna fila, la jornada no existia o no estaba en estado 'abierta'
    if (!updatedRows || updatedRows.length === 0) {
      return {
        success: false,
        error: 'No se encontro una jornada abierta con ese ID. Puede que ya este en auditoria o cerrada.',
      }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al iniciar la auditoria.' }
  }
}

/**
 * Registra o reemplaza los conteos fisicos de inventario para una jornada en auditoria.
 * El reemplazo es total: se eliminan los registros anteriores de la jornada y se
 * insertan los nuevos, garantizando coherencia ante multiples envios del formulario.
 */
export async function registrarConteosAuditoria(
  jornadaId: string,
  conteos: { producto_id: string; conteo_fisico: number }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    // Verificar que la jornada este efectivamente en estado 'en_auditoria'
    const { data: jornada, error: jornadaError } = await supabase
      .from('Jornadas')
      .select('estado')
      .eq('jornada_id', jornadaId)
      .single()

    if (jornadaError || !jornada) {
      return { success: false, error: 'Jornada no encontrada.' }
    }

    if (jornada.estado !== 'en_auditoria') {
      return {
        success: false,
        error: 'Los conteos solo pueden registrarse en una jornada con estado "en_auditoria".',
      }
    }

    // Eliminar registros previos de esta jornada para reemplazar con conteos actualizados
    const { error: deleteError } = await supabase
      .from('Auditoria_Inventario')
      .delete()
      .eq('jornada_id', jornadaId)

    if (deleteError) {
      return { success: false, error: 'Error al limpiar conteos anteriores: ' + deleteError.message }
    }

    // Insertar todos los conteos nuevos
    const registros = conteos.map((c) => ({
      jornada_id: jornadaId,
      producto_id: c.producto_id,
      conteo_fisico: c.conteo_fisico,
    }))

    const { error: insertError } = await supabase
      .from('Auditoria_Inventario')
      .insert(registros)

    if (insertError) {
      return { success: false, error: 'Error al guardar los conteos: ' + insertError.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al registrar los conteos de auditoria.' }
  }
}

/**
 * Cierra la jornada invocando la funcion SQL atomica `cerrar_jornada`.
 * La funcion SQL calcula todos los totales internamente y hace la transicion
 * de estado 'en_auditoria' -> 'cerrada' con un bloqueo pesimista.
 *
 * @param jornadaId - ID de la jornada a cerrar.
 * @param totalMpReal - Monto real cobrado por Mercado Pago (confirmado manualmente por el admin).
 * @param comisionMp - Comision descontada por la plataforma de Mercado Pago.
 */
export async function cerrarJornada(
  jornadaId: string,
  totalMpReal: number,
  comisionMp: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    const { error: rpcError } = await supabase.rpc('cerrar_jornada', {
      p_jornada_id: jornadaId,
      p_total_mp_real: totalMpReal,
      p_comision_mp: comisionMp,
    })

    if (rpcError) {
      return { success: false, error: rpcError.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al cerrar la jornada.' }
  }
}
