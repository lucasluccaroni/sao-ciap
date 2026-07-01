'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  obtenerJornadaActiva,
  validarPinAdmin,
  iniciarAuditoria,
  obtenerResumenCaja,
  obtenerCategoriasGastos,
  registrarGastos,
  obtenerProductosAuditoria,
  registrarConteosAuditoria,
  cerrarJornada,
} from '@/app/actions/jornada'

// Helper nativo para hashear con SHA-256 en el cliente
async function hashSha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface GastoLocal {
  id: string
  categoriaId: string
  categoriaNombre: string
  descripcion: string
  monto: number
}

interface ProductoAuditoriaLocal {
  id: string
  nombre: string
  stockInicial: number
  unidadesVendidas: number
  stockTeorico: number
  conteoFisico?: number
}

export default function CierrePage() {
  const [jornada, setJornada] = useState<{ jornada_id: string; estado: string; fecha_inicio: string } | null>(null)
  const [resumen, setResumen] = useState<{
    totalEfectivo: number
    totalMp: number
    cantEfectivo: number
    cantMp: number
  } | null>(null)

  // Máquina de estados:
  // 0 = Resumen inicial y botón "Cerrar caja"
  // 1 = Carga de Gastos + Mercado Pago Real
  // 2 = Auditoría Física de Inventario
  // 3 = Consolidación Final y Confirmación de Cierre
  // 4 = Cierre Exitoso
  const [paso, setPaso] = useState(0)

  // Estados comunes de carga y modales
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [modalPinOpen, setModalPinOpen] = useState(false)
  const [pinDigits, setPinDigits] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Datos del Paso 1 (Gastos + MP Real)
  const [categoriasGastos, setCategoriasGastos] = useState<{ id: string; nombre: string }[]>([])
  const [gastos, setGastos] = useState<GastoLocal[]>([])
  const [gastoCategoriaId, setGastoCategoriaId] = useState('')
  const [gastoDescripcion, setGastoDescripcion] = useState('')
  const [gastoMonto, setGastoMonto] = useState('')
  const [totalMpReal, setTotalMpReal] = useState<string>('')

  // Datos del Paso 2 (Auditoría Física)
  const [productosAuditoria, setProductosAuditoria] = useState<ProductoAuditoriaLocal[]>([])

  // Carga inicial de datos
  const cargarDatosIniciales = async () => {
    try {
      setErrorMsg('')
      const resJornada = await obtenerJornadaActiva()

      if (!resJornada.success) {
        setErrorMsg(resJornada.error || 'Error al obtener la jornada activa.')
        setLoadingInicial(false)
        return
      }

      if (resJornada.jornada) {
        setJornada(resJornada.jornada)
        
        // Si ya está en auditoría, saltamos al Paso 1 directamente para continuar
        if (resJornada.jornada.estado === 'en_auditoria') {
          setPaso(1)
          await cargarPasoGastos(resJornada.jornada.jornada_id)
        } else {
          // Si está abierta, cargamos el resumen inicial
          const resResumen = await obtenerResumenCaja(resJornada.jornada.jornada_id)
          if (resResumen.success) {
            setResumen(resResumen.totales || null)
          }
        }
      } else {
        setJornada(null)
      }
    } catch (err: any) {
      setErrorMsg('Error al conectar con la base de datos.')
    } finally {
      setLoadingInicial(false)
    }
  }

  // Carga de datos específicos para el Paso 1
  const cargarPasoGastos = async (jornadaId: string) => {
    const resCat = await obtenerCategoriasGastos()
    if (resCat.success) {
      setCategoriasGastos(resCat.categorias || [])
    }
    const resResumen = await obtenerResumenCaja(jornadaId)
    if (resResumen.success) {
      setResumen(resResumen.totales || null)
    }
  }

  // Carga de datos específicos para el Paso 2
  const cargarPasoAuditoria = async (jornadaId: string) => {
    const resProd = await obtenerProductosAuditoria(jornadaId)
    if (resProd.success) {
      setProductosAuditoria(resProd.productos || [])
    }
  }

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  // Teclado del PIN modal
  const handleDigitClick = (num: string) => {
    if (pinDigits.length < 4) {
      setPinDigits([...pinDigits, num])
    }
  }

  const handleBackspace = () => {
    setPinDigits(pinDigits.slice(0, -1))
  }

  const handleClear = () => {
    setPinDigits([])
  }

  // Confirmar PIN e iniciar auditoría (Paso 0 -> 1)
  const handleConfirmarPin = async () => {
    if (pinDigits.length < 4 || !jornada) return

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const pinStr = pinDigits.join('')
      const pinHash = await hashSha256(pinStr)

      // 1. Validar el PIN del admin
      const resVal = await validarPinAdmin(pinHash)
      if (!resVal.success) {
        setErrorMsg(resVal.error || 'PIN incorrecto.')
        setPinDigits([])
        setIsSubmitting(false)
        return
      }

      // 2. Transicionar la jornada a 'en_auditoria'
      const resAud = await iniciarAuditoria(jornada.jornada_id)
      if (!resAud.success) {
        setErrorMsg(resAud.error || 'Error al iniciar la auditoría de la jornada.')
        setPinDigits([])
        setIsSubmitting(false)
        return
      }

      // 3. Éxito: cerrar modal, cargar catálogo de gastos y avanzar al Paso 1
      setModalPinOpen(false)
      setPinDigits([])
      setPaso(1)
      await cargarPasoGastos(jornada.jornada_id)
    } catch (err: any) {
      setErrorMsg('Error durante el inicio del cierre.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Métodos del Paso 1 (Gastos)
  const handleAgregarGasto = () => {
    setErrorMsg('')
    if (!gastoCategoriaId || !gastoDescripcion || !gastoMonto) {
      setErrorMsg('Por favor, completa todos los campos del gasto.')
      return
    }

    const montoNum = Math.max(0, Number(gastoMonto) || 0)
    const catNombre = categoriasGastos.find((c) => c.id === gastoCategoriaId)?.nombre || 'Categoría'

    const nuevoGasto: GastoLocal = {
      id: crypto.randomUUID(),
      categoriaId: gastoCategoriaId,
      categoriaNombre: catNombre,
      descripcion: gastoDescripcion,
      monto: montoNum,
    }

    setGastos([...gastos, nuevoGasto])
    setGastoDescripcion('')
    setGastoMonto('')
  }

  const handleEliminarGasto = (id: string) => {
    setGastos(gastos.filter((g) => g.id !== id))
  }

  const guardarGastosYAvanzar = async () => {
    if (!jornada) return
    setErrorMsg('')

    // Validación: si hubo comandas con MP, es obligatorio ingresar un total mp real mayor que 0
    const totalMpTeorico = resumen?.totalMp || 0
    const mpRealNum = Math.max(0, Number(totalMpReal) || 0)
    
    if (totalMpTeorico > 0 && mpRealNum === 0 && totalMpReal === '') {
      setErrorMsg('El campo Mercado Pago real es obligatorio si hubo cobros virtuales en la jornada.')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Guardar gastos en la DB local
      const resGastos = await registrarGastos(
        jornada.jornada_id,
        gastos.map((g) => ({
          categoria_id: g.categoriaId,
          descripcion: g.descripcion,
          monto: g.monto,
        }))
      )

      if (!resGastos.success) {
        setErrorMsg(resGastos.error || 'Error al persistir los gastos.')
        setIsSubmitting(false)
        return
      }

      // 2. Cargar productos y pasar al Paso 2
      await cargarPasoAuditoria(jornada.jornada_id)
      setPaso(2)
    } catch (err: any) {
      setErrorMsg('Error al procesar la carga de gastos.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Métodos del Paso 2 (Auditoría Física)
  const handleConteoChange = (prodId: string, val: string) => {
    const numVal = val === '' ? undefined : Math.max(0, Number(val))
    
    setProductosAuditoria(
      productosAuditoria.map((p) => {
        if (p.id === prodId) {
          return { ...p, conteoFisico: numVal }
        }
        return p
      })
    )
  }

  const guardarAuditoriaYAvanzar = async () => {
    if (!jornada) return
    setErrorMsg('')

    // Validación de que se hayan ingresado todos los conteos físicos
    const incompletos = productosAuditoria.some((p) => p.conteoFisico === undefined)
    if (incompletos) {
      setErrorMsg('Por favor, ingresa el conteo físico de todos los productos en lista.')
      return
    }

    setIsSubmitting(true)

    try {
      const conteos = productosAuditoria.map((p) => ({
        producto_id: p.id,
        conteo_fisico: p.conteoFisico || 0,
      }))

      // Guardar conteos físicos en base de datos
      const resAud = await registrarConteosAuditoria(jornada.jornada_id, conteos)

      if (!resAud.success) {
        setErrorMsg(resAud.error || 'Error al guardar los conteos físicos.')
        setIsSubmitting(false)
        return
      }

      // Avanzar al Paso 3 (Consolidación)
      setPaso(3)
    } catch (err: any) {
      setErrorMsg('Error al registrar la auditoría.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Métodos del Paso 3 (Cierre Definitivo)
  const handleConfirmarCierreJornada = async () => {
    if (!jornada) return
    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const mpRealNum = Math.max(0, Number(totalMpReal) || 0)
      const mpLista = resumen?.totalMp || 0
      const comisionMp = Math.max(0, mpLista - mpRealNum)

      const res = await cerrarJornada(jornada.jornada_id, mpRealNum, comisionMp)

      if (!res.success) {
        setErrorMsg(res.error || 'Error al procesar el cierre contable.')
        setIsSubmitting(false)
        return
      }

      setPaso(4) // Cierre Exitoso!
    } catch (err: any) {
      setErrorMsg('Error durante el cierre definitivo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Formateadores
  const formatearMoneda = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)
  }

  // 1. Cargando datos
  if (loadingInicial) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#080A0D]">
        {/* Se añade -translate-x-6 para compensar visualmente la cola del fantasma y se agranda a w-44 h-44 para emparejar con el login */}
        <div className="relative w-44 h-44 mb-8 flex items-center justify-center animate-heartbeat -translate-x-6">
          <Image
            src="/images/fantasma.png"
            alt="Cargando"
            fill
            sizes="176px"
            className="object-contain filter drop-shadow-[0_0_20px_rgba(242,106,27,0.4)]"
          />
        </div>
        <span className="font-creepster text-3xl text-[#F26A1B] tracking-widest select-none">
          CARGANDO CIERRE...
        </span>
      </div>
    )
  }

  // 2. Si no hay jornada activa en el sistema
  if (!jornada && paso !== 4) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="h-14 bg-[#080A0D] border-b border-[#9D9D9D]/10 flex items-center px-6 shrink-0">
          <h1 className="font-livvic text-lg font-bold text-[#F2F2F2]">
            Cierre de Caja
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 relative">
          <div className="absolute inset-0 bg-phantom-pattern opacity-[0.02] pointer-events-none select-none" />
          <div className="w-full max-w-[500px] bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-2xl p-8 flex flex-col items-center shadow-lg">
            <div className="w-16 h-16 mb-6 flex items-center justify-center text-[#30CFF2]">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="font-livvic text-2xl font-bold text-[#F2F2F2] mb-2">
              Sin jornada abierta
            </h2>
            <p className="font-livvic text-sm text-[#9D9D9D] mb-8 text-center max-w-[320px]">
              No podés realizar un cierre de caja porque no hay ninguna jornada activa.
            </p>
            <Link
              href="/admin/caja"
              className="w-full h-12 bg-[#F26A1B] hover:bg-[#F25922] text-[#F2F2F2] font-livvic text-sm font-bold uppercase tracking-wider rounded-lg shadow-lg flex items-center justify-center transition-colors select-none"
            >
              Ir al Control de Jornadas
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Sumatorias y balances rápidos para renders
  const totalEfectivo = resumen?.totalEfectivo || 0
  const totalMpLista = resumen?.totalMp || 0
  const totalRecaudadoTeorico = totalEfectivo + totalMpLista
  const totalComandasTeorico = (resumen?.cantEfectivo || 0) + (resumen?.cantMp || 0)

  // RENDER PASO 0: Resumen inicial de cierre
  if (paso === 0) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Barra de Título (56px) */}
        <div className="h-14 bg-[#080A0D] border-b border-[#9D9D9D]/10 flex items-center px-6 shrink-0 select-none">
          <h1 className="font-livvic text-lg font-bold text-[#F2F2F2]">
            Cierre de Caja
          </h1>
        </div>

        {/* Contenedor Naranja Principal */}
        <div className="flex-1 bg-[#F26A1B] p-6 flex flex-col gap-6 min-h-0 overflow-y-auto">
          
          <div className="flex flex-col gap-1.5 select-none">
            <h2 className="font-livvic text-xs font-bold text-[#F2F2F2] uppercase tracking-wider">
              Resumen de la Jornada
            </h2>
          </div>

          {/* Tarjetas de Totales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 select-none">
            <div className="bg-[#1A1A1A] rounded-xl p-5 border border-[#9D9D9D]/10 shadow-lg">
              <span className="font-livvic text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider">Efectivo</span>
              <h2 className="font-livvic text-3xl font-bold text-[#1D9E75] mt-1.5">{formatearMoneda(totalEfectivo)}</h2>
              <span className="font-livvic text-xs text-[#9D9D9D] mt-1 block">{resumen?.cantEfectivo || 0} comandas</span>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-5 border border-[#9D9D9D]/10 shadow-lg">
              <span className="font-livvic text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider">Mercado Pago</span>
              <h2 className="font-livvic text-3xl font-bold text-[#378ADD] mt-1.5">{formatearMoneda(totalMpLista)}</h2>
              <span className="font-livvic text-xs text-[#9D9D9D] mt-1 block">{resumen?.cantMp || 0} comandas</span>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-5 border border-[#9D9D9D]/10 shadow-lg">
              <span className="font-livvic text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider">Total Recaudado</span>
              <h2 className="font-livvic text-3xl font-bold text-[#F2F2F2] mt-1.5">{formatearMoneda(totalRecaudadoTeorico)}</h2>
              <span className="font-livvic text-xs text-[#9D9D9D] mt-1 block">{totalComandasTeorico} comandas enviadas</span>
            </div>
          </div>

          {/* Caja Cierre de Caja */}
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#9D9D9D]/10 shadow-lg flex items-center justify-between flex-wrap gap-4">
            <span className="font-livvic text-sm text-[#9D9D9D] select-none">
              Se te pedirá cargar los gastos y confirmar el resumen antes de cerrar.
            </span>
            <button
              onClick={() => {
                setErrorMsg('')
                setModalPinOpen(true)
              }}
              className="px-6 h-12 bg-[#E2484A] hover:bg-[#E2484A]/90 text-[#F2F2F2] font-livvic text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg cursor-pointer transition-colors active:scale-[0.99] select-none"
            >
              Cerrar caja
            </button>
          </div>
        </div>

        {/* Modal PIN de Cierre */}
        {modalPinOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-[360px] bg-[#1A1A1A] border border-[#9D9D9D]/20 rounded-2xl p-6 shadow-2xl flex flex-col items-center">
              <h3 className="font-livvic text-lg font-bold text-[#F2F2F2] mb-1">Confirmá tu PIN</h3>
              <p className="font-livvic text-xs text-[#9D9D9D] mb-5">Ingresá el PIN de cierre para continuar.</p>

              <div className="flex gap-4 mb-5">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 ${
                      pinDigits.length > idx ? 'bg-[#F2F2F2] border-[#F2F2F2]' : 'border-[#9D9D9D]/50 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              <div className="w-full h-12 bg-[#080A0D] border border-[#9D9D9D]/15 rounded-lg flex items-center justify-center mb-6">
                <span className="text-xl text-[#F2F2F2] tracking-widest font-mono">
                  {pinDigits.map(() => '•').join('')}
                </span>
              </div>

              {errorMsg && (
                <div className="w-full bg-[#E2484A]/10 border border-[#E2484A]/30 text-[#E2484A] text-xs py-2 px-3 rounded-lg mb-5 text-center font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Teclado */}
              <div className="grid grid-cols-3 gap-3 w-full mb-6">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((val) => (
                  <button
                    key={val}
                    disabled={isSubmitting}
                    onClick={() => handleDigitClick(val)}
                    className="h-12 bg-[#080A0D]/50 hover:bg-[#080A0D] text-[#F2F2F2] rounded-lg font-mono text-lg font-bold transition-colors cursor-pointer select-none"
                  >
                    {val}
                  </button>
                ))}
                <button disabled={isSubmitting} onClick={handleClear} className="h-12 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] transition-colors cursor-pointer select-none">
                  Limpiar
                </button>
                <button
                  key="0"
                  disabled={isSubmitting}
                  onClick={() => handleDigitClick('0')}
                  className="h-12 bg-[#080A0D]/50 hover:bg-[#080A0D] text-[#F2F2F2] rounded-lg font-mono text-lg font-bold transition-colors cursor-pointer select-none"
                >
                  0
                </button>
                <button disabled={isSubmitting} onClick={handleBackspace} className="h-12 text-[#9D9D9D] hover:text-[#F2F2F2] flex items-center justify-center transition-colors cursor-pointer select-none">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414A2 2 0 0010.828 19h8.344a2 2 0 002-2V7a2 2 0 00-2-2h-8.344a2 2 0 00-1.414.586L3 12z" />
                  </svg>
                </button>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setModalPinOpen(false)
                    setPinDigits([])
                    setErrorMsg('')
                  }}
                  className="flex-1 h-11 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#9D9D9D]/10 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] rounded-lg transition-colors cursor-pointer select-none uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={pinDigits.length < 4 || isSubmitting}
                  onClick={handleConfirmarPin}
                  className="flex-1 h-11 bg-[#F26A1B] hover:bg-[#F25922] text-[#F2F2F2] text-xs font-bold rounded-lg transition-colors cursor-pointer select-none uppercase tracking-wider disabled:opacity-40"
                >
                  {isSubmitting ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // RENDER PASO 1: Carga de Gastos + Mercado Pago Real
  if (paso === 1) {
    const totalGastosNum = gastos.reduce((acc, curr) => acc + curr.monto, 0)
    
    return (
      <div className="flex-1 flex flex-col">
        <div className="h-14 bg-[#080A0D] border-b border-[#9D9D9D]/10 flex items-center px-6 shrink-0">
          <h1 className="font-livvic text-lg font-bold text-[#F2F2F2]">
            Cierre — Paso 1 — Gastos del día
          </h1>
        </div>

        <div className="flex-1 bg-[#F26A1B] p-6 flex flex-col gap-6 min-h-0 overflow-y-auto">
          {errorMsg && (
            <div className="w-full bg-[#E2484A] text-[#F2F2F2] font-livvic text-xs font-semibold py-2.5 px-3 rounded-lg border border-red-700/50 flex items-center gap-2 select-none">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
            {/* Sección de Gastos (Izquierda) */}
            <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#9D9D9D]/10 flex flex-col min-h-0 shadow-lg">
              <h3 className="font-livvic text-sm font-bold uppercase tracking-wider text-[#F2F2F2] mb-4 select-none">
                Carga de Gastos
              </h3>

              {/* Formulario de agregar gastos */}
              <div className="flex flex-col gap-3 mb-6 bg-[#080A0D]/20 p-4 rounded-xl border border-[#9D9D9D]/5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-livvic text-[10px] font-bold text-[#9D9D9D] uppercase tracking-wider">Categoría</label>
                    <select
                      value={gastoCategoriaId}
                      onChange={(e) => setGastoCategoriaId(e.target.value)}
                      className="h-10 px-3 bg-[#1A1A1A] border border-[#9D9D9D]/30 rounded-lg text-sm text-[#F2F2F2] focus:outline-none focus:border-[#F25922]"
                    >
                      <option value="">Seleccionar...</option>
                      {categoriasGastos.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-livvic text-[10px] font-bold text-[#9D9D9D] uppercase tracking-wider">Monto</label>
                    <input
                      type="number"
                      placeholder="Ej: 5000"
                      value={gastoMonto}
                      onChange={(e) => setGastoMonto(e.target.value)}
                      className="h-10 px-3 bg-[#1A1A1A] border border-[#9D9D9D]/30 rounded-lg text-sm text-[#F2F2F2] focus:outline-none focus:border-[#F25922]"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-livvic text-[10px] font-bold text-[#9D9D9D] uppercase tracking-wider">Descripción</label>
                  <input
                    type="text"
                    placeholder="Ej: Compra de hielo adicional"
                    value={gastoDescripcion}
                    onChange={(e) => setGastoDescripcion(e.target.value)}
                    className="h-10 px-3 bg-[#1A1A1A] border border-[#9D9D9D]/30 rounded-lg text-sm text-[#F2F2F2] focus:outline-none focus:border-[#F25922]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAgregarGasto}
                  className="h-10 mt-2 bg-[#080A0D]/60 hover:bg-[#080A0D] border border-[#9D9D9D]/15 text-[#F2F2F2] text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  + Agregar Gasto
                </button>
              </div>

              {/* Listado de gastos */}
              <h4 className="font-livvic text-[10px] font-bold text-[#9D9D9D] uppercase tracking-wider mb-2 select-none">Lista de Gastos agregados</h4>
              <div className="flex-1 overflow-y-auto min-h-[150px] pr-1 flex flex-col gap-2">
                {gastos.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center border border-dashed border-[#9D9D9D]/15 rounded-xl py-6 text-xs text-[#9D9D9D]">
                    No se cargaron gastos en esta sesión.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 bg-[#080A0D]/20 rounded-lg overflow-hidden border border-[#9D9D9D]/5">
                    {gastos.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between p-3.5 bg-[#1A1A1A] border-b border-[#080A0D]/40 last:border-0"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs text-[#9D9D9D] font-bold uppercase tracking-wide">{g.categoriaNombre}</span>
                          <span className="text-sm text-[#F2F2F2] mt-0.5">{g.descripcion}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm font-bold text-[#F2F2F2]">{formatearMoneda(g.monto)}</span>
                          <button
                            onClick={() => handleEliminarGasto(g.id)}
                            className="p-1 text-[#E2484A] hover:bg-[#E2484A]/10 rounded cursor-pointer"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-[#9D9D9D]/10 flex justify-between items-center select-none shrink-0">
                <span className="text-sm font-bold text-[#9D9D9D] uppercase tracking-wide">Gastos Totales</span>
                <span className="font-mono text-xl font-bold text-[#E2484A]">{formatearMoneda(totalGastosNum)}</span>
              </div>
            </div>

            {/* Mercado Pago Posnet (Derecha) */}
            <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#9D9D9D]/10 flex flex-col justify-between shadow-lg">
              <div>
                <h3 className="font-livvic text-sm font-bold uppercase tracking-wider text-[#F2F2F2] mb-6 select-none">
                  Mercado Pago — Cierre de Posnet
                </h3>
                <p className="text-xs text-[#9D9D9D] leading-relaxed mb-6 select-none">
                  Ingresá el monto neto total acreditado que figura en la terminal Posnet física de Mercado Pago al final del turno. Este valor es mandatorio y se conciliará contra el total calculado por el sistema.
                </p>

                <div className="flex flex-col gap-2 mb-6">
                  <label htmlFor="mp_real" className="font-livvic text-xs font-semibold text-[#F2F2F2] uppercase tracking-wider">
                    Mercado Pago Real (Posnet)
                  </label>
                  <input
                    id="mp_real"
                    type="number"
                    placeholder="Ej: 615000"
                    value={totalMpReal}
                    onChange={(e) => setTotalMpReal(e.target.value)}
                    className="w-full h-12 px-4 bg-[#1A1A1A] border border-[#9D9D9D]/30 focus:border-[#F25922] focus:ring-2 focus:ring-[#F25922]/20 text-lg font-bold text-[#F2F2F2] rounded-lg transition-all focus:outline-none"
                    min="0"
                  />
                </div>

                <div className="bg-[#080A0D]/30 border border-[#9D9D9D]/10 rounded-xl p-4 flex justify-between items-center select-none">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#9D9D9D] uppercase tracking-wider">Total MP Lista</span>
                    <span className="text-[10px] text-[#9D9D9D]/60 uppercase tracking-wide">Cálculo Teórico Sistema</span>
                  </div>
                  <span className="font-mono text-lg font-bold text-[#378ADD]">
                    {formatearMoneda(totalMpLista)}
                  </span>
                </div>
              </div>

              {/* Botón de envío */}
              <div className="flex justify-end mt-8 select-none">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={guardarGastosYAvanzar}
                  className="px-6 h-12 bg-[#F2F2F2] hover:bg-[#F2F2F2]/90 text-[#080A0D] font-livvic text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg flex items-center justify-center transition-colors cursor-pointer select-none active:scale-[0.99] disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Ir a Auditoría de Inventario →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // RENDER PASO 2: Auditoría Física de Inventario
  if (paso === 2) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="h-14 bg-[#080A0D] border-b border-[#9D9D9D]/10 flex items-center px-6 shrink-0">
          <h1 className="font-livvic text-lg font-bold text-[#F2F2F2]">
            Cierre — Paso 2 — Auditoría de Inventario
          </h1>
        </div>

        <div className="flex-1 bg-[#F26A1B] p-6 flex flex-col gap-6 min-h-0">
          {errorMsg && (
            <div className="w-full bg-[#E2484A] text-[#F2F2F2] font-livvic text-xs font-semibold py-2.5 px-3 rounded-lg border border-red-700/50 flex items-center gap-2 select-none shrink-0">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex-1 bg-[#1A1A1A] rounded-2xl p-6 border border-[#9D9D9D]/10 flex flex-col min-h-0 shadow-lg">
            <div className="flex items-center justify-between mb-4 select-none">
              <h3 className="font-livvic text-sm font-bold uppercase tracking-wider text-[#F2F2F2]">
                Conteo Físico de Productos
              </h3>
              <span className="text-xs text-[#9D9D9D]">Productos ordenados por rotación (ventas)</span>
            </div>

            {/* Listado de auditoría de inventario */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              <table className="w-full text-left font-livvic text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#080A0D]/50 text-xs text-[#9D9D9D] font-bold uppercase tracking-wider select-none">
                    <th className="pb-3.5 pl-3">Nombre Producto</th>
                    <th className="pb-3.5 text-center">Unid. Vendidas</th>
                    <th className="pb-3.5 text-center">Stock Teórico</th>
                    <th className="pb-3.5 text-center w-36">Conteo Físico</th>
                    <th className="pb-3.5 text-right pr-3">Desvío</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#080A0D]/40">
                  {productosAuditoria.map((p) => {
                    const conteo = p.conteoFisico !== undefined ? p.conteoFisico : 0
                    const desvio = p.conteoFisico !== undefined ? conteo - p.stockTeorico : 0
                    const tieneDesvio = p.conteoFisico !== undefined && desvio !== 0

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-[#080A0D]/10 transition-colors ${
                          tieneDesvio ? 'bg-[#E2484A]/5' : ''
                        }`}
                      >
                        <td className="py-3 pl-3 font-semibold text-[#F2F2F2]">{p.nombre}</td>
                        <td className="py-3 text-center text-[#9D9D9D]">{p.unidadesVendidas} u.</td>
                        <td className="py-3 text-center text-[#9D9D9D]">{p.stockTeorico} u.</td>
                        <td className="py-3 text-center">
                          <input
                            type="number"
                            value={p.conteoFisico === undefined ? '' : p.conteoFisico}
                            onChange={(e) => handleConteoChange(p.id, e.target.value)}
                            placeholder="Ingrese..."
                            className="w-24 h-9 px-3 bg-[#1A1A1A] border border-[#9D9D9D]/30 focus:border-[#F25922] focus:ring-1 focus:ring-[#F25922]/20 text-center font-bold text-sm text-[#F2F2F2] rounded-md focus:outline-none placeholder-[#9D9D9D]/40"
                            min="0"
                          />
                        </td>
                        <td className="py-3 text-right pr-3 font-mono font-bold">
                          {p.conteoFisico === undefined ? (
                            <span className="text-[#9D9D9D]">—</span>
                          ) : desvio > 0 ? (
                            <span className="text-[#1D9E75]">+{desvio}</span>
                          ) : desvio < 0 ? (
                            <span className="text-[#E2484A]">{desvio}</span>
                          ) : (
                            <span className="text-[#9D9D9D]">0</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer auditoría */}
            <div className="mt-6 pt-4 border-t border-[#9D9D9D]/10 flex justify-between items-center select-none shrink-0">
              <span className="text-xs text-[#9D9D9D] max-w-[400px]">
                Desvíos resaltados en rojo. Asegúrate de verificar los números antes de confirmar la auditoría.
              </span>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={guardarAuditoriaYAvanzar}
                className="px-6 h-12 bg-[#F2F2F2] hover:bg-[#F2F2F2]/90 text-[#080A0D] font-livvic text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg flex items-center justify-center transition-colors cursor-pointer select-none active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Confirmar Auditoría →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // RENDER PASO 3: Consolidación contable final y cierre
  if (paso === 3) {
    const totalGastos = gastos.reduce((acc, curr) => acc + curr.monto, 0)
    const mpRealNum = Math.max(0, Number(totalMpReal) || 0)
    const comisionMp = Math.max(0, totalMpLista - mpRealNum)
    const totalGeneral = totalEfectivo + mpRealNum
    const gananciaNeta = totalGeneral - totalGastos

    // Si la comisión supera el 10% del total de Mercado Pago Lista, alertar
    const comisionPorcentaje = totalMpLista > 0 ? (comisionMp / totalMpLista) * 100 : 0
    const alertarComision = comisionPorcentaje > 10

    return (
      <div className="flex-1 flex flex-col">
        <div className="h-14 bg-[#080A0D] border-b border-[#9D9D9D]/10 flex items-center px-6 shrink-0">
          <h1 className="font-livvic text-lg font-bold text-[#F2F2F2]">
            Cierre — Paso 3 — Resumen y cierre
          </h1>
        </div>

        <div className="flex-1 bg-[#F26A1B] p-6 flex flex-col gap-6 min-h-0 overflow-y-auto">
          {errorMsg && (
            <div className="w-full bg-[#E2484A] text-[#F2F2F2] font-livvic text-xs font-semibold py-2.5 px-3 rounded-lg border border-red-700/50 flex items-center gap-2 select-none shrink-0">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="w-full max-w-[680px] mx-auto bg-[#1A1A1A] border border-[#9D9D9D]/10 rounded-2xl p-8 flex flex-col shadow-lg">
            <h3 className="font-livvic text-sm font-bold uppercase tracking-wider text-[#F2F2F2] mb-6 pb-2 border-b border-[#9D9D9D]/10 select-none">
              Consolidación Final Contable
            </h3>

            <div className="flex flex-col gap-4 font-livvic select-none">
              
              {/* Efectivo */}
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-[#9D9D9D]">Total Efectivo Recaudado</span>
                <span className="font-mono text-base font-semibold text-[#F2F2F2]">{formatearMoneda(totalEfectivo)}</span>
              </div>

              {/* Mercado Pago */}
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-[#9D9D9D]">Mercado Pago Teórico (Lista)</span>
                <span className="font-mono text-base font-semibold text-[#F2F2F2]">{formatearMoneda(totalMpLista)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-[#9D9D9D]">Mercado Pago Acreditado (Real)</span>
                <span className="font-mono text-base font-semibold text-[#378ADD]">{formatearMoneda(mpRealNum)}</span>
              </div>

              {/* Comisión MP */}
              <div className="flex justify-between items-center py-1.5 border-b border-[#080A0D]/50">
                <span className="text-sm text-[#9D9D9D]">Comisión de Mercado Pago</span>
                <span className={`font-mono text-base font-semibold ${alertarComision ? 'text-[#BA7517]' : 'text-[#9D9D9D]'}`}>
                  {formatearMoneda(comisionMp)} ({comisionPorcentaje.toFixed(1)}%)
                </span>
              </div>
              
              {alertarComision && (
                <div className="bg-[#BA7517]/10 border border-[#BA7517]/30 text-[#BA7517] text-xs py-2.5 px-3 rounded-lg mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Atención: La comisión de Mercado Pago supera el 10% del total cobrado.</span>
                </div>
              )}

              {/* Gastos */}
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-[#9D9D9D]">Gastos Totales de la Jornada</span>
                <span className="font-mono text-base font-semibold text-[#E2484A]">{formatearMoneda(totalGastos)}</span>
              </div>

              {/* Balances Finales */}
              <div className="flex justify-between items-center py-3 mt-4 border-t-2 border-[#080A0D] border-dashed">
                <span className="text-sm font-bold text-[#F2F2F2] uppercase tracking-wide">Total General Real</span>
                <span className="font-mono text-lg font-bold text-[#F2F2F2]">{formatearMoneda(totalGeneral)}</span>
              </div>

              <div className="flex justify-between items-center py-3 bg-[#080A0D]/30 border border-[#9D9D9D]/10 rounded-xl px-4 mt-2">
                <span className="text-sm font-bold text-[#30CFF2] uppercase tracking-wide">Ganancia Neta Final</span>
                <span className="font-mono text-xl font-bold text-[#30CFF2]">{formatearMoneda(gananciaNeta)}</span>
              </div>
            </div>

            {/* Confirmar cierre */}
            <div className="mt-8 flex gap-4 select-none shrink-0">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setPaso(2)}
                className="flex-1 h-12 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#9D9D9D]/10 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] rounded-lg transition-colors cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmarCierreJornada}
                className="flex-2 h-12 bg-[#E2484A] hover:bg-[#E2484A]/90 text-[#F2F2F2] text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-lg active:scale-[0.99]"
              >
                {isSubmitting ? 'Cerrando contabilidad...' : 'Confirmar y Cerrar Jornada'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // RENDER PASO 4: Cierre Exitoso
  return (
    <div className="flex-1 flex flex-col">
      <div className="h-14 bg-[#080A0D] border-b border-[#9D9D9D]/10 flex items-center px-6 shrink-0">
        <h1 className="font-livvic text-lg font-bold text-[#F2F2F2]">
          Cierre Exitoso
        </h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-phantom-pattern opacity-[0.02] pointer-events-none select-none" />
        
        {/* Tarjeta de éxito */}
        <div className="w-full max-w-[500px] bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-2xl p-8 flex flex-col items-center shadow-[0_8px_30px_rgba(0,0,0,0.4)] select-none">
          <div className="w-16 h-16 mb-6 flex items-center justify-center text-[#1D9E75] bg-[#1D9E75]/10 rounded-full border border-[#1D9E75]/20 shadow-[0_0_15px_rgba(29,158,117,0.2)]">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 className="font-livvic text-2xl font-bold text-[#F2F2F2] mb-2 text-center">
            Jornada Cerrada con Éxito
          </h2>
          <p className="font-livvic text-sm text-[#9D9D9D] mb-8 text-center max-w-[340px]">
            La jornada ha finalizado correctamente.
          </p>

          <Link
            href="/admin/caja"
            className="w-full h-12 bg-[#F2F2F2] hover:bg-[#F2F2F2]/90 text-[#080A0D] font-livvic text-sm font-bold uppercase tracking-wider rounded-lg shadow-lg flex items-center justify-center transition-colors cursor-pointer active:scale-[0.99]"
          >
            Volver a Jornadas
          </Link>
        </div>
      </div>
    </div>
  )
}
