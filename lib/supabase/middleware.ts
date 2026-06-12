import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Delai maximum d'attente d'une reponse Supabase dans le middleware (en ms).
// Si Supabase met plus de temps (panne, latence), on laisse passer la requete
// en mode degrade pour ne pas bloquer tout le site (Vercel coupe a 25s).
const SUPABASE_TIMEOUT_MS = 3000

/**
 * Detecte si la requete contient un cookie de session Supabase.
 * Si non, l'utilisateur est anonyme : pas besoin de contacter Supabase.
 * Cela protege la home publique d'une panne Supabase.
 */
function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'),
  )
}

/**
 * Wrap une promesse avec un timeout. Si la promesse n'aboutit pas
 * dans le delai imparti, on retourne null (mode degrade).
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        console.warn(`[middleware] ${label} timeout apres ${ms}ms`)
        resolve(null)
      }, ms)
    })
    return await Promise.race([promise, timeout])
  } catch (err) {
    console.warn(`[middleware] ${label} a echoue :`, err)
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function updateSession(request: NextRequest) {
  // 1) Routes API : elles gerent leur propre auth, on ne fait rien.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const pathname = request.nextUrl.pathname
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isAuthOrHomeRoute =
    pathname === '/' || pathname === '/login' || pathname === '/register'

  // 2) Court-circuit : visiteur anonyme sur une route publique
  // -> pas besoin de contacter Supabase du tout.
  // Cela rend la home, /login et /register immunises contre une panne Supabase
  // pour les visiteurs non connectes (90% du trafic).
  if (!hasSupabaseSessionCookie(request) && !isDashboardRoute) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // 3) Recuperation de l'utilisateur avec timeout court.
  // Si Supabase ne repond pas dans 3s, on retourne null et on laisse passer
  // la requete en mode "non authentifie" (la page cote serveur fera sa
  // propre verif et bloquera l'acces aux donnees sensibles si besoin).
  const userResult = await withTimeout(
    supabase.auth.getUser(),
    SUPABASE_TIMEOUT_MS,
    'auth.getUser',
  )

  const user = userResult?.data?.user ?? null

  // 4) Routes protegees : si pas d'user et pas de timeout, redirige vers login.
  // En cas de timeout (userResult === null), on laisse passer pour ne pas
  // deconnecter l'utilisateur a cause d'un hoquet reseau.
  if (!user && userResult !== null && isDashboardRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 5) Verif abonnement (uniquement si user present et sur /dashboard).
  // EXCEPTION : la page /dashboard/abonnement n'est JAMAIS bloquee, sinon
  // un utilisateur expire ne pourrait jamais se reabonner.
  // Idem pour l'admin qui ne paye pas.
  const isAbonnementPage = pathname.startsWith('/dashboard/abonnement')
  // SÉCURITÉ (R1-004) : accès admin basé UNIQUEMENT sur le rôle app_metadata.
  const isAdminUser = (user?.app_metadata as Record<string, unknown> | undefined)?.role === 'admin'

  if (user && isDashboardRoute && !isAbonnementPage && !isAdminUser) {
    const TRIAL_DAYS = 14
    const entrepriseResult = await withTimeout(
      Promise.resolve(supabase
        .from('entreprises')
        .select('abonnement_type, trial_started_at, abonnement_expire_at, created_at')
        .eq('user_id', user.id)
        .single()),
      SUPABASE_TIMEOUT_MS,
      'entreprises.abonnement',
    )

    const entreprise = entrepriseResult?.data as
      | {
          abonnement_type: string | null
          trial_started_at: string | null
          abonnement_expire_at: string | null
          created_at: string | null
        }
      | null
      | undefined

    if (entreprise) {
      const abonnementType = entreprise.abonnement_type ?? 'trial'

      // Helper : rediriger l'utilisateur expire vers la page abonnement,
      // seule page accessible jusqu'au paiement.
      const redirectToAbonnement = () => {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/abonnement'
        url.searchParams.set('expired', '1')
        return NextResponse.redirect(url)
      }

      // lifetime / actif : aucune restriction
      if (abonnementType === 'lifetime' || abonnementType === 'actif') {
        // OK, on laisse passer
      } else if (abonnementType === 'suspendu') {
        // Suspendu : on regarde si la fin de periode payee est passee.
        // Si null : suspendu immediat. Sinon : laisser passer jusqu'a la date.
        const expireAt = entreprise.abonnement_expire_at
          ? new Date(entreprise.abonnement_expire_at)
          : null
        if (!expireAt || expireAt < new Date()) {
          return redirectToAbonnement()
        }
      } else {
        // Trial (par defaut) : 14 jours depuis trial_started_at
        const startRef = entreprise.trial_started_at ?? entreprise.created_at
        if (startRef) {
          const trialStart = new Date(startRef)
          const trialEnd = new Date(trialStart.getTime() + TRIAL_DAYS * 86_400_000)
          if (trialEnd < new Date()) {
            return redirectToAbonnement()
          }
        }
      }
    }
  }

  // 6) Utilisateur connecte qui arrive sur la home / login / register
  // -> on l'envoie sur le dashboard.
  if (user && isAuthOrHomeRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
