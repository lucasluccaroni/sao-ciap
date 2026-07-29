'use client'

import React, { useState, useEffect } from 'react'
import {
  obtenerProductos,
  crearProducto,
  actualizarProducto,
  cambiarEstadoProducto,
  obtenerCategorias,
  crearCategoria,
  actualizarCategoria,
  cambiarEstadoCategoria
} from '@/app/actions/productos'

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
  insumo_compartido_id?: string | null
  Categorias_Productos?: {
    nombre: string
    color_fondo: string
    color_texto: string
  }
}

export default function ProductosPage() {
  // Estados de datos
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'insumos' | 'productos' | 'elaboracion'>('todos')

  // Modales de Productos
  const [modalProdOpen, setModalProdOpen] = useState(false)
  const [prodEditando, setProdEditando] = useState<Producto | null>(null) // null = Crear, Producto = Editar
  const [prodErrorMsg, setProdErrorMsg] = useState('')
  const [prodForm, setProdForm] = useState({
    nombre: '',
    categoria_id: '',
    precio: '',
    stockInicial: '',
    stockActual: '',
    stockIdeal: '',
    unidad: 'u' as 'u' | 'lt' | 'ml',
    activo: true,
    vendible: true,
    controla_stock: true,
    insumo_compartido_id: ''
  })

  // Modal Confirmar Baja Producto
  const [modalBajaOpen, setModalBajaOpen] = useState(false)
  const [prodBajaTarget, setProdBajaTarget] = useState<Producto | null>(null)

  // Modales de Categorías
  const [modalCatOpen, setModalCatOpen] = useState(false)
  const [catEditando, setCatEditando] = useState<Categoria | null>(null)
  const [catForm, setCatForm] = useState({
    nombre: '',
    color_fondo: '#1F2937',
    color_texto: '#FFFFFF'
  })
  const [catErrorMsg, setCatErrorMsg] = useState('')

  // Cargar datos al montar el componente
  const cargarDatos = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [resProd, resCat] = await Promise.all([
        obtenerProductos(),
        obtenerCategorias()
      ])

      if (resProd.success && resProd.productos) {
        setProductos(resProd.productos as Producto[])
      } else {
        setErrorMsg(resProd.error || 'Error al obtener productos.')
      }

      if (resCat.success && resCat.categorias) {
        setCategorias(resCat.categorias as Categoria[])
      } else {
        setErrorMsg(prev => prev || resCat.error || 'Error al obtener categorias.')
      }
    } catch (err: any) {
      setErrorMsg('Error de red al conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  // Mostrar mensaje de exito temporal
  const mostrarExito = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => {
      setSuccessMsg('')
    }, 4000)
  }

  // ============================================================================
  // MANEJO DE PRODUCTOS
  // ============================================================================

  const abrirCrearProducto = () => {
    setProdEditando(null)
    setProdErrorMsg('')
    setProdForm({
      nombre: '',
      categoria_id: categorias.filter(c => c.activo)[0]?.id || '',
      precio: '',
      stockInicial: '0',
      stockActual: '0',
      stockIdeal: '0',
      unidad: 'u',
      activo: true,
      vendible: true,
      controla_stock: true,
      insumo_compartido_id: ''
    })
    setModalProdOpen(true)
  }

  const abrirEditarProducto = (prod: Producto) => {
    setProdEditando(prod)
    setProdErrorMsg('')
    setProdForm({
      nombre: prod.nombre,
      categoria_id: prod.categoria_id,
      precio: prod.precio.toString(),
      stockInicial: prod.stockInicial.toString(),
      stockActual: prod.stockActual.toString(),
      stockIdeal: prod.stockIdeal.toString(),
      unidad: prod.unidad,
      activo: prod.activo,
      vendible: prod.vendible,
      controla_stock: prod.controla_stock,
      insumo_compartido_id: prod.insumo_compartido_id || ''
    })
    setModalProdOpen(true)
  }

  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault()
    setProdErrorMsg('')

    if (!prodForm.nombre.trim()) {
      setProdErrorMsg('El nombre del producto es obligatorio.')
      return
    }
    if (!prodForm.categoria_id) {
      setProdErrorMsg('Debe seleccionar una categoria.')
      return
    }

    const precioNum = parseFloat(prodForm.precio)
    const stockIdealNum = parseInt(prodForm.stockIdeal, 10)
    const stockInicialNum = parseInt(prodForm.stockInicial, 10)
    const stockActualNum = parseInt(prodForm.stockActual, 10)

    if (isNaN(precioNum) || precioNum < 0) {
      setProdErrorMsg('El precio debe ser un numero valido mayor o igual a 0.')
      return
    }
    if (isNaN(stockIdealNum) || stockIdealNum < 0) {
      setProdErrorMsg('El stock ideal debe ser un numero entero mayor o igual a 0.')
      return
    }

    setLoading(true)
    try {
      if (prodEditando) {
        // Editar
        if (isNaN(stockActualNum) || stockActualNum < 0) {
          setProdErrorMsg('El stock actual debe ser un numero entero mayor o igual a 0.')
          setLoading(false)
          return
        }

        const res = await actualizarProducto(prodEditando.id, {
          nombre: prodForm.nombre,
          categoria_id: prodForm.categoria_id,
          precio: precioNum,
          stockIdeal: stockIdealNum,
          stockActual: stockActualNum,
          unidad: prodForm.unidad,
          activo: prodForm.activo,
          vendible: prodForm.vendible,
          controla_stock: prodForm.controla_stock,
          insumo_compartido_id: prodForm.insumo_compartido_id || null
        })

        if (res.success) {
          mostrarExito(`Producto "${prodForm.nombre}" actualizado con exito.`)
          setModalProdOpen(false)
          await cargarDatos()
        } else {
          setProdErrorMsg(res.error || 'Error al actualizar el producto.')
        }
      } else {
        // Crear
        if (isNaN(stockInicialNum) || stockInicialNum < 0) {
          setProdErrorMsg('El stock inicial debe ser un numero entero mayor o igual a 0.')
          setLoading(false)
          return
        }

        const res = await crearProducto({
          nombre: prodForm.nombre,
          categoria_id: prodForm.categoria_id,
          precio: precioNum,
          stockIdeal: stockIdealNum,
          stockInicial: stockInicialNum,
          unidad: prodForm.unidad,
          activo: prodForm.activo,
          vendible: prodForm.vendible,
          controla_stock: prodForm.controla_stock,
          insumo_compartido_id: prodForm.insumo_compartido_id || null
        })

        if (res.success) {
          mostrarExito(`Producto "${prodForm.nombre}" creado con exito.`)
          setModalProdOpen(false)
          await cargarDatos()
        } else {
          setProdErrorMsg(res.error || 'Error al crear el producto.')
        }
      }
    } catch (err: any) {
      setProdErrorMsg('Ocurrio un error inesperado al guardar el producto.')
    } finally {
      setLoading(false)
    }
  }

  const abrirConfirmarBaja = (prod: Producto) => {
    setProdBajaTarget(prod)
    setModalBajaOpen(true)
  }

  const handleConfirmarBaja = async () => {
    if (!prodBajaTarget) return
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await cambiarEstadoProducto(prodBajaTarget.id, false)
      if (res.success) {
        mostrarExito(`Producto "${prodBajaTarget.nombre}" dado de baja logicamente con exito.`)
        setModalBajaOpen(false)
        setProdBajaTarget(null)
        await cargarDatos()
      } else {
        setErrorMsg(res.error || 'Error al dar de baja el producto.')
      }
    } catch (err: any) {
      setErrorMsg('Error al procesar la baja del producto.')
    } finally {
      setLoading(false)
    }
  }

  const handleActivarProducto = async (prod: Producto) => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await cambiarEstadoProducto(prod.id, true)
      if (res.success) {
        mostrarExito(`Producto "${prod.nombre}" activado con exito.`)
        await cargarDatos()
      } else {
        setErrorMsg(res.error || 'Error al activar el producto.')
      }
    } catch (err: any) {
      setErrorMsg('Error al procesar la activacion del producto.')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // MANEJO DE CATEGORIAS
  // ============================================================================

  const handleGuardarCategoria = async (e: React.FormEvent) => {
    e.preventDefault()
    setCatErrorMsg('')

    if (!catForm.nombre.trim()) {
      setCatErrorMsg('El nombre de la categoria es obligatorio.')
      return
    }

    setLoading(true)
    try {
      if (catEditando) {
        const res = await actualizarCategoria(
          catEditando.id,
          catForm.nombre,
          catForm.color_fondo,
          catForm.color_texto
        )

        if (res.success) {
          mostrarExito(`Categoria "${catForm.nombre}" actualizada con exito.`)
          setCatEditando(null)
          setCatForm({ nombre: '', color_fondo: '#1F2937', color_texto: '#FFFFFF' })
          await cargarDatos()
        } else {
          setCatErrorMsg(res.error || 'Error al actualizar la categoria.')
        }
      } else {
        const res = await crearCategoria(
          catForm.nombre,
          catForm.color_fondo,
          catForm.color_texto
        )

        if (res.success) {
          mostrarExito(`Categoria "${catForm.nombre}" creada con exito.`)
          setCatForm({ nombre: '', color_fondo: '#1F2937', color_texto: '#FFFFFF' })
          await cargarDatos()
        } else {
          setCatErrorMsg(res.error || 'Error al crear la categoria.')
        }
      }
    } catch (err: any) {
      setCatErrorMsg('Error inesperado al guardar la categoria.')
    } finally {
      setLoading(false)
    }
  }

  const handleEditarCategoria = (cat: Categoria) => {
    setCatEditando(cat)
    setCatForm({
      nombre: cat.nombre,
      color_fondo: cat.color_fondo,
      color_texto: cat.color_texto
    })
  }

  const handleToggleEstadoCategoria = async (cat: Categoria) => {
    setLoading(true)
    setCatErrorMsg('')
    try {
      const res = await cambiarEstadoCategoria(cat.id, !cat.activo)
      if (res.success) {
        mostrarExito(`Categoria "${cat.nombre}" modificada con exito.`)
        await cargarDatos()
      } else {
        let msg = res.error || 'Error al cambiar estado de la categoria.'
        if (msg.includes('productos activos')) {
          msg = 'No se puede dar de baja esta categoria, tiene productos activos asociados. Debe dar de baja los productos primero.'
        }
        setCatErrorMsg(msg)
      }
    } catch (err: any) {
      setCatErrorMsg('Error al procesar el cambio de estado.')
    } finally {
      setLoading(false)
    }
  }

  // Filtrado de productos en memoria
  const productosFiltrados = productos.filter(p => {
    const cumpleBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const cumpleCategoria = categoriaFiltro === '' || p.categoria_id === categoriaFiltro
    const cumpleEstado = mostrarInactivos || p.activo
    const cumpleTipo = tipoFiltro === 'todos' || (
      tipoFiltro === 'insumos' ? !p.vendible :
      tipoFiltro === 'productos' ? (p.vendible && p.controla_stock) :
      tipoFiltro === 'elaboracion' ? (p.vendible && !p.controla_stock) :
      true
    )
    return cumpleBusqueda && cumpleCategoria && cumpleEstado && cumpleTipo
  })

  // Helper para formatear moneda ARS sin decimales superfluos
  const formatearMoneda = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val)
  }

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0 select-none bg-[#F26A1B] overflow-hidden">
      
      {/* Contenedor Principal Oscuro Flotante */}
      <div className="flex-1 flex flex-col bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 shadow-2xl min-h-0 overflow-hidden">
        
        {/* Mensajes de feedback superior */}
        {errorMsg && (
          <div className="mb-4 p-4 rounded bg-red-950/40 border border-red-700/60 text-red-200 text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-200 font-bold ml-2">X</button>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-4 rounded bg-emerald-950/40 border border-emerald-700/60 text-emerald-200 text-sm flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-200 font-bold ml-2">X</button>
          </div>
        )}

        {/* Cabecera / Barra de Controles */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-[#F2F2F2]">Gestión de Productos</h1>
            <p className="text-xs text-[#9D9D9D]">Administra el catálogo de productos, existencias base y categorías.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCatErrorMsg('')
                setModalCatOpen(true)
              }}
              className="px-4 py-2 border border-[#BA7517]/20 bg-[#BA7517]/20 hover:bg-[#BA7517]/40 text-xs font-semibold text-[#F2F2F2] rounded transition-all cursor-pointer uppercase tracking-wider h-10"
            >
              Gestionar Categorías
            </button>
            <button
              onClick={abrirCrearProducto}
              className="px-4 py-2 bg-[#F26A1B] hover:bg-[#F25922] text-[#F2F2F2] text-xs font-bold rounded transition-all cursor-pointer uppercase tracking-wider h-10 flex items-center justify-center"
            >
              Nuevo Producto
            </button>
          </div>
        </div>

        {/* Filtros e Información de Resumen */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded border border-[#9D9D9D]/15 bg-[#080A0D]/50 mb-6">
          
          {/* Filtros Izquierda */}
          <div className="flex flex-1 flex-col sm:flex-row gap-3 items-center">
            {/* Buscador de Texto */}
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Buscar producto por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-4 text-sm text-[#F2F2F2] placeholder-[#9D9D9D]/60 focus:outline-none focus:border-[#30CFF2]/60 transition-all"
              />
            </div>

            {/* Filtro Categoría */}
            <div className="w-full sm:w-52">
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-3 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all cursor-pointer"
              >
                <option value="">Todas las Categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            {/* Filtro Tipo de Producto */}
            <div className="w-full sm:w-56">
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value as any)}
                className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-3 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all cursor-pointer"
              >
                <option value="todos">Todos los Items</option>
                <option value="insumos">Insumos (No Vendibles)</option>
                <option value="productos">Productos (Vendibles Cerrados)</option>
                <option value="elaboracion">Elaboración Instantánea</option>
              </select>
            </div>

            {/* Checkbox Mostrar Inactivos */}
            <div className="flex items-center gap-2 px-2 select-none shrink-0 h-10">
              <input
                id="checkbox_inactivos"
                type="checkbox"
                checked={mostrarInactivos}
                onChange={(e) => setMostrarInactivos(e.target.checked)}
                className="w-4 h-4 bg-[#080A0D] border border-[#9D9D9D]/30 rounded text-[#30CFF2] focus:ring-0 cursor-pointer accent-[#F26A1B]"
              />
              <label htmlFor="checkbox_inactivos" className="text-xs font-semibold text-[#F2F2F2] cursor-pointer">
                Mostrar inactivos / dados de baja
              </label>
            </div>
          </div>

          {/* Resumen Derecha */}
          <div className="flex items-center gap-4 text-xs font-semibold text-[#9D9D9D] px-2 shrink-0">
            <div>
              Total en Catálogo: <span className="text-[#F2F2F2]">{productos.length}</span>
            </div>
            <div className="h-4 w-[1px] bg-[#9D9D9D]/15"></div>
            <div>
              Filtrados: <span className="text-[#30CFF2]">{productosFiltrados.length}</span>
            </div>
          </div>

        </div>

        {/* Tabla de Productos */}
        <div className="flex-1 overflow-auto rounded border border-[#9D9D9D]/15 bg-[#080A0D]/50">
        {loading && productos.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-[#9D9D9D]">Cargando catálogo...</div>
        ) : productosFiltrados.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-[#9D9D9D]">
            No se encontraron productos coincidentes.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm font-livvic">
            <thead>
              <tr className="border-b border-[#9D9D9D]/15 bg-[#080A0D] text-[#9D9D9D] text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Categoría</th>
                <th className="py-3.5 px-4 font-semibold">Producto</th>
                <th className="py-3.5 px-4 font-semibold text-right">Precio</th>
                <th className="py-3.5 px-4 font-semibold text-center">Unidad</th>
                <th className="py-3.5 px-4 font-semibold text-right">Stock Actual</th>
                <th className="py-3.5 px-4 font-semibold text-right">Stock Ideal</th>
                <th className="py-3.5 px-4 font-semibold text-right">Stock Inicial</th>
                <th className="py-3.5 px-4 font-semibold text-center">Estado</th>
                <th className="py-3.5 px-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#9D9D9D]/15">
              {productosFiltrados.map((prod) => {
                const esBajoStock = prod.stockActual < prod.stockIdeal
                return (
                  <tr
                    key={prod.id}
                    className={`hover:bg-[#080A0D]/50 transition-colors ${!prod.activo ? 'opacity-50' : ''}`}
                  >
                    {/* Categoría */}
                    <td className="py-3 px-4 shrink-0">
                      {prod.Categorias_Productos ? (
                        <span
                          className="px-2.5 py-1 rounded text-xs font-semibold select-none border border-black/10 inline-block shadow-sm"
                          style={{
                            backgroundColor: prod.Categorias_Productos.color_fondo,
                            color: prod.Categorias_Productos.color_texto
                          }}
                        >
                          {prod.Categorias_Productos.nombre}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-600">—</span>
                      )}
                    </td>

                    {/* Nombre del Producto */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-[#F2F2F2]">{prod.nombre}</span>
                        <div className="flex gap-1.5 flex-wrap items-center mt-0.5">
                          {!prod.vendible && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[#9D9D9D] font-bold tracking-wider uppercase select-none">
                              Insumo
                            </span>
                          )}
                          {!prod.controla_stock && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-950/30 border border-yellow-800/30 text-yellow-500 font-bold tracking-wider uppercase select-none">
                              Sin Seguimiento
                            </span>
                          )}
                          {prod.insumo_compartido_id && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#30CFF2]/10 border border-[#30CFF2]/20 text-[#30CFF2] font-semibold tracking-wide select-none">
                              Usa stock de: {productos.find(i => i.id === prod.insumo_compartido_id)?.nombre || 'Insumo'}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Precio */}
                    <td className="py-3 px-4 text-right font-semibold text-[#F2F2F2]">
                      {formatearMoneda(prod.precio)}
                    </td>

                    {/* Unidad */}
                    <td className="py-3 px-4 text-center text-[#9D9D9D] font-mono">
                      {prod.unidad}
                    </td>

                    {/* Stock Actual */}
                    <td className="py-3 px-4 text-right font-semibold">
                      {prod.controla_stock ? (
                        prod.insumo_compartido_id ? (
                          <>
                            <span className="text-[#30CFF2]">{prod.stockActual}</span>
                            <span className="block text-[9px] font-medium text-[#9D9D9D] leading-tight select-none">
                              Compartido
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={esBajoStock && prod.activo ? 'text-[#FF4A4A]' : 'text-[#30CFF2]'}>
                              {prod.stockActual}
                            </span>
                            {esBajoStock && prod.activo && (
                              <span className="block text-[10px] font-medium text-[#FF4A4A] tracking-tight">¡Stock Bajo!</span>
                            )}
                          </>
                        )
                      ) : (
                        <span className="text-neutral-600 font-normal">—</span>
                      )}
                    </td>

                    {/* Stock Ideal */}
                    <td className="py-3 px-4 text-right font-semibold text-[#F2F2F2]">
                      {prod.controla_stock ? (
                        prod.insumo_compartido_id ? (
                          <span className="text-neutral-500 font-normal text-xs select-none">Enlazado</span>
                        ) : (
                          prod.stockIdeal
                        )
                      ) : (
                        <span className="text-neutral-600 font-normal">—</span>
                      )}
                    </td>

                    {/* Stock Inicial */}
                    <td className="py-3 px-4 text-right font-semibold text-[#F2F2F2]">
                      {prod.controla_stock ? (
                        prod.insumo_compartido_id ? (
                          <span className="text-neutral-500 font-normal text-xs select-none">Enlazado</span>
                        ) : (
                          prod.stockInicial
                        )
                      ) : (
                        <span className="text-neutral-600 font-normal">—</span>
                      )}
                    </td>

                    {/* Estado Activo / Inactivo */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          prod.activo ? 'bg-[#30CFF2] shadow-[0_0_8px_rgba(48,207,242,0.4)]' : 'bg-neutral-600'
                        }`}
                      ></span>
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => abrirEditarProducto(prod)}
                          className="px-2.5 py-1 text-xs border border-[#9D9D9D]/20 hover:border-[#30CFF2]/40 bg-[#2E2E2E]/40 hover:bg-[#1E2530]/80 text-[#9D9D9D] hover:text-[#30CFF2] rounded transition-all cursor-pointer font-semibold uppercase tracking-wider"
                        >
                          Editar
                        </button>
                        {prod.activo ? (
                          <button
                            onClick={() => abrirConfirmarBaja(prod)}
                            className="px-2.5 py-1 text-xs border border-red-900/20 hover:border-red-600 bg-red-950/20 hover:bg-red-900/60 text-red-400 hover:text-red-100 rounded transition-all cursor-pointer font-semibold uppercase tracking-wider"
                          >
                            Baja
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivarProducto(prod)}
                            className="px-2.5 py-1 text-xs border border-emerald-900/20 hover:border-emerald-600 bg-emerald-950/20 hover:bg-emerald-900/60 text-emerald-400 hover:text-emerald-100 rounded transition-all cursor-pointer font-semibold uppercase tracking-wider"
                          >
                            Activar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ============================================================================
          MODAL: CREACIÓN Y EDICIÓN DE PRODUCTOS (Wireframe 4)
          ============================================================================ */}
      {modalProdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080A0D]/85 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] overflow-hidden">
            
            {/* Cabecera del Modal */}
            <div className="bg-[#080A0D] border-b border-[#9D9D9D]/15 px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base text-[#F2F2F2]">
                {prodEditando ? 'Editar Producto' : 'Crear Nuevo Producto'}
              </h3>
              <button
                onClick={() => setModalProdOpen(false)}
                className="text-[#9D9D9D] hover:text-[#F2F2F2] font-semibold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarProducto}>
              {/* Alerta de Error dentro del Modal */}
              {prodErrorMsg && (
                <div className="mx-6 mt-4 p-3.5 bg-[#E2484A]/10 border border-[#E2484A]/30 rounded-lg text-xs text-[#E2484A] font-medium flex items-center justify-between animate-scale-in select-none">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">⚠️</span>
                    <span>{prodErrorMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProdErrorMsg('')}
                    className="text-[#E2484A] hover:text-[#F2F2F2] font-bold text-sm ml-2"
                  >
                    &times;
                  </button>
                </div>
              )}

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1">
                    Nombre del Producto
                  </label>
                  <input
                    type="text"
                    required
                    value={prodForm.nombre}
                    onChange={(e) => setProdForm({ ...prodForm, nombre: e.target.value })}
                    className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-4 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all"
                    placeholder="Ej. Heineken 1Lt"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1">
                    Categoría
                  </label>
                  <select
                    required
                    value={prodForm.categoria_id}
                    onChange={(e) => setProdForm({ ...prodForm, categoria_id: e.target.value })}
                    className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-3 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all cursor-pointer"
                  >
                    <option value="" disabled>Seleccione una categoría</option>
                    {categorias.filter(c => c.activo || c.id === prodForm.categoria_id).map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre} {!cat.activo && '(Inactiva)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Producto (Toggle vendible) */}
                <div>
                  <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-2">
                    Tipo de Producto
                  </label>
                  <div className="grid grid-cols-2 p-1 bg-[#080A0D] border border-[#9D9D9D]/15 rounded-lg select-none">
                    <button
                      type="button"
                      onClick={() => setProdForm({ ...prodForm, vendible: true })}
                      className={`py-2 px-3 text-xs font-bold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                        prodForm.vendible
                          ? 'bg-[#F26A1B] text-[#F2F2F2] shadow-sm'
                          : 'text-[#9D9D9D] hover:text-[#F2F2F2] bg-transparent'
                      }`}
                    >
                      Producto para la Venta
                    </button>
                    <button
                      type="button"
                      onClick={() => setProdForm({ ...prodForm, vendible: false, controla_stock: true })}
                      className={`py-2 px-3 text-xs font-bold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                        !prodForm.vendible
                          ? 'bg-[#F26A1B] text-[#F2F2F2] shadow-sm'
                          : 'text-[#9D9D9D] hover:text-[#F2F2F2] bg-transparent'
                      }`}
                    >
                      Insumo
                    </button>
                  </div>
                </div>

                {/* Control de Inventario (Seguimiento de Stock) */}
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="controlStockCheck"
                    disabled={!prodForm.vendible}
                    checked={prodForm.controla_stock}
                    onChange={(e) => setProdForm({ ...prodForm, controla_stock: e.target.checked })}
                    className={`w-4 h-4 rounded border-[#9D9D9D]/15 bg-[#080A0D] accent-[#30CFF2] cursor-pointer ${
                      !prodForm.vendible ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  />
                  <div className="flex flex-col">
                    <label htmlFor="controlStockCheck" className={`text-xs font-semibold text-[#F2F2F2] cursor-pointer select-none ${
                      !prodForm.vendible ? 'opacity-50 cursor-not-allowed' : ''
                    }`}>
                      Seguimiento de Stock
                    </label>
                    {!prodForm.vendible && (
                      <span className="text-[10px] text-[#9D9D9D]/70 mt-0.5">Los insumos siempre requieren seguimiento de stock.</span>
                    )}
                  </div>
                </div>

                {/* Selector de Insumo Compartido (Solo si es vendible y controla stock) */}
                {prodForm.vendible && prodForm.controla_stock && (
                  <div className="pt-2 animate-scale-in">
                    <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1">
                      Usa Insumo de Stock Compartido (Opcional)
                    </label>
                    <select
                      value={prodForm.insumo_compartido_id}
                      onChange={(e) => setProdForm({ ...prodForm, insumo_compartido_id: e.target.value })}
                      className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-3 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all cursor-pointer"
                    >
                      <option value="">Ninguno (Control de stock directo)</option>
                      {productos
                        .filter(p => !p.vendible && p.controla_stock && p.activo && p.id !== prodEditando?.id)
                        .map(insumo => (
                          <option key={insumo.id} value={insumo.id}>
                            {insumo.nombre}
                          </option>
                        ))
                      }
                    </select>
                    <p className="text-[10px] text-[#9D9D9D]/70 mt-1">
                      Selecciona un insumo base (ej. Bollos de Pizza) si este producto debe descontar existencias y compartir stock con él.
                    </p>
                  </div>
                )}

                {/* Fila: Precio y Unidad */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Precio */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1">
                      Precio (ARS)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={prodForm.precio}
                      onChange={(e) => setProdForm({ ...prodForm, precio: e.target.value })}
                      className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-4 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Unidad */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1">
                      Unidad de Medida
                    </label>
                    <select
                      value={prodForm.unidad}
                      onChange={(e) => setProdForm({ ...prodForm, unidad: e.target.value as any })}
                      className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-3 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all cursor-pointer"
                    >
                      <option value="u">Unidades (u)</option>
                      <option value="lt">Litros (lt)</option>
                      <option value="ml">Mililitros (ml)</option>
                    </select>
                  </div>
                </div>

                {/* Fila: Stock (Inicial o Actual) y Stock Ideal (Solo si controla_stock es true) */}
                {prodForm.controla_stock ? (
                  prodForm.insumo_compartido_id ? (
                    <div className="p-3.5 bg-[#30CFF2]/5 border border-[#30CFF2]/10 rounded text-xs text-[#9D9D9D] leading-relaxed select-none animate-scale-in">
                      Este producto comparte el inventario y stock del insumo asociado <span className="text-[#30CFF2] font-semibold">"{productos.find(p => p.id === prodForm.insumo_compartido_id)?.nombre || 'Insumo seleccionado'}"</span>. No requiere configuración ni conteos de stock propios.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Stock */}
                      <div>
                        <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1">
                          {prodEditando ? 'Stock Actual' : 'Stock Inicial'}
                        </label>
                        {prodEditando ? (
                          <input
                            type="number"
                            required
                            value={prodForm.stockActual}
                            onChange={(e) => setProdForm({ ...prodForm, stockActual: e.target.value })}
                            className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-4 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all"
                            placeholder="0"
                          />
                        ) : (
                          <input
                            type="number"
                            required
                            value={prodForm.stockInicial}
                            onChange={(e) => setProdForm({ ...prodForm, stockInicial: e.target.value })}
                            className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-4 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all"
                            placeholder="0"
                          />
                        )}
                      </div>

                      {/* Stock Ideal */}
                      <div>
                        <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1">
                          Stock Ideal
                        </label>
                        <input
                          type="number"
                          required
                          value={prodForm.stockIdeal}
                          onChange={(e) => setProdForm({ ...prodForm, stockIdeal: e.target.value })}
                          className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-4 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-3.5 bg-[#080A0D] border border-[#9D9D9D]/10 rounded text-xs text-[#9D9D9D] leading-relaxed">
                    Este producto de elaboración instantánea no realiza seguimiento de existencias en las ventas ni requiere auditoría física de stock durante el cierre.
                  </div>
                )}

                {/* Activo / Inactivo */}
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="activoCheck"
                    checked={prodForm.activo}
                    onChange={(e) => setProdForm({ ...prodForm, activo: e.target.checked })}
                    className="w-4 h-4 rounded border-[#9D9D9D]/15 bg-[#080A0D] accent-[#30CFF2] cursor-pointer"
                  />
                  <label htmlFor="activoCheck" className="text-xs font-semibold text-[#F2F2F2] cursor-pointer select-none">
                    Producto Activo
                  </label>
                </div>

              </div>

              {/* Botones del Modal */}
              <div className="bg-[#080A0D] border-t border-[#9D9D9D]/15 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalProdOpen(false)}
                  className="px-4 py-2 border border-[#9D9D9D]/20 bg-transparent hover:bg-[#2E2E2E]/40 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] rounded transition-all cursor-pointer uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F26A1B] hover:bg-[#F25922] text-[#F2F2F2] text-xs font-bold rounded transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center animate-pulse-subtle"
                >
                  {prodEditando ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ============================================================================
          MODAL: CONFIRMACIÓN DE BAJA DE PRODUCTO (Wireframe 5)
          ============================================================================ */}
      {modalBajaOpen && prodBajaTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080A0D]/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] overflow-hidden">
            
            <div className="p-6">
              <h3 className="font-bold text-base text-[#F2F2F2] mb-2 uppercase tracking-wide">Confirmar Baja</h3>
              <p className="text-sm text-[#9D9D9D] leading-relaxed">
                ¿Estás seguro de que deseas dar de baja el producto <span className="text-[#30CFF2] font-semibold">{prodBajaTarget.nombre}</span>?
              </p>
              <p className="text-xs text-[#9D9D9D]/60 mt-2">
                El producto quedará "inactivo". Podes volver a activarlo cuando quieras.
              </p>
            </div>

            <div className="bg-[#080A0D] border-t border-[#9D9D9D]/15 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setModalBajaOpen(false)
                  setProdBajaTarget(null)
                }}
                className="px-4 py-2 border border-[#9D9D9D]/20 bg-transparent hover:bg-[#2E2E2E]/40 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] rounded transition-all cursor-pointer uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarBaja}
                className="px-4 py-2 bg-[#FF4A4A] hover:bg-[#e03d3d] text-white text-xs font-bold rounded transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center"
              >
                Dar de Baja
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================================
          MODAL: GESTIÓN DE CATEGORÍAS
          ============================================================================ */}
      {modalCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080A0D]/85 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Cabecera del Modal */}
            <div className="bg-[#080A0D] border-b border-[#9D9D9D]/15 px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base text-[#F2F2F2]">
                Gestión de Categorías de Productos
              </h3>
              <button
                onClick={() => {
                  setModalCatOpen(false)
                  setCatEditando(null)
                  setCatForm({ nombre: '', color_fondo: '#1F2937', color_texto: '#FFFFFF' })
                  setCatErrorMsg('')
                }}
                className="text-[#9D9D9D] hover:text-[#F2F2F2] font-semibold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Alerta de Error dentro del Modal */}
            {catErrorMsg && (
              <div className="mx-6 mt-4 p-3 rounded bg-red-950/40 border border-red-700/60 text-red-200 text-xs flex items-center justify-between">
                <span>{catErrorMsg}</span>
                <button
                  type="button"
                  onClick={() => setCatErrorMsg('')}
                  className="text-red-400 hover:text-red-200 font-bold ml-2"
                >
                  X
                </button>
              </div>
            )}

            {/* Contenido dividido */}
            <div className="flex-1 overflow-auto p-6 flex flex-col md:flex-row gap-6 min-h-0">
              
              {/* Formulario (Izquierda) */}
              <div className="w-full md:w-1/2 flex flex-col">
                <h4 className="font-semibold text-sm text-[#F2F2F2] mb-3 uppercase tracking-wider pb-1.5 border-b border-[#9D9D9D]/15">
                  {catEditando ? 'Editar Categoría' : 'Nueva Categoría'}
                </h4>
                
                <form onSubmit={handleGuardarCategoria} className="space-y-4">
                  {/* Nombre */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      required
                      value={catForm.nombre}
                      onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
                      className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-4 text-sm text-[#F2F2F2] focus:outline-none focus:border-[#30CFF2]/60 transition-all"
                      placeholder="Ej. Cervezas"
                    />
                  </div>

                  {/* Colores */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Fondo */}
                    <div>
                      <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1">
                        Color Fondo
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={catForm.color_fondo}
                          onChange={(e) => setCatForm({ ...catForm, color_fondo: e.target.value })}
                          className="w-10 h-10 border border-[#9D9D9D]/15 bg-transparent rounded cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          maxLength={7}
                          value={catForm.color_fondo}
                          onChange={(e) => setCatForm({ ...catForm, color_fondo: e.target.value })}
                          className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-2.5 text-xs text-[#F2F2F2] font-mono text-center focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Texto */}
                    <div>
                      <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1">
                        Color Texto
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={catForm.color_texto}
                          onChange={(e) => setCatForm({ ...catForm, color_texto: e.target.value })}
                          className="w-10 h-10 border border-[#9D9D9D]/15 bg-transparent rounded cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          maxLength={7}
                          value={catForm.color_texto}
                          onChange={(e) => setCatForm({ ...catForm, color_texto: e.target.value })}
                          className="w-full h-10 bg-[#080A0D] border border-[#9D9D9D]/15 rounded px-2.5 text-xs text-[#F2F2F2] font-mono text-center focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview Visual */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9D9D9D] uppercase tracking-wider mb-1.5">
                      Vista Previa
                    </label>
                    <div className="h-14 rounded border border-[#9D9D9D]/15 bg-[#080A0D] flex items-center justify-center">
                      <span
                        className="px-4 py-1.5 rounded text-sm font-bold border border-black/10 shadow-sm"
                        style={{
                          backgroundColor: catForm.color_fondo,
                          color: catForm.color_texto
                        }}
                      >
                        {catForm.nombre || 'Nombre de Categoría'}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 pt-2">
                    {catEditando && (
                      <button
                        type="button"
                        onClick={() => {
                          setCatEditando(null)
                          setCatForm({ nombre: '', color_fondo: '#1F2937', color_texto: '#FFFFFF' })
                        }}
                        className="w-1/2 h-10 border border-[#9D9D9D]/20 bg-transparent hover:bg-[#2E2E2E]/40 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] rounded transition-all cursor-pointer uppercase tracking-wider"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      className={`h-10 bg-[#BA7517] hover:bg-[#BA7517]/90 text-[#F2F2F2] text-xs font-bold rounded transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center ${
                        catEditando ? 'w-1/2' : 'w-full'
                      }`}
                    >
                      {catEditando ? 'Actualizar' : 'Agregar Categoría'}
                    </button>
                  </div>
                </form>

              </div>

              {/* Listado (Derecha) */}
              <div className="w-full md:w-1/2 flex flex-col min-h-0">
                <h4 className="font-semibold text-sm text-[#F2F2F2] mb-3 uppercase tracking-wider pb-1.5 border-b border-[#9D9D9D]/15">
                  Categorías Registradas
                </h4>

                <div className="flex-1 overflow-auto space-y-2.5 pr-1">
                  {categorias.map(cat => (
                    <div
                      key={cat.id}
                      className={`flex items-center justify-between p-3 rounded border border-[#9D9D9D]/15 bg-[#080A0D]/50 ${
                        !cat.activo ? 'opacity-40' : ''
                      }`}
                    >
                      <span
                        className="px-2.5 py-1 rounded text-xs font-bold border border-black/10 inline-block shadow-sm select-none"
                        style={{
                          backgroundColor: cat.color_fondo,
                          color: cat.color_texto
                        }}
                      >
                        {cat.nombre}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditarCategoria(cat)}
                          className="px-2 py-1 text-[10px] border border-[#9D9D9D]/20 bg-[#2E2E2E]/40 hover:bg-[#2E2E2E]/80 text-[#9D9D9D] hover:text-[#F2F2F2] rounded cursor-pointer font-bold uppercase tracking-wider"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleEstadoCategoria(cat)}
                          className={`px-2 py-1 text-[10px] border rounded cursor-pointer font-bold uppercase tracking-wider ${
                            cat.activo
                              ? 'border-red-950/20 bg-red-950/20 text-red-400 hover:border-red-600 hover:bg-red-900/60'
                              : 'border-emerald-950/20 bg-emerald-950/20 text-emerald-400 hover:border-emerald-600 hover:bg-emerald-900/60'
                          }`}
                        >
                          {cat.activo ? 'Baja' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {categorias.length === 0 && (
                    <div className="text-center py-6 text-xs text-[#9D9D9D]">
                      No hay categorías creadas aún.
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Pie del modal */}
            <div className="bg-[#080A0D] border-t border-[#9D9D9D]/15 px-6 py-4 flex items-center justify-end shrink-0">
              <button
                onClick={() => {
                  setModalCatOpen(false)
                  setCatEditando(null)
                  setCatForm({ nombre: '', color_fondo: '#1F2937', color_texto: '#FFFFFF' })
                  setCatErrorMsg('')
                }}
                className="px-4 py-2 border border-[#9D9D9D]/20 bg-transparent hover:bg-[#2E2E2E]/40 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] rounded transition-all cursor-pointer uppercase tracking-wider"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      </div> {/* Fin Contenedor Principal Oscuro Flotante */}
    </div>
  )
}
