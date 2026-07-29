'use client'

import React, { useState, useRef, useEffect } from 'react'
import { consultarAsistente } from '@/app/actions/asistente'

interface MensajeChat {
  id: string
  emisor: 'usuario' | 'asistente'
  texto: string
  timestamp: string
}

export default function AsistenteWidgetAdmin() {
  const [desplegado, setDesplegado] = useState(false)
  const [inputTexto, setInputTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensajes, setMensajes] = useState<MensajeChat[]>([
    {
      id: 'bienvenida',
      emisor: 'asistente',
      texto:
        'Hola Administrador. Soy el asistente de SAO Bar. Puedes consultarme procedimientos del bar o datos en tiempo real sobre inventario y caja.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll automático al final del chat cuando llega un nuevo mensaje
  useEffect(() => {
    if (desplegado) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensajes, desplegado, cargando])

  const manejarEnvio = async (textoAEnviar?: string) => {
    const consulta = textoAEnviar || inputTexto
    if (!consulta || consulta.trim().length === 0 || cargando) return

    const idUsuario = `usr_${Date.now()}`
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const nuevoMensajeUsuario: MensajeChat = {
      id: idUsuario,
      emisor: 'usuario',
      texto: consulta.trim(),
      timestamp: hora,
    }

    setMensajes((prev) => [...prev, nuevoMensajeUsuario])
    if (!textoAEnviar) setInputTexto('')
    setCargando(true)

    try {
      const res = await consultarAsistente(consulta.trim())
      const idAsistente = `ast_${Date.now()}`
      const horaRes = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      if (res.ok && res.respuesta) {
        setMensajes((prev) => [
          ...prev,
          {
            id: idAsistente,
            emisor: 'asistente',
            texto: res.respuesta!,
            timestamp: horaRes,
          },
        ])
      } else {
        setMensajes((prev) => [
          ...prev,
          {
            id: idAsistente,
            emisor: 'asistente',
            texto: res.error || 'Ocurrió un error al procesar tu consulta.',
            timestamp: horaRes,
          },
        ])
      }
    } catch (err: any) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          emisor: 'asistente',
          texto: 'Error de conexión con el servicio del asistente.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setCargando(false)
    }
  }

  const preguntasSugeridas = [
    '¿Cómo viene la caja hoy?',
    '¿Qué productos tienen stock bajo?',
    '¿Cuándo usar stock compartido?',
    '¿Cómo se hace la auditoría?',
  ]

  return (
    <div className="fixed bottom-0 right-[432px] z-50 flex flex-col items-end print:hidden select-none">
      {/* POPUP EMERGENTE DEL CHAT (ESTADO DESPLEGADO) */}
      {desplegado && (
        <div className="w-[380px] sm:w-[410px] h-[520px] bg-[#1A1A1A] border border-[#30CFF2]/30 rounded-t-xl shadow-[0_-8px_30px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden mb-0 transition-all duration-300 animate-in slide-in-from-bottom-5">
          {/* Cabecera del Chat Emergente */}
          <div className="h-12 bg-[#121417] border-b border-[#30CFF2]/20 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#30CFF2] animate-pulse shadow-[0_0_8px_#30CFF2]" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#F2F2F2] tracking-wider uppercase font-livvic">
                  Asistente SAO Bar
                </span>
                <span className="text-[10px] text-[#30CFF2] font-livvic">
                  En línea
                </span>
              </div>
            </div>

            {/* Botón de Plegar / Minimizar estilo Solapa */}
            <button
              onClick={() => setDesplegado(false)}
              className="p-1.5 rounded-lg text-[#9D9D9D] hover:text-[#F2F2F2] hover:bg-[#24272C] transition-colors"
              title="Minimizar chat"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Área de Conversación / Historial */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#080A0D]/60 custom-scrollbar">
            {mensajes.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.emisor === 'usuario' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[86%] px-3.5 py-2.5 rounded-xl text-xs leading-relaxed font-livvic ${
                    msg.emisor === 'usuario'
                      ? 'bg-[#F26A1B] text-[#F2F2F2] rounded-br-none shadow-[0_2px_8px_rgba(242,106,27,0.25)]'
                      : 'bg-[#24272C] text-[#F2F2F2] border border-[#30CFF2]/20 rounded-bl-none shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.texto}</p>
                </div>
                <span className="text-[9px] text-[#9D9D9D] mt-1 px-1 font-livvic">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {/* Indicador visual de cargando/pensando */}
            {cargando && (
              <div className="flex items-center gap-2 text-xs text-[#30CFF2] font-livvic bg-[#24272C]/80 px-3 py-2 rounded-lg border border-[#30CFF2]/30 w-fit animate-pulse">
                <span className="w-2 h-2 rounded-full bg-[#30CFF2] animate-ping" />
                <span>Consultando inventario y procedimientos...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chips de Consultas Rápidas Sugeridas */}
          {mensajes.length <= 2 && !cargando && (
            <div className="px-3 py-2 bg-[#121417] border-t border-[#30CFF2]/10 flex flex-wrap gap-1.5">
              {preguntasSugeridas.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => manejarEnvio(sug)}
                  className="text-[10px] font-livvic bg-[#24272C] text-[#30CFF2] hover:bg-[#30CFF2] hover:text-[#080A0D] border border-[#30CFF2]/30 px-2 py-1 rounded-md transition-all text-left"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Pie de Chat (Input + Enviar) */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              manejarEnvio()
            }}
            className="p-3 bg-[#121417] border-t border-[#30CFF2]/20 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              placeholder="Escribe tu consulta al asistente..."
              disabled={cargando}
              className="flex-1 bg-[#080A0D] border border-[#9D9D9D]/30 rounded-lg px-3 py-2 text-xs text-[#F2F2F2] placeholder-[#9D9D9D] focus:outline-none focus:border-[#30CFF2] transition-colors font-livvic disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={cargando || !inputTexto.trim()}
              className="bg-[#F26A1B] hover:bg-[#F25922] disabled:opacity-40 text-[#F2F2F2] px-3 py-2 rounded-lg font-livvic text-xs font-semibold tracking-wide transition-all shadow-[0_0_10px_rgba(242,106,27,0.3)] flex items-center justify-center shrink-0"
            >
              Enviar
            </button>
          </form>
        </div>
      )}

      {/* SOLAPA TIPO ETIQUETA / LABEL DE ARCHIVERO (ESTADO STICKY PERMANENTE AL PIE) */}
      <button
        onClick={() => setDesplegado(!desplegado)}
        className={`h-9 px-4 bg-[#1A1A1A] border-t border-x border-[#30CFF2]/40 rounded-t-lg shadow-[0_-4px_16px_rgba(48,207,242,0.2)] flex items-center gap-2.5 cursor-pointer transition-all duration-200 hover:bg-[#24272C] group ${
          desplegado ? 'border-b-0 bg-[#121417]' : ''
        }`}
        title="Abrir Asistente IA SAO Bar"
      >
        <span className="w-2 h-2 rounded-full bg-[#30CFF2] animate-pulse shadow-[0_0_6px_#30CFF2]" />
        <span className="font-livvic text-xs font-semibold uppercase tracking-wider text-[#F2F2F2] group-hover:text-[#30CFF2] transition-colors">
          ASISTENTE
        </span>
        <span className="text-[#30CFF2] text-xs font-bold transition-transform duration-200">
          {desplegado ? '▼' : '▲'}
        </span>
      </button>
    </div>
  )
}
