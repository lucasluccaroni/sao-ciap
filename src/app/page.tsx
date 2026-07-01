'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { iniciarSesion } from '@/app/actions/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email || !password) {
      setErrorMsg('Por favor, completa todos los campos.')
      return
    }

    setIsLoading(true)

    // Agregamos un leve delay para apreciar la animación premium de carga del fantasma
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    
    try {
      const [res] = await Promise.all([
        iniciarSesion(email, password),
        delay(1800), // Mínimo 1.8 segundos de carga animada
      ])

      if (!res.success) {
        setErrorMsg(res.error || 'Ocurrió un error al iniciar sesión.')
        setIsLoading(false)
        return
      }

      // Redirigir según el rol obtenido
      if (res.rol === 'Admin') {
        window.location.href = '/admin/caja'
      } else {
        window.location.href = '/comandas'
      }
    } catch (err: any) {
      setErrorMsg('Error de conexión con el servidor.')
      setIsLoading(false)
    }
  }

  // Render para el estado de "Cargando" con el fantasma latiendo
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080A0D]">
        <div className="relative flex flex-col items-center">
          {/* Contenedor con efecto de resplandor para el fantasma */}
          {/* Se añade -translate-x-6 para compensar visualmente la cola del fantasma y centrarlo sobre el texto */}
          <div className="relative w-44 h-44 mb-8 flex items-center justify-center animate-heartbeat -translate-x-6">
            <Image
              src="/images/fantasma.png"
              alt="Fantasma cargando"
              fill
              sizes="176px"
              className="object-contain filter drop-shadow-[0_0_20px_rgba(242,106,27,0.4)]"
              priority
            />
          </div>
          {/* Texto de carga en tipografía Creepster */}
          <h2 className="font-creepster text-4xl tracking-widest text-[#F26A1B] text-center select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            CARGANDO...
          </h2>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#080A0D] overflow-hidden">
      {/* Capa de fondo con marca de agua (Patrón de fantasma) */}
      <div className="absolute inset-0 bg-phantom-pattern opacity-[0.03] pointer-events-none select-none" />

      {/* Gradiente radial de fondo para dar profundidad (Estética Premium) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(242,106,27,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Contenedor principal del Login */}
      <div className="relative w-full max-w-[440px] px-6 py-12 flex flex-col items-center z-10">
        
        {/* Cabecera / Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-28 h-28 mb-3 rounded-full border-2 border-[#30CFF2]/40 bg-[#080A0D] p-1 flex items-center justify-center shadow-[0_0_15px_rgba(48,207,242,0.2)]">
            <Image
              src="/images/sao-logo.png"
              alt="SAO Logo"
              width={100}
              height={100}
              style={{ width: 'auto', height: 'auto' }}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="font-creepster text-5xl text-[#F2F2F2] tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            SAO
          </h1>
          <p className="font-livvic text-xs text-[#9D9D9D] uppercase tracking-widest mt-1">
            Sistema de gestión
          </p>
        </div>

        {/* Tarjeta del Formulario (Naranja de marca #F26A1B) */}
        <div className="w-full bg-[#F26A1B] rounded-2xl p-8 shadow-[0_10px_30px_rgba(242,106,27,0.25)] border border-[#F25922]">
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            
            {/* Mensaje de Error */}
            {errorMsg && (
              <div className="w-full bg-[#E2484A] text-[#F2F2F2] font-livvic text-xs font-semibold py-2.5 px-3 rounded-lg border border-red-700/50 shadow-inner flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Input Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="font-livvic text-xs font-semibold text-[#F2F2F2] tracking-wide uppercase">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="nombre@saobar.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 bg-[#1A1A1A] border border-[#9D9D9D]/40 rounded-lg font-livvic text-sm text-[#F2F2F2] placeholder-[#9D9D9D]/60 focus:outline-none focus:border-[#F25922] focus:ring-2 focus:ring-[#F25922]/20 transition-all shadow-inner"
                autoComplete="email"
              />
            </div>

            {/* Input Contraseña */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="font-livvic text-xs font-semibold text-[#F2F2F2] tracking-wide uppercase">
                  Contraseña
                </label>
              </div>
              <div className="relative w-full">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-3.5 pr-20 bg-[#1A1A1A] border border-[#9D9D9D]/40 rounded-lg font-livvic text-sm text-[#F2F2F2] placeholder-[#9D9D9D]/60 focus:outline-none focus:border-[#F25922] focus:ring-2 focus:ring-[#F25922]/20 transition-all shadow-inner"
                  autoComplete="current-password"
                />
                {/* Botón Mostrar/Ocultar contraseña */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-semibold text-[#9D9D9D] hover:text-[#F2F2F2] transition-colors focus:outline-none uppercase tracking-wider"
                >
                  {showPassword ? 'ocultar' : 'mostrar'}
                </button>
              </div>
            </div>

            {/* Botón Ingresar (Azul #378ADD) */}
            <button
              type="submit"
              className="w-full h-12 mt-2 bg-[#378ADD] hover:bg-[#378ADD]/90 text-[#F2F2F2] font-livvic text-sm font-bold uppercase tracking-wider rounded-lg shadow-lg active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center"
            >
              Ingresar
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="font-livvic text-xs text-[#9D9D9D]/80 text-center mt-8 select-none">
          ¿Problemas para acceder? Contactá al administrador.
        </p>
      </div>
    </div>
  )
}
