// ============================================================================
// components/document/DocumentRender.tsx
// ----------------------------------------------------------------------------
// V3.0b+c — Composant React partage qui rend un devis OU une facture au format
// "Edition Signature" (handoff du 01/06/2026).
//
// Consomme un objet DocumentData (cf. lib/document-data.ts) construit a partir
// des donnees Supabase. Garantie de parite stricte entre les 4 rendus.
//
// Usage :
//   import DocumentRender from '@/components/document/DocumentRender'
//   import { buildDevisDocument } from '@/lib/document-data'
//
//   const data = buildDevisDocument({ doc, lignes, client, entreprise, chantier })
//   <DocumentRender data={data} />
// ============================================================================

import { Fragment } from 'react'
import './document.css'
import type {
  DocumentArtisan,
  DocumentClient,
  DocumentData,
  DocumentGroup,
  DocumentMeta,
  DocumentTotals,
} from '@/lib/document-data'
import { eur, tauxLabel } from '@/lib/document-data'

// ============================================================================
// Composant principal
// ============================================================================

export default function DocumentRender({ data }: { data: DocumentData }) {
  const isDevis = data.docType === 'devis'
  return (
    <div className={`dv-doc dv-dir-D dv-density-compact dv-doctype-${data.docType}`}>
      {/* PAGE 1 — bandeau, cartes, objet, tableau */}
      <section className="dv-page">
        <HeaderD data={data} />
        <div className="dv-body">
          <Objet meta={data.meta} />
          <LinesTable groups={data.groups} />
        </div>
        <PageFoot artisan={data.artisan} meta={data.meta} docType={data.docType} pageNum={1} />
      </section>

      {/* PAGE 2 — recap, signature (devis), mentions */}
      <section className="dv-page">
        <PageHead2 artisan={data.artisan} meta={data.meta} docType={data.docType} />
        <div className="dv-body">
          {isDevis ? <RecapDevis data={data} /> : <RecapFacture data={data} />}
          {isDevis && <Signature artisan={data.artisan} />}
          {isDevis ? <LegalDevis data={data} /> : <LegalFacture data={data} />}
        </div>
        <PageFoot artisan={data.artisan} meta={data.meta} docType={data.docType} pageNum={2} />
      </section>
    </div>
  )
}

// ============================================================================
// Header — bandeau navy + logo + titre + numero + ligne meta + cartes
// ============================================================================

function HeaderD({ data }: { data: DocumentData }) {
  const { artisan, meta, docType } = data
  const titre = docType === 'devis' ? 'DEVIS' : 'FACTURE'

  return (
    <header className="dv-head dv-headD">
      <div className="dv-d-band">
        {/* Accents geometriques ambre */}
        <span className="dv-d-geo" aria-hidden="true" />
        <span className="dv-d-geo2" aria-hidden="true" />

        {/* Gauche : logo + nom + baseline */}
        <div className="dv-d-brand">
          <div className="dv-d-logomark">
            {artisan.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artisan.logoUrl} alt={`Logo ${artisan.nom}`} />
            ) : (
              <BoltIcon />
            )}
          </div>
          <div className="dv-d-brandtext">
            <span className="dv-d-name">{artisan.nom}</span>
            {artisan.baseline && <span className="dv-d-base">{artisan.baseline}</span>}
          </div>
        </div>

        {/* Droite : titre + n° + ligne meta */}
        <div className="dv-d-title">
          <div className="dv-d-doctype">{titre}</div>
          <div className="dv-d-num">{meta.numero}</div>
          <div className="dv-d-metaline">
            {meta.dateEmission && (
              <span>Émis le <strong>{meta.dateEmission}</strong></span>
            )}
            {meta.dateRight && (
              <span>{meta.dateRightLabel} <strong>{meta.dateRight}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Cartes flottantes (chevauchement -46px) */}
      <div className="dv-d-parties">
        <CardFrom artisan={artisan} />
        <CardTo client={data.client} />
      </div>
    </header>
  )
}

function CardFrom({ artisan }: { artisan: DocumentArtisan }) {
  return (
    <div className="dv-d-card dv-d-card--from">
      <span className="dv-d-chip">Émetteur</span>
      <span className="dv-d-cardname">{artisan.nom}</span>
      <div className="dv-d-cardrows">
        {artisan.adresseLine1 && <div>{artisan.adresseLine1}{artisan.adresseLine2 ? `, ${artisan.adresseLine2}` : ''}</div>}
        {!artisan.adresseLine1 && artisan.adresseLine2 && <div>{artisan.adresseLine2}</div>}
        {artisan.siret && <div>SIRET {artisan.siret}</div>}
        {artisan.tvaIntra && <div>TVA {artisan.tvaIntra}</div>}
        {(artisan.tel || artisan.email) && (
          <div>
            {artisan.tel}
            {artisan.tel && artisan.email && ' · '}
            {artisan.email}
          </div>
        )}
      </div>
    </div>
  )
}

