/**
 * Service Worker Nexartis PWA — V1
 *
 * Rôle : transforme nexartis.fr en application installable Android/iOS/Desktop.
 *
 * Stratégies :
 *  - Routes sensibles (API, dashboard, signer, auth) : JAMAIS de cache (NetworkOnly)
 *  - Assets statiques (_next/static, images, icons, fonts) : CacheFirst, dure long
 *  - Pages publiques marketing : StaleWhileRevalidate (sert vite, rafraîchit en fond)
 *  - Si pas de réseau : sert /offline en fallback navigation
 *
 * Versioning : CACHE_VERSION incrémente à chaque deploy majeur pour purger les vieux caches.
 */

// -----------------------------------------------------------------------------
// 1. CONSTANTES — Versioning des caches
// -----------------------------------------------------------------------------
// La version est concaténée dans les noms de caches. Quand on incrémente la
// version, l'event "activate" va supprimer tous les anciens caches automatiquement.
const CACHE_VERSION = 'nexartis-v1.4.0-svg-clean'
const CACHE_NAME_HTML = 'nexartis-html-' + CACHE_VERSION
const CACHE_NAME_STATIC = 'nexartis-static-' + CACHE_VERSION
const OFFLINE_URL = '/offline'

// Ressources à pré-cacher dès l'installation du service worker.
// On garde le minimum vital : la page offline + 2 icônes pour qu'elle soit jolie.
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// -----------------------------------------------------------------------------
// 2. INSTALL — Pré-cache des ressources critiques
// -----------------------------------------------------------------------------
// L'event "install" se déclenche la 1ʳᵉ fois que le navigateur enregistre le SW.
// On télécharge nos ressources offline puis on demande à devenir actif tout de
// suite (skipWaiting) sans attendre la fermeture des onglets existants.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME_STATIC)
      try {
        await cache.addAll(PRECACHE_URLS)
      } catch (err) {
        // En cas d'erreur (ex: /offline pas encore généré), on log mais on
        // n'empêche pas l'install — le SW reste utile pour les autres routes.
        console.warn('[SW] Precache partiel:', err)
      }
      await self.skipWaiting()
    })()
  )
})

// -----------------------------------------------------------------------------
// 3. ACTIVATE — Nettoyage des vieux caches
// -----------------------------------------------------------------------------
// Quand on déploie une nouvelle version, on supprime tous les caches dont le nom
// ne correspond plus aux caches actuels (par préfixe). Puis on prend le contrôle
// des onglets déjà ouverts via clients.claim().
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.map((key) => {
          // On garde uniquement les caches de la version courante.
          if (key !== CACHE_NAME_HTML && key !== CACHE_NAME_STATIC) {
            return caches.delete(key)
          }
          return Promise.resolve()
        })
      )
      await self.clients.claim()
    })()
  )
})

// -----------------------------------------------------------------------------
// 3.bis MESSAGE — Activation à la demande (toast "Recharger")
// -----------------------------------------------------------------------------
// Le composant PWARegister envoie { type: 'SKIP_WAITING' } quand l'utilisateur
// clique sur "Recharger". On bascule le SW en attente en SW actif, ce qui
// déclenche un event controllerchange côté client (qui fera reload).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// -----------------------------------------------------------------------------
// 4. FETCH — Routage des stratégies de cache
// -----------------------------------------------------------------------------
// À chaque requête HTTP du navigateur, on choisit une stratégie selon l'URL.
self.addEventListener('fetch', (event) => {
  const { request } = event

  // 4.a — On ne touche jamais aux méthodes autres que GET (POST, PUT, etc.)
  // Le SW doit rester transparent pour les mutations.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const path = url.pathname

  // 4.b — ROUTES SENSIBLES : NetworkOnly (jamais de cache).
  // Dashboard, API, auth, signer = données utilisateur dynamiques et privées.
  // On les laisse passer en réseau direct sans interception.
  const isSensitive =
    path.startsWith('/api/') ||
    path.startsWith('/dashboard/') ||
    path === '/dashboard' ||
    path.startsWith('/signer/') ||
    path === '/login' ||
    path === '/register' ||
    path.startsWith('/auth/') ||
    path.startsWith('/onboarding') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/maintenance') ||
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.stripe.com')

  if (isSensitive) {
    // Pas d'event.respondWith → le navigateur fait sa requête normalement.
    return
  }

  // 4.c — ASSETS STATIQUES : CacheFirst.
  // Polices, icônes, JS/CSS buildés Next.js : ils ont un hash dans leur URL,
  // donc on peut les cacher agressivement sans risque de servir du périmé.
  const isStatic =
    path.startsWith('/_next/static/') ||
    path.startsWith('/images/') ||
    path.startsWith('/icons/') ||
    path.startsWith('/screenshots/') ||
    path.startsWith('/fonts/') ||
    url.hostname === 'fonts.gstatic.com'

  if (isStatic) {
    event.respondWith(cacheFirst(request, CACHE_NAME_STATIC))
    return
  }

  // 4.d — PAGES PUBLIQUES (HTML navigation) : StaleWhileRevalidate.
  // On sert vite depuis le cache, et on rafraîchit en arrière-plan.
  // Si réseau coupé + pas de cache → fallback sur /offline.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(staleWhileRevalidateWithOfflineFallback(request))
    return
  }

  // 4.e — Autres requêtes GET diverses (images externes, etc.) : StaleWhileRevalidate sans fallback.
  event.respondWith(staleWhileRevalidate(request, CACHE_NAME_HTML))
})

// -----------------------------------------------------------------------------
// 5. HELPERS — Implémentations des stratégies
// -----------------------------------------------------------------------------

/**
 * CacheFirst : sert depuis le cache si présent, sinon va sur le réseau et cache.
 * Idéal pour les ressources immuables (hash dans l'URL).
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const fresh = await fetch(request)
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(cacheName)
      cache.put(request, fresh.clone())
    }
    return fresh
  } catch (err) {
    // Pas de réseau, pas de cache : on renvoie une erreur réseau native.
    return new Response('', { status: 504, statusText: 'Gateway Timeout' })
  }
}

/**
 * StaleWhileRevalidate : renvoie immédiatement le cache si présent, et
 * met à jour le cache en arrière-plan avec une requête réseau.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const networkPromise = fetch(request)
    .then((response) => {
      // On ne cache pas les réponses 503 (mode maintenance) ni les erreurs.
      if (response && response.status === 200) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  return cached || networkPromise || new Response('', { status: 504 })
}

/**
 * Variante pour la navigation HTML : si le réseau échoue ET pas de cache,
 * on retourne la page /offline pré-cachée.
 */
async function staleWhileRevalidateWithOfflineFallback(request) {
  const cache = await caches.open(CACHE_NAME_HTML)
  const cached = await cache.match(request)

  const networkPromise = fetch(request)
    .then((response) => {
      // En maintenance (503), on relaie sans cacher pour ne pas piéger l'utilisateur.
      if (response && response.status === 503) {
        return response
      }
      if (response && response.status === 200) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  // On préfère le cache (rapidité), mais on attend la réponse réseau si rien en cache.
  const response = cached || (await networkPromise)
  if (response) return response

  // Dernier recours : fallback offline.
  const offline = await caches.match(OFFLINE_URL)
  if (offline) return offline
  return new Response('Hors ligne', { status: 503, statusText: 'Offline' })
}
