import React from 'react'
import AsistenteWidgetAdmin from '@/components/admin/AsistenteWidgetAdmin'

export default function AsistenteAdminPage() {
  return (
    <div className="flex-1 flex flex-col p-6 max-w-6xl w-full mx-auto font-livvic">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F2F2F2] tracking-wide flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#30CFF2] animate-pulse shadow-[0_0_10px_#30CFF2]" />
            Asistente IA de SAO Bar
          </h1>
          <p className="text-xs text-[#9D9D9D] mt-1">
            Motor de Inteligencia Artificial para consultas procedimentales (RAG) y estado de inventario/caja en tiempo real.
          </p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#30CFF2]/30 px-3 py-1.5 rounded-lg text-xs text-[#30CFF2] font-semibold">
          Estado: En línea
        </div>
      </div>

      <div className="flex-1 bg-[#1A1A1A] border border-[#9D9D9D]/15 rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-xl">
        <div className="w-16 h-16 rounded-full bg-[#30CFF2]/10 border border-[#30CFF2]/40 flex items-center justify-center mb-4">
          <span className="text-2xl text-[#30CFF2]">⚡</span>
        </div>
        <h2 className="text-lg font-semibold text-[#F2F2F2] mb-2">
          El Asistente IA está activo en la Solapa Emergente
        </h2>
        <p className="text-xs text-[#9D9D9D] max-w-md mb-6 leading-relaxed">
          Puedes consultar al asistente desde cualquier pantalla del Panel de Administración haciendo clic en la solapa tipo archivero ubicada en la esquina inferior derecha de la pantalla.
        </p>
      </div>
    </div>
  )
}
