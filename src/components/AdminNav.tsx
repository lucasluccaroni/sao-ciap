'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminNav() {
  const pathname = usePathname()

  const links = [
    { name: 'Productos', href: '/admin/productos' },
    { name: 'Comandas', href: '/admin/comandas' },
    { name: 'Caja', href: '/admin/caja' },
    { name: 'Cierre', href: '/admin/cierre' },
    { name: 'Historial', href: '/admin/historial' },
    { name: 'Calculadora', href: '/admin/calculadora' },
  ]

  return (
    <nav className="hidden md:flex items-center gap-6 h-full font-livvic text-sm font-medium">
      {links.map((link) => {
        // La sección activa se determina si la ruta coincide exactamente
        // o si es una subruta de la misma sección (ej: /admin/productos/nuevo)
        const isActive = pathname === link.href || pathname?.startsWith(link.href + '/')

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`transition-colors relative flex items-center h-full cursor-pointer select-none ${
              isActive
                ? 'text-[#F2F2F2] after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-[#30CFF2]'
                : 'text-[#9D9D9D] hover:text-[#F2F2F2] hover:after:content-[""] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#30CFF2]'
            }`}
          >
            {link.name}
          </Link>
        )
      })}
    </nav>
  )
}
