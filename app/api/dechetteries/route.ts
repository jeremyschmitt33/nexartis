import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, checkRateLimit } from '@/lib/api-security'

// ─────────────────────────────────────────────────────────────
// API /api/dechetteries?cp=33000  ou  ?adresse=12 rue des fleurs 33000 Bordeaux
//
// 1. Géocode l'adresse (ou le code postal) via api-adresse.data.gouv.fr
// 2. Recherche les déchetteries du département via l'API ADEME (SINOE)
// 3. Calcule la distance à vol d'oiseau et filtre à 30 km
// 4. Renvoie les résultats triés par proximité
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

interface Dechetterie {
  nom: string
  adresse: string
  code_postal: string
  commune: string
  distance_km: number
  lat: number
  lng: number
  accepte_pro: string
  accepte_construction: boolean
  accepte_deee: boolean
}

// Haversine — distance en km entre 2 points GPS
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(req: NextRequest) {
  try {
    // ✅ SÉCURITÉ : Rate limiting (20 requêtes/minute par IP)
    const ip = getClientIp(req)
    if (!checkRateLimit(`dechetteries:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Trop de requêtes, réessayez dans une minute.' }, { status: 429 })
    }

    const searchParams = req.nextUrl.searchParams
    const cp = searchParams.get('cp') || ''
    const adresse = searchParams.get('adresse') || ''
    const rayon = parseInt(searchParams.get('rayon') || '30', 10)

    if (!cp && !adresse) {
      return NextResponse.json({ error: 'Paramètre cp ou adresse requis' }, { status: 400 })
    }

    // ── 1. Géocodage ──────────────────────────────────────────
    const query = adresse || cp
    const geoRes = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`,
      { cache: 'force-cache' }
    )
    const geoData = await geoRes.json()

    if (!geoData.features || geoData.features.length === 0) {
      return NextResponse.json({ error: 'Adresse non trouvée' }, { status: 404 })
    }

    const [lng, lat] = geoData.features[0].geometry.coordinates
    const context: string = geoData.features[0].properties.context || ''
    // Le contexte contient "XX, Nom du département, Région" — on extrait le code département
    const deptCode = context.split(',')[0]?.trim() || cp.substring(0, 2)

    // ── 2. Recherche déchetteries ADEME (département principal) ──
    const ademeUrl = (dept: string, page = 0) =>
      `https://data.ademe.fr/data-fair/api/v1/datasets/greatersinoe-(r)-annuaire-2017-des-decheteries-de-dechets-menagers-et-assimiles-(dma)/lines?size=100&after=${page}&qs=Code_du_d%C3%A9partement_D%C3%A9ch%C3%A8terie:%22${dept}%22&select=Nom_D%C3%A9ch%C3%A8terie,Adresse_D%C3%A9ch%C3%A8terie,Code_postal_D%C3%A9ch%C3%A8terie,Libell%C3%A9_de_la_commune_D%C3%A9ch%C3%A8terie,_geopoint,D%C3%A9chets_de_construction_et_de_d%C3%A9molition,D%C3%A9chets_des_activit%C3%A9s_%C3%A9conomiques_accept%C3%A9s,Equipements_%C3%A9lectriques_et_%C3%A9lectroniques_hors_d%27usage`

    // Récupérer le département principal
    const res1 = await fetch(ademeUrl(deptCode))
    const data1 = await res1.json()
    let allResults = data1.results || []

    // Si peu de résultats, chercher les départements voisins (±1)
    const deptNum = parseInt(deptCode, 10)
    if (!isNaN(deptNum) && allResults.length < 20) {
      const neighbors = [
        String(deptNum - 1).padStart(2, '0'),
        String(deptNum + 1).padStart(2, '0'),
      ].filter(d => d !== '00' && d !== deptCode)

      for (const nd of neighbors) {
        try {
          const resN = await fetch(ademeUrl(nd))
          const dataN = await resN.json()
          if (dataN.results) allResults = [...allResults, ...dataN.results]
        } catch { /* ignore */ }
      }
    }

    // ── 3. Calculer les distances et filtrer ──────────────────
    const dechetteries: Dechetterie[] = []

    for (const r of allResults) {
      const geopoint = r._geopoint || r['_geopoint']
      if (!geopoint) continue

      const [dlat, dlng] = geopoint.split(',').map(Number)
      if (isNaN(dlat) || isNaN(dlng)) continue

      const dist = haversine(lat, lng, dlat, dlng)
      if (dist > rayon) continue

      dechetteries.push({
        nom: r['Nom_Déchèterie'] || r['Nom_Dechèterie'] || 'Déchetterie',
        adresse: r['Adresse_Déchèterie'] || '',
        code_postal: r['Code_postal_Déchèterie'] || '',
        commune: r['Libellé_de_la_commune_Déchèterie'] || '',
        distance_km: Math.round(dist * 10) / 10,
        lat: dlat,
        lng: dlng,
        accepte_pro: r['Déchets_des_activités_économiques_acceptés'] || 'Non renseigné',
        accepte_construction: r['Déchets_de_construction_et_de_démolition'] === true,
        accepte_deee: r["Equipements_électriques_et_électroniques_hors_d'usage"] === true,
      })
    }

    // Trier par distance
    dechetteries.sort((a, b) => a.distance_km - b.distance_km)

    return NextResponse.json({
      centre: { lat, lng, adresse: geoData.features[0].properties.label },
      departement: deptCode,
      rayon_km: rayon,
      total: dechetteries.length,
      dechetteries: dechetteries.slice(0, 20), // Max 20 résultats
    })
  } catch (error) {
    console.error('Erreur API déchetteries:', error)
    console.error('Erreur API déchetteries:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la recherche de déchetteries.' }, { status: 500 })
  }
}
