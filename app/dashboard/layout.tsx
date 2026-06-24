'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser, useEntreprise, useDevis, useFactures } from '@/lib/hooks'
// Push 2 — menu + garde de route par rôle (sans effet pour dirigeant / role=null)
import { useCurrentRole } from '@/lib/hooks-equipe'
import { canAccessDashboardPath, DEFAULT_LANDING, type UserRole } from '@/lib/roles'
import { applySidebarTheme } from '@/components/ThemeSelector'
import {
  isRouteBlockedForPlan,
  getFeatureFromBlockedRoute,
  getEffectivePlan,
  isPremiumNavItem,
  type PlanId,
} from '@/lib/plans'
// Chargement à la demande (next/dynamic, ssr:false) : composants non critiques
// / rarement visibles au premier paint. On allège le JS initial du dashboard
// pour accélérer le rendu sur ordinateurs anciens. Tous sont des `export default`.
// NB : VoiceProvider reste un import STATIQUE (Provider de contexte qui enveloppe
// tout l'arbre — il doit être présent dès le rendu initial).
const OnboardingTour = dynamic(() => import('@/components/OnboardingTour'), { ssr: false })
const ContactFloatingButton = dynamic(() => import('@/components/dashboard/ContactFloatingButton'), { ssr: false })
const InstallReminderBanner = dynamic(() => import('@/components/InstallReminderBanner'), { ssr: false })
const PWAUpdateToast = dynamic(() => import('@/components/PWAUpdateToast'), { ssr: false })
const UniversalVoiceButton = dynamic(() => import('@/components/voice/UniversalVoiceButton'), { ssr: false })
// Filet de securite (invisible) de la capture de parrainage : rattache le filleul
// a son parrain si le cookie nexartis_ref est present (couvre l'inscription Google).
const ParrainageCapture = dynamic(() => import('@/components/ParrainageCapture'), { ssr: false })
import { VoiceProvider } from '@/components/voice/VoiceProvider'
import {
  Home,
  LayoutGrid,
  FilePenLine,
  Banknote,
  ShoppingBag,
  CalendarDays,
  UserRound,
  Warehouse,
  UsersRound,
  Library,
  TrendingUp,
  ArrowDownToLine,
  SlidersHorizontal,
  Bell,
  Menu,
  X,
  MoreHorizontal,
  LogOut,
  ChevronDown,
  ChevronLeft,
  FileText,
  Receipt,
  Calendar,
  Shield,
  Trash2,
  Wrench,
  CreditCard,
  AlertTriangle,
  LifeBuoy,
  WifiOff,
  Calculator,
  Landmark,
} from 'lucide-react'

const ADMIN_EMAIL = 'admin@nexartis.fr'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const NAV_GROUPS: NavItem[][] = [
  [{ label: 'Accueil', href: '/dashboard', icon: Home }],
  [
    { label: 'Devis', href: '/dashboard/devis', icon: FilePenLine },
    { label: 'Planning', href: '/dashboard/planning', icon: CalendarDays },
    { label: 'Chantiers', href: '/dashboard/chantiers', icon: LayoutGrid },
    { label: 'Factures', href: '/dashboard/factures', icon: Banknote },
    { label: 'Achats', href: '/dashboard/achats', icon: ShoppingBag },
  ],
  [
    { label: 'Clients', href: '/dashboard/clients', icon: UserRound },
    { label: 'Fournisseurs', href: '/dashboard/fournisseurs', icon: Warehouse },
    { label: 'Mon\u00a0équipe', href: '/dashboard/equipe', icon: UsersRound },
    { label: 'Matériel', href: '/dashboard/materiel', icon: Wrench },
  ],
  [
    { label: 'Statistiques', href: '/dashboard/statistiques', icon: TrendingUp },
    { label: 'URSSAF', href: '/dashboard/urssaf', icon: Landmark },
    { label: 'Prestations', href: '/dashboard/prestations', icon: FileText },
    { label: 'Calculatrices', href: '/dashboard/calculatrice', icon: Calculator },
    { label: 'Abonnement', href: '/dashboard/abonnement', icon: CreditCard },
    { label: 'Paramètres', href: '/dashboard/parametres', icon: SlidersHorizontal },
    { label: 'Importer', href: '/dashboard/import', icon: ArrowDownToLine },
    { label: 'Corbeille', href: '/dashboard/corbeille', icon: Trash2 },
  ],
  // Groupe séparé "Aide" — placé en tout dernier pour bien distinguer
  // le métier (au-dessus) de la documentation utilisateur (en bas).
  [
    { label: 'Aide & Tutoriels', href: '/dashboard/aide', icon: LifeBuoy },
  ],
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/dashboard/chantiers': 'Chantiers',
  '/dashboard/devis': 'Devis',
  '/dashboard/devis/nouveau': 'Nouveau devis',
  '/dashboard/factures': 'Factures',
  '/dashboard/factures/nouveau': 'Nouvelle facture',
  '/dashboard/achats': 'Achats',
  '/dashboard/planning': 'Planning',
  '/dashboard/clients': 'Clients',
  '/dashboard/fournisseurs': 'Fournisseurs',
  '/dashboard/equipe': 'Mon équipe',
  '/dashboard/materiel': 'Matériel',
  '/dashboard/bibliotheque': 'Bibliothèque',
  '/dashboard/statistiques': 'Statistiques',
  '/dashboard/urssaf': 'Aide à la déclaration URSSAF',
  '/dashboard/prestations': 'Prestations',
  '/dashboard/catalogue': 'Catalogue de prestations',
  '/dashboard/calculatrice': 'Calculatrices',
  '/dashboard/import': 'Importer des données',
  '/dashboard/abonnement': 'Abonnement',
  '/dashboard/parametres': 'Paramètres',
  '/dashboard/corbeille': 'Corbeille',
  '/dashboard/admin': 'Administration',
  '/dashboard/admin/parrainages': 'Parrainages',
  '/dashboard/aide': 'Aide & Tutoriels',
}

