import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateFacturePdf } from '@/lib/pdf'
import { computeHierarchicalNumbers } from '@/lib/numerotation'
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
    if (!checkRateLimit(`send-facture:${ip}`, 10, 60_000)) {
      return rateLimitError()
    }

    // ✅ SÉCURITÉ : Vérifier que l'utilisateur est connecté
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    const { factureId, emailDestinataire, messagePersonnalise } = await req.json()

    if (!factureId || !emailDestinataire) {
      return secureError('Données manquantes')
    }

    // ✅ SÉCURITÉ : Valider les inputs
    if (!isValidUUID(factureId)) return secureError('ID de facture invalide')
    if (!isValidEmail(emailDestinataire)) return secureError('Email invalide')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // ✅ SÉCURITÉ : Vérifier que la facture appartient à l'utilisateur connecté
    const { data: facture, error: factureErr } = await supabase.from('factures').select('*').eq('id', factureId).eq('user_id', user.id).single()
    if (factureErr || !facture) return secureError('Facture introuvable', 404)

    const { data: lignes } = await supabase.from('facture_lignes').select('*').eq('facture_id', factureId).order('ordre')
    const { data: entreprise } = await supabase.from('entreprises').select('*').eq('user_id', facture.user_id).single()

    // Resolve client — extraire toutes les infos
    let clientNom = facture.client_nom || 'Client'
    let clientAdresse = ''
    let clientType = 'particulier'
    // P11 (audit) : SIRET à afficher (art. L441-9 C. comm.)
    let clientSiret: string | undefined
    // V2.4d : ajout TVA intracommunautaire client pour conformité B2B intra-UE
    // (helper PDF accepte déjà ce champ — voir FactureData.clientTvaIntra)
    let clientTvaIntra: string | undefined
    if (facture.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('civilite, nom, prenom, adresse, code_postal, ville, type, telephone, email, siret')
        .eq('id', facture.client_id)
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
    // Fallback sur notes_client
    if (facture.notes_client) {
      const parts = facture.notes_client.split(' | ').map((s: string) => s.trim())
      if (clientNom === 'Client' && parts[0]) clientNom = parts[0]
      if (!clientAdresse && parts.length > 1) clientAdresse = parts.slice(1).join(' | ')
    }

    const ent: Record<string, unknown> = entreprise || {}
    const totalHT = facture.montant_ht || 0
    const totalTVA = facture.montant_tva || 0
    const totalTTC = facture.montant_ttc || 0
    const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
    const dateEcheance = facture.date_echeance ? new Date(facture.date_echeance).toLocaleDateString('fr-FR') : ''

    // Recalcul de la numerotation hierarchique a la volee (filet de securite)
    const lignesAvecNumero = computeHierarchicalNumbers(
      (lignes || []).map((l: Record<string, unknown>) => ({
        type: (l.type as 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page' | undefined),
        numero: (l.numero as string | undefined),
        _orig: l,
      })),
    )

    // Generate PDF — P2 (audit) : alignement avec download-facture pour que le
    // PDF envoyé par email soit IDENTIQUE au PDF téléchargé. Auparavant il
    // manquait date_prestation, conditions_paiement, notes_personnalisees,
    // acompte_* et type/numero_situation, ce qui produisait un NET À PAYER
    // faux quand un acompte avait été versé. Correction : on passe désormais
    // tous les champs métier au générateur PDF.
    const pdfBase64 = generateFacturePdf({
      numero: facture.numero,
      date_emission: facture.date_emission || facture.created_at,
      date_echeance: facture.date_echeance,
      // P2 (audit) : date de prestation manquait → ajoutée
      date_prestation: facture.date_prestation,
      objet: facture.objet || '',
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
          taux_tva: (l.taux_tva as number) ?? 20,
          type: (l.type as 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page' | undefined),
          niveau: (l.niveau as 1 | 2 | 3 | undefined),
          parent_id: (l.parent_id as string | null | undefined),
          numero: item.numero,
        }
      }),
      entreprise: ent,
      // P2 (audit) : conditions de paiement personnalisées + notes visibles client
      conditions_paiement: facture.conditions_paiement || undefined,
      notes_personnalisees: facture.notes_personnalisees || undefined,
      // P2 (audit) : acompte déjà versé (très impactant car change le NET À PAYER)
      acompte_pourcent: facture.acompte_pourcent ?? undefined,
      acompte_montant_ht: facture.acompte_montant_ht ?? undefined,
      acompte_montant_ttc: facture.acompte_montant_ttc ?? undefined,
      acompte_label: facture.acompte_label || undefined,
      // P2 (audit) : type de facture (standard / acompte / situation / avoir)
      type: facture.type || undefined,
      numero_situation: facture.numero_situation ?? undefined,
      // V3.0c.18 — Champs complémentaires factures de situation (parité PDF download).
      // Sans ces champs, le bandeau "AVANCEMENT" du PDF s'affiche en mode dégradé
      // (cumul précédent et reste à facturer manquants).
      pourcentage_situation: facture.pourcentage_situation ?? undefined,
      devis_ref: facture.devis_ref || undefined,
      devis_date: facture.devis_date || undefined,
      montant_situation_precedent_ht: facture.montant_situation_precedent_ht ?? undefined,
      montant_situation_precedent_ttc: facture.montant_situation_precedent_ttc ?? undefined,
      reste_a_facturer_ht: facture.reste_a_facturer_ht ?? undefined,
      reste_a_facturer_ttc: facture.reste_a_facturer_ttc ?? undefined,
      // Legacy : ancien champ notes conservé pour rétrocompat
      notes: facture.notes,
    }, themeFromEntreprise(entreprise))

    // Build email body
    const entNom = String(ent.nom || 'Nexartis')
    const entEmail = String(ent.email || 'no-reply@nexartis.fr')
    const preheader = 'Facture n\u00b0 ' + facture.numero + ' - ' + fmt(totalTTC)

    let emailBody: string
    if (messagePersonnalise) {
      emailBody = String(messagePersonnalise).replace(/\n/g, '<br/>')
    } else {
      const echeanceLine = dateEcheance ? " Dans l'attente de votre r\u00e8glement avant le " + dateEcheance + '.' : ''
      emailBody = 'Bonjour ' + clientNom + ',<br/><br/>Veuillez trouver ci-joint votre facture n\u00b0 ' + facture.numero + " d'un montant de " + fmt(totalTTC) + '.' + echeanceLine + '<br/><br/>Cordialement,<br/><strong>' + entNom + '</strong>'
    }

    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;"><span style="display:none;max-height:0;overflow:hidden;">' + preheader + '</span><div style="max-width:580px;margin:0 auto;padding:20px;"><div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;"><div style="padding:28px;"><p style="font-size:15px;color:#374151;margin:0 0 16px;line-height:1.6;">' + emailBody + '</p><p style="font-size:14px;color:#6b7280;margin:16px 0 0;line-height:1.6;">Vous trouverez la facture d\u00e9taill\u00e9e en pi\u00e8ce jointe de cet email.</p></div><div style="padding:12px 28px;border-top:1px solid #e5e7eb;text-align:center;"><p style="margin:0;font-size:11px;color:#9ca3af;">Envoy\u00e9 via Nexartis \u2014 nexartis.fr</p></div></div></div></body></html>'

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: entNom, email: 'no-reply@nexartis.fr' },
        to: [{ email: emailDestinataire, name: clientNom }],
        subject: 'Facture n\u00b0 ' + facture.numero + ' \u2014 ' + entNom,
        replyTo: { email: entEmail, name: entNom },
        htmlContent: html,
        attachment: [{
          content: pdfBase64,
          name: 'Facture-' + facture.numero + '.pdf',
        }],
      }),
    })

    if (!brevoResponse.ok) {
      const brevoErr = await brevoResponse.json()
      console.error('Brevo error:', brevoErr)
      return NextResponse.json({ error: brevoErr.message || 'Erreur envoi Brevo' }, { status: 500 })
    }

    if (facture.statut === 'brouillon' || facture.statut === 'En attente') {
      await supabase.from('factures').update({ statut: 'En attente', date_envoi: new Date().toISOString() }).eq('id', factureId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send facture error:', error)
    return secureError('Erreur lors de l\'envoi de la facture', 500)
  }
}
