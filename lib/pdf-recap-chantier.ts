// -------------------------------------------------------------------
// Server-side PDF generation — RÉCAPITULATIF DE CHANTIER (côté client)
//
// Document de SUIVI et de RÉCAP destiné au client à la fin (ou en cours)
// d'un chantier : récap travaux + financier + timeline notes + garanties + SAV.
//
// V2 : aligné sur la charte des devis/factures (police Hanken Grotesk + palette
// navy/orange via lib/pdf-fonts + lib/pdf/utils + lib/pdf/palette). Plus de vert.
// Garanties EXACTES et CONDITIONNELLES (la décennale n'apparaît que si l'artisan
// a renseigné son assurance ; formulation prudente "selon la nature des travaux").
//
// Format : 2 pages A4 max (compact, lisible, professionnel).
// -------------------------------------------------------------------

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerPdfFonts } from '@/lib/pdf-fonts'
import { C } from '@/lib/pdf/palette'
import { font, setFill, setDraw, fmt } from '@/lib/pdf/utils'

// ============ TYPES ============

interface Entreprise {
  nom?: string | null
  siret?: string | null
  code_naf?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  telephone?: string | null
  email?: string | null
  logo_url?: string | null
  decennale_numero?: string | null
  decennale_compagnie?: string | null
  signature_base64?: string | null
  tampon_base64?: string | null
}

interface Chantier {
  id: string
  titre?: string | null
  description?: string | null
  description_client?: string | null
  adresse_chantier?: string | null
  code_postal_chantier?: string | null
  ville_chantier?: string | null
  date_debut?: string | null
  date_fin_prevue?: string | null
  date_fin_reelle?: string | null
}

interface Client {
  civilite?: string | null
  nom?: string | null
  prenom?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  telephone?: string | null
  email?: string | null
}

interface PlanningIntervention {
  id: string
  date_debut: string
  date_fin?: string | null
  intervenant_id?: string | null
  devis_id?: string | null
}

interface Intervenant {
  id: string
  prenom?: string | null
  nom?: string | null
  metier?: string | null
}

interface DevisForRecap {
  id: string
  numero?: string | null
  objet?: string | null
  description?: string | null
  montant_ttc?: number | null
  montant_acompte?: number | null
  acompte_verse?: boolean | null
  statut?: string | null
}

interface InterventionNoteForRecap {
  id: string
  intervention_id: string
  type: 'note_client' | 'presence_requise' | 'presence_obligatoire' | 'preparation' | 'note_artisan'
  texte: string
  date_intervention?: string | null
}

export interface RecapChantierPdfData {
  entreprise: Entreprise
  chantier: Chantier
  client: Client | null
  interventions: PlanningIntervention[]
  intervenants: Intervenant[]
  devis: DevisForRecap[]
  interventionNotes?: InterventionNoteForRecap[]
}

// ============ HELPERS ============

