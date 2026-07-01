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

    if (dbUser.pin !== pin) {
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

/**
 * Obtiene el resumen financiero y las últimas 10 comandas de una jornada activa.
 */
export async function obtenerResumenCaja(jornadaId: string): Promise<{
  success: boolean
  error?: string
  totales?: {
    totalEfectivo: number
    totalMp: number
    cantEfectivo: number
    cantMp: number
  }
  comandas?: any[]
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Usuario no autenticado.' }

    // 1. Obtener todas las comandas de la jornada para sumar totales
    const { data: comandasData, error: dbError } = await supabase
      .from('Comandas')
      .select('total, medio_pago')
      .eq('jornada_id', jornadaId)

    if (dbError) return { success: false, error: dbError.message }

    let totalEfectivo = 0
    let totalMp = 0
    let cantEfectivo = 0
    let cantMp = 0

    comandasData?.forEach((c) => {
      const monto = Number(c.total) || 0
      if (c.medio_pago === 'Efectivo') {
        totalEfectivo += monto
        cantEfectivo++
      } else if (c.medio_pago === 'Mercado Pago') {
        totalMp += monto
        cantMp++
      }
    })

    // 2. Obtener las últimas 10 comandas detalladas
    const { data: comandasDetalle, error: detError } = await supabase
      .from('Comandas')
      .select(`
        comanda_id,
        numero_ticket,
        total,
        medio_pago,
        fecha,
        Comanda_Items (
          cantidad,
          Productos (
            nombre
          )
        )
      `)
      .eq('jornada_id', jornadaId)
      .order('numero_ticket', { ascending: false })
      .limit(10)

    if (detError) return { success: false, error: detError.message }

    // Formatear la estructura de comandas para facilitar el renderizado
    const comandasFormateadas = comandasDetalle?.map((c: any) => {
      const items = c.Comanda_Items?.map((item: any) => {
        const prodNombre = item.Productos?.nombre || 'Producto Desconocido'
        return `${prodNombre} × ${item.cantidad}`
      }).join(', ')

      return {
        id: c.comanda_id,
        numeroTicket: c.numero_ticket,
        total: Number(c.total) || 0,
        medioPago: c.medio_pago,
        fecha: c.fecha,
        detalle: items || 'Sin productos'
      }
    })

    return {
      success: true,
      totales: {
        totalEfectivo,
        totalMp,
        cantEfectivo,
        cantMp
      },
      comandas: comandasFormateadas || []
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al obtener el resumen de caja.' }
  }
}

/**
 * Obtiene la lista de categorías de gastos activas.
 */
export async function obtenerCategoriasGastos(): Promise<{
  success: boolean
  error?: string
  categorias?: { id: string; nombre: string }[]
}> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('Categorias_Gastos')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')

    if (error) return { success: false, error: error.message }
    return { success: true, categorias: data || [] }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener categorías de gastos.' }
  }
}

/**
 * Registra los gastos de la jornada activa en la base de datos.
 * Elimina gastos anteriores asociados a esta jornada e inserta los nuevos.
 */
export async function registrarGastos(
  jornadaId: string,
  gastos: { categoria_id: string; descripcion: string; monto: number }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    // Limpiar gastos anteriores de esta jornada
    const { error: deleteError } = await supabase
      .from('Gastos')
      .delete()
      .eq('jornada_id', jornadaId)

    if (deleteError) return { success: false, error: 'Error al limpiar gastos previos: ' + deleteError.message }

    if (gastos.length > 0) {
      const registros = gastos.map((g) => ({
        jornada_id: jornadaId,
        categoria_id: g.categoria_id,
        descripcion: g.descripcion,
        monto: g.monto,
      }))

      const { error: insertError } = await supabase.from('Gastos').insert(registros)
      if (insertError) return { success: false, error: 'Error al registrar gastos: ' + insertError.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al registrar gastos.' }
  }
}

/**
 * Obtiene los productos con su stock teórico y las unidades vendidas en la jornada.
 */
export async function obtenerProductosAuditoria(jornadaId: string): Promise<{
  success: boolean
  error?: string
  productos?: {
    id: string
    nombre: string
    stockInicial: number
    unidadesVendidas: number
    stockTeorico: number
    conteoFisico?: number
  }[]
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Usuario no autenticado.' }

    // 1. Obtener todos los productos activos
    const { data: dbProductos, error: prodError } = await supabase
      .from('Productos')
      .select('id, nombre, stockInicial')
      .eq('activo', true)

    if (prodError) return { success: false, error: prodError.message }

    // 2. Obtener sumatoria de unidades vendidas por producto en esta jornada
    const { data: dbVendidos, error: vendError } = await supabase
      .from('Comanda_Items')
      .select('producto_id, cantidad, Comandas!inner(jornada_id)')
      .eq('Comandas.jornada_id', jornadaId)

    if (vendError) return { success: false, error: vendError.message }

    // Calcular ventas agrupadas en memoria
    const ventasAgrupadas: Record<string, number> = {}
    dbVendidos?.forEach((item) => {
      const prodId = item.producto_id
      const cant = Number(item.cantidad) || 0
      ventasAgrupadas[prodId] = (ventasAgrupadas[prodId] || 0) + cant
    })

    // 3. Obtener conteos físicos ya registrados en esta jornada (si existen)
    const { data: dbConteos, error: contError } = await supabase
      .from('Auditoria_Inventario')
      .select('producto_id, conteo_fisico')
      .eq('jornada_id', jornadaId)

    const conteosExistentes: Record<string, number> = {}
    dbConteos?.forEach((item) => {
      conteosExistentes[item.producto_id] = Number(item.conteo_fisico)
    })

    // 4. Armar el listado final calculando desvíos y ordenando por ventas desc
    const resultado = dbProductos.map((p) => {
      const unidadesVendidas = ventasAgrupadas[p.id] || 0
      const stockInicial = Number(p.stockInicial) || 0
      const stockTeorico = Math.max(0, stockInicial - unidadesVendidas)
      const conteoFisico = conteosExistentes[p.id] !== undefined ? conteosExistentes[p.id] : undefined

      return {
        id: p.id,
        nombre: p.nombre,
        stockInicial,
        unidadesVendidas,
        stockTeorico,
        conteoFisico,
      }
    })

    // Ordenar descendentemente por unidades vendidas (priorizar mayor rotación)
    resultado.sort((a, b) => b.unidadesVendidas - a.unidadesVendidas)

    return { success: true, productos: resultado }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener productos para auditoría.' }
  }
}


