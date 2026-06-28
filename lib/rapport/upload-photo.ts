/**
 * Orchestrateur d'envoi d'UNE photo de rapport (le "uploadFn" du moteur).
 *
 * Enchaine : lire le binaire local -> signature R2 -> PUT original (+ thumb)
 * -> confirmation en base -> liberation des binaires locaux. Idempotent
 * (cle R2 deterministe cote serveur). Classe les erreurs : 4xx "definitives"
 * (quota/auth/format) = NonRetryableError (pas de retry inutile) ; reseau /
 * 5xx = erreur normale (le moteur retentera).
 *
 * Dedie au rapport, isole du flux photos-chantier.
 */

import { NonRetryableError, type UploadJob } from './upload-queue'
import type { RapportUploadStore, RapportUploadPayload } from './upload-store'

interface SignResponse { key?: string; thumbKey?: string; putUrl?: string; putThumbUrl?: string; error?: string; message?: string }

/** 4xx qui ne se resolvent pas en reessayant. */
function isDefinitive(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 413
}

async function putR2(url: string, body: Blob, signal?: AbortSignal): Promise<void> {
  const r = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': 'image/jpeg' }, signal })
  if (!r.ok) throw new Error('Echec du stockage de la photo (' + r.status + ')')
}

export function makeRapportUploadFn(store: RapportUploadStore) {
  return async (job: UploadJob<RapportUploadPayload>, signal?: AbortSignal): Promise<{ photoId: string }> => {
    const p = job.payload
    const orig = await store.getBlob(p.photoLocalId)
    if (!orig) throw new NonRetryableError('Photo introuvable sur cet appareil')
    const thumb = await store.getBlob(p.photoLocalId + '_thumb')

    // 1) Signature (verifie propriete rapport + quota cote serveur)
    const signRes = await fetch('/api/rapport-photos/sign-upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({ rapport_id: p.rapportId, photo_local_id: p.photoLocalId, size: orig.size }),
    })
    let sign: SignResponse | null = null
    try { sign = (await signRes.json()) as SignResponse } catch { /* non JSON */ }
    if (!signRes.ok || !sign?.putUrl || !sign?.key) {
      const msg = sign?.message || "Preparation de l'envoi refusee"
      throw isDefinitive(signRes.status) ? new NonRetryableError(msg) : new Error(msg)
    }

    // 2) Envoi R2 : original (bloquant) + miniature (non bloquante)
    await putR2(sign.putUrl, orig, signal)
    if (thumb && sign.putThumbUrl) {
      try { await putR2(sign.putThumbUrl, thumb, signal) } catch { /* miniature non bloquante */ }
    }

    // 3) Confirmation en base (idempotente cote serveur)
    const confRes = await fetch('/api/rapport-photos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({
        rapport_id: p.rapportId, r2_key: sign.key, thumb_key: sign.thumbKey ?? null,
        largeur: p.largeur ?? null, hauteur: p.hauteur ?? null,
        legende: p.legende ?? null, prise_le: p.prisLe ?? null, client_id: p.clientId ?? null,
      }),
    })
    let conf: { ok?: boolean; id?: string } | null = null
    try { conf = (await confRes.json()) as { ok?: boolean; id?: string } } catch { /* non JSON */ }
    if (!confRes.ok || !conf?.id) {
      const msg = 'Enregistrement de la photo refuse'
      throw isDefinitive(confRes.status) ? new NonRetryableError(msg) : new Error(msg)
    }

    // 4) Succes. On GARDE les binaires locaux : l'apercu ecran ET le PDF les
    // reutilisent sans re-telecharger, et ils survivent a un rechargement
    // (IndexedDB). Nettoyage = GC ulterieur (V2). Supprimer ici creait une
    // course (apercu vide) + un PDF sans photo.
    return { photoId: conf.id }
  }
}
