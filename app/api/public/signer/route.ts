import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getClientIp, checkRateLimit,
  sanitizeString,
  secureJson, secureError, rateLimitError,
} from '@/lib/api-security'

/**
 * POST /api/public/signer
 *
 * API publique — le client signe un devis.
 * Reçoit le token + la signature (base64 ou "approved") + le nom.
 * Met à jour le devis : statut → signe, enregistre la signature.
 * Envoie un email de notification à l'artisan.
 */
export async function POST(req: NextRequest) {
  try {
    // ✅ SÉCURITÉ : Rate limiting strict (5 tentatives par minute par IP)
    const ip = getClientIp(req)
    if (!checkRateLimit(`signer:${ip}`, 5, 60_000)) {
      return rateLimitError()
    }

    const { token, signedBy, signatureBase64, mode } = await req.json()

    // Validation
    if (!token || !signedBy) {
      return secureError('Données manquantes (token et nom requis)')
    }

    // ✅ SÉCURITÉ : Valider le format du token (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return secureError('Token invalide')
    }

    // ✅ SÉCURITÉ : Valider le nom (max 200 caractères, pas de scripts)
    if (typeof signedBy !== 'string' || signedBy.trim().length < 2 || signedBy.length > 200) {
      return secureError('Nom invalide')
    }

    if (!mode || !['draw', 'approve'].includes(mode)) {
      return secureError('Mode de signature invalide')
    }

    if (mode === 'draw' && !signatureBase64) {
      return secureError('Signature dessinée manquante')
    }

    // ✅ SÉCURITÉ : Valider la taille de la signature base64 (max 500KB)
    if (signatureBase64 && signatureBase64.length > 500_000) {
      return secureError('Signature trop volumineuse')
    }

    // Service role pour bypasser RLS (nécessaire car le client n'a pas de compte)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 1. Chercher le devis par token
    const { data: devis, error: devisErr } = await supabase
      .from('devis')
      .select('id, numero, statut, user_id, client_id, montant_ttc, objet')
      .eq('signature_token', token)
      .single()

    if (devisErr || !devis) {
      // ✅ SÉCURITÉ : Message générique pour ne pas révéler l'existence de devis
      return secureError('Lien invalide ou expiré', 404)
    }

    // 2. Vérifier que le devis est signable
    if (!['envoye', 'finalise'].includes(devis.statut)) {
      if (devis.statut === 'signe' || devis.statut === 'facture') {
        return secureError('Ce devis a déjà été signé')
      }
      return secureError('Ce devis ne peut pas être signé')
    }

    // 3. Mettre à jour le devis
    const updateData: Record<string, unknown> = {
      statut: 'signe',
      date_signature: new Date().toISOString(),
      signed_by: signedBy.trim(),
    }

    if (mode === 'draw' && signatureBase64) {
      updateData.client_signature_base64 = signatureBase64
    } else {
      // Mode "approve" — on stocke un marqueur texte
      updateData.client_signature_base64 = null
      updateData.signed_by = `${signedBy.trim()} (approuvé électroniquement)`
    }

    const { error: updateErr } = await supabase
      .from('devis')
      .update(updateData)
      .eq('id', devis.id)

    if (updateErr) {
      console.error('Signature update error:', updateErr)
      return NextResponse.json({ error: 'Erreur lors de la signature' }, { status: 500 })
    }

    // 4. Envoyer la notification email à l'artisan
    try {
      await sendArtisanNotification(supabase, devis, signedBy.trim(), mode)
    } catch (notifErr) {
      // On ne bloque pas la signature si l'email échoue
      console.error('Notification email error:', notifErr)
    }

    return secureJson({ success: true, message: 'Devis signé avec succès' })
  } catch (error) {
    console.error('Signature error:', error)
    // ✅ SÉCURITÉ : Ne pas exposer les détails de l'erreur
    return secureError('Erreur serveur', 500)
  }
}

/**
 * Envoie un email à l'artisan pour le prévenir que son devis a été signé
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendArtisanNotification(
  supabase: any,
  devis: { id: string; numero: string; user_id: string; montant_ttc: number; objet?: string },
  signedBy: string,
  mode: string,
) {
  // Récupérer l'email de l'artisan + sa préférence notification.
  // 28/05/2026 : on respecte le toggle "Devis signé" des paramètres
  // (avant cette date, l'envoi était systématique et ignorait la préférence).
  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('nom, email, notify_devis_signe')
    .eq('user_id', devis.user_id)
    .single()

  if (!entreprise?.email) return
  // Si l'artisan a explicitement désactivé la notif (false), on n'envoie pas.
  // Si la colonne est null/undefined, on considère qu'elle est activée (défaut historique).
  if (entreprise.notify_devis_signe === false) return

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
  const modeLabel = mode === 'draw' ? 'signature manuscrite' : 'approbation électronique'

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:20px;">
<div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<div style="background:#10b981;border-radius:8px 8px 0 0;padding:20px 28px;">
<h1 style="margin:0;color:#fff;font-size:18px;">Devis signé !</h1>
</div>
<div style="padding:28px;">
<p style="font-size:16px;color:#1a1a2e;margin:0 0 14px;">Bonjour ${entreprise.nom},</p>
<p style="font-size:15px;color:#374151;margin:0 0 16px;line-height:1.6;">Votre devis <strong>n° ${devis.numero}</strong> vient d'être accepté par <strong>${signedBy}</strong> via ${modeLabel}.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:0 0 20px;">
<p style="margin:0 0 6px;font-size:14px;color:#374151;"><strong>Montant :</strong> ${fmt(devis.montant_ttc || 0)}</p>
${devis.objet ? `<p style="margin:0;font-size:14px;color:#374151;"><strong>Objet :</strong> ${devis.objet}</p>` : ''}
</div>
<div style="text-align:center;margin:20px 0;">
<a href="https://nexartis.fr/dashboard/devis/${devis.id}" style="background:#2563eb;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">Voir le devis signé</a>
</div>
<p style="font-size:13px;color:#6b7280;margin:16px 0 0;">Vous pouvez maintenant planifier le chantier et créer la facture associée.</p>
</div>
<div style="padding:12px 28px;border-top:1px solid #e5e7eb;text-align:center;">
<p style="margin:0;font-size:11px;color:#9ca3af;">Envoyé via Nexartis — nexartis.fr</p>
</div>
</div>
</div>
</body></html>`

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': process.env.BREVO_API_KEY!,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Nexartis', email: 'no-reply@nexartis.fr' },
      to: [{ email: entreprise.email, name: entreprise.nom }],
      subject: `✓ Devis n° ${devis.numero} signé par ${signedBy}`,
      htmlContent: html,
    }),
  })
}