const CREATE_OPTIONS = [
  { label: 'Nouveau devis', href: '/dashboard/devis/nouveau' },
  { label: 'Nouvelle facture', href: '/dashboard/factures/nouveau' },
  { label: 'Nouveau chantier', href: '/dashboard/chantiers/nouveau' },
  { label: 'Nouveau client', href: '/dashboard/clients/nouveau' },
  { label: '🎤 Devis par la voix', href: '/dashboard/devis/nouveau?voice=1' },
]

const BOTTOM_NAV: NavItem[] = [
  { label: 'Accueil', href: '/dashboard', icon: Home },
  { label: 'Devis', href: '/dashboard/devis', icon: FilePenLine },
  { label: 'Factures', href: '/dashboard/factures', icon: Banknote },
  { label: 'Planning', href: '/dashboard/planning', icon: CalendarDays },
  { label: 'Plus...', href: '#more', icon: MoreHorizontal },
]

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // Fallback: find the closest parent match
  const segments = pathname.split('/')
  while (segments.length > 1) {
    segments.pop()
    const parent = segments.join('/')
    if (PAGE_TITLES[parent]) return PAGE_TITLES[parent]
  }
  return 'Tableau de bord'
}

function getInitials(prenom?: string, nom?: string): string {
  const first = prenom?.charAt(0)?.toUpperCase() || ''
  const last = nom?.charAt(0)?.toUpperCase() || ''
  return first + last || '?'
}

function getDisplayName(prenom?: string, nom?: string, email?: string): string {
  if (prenom && nom) return `${prenom} ${nom}`
  if (prenom) return prenom
  if (nom) return nom
  return email || ''
}

// -------------------------------------------------------------------
// Sidebar component
// -------------------------------------------------------------------

