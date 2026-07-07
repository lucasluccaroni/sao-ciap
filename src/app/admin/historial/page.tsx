'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { obtenerHistorialJornadas, obtenerDetalleHistorialJornada } from '@/app/actions/jornada'

export default function HistorialJornadasPage() {
  // Estados para el listado de jornadas
  const [jornadas, setJornadas] = useState<any[]>([])
  const [loadingJornadas, setLoadingJornadas] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Estados para la jornada seleccionada
  const [selectedJornadaId, setSelectedJornadaId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Pestaña activa del panel detalle
  const [activeTab, setActiveTab] = useState<'financiero' | 'inventario' | 'gastos' | 'comandas' | 'rendimiento'>('financiero')

  // Carga inicial del listado de jornadas
  const cargarJornadas = useCallback(async () => {
    setLoadingJornadas(true)
    try {
      const res = await obtenerHistorialJornadas()
      if (res.success && res.jornadas) {
        setJornadas(res.jornadas)
        // Seleccionar automáticamente la primera jornada si existe
        if (res.jornadas.length > 0 && !selectedJornadaId) {
          setSelectedJornadaId(res.jornadas[0].jornada_id)
        }
      } else {
        setErrorMsg(res.error || 'Error al cargar el historial.')
      }
    } catch (err) {
      setErrorMsg('Error de conexión con el servidor.')
    } finally {
      setLoadingJornadas(false)
    }
  }, [selectedJornadaId])

  useEffect(() => {
    cargarJornadas()
  }, [cargarJornadas])

  // Carga del detalle cuando cambia la jornada seleccionada
  const cargarDetalle = useCallback(async (id: string) => {
    setLoadingDetail(true)
    setErrorMsg('')
    try {
      const res = await obtenerDetalleHistorialJornada(id)
      if (res.success) {
        setDetalle(res)
      } else {
        setErrorMsg(res.error || 'Error al cargar el detalle de la jornada.')
      }
    } catch (err) {
      setErrorMsg('Error de conexión con el servidor.')
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (selectedJornadaId) {
      cargarDetalle(selectedJornadaId)
    }
  }, [selectedJornadaId, cargarDetalle])

  // Filtrado de jornadas por fecha en el cliente
  const jornadasFiltradas = jornadas.filter((j) => {
    const fechaJornada = new Date(j.fecha_inicio)
    
    let matchesDate = true
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      matchesDate = matchesDate && fechaJornada >= start
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      matchesDate = matchesDate && fechaJornada <= end
    }

    return matchesDate
  })

  // Utilidades de formato
  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(valor)
  }

  const formatearFechaHora = (fechaString: string | null) => {
    if (!fechaString) return '-'
    const date = new Date(fechaString)
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const obtenerAliasJornada = (jornada: any) => {
    const date = new Date(jornada.fecha_inicio)
    const dia = String(date.getDate()).padStart(2, '0')
    const mes = String(date.getMonth() + 1).padStart(2, '0')
    const anio = date.getFullYear()
    return `Jornada ${dia}/${mes}/${anio}`
  }

  // Conciliación de Mercado Pago
  const totalMpLista = detalle?.jornada?.total_mp_lista ? Number(detalle.jornada.total_mp_lista) : 0
  const totalMpReal = detalle?.jornada?.total_mp_real ? Number(detalle.jornada.total_mp_real) : 0
  const comisionMp = detalle?.jornada?.comision_mp ? Number(detalle.jornada.comision_mp) : 0
  
  const porcentajeDiferenciaMp = totalMpLista > 0 
    ? (Math.abs(comisionMp) / totalMpLista) * 100 
    : 0
  
  const alertaComisionSuperada = porcentajeDiferenciaMp > 10

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0 select-none bg-[#F26A1B] overflow-hidden font-livvic">
      
      {/* Contenedor Principal Oscuro Flotante (Siguiendo estética del panel ABM) */}
      <div className="flex-1 flex flex-col lg:flex-row bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl min-h-0 overflow-hidden">
        
        {/* 1. COLUMNA IZQUIERDA: Listado y Filtros (Master - Azul Pizarra con tintes cian) */}
        <div className="w-full lg:w-[320px] border-b lg:border-b-0 lg:border-r border-[#9D9D9D]/15 flex flex-col min-h-0 bg-[#112028] p-4 shrink-0">
          
          {/* Barra de Filtros */}
          <div className="pb-4 border-b border-[#9D9D9D]/15 flex flex-col gap-3 shrink-0">
            <h2 className="font-bold text-2xl text-[#F2F2F2] tracking-wide uppercase select-none">
              Historial
            </h2>
            
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-semibold text-[#9D9D9D] tracking-wider">Desde</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9 px-2 bg-[#0B151A] border border-[#9D9D9D]/20 rounded text-xs text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2] transition-colors scheme-dark"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-semibold text-[#9D9D9D] tracking-wider">Hasta</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-9 px-2 bg-[#0B151A] border border-[#9D9D9D]/20 rounded text-xs text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2] transition-colors scheme-dark"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Listado de Jornadas */}
          <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-[#9D9D9D]/10">
            {loadingJornadas ? (
              <div className="p-8 text-center text-[#9D9D9D] text-sm animate-pulse">
                Cargando historial...
              </div>
            ) : jornadasFiltradas.length === 0 ? (
              <div className="p-8 text-center text-[#9D9D9D] text-sm">
                No se encontraron jornadas.
              </div>
            ) : (
              jornadasFiltradas.map((j) => {
                const selected = selectedJornadaId === j.jornada_id
                const esCerrada = j.estado === 'cerrada'
                
                return (
                  <button
                    key={j.jornada_id}
                    onClick={() => setSelectedJornadaId(j.jornada_id)}
                    className={`w-full text-left py-4 px-3 rounded-lg mt-2 transition-all flex flex-col gap-2 ${
                      selected 
                        ? 'bg-[#1C2C35] border-l-4 border-[#30CFF2]' 
                        : 'hover:bg-[#1C2C35]/50 border-l-4 border-transparent bg-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-semibold text-sm text-[#F2F2F2]">
                        {obtenerAliasJornada(j)}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                        esCerrada 
                          ? 'bg-[#1D9E75]/20 text-[#1D9E75]' 
                          : j.estado === 'en_auditoria' 
                            ? 'bg-[#BA7517]/20 text-[#BA7517]'
                            : 'bg-[#30CFF2]/20 text-[#30CFF2]'
                      }`}>
                        {j.estado}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-[#9D9D9D] w-full">
                      <span>Inicio: {formatearFechaHora(j.fecha_inicio)}</span>
                    </div>

                    {esCerrada && (
                      <div className="flex justify-between items-center w-full mt-1 text-xs border-t border-[#9D9D9D]/10 pt-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-[#9D9D9D] uppercase font-semibold">Facturado</span>
                          <span className="font-medium text-[#F2F2F2]">{formatearMoneda(Number(j.total_general))}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] text-[#9D9D9D] uppercase font-semibold">Ganancia Neta</span>
                          <span className={`font-bold ${Number(j.ganancia_neta) >= 0 ? 'text-[#1D9E75]' : 'text-[#E2484A]'}`}>
                            {formatearMoneda(Number(j.ganancia_neta))}
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* 2. COLUMNA DERECHA: Detalle de Jornada (Detail - Gris Cálido Ceniza #1D1816) */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#1D1816] p-6">
          {errorMsg && (
            <div className="p-4 bg-[#E2484A]/10 border border-[#E2484A]/30 text-[#E2484A] text-xs font-semibold rounded-lg mb-4 select-none">
              {errorMsg}
            </div>
          )}

          {!selectedJornadaId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 select-none">
              <h3 className="font-bold text-3xl text-[#9D9D9D]/30 tracking-wider text-center">
                SELECCIONA UNA JORNADA
              </h3>
              <p className="font-livvic text-xs text-[#9D9D9D]/40 uppercase mt-2 tracking-widest">
                Para visualizar balances e informes
              </p>
            </div>
          ) : loadingDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 select-none">
              <div className="w-12 h-12 border-4 border-t-[#F26A1B] border-r-transparent border-b-[#F26A1B] border-l-transparent rounded-full animate-spin"></div>
              <p className="font-livvic text-xs text-[#9D9D9D]/60 uppercase mt-4 tracking-widest animate-pulse">
                Recuperando auditoría...
              </p>
            </div>
          ) : !detalle ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-[#9D9D9D]">
              No se pudo obtener el detalle de la jornada.
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Cabecera del Detalle */}
              <div className="pb-6 border-b border-[#9D9D9D]/15 shrink-0 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                  <h1 className="font-bold text-3xl text-[#F2F2F2] tracking-wide uppercase">
                    {obtenerAliasJornada(detalle.jornada)}
                  </h1>
                  <div className="text-xs text-[#9D9D9D] mt-1.5 flex flex-col gap-0.5 md:flex-row md:gap-4 uppercase font-semibold">
                    <span>Apertura: <span className="text-[#F2F2F2]">{formatearFechaHora(detalle.jornada.fecha_inicio)}</span></span>
                    {detalle.jornada.fecha_fin && (
                      <span>Cierre: <span className="text-[#F2F2F2]">{formatearFechaHora(detalle.jornada.fecha_fin)}</span></span>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => cargarDetalle(selectedJornadaId)}
                  className="self-start md:self-auto h-9 px-4 bg-[#251F1C] border border-[#9D9D9D]/20 rounded text-xs font-semibold uppercase hover:bg-[#2F2724] text-[#F2F2F2] tracking-wider transition-colors cursor-pointer"
                >
                  Actualizar Datos
                </button>
              </div>

              {/* Menú de Pestañas de Detalle */}
              <div className="border-b border-[#9D9D9D]/15 shrink-0">
                <div className="flex gap-6 h-12 text-xs uppercase font-bold tracking-wider">
                  <button
                    onClick={() => setActiveTab('financiero')}
                    className={`h-full relative flex items-center transition-colors cursor-pointer ${
                      activeTab === 'financiero' ? 'text-[#F26A1B]' : 'text-[#9D9D9D] hover:text-[#F2F2F2]'
                    }`}
                  >
                    Balance Financiero
                    {activeTab === 'financiero' && (
                      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#F26A1B]" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('inventario')}
                    className={`h-full relative flex items-center transition-colors cursor-pointer ${
                      activeTab === 'inventario' ? 'text-[#F26A1B]' : 'text-[#9D9D9D] hover:text-[#F2F2F2]'
                    }`}
                  >
                    Control de Stock
                    {activeTab === 'inventario' && (
                      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#F26A1B]" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('gastos')}
                    className={`h-full relative flex items-center transition-colors cursor-pointer ${
                      activeTab === 'gastos' ? 'text-[#F26A1B]' : 'text-[#9D9D9D] hover:text-[#F2F2F2]'
                    }`}
                  >
                    Gastos ({detalle.gastos.length})
                    {activeTab === 'gastos' && (
                      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#F26A1B]" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('comandas')}
                    className={`h-full relative flex items-center transition-colors cursor-pointer ${
                      activeTab === 'comandas' ? 'text-[#F26A1B]' : 'text-[#9D9D9D] hover:text-[#F2F2F2]'
                    }`}
                  >
                    Ventas ({detalle.comandas.length})
                    {activeTab === 'comandas' && (
                      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#F26A1B]" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('rendimiento')}
                    className={`h-full relative flex items-center transition-colors cursor-pointer ${
                      activeTab === 'rendimiento' ? 'text-[#F26A1B]' : 'text-[#9D9D9D] hover:text-[#F2F2F2]'
                    }`}
                  >
                    Rendimiento
                    {activeTab === 'rendimiento' && (
                      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#F26A1B]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Contenido Dinámico de la Pestaña */}
              <div className="flex-1 overflow-y-auto pt-6 min-h-0">
                
                {/* PESTAÑA A: BALANCE FINANCIERO */}
                {activeTab === 'financiero' && (
                  <div className="flex flex-col gap-6">
                    {/* Tarjetas Principales (Gris Ocre Oscuro #251F1C) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl p-5 flex flex-col gap-1 shadow-md">
                        <span className="text-[10px] text-[#9D9D9D] font-bold uppercase tracking-wider">Ingreso Efectivo</span>
                        <span className="font-semibold text-2xl text-[#1D9E75]">{formatearMoneda(Number(detalle.jornada.total_efectivo))}</span>
                      </div>
                      <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl p-5 flex flex-col gap-1 shadow-md">
                        <span className="text-[10px] text-[#9D9D9D] font-bold uppercase tracking-wider">Ingreso MP (Real)</span>
                        <span className="font-semibold text-2xl text-[#378ADD]">{formatearMoneda(Number(detalle.jornada.total_mp_real))}</span>
                      </div>
                      <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl p-5 flex flex-col gap-1 shadow-md">
                        <span className="text-[10px] text-[#9D9D9D] font-bold uppercase tracking-wider">Gastos Registrados</span>
                        <span className="font-semibold text-2xl text-[#E2484A]">{formatearMoneda(Number(detalle.jornada.gastos_totales))}</span>
                      </div>
                      <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl p-5 flex flex-col gap-1 shadow-md">
                        <span className="text-[10px] text-[#9D9D9D] font-bold uppercase tracking-wider">Ganancia Neta</span>
                        <span className={`font-bold text-2xl ${Number(detalle.jornada.ganancia_neta) >= 0 ? 'text-[#30CFF2]' : 'text-[#E2484A]'}`}>
                          {formatearMoneda(Number(detalle.jornada.ganancia_neta))}
                        </span>
                      </div>
                    </div>

                    {/* Conciliación Mercado Pago */}
                    <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl p-6 flex flex-col gap-4 shadow-md">
                      <h3 className="font-bold text-sm uppercase text-[#F2F2F2] border-b border-[#9D9D9D]/10 pb-2">
                        Conciliación de Mercado Pago (Auditoría de Comisiones)
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-[#9D9D9D] uppercase font-semibold">Ventas por MP (Teórico de Lista)</span>
                          <span className="font-semibold text-lg text-[#F2F2F2]">{formatearMoneda(totalMpLista)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-[#9D9D9D] uppercase font-semibold">Acreditación Reportada (Posnet Real)</span>
                          <span className="font-semibold text-lg text-[#F2F2F2]">{formatearMoneda(totalMpReal)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-[#9D9D9D] uppercase font-semibold">Comisión y Desvíos Calculados</span>
                          <span className={`font-bold text-lg ${comisionMp >= 0 ? 'text-[#BA7517]' : 'text-[#1D9E75]'}`}>
                            {formatearMoneda(comisionMp)}
                            <span className="text-xs font-normal ml-2 text-[#9D9D9D]">
                              ({porcentajeDiferenciaMp.toFixed(1)}%)
                            </span>
                          </span>
                        </div>
                      </div>

                      {alertaComisionSuperada && (
                        <div className="bg-[#BA7517]/10 border border-[#BA7517]/30 text-[#BA7517] font-semibold text-xs py-3 px-4 rounded-lg flex items-center gap-3 mt-2">
                          <svg className="w-5 h-5 shrink-0 text-[#BA7517]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <span className="font-bold">Advertencia crítica de conciliación:</span> La diferencia reportada de Mercado Pago ({porcentajeDiferenciaMp.toFixed(1)}%) excede el límite de tolerancia del 10%. Esto puede indicar recargos no registrados, devoluciones, fallas en el reporte de caja o posible desvío financiero.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PESTAÑA B: INVENTARIO (CONTROL DE STOCK) */}
                {activeTab === 'inventario' && (
                  <div className="flex flex-col gap-4">
                    <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl overflow-hidden shadow-md">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1D1816] border-b border-[#9D9D9D]/15 text-[#9D9D9D] uppercase tracking-wider font-bold">
                            <tr>
                              <th className="py-3 px-4">Producto</th>
                              <th className="py-3 px-4 text-center">Stock Inicial</th>
                              <th className="py-3 px-4 text-center">Unidades Utilizadas</th>
                              <th className="py-3 px-4 text-center">Stock Teórico</th>
                              <th className="py-3 px-4 text-center">Conteo Físico Real</th>
                              <th className="py-3 px-4 text-center">Desvío</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#9D9D9D]/10">
                            {detalle.auditoria.map((item: any) => {
                              const tieneDesvio = item.desvio !== 0
                              return (
                                <tr
                                  key={item.id}
                                  className={`transition-colors ${
                                    tieneDesvio 
                                      ? 'bg-[#E2484A]/10 hover:bg-[#E2484A]/15' 
                                      : 'hover:bg-[#2F2724]'
                                  }`}
                                >
                                  <td className="py-3.5 px-4 font-semibold text-[#F2F2F2]">{item.nombre}</td>
                                  <td className="py-3.5 px-4 text-center font-medium text-[#9D9D9D]">{item.stockInicial}</td>
                                  <td className="py-3.5 px-4 text-center font-medium text-[#F2F2F2]">{item.unidadesUtilizadas}</td>
                                  <td className="py-3.5 px-4 text-center font-medium text-[#9D9D9D]">{item.stockTeorico}</td>
                                  <td className="py-3.5 px-4 text-center font-semibold text-[#F2F2F2]">{item.conteoFisico}</td>
                                  <td className={`py-3.5 px-4 text-center font-bold ${
                                    tieneDesvio ? 'text-[#E2484A]' : 'text-[#1D9E75]'
                                  }`}>
                                    {item.desvio > 0 ? `+${item.desvio}` : item.desvio}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* PESTAÑA C: GASTOS */}
                {activeTab === 'gastos' && (
                  <div className="flex flex-col gap-4">
                    {detalle.gastos.length === 0 ? (
                      <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl p-8 text-center text-[#9D9D9D] text-sm">
                        No se registraron gastos operativos en esta jornada.
                      </div>
                    ) : (
                      <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl overflow-hidden shadow-md">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1D1816] border-b border-[#9D9D9D]/15 text-[#9D9D9D] uppercase tracking-wider font-bold">
                            <tr>
                              <th className="py-3 px-4">Categoría</th>
                              <th className="py-3 px-4">Descripción</th>
                              <th className="py-3 px-4 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#9D9D9D]/10 text-[#F2F2F2] font-medium">
                            {detalle.gastos.map((g: any) => (
                              <tr key={g.id} className="hover:bg-[#2F2724] transition-colors">
                                <td className="py-3.5 px-4 text-[#30CFF2] uppercase font-semibold tracking-wider text-[10px]">{g.categoria}</td>
                                <td className="py-3.5 px-4">{g.descripcion}</td>
                                <td className="py-3.5 px-4 text-right font-semibold text-[#E2484A]">{formatearMoneda(g.monto)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-[#1D1816] border-t border-[#9D9D9D]/15 font-bold">
                            <tr>
                              <td colSpan={2} className="py-3.5 px-4 text-[#9D9D9D] uppercase text-[10px]">Total Gastos Operativos</td>
                              <td className="py-3.5 px-4 text-right text-[#E2484A] text-sm">{formatearMoneda(Number(detalle.jornada.gastos_totales))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* PESTAÑA D: VENTAS (COMANDAS) */}
                {activeTab === 'comandas' && (
                  <div className="flex flex-col gap-4">
                    {detalle.comandas.length === 0 ? (
                      <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl p-8 text-center text-[#9D9D9D] text-sm">
                        No se registraron comandas en esta jornada.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {detalle.comandas.map((c: any) => (
                          <div
                            key={c.id}
                            className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:border-[#9D9D9D]/25 transition-all animate-fadeIn"
                          >
                            <div className="flex justify-between items-center w-full pb-2 border-b border-[#9D9D9D]/10">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-base text-[#F2F2F2] tracking-wide">
                                  Ticket #{c.numeroTicket}
                                </span>
                                {c.beeper && (
                                  <span className="bg-[#BA7517]/20 text-[#BA7517] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                    Beeper {c.beeper}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-[#9D9D9D] font-semibold">
                                {formatearFechaHora(c.fecha)}
                              </span>
                            </div>

                            {/* Items de Comanda */}
                            <div className="flex flex-col gap-1.5 text-xs text-[#F2F2F2]">
                              {c.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center w-full font-medium">
                                  <span>{item.nombre} <span className="text-[#9D9D9D]">× {item.cantidad}</span></span>
                                  <span className="text-[#9D9D9D]">{formatearMoneda(item.precio * item.cantidad)}</span>
                                </div>
                              ))}
                            </div>

                            <div className="flex justify-between items-center w-full pt-2 border-t border-[#9D9D9D]/10">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                c.medioPago === 'Efectivo' 
                                  ? 'bg-[#1D9E75]/20 text-[#1D9E75]' 
                                  : 'bg-[#378ADD]/20 text-[#378ADD]'
                              }`}>
                                {c.medioPago}
                              </span>
                              <div className="flex flex-col text-right">
                                <span className="text-[9px] uppercase font-semibold text-[#9D9D9D]">Total Cobrado</span>
                                <span className="font-bold text-[#F2F2F2] text-sm">{formatearMoneda(c.total)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* PESTAÑA E: RENDIMIENTO DE VENTAS */}
                {activeTab === 'rendimiento' && (
                  <div className="flex flex-col gap-4">
                    {!detalle.rendimiento || detalle.rendimiento.length === 0 ? (
                      <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl p-8 text-center text-[#9D9D9D] text-sm">
                        No se registraron ventas de productos en esta jornada.
                      </div>
                    ) : (
                      <div className="bg-[#251F1C] border border-[#9D9D9D]/15 rounded-xl overflow-hidden shadow-md">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#1D1816] border-b border-[#9D9D9D]/15 text-[#9D9D9D] uppercase tracking-wider font-bold">
                              <tr>
                                <th className="py-3 px-4">Producto</th>
                                <th className="py-3 px-4">Categoría</th>
                                <th className="py-3 px-4 text-center">Unidades Vendidas</th>
                                <th className="py-3 px-4 text-right">Total Recaudado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#9D9D9D]/10 text-[#F2F2F2] font-medium">
                              {detalle.rendimiento.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-[#2F2724] transition-colors">
                                  <td className="py-3.5 px-4 font-semibold text-[#F2F2F2]">{item.nombre}</td>
                                  <td className="py-3.5 px-4 text-[#30CFF2] uppercase font-semibold tracking-wider text-[10px]">{item.categoria}</td>
                                  <td className="py-3.5 px-4 text-center font-bold text-[#F2F2F2]">{item.cantidad}</td>
                                  <td className="py-3.5 px-4 text-right font-semibold text-[#1D9E75]">{formatearMoneda(item.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