function CardTo({ client }: { client: DocumentClient }) {
  return (
    <div className="dv-d-card dv-d-card--to">
      <span className="dv-d-chip dv-d-chip--accent">Adressé à</span>
      <span className="dv-d-cardname">{client.nom || '—'}</span>
      <div className="dv-d-cardrows">
        {client.adresseLine1 && <div>{client.adresseLine1}{client.adresseLine2 ? `, ${client.adresseLine2}` : ''}</div>}
        {!client.adresseLine1 && client.adresseLine2 && <div>{client.adresseLine2}</div>}
        {client.tel && <div>{client.tel}</div>}
        {client.email && <div>{client.email}</div>}
        {client.siret && <div>SIRET {client.siret}</div>}
      </div>
    </div>
  )
}

// ============================================================================
// Objet + adresse chantier (2 colonnes)
// ============================================================================

function Objet({ meta }: { meta: DocumentMeta }) {
  return (
    <div className="dv-objet">
      <div>
        <span className="dv-objet-k">Objet</span>
        {meta.objet || '—'}
      </div>
      <div>
        <span className="dv-objet-k">Adresse du chantier</span>
        {meta.chantierAdresse || '—'}
      </div>
    </div>
  )
}

// ============================================================================
// Tableau des lignes (hierarchie 3 niveaux)
// ============================================================================

function LinesTable({ groups }: { groups: DocumentGroup[] }) {
  return (
    <table className="dv-table">
      <thead>
        <tr>
          <th className="dv-c-num">#</th>
          <th className="dv-c-desg">Désignation</th>
          <th className="dv-c-qte">Qté</th>
          <th className="dv-c-pu">P.U. HT</th>
          <th className="dv-c-tva">TVA</th>
          <th className="dv-c-tot">Total HT</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g, gi) => (
          <GroupRows key={`g-${gi}`} group={g} />
        ))}
      </tbody>
    </table>
  )
}

function GroupRows({ group }: { group: DocumentGroup }) {
  // Si le groupe n'a pas de designation (mode liste plate), on n'affiche pas la ligne groupe
  const hasGroupLabel = Boolean(group.designation && group.designation.trim())

  return (
    <>
      {hasGroupLabel && (
        <tr className="dv-row dv-row--group">
          <td className="dv-c-num">{group.n}</td>
          <td className="dv-c-desg" colSpan={4}>{group.designation}</td>
          <td className="dv-c-tot">{eur(group.total)}</td>
        </tr>
      )}
      {group.subs.map((s, si) => {
        const hasSubLabel = Boolean(s.designation && s.designation.trim())
        return (
          <Fragment key={`s-${si}`}>
            {hasSubLabel && (
              <tr className="dv-row dv-row--sub">
                <td className="dv-c-num">{s.n}</td>
                <td className="dv-c-desg" colSpan={4}>{s.designation}</td>
                <td className="dv-c-tot">{eur(s.total)}</td>
              </tr>
            )}
            {s.items.map((it, ii) => (
              <tr key={`i-${ii}`} className="dv-row dv-row--item">
                <td className="dv-c-num">{it.n}</td>
                <td className="dv-c-desg">{it.designation}</td>
                <td className="dv-c-qte">
                  {Number(it.qte).toLocaleString('fr-FR')}
                  {it.unite && <span className="dv-unit"> {it.unite}</span>}
                </td>
                <td className="dv-c-pu">{eur(it.pu)}</td>
                <td className="dv-c-tva">{tauxLabel(it.tva)}</td>
                <td className="dv-c-tot">{eur(it.qte * it.pu)}</td>
              </tr>
            ))}
          </Fragment>
        )
      })}
    </>
  )
}

// ============================================================================
// Recapitulatif — colonne droite (totaux) partagee
// ============================================================================