function fmtDateLong(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtDateShort(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function generateRecapRef(chantierId: string): string {
  const year = new Date().getFullYear()
  const short = chantierId.replace(/-/g, '').substring(0, 6).toUpperCase()
  return `RC-${year}-${short}`
}

function computePeriodeReelle(interventions: PlanningIntervention[]): { debut: string | null; fin: string | null; jours: number } {
  if (interventions.length === 0) return { debut: null, fin: null, jours: 0 }
  const sorted = [...interventions].sort((a, b) => a.date_debut.localeCompare(b.date_debut))
  const debut = sorted[0].date_debut.split('T')[0]
  const lastIv = sorted[sorted.length - 1]
  const fin = (lastIv.date_fin || lastIv.date_debut).split('T')[0]
  const daySet = new Set<string>()
  interventions.forEach(iv => {
    const start = new Date(iv.date_debut.split('T')[0])
    const end = new Date((iv.date_fin || iv.date_debut).split('T')[0])
    const cur = new Date(start)
    while (cur <= end) {
      daySet.add(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`)
      cur.setDate(cur.getDate() + 1)
    }
  })
  return { debut, fin, jours: daySet.size }
}

function drawSectionTitle(doc: jsPDF, x: number, y: number, w: number, label: string): number {
  font(doc, 'Hanken Grotesk', 'extrabold', 9, C.navy)
  doc.text(label.toUpperCase(), x, y)
  setDraw(doc, C.border)
  doc.setLineWidth(0.3)
  doc.line(x, y + 2, x + w, y + 2)
  return y + 7
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 285) { doc.addPage(); return 15 }
  return y
}

// ============ MAIN ============

export function generateRecapChantierPdf(data: RecapChantierPdfData): string {
  const { entreprise, chantier, client, interventions, devis, interventionNotes } = data
  const doc = new jsPDF()
  registerPdfFonts(doc)

  const M = 16
  const pageW = 210
  const pageH = 297
  const contentW = pageW - 2 * M
  let y = 12

  // ============================================================
  // HEADER
  // ============================================================
  const headerH = 26

  if (entreprise.logo_url && entreprise.logo_url.startsWith('data:image')) {
    try {
      const fmtImg = entreprise.logo_url.includes('image/png') ? 'PNG' : 'JPEG'
      const ip = doc.getImageProperties(entreprise.logo_url)
      const ratio = ip.width / ip.height
      let lw = 20
      let lh = lw / ratio
      if (lh > 22) { lh = 22; lw = lh * ratio }
      if (lw > 40) lw = 40
      doc.addImage(entreprise.logo_url, fmtImg, M, y + 1, lw, lh)
    } catch { /* ignore */ }
  }

  const infoX = entreprise.logo_url ? M + 24 : M
  let infoY = y + 4
  font(doc, 'Hanken Grotesk', 'extrabold', 13, C.navy)
  doc.text(entreprise.nom || 'Entreprise', infoX, infoY)
  infoY += 4.5

  font(doc, 'Hanken Grotesk', 'normal', 7, C.navyMid)
  const adresseLine = [entreprise.adresse, entreprise.code_postal, entreprise.ville].filter(Boolean).join(', ')
  if (adresseLine) { doc.text(adresseLine, infoX, infoY); infoY += 3 }
  const siretLine = [
    entreprise.siret ? `SIRET ${entreprise.siret}` : null,
    entreprise.code_naf ? `APE ${entreprise.code_naf}` : null,
  ].filter(Boolean).join(' · ')
  if (siretLine) { doc.text(siretLine, infoX, infoY); infoY += 3 }
  const contactLine = [entreprise.telephone, entreprise.email].filter(Boolean).join(' · ')
  if (contactLine) { doc.text(contactLine, infoX, infoY); infoY += 3 }

  // Badge "RÉCAPITULATIF DE CHANTIER" (navy, charte) + réf à droite
  const refX = pageW - M - 60
  const refY = y + 1
  setFill(doc, C.navy)
  doc.roundedRect(refX, refY, 60, 7, 1.2, 1.2, 'F')
  font(doc, 'Hanken Grotesk', 'bold', 8, C.white)
  doc.text('RÉCAPITULATIF DE CHANTIER', refX + 30, refY + 4.8, { align: 'center' })

  font(doc, 'Hanken Grotesk', 'normal', 7, C.muted)
  doc.text('Référence', refX, refY + 12)
  font(doc, 'Hanken Grotesk', 'bold', 9, C.navy)
  doc.text(generateRecapRef(chantier.id), refX, refY + 16)
  font(doc, 'Hanken Grotesk', 'normal', 7, C.muted)
  doc.text('Édité le', refX, refY + 21)
  font(doc, 'Hanken Grotesk', 'normal', 8, C.navyMid)
  doc.text(fmtDateLong(new Date().toISOString()), refX, refY + 24.5)

  y += headerH
  setDraw(doc, C.border)
  doc.setLineWidth(0.3)
  doc.line(M, y, pageW - M, y)
  y += 6

  // ============================================================
  // TITRE CHANTIER
  // ============================================================
  font(doc, 'Hanken Grotesk', 'extrabold', 15, C.navy)
  doc.text(chantier.titre || 'Chantier', M, y + 5)
  y += 9

  if (chantier.description_client) {
    font(doc, 'Hanken Grotesk', 'normal', 9, C.navyMid)
    const lines = doc.splitTextToSize(chantier.description_client, contentW)
    doc.text(lines, M, y + 3)
    y += lines.length * 4 + 3
  }
  y += 1

  // Mention "informatif" — evite toute requalification en facture ou en PV de reception.
  font(doc, 'Hanken Grotesk', 'normal', 7.5, C.muted)
  doc.text('Document informatif — il ne vaut ni facture ni procès-verbal de réception des travaux.', M, y + 2)
  y += 6

  // ============================================================
  // BLOCS CLIENT + LIEU CHANTIER
  // ============================================================
  const colW = (contentW - 4) / 2
  const blocH = 28
  const clientName = client
    ? `${client.civilite ?? ''} ${client.prenom ?? ''} ${client.nom ?? ''}`.replace(/\s+/g, ' ').trim()
    : 'Client non renseigné'

  // CLIENT (accent orange)
  setFill(doc, C.grayPale)
  doc.roundedRect(M, y, colW, blocH, 1.5, 1.5, 'F')
  setFill(doc, C.orange)
  doc.rect(M, y, 1.2, blocH, 'F')
  font(doc, 'Hanken Grotesk', 'bold', 7, C.muted)
  doc.text('CLIENT', M + 4, y + 4.5)
  font(doc, 'Hanken Grotesk', 'bold', 10, C.navy)
  doc.text(clientName, M + 4, y + 9)
  font(doc, 'Hanken Grotesk', 'normal', 7.5, C.navyMid)
  let cy = y + 13
  if (client?.adresse) {
    doc.text(client.adresse, M + 4, cy); cy += 3
    const cl = [client.code_postal, client.ville].filter(Boolean).join(' ')
    if (cl) { doc.text(cl, M + 4, cy); cy += 3 }
  }
  if (client?.telephone || client?.email) {
    doc.text([client.telephone, client.email].filter(Boolean).join(' · '), M + 4, cy)
  }

  // LIEU CHANTIER (accent navy)
  const lx = M + colW + 4
  setFill(doc, C.grayPale)
  doc.roundedRect(lx, y, colW, blocH, 1.5, 1.5, 'F')
  setFill(doc, C.navy)
  doc.rect(lx, y, 1.2, blocH, 'F')
  font(doc, 'Hanken Grotesk', 'bold', 7, C.muted)
  doc.text('LIEU DU CHANTIER', lx + 4, y + 4.5)
  font(doc, 'Hanken Grotesk', 'normal', 9, C.navy)
  let ly = y + 9
  if (chantier.adresse_chantier) { doc.text(chantier.adresse_chantier, lx + 4, ly); ly += 4 }
  const lieu = [chantier.code_postal_chantier, chantier.ville_chantier].filter(Boolean).join(' ')
  if (lieu) { doc.text(lieu, lx + 4, ly); ly += 4 }
  const periode = computePeriodeReelle(interventions)
  font(doc, 'Hanken Grotesk', 'normal', 7.5, C.navyMid)
  if (periode.debut && periode.fin) {
    doc.text(`Du ${fmtDateLong(periode.debut)} au ${fmtDateLong(periode.fin)}`, lx + 4, ly + 1)
    ly += 3.5
    font(doc, 'Hanken Grotesk', 'normal', 7, C.muted)
    doc.text(`${periode.jours} jour${periode.jours > 1 ? 's' : ''} d'intervention`, lx + 4, ly + 1)
  } else {
    doc.text("Période d'intervention à venir", lx + 4, ly + 1)
  }

  y += blocH + 6

  // ============================================================
  // VOS TRAVAUX RÉALISÉS
  // ============================================================
  // Section masquée s'il n'y a aucun devis (evite l'effet "document vide").
  if (devis.length > 0) {
    y = drawSectionTitle(doc, M, y, contentW, 'Vos travaux réalisés')
    devis.forEach((d, idx) => {
      const description = d.description || d.objet || ''
      const descLines = description ? doc.splitTextToSize(description, contentW - 8) : []
      const blockH = 11 + Math.min(descLines.length, 3) * 3.5
      y = ensureSpace(doc, y, blockH + 3)

      setFill(doc, C.grayPale)
      doc.roundedRect(M, y, contentW, blockH, 1.2, 1.2, 'F')
      const isFacture = d.statut === 'facture'
      const isSigne = d.statut === 'signe' || d.statut === 'envoye'
      const statusColor = isFacture ? C.navy : isSigne ? C.orange : C.muted
      setFill(doc, statusColor)
      doc.rect(M, y, 1.5, blockH, 'F')

      font(doc, 'Hanken Grotesk', 'bold', 8.5, C.navy)
      const numero = d.numero ? `Devis ${d.numero}` : `Phase ${idx + 1}`
      doc.text(numero, M + 4, y + 4.5)

      const objet = d.objet || ''
      if (objet) {
        font(doc, 'Hanken Grotesk', 'normal', 8, C.navyMid)
        const objLine = doc.splitTextToSize(objet, contentW - 8)[0] || objet
        doc.text(objLine, M + 4, y + 8.5)
      }
      if (descLines.length > 0 && descLines[0] !== objet) {
        font(doc, 'Hanken Grotesk', 'normal', 7.5, C.muted)
        doc.text(descLines.slice(0, 3), M + 4, y + 12)
      }
      y += blockH + 2
    })
    y += 2
  }

  // RÉCAPITULATIF FINANCIER (masqué si aucun devis)
  if (devis.length > 0) {
  y = ensureSpace(doc, y, 50)
  y = drawSectionTitle(doc, M, y, contentW, 'Récapitulatif financier')

  const tableRows = devis.map(d => {
    const ttc = Number(d.montant_ttc ?? 0)
    const acompteVerse = d.acompte_verse ? Number(d.montant_acompte ?? 0) : 0
    const dejaPaye = d.statut === 'facture' ? ttc : acompteVerse
    const reste = Math.max(0, ttc - dejaPaye)
    return [d.numero || '—', d.objet || '—', fmt(ttc), fmt(dejaPaye), fmt(reste)]
  })

  const totalTTC = devis.reduce((acc, d) => acc + Number(d.montant_ttc ?? 0), 0)
  const totalPaye = devis.reduce((acc, d) => {
    const ttc = Number(d.montant_ttc ?? 0)
    if (d.statut === 'facture') return acc + ttc
    return acc + (d.acompte_verse ? Number(d.montant_acompte ?? 0) : 0)
  }, 0)
  const totalReste = Math.max(0, totalTTC - totalPaye)

  if (tableRows.length > 0) {
    autoTable(doc, {
      head: [['Devis', 'Désignation', 'Montant TTC', 'Déjà payé', 'Solde']],
      body: tableRows,
      foot: [['', 'TOTAL', fmt(totalTTC), fmt(totalPaye), fmt(totalReste)]],
      startY: y,
      theme: 'grid',
      margin: { left: M, right: M },
      styles: { font: 'Hanken Grotesk', fontStyle: 'normal', fontSize: 8, cellPadding: 2, lineColor: [...C.border], textColor: [...C.navy] },
      headStyles: { font: 'Hanken Grotesk', fillColor: [...C.navy], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      footStyles: { font: 'Hanken Grotesk', fillColor: [...C.grayPale], textColor: [...C.navy], fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right', textColor: [...C.orange], fontStyle: 'bold' },
      },
    })
    // @ts-expect-error - lastAutoTable est ajouté par autoTable au runtime
    y = (doc.lastAutoTable?.finalY ?? y) + 4

    // Bandeau résumé (charte : orangePale si solde, skyVeryPale si soldé)
    if (totalTTC > 0) {
      const bandH = 12
      y = ensureSpace(doc, y, bandH + 4)
      setFill(doc, totalReste > 0 ? C.orangePale : C.skyVeryPale)
      doc.roundedRect(M, y, contentW, bandH, 1.5, 1.5, 'F')
      font(doc, 'Hanken Grotesk', 'bold', 8, totalReste > 0 ? C.orange : C.navy)
      const msg = totalReste > 0
        ? `Solde restant à régler : ${fmt(totalReste)}`
        : 'Chantier intégralement réglé. Merci de votre confiance.'
      doc.text(msg, M + contentW / 2, y + 7.5, { align: 'center' })
      y += bandH + 6
    }
  }
  } // fin section financière (masquée si aucun devis)

  // ============================================================
  // PAGE 2
  // ============================================================
  doc.addPage()
  y = 15
  font(doc, 'Hanken Grotesk', 'bold', 9, C.muted)
  doc.text((entreprise.nom || 'Entreprise').toUpperCase(), M, y)
  doc.text(generateRecapRef(chantier.id), pageW - M, y, { align: 'right' })
  setDraw(doc, C.border)
  doc.setLineWidth(0.2)
  doc.line(M, y + 2, pageW - M, y + 2)
  y += 8

  // ÉCHANGES & INFORMATIONS
  y = drawSectionTitle(doc, M, y, contentW, 'Échanges & informations sur le chantier')
  const visibleNotes = (interventionNotes || [])
    .filter(n => n.type !== 'note_artisan')
    .sort((a, b) => (a.date_intervention || '').localeCompare(b.date_intervention || ''))

  if (visibleNotes.length === 0) {
    font(doc, 'Hanken Grotesk', 'normal', 8.5, C.muted)
    doc.text("Aucune note d'intervention enregistrée pour ce chantier.", M, y + 3)
    y += 8
  } else {
    const TYPE_META: Record<string, { label: string; color: readonly [number, number, number] }> = {
      note_client: { label: 'Info client', color: C.orange },
      presence_requise: { label: 'Présence', color: C.navy },
      presence_obligatoire: { label: 'Obligatoire', color: C.amberAccent },
      preparation: { label: 'Préparation', color: C.navyMid },
    }
    visibleNotes.forEach(note => {
      const meta = TYPE_META[note.type] || { label: note.type, color: C.muted }
      const txtLines = doc.splitTextToSize(note.texte, contentW - 36)
      const blockH = Math.max(11, txtLines.length * 3.5 + 4)
      y = ensureSpace(doc, y, blockH + 2)

      setFill(doc, C.grayPale)
      doc.roundedRect(M, y, 22, blockH, 1, 1, 'F')
      font(doc, 'Hanken Grotesk', 'bold', 7, C.navy)
      doc.text(note.date_intervention ? fmtDateShort(note.date_intervention) : '—', M + 11, y + 4, { align: 'center' })
      const dateObj = note.date_intervention ? new Date(note.date_intervention) : null
      const dayLabel = dateObj ? ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][dateObj.getDay()] : ''
      if (dayLabel) { font(doc, 'Hanken Grotesk', 'normal', 6, C.muted); doc.text(dayLabel, M + 11, y + 7.5, { align: 'center' }) }

      const badgeX = M + 24
      const badgeW = 28
      setFill(doc, meta.color)
      doc.roundedRect(badgeX, y + 1, badgeW, 4.5, 0.8, 0.8, 'F')
      font(doc, 'Hanken Grotesk', 'bold', 6.5, C.white)
      doc.text(meta.label.toUpperCase(), badgeX + badgeW / 2, y + 4.2, { align: 'center' })

      font(doc, 'Hanken Grotesk', 'normal', 8, C.navy)
      doc.text(txtLines, badgeX, y + 8)
      y += blockH + 1.5
    })
    y += 3
  }

  // ============================================================
  // GARANTIES — EXACTES & CONDITIONNELLES
  // ============================================================
  const hasDecennale = !!(entreprise.decennale_numero && entreprise.decennale_numero.trim())
  const garanties: { titre: string; duree: string; description: string }[] = [
    {
      titre: 'Garantie de parfait achèvement',
      duree: '1 an',
      description: "Les désordres signalés dans l'année suivant la réception sont repris (art. 1792-6 du Code civil).",
    },
    {
      titre: 'Garantie de bon fonctionnement (biennale)',
      duree: '2 ans',
      description: "Couvre les éléments d'équipement dissociables de l'ouvrage (art. 1792-3).",
    },
  ]
  if (hasDecennale) {
    garanties.push({
      titre: 'Garantie décennale',
      duree: '10 ans',
      description: `Dommages compromettant la solidité de l'ouvrage ou le rendant impropre à sa destination. Assurance n° ${entreprise.decennale_numero}${entreprise.decennale_compagnie ? ` — ${entreprise.decennale_compagnie}` : ''}.`,
    })
  }

  y = ensureSpace(doc, y, 18 + garanties.length * 12)
  y = drawSectionTitle(doc, M, y, contentW, 'Vos garanties')

  // Intro prudente : garanties SELON LA NATURE des travaux + date de réception (point de départ).
  font(doc, 'Hanken Grotesk', 'normal', 8, C.muted)
  const receptionTxt = chantier.date_fin_reelle
    ? ` Elles courent à compter de la réception des travaux du ${fmtDateLong(chantier.date_fin_reelle)}.`
    : ' Elles courent à compter de la réception des travaux.'
  const introG = (hasDecennale
    ? "Selon la nature des travaux réalisés, les garanties légales suivantes peuvent s'appliquer."
    : "Selon la nature des travaux réalisés, les garanties légales suivantes peuvent s'appliquer (la garantie décennale concerne les travaux de construction qui en relèvent).")
    + receptionTxt
  const introLines = doc.splitTextToSize(introG, contentW)
  doc.text(introLines, M, y + 1)
  y += introLines.length * 3.5 + 3

  garanties.forEach(g => {
    y = ensureSpace(doc, y, 13)
    setFill(doc, C.grayPale)
    doc.roundedRect(M, y, contentW, 11, 1.2, 1.2, 'F')
    setFill(doc, C.navy)
    doc.roundedRect(M + 2, y + 2, 14, 7, 1, 1, 'F')
    font(doc, 'Hanken Grotesk', 'bold', 8, C.white)
    doc.text(g.duree, M + 9, y + 6.7, { align: 'center' })
    font(doc, 'Hanken Grotesk', 'bold', 8.5, C.navy)
    doc.text(g.titre, M + 19, y + 4.5)
    font(doc, 'Hanken Grotesk', 'normal', 7.5, C.navyMid)
    const dl = doc.splitTextToSize(g.description, contentW - 22)[0] || g.description
    doc.text(dl, M + 19, y + 8)
    y += 12
  })
  y += 3

  // ============================================================
  // SAV / CONTACT
  // ============================================================
  y = ensureSpace(doc, y, 22)
  y = drawSectionTitle(doc, M, y, contentW, 'Service après-vente')
  setFill(doc, C.grayPale)
  doc.roundedRect(M, y, contentW, 14, 1.5, 1.5, 'F')
  setFill(doc, C.orange)
  doc.rect(M, y, 1.2, 14, 'F')
  font(doc, 'Hanken Grotesk', 'bold', 8, C.navy)
  doc.text('Pour toute question ou demande de SAV, contactez-nous :', M + 4, y + 5)
  font(doc, 'Hanken Grotesk', 'normal', 9, C.navyMid)
  const contactRaw = [
    entreprise.telephone ? `Tél. ${entreprise.telephone}` : null,
    entreprise.email,
  ].filter(Boolean).join('   ·   ')
  doc.text(contactRaw, M + 4, y + 11)
  y += 18

  // ============================================================
  // BAS DE PAGE
  // ============================================================
  const footY = pageH - 18
  setDraw(doc, C.border)
  doc.setLineWidth(0.2)
  doc.line(M, footY, pageW - M, footY)
  font(doc, 'Hanken Grotesk', 'normal', 7, C.muted)
  const footMsg = 'Document récapitulatif de chantier — Vos devis et factures vous ont été remis séparément. Conservez ce récap avec vos documents importants.'
  doc.text(doc.splitTextToSize(footMsg, contentW), pageW / 2, footY + 4, { align: 'center' })
  font(doc, 'Hanken Grotesk', 'normal', 6.5, C.muted)
  doc.text('Document généré avec Nexartis · www.nexartis.fr', pageW / 2, pageH - 6, { align: 'center' })

  return doc.output('datauristring')
}
