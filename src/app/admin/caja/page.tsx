'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  obtenerJornadaActiva,
  abrirJornada,
  validarPinAdmin,
  obtenerResumenCaja,
} from '@/app/actions/jornada'

// Helper nativo para hashear con SHA-256 en el cliente
async function hashSha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function CajaPage() {
  const [jornada, setJornada] = useState<{ jornada_id: string; estado: string; fecha_inicio: string } | null>(null)
  const [resumen, setResumen] = useState<{
    totalEfectivo: number
    totalMp: number
    cantEfectivo: number
    cantMp: number
  } | null>(null)
  const [comandas, setComandas] = useState<any[]>([])
  
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [modalPinOpen, setModalPinOpen] = useState(false)
  const [pinDigits, setPinDigits] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Carga inicial del estado del sistema
  const cargarEstado = async () => {
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
        
        // Si está abierta, cargamos comandas y totales
        if (resJornada.jornada.estado === 'abierta') {
          const resResumen = await obtenerResumenCaja(resJornada.jornada.jornada_id)
          if (resResumen.success) {
            setResumen(resResumen.totales || null)
            setComandas(resResumen.comandas || [])
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

  useEffect(() => {
    cargarEstado()
  }, [])

  // Manejo de ingreso del PIN en el modal
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

  // Enviar el PIN de administrador para abrir la jornada
  const handleConfirmarPin = async () => {
    if (pinDigits.length < 4) return

    setIsSubmitting(true)
    setErrorMsg('')
    
    try {
      const pinStr = pinDigits.join('')
      const pinHash = await hashSha256(pinStr)
      
      // 1. Validar pin del admin
      const resVal = await validarPinAdmin(pinHash)
      
      if (!resVal.success) {
        setErrorMsg(resVal.error || 'PIN incorrecto.')
        setPinDigits([])
        setIsSubmitting(false)
        return
      }

      // 2. Abrir la jornada
      const resAbrir = await abrirJornada()
      
      if (!resAbrir.success) {
        setErrorMsg(resAbrir.error || 'Error al abrir la jornada.')
        setPinDigits([])
        setIsSubmitting(false)
        return
      }

      // 3. Éxito: cerrar modal y refrescar el estado
      setModalPinOpen(false)
      setPinDigits([])
      setLoadingInicial(true)
      await cargarEstado()
    } catch (err: any) {
      setErrorMsg('Error durante el proceso de apertura.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Formatear moneda nacional
  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor)
  }

  // 1. Estado de carga inicial (Fantasma latiendo)
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
          CARGANDO CAJA...
        </span>
      </div>
    )
  }

  // 2. JORNADA CERRADA (JornadaGuard — Admin — Cerrada)
  if (!jornada) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Barra de Título (56px) */}
        <div className="h-14 bg-[#080A0D] border-b border-[#9D9D9D]/10 flex items-center px-6 shrink-0">
          <h1 className="font-livvic text-lg font-bold text-[#F2F2F2]">
            Estado de Jornada
          </h1>
        </div>

        {/* Contenido Central */}
        <div className="flex-1 flex items-center justify-center p-6 relative">
          <div className="absolute inset-0 bg-phantom-pattern opacity-[0.02] pointer-events-none select-none" />

          {/* Tarjeta JornadaGuard */}
          <div className="w-full max-w-[500px] bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-2xl p-8 flex flex-col items-center shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
            <div className="w-16 h-16 mb-6 flex items-center justify-center text-[#30CFF2]">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <h2 className="font-livvic text-2xl font-bold text-[#F2F2F2] mb-2 text-center">
              Sin jornada activa
            </h2>
            <p className="font-livvic text-sm text-[#9D9D9D] mb-8 text-center max-w-[320px]">
              No hay una jornada abierta. Podés iniciar una nueva jornada.
            </p>

            <button
              onClick={() => {
                setErrorMsg('')
                setModalPinOpen(true)
              }}
              className="w-full h-12 bg-[#F26A1B] hover:bg-[#F25922] text-[#F2F2F2] font-livvic text-sm font-bold uppercase tracking-wider rounded-lg shadow-lg transition-colors cursor-pointer select-none active:scale-[0.99]"
            >
              Abrir nueva jornada
            </button>
            <span className="font-livvic text-xs text-[#9D9D9D]/60 mt-3">
              Se solicitará validación de PIN
            </span>
          </div>
        </div>

        {/* Modal de PIN de Administrador */}
        {modalPinOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-[360px] bg-[#1A1A1A] border border-[#9D9D9D]/20 rounded-2xl p-6 shadow-2xl flex flex-col items-center">
              <h3 className="font-livvic text-lg font-bold text-[#F2F2F2] mb-1">
                Confirmá tu PIN
              </h3>
              <p className="font-livvic text-xs text-[#9D9D9D] mb-5">
                Ingresá el PIN de administrador para continuar.
              </p>

              {/* Círculos de dígitos */}
              <div className="flex gap-4 mb-5">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 ${
                      pinDigits.length > idx
                        ? 'bg-[#F2F2F2] border-[#F2F2F2]'
                        : 'border-[#9D9D9D]/50 bg-transparent'
                    } transition-all`}
                  />
                ))}
              </div>

              {/* Pantalla oculta del PIN */}
              <div className="w-full h-12 bg-[#080A0D] border border-[#9D9D9D]/15 rounded-lg flex items-center justify-center mb-6">
                <span className="text-xl text-[#F2F2F2] tracking-widest font-mono">
                  {pinDigits.map(() => '•').join('')}
                </span>
              </div>

              {/* Mensaje de Error en Modal */}
              {errorMsg && (
                <div className="w-full bg-[#E2484A]/10 border border-[#E2484A]/30 text-[#E2484A] text-xs py-2 px-3 rounded-lg mb-5 text-center font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Teclado numérico */}
              <div className="grid grid-cols-3 gap-3 w-full mb-6">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((val) => (
                  <button
                    key={val}
                    disabled={isSubmitting}
                    onClick={() => handleDigitClick(val)}
                    className="h-12 bg-[#080A0D]/50 hover:bg-[#080A0D] text-[#F2F2F2] rounded-lg font-mono text-lg font-bold transition-colors cursor-pointer disabled:opacity-50 select-none"
                  >
                    {val}
                  </button>
                ))}
                <button
                  disabled={isSubmitting}
                  onClick={handleClear}
                  className="h-12 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] transition-colors cursor-pointer select-none"
                >
                  Limpiar
                </button>
                <button
                  key="0"
                  disabled={isSubmitting}
                  onClick={() => handleDigitClick('0')}
                  className="h-12 bg-[#080A0D]/50 hover:bg-[#080A0D] text-[#F2F2F2] rounded-lg font-mono text-lg font-bold transition-colors cursor-pointer disabled:opacity-50 select-none"
                >
                  0
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={handleBackspace}
                  className="h-12 text-[#9D9D9D] hover:text-[#F2F2F2] flex items-center justify-center transition-colors cursor-pointer select-none"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414A2 2 0 0010.828 19h8.344a2 2 0 002-2V7a2 2 0 00-2-2h-8.344a2 2 0 00-1.414.586L3 12z" />
                  </svg>
                </button>
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setModalPinOpen(false)
                    setPinDigits([])
                    setErrorMsg('')
                  }}
                  className="flex-1 h-11 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#9D9D9D]/10 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] rounded-lg transition-colors cursor-pointer select-none uppercase tracking-wider disabled:opacity-50"
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

  // 3. JORNADA EN AUDITORIA (JornadaGuard — Admin — En auditoría)
  if (jornada.estado === 'en_auditoria') {
    return (
      <div className="flex-1 flex flex-col">
        {/* Barra de Título (56px) */}
        <div className="h-14 bg-[#080A0D] border-b border-[#9D9D9D]/10 flex items-center px-6 shrink-0">
          <h1 className="font-livvic text-lg font-bold text-[#F2F2F2]">
            Estado de Jornada
          </h1>
        </div>

        {/* Contenido Central */}
        <div className="flex-1 flex items-center justify-center p-6 relative">
          <div className="absolute inset-0 bg-phantom-pattern opacity-[0.02] pointer-events-none select-none" />

          {/* Tarjeta */}
          <div className="w-full max-w-[500px] bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-2xl p-8 flex flex-col items-center shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
            <div className="w-16 h-16 mb-6 flex items-center justify-center text-[#30CFF2]">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <h2 className="font-livvic text-2xl font-bold text-[#F2F2F2] mb-2 text-center">
              Terminal bloqueada
            </h2>
            <p className="font-livvic text-sm text-[#9D9D9D] mb-8 text-center max-w-[320px]">
              La jornada está en auditoría. Completá el cierre desde el menú Cierre.
            </p>

            <Link
              href="/admin/cierre"
              className="w-full h-12 bg-[#BA7517] hover:bg-[#BA7517]/90 text-[#F2F2F2] font-livvic text-sm font-bold uppercase tracking-wider rounded-lg shadow-lg flex items-center justify-center transition-colors cursor-pointer select-none active:scale-[0.99]"
            >
              Ir al cierre de caja →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 4. JORNADA ABIERTA (Caja del Día)
  const totalRecaudado = (resumen?.totalEfectivo || 0) + (resumen?.totalMp || 0)
  const totalComandas = (resumen?.cantEfectivo || 0) + (resumen?.cantMp || 0)

  return (
    <div className="flex-1 flex flex-col">
      {/* Barra de Título (56px) */}
      <div className="h-14 bg-[#080A0D] border-b border-[#9D9D9D]/10 flex items-center px-6 shrink-0 select-none">
        <h1 className="font-livvic text-lg font-bold text-[#F2F2F2]">
          Caja del Día
        </h1>
      </div>

      {/* Contenedor Naranja Principal */}
      <div className="flex-1 bg-[#F26A1B] p-6 flex flex-col gap-6 min-h-0 overflow-y-auto">
        
        {/* Tarjetas Superiores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 select-none">
          {/* Efectivo */}
          <div className="bg-[#1A1A1A] rounded-xl p-5 border border-[#9D9D9D]/10 shadow-[0_4px_15px_rgba(0,0,0,0.15)]">
            <span className="font-livvic text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider">
              Efectivo
            </span>
            <h2 className="font-livvic text-3xl font-bold text-[#1D9E75] mt-1.5">
              {formatearMoneda(resumen?.totalEfectivo || 0)}
            </h2>
            <span className="font-livvic text-xs text-[#9D9D9D] mt-1 block">
              {resumen?.cantEfectivo || 0} comandas
            </span>
          </div>

          {/* Mercado Pago */}
          <div className="bg-[#1A1A1A] rounded-xl p-5 border border-[#9D9D9D]/10 shadow-[0_4px_15px_rgba(0,0,0,0.15)]">
            <span className="font-livvic text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider">
              Mercado Pago
            </span>
            <h2 className="font-livvic text-3xl font-bold text-[#378ADD] mt-1.5">
              {formatearMoneda(resumen?.totalMp || 0)}
            </h2>
            <span className="font-livvic text-xs text-[#9D9D9D] mt-1 block">
              {resumen?.cantMp || 0} comandas
            </span>
          </div>

          {/* Total Recaudado */}
          <div className="bg-[#1A1A1A] rounded-xl p-5 border border-[#9D9D9D]/10 shadow-[0_4px_15px_rgba(0,0,0,0.15)]">
            <span className="font-livvic text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider">
              Total Recaudado
            </span>
            <h2 className="font-livvic text-3xl font-bold text-[#F2F2F2] mt-1.5">
              {formatearMoneda(totalRecaudado)}
            </h2>
            <span className="font-livvic text-xs text-[#9D9D9D] mt-1 block">
              {totalComandas} comandas enviadas
            </span>
          </div>
        </div>

        {/* Sección Comandas de la Noche */}
        <div className="flex-1 bg-[#1A1A1A] rounded-2xl p-6 border border-[#9D9D9D]/10 shadow-[0_10px_35px_rgba(0,0,0,0.2)] flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4 select-none">
            <h3 className="font-livvic text-sm font-bold uppercase tracking-wider text-[#F2F2F2]">
              Comandas de la Noche
            </h3>
            <span className="px-2.5 py-1 bg-[#080A0D]/50 border border-[#9D9D9D]/10 rounded text-[10px] font-bold text-[#9D9D9D] uppercase tracking-wide">
              Últimas 10
            </span>
          </div>

          {/* Grilla / Listado de Comandas */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1 flex flex-col">
            {comandas.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-[#9D9D9D]">
                <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span className="font-livvic text-sm">No se registraron comandas en esta jornada todavía.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 bg-[#080A0D]/20 rounded-lg overflow-hidden border border-[#9D9D9D]/5">
                {comandas.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#1A1A1A] border-b border-[#080A0D]/40 hover:bg-[#080A0D]/10 transition-colors last:border-b-0"
                  >
                    {/* Detalles izquierdos: Ticket y productos */}
                    <div className="flex items-start gap-4">
                      <span className="font-mono text-sm font-bold text-[#F26A1B] shrink-0 pt-0.5">
                        #{c.numeroTicket}
                      </span>
                      <p className="font-livvic text-sm text-[#F2F2F2] leading-relaxed">
                        {c.detalle}
                      </p>
                    </div>

                    {/* Detalles derechos: Medio de pago y total */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          c.medioPago === 'Efectivo'
                            ? 'bg-[#1D9E75]/10 border-[#1D9E75]/30 text-[#1D9E75]'
                            : 'bg-[#378ADD]/10 border-[#378ADD]/30 text-[#378ADD]'
                        }`}
                      >
                        {c.medioPago}
                      </span>
                      <span className="font-livvic text-sm font-bold text-[#F2F2F2] min-w-[80px] text-right">
                        {formatearMoneda(c.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Botón inferior para Ir al Cierre */}
        <div className="flex justify-end select-none">
          <Link
            href="/admin/cierre"
            className="px-6 h-12 bg-[#F2F2F2] hover:bg-[#F2F2F2]/90 text-[#080A0D] font-livvic text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg flex items-center justify-center transition-colors cursor-pointer select-none active:scale-[0.99]"
          >
            Ir al cierre de caja →
          </Link>
        </div>
      </div>
    </div>
  )
}
