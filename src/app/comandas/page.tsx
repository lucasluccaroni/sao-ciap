'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { obtenerCategorias, obtenerProductos } from '@/app/actions/productos'
import { obtenerJornadaActiva, obtenerResumenCaja } from '@/app/actions/jornada'
import { crearComanda } from '@/app/actions/comandas'
import { cerrarSesion } from '@/app/actions/auth'
import { createClient as createBrowserClient } from '@/utils/supabase/client'

interface Categoria {
  id: string
  nombre: string
  color_fondo: string
  color_texto: string
  activo: boolean
}

interface Producto {
  id: string
  nombre: string
  categoria_id: string
  precio: number
  stockIdeal: number
  stockInicial: number
  stockActual: number
  unidad: 'u' | 'lt' | 'ml'
  activo: boolean
  vendible: boolean
  controla_stock: boolean
  Categorias_Productos?: {
    nombre: string
    color_fondo: string
    color_texto: string
  }
}

interface CarritoItem {
  producto: Producto
  cantidad: number
}

interface ComandaHistorial {
  id: string
  nro: number
  total: number
  medioPago: string
  beeper: number | null
}

export default function ComandasPage() {
  const pathname = usePathname()
  const esAdminRoute = pathname?.startsWith('/admin')

  // Estados de datos
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [jornada, setJornada] = useState<{ jornada_id: string; estado: string } | null>(null)
  const [userRol, setUserRol] = useState<string>('Empleado')
  const [userName, setUserName] = useState<string>('Empleado')
  const [comandasJornada, setComandasJornada] = useState<ComandaHistorial[]>([])
  
  // Estados de carga e interfaz
  const [loading, setLoading] = useState(true)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('')
  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  const [beeper, setBeeper] = useState<string>('')
  const [medioPago, setMedioPago] = useState<'Efectivo' | 'Mercado Pago' | 'Regalo'>('Efectivo')
  const [errorMsg, setErrorMsg] = useState('')
  const [altoViewportSuficiente, setAltoViewportSuficiente] = useState(true)
  
  // Modales de flujo
  const [modalExitoOpen, setModalExitoOpen] = useState(false)
  const [modalStockErrorOpen, setModalStockErrorOpen] = useState(false)
  const [modalConexionErrorOpen, setModalConexionErrorOpen] = useState(false)
  const [modalLogoutOpen, setModalLogoutOpen] = useState(false)
  const [successTicket, setSuccessTicket] = useState<string>('')
  const [successBeeper, setSuccessBeeper] = useState<string>('')
  const [stockErrorMsg, setStockErrorMsg] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const obtenerFechaFormateada = () => {
    const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
    const fecha = new Date()
    const diaSemana = dias[fecha.getDay()]
    const diaMes = String(fecha.getDate()).padStart(2, '0')
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    return `${diaSemana} ${diaMes}/${mes}`
  }

  // Carga de datos iniciales
  const cargarDatos = async () => {
    try {
      setLoading(true)
      setErrorMsg('')

      // Obtener el rol y nombre del usuario logueado
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: dbUser } = await supabase
          .from('Usuarios')
          .select('nombre, rol')
          .eq('id', user.id)
          .single()
        if (dbUser) {
          if (dbUser.nombre) setUserName(dbUser.nombre)
          if (dbUser.rol) setUserRol(dbUser.rol)
        }
      }

      const resJornada = await obtenerJornadaActiva()
      if (!resJornada.success) {
        setErrorMsg(resJornada.error || 'Error al validar la jornada.')
        setLoading(false)
        return
      }

      setJornada(resJornada.jornada || null)

      // Solo si la jornada está abierta, cargamos el menú y el historial
      if (resJornada.jornada && resJornada.jornada.estado === 'abierta') {
        const [resCat, resProd, resResumen] = await Promise.all([
          obtenerCategorias(),
          obtenerProductos(),
          obtenerResumenCaja(resJornada.jornada.jornada_id)
        ])

        if (resCat.success && resCat.categorias) {
          const catActivas = resCat.categorias.filter(c => c.activo)
          const todasVirtual: Categoria = {
            id: 'todas',
            nombre: 'Todos los productos',
            color_fondo: '#FFFFFF',
            color_texto: '#000000',
            activo: true
          }
          setCategorias([todasVirtual, ...catActivas])
          setCategoriaSeleccionada('todas')
        }

        if (resProd.success && resProd.productos) {
          const prodVendibles = (resProd.productos as Producto[]).filter(
            p => p.activo && p.vendible
          )
          setProductos(prodVendibles)
        }

        if (resResumen.success && resResumen.comandas) {
          // Mapeamos el historial de comandas
          const hist: ComandaHistorial[] = resResumen.comandas.map((c: any) => ({
            id: c.id,
            nro: c.numeroTicket,
            total: c.total,
            medioPago: c.medioPago,
            beeper: c.beeper || null
          }))
          setComandasJornada(hist)
        }
      }
    } catch (err: any) {
      setErrorMsg('Error de red al conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
    
    // Validar si el alto de la pantalla física es suficiente
    const checkHeight = () => {
      setAltoViewportSuficiente(window.innerHeight >= 780)
    }
    checkHeight()
    window.addEventListener('resize', checkHeight)
    return () => window.removeEventListener('resize', checkHeight)
  }, [])

  // Suscripción a Realtime para stock, jornada y comandas
  useEffect(() => {
    const supabase = createBrowserClient()

    // 1. Suscribirse a cambios en stock de productos
    const canalProductos = supabase
      .channel('mozo-productos-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Productos' },
        (payload) => {
          const modProd = payload.new as { id: string; stockActual: number; activo: boolean; vendible: boolean }
          setProductos((prev) => {
            const listaActualizada = prev.map((p) => {
              if (p.id === modProd.id) {
                return { 
                  ...p, 
                  stockActual: Number(modProd.stockActual) || 0,
                  activo: modProd.activo,
                  vendible: modProd.vendible
                }
              }
              return p
            })

            // Propagar cambio de stock en tiempo real a los productos vendibles asociados
            return listaActualizada.map((p) => {
              if (p.insumo_compartido_id === modProd.id) {
                return {
                  ...p,
                  stockActual: Number(modProd.stockActual) || 0
                }
              }
              return p
            }).filter(p => p.activo && p.vendible)
          })
        }
      )
      .subscribe()

    // 2. Suscribirse a cambios en la jornada activa
    const canalJornada = supabase
      .channel('mozo-jornada-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Jornadas' },
        () => {
          cargarDatos()
        }
      )
      .subscribe()

    // 3. Suscribirse a nuevas comandas para actualizar el historial en vivo
    const canalComandas = supabase
      .channel('mozo-comandas-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Comandas' },
        () => {
          if (jornada) {
            obtenerResumenCaja(jornada.jornada_id).then(resResumen => {
              if (resResumen.success && resResumen.comandas) {
                const hist: ComandaHistorial[] = resResumen.comandas.map((c: any) => ({
                  id: c.id,
                  nro: c.numeroTicket,
                  total: c.total,
                  medioPago: c.medioPago,
                  beeper: c.beeper || null
                }))
                setComandasJornada(hist)
              }
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalProductos)
      supabase.removeChannel(canalJornada)
      supabase.removeChannel(canalComandas)
    }
  }, [jornada?.jornada_id])

  // Helpers de Carrito
  const agregarAlCarrito = (prod: Producto) => {
    const existe = carrito.find(item => item.producto.id === prod.id)
    
    if (prod.controla_stock) {
      const recursoId = prod.insumo_compartido_id || prod.id
      const totalOcupado = carrito.reduce((total, item) => {
        const itemRecursoId = item.producto.insumo_compartido_id || item.producto.id
        if (itemRecursoId === recursoId) {
          return total + item.cantidad
        }
        return total
      }, 0)

      if (totalOcupado >= prod.stockActual) {
        setStockErrorMsg(`No hay más existencias disponibles (stock de insumo agotado).`)
        setModalStockErrorOpen(true)
        return
      }
    }

    if (existe) {
      setCarrito(
        carrito.map(item =>
          item.producto.id === prod.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      )
    } else {
      setCarrito([...carrito, { producto: prod, cantidad: 1 }])
    }
  }

  const cambiarCantidad = (prodId: string, delta: number) => {
    const item = carrito.find(c => c.producto.id === prodId)
    if (!item) return

    if (delta > 0 && item.producto.controla_stock) {
      const recursoId = item.producto.insumo_compartido_id || item.producto.id
      const totalOcupado = carrito.reduce((total, c) => {
        const itemRecursoId = c.producto.insumo_compartido_id || c.producto.id
        if (itemRecursoId === recursoId) {
          return total + c.cantidad
        }
        return total
      }, 0)

      if (totalOcupado >= item.producto.stockActual) {
        setStockErrorMsg(`No hay más existencias disponibles (stock de insumo agotado).`)
        setModalStockErrorOpen(true)
        return
      }
    }

    const nuevaCantidad = item.cantidad + delta
    if (nuevaCantidad <= 0) {
      setCarrito(carrito.filter(c => c.producto.id !== prodId))
    } else {
      setCarrito(
        carrito.map(c =>
          c.producto.id === prodId ? { ...c, cantidad: nuevaCantidad } : c
        )
      )
    }
  }

  const handleLogout = async () => {
    const res = await cerrarSesion()
    if (res.success) {
      window.location.href = '/'
    }
  }

  // Envío de Comanda
  const handleConfirmarComanda = async () => {
    if (carrito.length === 0 || isSubmitting) return
    setIsSubmitting(true)
    setErrorMsg('')

    const payload = {
      nro_beeper: beeper.trim() ? parseInt(beeper, 10) : null,
      medio_pago: medioPago,
      items: carrito.map(item => ({
        producto_id: item.producto.id,
        cantidad: item.cantidad
      }))
    }

    try {
      const res = await crearComanda(payload)
      if (res.success) {
        setSuccessTicket(res.comandaId || 'Generada')
        setSuccessBeeper(beeper)
        setModalExitoOpen(true)

        // 1. Descontar localmente el stock en el cliente (actualización optimista instantánea)
        setProductos((prev) =>
          prev.map((p) => {
            const itemEnCarrito = carrito.find(c => c.producto.id === p.id)
            if (itemEnCarrito && p.controla_stock) {
              return {
                ...p,
                stockActual: Math.max(0, p.stockActual - itemEnCarrito.cantidad)
              }
            }
            return p
          })
        )

        // 2. Recargar asíncronamente del servidor de fondo para asegurar sincronía oficial
        obtenerProductos().then((resProd) => {
          if (resProd.success && resProd.productos) {
            const prodVendibles = (resProd.productos as Producto[]).filter(
              p => p.activo && p.vendible
            )
            setProductos(prodVendibles)
          }
        })

        setCarrito([])
        setBeeper('')
        
        // Recargar el historial tras registrar comanda
        if (jornada) {
          const resResumen = await obtenerResumenCaja(jornada.jornada_id)
          if (resResumen.success && resResumen.comandas) {
            const hist: ComandaHistorial[] = resResumen.comandas.map((c: any) => ({
              id: c.id,
              nro: c.numeroTicket,
              total: c.total,
              medioPago: c.medioPago,
              beeper: c.beeper || null
            }))
            setComandasJornada(hist)
          }
        }
      } else {
        if (res.error?.includes('Stock insuficiente')) {
          setStockErrorMsg(res.error)
          setModalStockErrorOpen(true)
        } else {
          setErrorMsg(res.error || 'Ocurrió un error inesperado al procesar la comanda.')
        }
      }
    } catch (err: any) {
      setModalConexionErrorOpen(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalCarrito = carrito.reduce(
    (acc, item) => acc + item.producto.precio * item.cantidad,
    0
  )

  // ============================================================================
  // RENDER PANTALLAS DE BLOQUEO (JornadaGuard)
  // ============================================================================
  
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#080A0D]">
        <div className="text-sm font-semibold text-[#9D9D9D]">Cargando terminal de comandas...</div>
      </div>
    )
  }

  const renderModalLogout = () => {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm select-none p-4 font-livvic">
        <div className="w-full max-w-sm bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
          <div className="p-6 text-center">
            {/* Icono de advertencia */}
            <div className="w-14 h-14 rounded-full bg-red-950/30 border border-red-500/30 flex items-center justify-center text-red-500 mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            
            <h3 className="text-[#F2F2F2] font-bold text-base uppercase tracking-wider mb-2">
              ¿Seguro desea salir?
            </h3>
            <p className="text-[#9D9D9D] text-xs leading-relaxed mb-6">
              Se cerrará la sesión actual de la terminal.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setModalLogoutOpen(false)}
                className="h-11 border border-white/10 bg-transparent hover:bg-white/5 text-white/80 hover:text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="h-11 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-lg active:scale-[0.99]"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!jornada || jornada.estado === 'cerrada') {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center bg-[#080A0D] overflow-hidden">
        <div className="absolute inset-0 bg-phantom-pattern opacity-[0.02] pointer-events-none select-none" />
        <div className="relative w-full max-w-[500px] px-6 py-12 flex flex-col items-center z-10">
          
          <div className="flex flex-col items-center mb-8 select-none">
            <div className="relative w-28 h-28 mb-3 rounded-full border border-[#30CFF2]/20 bg-[#080A0D] p-1.5 flex items-center justify-center shadow-[0_0_15px_rgba(48,207,242,0.15)]">
              <Image src="/images/sao-logo.png" alt="SAO Logo" width={110} height={110} className="object-contain" priority />
            </div>
            <h1 className="font-creepster text-4xl text-[#F2F2F2] tracking-wider">SAO BAR</h1>
          </div>

          <div className="w-full bg-[#1A1A1A] border-2 border-[#E2484A]/30 rounded-2xl p-8 flex flex-col items-center shadow-[0_10px_35px_rgba(226,72,74,0.15)]">
            <div className="w-16 h-16 rounded-full bg-[#E2484A]/10 border border-[#E2484A]/30 flex items-center justify-center text-[#E2484A] mb-6">
              <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v6m0 3h.01" />
              </svg>
            </div>
            <h3 className="font-livvic text-[#F2F2F2] text-center font-bold text-base uppercase tracking-wider mb-3 select-none">
              Terminal Bloqueada
            </h3>
            <p className="font-livvic text-[#9D9D9D] text-center text-xs leading-relaxed mb-6 select-none max-w-[320px]">
              No hay una jornada activa. Aguarde a que inicie una para registrar pedidos.
            </p>
            <button
              onClick={() => setModalLogoutOpen(true)}
              className="w-full h-11 border border-[#9D9D9D]/20 hover:bg-[#E2484A]/10 hover:border-[#E2484A]/30 text-[#9D9D9D] hover:text-[#E2484A] font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
            >
              Salir
            </button>
          </div>
        </div>
        {modalLogoutOpen && renderModalLogout()}
      </div>
    )
  }

  if (jornada.estado === 'en_auditoria') {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center bg-[#080A0D] overflow-hidden">
        <div className="absolute inset-0 bg-phantom-pattern opacity-[0.02] pointer-events-none select-none" />
        <div className="relative w-full max-w-[500px] px-6 py-12 flex flex-col items-center z-10">
          
          <div className="flex flex-col items-center mb-8 select-none">
            <div className="relative w-28 h-28 mb-3 rounded-full border border-[#30CFF2]/20 bg-[#080A0D] p-1.5 flex items-center justify-center shadow-[0_0_15px_rgba(48,207,242,0.15)]">
              <Image src="/images/sao-logo.png" alt="SAO Logo" width={110} height={110} className="object-contain" priority />
            </div>
            <h1 className="font-creepster text-4xl text-[#F2F2F2] tracking-wider">SAO BAR</h1>
          </div>

          <div className="w-full bg-[#1A1A1A] border-2 border-[#BA7517]/30 rounded-2xl p-8 flex flex-col items-center shadow-[0_10px_35px_rgba(186,117,23,0.15)]">
            <div className="w-16 h-16 rounded-full bg-[#BA7517]/10 border border-[#BA7517]/30 flex items-center justify-center text-[#BA7517] mb-6">
              <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="font-livvic text-[#F2F2F2] text-center font-bold text-base uppercase tracking-wider mb-3 select-none">
              Terminal en Auditoría
            </h3>
            <p className="font-livvic text-[#9D9D9D] text-center text-xs leading-relaxed mb-6 select-none">
              La jornada se encuentra en auditoría para su posterior cierre. Las comandas están inhabilitadas.
            </p>
            <button
              onClick={() => setModalLogoutOpen(true)}
              className="w-full h-11 border border-[#9D9D9D]/20 hover:bg-[#BA7517]/10 hover:border-[#BA7517]/30 text-[#9D9D9D] hover:text-[#BA7517] font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
            >
              Salir
            </button>
          </div>
        </div>
        {modalLogoutOpen && renderModalLogout()}
      </div>
    )
  }

  // ============================================================================
  // RENDER PASO ABIERTO: Toma de Comandas
  // ============================================================================
  const productosFiltrados = categoriaSeleccionada === 'todas'
    ? productos
    : productos.filter(p => p.categoria_id === categoriaSeleccionada)

  // Función de renderizado para tarjetas de productos individuales para evitar duplicidad
  const renderTarjetaProducto = (prod: Producto) => {
    const enCarrito = carrito.find(c => c.producto.id === prod.id)
    const cantCarrito = enCarrito ? enCarrito.cantidad : 0

    // Calcular consumo unificado de existencias del insumo asociado en el carrito actual
    const recursoId = prod.insumo_compartido_id || prod.id
    const cantOcupadaEnCarrito = !prod.controla_stock
      ? 0
      : carrito.reduce((total, item) => {
          const itemRecursoId = item.producto.insumo_compartido_id || item.producto.id
          if (itemRecursoId === recursoId) {
            return total + item.cantidad
          }
          return total
        }, 0)

    const sinStock = prod.controla_stock && prod.stockActual <= cantOcupadaEnCarrito
    const stockRestanteEnPantalla = Math.max(0, prod.stockActual - cantOcupadaEnCarrito)

    // Círculo de color en base al stock restante
    const colorCirculo = !prod.controla_stock
      ? 'bg-[#1D9E75]'
      : stockRestanteEnPantalla <= 0
      ? 'bg-[#E2484A]'
      : stockRestanteEnPantalla <= 3
      ? 'bg-[#BA7517]'
      : 'bg-[#1D9E75]'

    return (
      <button
        key={prod.id}
        disabled={sinStock}
        onClick={() => agregarAlCarrito(prod)}
        className={`relative p-4 rounded-xl flex flex-col justify-between text-left transition-all cursor-pointer bg-[#13171B] border border-white/5 h-32 active:scale-[0.99] select-none ${
          sinStock
            ? 'opacity-40 cursor-not-allowed shadow-none'
            : 'hover:bg-[#1A1E24] hover:border-white/20 hover:shadow-lg'
        }`}
      >
        <div>
          {/* Fila superior: Unidad y Círculo de Stock */}
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold text-[#9D9D9D] tracking-wide select-none">
              {prod.nombre}
            </span>
            <div className={`w-2.5 h-2.5 rounded-full ${colorCirculo} shadow-sm`} />
          </div>

          {/* Precio */}
          <h4 className="font-mono text-2xl font-bold text-white mt-1">
            ${prod.precio.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
          </h4>
        </div>

        {/* Stock o badge de Sin Stock abajo */}
        <div className="flex justify-between items-end select-none">
          {prod.controla_stock ? (
            <span className="text-xs text-[#9D9D9D]">
              {stockRestanteEnPantalla} unid.
            </span>
          ) : (
            <span className="text-[9px] bg-yellow-950/20 border border-yellow-800/30 text-yellow-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Ilimitado
            </span>
          )}
          
          {sinStock && (
            <span className="text-[9px] bg-[#E2484A] text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
              Sin stock
            </span>
          )}

          {cantCarrito > 0 && (
            <div className="w-6 h-6 rounded-full bg-[#30CFF2] flex items-center justify-center text-[#080A0D] text-xs font-bold shadow-[0_0_8px_rgba(48,207,242,0.4)] animate-scale-in">
              {cantCarrito}
            </div>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className={`w-full bg-[#F26A1B] flex flex-col font-livvic text-[#F2F2F2] ${altoViewportSuficiente ? 'overflow-hidden ' + (esAdminRoute ? 'h-[calc(100vh-56px)]' : 'h-screen') : 'overflow-y-auto min-h-screen'}`}>
      
      {/* 1. Header Superior (Oculto si se encuentra dentro del layout de Admin) */}
      {!esAdminRoute && (
        <header className="h-14 w-full bg-[#080A0D] border-b border-[#F2F2F2] flex items-center justify-between px-6 shrink-0 z-30 select-none shadow-md">
          
          {/* Logo a la izquierda */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 rounded-full border border-[#30CFF2]/30 bg-[#080A0D] flex items-center justify-center p-0.5 shadow-[0_0_8px_rgba(48,207,242,0.15)]">
              <Image src="/images/sao-logo.png" alt="Logo" width={34} height={34} style={{ width: 'auto', height: 'auto' }} className="object-contain" />
            </div>
            <span className="font-creepster text-xl tracking-wider text-[#F2F2F2]">
              SAO BAR
            </span>
          </div>

          {/* Derecha: Fecha, usuario y Salir */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right select-none">
              <span className="font-livvic text-xs text-[#9D9D9D]">
                {obtenerFechaFormateada()}
              </span>
              <span className="font-livvic text-xs font-semibold text-[#F2F2F2] uppercase tracking-wide">
                {userName}
              </span>
            </div>
            <button
              onClick={() => setModalLogoutOpen(true)}
              className="h-8 px-4 border border-[#9D9D9D]/20 bg-[#2E2E2E]/40 hover:bg-[#2E2E2E]/80 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] rounded transition-all cursor-pointer uppercase tracking-wider"
            >
              Salir
            </button>
          </div>

        </header>
      )}

      {/* 2. Cuerpo Principal */}
      <div className={`flex-1 flex min-h-0 relative ${altoViewportSuficiente ? '' : 'flex-col lg:flex-row'}`}>
        
        {/* Columna Izquierda: Catálogo y Productos (Fondo Naranja Completo) */}
        <main className={`flex-1 p-6 flex flex-col ${altoViewportSuficiente ? 'overflow-y-auto min-h-0' : ''}`}>
          <div className="mb-4 select-none flex justify-between items-center bg-[#080A0D]/20 p-4 rounded-xl border border-white/10">
            <div>
              <h1 className="font-livvic text-3xl font-bold text-white tracking-wide">
                Comandas
              </h1>
              <span className="text-xs text-white/70 block mt-0.5">Toca los productos para agregarlos al pedido</span>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="select_categoria" className="text-[10px] font-bold text-white/85 uppercase tracking-wider">
                Categoría:
              </label>
              <select
                id="select_categoria"
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                className="h-12 px-4 bg-[#080A0D] border border-white/20 rounded-lg text-sm font-bold text-white uppercase tracking-wider focus:outline-none cursor-pointer min-w-[240px] shadow-inner"
              >
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {categoriaSeleccionada === 'todas' ? (
            <div className="space-y-8 flex-1">
              {categorias.filter(c => c.id !== 'todas').map((cat) => {
                const prodsDeCat = productos.filter(p => p.categoria_id === cat.id)
                if (prodsDeCat.length === 0) return null

                return (
                  <div key={cat.id} className="animate-scale-in">
                    <div className="flex items-center gap-3 mb-4 select-none">
                      <span 
                        className="px-3.5 py-1 rounded text-xs font-bold uppercase tracking-wider shadow-sm"
                        style={{ backgroundColor: cat.color_fondo, color: cat.color_text || '#FFFFFF' }}
                      >
                        {cat.nombre}
                      </span>
                      <div className="flex-1 h-0.5 bg-white/20" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {prodsDeCat.map(renderTarjetaProducto)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            productosFiltrados.length === 0 ? (
              <div className="flex-1 flex items-center justify-center border border-dashed border-white/20 rounded-2xl py-12 text-sm text-white/60 select-none">
                No hay productos disponibles en esta categoría.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-scale-in">
                {productosFiltrados.map(renderTarjetaProducto)}
              </div>
            )
          )}
        </main>

        {/* Línea Divisoria Vertical */}
        <div className={`w-[3px] bg-white/40 shrink-0 ${altoViewportSuficiente ? 'self-stretch' : 'hidden lg:block'}`}></div>

        {/* Columna Derecha: Comanda Actual e Historial (Fondo Naranja Completo) */}
        <aside className={`w-full lg:w-[380px] p-6 flex flex-col select-none gap-4 shrink-0 ${altoViewportSuficiente ? 'h-full overflow-hidden' : 'min-h-[700px]'}`}>
          
          {/* Bloque Superior: Título y Beeper */}
          <div className="shrink-0 space-y-3.5">
            <h2 className="font-livvic text-2xl font-bold text-white tracking-wide">
              Comanda
            </h2>
            
            {/* Configuración de Beeper */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nro_beeper" className="text-[10px] font-bold text-white/80 uppercase tracking-wider select-none">
                Beeper
              </label>
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9D9D9D]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <input
                  id="nro_beeper"
                  type="number"
                  placeholder="Nro de beeper (opcional)"
                  value={beeper}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setBeeper('')
                      return
                    }
                    const num = parseInt(val, 10)
                    if (isNaN(num)) return
                    if (num < 1) {
                      setBeeper('1')
                    } else if (num > 20) {
                      setBeeper('20')
                    } else {
                      setBeeper(num.toString())
                    }
                  }}
                  className="w-full h-11 pl-10 pr-4 bg-[#080A0D] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white transition-colors"
                  min="1"
                  max="20"
                />
              </div>
            </div>
          </div>

          {/* Bloque Central Flexible: Pedido */}
          <div className={`flex flex-col space-y-2 ${altoViewportSuficiente ? 'flex-1 min-h-0' : 'shrink-0'}`}>
            <label className="text-[10px] font-bold text-white/80 uppercase tracking-wider block select-none shrink-0">
              Pedido
            </label>
            <div className={`space-y-2 ${altoViewportSuficiente ? 'flex-1 overflow-y-auto min-h-0 pr-1' : 'max-h-[350px] overflow-y-auto'}`}>
              {carrito.length === 0 ? (
                <div className="h-full min-h-[80px] flex items-center justify-center bg-[#080A0D]/30 border border-dashed border-white/10 rounded-xl p-6 text-center text-xs text-white/60 select-none">
                  Tocá un producto del catálogo para agregarlo al pedido
                </div>
              ) : (
                carrito.map((item) => (
                  <div
                    key={item.producto.id}
                    className="p-3.5 bg-[#080A0D] border border-white/5 rounded-xl flex items-center justify-between gap-3 animate-scale-in shrink-0"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-white block uppercase truncate select-all">
                        {item.producto.nombre}
                      </span>
                    </div>

                    <div className="flex items-center gap-3.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => cambiarCantidad(item.producto.id, -1)}
                          className="w-7 h-7 rounded-md bg-[#1A1D20] border border-white/10 text-white font-bold text-sm flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                        >
                          -
                        </button>
                        <span className="font-mono text-sm font-bold text-white w-6 text-center select-none">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() => cambiarCantidad(item.producto.id, 1)}
                          className="w-7 h-7 rounded-md bg-[#1A1D20] border border-white/10 text-white font-bold text-sm flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-mono text-xs font-bold text-white bg-[#1A1D20] border border-white/10 px-2.5 py-1 rounded">
                        ${(item.producto.precio * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bloque Inferior Fijo: Totales, Pago y Confirmación */}
          <div className="shrink-0 space-y-4 pt-3 border-t border-white/10">
            {/* Resumen Financiero */}
            <div className="flex items-center justify-between select-none">
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Total</span>
              <span className="font-mono text-2xl font-bold text-white">
                ${totalCarrito.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </span>
            </div>

            {/* Medios de Pago */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-white/80 uppercase tracking-wider select-none">
                Medio de Pago
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMedioPago('Efectivo')}
                  className={`h-11 text-xs font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider text-center ${
                    medioPago === 'Efectivo'
                      ? 'bg-[#1D9E75] text-white shadow-md font-extrabold scale-[1.01]'
                      : 'bg-[#080A0D] border border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setMedioPago('Mercado Pago')}
                  className={`h-11 text-xs font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider text-center ${
                    medioPago === 'Mercado Pago'
                      ? 'bg-[#378ADD] text-white shadow-md font-extrabold scale-[1.01]'
                      : 'bg-[#080A0D] border border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  Mercado Pago
                </button>
              </div>

              {/* Botón de Regalo (Más pequeño y de menor prioridad visual) */}
              <button
                type="button"
                onClick={() => setMedioPago('Regalo')}
                className={`w-full h-8 text-[10px] font-bold rounded-md transition-all cursor-pointer uppercase tracking-wider text-center border mt-1.5 ${
                  medioPago === 'Regalo'
                    ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-sm font-extrabold'
                    : 'bg-transparent border-dashed border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                }`}
              >
                Regalo de la Casa
              </button>

              {medioPago === 'Regalo' && (
                <p className="text-[10px] text-[#080A0D] font-semibold italic mt-0.5 leading-tight select-none">
                  Esta comanda se registrará como regalo y tendrá valor de $0 en caja, descontando stock.
                </p>
              )}
            </div>

            {errorMsg && (
              <div className="text-[11px] text-white font-bold bg-[#E2484A] p-3 rounded-lg text-center animate-shake shadow-md uppercase tracking-wider">
                {errorMsg}
              </div>
            )}

            {/* Botones de Control de la Comanda */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={carrito.length === 0 || isSubmitting}
                onClick={handleConfirmarComanda}
                className={`w-full h-12 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer select-none flex items-center justify-center shadow-md active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed ${
                  carrito.length === 0 
                    ? 'bg-neutral-800 text-neutral-600 border border-neutral-700/20' 
                    : 'bg-white hover:bg-white/90 text-black font-extrabold'
                }`}
              >
                {isSubmitting ? 'Procesando...' : 'Enviar comanda'}
              </button>

              <button
                type="button"
                disabled={carrito.length === 0 || isSubmitting}
                onClick={() => {
                  setCarrito([])
                  setBeeper('')
                  setErrorMsg('')
                }}
                className="w-full h-11 bg-[#080A0D] hover:bg-[#111] border border-white/20 text-white text-xs font-bold rounded-lg py-3 uppercase tracking-wider text-center cursor-pointer shadow-md select-none active:scale-[0.99] disabled:opacity-20 disabled:cursor-not-allowed"
              >
                + Nueva comanda
              </button>
            </div>

            {/* Sección de Historial de Jornada */}
            {comandasJornada.length > 0 && (
              <div className="pt-2 space-y-2 select-none">
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-3 text-[9px] font-bold text-white/50 uppercase tracking-widest">Historial</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <div className="max-h-[130px] overflow-y-auto space-y-2 pr-1 text-xs text-white/80">
                  {comandasJornada.slice(0, 3).map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-[45px_80px_1fr_70px] items-center py-1.5 border-b border-white/5 last:border-0 last:pb-0 gap-2"
                    >
                      <span className="font-bold text-[#30CFF2] text-left">#{c.nro}</span>
                      <span className="font-mono text-left">${c.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                      <span className="text-[10px] text-white/60 uppercase text-left truncate">{c.medioPago}</span>
                      <div className="flex justify-end min-w-[70px]">
                        {c.beeper ? (
                          <span className="flex items-center gap-1 text-[#F26A1B] font-bold text-[9px] bg-[#080A0D] border border-white/10 px-1.5 py-0.5 rounded shrink-0">
                            🔔 {c.beeper}
                          </span>
                        ) : (
                          <div className="h-5 w-full" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ============================================================================
      // MODALES DE RESPUESTA
      // ============================================================================ */}

      {/* 1. Modal Éxito */}
      {modalExitoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in text-[#F2F2F2]">
          <div className="bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-2xl w-[400px] max-w-[90%] shadow-2xl overflow-hidden animate-scale-in select-none">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#1D9E75]/10 border border-[#1D9E75]/30 flex items-center justify-center text-[#1D9E75] mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-bold text-[#F2F2F2] text-base uppercase tracking-wider mb-2">
                ¡Comanda Procesada!
              </h3>
              <p className="text-xs text-[#9D9D9D] leading-relaxed mb-4">
                La comanda ha sido insertada con éxito en el sistema.
              </p>
              <div className="w-full bg-[#080A0D] border border-[#9D9D9D]/5 rounded-xl p-4 flex flex-col gap-2 mb-6">
                <div className="flex justify-between items-center text-xs text-[#9D9D9D]">
                  <span>Ticket Nro:</span>
                  <span className="font-mono font-bold text-[#30CFF2]">{successTicket}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-[#9D9D9D]">
                  <span>Beeper Asignado:</span>
                  {successBeeper ? (
                    <span className="font-bold text-[#F26A1B]">Beeper {successBeeper}</span>
                  ) : (
                    <span className="text-neutral-500 italic">Ninguno</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalExitoOpen(false)}
                className="w-full h-11 bg-[#F2F2F2] hover:bg-[#F2F2F2]/90 text-[#080A0D] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Error Stock Insuficiente */}
      {modalStockErrorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in text-[#F2F2F2]">
          <div className="bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-2xl w-[400px] max-w-[90%] shadow-2xl overflow-hidden animate-scale-in select-none">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#E2484A]/10 border border-[#E2484A]/30 flex items-center justify-center text-[#E2484A] mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-bold text-[#F2F2F2] text-base uppercase tracking-wider mb-2">
                Stock Insuficiente
              </h3>
              <p className="text-xs text-[#9D9D9D] leading-relaxed mb-6">
                {stockErrorMsg || 'No hay existencias suficientes del producto seleccionado para completar el pedido.'}
              </p>
              <button
                type="button"
                onClick={() => setModalStockErrorOpen(false)}
                className="w-full h-11 bg-[#E2484A] hover:bg-[#E2484A]/90 text-[#F2F2F2] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Revisar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Error Conexión / Servidor */}
      {modalConexionErrorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in text-[#F2F2F2]">
          <div className="bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-2xl w-[400px] max-w-[90%] shadow-2xl overflow-hidden animate-scale-in select-none">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#BA7517]/10 border border-[#BA7517]/30 flex items-center justify-center text-[#BA7517] mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-bold text-[#F2F2F2] text-base uppercase tracking-wider mb-2">
                Error de Conexión
              </h3>
              <p className="text-xs text-[#9D9D9D] leading-relaxed mb-6">
                No se pudo establecer comunicación con el servidor. Por favor, verifique su conexión a internet e intente de nuevo.
              </p>
              <button
                type="button"
                onClick={() => setModalConexionErrorOpen(false)}
                className="w-full h-11 bg-[#BA7517] hover:bg-[#BA7517]/90 text-[#F2F2F2] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Cierre de Sesión */}
      {modalLogoutOpen && renderModalLogout()}

    </div>
  )
}