function TotalsBox({ totals, docType, meta }: { totals: DocumentTotals; docType: 'devis' | 'facture'; meta: DocumentMeta }) {
  return (
    <div className="dv-recap-box">
      <div className="dv-recap-line">
        <span>Sous-total HT</span>
        <span>{eur(totals.sousTotalHt)}</span>
      </div>

      {totals.tvaLignes.length === 0 && (
        <div className="dv-recap-line dv-recap-line--mute">
          <span>TVA non applicable</span>
          <span>{eur(0)}</span>
        </div>
      )}

      {totals.tvaLignes.map(l => (
        <div className="dv-recap-line dv-recap-line--mute" key={`t-${l.taux}`}>
          <span>
            TVA {tauxLabel(l.taux)} <em>(base {eur(l.base)})</em>
          </span>
          <span>{eur(l.montant)}</span>
        </div>
      ))}

      <div className="dv-recap-line dv-recap-line--ttc">
        <span>Total TTC</span>
        <span>{eur(totals.totalTtc)}</span>
      </div>

      {docType === 'devis' && totals.acomptePct > 0 && (
        <div className="dv-recap-line dv-recap-line--mute">
          <span>Acompte ({totals.acomptePct} %)</span>
          <span>− {eur(totals.acompteMontant)}</span>
        </div>
      )}

      <div className="dv-recap-net">
        <span>{docType === 'devis' && totals.acomptePct > 0 ? 'Net à payer à la commande' : 'Net à payer'}</span>
        <strong>
          {eur(docType === 'devis' && totals.acomptePct > 0 ? totals.acompteMontant : totals.totalTtc)}
        </strong>
      </div>

      {docType === 'devis' && totals.acomptePct > 0 && (
        <div className="dv-recap-foot">
          Reste dû à la livraison : {eur(totals.resteDu)} · Total TTC : {eur(totals.totalTtc)}
        </div>
      )}
      {docType === 'facture' && meta.dateRight && (
        <div className="dv-recap-foot">Échéance de règlement : {meta.dateRight}</div>
      )}
    </div>
  )
}

// ============================================================================
// Recap DEVIS — colonne gauche : conditions de reglement + IBAN
// ============================================================================

function RecapDevis({ data }: { data: DocumentData }) {
  const { artisan, totals, meta } = data
  const hasAcompte = totals.acomptePct > 0
  const conditionsLibres = meta.conditionsPaiement?.trim()

  return (
    <div className="dv-recap">
      <div className="dv-recap-notes">
        <div className="dv-recap-notes-title">Conditions de règlement</div>

        {conditionsLibres ? (
          <p>{conditionsLibres}</p>
        ) : hasAcompte ? (
          <p>
            Acompte de <strong>{totals.acomptePct} %</strong> à la commande,
            soit <strong>{eur(totals.acompteMontant)}</strong>. Solde à la
            réception des travaux. Règlement par virement ou chèque sous 30 jours.
          </p>
        ) : (
          <p>Règlement à la réception des travaux, par virement ou chèque, sous 30 jours.</p>
        )}

        {(artisan.iban || artisan.bic) && (
          <p className="dv-recap-iban">
            {artisan.iban && <>IBAN {artisan.iban}</>}
            {artisan.iban && artisan.bic && ' · '}
            {artisan.bic && <>BIC {artisan.bic}</>}
          </p>
        )}
      </div>
      <TotalsBox totals={totals} docType="devis" meta={meta} />
    </div>
  )
}

// ============================================================================
// Recap FACTURE — colonne gauche : conditions + penalites + bloc virement
// ============================================================================

function RecapFacture({ data }: { data: DocumentData }) {
  const { artisan, totals, meta } = data
  const penalites = meta.penalitesCustom?.trim() ||
    "En cas de retard : pénalités au taux de 3× l'intérêt légal + indemnité forfaitaire de 40 € (art. L.441-10 C. com.). Pas d'escompte pour paiement anticipé."

  return (
    <div className="dv-recap">
      <div className="dv-recap-notes">
        <div className="dv-recap-notes-title">Conditions de paiement</div>
        <p>
          Méthodes acceptées : <strong>Virement bancaire, chèque</strong>.
          {meta.dateRight && <> Règlement attendu au plus tard le <strong>{meta.dateRight}</strong>.</>}
        </p>
        <p>{penalites}</p>

        {(artisan.iban || artisan.bic) && (
          <div className="dv-pay">
            <div className="dv-pay-k">Pour régler par virement</div>
            {artisan.iban && (
              <div className="dv-pay-row"><span>IBAN</span><strong>{artisan.iban}</strong></div>
            )}
            {artisan.bic && (
              <div className="dv-pay-row"><span>BIC</span><strong>{artisan.bic}</strong></div>
            )}
            <div className="dv-pay-row"><span>Bénéficiaire</span><strong>{artisan.nom}</strong></div>
          </div>
        )}
      </div>
      <TotalsBox totals={totals} docType="facture" meta={meta} />
    </div>
  )
}

// ============================================================================
// Signature (devis uniquement)
// ============================================================================

function Signature({ artisan }: { artisan: DocumentArtisan }) {
  return (
    <div className="dv-sign">
      <div className="dv-sign-box">
        <div className="dv-sign-label">Bon pour accord — Le client</div>
        <div className="dv-sign-hint">Date, mention « Bon pour accord » et signature</div>
      </div>
      <div className="dv-sign-box">
        <div className="dv-sign-label">{artisan.nom || 'L\'entreprise'}</div>
        <div className="dv-sign-hint">Signature & cachet de l'entreprise</div>
      </div>
    </div>
  )
}

