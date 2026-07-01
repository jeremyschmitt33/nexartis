// ============================================================================
// components/document/CopDocument.tsx
// ----------------------------------------------------------------------------
// Rendu du "Contrat d'ouverture de porte" (COP). Calque DocumentRender.tsx :
// on REUTILISE les classes de document.css (dv-*) pour une parite visuelle
// stricte avec les devis (bandeau, cartes, tableau, recap, signatures, pied).
//
// TYPOGRAPHIE (regle stricte) : montants via eur() dans les cellules dv-c-tot /
// dv-recap-* qui appliquent deja Hanken tabulaire. Le numero COP utilise
// .dv-d-num (Spline Mono). Aucun montant en mono, aucune Syne dans le document.
// ============================================================================

import { Fragment, type CSSProperties } from 'react'
import './document.css'
import type { DocumentArtisan } from '@/lib/document-data'
import { eur, tauxLabel, type CopData, type CopLegal } from '@/lib/cop-data'
import { DEFAULT_DOCUMENT_THEME, themeToCssVars, type DocumentTheme } from '@/lib/document-theme'
import { DEFAULT_LOGO_CONFIG, logoConfigToCssVars, type LogoConfig } from '@/lib/logo-config'

function formatPhone(raw?: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (/[\s.\-]/.test(trimmed)) return trimmed
  if (/^0\d{9}$/.test(trimmed)) return trimmed.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  return trimmed
}

export default function CopDocument({
  data,
  theme,
  logoConfig,
}: {
  data: CopData & { legal: CopLegal }
  theme?: DocumentTheme
  logoConfig?: LogoConfig
}) {
  const themeStyle = themeToCssVars(theme ?? DEFAULT_DOCUMENT_THEME)
  const logoStyle = logoConfigToCssVars(logoConfig ?? DEFAULT_LOGO_CONFIG)
  const mergedStyle = { ...themeStyle, ...logoStyle }
  // On herite du look "devis" (dv-doctype-devis) : meme taille de bandeau.
  return (
    <div className="dv-doc dv-dir-D dv-density-compact dv-doctype-devis" style={mergedStyle}>
      <section className="dv-page">
        <HeaderD data={data} />
        <div className="dv-body">
          <TitreBloc data={data} />
          <BaremeTable data={data} />
          <RecapCop data={data} />
          <PrixFermeBox text={data.legal.prixFerme} />
          <AttestationBox text={data.legal.attestation} identiteVerifiee={data.identiteVerifiee} pieceNature={data.pieceNature} />
          <RenonciationBox mentions={data.legal.renonciation} />
          <BlocBBox text={data.legal.blocB} />
          <SignatureCop artisan={data.artisan} />
          <RgpdBox text={data.legal.rgpd} />
        </div>
        <PageFootRich artisan={data.artisan} />
      </section>
    </div>
  )
}

// ── Bandeau + cartes emetteur / occupant ──────────────────────────────────
function HeaderD({ data }: { data: CopData }) {
  const { artisan, meta } = data
  return (
    <header className="dv-head dv-headD">
      <div className="dv-d-band">
        <span className="dv-d-geo" aria-hidden="true" />
        <span className="dv-d-geo2" aria-hidden="true" />
        <div className="dv-d-brand">
          <div className="dv-d-logomark">
            {artisan.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artisan.logoUrl} alt={`Logo ${artisan.nom}`} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" />
              </svg>
            )}
          </div>
          <div className="dv-d-brandtext">
            <span className="dv-d-name">{artisan.nom}</span>
          </div>
        </div>
        <div className="dv-d-title">
          {/* Titre plus long que "DEVIS" : on reduit la taille inline pour tenir. */}
          <div className="dv-d-doctype" style={DOCTYPE_STYLE}>OUVERTURE<br />DE PORTE</div>
          <div className="dv-d-num">{meta.numero}</div>
          <div className="dv-d-metaline">
            {meta.dateIntervention && (<div>Intervention le <strong>{meta.dateIntervention}</strong></div>)}
            {meta.lieu && (<div>Lieu <strong>{meta.lieu}</strong></div>)}
          </div>
        </div>
      </div>
      <div className="dv-d-parties">
        <CardFrom artisan={artisan} />
        <CardOccupant data={data} />
      </div>
    </header>
  )
}

const DOCTYPE_STYLE: CSSProperties = { fontSize: 28, lineHeight: 0.95 }

