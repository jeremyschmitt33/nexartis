import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getClientIp, checkRateLimit, isValidUUID,
  sanitizeString,
  secureJson, secureError, rateLimitError,
} from '@/lib/api-security'

/**
 * POST /api/public/contre-proposition
 *
 * API publique — le client renvoie une CONTRE-PROPOSITION (non contractuelle).
 * Il propose de retirer certaines prestations + un message optionnel.
 * Le serveur recalcule le total proposé, enregistre, passe le devis en
 * statut 'contreproposition' et notifie l'artisan. Le token de signature
 * N'EST PAS consommé : l'artisan pourra renvoyer le devis pour signature.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (!checkRateLimit(`contreprop:${ip}`, 5, 60_000)) {
      return rateLimitError()
    }

    const { token, lignesRetirees, message } = await req.json()

    if (!token || !isValidUUID(token)) {
      return secureError('Lien invalide')
    }
    // Liste des "ordre" de lignes que le client propose de retirer
    const retirees: number[] = Array.isArray(lignesRetirees)
      ? lignesRetirees.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
      : []
    const safeMessage = typeof message === 'string' && message.trim()
      ? sanitizeString(message.trim(), 1000)
      : null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 1. Charger le devis
    const { data: devis, error: devisErr } = await supabase
      .from('devis')
      .select('id, numero, statut, user_id, montant_ttc, objet, autoliquidation_btp, signature_token_expire_at, signature_token_used_at')
      .eq('signature_token', token)
      .single()

    if (devisErr || !devis) {
      return secureError('Lien invalide ou expiré', 404)
    }
    if (devis.signature_token_expire_at && new Date(devis.signature_token_expire_at).getTime() < Date.now()) {
      return secureError('Lien invalide ou expiré', 410)
    }
    if (devis.signature_token_used_at || devis.statut === 'signe' || devis.statut === 'facture') {
      return secureError('Ce devis a déjà été signé')
    }
    if (!['envoye', 'finalise', 'contreproposition'].includes(devis.statut)) {
      return secureError('Ce devis ne peut pas faire l’objet d’une proposition')
    }

    // 2. Recalcul du total proposé (côté serveur — le client ne peut pas forcer un montant)
    const { data: dbLignes } = await supabase
      .from('devis_lignes')
      .select('ordre, type, designation, quantite, prix_unitaire_ht, taux_tva')
      .eq('devis_id', devis.id)

    const retireesSet = new Set(retirees)
    let propHt = 0
    const htByTaux: Record<number, number> = {}
    const retireesNoms: string[] = []
    let restantPrestations = 0

    for (const l of (dbLignes ?? [])) {
      const isPrestation = (l.type ?? 'prestation') === 'prestation'
      if (!isPrestation) continue
      if (retireesSet.has(Number(l.ordre))) {
        retireesNoms.push(String(l.designation ?? ''))
        continue
      }
      const t = (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0)
      propHt += t
      restantPrestations += 1
      const taux = devis.autoliquidation_btp ? 0 : (Number(l.taux_tva) || 0)
      if (taux > 0) htByTaux[taux] = (htByTaux[taux] || 0) + t
    }

    let propTva = 0
    for (const k of Object.keys(htByTaux)) propTva += htByTaux[Number(k)] * (Number(k) / 100)
    const propTtc = propHt + propTva

    // Garde-fou : on accepte une proposition vide UNIQUEMENT si elle est accompagnée d'un message
    // (ex. « je souhaite tout revoir »). Sinon on refuse une proposition sans contenu.
    if (restantPrestations === 0 && retirees.length === 0 && !safeMessage) {
      return secureError('Proposition vide')
    }

    // 3. Enregistrer la contre-proposition + basculer le statut (automatique)
    const { error: updErr } = await supabase
      .from('devis')
      .update({
        statut: 'contreproposition',
        contreproposition_at: new Date().toISOString(),
        contreproposition_message: safeMessage,
        contreproposition_retirees: retirees,
        contreproposition_ttc: propTtc,
      })
      .eq('id', devis.id)

    if (updErr) {
      console.error('Contre-proposition update error:', updErr)
      return NextResponse.json({ error: 'Erreur lors de l’envoi' }, { status: 500 })
    }

    // 4. Notifier l'artisan
    try {
      await notifyArtisan(supabase, devis, { retireesNoms, message: safeMessage, propTtc })
    } catch (e) {
      console.error('Notif contre-proposition error:', e)
    }

    return secureJson({ success: true, message: 'Proposition envoyée' })
  } catch (error) {
    console.error('Contre-proposition error:', error)
    return secureError('Erreur serveur', 500)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyArtisan(
  supabase: any,
  devis: { id: string; numero: string; user_id: string; montant_ttc: number; objet?: string },
  data: { retireesNoms: string[]; message: string | null; propTtc: number },
) {
  const { data: ent } = await supabase
    .from('entreprises')
    .select('nom, email')
    .eq('user_id', devis.user_id)
    .single()
  if (!ent?.email) return

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
  const esc = (s: string) => sanitizeString(s, 200)
  const retires = data.retireesNoms.filter(Boolean)
  const retiresHtml = retires.length
    ? `<p style="margin:0 0 4px;font-size:13px;color:#b91c1c;"><strong>Prestations que le client souhaite retirer :</strong></p><ul style="margin:0 0 12px;padding-left:18px;color:#374151;font-size:13px;">${retires.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`
    : '<p style="margin:0 0 12px;font-size:13px;color:#374151;">Le client n’a pas retiré de prestation (voir son message).</p>'
  const msgHtml = data.message
    ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:0 0 16px;"><p style="margin:0 0 6px;font-size:12px;color:#1e40af;font-weight:700;text-transform:uppercase;">Message du client</p><p style="margin:0;font-size:14px;color:#1f2937;white-space:pre-wrap;">${esc(data.message)}</p></div>`
    : ''

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:20px;">
<div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<div style="background:#e87a2a;border-radius:8px 8px 0 0;padding:20px 28px;">
<h1 style="margin:0;color:#fff;font-size:18px;">Contre-proposition reçue</h1>
</div>
<div style="padding:28px;">
<p style="font-size:16px;color:#1a1a2e;margin:0 0 14px;">Bonjour ${esc(ent.nom || '')},</p>
<p style="font-size:15px;color:#374151;margin:0 0 16px;line-height:1.6;">Le client vous renvoie une <strong>proposition de modification</strong> du devis <strong>n° ${esc(devis.numero)}</strong>. Rien n’est encore signé : à vous de l’étudier.</p>
${retiresHtml}
${msgHtml}
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin:0 0 18px;">
<p style="margin:0;font-size:14px;color:#374151;"><strong>Total proposé par le client :</strong> ${fmt(data.propTtc || 0)} <span style="color:#6b7280;">(au lieu de ${fmt(devis.montant_ttc || 0)})</span></p>
</div>
<div style="text-align:center;margin:20px 0;">
<a href="https://nexartis.fr/dashboard/devis/${devis.id}" style="background:#2563eb;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">Étudier la proposition</a>
</div>
<p style="font-size:13px;color:#6b7280;margin:16px 0 0;">Vous pourrez accepter, ajuster ou refuser depuis votre tableau de bord.</p>
</div>
<div style="padding:12px 28px;border-top:1px solid #e5e7eb;text-align:center;">
<p style="margin:0;font-size:11px;color:#9ca3af;">Envoyé via Nexartis — nexartis.fr</p>
</div>
</div>
</div>
</body></html>`

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': process.env.BREVO_API_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Nexartis', email: 'no-reply@nexartis.fr' },
      to: [{ email: ent.email, name: ent.nom }],
      subject: `Contre-proposition — Devis n° ${devis.numero}`,
      htmlContent: html,
    }),
  })
}