// ============================================================================
// Mentions legales DEVIS
// ============================================================================

function LegalDevis({ data }: { data: DocumentData }) {
  const { artisan, meta } = data
  const mediation = data.artisan.mediateurAdresse
    ? data.artisan.mediateurAdresse
    : 'Médiateur de la consommation : mediation-conso.fr — recours gratuit.'

  return (
    <div className="dv-legal">
      <div className="dv-legal-grid">
        <div>
          <span className="dv-legal-k">Validité</span>
          {meta.dateRight
            ? <>Ce devis est valable jusqu&apos;au {meta.dateRight}. Au-delà, les prix sont susceptibles de révision.</>
            : <>Ce devis est valable 30 jours. Au-delà, les prix sont susceptibles de révision.</>
          }
        </div>
        <div>
          <span className="dv-legal-k">Exécution</span>
          Travaux réalisés dans les règles de l&apos;art. Délai indicatif à convenir après acceptation.
        </div>
        {artisan.assurance && (
          <div>
            <span className="dv-legal-k">Assurance</span>
            {artisan.assurance}
          </div>
        )}
        <div>
          <span className="dv-legal-k">Médiation</span>
          {mediation}
        </div>
      </div>
      <LegalFoot artisan={artisan} />
    </div>
  )
}

// ============================================================================
// Mentions legales FACTURE
// ============================================================================

function LegalFacture({ data }: { data: DocumentData }) {
  const { artisan } = data
  const mediation = artisan.mediateurAdresse
    ? artisan.mediateurAdresse
    : 'Médiateur de la consommation : mediation-conso.fr — recours gratuit.'

  // Detection TVA reduite (5,5% ou 10%) => attestation TVA logement
  const hasTvaReduite = data.totals.tvaLignes.some(l => l.taux === 5.5 || l.taux === 10)

  return (
    <div className="dv-legal">
      <div className="dv-legal-grid">
        {hasTvaReduite && (
          <div>
            <span className="dv-legal-k">Attestation TVA</span>
            Le client atteste que les travaux portent sur des locaux d&apos;habitation
            achevés depuis plus de 2 ans, ouvrant droit aux taux de TVA réduits.
          </div>
        )}
        <div>
          <span className="dv-legal-k">Cadre légal</span>
          Facture émise conformément aux articles L.441-3 et suivants du Code de commerce.
        </div>
        {artisan.assurance && (
          <div>
            <span className="dv-legal-k">Assurance décennale</span>
            {artisan.assurance}
          </div>
        )}
        <div>
          <span className="dv-legal-k">Médiation</span>
          {mediation}
        </div>
      </div>
      <LegalFoot artisan={artisan} />
    </div>
  )
}

function LegalFoot({ artisan }: { artisan: DocumentArtisan }) {
  return (
    <div className="dv-legal-foot">
      <span>{artisan.nom}</span>
      {artisan.siret && <span>SIRET {artisan.siret}</span>}
      {artisan.tvaIntra && <span>TVA {artisan.tvaIntra}</span>}
      {artisan.rcs && <span>{artisan.rcs}</span>}
      {artisan.ape && <span>{artisan.ape}</span>}
    </div>
  )
}

// ============================================================================
// Pied de page + bandeau page 2
// ============================================================================

function PageFoot({
  artisan,
  meta,
  docType,
  pageNum,
}: {
  artisan: DocumentArtisan
  meta: DocumentMeta
  docType: 'devis' | 'facture'
  pageNum: number
}) {
  const label = docType === 'devis' ? 'Devis' : 'Facture'
  return (
    <div className="dv-page-foot">
      <span>{artisan.nom} · {label} {meta.numero}</span>
      <span>Page {pageNum} / 2</span>
    </div>
  )
}

function PageHead2({
  artisan,
  meta,
  docType,
}: {
  artisan: DocumentArtisan
  meta: DocumentMeta
  docType: 'devis' | 'facture'
}) {
  const label = docType === 'devis' ? 'Devis' : 'Facture'
  return (
    <div className="dv-page-head2">
      <span className="dv-ph2-brand">{artisan.nom}</span>
      <span className="dv-ph2-meta">
        {label} {meta.numero}
        {meta.dateEmission && ` · ${meta.dateEmission}`}
      </span>
    </div>
  )
}

// ============================================================================
// Placeholder logo (eclair ambre) — utilise si artisan.logoUrl est vide
// ============================================================================

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" />
    </svg>
  )
}