function CardFrom({ artisan }: { artisan: DocumentArtisan }) {
  return (
    <div className="dv-d-card dv-d-card--from">
      <span className="dv-d-chip">Emetteur</span>
      <span className="dv-d-cardname">{artisan.nom}</span>
      <div className="dv-d-cardrows">
        {artisan.adresseLine1 && <div>{artisan.adresseLine1}</div>}
        {artisan.adresseLine2 && <div>{artisan.adresseLine2}</div>}
        {artisan.tel && <div>{formatPhone(artisan.tel)}</div>}
        {artisan.email && <div>{artisan.email}</div>}
        {artisan.siret && <div>SIRET {artisan.siret}</div>}
      </div>
    </div>
  )
}

function CardOccupant({ data }: { data: CopData }) {
  const { client } = data
  const nomComplet = [client.prenom, client.nom].filter(Boolean).join(' ')
  const cpVille = [client.cp, client.ville].filter(Boolean).join(' ')
  const statutLabel = data.statutOccupant === 'proprietaire' ? 'Proprietaire' : data.statutOccupant === 'locataire' ? 'Locataire' : null
  return (
    <div className="dv-d-card dv-d-card--to">
      <span className="dv-d-chip dv-d-chip--accent">Occupant</span>
      <span className="dv-d-cardname">{nomComplet || '—'}</span>
      <div className="dv-d-cardrows">
        {client.adresse && <div>{client.adresse}</div>}
        {cpVille && <div>{cpVille}</div>}
        {statutLabel && <div>{statutLabel}</div>}
      </div>
    </div>
  )
}

// ── Titre du document ──────────────────────────────────────────────────────
function TitreBloc({ data }: { data: CopData }) {
  return (
    <div className="dv-objet">
      <div>
        <span className="dv-objet-k">Objet</span>
        <span className="dv-objet-v">
          Contrat d&apos;ouverture de porte
          {data.natureUrgence ? ` — ${data.natureUrgence}` : ''}
        </span>
      </div>
    </div>
  )
}