function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  pathname,
  userInitials,
  userName,
  userEmail,
  entrepriseNom,
  entrepriseMetier,
  entrepriseLogo,
  userLoading,
  effectivePlan,
  isTrial,
  badges,
  role,
}: {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
  pathname: string
  userInitials: string
  userName: string
  userEmail: string
  entrepriseNom: string
  entrepriseMetier: string
  entrepriseLogo: string
  userLoading: boolean
  effectivePlan: PlanId
  isTrial: boolean
  /** QW2 -- Compteurs alertes par route */
  badges?: Record<string, number>
  /** Push 2 — rôle du membre courant (null = dirigeant legacy / inconnu → voit tout) */
  role: UserRole | null
}) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const createRef = useRef<HTMLDivElement>(null)

  // Close create dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const w = collapsed ? 'w-16' : 'w-64'

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        style={{ backgroundColor: 'var(--nexartis-sidebar-bg, #0f1a3a)' }}
        className={`
          fixed top-0 left-0 z-50 h-full flex flex-col overflow-y-auto overflow-x-hidden
          transition-all duration-200 ease-in-out
          ${w}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* ---- Top: Logo + Nom entreprise ---- */}
        <div className={`flex flex-col items-center px-4 pt-6 pb-4 ${collapsed ? 'pt-4 pb-2' : ''}`}>
          {/* Logo de l'artisan : affiché UNIQUEMENT s'il a uploadé son logo.
              Sinon on laisse l'espace bleu pour ne pas afficher le logo Nexartis.
              Le nom de l'entreprise est ensuite affiché en dessous. */}
          {entrepriseLogo && (
            <div
              className="mb-3 bg-white inline-flex items-center justify-center"
              style={{
                borderRadius: collapsed ? 8 : 10,
                padding: collapsed ? 3 : 5,
                maxWidth: collapsed ? 48 : '92%',
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entrepriseLogo}
                alt={entrepriseNom || 'Logo'}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: collapsed ? 40 : 110,
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}

          {/* Nom entreprise centré, taille adaptée selon présence du logo :
              - SI logo présent : nom petit en dessous
              - SI pas de logo : nom plus grand pour occuper l'espace */}
          {!collapsed && !userLoading && (
            <p
              className={`font-hanken font-extrabold text-white text-center leading-tight max-w-full break-words px-2 tracking-tight ${
                entrepriseLogo ? 'text-sm truncate' : 'text-xl py-6'
              }`}
            >
              {entrepriseNom || 'Mon Entreprise'}
            </p>
          )}
          {/* En mode collapsed (sidebar réduite) sans logo : afficher initiales */}
          {collapsed && !entrepriseLogo && !userLoading && entrepriseNom && (
            <div className="w-11 h-11 rounded-lg bg-white/15 flex items-center justify-center mb-3">
              <span className="font-hanken font-extrabold text-white text-base">
                {entrepriseNom
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
            </div>
          )}

          {/* QW7 -- Mobile close */}
          {mobileOpen && (
            <button
              onClick={onCloseMobile}
              aria-label="Fermer le menu"
              className="absolute top-4 right-4 text-white/60 hover:text-white md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* ---- Create button ---- */}
        <div className={`px-3 mb-2 ${collapsed ? 'px-2' : ''}`} ref={createRef}>
          <button
            onClick={() => setCreateOpen(!createOpen)}
            style={{ backgroundColor: 'var(--nexartis-accent, #e87a2a)' }}
            className={`
              w-full h-11 rounded-lg text-white font-hanken font-bold
              flex items-center justify-center gap-2 transition-all duration-100
              hover:brightness-110
              ${collapsed ? 'px-0' : ''}
            `}
          >
            <span className="text-lg leading-none">+</span>
            {!collapsed && <span>Créer</span>}
          </button>

          {createOpen && (
            <div className="mt-1 rounded-lg bg-white shadow-xl border border-gray-200 overflow-hidden z-50 relative">
              {CREATE_OPTIONS
                // Devis vocal réservé au plan Complet (et au trial pour test)
                .filter((opt) => {
                  const isVoiceOption = opt.href.includes('voice=')
                  if (!isVoiceOption) return true
                  return isTrial || effectivePlan === 'complete'
                })
                .map((opt) => (
                  <Link
                    key={opt.href}
                    href={opt.href}
                    onClick={() => {
                      setCreateOpen(false)
                      onCloseMobile()
                    }}
                    className="block px-4 py-2.5 text-sm text-[#0f1a3a] font-hanken hover:bg-gray-50 transition-colors duration-100"
                  >
                    {opt.label}
                  </Link>
                ))}
            </div>
          )}
        </div>

        {/* QW6 -- Input "Accès rapide..." retiré (pas câblé) */}
        {!collapsed && <div className="mb-2" />}

        {/* ---- Navigation ---- */}
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV_GROUPS
            // Push 2 — filtrage par rôle. role=null (dirigeant legacy / inconnu) ou
            // dirigeant → canAccessDashboardPath renvoie true partout : menu INCHANGÉ.
            .map((group) =>
              group.filter((item) => role === null || canAccessDashboardPath(role, item.href)),
            )
            // On masque les groupes devenus vides pour éviter un <hr> orphelin.
            .map((group, gi) => ({ group, gi }))
            .filter(({ group }) => group.length > 0)
            .map(({ group, gi }) => (
            <div key={gi}>
              {gi > 0 && <hr className="border-white/[0.06] my-1 mx-2.5" />}
              {group.map((item) => {
                const active = isActive(pathname, item.href)
                const Icon = item.icon
                // Ancrage du spotlight onboarding sur les liens Paramètres,
                // Aide, Mon équipe (V1 Fix #7, mode Société uniquement) et
                // Matériel (V3 — bulle "Ton inventaire pro").
                // OnboardingTour cible ces attributs via querySelector.
                const tourId =
                  item.href === '/dashboard/parametres' ? 'parametres' :
                  item.href === '/dashboard/aide' ? 'aide' :
                  item.href === '/dashboard/equipe' ? 'equipe' :
                  item.href === '/dashboard/materiel' ? 'materiel' :
                  undefined
                // Item réservé au plan Complet → on affiche un badge ★ pour
                // les utilisateurs Essentiel hors période d'essai (incite à
                // l'upgrade au lieu d'un blocage silencieux).
                const isPremium = isPremiumNavItem(item.href)
                const showPremiumBadge = isPremium && !isTrial && effectivePlan === 'essential'
                // QW2 -- Badge orange
                const badgeCount = badges?.[item.href] ?? 0
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? `${item.label}${showPremiumBadge ? ' (offre Complet)' : ''}` : undefined}
                    data-tour={tourId}
                    className={`
                      group/nav relative flex items-center rounded-lg text-[14px] font-hanken font-medium
                      transition-all duration-150 ease-out
                      ${collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 h-10 px-3 ml-1'}
                      ${
                        active
                          ? 'bg-[rgba(90,180,224,0.12)] text-white'
                          : showPremiumBadge
                            ? 'text-white/50 hover:bg-white/[0.05] hover:text-white/75'
                            : 'text-white/60 hover:bg-white/[0.05] hover:text-white/85'
                      }
                    `}
                  >
                    {/* Active indicator bar */}
                    {active && !collapsed && (
                      <span style={{ backgroundColor: 'var(--nexartis-accent, #e87a2a)' }} className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" />
                    )}
                    <Icon
                      size={19}
                      strokeWidth={active ? 2.2 : 1.8}
                      className={`flex-shrink-0 transition-all duration-150 ${
                        active
                          ? 'text-white'
                          : 'text-white/50 group-hover/nav:text-white/75'
                      }`}
                    />
                    {!collapsed && (
                      <span className={`truncate flex-1 ${active ? 'font-semibold' : ''}`}>
                        {item.label}
                      </span>
                    )}
                    {/* QW2 -- Pastille orange notification actions en attente */}
                    {badgeCount > 0 && !collapsed && !showPremiumBadge && (
                      <span
                        aria-label={`${badgeCount} action${badgeCount > 1 ? 's' : ''} en attente`}
                        className="ml-auto flex-none inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-extrabold leading-none"
                        style={{
                          background: 'var(--nexartis-accent, #e87a2a)',
                          color: '#fff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                    {badgeCount > 0 && collapsed && !showPremiumBadge && (
                      <span
                        aria-label={`${badgeCount} action${badgeCount > 1 ? 's' : ''} en attente`}
                        className="absolute top-1 right-1 w-2 h-2 rounded-full"
                        style={{ background: 'var(--nexartis-accent, #e87a2a)' }}
                      />
                    )}
                    {/* Badge ★ pour les items premium quand utilisateur Essentiel */}
                    {showPremiumBadge && !collapsed && (
                      <span
                        className="ml-auto flex-none text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                        style={{
                          color: '#ffc79a',
                          background: 'color-mix(in srgb, #ff7a1a 14%, transparent)',
                          borderColor: 'color-mix(in srgb, #ff7a1a 38%, transparent)',
                        }}
                        title="Disponible dans l'offre Complet"
                      >
                        ★
                      </span>
                    )}
                    {showPremiumBadge && collapsed && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                        style={{ background: '#ff9d4d', boxShadow: '0 0 6px #ff7a1a' }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}

          {/* ---- Lien Admin (visible uniquement pour admin@nexartis.fr) ---- */}
          {userEmail === ADMIN_EMAIL && (
            <>
              <hr className="border-white/[0.06] my-1 mx-2.5" />
              <Link
                href="/dashboard/admin"
                onClick={onCloseMobile}
                title={collapsed ? 'Admin' : undefined}
                className={`
                  group/nav relative flex items-center rounded-lg text-[14px] font-hanken font-medium
                  transition-all duration-150 ease-out
                  ${collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 h-10 px-3 ml-1'}
                  ${
                    isActive(pathname, '/dashboard/admin')
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-purple-400/70 hover:bg-purple-500/10 hover:text-purple-300'
                  }
                `}
              >
                {isActive(pathname, '/dashboard/admin') && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-purple-400" />
                )}
                <Shield size={19} strokeWidth={1.8} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">Admin</span>}
              </Link>
            </>
          )}
        </nav>

        {/* ---- Bottom: User ---- */}
        <div className={`mt-auto border-t border-white/[0.08] p-4 ${collapsed ? 'flex flex-col items-center px-2' : ''}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'flex-col' : ''}`}>
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#5ab4e0] flex items-center justify-center">
              {userLoading ? (
                <div className="w-5 h-3 bg-white/30 rounded animate-pulse" />
              ) : (
                <span className="text-white text-sm font-hanken font-extrabold">{userInitials}</span>
              )}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                {userLoading ? (
                  <div className="space-y-1 animate-pulse">
                    <div className="h-4 w-24 bg-white/10 rounded" />
                    <div className="h-3 w-20 bg-white/10 rounded" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-white font-medium truncate">{userName}</p>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors duration-100"
                    >
                      <LogOut size={12} />
                      Se déconnecter
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

// -------------------------------------------------------------------
// Header component
// -------------------------------------------------------------------

function DashboardHeader({
  title,
  onMenuClick,
  userInitials,
  userLoading,
  showBack,
  onBack,
}: {
  title: string
  onMenuClick: () => void
  userInitials: string
  userLoading: boolean
  /** QW4 -- Affiche flèche retour */
  showBack: boolean
  /** Handler clic retour */
  onBack: () => void
}) {
  return (
    <header className="sticky top-0 z-30 h-[60px] bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 gap-3">
      <button
        onClick={onMenuClick}
        aria-label="Ouvrir le menu"
        className="p-1.5 rounded-md hover:bg-gray-100 md:hidden transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <Menu size={22} className="text-[#1a1a2e]" aria-hidden="true" />
      </button>
      {/* QW4 -- Bouton retour */}
      {showBack && (
        <button
          onClick={onBack}
          aria-label="Revenir à la page précédente"
          className="rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
        >
          <ChevronLeft size={22} className="text-[#1a1a2e]" aria-hidden="true" />
        </button>
      )}
      <h1 className="font-hanken font-extrabold text-base sm:text-xl text-[#1a1a2e] tracking-tight truncate flex-1">{title}</h1>
      {/* Commande vocale universelle V3.1 — icone sur mobile, pilule "Dicter" sur desktop */}
      <UniversalVoiceButton variant="icon" className="md:hidden" />
      <UniversalVoiceButton variant="pill" className="hidden md:inline-flex" />
    </header>
  )
}

// -------------------------------------------------------------------
// Mobile bottom nav
// -------------------------------------------------------------------

function MobileBottomNav({
  pathname,
  onMoreClick,
  role,
}: {
  pathname: string
  onMoreClick: () => void
  /** Push 2 — rôle du membre courant (null = dirigeant legacy → tout visible) */
  role: UserRole | null
}) {
  // Push 2 — on filtre les onglets du bas par rôle (un Ouvrier ne voit pas
  // Devis/Factures). '#more' n'est pas une route → toujours conservé (il ouvre
  // le menu complet, lui-même déjà filtré). role=null/dirigeant → INCHANGÉ.
  const visibleNav = BOTTOM_NAV.filter(
    (item) =>
      item.href === '#more' ||
      role === null ||
      canAccessDashboardPath(role, item.href),
  )
  // V3.0d.2 — Bottom nav premium :
  //   - Pill orange douce (gradient orange/20 -> orange/10) sous l'icone active
  //   - Barre indicatrice orange au-dessus de l'item actif
  //   - Backdrop-blur pour effet glassmorphisme leger
  //   - Police Hanken Grotesk + label bold quand actif
  //   - Touch target >= 56px (padding total), safe-area-inset-bottom pour iOS
  //   - Animation tap (active:scale-95)
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-start justify-around md:hidden shadow-[0_-8px_24px_-12px_rgba(15,26,58,0.08)]"
      style={{ paddingTop: 10, paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)' }}
    >
      {visibleNav.map((item) => {
        const Icon = item.icon
        const active = item.href !== '#more' && isActive(pathname, item.href)
        const isMore = item.href === '#more'

        const inner = (
          <>
            <div
              className={`w-[50px] h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                active
                  ? 'bg-gradient-to-br from-orange/20 to-orange/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]'
                  : ''
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 2} />
            </div>
            <span
              className={`text-[10.5px] font-hanken mt-0.5 leading-tight ${
                active ? 'font-bold' : 'font-medium'
              }`}
            >
              {item.label}
            </span>
          </>
        )

        const baseCls = `relative flex-1 flex flex-col items-center gap-0 py-1.5 transition-all duration-200 active:scale-95 ${
          active ? 'text-orange' : 'text-gray-500'
        }`

        if (isMore) {
          return (
            <button
              key="more"
              onClick={onMoreClick}
              aria-label="Ouvrir le menu complet"
              className={baseCls}
            >
              {inner}
            </button>
          )
        }

        return (
          <Link key={item.href} href={item.href} className={baseCls}>
            {active && (
              <span
                aria-hidden="true"
                className="absolute -top-[10px] left-1/2 -translate-x-1/2 w-[34px] h-[3px] bg-orange rounded-b"
              />
            )}
            {inner}
          </Link>
        )
      })}
    </nav>
  )
}

