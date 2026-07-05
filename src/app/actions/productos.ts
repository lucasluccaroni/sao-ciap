'use server'

import { createClient } from '@/utils/supabase/server'

// ============================================================================
// UTILIDAD INTERNA DE SEGURIDAD
// ============================================================================

/**
 * Verifica que el usuario autenticado sea un administrador activo.
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

/**
 * Verifica que el usuario este al menos autenticado (para lecturas).
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

// ============================================================================
// ACCIONES PARA CATEGORIAS DE PRODUCTOS
// ============================================================================

export async function obtenerCategorias(): Promise<{
  success: boolean
  error?: string
  categorias?: Array<{
    id: string
    nombre: string
    color_fondo: string
    color_texto: string
    activo: boolean
    created_at: string
  }>
}> {
  try {
    const supabase = await createClient()
    const authCheck = await verificarAutenticado(supabase)
    if (!authCheck.ok) return { success: false, error: authCheck.error }

    const { data, error } = await supabase
      .from('Categorias_Productos')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) throw error

    return { success: true, categorias: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener categorias.' }
  }
}

export async function crearCategoria(
  nombre: string,
  colorFondo: string,
  colorTexto: string
): Promise<{ success: boolean; error?: string; categoria?: any }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    // Validacion de colores HEX (ej. #FFFFFF)
    const regexHex = /^#[0-9A-Fa-f]{6}$/
    if (!regexHex.test(colorFondo) || !regexHex.test(colorTexto)) {
      return { success: false, error: 'Los colores deben tener formato hexadecimal valido (ej. #FF0000).' }
    }

    if (!nombre.trim()) {
      return { success: false, error: 'El nombre de la categoria no puede estar vacio.' }
    }

    const { data, error } = await supabase
      .from('Categorias_Productos')
      .insert({
        nombre: nombre.trim(),
        color_fondo: colorFondo,
        color_texto: colorTexto,
        activo: true
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, categoria: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear la categoria.' }
  }
}

export async function actualizarCategoria(
  id: string,
  nombre: string,
  colorFondo: string,
  colorTexto: string
): Promise<{ success: boolean; error?: string; categoria?: any }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    const regexHex = /^#[0-9A-Fa-f]{6}$/
    if (!regexHex.test(colorFondo) || !regexHex.test(colorTexto)) {
      return { success: false, error: 'Los colores deben tener formato hexadecimal valido (ej. #FF0000).' }
    }

    if (!nombre.trim()) {
      return { success: false, error: 'El nombre de la categoria no puede estar vacio.' }
    }

    const { data, error } = await supabase
      .from('Categorias_Productos')
      .update({
        nombre: nombre.trim(),
        color_fondo: colorFondo,
        color_texto: colorTexto
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return { success: true, categoria: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar la categoria.' }
  }
}

export async function cambiarEstadoCategoria(
  id: string,
  activo: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    // Si se está intentando dar de baja la categoría (activo = false)
    if (!activo) {
      const { data: productosActivos, error: prodError } = await supabase
        .from('Productos')
        .select('id')
        .eq('categoria_id', id)
        .eq('activo', true)

      if (prodError) throw prodError

      if (productosActivos && productosActivos.length > 0) {
        return {
          success: false,
          error: 'No se puede dar de baja esta categoria porque tiene productos activos asociados. Debe dar de baja los productos primero.'
        }
      }
    }

    const { error } = await supabase
      .from('Categorias_Productos')
      .update({ activo })
      .eq('id', id)

    if (error) throw error

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al cambiar estado de la categoria.' }
  }
}

// ============================================================================
// ACCIONES PARA PRODUCTOS
// ============================================================================

export async function obtenerProductos(): Promise<{
  success: boolean
  error?: string
  productos?: Array<{
    id: string
    nombre: string
    categoria_id: string
    precio: number
    stockIdeal: number
    stockInicial: number
    stockActual: number
    unidad: string
    activo: boolean
    vendible: boolean
    controla_stock: boolean
    created_at: string
    Categorias_Productos?: {
      nombre: string
      color_fondo: string
      color_texto: string
    }
  }>
}> {
  try {
    const supabase = await createClient()
    const authCheck = await verificarAutenticado(supabase)
    if (!authCheck.ok) return { success: false, error: authCheck.error }

    const { data, error } = await supabase
      .from('Productos')
      .select('*, Categorias_Productos(nombre, color_fondo, color_texto)')
      .order('nombre', { ascending: true })

    if (error) throw error

    // Formatear la relacion tipada de supabase
    const productosFormateados = (data as any[]).map(p => ({
      ...p,
      precio: Number(p.precio),
      stockIdeal: Number(p.stockIdeal),
      stockInicial: Number(p.stockInicial),
      stockActual: Number(p.stockActual)
    }))

    return { success: true, productos: productosFormateados }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener productos.' }
  }
}

export async function crearProducto(datos: {
  nombre: string
  categoria_id: string
  precio: number
  stockIdeal: number
  stockInicial: number
  unidad: 'u' | 'lt' | 'ml'
  activo?: boolean
  vendible: boolean
  controla_stock: boolean
}): Promise<{ success: boolean; error?: string; producto?: any }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    if (!datos.nombre.trim()) {
      return { success: false, error: 'El nombre del producto no puede estar vacio.' }
    }
    if (datos.precio < 0) {
      return { success: false, error: 'El precio no puede ser negativo.' }
    }
    if (datos.stockIdeal < 0 || datos.stockInicial < 0) {
      return { success: false, error: 'El stock no puede ser negativo.' }
    }

    // Validar que la categoria este activa si el producto se crea como activo y vendible
    if (datos.activo !== false && datos.vendible) {
      const { data: categoria, error: catError } = await supabase
        .from('Categorias_Productos')
        .select('activo')
        .eq('id', datos.categoria_id)
        .single()

      if (catError || !categoria) {
        return { success: false, error: 'La categoria seleccionada no existe.' }
      }
      if (!categoria.activo) {
        return { success: false, error: 'No se puede crear un producto activo en una categoria inactiva.' }
      }
    }

    const { data, error } = await supabase
      .from('Productos')
      .insert({
        nombre: datos.nombre.trim(),
        categoria_id: datos.categoria_id,
        precio: datos.precio,
        stockIdeal: datos.stockIdeal,
        stockInicial: datos.stockInicial,
        stockActual: datos.stockInicial, // El stock actual se inicializa con el inicial
        unidad: datos.unidad,
        activo: datos.activo ?? true,
        vendible: datos.vendible,
        controla_stock: datos.controla_stock
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, producto: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear el producto.' }
  }
}

export async function actualizarProducto(
  id: string,
  datos: {
    nombre: string
    categoria_id: string
    precio: number
    stockIdeal: number
    stockActual: number
    unidad: 'u' | 'lt' | 'ml'
    activo: boolean
    vendible: boolean
    controla_stock: boolean
  }
): Promise<{ success: boolean; error?: string; producto?: any }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    if (!datos.nombre.trim()) {
      return { success: false, error: 'El nombre del producto no puede estar vacio.' }
    }
    if (datos.precio < 0) {
      return { success: false, error: 'El precio no puede ser negativo.' }
    }
    if (datos.stockIdeal < 0) {
      return { success: false, error: 'El stock ideal no puede ser negativo.' }
    }
    if (datos.stockActual < 0) {
      return { success: false, error: 'El stock actual no puede ser negativo.' }
    }

    // Validar que la categoria este activa si el producto se actualiza a activo y es vendible
    if (datos.activo && datos.vendible) {
      const { data: categoria, error: catError } = await supabase
        .from('Categorias_Productos')
        .select('activo')
        .eq('id', datos.categoria_id)
        .single()

      if (catError || !categoria) {
        return { success: false, error: 'La categoria seleccionada no existe.' }
      }
      if (!categoria.activo) {
        return { success: false, error: 'No se puede activar este producto porque su categoria asociada se encuentra inactiva. Primero debe activar la categoria.' }
      }
    }

    const { data, error } = await supabase
      .from('Productos')
      .update({
        nombre: datos.nombre.trim(),
        categoria_id: datos.categoria_id,
        precio: datos.precio,
        stockIdeal: datos.stockIdeal,
        stockActual: datos.stockActual,
        unidad: datos.unidad,
        activo: datos.activo,
        vendible: datos.vendible,
        controla_stock: datos.controla_stock
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return { success: true, producto: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar el producto.' }
  }
}

export async function cambiarEstadoProducto(
  id: string,
  activo: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const adminCheck = await verificarAdmin(supabase)
    if (!adminCheck.ok) return { success: false, error: adminCheck.error }

    // Validar que la categoria este activa si el producto se intenta activar
    if (activo) {
      const { data: producto, error: prodError } = await supabase
        .from('Productos')
        .select('categoria_id')
        .eq('id', id)
        .single()

      if (prodError || !producto) {
        return { success: false, error: 'El producto seleccionado no existe.' }
      }

      const { data: categoria, error: catError } = await supabase
        .from('Categorias_Productos')
        .select('activo')
        .eq('id', producto.categoria_id)
        .single()

      if (catError || !categoria) {
        return { success: false, error: 'La categoria asociada al producto no existe.' }
      }
      if (!categoria.activo) {
        return { success: false, error: 'No se puede activar este producto porque su categoria asociada se encuentra inactiva. Primero debe activar la categoria.' }
      }
    }

    const { error } = await supabase
      .from('Productos')
      .update({ activo })
      .eq('id', id)

    if (error) throw error

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al cambiar el estado del producto.' }
  }
}