// ── Tableau du bareme ──────────────────────────────────────────────────────
function BaremeTable({ data }: { data: CopData }) {
  return (
    <table className="dv-table">
      <thead>
        <tr>
          <th className="dv-c-num">#</th>
          <th className="dv-c-desg">Designation</th>
          <th className="dv-c-qte">Qte</th>
          <th className="dv-c-pu">P.U. HT</th>
          <th className="dv-c-tva">TVA</th>
          <th className="dv-c-tot">Total HT</th>
        </tr>
      </thead>
      <tbody>
        {data.lignes.map((l, i) => (
          <tr key={`cop-${i}`} className="dv-row dv-row--item">
            <td className="dv-c-num">{i + 1}</td>
            <td className="dv-c-desg">{l.designation}</td>
            <td className="dv-c-qte">
              {Number(l.quantite).toLocaleString('fr-FR')}
              {l.unite && <span className="dv-unit"> {l.unite}</span>}
            </td>
            <td className="dv-c-pu">{eur(l.pu_ht)}</td>
            <td className="dv-c-tva">{tauxLabel(l.tva_taux)}</td>
            <td className="dv-c-tot">{eur(l.quantite * l.pu_ht)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Recap totaux (calque RecapDevis / TotalsBox) ───────────────────────────
function RecapCop({ data }: { data: CopData }) {
  const { totals } = data
  return (
    <div className="dv-recap">
      <div className="dv-recap-notes">
        <div className="dv-recap-notes-title">Conditions de reglement</div>
        <p>Reglement de l&apos;intervention d&apos;urgence a la fin de la prestation (especes, carte, virement ou cheque).</p>
        {(data.artisan.iban || data.artisan.bic) && (
          <div className="dv-pay">
            <div className="dv-pay-k">Pour regler par virement</div>
            {data.artisan.iban && (<div className="dv-pay-row"><span>IBAN</span><strong>{data.artisan.iban}</strong></div>)}
            {data.artisan.bic && (<div className="dv-pay-row"><span>BIC</span><strong>{data.artisan.bic}</strong></div>)}
            <div className="dv-pay-row"><span>Beneficiaire</span><strong>{data.artisan.nom}</strong></div>
          </div>
        )}
      </div>
      <div className="dv-recap-box">
        <div className="dv-recap-line"><span>Sous-total HT</span><span>{eur(totals.ht)}</span></div>
        {totals.parTaux.length === 0 && (
          <div className="dv-recap-line dv-recap-line--mute"><span>TVA non applicable</span><span>{eur(0)}</span></div>
        )}
        {totals.parTaux.map((l) => (
          <div className="dv-recap-line dv-recap-line--mute" key={`t-${l.taux}`}>
            <span>TVA {tauxLabel(l.taux)} <em>(base {eur(l.base)})</em></span>
            <span>{eur(l.montant)}</span>
          </div>
        ))}
        <div className="dv-recap-line dv-recap-line--ttc"><span>Total TTC</span><span>{eur(totals.ttc)}</span></div>
        <div className="dv-recap-net">
          <span>Net a payer</span>
          <strong>{eur(totals.ttc)}</strong>
        </div>
      </div>
    </div>
  )
}

// ── Encadres juridiques (reutilisent le style attest/legal) ────────────────
function PrixFermeBox({ text }: { text: string }) {
  return (
    <div style={BOX_ACCENT}>
      <div style={BOX_TITLE}>Prix ferme de l&apos;ouverture d&apos;urgence</div>
      <p style={BOX_TEXT}>{text}</p>
    </div>
  )
}

function AttestationBox({ text, identiteVerifiee, pieceNature }: { text: string; identiteVerifiee: boolean; pieceNature?: string }) {
  return (
    <div style={BOX_PLAIN}>
      <div style={BOX_TITLE}>Attestation de droit d&apos;acces</div>
      <p style={BOX_TEXT}>{text}</p>
      <p style={BOX_TEXT_MUTE}>
        Identite verifiee sur place par l&apos;intervenant : <strong>{identiteVerifiee ? 'Oui' : 'Non'}</strong>
        {pieceNature ? ` — Type de piece : ${pieceNature}` : ''}
      </p>
    </div>
  )
}

function RenonciationBox({ mentions }: { mentions: string[] }) {
  return (
    <div style={BOX_PLAIN}>
      <div style={BOX_TITLE}>Droit de retractation (execution immediate demandee)</div>
      <ol style={{ margin: '4px 0 0', paddingLeft: 18, ...BOX_TEXT }}>
        {mentions.map((m, i) => (
          <li key={`ren-${i}`} style={{ marginBottom: 4 }}>{m}</li>
        ))}
      </ol>
    </div>
  )
}

function BlocBBox({ text }: { text: string }) {
  return (
    <div style={BOX_PLAIN}>
      <div style={BOX_TITLE}>Remise en etat (hors urgence)</div>
      <p style={BOX_TEXT}>{text}</p>
    </div>
  )
}

function RgpdBox({ text }: { text: string }) {
  return (
    <div className="dv-legal">
      <div className="dv-legal-grid">
        <div><span className="dv-legal-k">Donnees personnelles</span>{text}</div>
      </div>
    </div>
  )
}

// ── Zone signatures (2 cases vides en 1a ; la signature reelle viendra en 1b) ──
function SignatureCop({ artisan }: { artisan: DocumentArtisan }) {
  return (
    <div className="dv-sign">
      <div className="dv-sign-box">
        <div className="dv-sign-label">L&apos;occupant</div>
        <div className="dv-sign-hint">Date, mention « Lu et approuve » et signature</div>
      </div>
      <div className="dv-sign-box">
        <div className="dv-sign-label">{artisan.nom || "L'entreprise"}</div>
        <div className="dv-sign-hint">Signature &amp; cachet de l&apos;entreprise</div>
      </div>
    </div>
  )
}

function PageFootRich({ artisan }: { artisan: DocumentArtisan }) {
  const line1Parts = [
    artisan.nom,
    [artisan.adresseLine1, artisan.adresseLine2].filter(Boolean).join(', '),
    artisan.siret && `SIRET : ${artisan.siret}`,
    artisan.email && `Email : ${artisan.email}`,
  ].filter(Boolean)
  const line2Parts = [artisan.tel && `Tel : ${artisan.tel}`, artisan.assurance].filter(Boolean)
  const line3Parts = [artisan.rcs, artisan.ape].filter(Boolean)
  return (
    <div className="dv-page-foot-rich">
      {line1Parts.length > 0 && <div>{line1Parts.join(' — ')}</div>}
      {line2Parts.length > 0 && <div>{line2Parts.join(' — ')}</div>}
      {line3Parts.length > 0 && <div className="dv-pf-rcs">{line3Parts.join(' — ')}</div>}
    </div>
  )
}

// ── Styles inline des encadres (calques sur les blocs Options/NonRetenues) ──
const BOX_TITLE: CSSProperties = {
  color: '#0f1a3a', fontSize: '0.82rem', fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4,
}
const BOX_TEXT: CSSProperties = { color: '#3a4256', fontSize: '0.78rem', lineHeight: 1.5, margin: 0 }
const BOX_TEXT_MUTE: CSSProperties = { color: '#6b7384', fontSize: '0.74rem', lineHeight: 1.5, marginTop: 6 }
const BOX_PLAIN: CSSProperties = {
  margin: '12px 0 0', border: '1px solid #d8dce5', borderRadius: 10,
  background: '#f7f8fa', padding: '10px 14px',
}
const BOX_ACCENT: CSSProperties = {
  margin: '12px 0 0', border: '1.5px solid #e87a2a', borderRadius: 10,
  background: '#fff6ee', padding: '10px 14px',
}
