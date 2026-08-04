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

    const pinHash = hashPin(pin)
    if (dbUser.pin !== pinHash) {
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
  conteos: { producto_id: string; conteo_fisico: number; unidades_utilizadas: number; unidades_regaladas: number; stock_inicial: number }[]
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
      unidades_utilizadas: c.unidades_utilizadas,
      unidades_regaladas: c.unidades_regaladas,
      stock_inicial: c.stock_inicial,
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
        nro_beeper,
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
        beeper: c.nro_beeper,
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
 * Obtiene los productos con su stock teórico, unidades vendidas y unidades regaladas en la jornada.
 */
export async function obtenerProductosAuditoria(jornadaId: string): Promise<{
  success: boolean
  error?: string
  productos?: {
    id: string
    nombre: string
    stockInicial: number
    unidadesVendidas: number
    unidadesRegaladas: number
    stockTeorico: number
    conteoFisico?: number
    vendible: boolean
  }[]
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Usuario no autenticado.' }

    // 1. Obtener todos los productos activos con controla_stock = true que no tengan insumo compartido
    const { data: dbProductos, error: prodError } = await supabase
      .from('Productos')
      .select('id, nombre, stockInicial, vendible')
      .eq('activo', true)
      .eq('controla_stock', true)
      .is('insumo_compartido_id', null)

    if (prodError) return { success: false, error: prodError.message }

    // 2. Obtener sumatoria de unidades vendidas y regaladas por producto en esta jornada desde comandas
    const { data: dbVendidos, error: vendError } = await supabase
      .from('Comanda_Items')
      .select('producto_id, cantidad, Productos(insumo_compartido_id), Comandas!inner(jornada_id, medio_pago)')
      .eq('Comandas.jornada_id', jornadaId)

    if (vendError) return { success: false, error: vendError.message }

    // Calcular ventas y regalos agrupados en memoria (redireccionando al insumo si es de stock compartido)
    const ventasAgrupadas: Record<string, number> = {}
    const regalosAgrupados: Record<string, number> = {}
    dbVendidos?.forEach((item: any) => {
      const insumoCompartidoId = item.Productos?.insumo_compartido_id
      const recursoId = insumoCompartidoId || item.producto_id
      const cant = Number(item.cantidad) || 0
      const medio = item.Comandas?.medio_pago
      if (medio === 'Regalo') {
        regalosAgrupados[recursoId] = (regalosAgrupados[recursoId] || 0) + cant
      } else {
        ventasAgrupadas[recursoId] = (ventasAgrupadas[recursoId] || 0) + cant
      }
    })

    // Obtener los insumos compartidos que tienen productos enlazados dependientes
    const { data: dbInsumosHijos } = await supabase
      .from('Productos')
      .select('insumo_compartido_id')
      .eq('activo', true)
      .not('insumo_compartido_id', 'is', null)

    const insumosConHijos = new Set<string>()
    dbInsumosHijos?.forEach((p: any) => {
      if (p.insumo_compartido_id) {
        insumosConHijos.add(p.insumo_compartido_id)
      }
    })

    // 3. Obtener conteos físicos, unidades utilizadas y regaladas ya registradas en esta jornada (si existen)
    const { data: dbConteos, error: contError } = await supabase
      .from('Auditoria_Inventario')
      .select('producto_id, conteo_fisico, unidades_utilizadas, unidades_regaladas')
      .eq('jornada_id', jornadaId)

    if (contError) return { success: false, error: contError.message }

    const conteosExistentes: Record<string, { conteo_fisico: number; unidades_utilizadas: number; unidades_regaladas: number }> = {}
    dbConteos?.forEach((item) => {
      conteosExistentes[item.producto_id] = {
        conteo_fisico: Number(item.conteo_fisico),
        unidades_utilizadas: Number(item.unidades_utilizadas) || 0,
        unidades_regaladas: Number(item.unidades_regaladas) || 0
      }
    })

    // 4. Armar el listado final calculando desvíos e inicializando según tipo
    const resultado = dbProductos.map((p) => {
      const stockInicial = Number(p.stockInicial) || 0
      const tieneRegistroPrevio = conteosExistentes[p.id] !== undefined
      
      const esInsumoCompartido = insumosConHijos.has(p.id)
      const autocalculado = p.vendible || esInsumoCompartido

      let unidadesVendidas = 0
      let unidadesRegaladas = 0
      if (tieneRegistroPrevio) {
        unidadesVendidas = conteosExistentes[p.id].unidades_utilizadas
        unidadesRegaladas = conteosExistentes[p.id].unidades_regaladas
      } else {
        // Al inicio, los productos autocalculados (vendibles o insumos con hijos) leen de comandas, los insumos puros empiezan en 0
        unidadesVendidas = autocalculado ? (ventasAgrupadas[p.id] || 0) : 0
        unidadesRegaladas = autocalculado ? (regalosAgrupados[p.id] || 0) : 0
      }

      const stockTeorico = Math.max(0, stockInicial - unidadesVendidas - unidadesRegaladas)
      const conteoFisico = tieneRegistroPrevio ? conteosExistentes[p.id].conteo_fisico : undefined

      return {
        id: p.id,
        nombre: p.nombre,
        stockInicial,
        unidadesVendidas,
        unidadesRegaladas,
        stockTeorico,
        conteoFisico,
        vendible: autocalculado
      }
    })

    // Ordenar descendentemente por unidades vendidas/utilizadas (priorizar mayor rotación)
    resultado.sort((a, b) => b.unidadesVendidas - a.unidadesVendidas)

    return { success: true, productos: resultado }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener productos para auditoría.' }
  }
}

