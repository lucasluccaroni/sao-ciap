'use client'

import { useState } from 'react'
import { cerrarSesion } from '@/app/actions/auth'

export default function BotonSalirAdmin() {
  const [modalOpen, setModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogout = async () => {
    setIsSubmitting(true)
    const res = await cerrarSesion()
    if (res.success) {
      window.location.href = '/'
    } else {
      setIsSubmitting(false)
      setModalOpen(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="h-8 px-4 border border-[#9D9D9D]/20 bg-[#2E2E2E]/40 hover:bg-[#2E2E2E]/80 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] rounded transition-all cursor-pointer uppercase tracking-wider"
      >
        Salir
      </button>

      {/* Modal de Confirmación de Cierre de Sesión */}
      {modalOpen && (
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
                Se cerrará la sesión actual de la terminal de administración.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  disabled={isSubmitting}
                  className="h-11 border border-white/10 bg-transparent hover:bg-white/5 text-white/80 hover:text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLogout}
                  disabled={isSubmitting}
                  className="h-11 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-lg active:scale-[0.99] disabled:opacity-50"
                >
                  {isSubmitting ? 'Saliendo...' : 'Salir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
