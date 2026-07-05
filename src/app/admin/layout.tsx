import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import BotonSalirAdmin from '@/components/BotonSalirAdmin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Obtener sesión activa
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/')
  }

  // 2. Validar rol de Administrador activo en base de datos local
  const { data: dbUser, error: dbError } = await supabase
    .from('Usuarios')
    .select('nombre, rol, activo')
    .eq('id', user.id)
    .single()

  if (dbError || !dbUser) {
    redirect('/')
  }

  if (dbUser.rol !== 'Admin' || !dbUser.activo) {
    // Cerramos la sesión por seguridad si está inactivo o no es admin
    const { error: signOutError } = await supabase.auth.signOut()
    redirect('/')
  }

  // Formatear fecha del servidor para el Topnav (Ej: "mié 01/07")
  const obtenerFechaFormateada = () => {
    const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
    const fecha = new Date()
    const diaSemana = dias[fecha.getDay()]
    const diaMes = String(fecha.getDate()).padStart(2, '0')
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    return `${diaSemana} ${diaMes}/${mes}`
  }


  return (
    <div className="min-h-screen flex flex-col bg-[#080A0D] font-livvic text-[#F2F2F2]">
      {/* Topnav (56px / h-14) */}
      <header className="h-14 w-full bg-[#080A0D] border-b border-[#F2F2F2] flex items-center justify-between px-6 shrink-0 z-30">
        
        {/* Logo a la izquierda */}
        <div className="flex items-center gap-2.5 select-none">
          <div className="relative w-10 h-10 rounded-full border border-[#30CFF2]/30 bg-[#080A0D] flex items-center justify-center p-0.5 shadow-[0_0_8px_rgba(48,207,242,0.15)]">
            <Image
              src="/images/sao-logo.png"
              alt="Logo"
              width={34}
              height={34}
              style={{ width: 'auto', height: 'auto' }}
              className="object-contain"
            />
          </div>
          <span className="font-creepster text-xl tracking-wider text-[#F2F2F2]">
            SAO BAR
          </span>
        </div>

        {/* Menú de Navegación Central */}
        <nav className="hidden md:flex items-center gap-6 h-full font-livvic text-sm font-medium">
          <Link
            href="/admin/productos"
            className="text-[#9D9D9D] hover:text-[#F2F2F2] transition-colors relative flex items-center h-full hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#30CFF2]"
          >
            Productos
          </Link>
          <Link
            href="/admin/comandas"
            className="text-[#9D9D9D] hover:text-[#F2F2F2] transition-colors relative flex items-center h-full hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#30CFF2]"
          >
            Comandas
          </Link>
          <Link
            href="/admin/caja"
            className="text-[#9D9D9D] hover:text-[#F2F2F2] transition-colors relative flex items-center h-full hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#30CFF2]"
          >
            Caja
          </Link>
          <Link
            href="/admin/cierre"
            className="text-[#9D9D9D] hover:text-[#F2F2F2] transition-colors relative flex items-center h-full hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#30CFF2]"
          >
            Cierre
          </Link>
          <Link
            href="/admin/historial"
            className="text-[#9D9D9D] hover:text-[#F2F2F2] transition-colors relative flex items-center h-full hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#30CFF2]"
          >
            Historial
          </Link>
          <Link
            href="/admin/calculadora"
            className="text-[#9D9D9D] hover:text-[#F2F2F2] transition-colors relative flex items-center h-full hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#30CFF2]"
          >
            Calculadora
          </Link>
        </nav>

        {/* Panel de Usuario y Salir a la derecha */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col text-right select-none">
            <span className="font-livvic text-xs text-[#9D9D9D]">
              {obtenerFechaFormateada()}
            </span>
            <span className="font-livvic text-xs font-semibold text-[#F2F2F2] uppercase tracking-wide">
              {dbUser.nombre || 'Administrador'}
            </span>
          </div>
          
          {/* Botón de Salir mediante componente interactivo con confirmación */}
          <BotonSalirAdmin />
        </div>
      </header>

      {/* Área del Contenido Principal */}
      <main className="flex-1 flex flex-col min-h-0 bg-[#080A0D]">
        {children}
      </main>
    </div>
  )
}