// -------------------------------------------------------------------
// Layout
// -------------------------------------------------------------------

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [hovered, setHovered] = useState(false)

  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { entreprise, loading: entrepriseLoading } = useEntreprise()
  // Push 2 — rôle du membre courant. role=null = compte legacy (dirigeant
  // historique) ou inconnu : on NE change RIEN (menu complet + aucune garde).
  const { role, loading: roleLoading } = useCurrentRole()
  // QW2 -- Data pour badges sidebar
  const { data: devisData } = useDevis()
  const { data: facturesData } = useFactures()

  const isLoading = userLoading || entrepriseLoading

  // Applique le thème de couleur sidebar choisi par l'utilisateur (stocké en localStorage).
  // À chaque mount du dashboard on lit la valeur et on injecte la CSS variable
  // `--nexartis-accent` sur <html>. Sans choix → fallback orange Nexartis.
  useEffect(() => {
    applySidebarTheme()
  }, [])

  // Vérification expiration période d'essai (14 jours)
  // EXCEPTION : la page /dashboard/abonnement n'est jamais bloquée,
  // sinon un utilisateur expiré ne pourrait pas se réabonner.
  // Quand expiré : redirection directe vers /dashboard/abonnement (seule page accessible).
  useEffect(() => {
    if (isLoading || !entreprise || !user) return
    // L'admin ne vérifie jamais
    if (user.email === ADMIN_EMAIL) return
    // Déjà sur la page abonnement → pas de boucle ni de blocage
    if (pathname.startsWith('/dashboard/abonnement')) return

    const redirectExpired = () => router.replace('/dashboard/abonnement?expired=1')

    const abonnementType = (entreprise.abonnement_type as string) ?? 'trial'
    // Abonnement actif ou à vie → pas de blocage
    if (abonnementType === 'lifetime' || abonnementType === 'actif') return
    // Suspendu : laisser passer si la période payée n'est pas encore terminée
    if (abonnementType === 'suspendu') {
      const expireAt = entreprise.abonnement_expire_at
        ? new Date(entreprise.abonnement_expire_at as string)
        : null
      if (!expireAt || expireAt < new Date()) {
        redirectExpired()
      }
      return
    }
    // Trial → vérifier les 14 jours
    const trialStarted = entreprise.trial_started_at
      ? new Date(entreprise.trial_started_at as string)
      : new Date(entreprise.created_at as string)
    const msEcoules = Date.now() - trialStarted.getTime()
    const joursEcoules = msEcoules / (1000 * 60 * 60 * 24)
    if (joursEcoules > 14) {
      redirectExpired()
    }
  }, [isLoading, entreprise, user, pathname, router])

  // ─────────────────────────────────────────────────────────
  // Garde feature gating (2 offres Essentiel/Complet) :
  // Si l'utilisateur est sur le plan 'essential' et tente d'accéder à
  // une route réservée au Complet (planning, équipe), on le redirige
  // vers /dashboard/abonnement?upgrade=<feature> qui affiche le message
  // d'upgrade adapté.
  //
  // Règles métier (cf. lib/plans.ts) :
  //   - trial   → tout accessible (laisser tester)
  //   - lifetime → tout accessible
  //   - actif/suspendu + plan='complete' → tout accessible
  //   - actif/suspendu + plan='essential' → routes bloquées redirigées
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading || !entreprise || !user) return
    if (user.email === ADMIN_EMAIL) return
    // La page abonnement reste toujours accessible (pour upgrader)
    if (pathname.startsWith('/dashboard/abonnement')) return

    const abonnementType = (entreprise.abonnement_type as string) ?? 'trial'
    // Pendant l'essai ou pour les comptes lifetime, on ne bloque rien
    if (abonnementType === 'trial' || abonnementType === 'lifetime') return

    // Plan par défaut 'complete' (rétrocompatibilité avec les anciens comptes
    // qui n'auraient pas encore le champ après la migration)
    const plan: PlanId =
      ((entreprise.subscription_plan as PlanId | null | undefined) ?? 'complete')

    if (isRouteBlockedForPlan(plan, pathname)) {
      const feature = getFeatureFromBlockedRoute(pathname)
      router.replace(
        `/dashboard/abonnement?upgrade=${feature ?? 'planning_chantier'}`,
      )
    }
  }, [isLoading, entreprise, user, pathname, router])

  // ─────────────────────────────────────────────────────────
  // Push 2 — Garde de route PAR RÔLE.
  // Si le rôle est connu (employé : commercial / ouvrier) et que la route
  // courante ne lui est pas autorisée, on le renvoie vers sa page d'accueil.
  // STRICTEMENT sans effet pour le dirigeant et pour role=null (compte legacy
  // / inconnu) → c'est ce qui rend ce bloc déployable sans risque, et c'est
  // indépendant des gardes abonnement ci-dessus (placé après, ne les touche pas).
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (roleLoading) return
    if (role === null || role === 'dirigeant') return
    if (canAccessDashboardPath(role, pathname)) return
    router.replace(DEFAULT_LANDING[role])
  }, [roleLoading, role, pathname, router])

  // Calcul du nombre de jours restants pour le bandeau d'alerte
  // Affiché si trial avec ≤7 jours restants OU suspendu avec date proche
  const expirationInfo = (() => {
    if (isLoading || !entreprise || !user) return null
    if (user.email === ADMIN_EMAIL) return null
    if (pathname === '/subscription-expired') return null
    if (pathname.startsWith('/dashboard/abonnement')) return null

    const abonnementType = (entreprise.abonnement_type as string) ?? 'trial'
    if (abonnementType === 'lifetime' || abonnementType === 'actif') return null

    let expireAt: Date | null = null
    let label = ''
    if (abonnementType === 'trial') {
      const trialStarted = entreprise.trial_started_at
        ? new Date(entreprise.trial_started_at as string)
        : new Date(entreprise.created_at as string)
      expireAt = new Date(trialStarted.getTime() + 14 * 86_400_000)
      label = 'Essai'
    } else if (abonnementType === 'suspendu') {
      expireAt = entreprise.abonnement_expire_at
        ? new Date(entreprise.abonnement_expire_at as string)
        : null
      label = 'Accès'
    }
    if (!expireAt) return null
    const msRestant = expireAt.getTime() - Date.now()
    const joursRestants = Math.ceil(msRestant / (1000 * 60 * 60 * 24))
    if (joursRestants > 7 || joursRestants < 0) return null
    return { joursRestants, label }
  })()

  const userInitials = getInitials(
    user?.user_metadata?.prenom,
    user?.user_metadata?.nom
  )
  const userName = getDisplayName(
    user?.user_metadata?.prenom,
    user?.user_metadata?.nom,
    user?.email
  )
  const entrepriseNom = (entreprise?.nom as string) || ''
  const entrepriseMetier = (entreprise?.metier as string) || ''
  const entrepriseLogo = (entreprise?.logo_url as string) || ''

  // Plan effectif (cf. lib/plans.ts) :
  //   - trial    → 'complete' (laisser tester pendant 14 jours)
  //   - lifetime → 'complete'
  //   - actif    → subscription_plan réel (essential | complete)
  //   - suspendu → idem
  const { plan: effectivePlan, isTrial } = getEffectivePlan(
    entreprise as { abonnement_type?: string | null; subscription_plan?: string | null } | null,
  )

  // Determine responsive state
  // collapsed = true on tablet (768-1024), false on desktop
  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth
      if (w >= 1024) {
        setCollapsed(false)
        setMobileOpen(false)
      } else if (w >= 768) {
        setCollapsed(true)
        setMobileOpen(false)
      } else {
        setCollapsed(false) // mobile uses full sidebar when open
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // QW1 -- Raccourci clavier N
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (target.isContentEditable) return
      if (e.key !== 'n' && e.key !== 'N') return
      e.preventDefault()
      router.push('/dashboard/devis/nouveau')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [router])

  // QW8 -- Indicateur offline
  const [isOnline, setIsOnline] = useState(true)
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // QW2 -- Badges sidebar
  const sidebarBadges: Record<string, number> = useMemo(() => {
    const now = Date.now()
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
    let devisEnAttenteVieux = 0
    const devisList = (devisData ?? []) as Array<Record<string, unknown>>
    devisList.forEach((d) => {
      if (d.statut !== 'envoye') return
      const ref = (d.updated_at as string | undefined) || (d.created_at as string | undefined)
      if (!ref) return
      const age = now - new Date(ref).getTime()
      if (age >= SEVEN_DAYS) devisEnAttenteVieux++
    })
    let facturesEnRetard = 0
    const facturesList = (facturesData ?? []) as Array<Record<string, unknown>>
    facturesList.forEach((f) => {
      const statut = f.statut as string | undefined
      if (statut === 'en_retard') { facturesEnRetard++; return }
      if (statut !== 'envoyee' && statut !== 'envoye') return
      const echeance = f.date_echeance as string | undefined
      if (!echeance) return
      if (new Date(echeance).getTime() < now) facturesEnRetard++
    })
    return {
      '/dashboard/devis': devisEnAttenteVieux,
      '/dashboard/factures': facturesEnRetard,
    }
  }, [devisData, facturesData])

  // QW4 -- showBack
  const showBack = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    return segments.length > 2 && !pathname.endsWith('/nouveau')
  }, [pathname])

  const sidebarCollapsed = collapsed && !hovered
  const sidebarWidth = sidebarCollapsed ? 64 : 256
  const pageTitle = getPageTitle(pathname)

  return (
    <VoiceProvider>
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar hover zone for tablet expand */}
      <div
        className="hidden md:block lg:hidden fixed top-0 left-0 z-50 h-full"
        style={{ width: hovered ? 256 : 64 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={false}
          onCloseMobile={() => {}}
          pathname={pathname}
          userInitials={userInitials}
          userName={userName}
          userEmail={user?.email ?? ''}
          entrepriseNom={entrepriseNom}
          entrepriseMetier={entrepriseMetier}
          entrepriseLogo={entrepriseLogo}
          userLoading={isLoading}
          effectivePlan={effectivePlan}
          isTrial={isTrial}
          badges={sidebarBadges}
          role={role}
        />
      </div>

      {/* Sidebar for desktop (always visible) */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={false}
          mobileOpen={false}
          onCloseMobile={() => {}}
          pathname={pathname}
          userInitials={userInitials}
          userName={userName}
          userEmail={user?.email ?? ''}
          entrepriseNom={entrepriseNom}
          entrepriseMetier={entrepriseMetier}
          entrepriseLogo={entrepriseLogo}
          userLoading={isLoading}
          effectivePlan={effectivePlan}
          isTrial={isTrial}
          badges={sidebarBadges}
          role={role}
        />
      </div>

      {/* Sidebar for mobile (slide in) */}
      <div className="md:hidden">
        <Sidebar
          collapsed={false}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          pathname={pathname}
          userInitials={userInitials}
          userName={userName}
          userEmail={user?.email ?? ''}
          entrepriseNom={entrepriseNom}
          entrepriseMetier={entrepriseMetier}
          entrepriseLogo={entrepriseLogo}
          userLoading={isLoading}
          effectivePlan={effectivePlan}
          isTrial={isTrial}
          badges={sidebarBadges}
          role={role}
        />
      </div>

      {/* Main content */}
      <div
        className="transition-all duration-200 md:ml-16 lg:ml-64"
      >
        {/* QW8 -- Bandeau Hors ligne */}
        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-center gap-2 text-center print:hidden"
          >
            <WifiOff size={14} className="text-gray-500 flex-shrink-0" aria-hidden="true" />
            <p className="font-hanken text-xs sm:text-sm text-gray-700">
              Hors ligne -- vos modifications seront synchronisées au retour de la connexion.
            </p>
          </div>
        )}

        {/* Bandeau rappel installation PWA (cache 7j apres dismiss ou si deja installee)
            data-tour="install-banner" : cible pour la bulle d'onboarding V3
            (etape "Installe Nexartis sur ton telephone"). Le bandeau peut etre
            absent du DOM si l'utilisateur a deja installe la PWA ou s'il l'a
            dismiss — dans ce cas le scenario tour skippe silencieusement. */}
        <div className="print:hidden" data-tour="install-banner">
          <InstallReminderBanner />
        </div>

        {/* Bandeau expiration imminente (≤ 7 jours restants) */}
        {expirationInfo && (
          <div className="bg-orange-50 border-y border-orange-200 px-4 py-2.5 flex items-center justify-center gap-3 flex-wrap text-center print:hidden">
            <AlertTriangle size={16} className="text-orange-600 flex-shrink-0" />
            <p className="font-hanken text-sm text-orange-900">
              <span className="font-semibold">
                {expirationInfo.label}{' '}
                {expirationInfo.joursRestants === 0
                  ? "expire aujourd'hui"
                  : expirationInfo.joursRestants === 1
                    ? 'expire demain'
                    : `expire dans ${expirationInfo.joursRestants} jours`}
              </span>
              {' '}— Pour ne pas perdre l&apos;accès à vos données,{' '}
              <Link
                href="/dashboard/abonnement"
                className="font-bold underline hover:text-orange-700 transition-colors"
              >
                souscrivez maintenant
              </Link>
            </p>
          </div>
        )}

        {pathname !== '/dashboard/planning' && (
          <DashboardHeader
            title={pageTitle}
            onMenuClick={() => setMobileOpen(true)}
            userInitials={userInitials}
            userLoading={isLoading}
            showBack={showBack}
            onBack={() => router.back()}
          />
        )}
        {/* Planning n'a pas de DashboardHeader : on ajoute un bouton vocal flottant en haut a droite. */}
        {pathname === '/dashboard/planning' && (
          <div className="fixed top-3 right-3 z-40">
            <UniversalVoiceButton variant="icon" />
          </div>
        )}

        {/* Bandeau profil incomplet retiré : on laisse uniquement
            la carte d'alerte sur le tableau de bord (UX moins agressive) */}

        <main className="p-4 lg:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav
        pathname={pathname}
        onMoreClick={() => setMobileOpen(true)}
        role={role}
      />

      {/* Filet de securite capture parrainage (invisible) */}
      <ParrainageCapture />

      {/* Tutoriel onboarding */}
      <OnboardingTour />

      {/* Bouton flottant Nous contacter */}
      <ContactFloatingButton />

      {/* 2026-06-10 — Toast "Nouvelle version disponible" (PWA service worker).
          Honore la promesse landing MobileSection ("notification quand nouvelle
          version prete"). Reste invisible tant que le SW ne signale pas d'update. */}
      <PWAUpdateToast />
    </div>
    </VoiceProvider>
  )
}
