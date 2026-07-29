import { createClient } from '@/utils/supabase/server'
import { DefinicionTool } from './llm'

// ============================================================================
// DEFINICIONES DE HERRAMIENTAS (ESQUEMA PARA EL LLM)
// ============================================================================

export const HERRAMIENTAS_ASISTENTE: DefinicionTool[] = [
  {
    type: 'function',
    function: {
      name: 'consultarStockActual',
      description: 'Consulta el stock actual, stock ideal e insumos en tiempo real por nombre de producto o por categoría (ej. Cerveza, Tragos, Comida).',
      parameters: {
        type: 'object',
        properties: {
          productoNombre: {
            type: 'string',
            description: 'Nombre opcional de producto o categoría a consultar (ej. "cerveza", "Corona", "Fernet"). Si se omite, retorna todo el catálogo con stock.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarCajaJornada',
      description: 'Consulta el estado financiero, recaudación y totales de caja de la jornada activa o de la última jornada cerrada.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            description: 'Opcional. "activa" para la jornada abierta actual o "ultima_cerrada" para el balance de la jornada anterior.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarGastosJornada',
      description: 'Consulta el detalle de los gastos registrados (descripción, motivo, monto, categoría y mayor gasto) de la jornada activa o la última jornada cerrada.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            description: 'Opcional. "activa" para gastos de la jornada actual o "ultima_cerrada" para gastos del turno anterior.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarVentasJornada',
      description: 'Consulta el ranking y desglose de productos vendidos durante la jornada activa o la última jornada cerrada.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            description: 'Opcional. "activa" para ventas del turno actual o "ultima_cerrada" para ventas del turno anterior.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarHistorialJornadas',
      description: 'Consulta el resumen financiero de las últimas N jornadas cerradas (fechas, totales de efectivo, MP, gastos y ganancia neta).',
      parameters: {
        type: 'object',
        properties: {
          limite: {
            type: 'number',
            description: 'Cantidad de jornadas cerradas a consultar (por defecto 5, máximo 15).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarRendimientoHistoricoProducto',
      description: 'Consulta el rendimiento histórico de ventas de un producto específico o general a lo largo de las últimas N jornadas para analizar tendencias.',
      parameters: {
        type: 'object',
        properties: {
          productoNombre: {
            type: 'string',
            description: 'Nombre o término parcial del producto a analizar (ej. Fernet, Pizza, Cerveza).',
          },
          limiteJornadas: {
            type: 'number',
            description: 'Cantidad de jornadas hacia atrás a incluir en el análisis (por defecto 5).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarCategorias',
      description: 'Consulta la lista completa de categorías de productos registradas en el bar con sus nombres y estados.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarCatalogoProductos',
      description: 'Consulta la lista de productos del menú con sus precios, categorías y estados (vendibles/insumos).',
      parameters: {
        type: 'object',
        properties: {
          categoriaNombre: {
            type: 'string',
            description: 'Nombre opcional de la categoría a filtrar (ej. Tragos, Cerveza, Comida).',
          },
        },
      },
    },
  },
]

// ============================================================================
// EJECUTOR DE HERRAMIENTAS EN EL SERVIDOR
// ============================================================================

import { createClient as createSupabaseDirect } from '@supabase/supabase-js'

export async function ejecutarTool(
  nombre: string,
  argumentosJSON: string,
  customSupabaseClient?: any
): Promise<string> {
  let supabase = customSupabaseClient

  if (!supabase) {
    try {
      supabase = await createClient()
    } catch (err) {
      // Fallback para entornos CLI donde cookies() no está disponible
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      supabase = createSupabaseDirect(url, key)
    }
  }

  let args: any = {}
  try {
    args = argumentosJSON ? JSON.parse(argumentosJSON) : {}
  } catch (e) {
    args = {}
  }

  switch (nombre) {
    case 'consultarStockActual': {
      const { data, error } = await supabase
        .from('Productos')
        .select('id, nombre, precio, stockActual, stockIdeal, stockInicial, unidad, activo, vendible, controla_stock, Categorias_Productos(nombre)')
        .eq('activo', true)
        .order('nombre')

      if (error) return JSON.stringify({ error: error.message })

      let resultados = data || []
      const termino = typeof args?.productoNombre === 'string' ? args.productoNombre.trim().toLowerCase() : ''

      if (termino.length > 0) {
        resultados = resultados.filter((p: any) =>
          p.nombre?.toLowerCase().includes(termino) ||
          p.Categorias_Productos?.nombre?.toLowerCase().includes(termino)
        )
      }

      return JSON.stringify({ productos: resultados })
    }

    case 'consultarCategorias': {
      const { data, error } = await supabase
        .from('Categorias_Productos')
        .select('id, nombre, activo, color')
        .order('nombre')

      if (error) return JSON.stringify({ error: error.message })
      return JSON.stringify({ categorias: data })
    }

    case 'consultarGastosJornada': {
      let jornada: any = null

      if (args?.tipo === 'ultima_cerrada') {
        const { data: jCerrada } = await supabase
          .from('Jornadas')
          .select('jornada_id, fecha_inicio, estado')
          .eq('estado', 'cerrada')
          .order('fecha_inicio', { ascending: false })
          .limit(1)
          .maybeSingle()
        jornada = jCerrada
      } else {
        const { data: jActiva } = await supabase
          .from('Jornadas')
          .select('jornada_id, fecha_inicio, estado')
          .in('estado', ['abierta', 'en_auditoria'])
          .maybeSingle()
        jornada = jActiva

        if (!jornada) {
          const { data: jCerrada } = await supabase
            .from('Jornadas')
            .select('jornada_id, fecha_inicio, estado')
            .order('fecha_inicio', { ascending: false })
            .limit(1)
            .maybeSingle()
          jornada = jCerrada
        }
      }

      if (!jornada) return JSON.stringify({ mensaje: 'No hay registros de jornadas en la base de datos.' })

      const { data: gastos, error: gErr } = await supabase
        .from('Gastos')
        .select('id, descripcion, monto, created_at, Categorias_Gastos(nombre)')
        .eq('jornada_id', jornada.jornada_id)
        .order('monto', { ascending: false })

      if (gErr) return JSON.stringify({ error: gErr.message })

      if (!gastos || gastos.length === 0) {
        return JSON.stringify({
          jornadaId: jornada.jornada_id,
          mensaje: 'No se registraron gastos en esta jornada.',
          totalGastos: 0,
        })
      }

      const listaGastos = gastos.map((g: any) => ({
        descripcion: g.descripcion,
        monto: Number(g.monto),
        categoria: g.Categorias_Gastos?.nombre || 'General',
        hora: g.created_at,
      }))

      const gastoMayor = listaGastos[0]
      const totalMontoGastos = listaGastos.reduce((acc, g) => acc + g.monto, 0)

      return JSON.stringify({
        jornadaId: jornada.jornada_id,
        cantGastos: listaGastos.length,
        totalGastos: totalMontoGastos,
        gastoMayor: gastoMayor,
        desgloseGastos: listaGastos,
      })
    }

    case 'consultarHistorialJornadas': {
      const limite = typeof args?.limite === 'number' && args.limite > 0 ? Math.min(args.limite, 15) : 5

      const { data: jornadas, error } = await supabase
        .from('Jornadas')
        .select('*')
        .eq('estado', 'cerrada')
        .order('fecha_inicio', { ascending: false })
        .limit(limite)

      if (error) return JSON.stringify({ error: error.message })
      if (!jornadas || jornadas.length === 0) {
        return JSON.stringify({ mensaje: 'No hay jornadas cerradas en el historial.' })
      }

      const resumen = jornadas.map((j) => ({
        jornadaId: j.jornada_id,
        fechaInicio: j.fecha_inicio,
        fechaCierre: j.fecha_cierre,
        totalEfectivo: j.total_efectivo,
        totalMercadoPagoReal: j.total_mp_real,
        totalGastos: j.total_gastos,
        gananciaNeta: j.ganancia_neta,
      }))

      return JSON.stringify({ historialJornadas: resumen })
    }

    case 'consultarRendimientoHistoricoProducto': {
      const limiteJornadas = typeof args?.limiteJornadas === 'number' && args.limiteJornadas > 0 ? Math.min(args.limiteJornadas, 10) : 5
      const productoFiltro = typeof args?.productoNombre === 'string' ? args.productoNombre.trim() : ''

      const { data: jornadas, error: jErr } = await supabase
        .from('Jornadas')
        .select('jornada_id, fecha_inicio')
        .order('fecha_inicio', { ascending: false })
        .limit(limiteJornadas)

      if (jErr || !jornadas || jornadas.length === 0) {
        return JSON.stringify({ mensaje: 'No hay jornadas disponibles para analizar la tendencia.' })
      }

      const jornadaIds = jornadas.map((j) => j.jornada_id)

      const { data: comandas, error: cErr } = await supabase
        .from('Comandas')
        .select('comanda_id, jornada_id, fecha')
        .in('jornada_id', jornadaIds)

      if (cErr || !comandas || comandas.length === 0) {
        return JSON.stringify({ mensaje: 'No se registraron comandas en el período histórico consultado.' })
      }

      const comandaIds = comandas.map((c) => c.comanda_id)
      const mapaComandaJornada = new Map(comandas.map((c) => [c.comanda_id, c.jornada_id]))
      const mapaJornadaFecha = new Map(jornadas.map((j) => [j.jornada_id, j.fecha_inicio]))

      let itemsQuery = supabase
        .from('Comanda_Items')
        .select('cantidad, precio_unitario, producto_id, Productos(nombre)')
        .in('comanda_id', comandaIds)

      const { data: items, error: iErr } = await itemsQuery

      if (iErr) return JSON.stringify({ error: iErr.message })

      let itemsFiltrados = items || []
      if (productoFiltro) {
        itemsFiltrados = itemsFiltrados.filter((item: any) =>
          item.Productos?.nombre?.toLowerCase().includes(productoFiltro.toLowerCase())
        )
      }

      const agruparResultado: Record<
        string,
        {
          nombreProducto: string
          unidadesTotales: number
          recaudadoTotal: number
          desgloseJornadas: Record<string, { fecha: string; unidades: number; recaudado: number }>
        }
      > = {}

      itemsFiltrados.forEach((item: any) => {
        const pNombre = item.Productos?.nombre || 'Producto'
        const cId = item.comanda_id
        const jId = mapaComandaJornada.get(cId)
        const fechaJ = mapaJornadaFecha.get(jId) || 'Fecha desconocida'
        const cant = Number(item.cantidad) || 0
        const subtotal = cant * (Number(item.precio_unitario) || 0)

        if (!agruparResultado[pNombre]) {
          agruparResultado[pNombre] = {
            nombreProducto: pNombre,
            unidadesTotales: 0,
            recaudadoTotal: 0,
            desgloseJornadas: {},
          }
        }

        agruparResultado[pNombre].unidadesTotales += cant
        agruparResultado[pNombre].recaudadoTotal += subtotal

        if (!agruparResultado[pNombre].desgloseJornadas[jId]) {
          agruparResultado[pNombre].desgloseJornadas[jId] = {
            fecha: fechaJ,
            unidades: 0,
            recaudado: 0,
          }
        }

        agruparResultado[pNombre].desgloseJornadas[jId].unidades += cant
        agruparResultado[pNombre].desgloseJornadas[jId].recaudado += subtotal
      })

      const analisis = Object.values(agruparResultado).map((p) => ({
        producto: p.nombreProducto,
        unidadesVendidasHistoricas: p.unidadesTotales,
        recaudadoHistoricoTotal: p.recaudadoTotal,
        tendenciaPorJornada: Object.values(p.desgloseJornadas),
      }))

      return JSON.stringify({ analisisTendenciaHistorica: analisis })
    }

    case 'consultarCajaJornada': {
      let jornada: any = null

      if (args?.tipo === 'ultima_cerrada') {
        const { data: jCerrada } = await supabase
          .from('Jornadas')
          .select('*')
          .eq('estado', 'cerrada')
          .order('fecha_inicio', { ascending: false })
          .limit(1)
          .maybeSingle()
        jornada = jCerrada
      } else {
        const { data: jActiva } = await supabase
          .from('Jornadas')
          .select('*')
          .in('estado', ['abierta', 'en_auditoria'])
          .maybeSingle()
        jornada = jActiva

        if (!jornada) {
          const { data: jCerrada } = await supabase
            .from('Jornadas')
            .select('*')
            .order('fecha_inicio', { ascending: false })
            .limit(1)
            .maybeSingle()
          jornada = jCerrada
        }
      }

      if (!jornada) return JSON.stringify({ mensaje: 'No hay registros de jornadas en la base de datos.' })

      const { data: comandas, error: cError } = await supabase
        .from('Comandas')
        .select('total, medio_pago')
        .eq('jornada_id', jornada.jornada_id)

      if (cError) return JSON.stringify({ error: cError.message })

      let totalEfectivo = 0
      let totalMp = 0
      let totalRegalo = 0

      comandas?.forEach((c) => {
        if (c.medio_pago === 'Efectivo') totalEfectivo += Number(c.total)
        else if (c.medio_pago === 'Mercado Pago') totalMp += Number(c.total)
        else if (c.medio_pago === 'Regalo') totalRegalo += 1
      })

      return JSON.stringify({
        jornadaId: jornada.jornada_id,
        estado: jornada.estado,
        fechaInicio: jornada.fecha_inicio,
        fechaCierre: jornada.fecha_cierre,
        cantComandas: comandas?.length || 0,
        totalEfectivo: jornada.total_efectivo || totalEfectivo,
        totalMercadoPagoReal: jornada.total_mp_real || totalMp,
        totalGastos: jornada.total_gastos || 0,
        gananciaNeta: jornada.ganancia_neta || (totalEfectivo + totalMp),
        comandasRegalo: totalRegalo,
      })
    }

    case 'consultarVentasJornada': {
      let jornada: any = null

      if (args?.tipo === 'ultima_cerrada') {
        const { data: jCerrada } = await supabase
          .from('Jornadas')
          .select('jornada_id')
          .eq('estado', 'cerrada')
          .order('fecha_inicio', { ascending: false })
          .limit(1)
          .maybeSingle()
        jornada = jCerrada
      } else {
        const { data: jActiva } = await supabase
          .from('Jornadas')
          .select('jornada_id')
          .in('estado', ['abierta', 'en_auditoria'])
          .maybeSingle()
        jornada = jActiva

        if (!jornada) {
          const { data: jCerrada } = await supabase
            .from('Jornadas')
            .select('jornada_id')
            .order('fecha_inicio', { ascending: false })
            .limit(1)
            .maybeSingle()
          jornada = jCerrada
        }
      }

      if (!jornada) return JSON.stringify({ mensaje: 'No hay registros de jornadas.' })

      const { data: comandas } = await supabase
        .from('Comandas')
        .select('comanda_id')
        .eq('jornada_id', jornada.jornada_id)

      if (!comandas || comandas.length === 0) {
        return JSON.stringify({ mensaje: 'No se registraron ventas en esa jornada.' })
      }

      const comandaIds = comandas.map((c) => c.comanda_id)

      const { data: items, error: iError } = await supabase
        .from('Comanda_Items')
        .select('cantidad, producto_id, Productos(nombre)')
        .in('comanda_id', comandaIds)

      if (iError) return JSON.stringify({ error: iError.message })

      const mapaVentas: Record<string, { nombre: string; unidades: number }> = {}
      items?.forEach((item: any) => {
        const pNombre = item.Productos?.nombre || 'Producto'
        if (!mapaVentas[pNombre]) {
          mapaVentas[pNombre] = { nombre: pNombre, unidades: 0 }
        }
        mapaVentas[pNombre].unidades += item.cantidad
      })

      const ranking = Object.values(mapaVentas).sort((a, b) => b.unidades - a.unidades)
      return JSON.stringify({ rankingVentas: ranking })
    }

    case 'consultarCatalogoProductos': {
      let query = supabase
        .from('Productos')
        .select('id, nombre, precio, vendible, controla_stock, Categorias_Productos(nombre)')
        .eq('activo', true)

      const { data, error } = await query.order('nombre')
      if (error) return JSON.stringify({ error: error.message })

      let resultados = data
      if (typeof args?.categoriaNombre === 'string' && args.categoriaNombre.trim().length > 0) {
        resultados = data?.filter((p: any) =>
          p.Categorias_Productos?.nombre?.toLowerCase().includes(args.categoriaNombre.trim().toLowerCase())
        )
      }

      return JSON.stringify({ catalogo: resultados })
    }

    default:
      return JSON.stringify({ error: `Herramienta desconocida: ${nombre}` })
  }
}
