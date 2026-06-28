'use client'

import { X, Images, ArrowLeftRight, Pencil, ListChecks, CheckSquare } from 'lucide-react'
import type { PageType } from '@/lib/rapport/page-content'

const TILES: { type: PageType; title: string; desc: string; icon: React.ReactNode; group: 'top' | 'more' }[] = [
  { type: 'photos', title: 'Photos', desc: '1 à 4 photos + commentaire', icon: <Images size={20} />, group: 'top' },
  { type: 'avap', title: 'Avant / Après', desc: 'empilé, avec mesure', icon: <ArrowLeftRight size={20} />, group: 'top' },
  { type: 'texte', title: 'Texte libre', desc: 'titre + paragraphe', icon: <Pencil size={20} />, group: 'more' },
  { type: 'constat', title: 'Constatations', desc: 'liste à puces', icon: <ListChecks size={20} />, group: 'more' },
  { type: 'fin', title: 'Page de fin', desc: 'contrôles · conclusion', icon: <CheckSquare size={20} />, group: 'more' },
]

export default function AddPageSheet({ open, onClose, onAdd }: {
  open: boolean
  onClose: () => void
  onAdd: (type: PageType) => void
}) {
  if (!open) return null
  const top = TILES.filter((t) => t.group === 'top')
  const more = TILES.filter((t) => t.group === 'more')

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-hanken font-extrabold text-lg text-navy">Ajouter une page</h2>
          <button aria-label="Fermer" onClick={onClose} className="text-gray-400 hover:text-navy"><X size={20} /></button>
        </div>
        <p className="font-hanken text-xs text-gray-500 mb-4">Choisissez le type, vous n&apos;aurez qu&apos;à remplir.</p>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {top.map((t) => (
            <button key={t.type} onClick={() => { onAdd(t.type); onClose() }}
              className="text-left border border-gray-200 rounded-xl p-3 hover:border-orange hover:shadow-sm transition">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-sky/10 text-sky-dark mb-2">{t.icon}</span>
              <p className="font-hanken font-bold text-sm text-navy leading-tight">{t.title}</p>
              <p className="font-hanken text-[11px] text-gray-500">{t.desc}</p>
            </button>
          ))}
        </div>

        <p className="font-hanken text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Texte &amp; structure</p>
        <div className="space-y-1.5">
          {more.map((t) => (
            <button key={t.type} onClick={() => { onAdd(t.type); onClose() }}
              className="w-full flex items-center gap-3 border border-gray-200 rounded-xl p-3 hover:border-orange transition text-left">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-600">{t.icon}</span>
              <span><span className="block font-hanken font-bold text-sm text-navy leading-tight">{t.title}</span>
                <span className="block font-hanken text-[11px] text-gray-500">{t.desc}</span></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
