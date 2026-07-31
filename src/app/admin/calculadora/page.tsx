'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { obtenerProductos } from '@/app/actions/productos'

interface InsumoFila {
  id: string
  nombre: string
  cantidad: number
  precioUnitario: number
}

export default function CalculadoraCostosPage() {
  const [filas, setFilas] = useState<InsumoFila[]>([
    { id: '1', nombre: '', cantidad: 0, precioUnitario: 0 }
  ])
  const [productosCatalogo, setProductosCatalogo] = useState<string[]>([])
  const [activeInputId, setActiveInputId] = useState<string | null>(null)
  const [dropdownFiltrado, setDropdownFiltrado] = useState<string[]>([])
  const [fechaImpresion, setFechaImpresion] = useState('')
  const [horaImpresion, setHoraImpresion] = useState('')

  // Carga de catálogo real para el autocompletado sugerido
  const cargarCatalogo = useCallback(async () => {
    try {
      const res = await obtenerProductos()
      if (res.success && res.productos) {
        // Mapear sólo los nombres de los productos activos
        const nombres = res.productos
          .filter((p) => p.activo)
          .map((p) => p.nombre)
        setProductosCatalogo(nombres)
      }
    } catch (err) {
      console.error('Error al cargar catálogo de autocompletado:', err)
    }
  }, [])

  useEffect(() => {
    cargarCatalogo()
  }, [cargarCatalogo])

  // Actualizar metadatos de impresión del cliente en caliente antes de imprimir
  const prepararMetadatosImpresion = () => {
    const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
    const fecha = new Date()
    const diaSemana = dias[fecha.getDay()]
    const diaMes = String(fecha.getDate()).padStart(2, '0')
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const anio = fecha.getFullYear()
    
    setFechaImpresion(`${diaSemana} ${diaMes}/${mes}/${anio}`)
    
    const hora = String(fecha.getHours()).padStart(2, '0')
    const minuto = String(fecha.getMinutes()).padStart(2, '0')
    setHoraImpresion(`${hora}:${minuto}`)
  }

  // Agregar fila
  const agregarFila = () => {
    const nuevoId = Math.random().toString(36).substring(2, 9)
    setFilas([...filas, { id: nuevoId, nombre: '', cantidad: 0, precioUnitario: 0 }])
  }

  // Eliminar fila
  const eliminarFila = (id: string) => {
    if (filas.length === 1) {
      setFilas([{ id: '1', nombre: '', cantidad: 0, precioUnitario: 0 }])
      return
    }
    setFilas(filas.filter((f) => f.id !== id))
  }

  // Modificar campo de fila
  const manejarCambio = (id: string, campo: keyof InsumoFila, valor: any) => {
    setFilas(
      filas.map((f) => {
        if (f.id === id) {
          const nuevaFila = { ...f, [campo]: valor }
          
          // Lógica de autocompletado sugerido al escribir el nombre
          if (campo === 'nombre') {
            const query = String(valor).toLowerCase()
            if (query.trim()) {
              const filtrados = productosCatalogo.filter((p) =>
                p.toLowerCase().includes(query)
              )
              setDropdownFiltrado(filtrados)
            } else {
              setDropdownFiltrado([])
            }
          }
          return nuevaFila
        }
        return f
      })
    )
  }

  // Seleccionar sugerencia del dropdown
  const seleccionarSugerencia = (id: string, nombre: string) => {
    setFilas(
      filas.map((f) => {
        if (f.id === id) {
          return { ...f, nombre }
        }
        return f
      })
    )
    setActiveInputId(null)
    setDropdownFiltrado([])
  }

  // Cierre de dropdown si hace clic afuera
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveInputId(null)
      setDropdownFiltrado([])
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // Calcular totales
  const calcularSubtotal = (fila: InsumoFila) => {
    return fila.cantidad * fila.precioUnitario
  }

  const calcularTotalGeneral = () => {
    return filas.reduce((acc, f) => acc + calcularSubtotal(f), 0)
  }

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor)
  }

  const manejarImprimir = () => {
    prepararMetadatosImpresion()
    // Pequeño timeout para que el render del DOM alcance a dibujar las variables de fecha/hora antes del window.print
    setTimeout(() => {
      window.print()
    }, 100)
  }

  const totalGeneral = calcularTotalGeneral()

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0 bg-[#F26A1B] overflow-y-auto font-livvic print:bg-white print:p-10 print:text-black">
      
      {/* =======================================================================
          A. ENCABEZADO EXCLUSIVO DE IMPRESIÓN (A4 - Wireframe 24)
          ======================================================================= */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-[#F26A1B] pb-4 mb-6 select-none">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full border-2 border-[#F26A1B] flex items-center justify-center p-0.5 bg-white print:bg-white">
            <Image
              src="/images/sao-logo.png"
              alt="Logo SAO Bar"
              width={38}
              height={38}
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="font-bold text-2xl text-black leading-tight">
              Calculadora de Costos
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Simulación de costos de insumos — documento no oficial
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 font-medium">
          <div>{fechaImpresion || 'Documento de Simulación'}</div>
          <div className="mt-1">Impreso a las {horaImpresion || '--:--'}</div>
        </div>
      </div>

      {/* Titulo en pantalla */}
      <div className="mb-4 flex items-center gap-3 shrink-0 print:hidden select-none">
        <h1 className="font-bold text-3xl text-[#F2F2F2] tracking-wide uppercase">
          Calculadora de costos
        </h1>
      </div>

      {/* Tarjeta Central Oscura */}
      <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col min-h-0 print:bg-white print:border-none print:shadow-none print:p-0">
        
        {/* Observación cursiva simple (Simulación) */}
        <p className="text-xs text-[#9D9D9D] italic mb-6 print:hidden select-none">
          Aviso: Esta calculadora es una herramienta de simulación.
        </p>

        {/* Grilla de Insumos */}
        <div className="overflow-x-auto min-h-0 flex-1">
          <table className="w-full text-left text-xs border-collapse print:text-black">
            <thead className="bg-[#1D1816] text-[#9D9D9D] uppercase tracking-wider font-bold select-none print:bg-gray-100 print:text-black print:border-b print:border-gray-300">
              <tr>
                <th className="py-3 px-4 w-[40%] print:border-r print:border-gray-300">Nombre del Insumo</th>
                <th className="py-3 px-4 text-center w-[15%] print:border-r print:border-gray-300">Cantidad</th>
                <th className="py-3 px-4 text-center w-[20%] print:border-r print:border-gray-300">Precio Unitario</th>
                <th className="py-3 px-4 text-right w-[20%] print:border-r print:border-gray-300">Subtotal</th>
                <th className="py-3 px-4 text-center w-[5%] print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#9D9D9D]/10 print:divide-y print:divide-gray-200">
              {filas.map((fila) => (
                <tr key={fila.id} className="hover:bg-[#251F1C]/40 transition-colors print:bg-white print:hover:bg-transparent">
                  
                  {/* Nombre Insumo */}
                  <td className="py-3 px-4 print:border-r print:border-gray-200 print:py-2">
                    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={fila.nombre}
                        onChange={(e) => manejarCambio(fila.id, 'nombre', e.target.value)}
                        onFocus={() => setActiveInputId(fila.id)}
                        placeholder="ingrese insumos aqui"
                        className="w-full h-10 px-3 bg-transparent border border-[#9D9D9D]/20 rounded text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2] transition-colors print:border-none print:text-black print:px-0 print:h-auto print:pointer-events-none"
                      />
                      
                      {/* Dropdown de Autocompletado */}
                      {activeInputId === fila.id && dropdownFiltrado.length > 0 && (
                        <div className="absolute top-11 left-0 w-full max-h-48 overflow-y-auto bg-[#1A1A1A] border border-[#9D9D9D]/25 rounded-lg shadow-2xl z-40 print:hidden divide-y divide-[#9D9D9D]/10">
                          {dropdownFiltrado.map((nombreSugerido, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => seleccionarSugerencia(fila.id, nombreSugerido)}
                              className="w-full text-left py-2.5 px-3 hover:bg-[#2F2724] text-[#F2F2F2] font-medium text-xs transition-colors cursor-pointer"
                            >
                              {nombreSugerido}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Cantidad */}
                  <td className="py-3 px-4 text-center print:border-r print:border-gray-200 print:py-2">
                    <input
                      type="number"
                      min={0}
                      value={fila.cantidad || ''}
                      onChange={(e) => manejarCambio(fila.id, 'cantidad', Number(e.target.value))}
                      placeholder="0"
                      className="w-20 h-10 text-center bg-transparent border border-[#9D9D9D]/20 rounded text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none print:border-none print:text-black print:px-0 print:h-auto print:pointer-events-none"
                    />
                  </td>

                  {/* Precio Unitario */}
                  <td className="py-3 px-4 text-center print:border-r print:border-gray-200 print:py-2">
                    <div className="relative inline-block w-full">
                      <span className="absolute left-3 top-2.5 text-[#9D9D9D] print:hidden">$</span>
                      <input
                        type="number"
                        min={0}
                        value={fila.precioUnitario || ''}
                        onChange={(e) => manejarCambio(fila.id, 'precioUnitario', Number(e.target.value))}
                        placeholder="0"
                        className="w-full h-10 pl-6 pr-2 text-left bg-transparent border border-[#9D9D9D]/20 rounded text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none print:hidden"
                      />
                      {/* Formato imprimible para precio unitario (reemplaza al input en PDF) */}
                      <span className="hidden print:inline text-black">
                        {formatearMoneda(fila.precioUnitario)}
                      </span>
                    </div>
                  </td>

                  {/* Subtotal */}
                  <td className="py-3 px-4 text-right font-semibold text-[#F2F2F2] print:border-r print:border-gray-200 print:text-black print:py-2">
                    {formatearMoneda(calcularSubtotal(fila))}
                  </td>

                  {/* Acciones */}
                  <td className="py-3 px-4 text-center print:hidden">
                    <button
                      type="button"
                      onClick={() => eliminarFila(fila.id)}
                      className="w-8 h-8 rounded-lg border border-[#E2484A]/30 text-[#E2484A] hover:bg-[#E2484A]/10 flex items-center justify-center transition-colors cursor-pointer"
                      title="Eliminar fila"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Botón Agregar Insumo en Pantalla */}
        <div className="mt-4 print:hidden">
          <button
            type="button"
            onClick={agregarFila}
            className="w-full h-11 border border-dashed border-[#9D9D9D]/20 rounded-xl text-xs font-semibold uppercase text-[#9D9D9D] hover:text-[#F2F2F2] hover:border-[#F2F2F2]/30 flex items-center justify-center gap-2 transition-all cursor-pointer select-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Agregar insumo
          </button>
        </div>

        {/* Footer de Totales y Guardado */}
        <div className="mt-6 bg-[#131313]/90 border border-white/5 p-5 flex justify-between items-center rounded-xl print:bg-transparent print:border-t-2 print:border-black print:rounded-none print:shadow-none print:p-2 print:mt-0 select-none">
          <div className="flex flex-col gap-0.5 print:flex-row print:justify-between print:w-full print:items-center">
            <span className="text-[10px] text-[#9D9D9D] uppercase font-bold tracking-wider print:text-black print:text-xs">
              Total General
            </span>
            <div className="flex items-baseline gap-3 print:inline-block">
              <span className="font-bold text-2xl text-[#30CFF2] tracking-wide print:text-black print:text-xl">
                {formatearMoneda(totalGeneral)}
              </span>
              <span className="text-[10px] text-[#9D9D9D] tracking-wide uppercase font-semibold print:hidden">
                Los datos se perderán al navegar fuera de este módulo.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={manejarImprimir}
            className="h-11 px-6 bg-[#F2F2F2] text-[#080A0D] border border-transparent rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#30CFF2] hover:text-[#080A0D] transition-colors cursor-pointer select-none print:hidden shadow-lg"
          >
            Guardar / Imprimir
          </button>
        </div>

        {/* =======================================================================
            B. COMPONENTES EXCLUSIVOS DE IMPRESIÓN (A4 - Wireframe 24)
            ======================================================================= */}
        {/* Pie de página institucional */}
        <div className="hidden print:block text-[9px] text-gray-400 mt-28 text-center border-t border-gray-200 pt-4 font-medium select-none">
          <div>
            Este documento es una simulación generada por la Calculadora de Costos de SAO Bar.
          </div>
        </div>

      </div>
    </div>
  )
}