/**
 * Obtiene la lista de todas las jornadas, ordenadas por fecha de inicio descendente.
 * Exclusivo para administradores.
 */
export async function obtenerHistorialJornadas(): Promise<{
  success: boolean
  error?: string
  jornadas?: any[]
}> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    const { data, error } = await supabase
      .from('Jornadas')
      .select('jornada_id, estado, fecha_inicio, fecha_fin, total_general, ganancia_neta, gastos_totales')
      .order('fecha_inicio', { ascending: false })

    if (error) return { success: false, error: error.message }

    return { success: true, jornadas: data || [] }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al obtener el historial de jornadas.' }
  }
}

/**
 * Obtiene el desglose completo financiero, gastos, comandas e inventario
 * de una jornada histórica específica.
 * Exclusivo para administradores.
 */
export async function obtenerDetalleHistorialJornada(jornadaId: string): Promise<{
  success: boolean
  error?: string
  jornada?: any
  gastos?: any[]
  comandas?: any[]
  auditoria?: any[]
  rendimiento?: any[]
}> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    // 1. Obtener datos de la jornada específica
    const { data: jornada, error: jornadaError } = await supabase
      .from('Jornadas')
      .select('*')
      .eq('jornada_id', jornadaId)
      .single()

    if (jornadaError || !jornada) {
      return { success: false, error: 'Jornada no encontrada o error de base de datos.' }
    }

    // 2. Obtener gastos con categoría
    const { data: gastos, error: gastosError } = await supabase
      .from('Gastos')
      .select(`
        id,
        descripcion,
        monto,
        Categorias_Gastos (
          nombre
        )
      `)
      .eq('jornada_id', jornadaId)

    if (gastosError) return { success: false, error: 'Error al recuperar gastos: ' + gastosError.message }

    const gastosFormateados = gastos?.map((g: any) => ({
      id: g.id,
      descripcion: g.descripcion,
      monto: Number(g.monto) || 0,
      categoria: g.Categorias_Gastos?.nombre || 'General'
    }))

    // 3. Obtener comandas detalladas con sus ítems correspondientes y datos relacionales de productos para agrupar rendimiento
    const { data: comandas, error: comandasError } = await supabase
      .from('Comandas')
      .select(`
        comanda_id,
        numero_ticket,
        nro_beeper,
        fecha,
        total,
        medio_pago,
        Comanda_Items (
          cantidad,
          precio_unitario_historico,
          producto_id,
          Productos (
            nombre,
            vendible,
            Categorias_Productos (
              nombre
            )
          )
        )
      `)
      .eq('jornada_id', jornadaId)
      .order('numero_ticket', { ascending: false })

    if (comandasError) return { success: false, error: 'Error al recuperar comandas: ' + comandasError.message }

    const comandasFormateadas = comandas?.map((c: any) => {
      const items = c.Comanda_Items?.map((item: any) => ({
        nombre: item.Productos?.nombre || 'Producto Desconocido',
        cantidad: item.cantidad,
        precio: Number(item.precio_unitario_historico) || 0
      })) || []

      return {
        id: c.comanda_id,
        numeroTicket: c.numero_ticket,
        beeper: c.nro_beeper,
        fecha: c.fecha,
        total: Number(c.total) || 0,
        medioPago: c.medio_pago,
        items
      }
    })

    // 4. Reconstrucción del reporte de inventario histórico
    // A. Obtener los productos que controlan stock
    const { data: dbProductos, error: prodError } = await supabase
      .from('Productos')
      .select('id, nombre, controla_stock')
      .eq('activo', true)
      .eq('controla_stock', true)
      .is('insumo_compartido_id', null)

    if (prodError) return { success: false, error: 'Error al recuperar catálogo de productos: ' + prodError.message }

    // B. Obtener la auditoría de la jornada actual
    const { data: dbAuditoriaActual, error: audError } = await supabase
      .from('Auditoria_Inventario')
      .select('producto_id, conteo_fisico, unidades_utilizadas, unidades_regaladas, stock_inicial')
      .eq('jornada_id', jornadaId)

    if (audError) return { success: false, error: 'Error al recuperar auditoría actual: ' + audError.message }

    const auditoriaMap: Record<string, { conteo_fisico: number; unidades_utilizadas: number; unidades_regaladas: number; stock_inicial: number }> = {}
    dbAuditoriaActual?.forEach((item) => {
      auditoriaMap[item.producto_id] = {
        conteo_fisico: Number(item.conteo_fisico) || 0,
        unidades_utilizadas: Number(item.unidades_utilizadas) || 0,
        unidades_regaladas: Number(item.unidades_regaladas) || 0,
        stock_inicial: Number(item.stock_inicial) || 0
      }
    })

    // C. Unificar catálogo con datos de auditoría
    const auditoriaReporte = dbProductos.map((p) => {
      const audit = auditoriaMap[p.id]
      
      // Stock Inicial: leído directamente de la foto persistida en la auditoría de la jornada
      const stockInicial = audit ? audit.stock_inicial : 0
      const unidadesUtilizadas = audit ? audit.unidades_utilizadas : 0
      const unidadesRegaladas = audit ? audit.unidades_regaladas : 0
      const stockTeorico = Math.max(0, stockInicial - unidadesUtilizadas - unidadesRegaladas)
      const conteoFisico = audit ? audit.conteo_fisico : 0
      const desvio = conteoFisico - stockTeorico

      return {
        id: p.id,
        nombre: p.nombre,
        stockInicial,
        unidadesUtilizadas,
        unidadesRegaladas,
        stockTeorico,
        conteoFisico,
        desvio
      }
    })

    // Ordenar descendentemente por unidades utilizadas (rotación)
    auditoriaReporte.sort((a, b) => b.unidadesUtilizadas - a.unidadesUtilizadas)

    // 5. Consolidación de Rendimiento de Ventas (sólo productos vendibles, excluyendo insumos y comandas de regalo)
    const rendimientoMap: Record<string, { nombre: string; categoria: string; cantidad: number; total: number }> = {}
    
    comandas?.forEach((c: any) => {
      // Las comandas de regalo no computan en el rendimiento comercial de ingresos ni unidades cobradas
      if (c.medio_pago === 'Regalo') return

      c.Comanda_Items?.forEach((item: any) => {
        const prod = item.Productos
        if (prod && prod.vendible) {
          const prodId = item.producto_id
          const cant = Number(item.cantidad) || 0
          const precio = Number(item.precio_unitario_historico) || 0
          const subtotal = cant * precio
          const catNombre = prod.Categorias_Productos?.nombre || 'General'

          if (!rendimientoMap[prodId]) {
            rendimientoMap[prodId] = {
              nombre: prod.nombre,
              categoria: catNombre,
              cantidad: 0,
              total: 0
            }
          }
          
          rendimientoMap[prodId].cantidad += cant
          rendimientoMap[prodId].total += subtotal
        }
      })
    })

    const rendimientoReporte = Object.values(rendimientoMap)
    // Ordenar de mayor a menor cantidad vendida (rotación)
    rendimientoReporte.sort((a, b) => b.cantidad - a.cantidad)

    return {
      success: true,
      jornada,
      gastos: gastosFormateados || [],
      comandas: comandasFormateadas || [],
      auditoria: auditoriaReporte,
      rendimiento: rendimientoReporte
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al obtener el detalle de jornada.' }
  }
}


