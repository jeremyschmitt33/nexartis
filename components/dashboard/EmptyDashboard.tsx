'use client'

import Image from 'next/image'
import Link from 'next/link'

interface EmptyDashboardProps {
  userName?: string
  profilIncomplet?: boolean
}

const actionCards = [
  {
    icon: '📄',
    title: 'Nouveau devis',
    href: '/dashboard/devis/nouveau',
  },
  {
    icon: '🧾',
    title: 'Nouvelle facture',
    href: '/dashboard/factures/nouveau',
  },
  {
    icon: '👤',
    title: 'Nouveau client',
    href: '/dashboard/clients/nouveau',
  },
  {
    icon: '📅',
    title: 'Planning',
    href: '/dashboard/planning',
  },
]

export default function EmptyDashboard({ userName, profilIncomplet }: EmptyDashboardProps) {
  return (
    <div className="min-h-screen bg-gray-50/50 flex items-start justify-center">
      <div className="max-w-2xl w-full mx-auto py-16 px-4 text-center">
        <Image
          src="/images/logo-nexartis.png"
          alt="Nexartis"
          width={480}
          height={240}
          quality={100}
          priority
          className="h-28 w-auto mx-auto object-contain"
        />

        <h1 className="font-syne font-extrabold text-2xl text-[#1a1a2e] mt-6">
          Bienvenue sur Nexartis{userName ? `, ${userName}` : ''} !
        </h1>

        <p className="font-manrope text-[#6b7280] mt-2">
          Votre espace professionnel est prêt.
        </p>

        {profilIncomplet && (
          <div className="mt-8 rounded-xl border-2 border-amber-300 bg-amber-50 p-5 text-left">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">\u26a0\ufe0f</span>
              <div>
                <h3 className="font-syne font-bold text-[15px] text-amber-800 mb-1">Premi\u00e8re \u00e9tape : compl\u00e9tez votre profil</h3>
                <p className="font-manrope text-sm text-amber-700 mb-3">
                  Avant de cr\u00e9er vos premiers devis et factures, vous devez renseigner vos informations l\u00e9gales
                  (SIRET, assurance d\u00e9cennale, forme juridique...). C&apos;est obligatoire par la loi.
                </p>
                <Link href="/dashboard/parametres" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-syne font-bold text-sm hover:bg-amber-700 transition-colors">
                  Compl\u00e9ter mon profil
                </Link>
              </div>
            </div>
          </div>
        )}

        <p className="font-syne font-semibold text-[#1a1a2e] mt-6">
          Que souhaitez-vous faire ?
        </p>

        <div className="grid grid-cols-2 gap-4 mt-8">
          {actionCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:border-[#5ab4e0] hover:shadow-md transition cursor-pointer"
            >
              <span className="text-3xl">{card.icon}</span>
              <p className="font-syne font-semibold text-[#1a1a2e] mt-3">
                {card.title}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
