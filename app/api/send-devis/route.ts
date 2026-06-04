import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateDevisPdf } from '@/lib/pdf'
import { computeHierarchicalNumbers } from '@/lib/numerotation'
import { buildDocumentEmailHtml } from '@/lib/email'
import { themeFromEntreprise } from '@/lib/document-theme'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, isValidEmail,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

export async function POST(req: NextRequest) {
  try {
    // ✅ SÉCURITÉ : Rate limiting (10 envois par minute par IP)
    const ip = getClientIp(req)
    if (!checkRateLimit(`send-devis:${ip}`, 10, 60_000)) {
      return rateLimitError()
    }

    // ✅ SÉCURITÉ : Vérifier que l'utilisateur est connecté
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    const { devisId, emailDestinataire, messagePersonnalise } = await req.json()

    if (!devisId || !emailDestinataire) {
      return secureError('Données manquantes')
    }

    // ✅ SÉCURITÉ : Valider les inputs
    if (!isValidUUID(devisId)) return secureError('ID de devis invalide')
    if (!isValidEmail(emailDestinataire)) return secureError('Email invalide')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // ✅ SÉCURITÉ : Vérifier que le devis appartient à l'utilisateur connecté
    const { data: devis, error: devisErr } = await supabase.from('devis').select('*').eq('id', devisId).eq('user_id', user.id).single()
    if (devisErr || !devis) return secureError('Devis introuvable', 404)

    const { data: lignes } = await supabase.from('devis_lignes').select('*').eq('devis_id', devisId).order('ordre')
    const { data: entreprise } = await supabase.from('entreprises').select('*').eq('user_id', devis.user_id).single()

    // Resolve client — extraire toutes les infos
    let clientNom = 'Client'
    let clientAdresse = ''
    let clientType = 'particulier'
    // P11 (audit) : SIRET à afficher sur le PDF devis
    let clientSiret: string | undefined
    // V2.4d : ajout TVA intracommunautaire client pour conformité B2B intra-UE
    // (helper PDF accepte déjà ce champ — voir DevisData.clientTvaIntra)
    let clientTvaIntra: string | undefined
    if (devis.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('civilite, nom, prenom, adresse, code_postal, ville, type, telephone, email, siret')
        .eq('id', devis.client_id)
        .single()
      if (client) {
        // Ordre logique : Civilite + Prenom + Nom (ex: "M. Eric Dupont")
        clientNom = `${client.civilite || ''} ${client.prenom || ''} ${client.nom || ''}`.replace(/\s+/g, ' ').trim()
        clientAdresse = [client.adresse, `${client.code_postal || ''} ${client.ville || ''}`.trim(), client.telephone, client.email].filter(Boolean).join(' | ')
        clientType = client.type || 'particulier'
        clientSiret = (client.siret as string | undefined) || undefined
        // V2.4d : accès tolérant — devient utile dès que la colonne sera ajoutée à la table clients
        clientTvaIntra = ((client as Record<string, unknown>).tva_intracommunautaire as string | undefined) || undefined
      }
    }
    // Fallback sur notes_client si pas de client_id ou client non trouvé
    if (devis.notes_client) {
      const parts = devis.notes_client.split(' | ').map((s: string) => s.trim())
      if (clientNom === 'Client' && parts[0]) clientNom = parts[0]
      if (!clientAdresse && parts.length > 1) clientAdresse = parts.slice(1).join(' | ')
    }

    const ent = entreprise || {}
    const totalHT = devis.montant_ht || 0
    const totalTVA = devis.montant_tva || 0
    const totalTTC = devis.montant_ttc || 0
    const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
    const dateValidite = devis.date_validite ? new Date(devis.date_validite).toLocaleDateString('fr-FR') : ''

    // Filet de securite : recalcul de la numerotation hierarchique a la volee
    // pour garantir que le PDF du mail a toujours 1, 1.1, 1.1.1 meme si la BDD
    // est dans un etat ancien (avant la mise en place de la numerotation auto).
    const lignesAvecNumero = computeHierarchicalNumbers(
      (lignes || []).map((l: Record<string, unknown>) => ({
        type: (l.type as 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page' | undefined),
        numero: (l.numero as string | undefined),
        _orig: l,
      })),
    )

    // Generate PDF
    const pdfBase64 = generateDevisPdf({
      numero: devis.numero,
      date_emission: devis.date_emission || devis.created_at,
      date_validite: devis.date_validite,
      date_debut_travaux: devis.date_debut_travaux,
      duree_travaux: devis.duree_travaux,
      objet: devis.objet || devis.description,
      conditions_paiement: devis.conditions_paiement,
      acompte_pourcent: devis.acompte_pourcent,
      clientNom,
      clientAdresse,
      clientType,
      clientSiret,
      // V2.4d : ajout TVA intracommunautaire client pour conformité B2B intra-UE
      clientTvaIntra,
      montant_ht: totalHT,
      montant_tva: totalTVA,
      montant_ttc: totalTTC,
      lignes: lignesAvecNumero.map((item) => {
        const l = item._orig as Record<string, unknown>
        return {
          // V13 — Bug fix : id manquant cassait computeSubtotals (sections a 0)
          id: (l.id as string | undefined),
          designation: (l.designation as string) || '',
          quantite: (l.quantite as number) || 0,
          unite: (l.unite as string) || '',
          prix_unitaire_ht: (l.prix_unitaire_ht as number) || 0,
          // V13 — Bug fix : ?? au lieu de || pour respecter taux_tva=0 (Sans TVA)
          // V2.4b : fallback aligné à 20% (taux normal France) — auparavant 10% ce qui causait
          // une divergence avec lib/pdf.ts (?? 20) et le rendu HTML dashboard (?? 20).
          taux_tva: (l.taux_tva as number) ?? 20,
          type: (l.type as 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page' | undefined),
          niveau: (l.niveau as 1 | 2 | 3 | undefined),
          parent_id: (l.parent_id as string | null | undefined),
          numero: item.numero,
        }
      }),
      entreprise: ent,
      // Statut + signature client : utilisés pour afficher "Bon pour accord" + date
      // dans le cadre client du PDF (au lieu de "En attente") si le devis est accepté/signé
      statut: devis.statut,
      date_signature: devis.date_signature,
      client_signature_base64: devis.client_signature_base64,
      dechets: (devis.dechets_nature || devis.dechets_quantite || devis.dechets_collecte_nom) ? {
        nature: devis.dechets_nature || undefined,
        quantite: devis.dechets_quantite || undefined,
        responsable: devis.dechets_responsable || undefined,
        tri: devis.dechets_tri || undefined,
        collecte_nom: devis.dechets_collecte_nom || undefined,
        collecte_adresse: devis.dechets_collecte_adresse || undefined,
        collecte_type: devis.dechets_collecte_type || undefined,
        cout: devis.dechets_cout ?? undefined,
        inclure_cout: devis.dechets_inclure_cout ?? false,
      } : undefined,
    }, themeFromEntreprise(entreprise))

    // Générer un token de signature s'il n'en a pas encore
    let signatureToken = devis.signature_token
    if (!signatureToken) {
      // Créer un token UUID côté serveur
      const tokenResult = await supabase.rpc('gen_random_uuid')
      signatureToken = tokenResult.data || crypto.randomUUID()
      await supabase.from('devis').update({ signature_token: signatureToken }).eq('id', devisId)
    }

    // Lien public de signature (le client n'a PAS besoin de compte)
    const signerUrl = `https://nexartis.fr/signer/${signatureToken}`

    // Build short email body (avoids Gmail truncation)
    const preheader = `${messagePersonnalise || `Devis n° ${devis.numero} - ${fmt(totalTTC)}`}`
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
<div style="max-width:580px;margin:0 auto;padding:20px;">
<div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<div style="padding:28px;">
<p style="font-size:16px;color:#1a1a2e;margin:0 0 14px;font-weight:600;">Bonjour ${clientNom},</p>
<p style="font-size:15px;color:#374151;margin:0 0 16px;line-height:1.6;">${messagePersonnalise || `Veuillez trouver ci-joint votre devis n\u00b0 ${devis.numero} d'un montant de ${fmt(totalTTC)}.`}</p>
${dateValidite ? `<p style="font-size:13px;color:#e87a2a;margin:0 0 16px;">Ce devis est valable jusqu'au ${dateValidite}.</p>` : ''}
<p style="font-size:14px;color:#6b7280;margin:0 0 16px;line-height:1.6;">Vous trouverez le devis détaillé en pièce jointe de cet email.</p>
<p style="font-size:14px;color:#374151;margin:0;">Cordialement,<br/><strong>${(ent as Record<string,unknown>).nom || 'Nexartis'}</strong></p>
</div>
<div style="padding:12px 28px;border-top:1px solid #e5e7eb;text-align:center;">
<p style="margin:0;font-size:11px;color:#9ca3af;">Envoy\u00e9 via Nexartis \u2014 nexartis.fr</p>
</div>
</div>
</div>
</body></html>`

    // Send via Brevo with PDF attachment
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: ent.nom || 'Nexartis', email: 'no-reply@nexartis.fr' },
        to: [{ email: emailDestinataire, name: clientNom }],
        subject: `Devis n° ${devis.numero} — ${ent.nom || 'Nexartis'}`,
        replyTo: { email: ent.email || 'no-reply@nexartis.fr', name: ent.nom || 'Nexartis' },
        htmlContent: html,
        attachment: [{
          content: pdfBase64,
          name: `Devis-${devis.numero}.pdf`,
        }],
      }),
    })

    if (!brevoResponse.ok) {
      const brevoErr = await brevoResponse.json()
      console.error('Brevo error:', brevoErr)
      return NextResponse.json({ error: brevoErr.message || 'Erreur envoi Brevo' }, { status: 500 })
    }

    await supabase.from('devis').update({ statut: 'envoye', date_envoi: new Date().toISOString() }).eq('id', devisId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send devis error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
