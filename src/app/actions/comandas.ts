'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * Validador de usuario autenticado genérico (para mozos y empleados).
 */
async function verificarAutenticado(supabase: Awaited<ReturnType<typeof createClient>>): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: 'Usuario no autenticado.' }
  }
  return { ok: true, userId: user.id }
}

/**
 * Registra una comanda de forma atómica en la base de datos utilizando el RPC procesar_comanda.
 */
export async function crearComanda(datos: {
  nro_beeper: number | null
  medio_pago: 'Efectivo' | 'Mercado Pago' | 'Regalo'
  items: { producto_id: string; cantidad: number }[]
}): Promise<{ success: boolean; error?: string; comandaId?: string; numeroTicket?: number; fecha?: string }> {
  try {
    const supabase = await createClient()
    const authCheck = await verificarAutenticado(supabase)
    if (!authCheck.ok) return { success: false, error: authCheck.error }

    // 1. Obtener la jornada activa (debe estar en estado 'abierta')
    const { data: jornada, error: jornadaError } = await supabase
      .from('Jornadas')
      .select('jornada_id, estado')
      .in('estado', ['abierta', 'en_auditoria'])
      .maybeSingle()

    if (jornadaError || !jornada) {
      return { success: false, error: 'No hay ninguna jornada activa para registrar comandas.' }
    }

    if (jornada.estado !== 'abierta') {
      return { success: false, error: 'La jornada actual no se encuentra abierta (está en auditoría o cerrada).' }
    }

    if (!datos.items || datos.items.length === 0) {
      return { success: false, error: 'La comanda debe contener al menos un producto.' }
    }

    // 2. Invocar el procedimiento almacenado (RPC) procesar_comanda con bloqueo pesimista
    const { data: comandaId, error: rpcError } = await supabase.rpc('procesar_comanda', {
      p_jornada_id: jornada.jornada_id,
      p_usuario_id: authCheck.userId,
      p_nro_beeper: datos.nro_beeper,
      p_medio_pago: datos.medio_pago,
      p_items: datos.items
    })

    if (rpcError) {
      // Retorna el error directo del trigger/procedimiento (ej: "Stock insuficiente para ...")
      return { success: false, error: rpcError.message || 'Error al procesar la comanda.' }
    }

    // 3. Consultar el registro recién creado para obtener el número de ticket y la fecha oficial
    const { data: comandaInfo, error: fetchError } = await supabase
      .from('Comandas')
      .select('numero_ticket, fecha')
      .eq('comanda_id', comandaId)
      .single()

    if (fetchError || !comandaInfo) {
      return {
        success: true,
        comandaId,
        numeroTicket: 0,
        fecha: new Date().toISOString()
      }
    }

    return {
      success: true,
      comandaId,
      numeroTicket: comandaInfo.numero_ticket,
      fecha: comandaInfo.fecha
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Ocurrió un error inesperado al procesar la comanda.' }
  }
}
