// V3.0c.4 — DocumentRender : parite dashboard <-> PDF (7 fixes : metaline empile, adresse 2 lignes, formatPhone, objet sans chantier)
// V3.0d — Theme custom optionnel : prop `theme` injectee en CSS variables sur la racine .dv-doc.
//         Quand omise, on applique DEFAULT_DOCUMENT_THEME (charte Nexartis historique) -> rendu identique a avant.
import { Fragment, type CSSProperties } from 'react'
import './document.css'
import type { DocumentArtisan, DocumentClient, DocumentData, DocumentGroup, DocumentLeaf, DocumentMeta, DocumentTotals } from '@/lib/document-data'
import { eur, tauxLabel } from '@/lib/document-data'
import { DEFAULT_DOCUMENT_THEME, themeToCssVars, type DocumentTheme } from '@/lib/document-theme'
import { DEFAULT_LOGO_CONFIG, logoConfigToCssVars, type LogoConfig } from '@/lib/logo-config'

function formatPhone(raw?: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (/[\s.\-]/.test(trimmed)) return trimmed
  if (/^0\d{9}$/.test(trimmed)) {
    return trimmed.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  }
  return trimmed
}

export default function DocumentRender({ data, theme, logoConfig }: { data: DocumentData; theme?: DocumentTheme; logoConfig?: LogoConfig }) {
  const isDevis = data.docType === 'devis'
  const themeStyle = themeToCssVars(theme ?? DEFAULT_DOCUMENT_THEME)
  const logoStyle = logoConfigToCssVars(logoConfig ?? DEFAULT_LOGO_CONFIG)
  const mergedStyle = { ...themeStyle, ...logoStyle }
  return (
    <div className={`dv-doc dv-dir-D dv-density-compact dv-doctype-${data.docType}`} style={mergedStyle}>
      <section className="dv-page">
        <HeaderD data={data} />
        <div className="dv-body">
          <Objet meta={data.meta} />
          {data.meta.situation && <SituationBanner situation={data.meta.situation} totalHt={data.totals.sousTotalHt} totalTtc={data.totals.totalTtc} />}
          <LinesTable groups={data.groups} />
          {isDevis ? <RecapDevis data={data} /> : <RecapFacture data={data} />}
          {isDevis && data.options && data.options.length > 0 && <OptionsBlock items={data.options} totals={data.optionsTotals} />}
          {/* 2026-06-10 — Mention autoliquidation BTP en pied de doc (art. 283-2 nonies CGI) */}
          {data.meta.autoliquidationBtp && <AutoliquidationMention />}
          {isDevis ? <LegalDevis data={data} /> : <LegalFacture data={data} />}
          {isDevis && <Signature artisan={data.artisan} />}
        </div>
        <PageFootRich artisan={data.artisan} />
      </section>
    </div>
  )
}

function HeaderD({ data }: { data: DocumentData }) {
  const { artisan, meta, docType } = data
  // V3.0c.18 — Titre adaptatif :
  //   - DEVIS pour les devis
  //   - FACTURE DE SITUATION pour les factures avec meta.situation
  //   - FACTURE pour les factures standard
  const isAvoir = docType === 'facture' && Boolean(meta.avoir)
  const isSituation = docType === 'facture' && Boolean(meta.situation)
  const titre = docType === 'devis'
    ? 'DEVIS'
    : isAvoir
      ? 'AVOIR'
      : isSituation
        ? 'FACTURE DE SITUATION'
        : 'FACTURE'
  // Sous-titre situation : affiché sous le numéro en petit (parité avec le PDF)
  const situationSubtitle = isSituation && meta.situation
    ? `Situation N°${meta.situation.numero} · ${meta.situation.pourcentage}% d'avancement`
    : null
  // V-AVOIR : reference de la facture d'origine (sous le numero).
  const avoirSubtitle = isAvoir && meta.avoir?.factureOrigineNumero
    ? `Sur facture n° ${meta.avoir.factureOrigineNumero}${meta.avoir.factureOrigineDate ? ` du ${meta.avoir.factureOrigineDate}` : ''}`
    : null
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
            {/* V3.1.2 : metier retire du bandeau a la demande (apparait dans la carte EMETTEUR plus bas) */}
          </div>
        </div>
        <div className="dv-d-title">
          <div className="dv-d-doctype">{titre}</div>
          <div className="dv-d-num">{meta.numero}</div>
          {situationSubtitle && (
            <div className="dv-d-metaline" style={{ marginTop: 4 }}>
              <div><strong>{situationSubtitle}</strong></div>
            </div>
          )}
          {avoirSubtitle && (
            <div className="dv-d-metaline" style={{ marginTop: 4 }}>
              <div><strong>{avoirSubtitle}</strong></div>
            </div>
          )}
          <div className="dv-d-metaline">
            {meta.dateEmission && (<div>Émis le <strong>{meta.dateEmission}</strong></div>)}
            {/* V-AVOIR : pas d'echeance de reglement sur un avoir. */}
            {!isAvoir && meta.dateRight && (<div>{meta.dateRightLabel} <strong>{meta.dateRight}</strong></div>)}
          </div>
        </div>
      </div>
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
        {artisan.adresseLine1 && <div>{artisan.adresseLine1}</div>}
        {artisan.adresseLine2 && <div>{artisan.adresseLine2}</div>}
        {artisan.tel && <div>{formatPhone(artisan.tel)}</div>}
        {artisan.email && <div>{artisan.email}</div>}
        {artisan.siret && <div>SIRET {artisan.siret}</div>}
        {artisan.tvaIntra && <div>TVA {artisan.tvaIntra}</div>}
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
        {client.adresseLine1 && <div>{client.adresseLine1}</div>}
        {client.adresseLine2 && <div>{client.adresseLine2}</div>}
        {client.tel && <div>{formatPhone(client.tel)}</div>}
        {client.email && <div>{client.email}</div>}
        {client.siret && <div>{(client.siret.replace(/\D/g, '').length === 9 ? 'SIREN' : 'SIRET')} {client.siret}</div>}
      </div>
    </div>
  )
}

function Objet({ meta }: { meta: DocumentMeta }) {
  return (
    <div className="dv-objet">
      <div><span className="dv-objet-k">Objet</span><span className="dv-objet-v">{meta.objet || '—'}</span></div>
    </div>
  )
}

// V3.0c.18 — Bandeau récapitulatif d'avancement (factures de situation)
// Affiche : descriptif (Situation N°X · Y% · Devis Ref du …)
//         + grille 3 cellules (Cumul précédent | Cette situation | Reste à facturer).
// Reste à facturer omis si non transmis (NULL en base = pas de devis lié, calcul impossible).
function SituationBanner({
  situation,
  totalHt,
  totalTtc,
}: {
  situation: NonNullable<DocumentMeta['situation']>
  totalHt: number
  totalTtc: number
}) {
  const refSuffix = situation.devisRef
    ? ` · Devis ${situation.devisRef}${situation.devisDate ? ` du ${situation.devisDate}` : ''}`
    : ''
  const headerLabel = `Situation N°${situation.numero} · ${situation.pourcentage}% d'avancement${refSuffix}`
  const cells: Array<{ label: string; ht?: number; ttc?: number }> = [
    { label: 'Cumul précédent', ht: situation.montantPrecedentHt, ttc: situation.montantPrecedentTtc },
    { label: 'Cette situation', ht: totalHt, ttc: totalTtc },
  ]
  const hasReste = situation.resteAFacturerHt !== undefined || situation.resteAFacturerTtc !== undefined
  if (hasReste) cells.push({ label: 'Reste à facturer', ht: situation.resteAFacturerHt, ttc: situation.resteAFacturerTtc })

  return (
    <div className="dv-situation">
      <div className="dv-situation-head">
        <span className="dv-situation-k">Avancement des travaux</span>
        <span className="dv-situation-v">{headerLabel}</span>
      </div>
      <div className="dv-situation-grid" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map((c) => (
          <div key={c.label} className="dv-situation-cell">
            <span className="dv-situation-cell-k">{c.label}</span>
            <strong className="dv-situation-cell-ht">{c.ht !== undefined ? eur(c.ht) : '—'} HT</strong>
            {c.ttc !== undefined && <span className="dv-situation-cell-ttc">{eur(c.ttc)} TTC</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function LinesTable({ groups }: { groups: DocumentGroup[] }) {
  return (
    <table className="dv-table">
      <thead>
        <tr>
          <th className="dv-c-num">#</th><th className="dv-c-desg">Désignation</th>
          <th className="dv-c-qte">Qté</th><th className="dv-c-pu">P.U. HT</th>
          <th className="dv-c-tva">TVA</th><th className="dv-c-tot">Total HT</th>
        </tr>
      </thead>
      <tbody>{groups.map((g, gi) => (<GroupRows key={`g-${gi}`} group={g} />))}</tbody>
    </table>
  )
}

function GroupRows({ group }: { group: DocumentGroup }) {
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
                <td className="dv-c-desg">{it.designation}{it.statut === 'facultatif' && <span style={PILL_FAC}>Facultatif</span>}</td>
                <td className="dv-c-qte">{Number(it.qte).toLocaleString('fr-FR')}{it.unite && <span className="dv-unit"> {it.unite}</span>}</td>
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

// Pastilles de statut (inline pour ne pas dépendre de la feuille document.css)
const PILL_BASE: CSSProperties = {
  display: 'inline-block', marginLeft: 6, padding: '1px 7px', borderRadius: 999,
  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase',
  verticalAlign: 'middle', lineHeight: 1.5,
}
const PILL_FAC: CSSProperties = { ...PILL_BASE, background: '#fdecda', color: '#e87a2a' }
const PILL_OPT: CSSProperties = { ...PILL_BASE, background: '#e7f0fa', color: '#2f6fb0' }

// Bloc "Options +" : postes proposés en plus, NON comptés dans le total principal.
function OptionsBlock({ items, totals }: { items: DocumentLeaf[]; totals?: { ht: number; ttc: number } }) {
  return (
    <div style={{ margin: '14px 0 4px', border: '1.5px dashed #2f6fb0', borderRadius: 10, overflow: 'hidden', background: '#f6fafe' }}>
      <div style={{ padding: '9px 14px', background: '#e7f0fa', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...PILL_OPT, marginLeft: 0 }}>Option +</span>
        <strong style={{ color: '#0f1a3a', fontSize: '0.9rem' }}>Options proposées</strong>
        <span style={{ color: '#6b7384', fontSize: '0.75rem' }}>— non comprises dans le total ci-dessus, à ajouter si vous le souhaitez</span>
      </div>
      <table className="dv-table" style={{ margin: 0 }}>
        <thead>
          <tr>
            <th className="dv-c-num">#</th><th className="dv-c-desg">Désignation</th>
            <th className="dv-c-qte">Qté</th><th className="dv-c-pu">P.U. HT</th>
            <th className="dv-c-tva">TVA</th><th className="dv-c-tot">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, ii) => (
            <tr key={`opt-${ii}`} className="dv-row dv-row--item">
              <td className="dv-c-num">{it.n}</td>
              <td className="dv-c-desg">{it.designation}</td>
              <td className="dv-c-qte">{Number(it.qte).toLocaleString('fr-FR')}{it.unite && <span className="dv-unit"> {it.unite}</span>}</td>
              <td className="dv-c-pu">{eur(it.pu)}</td>
              <td className="dv-c-tva">{tauxLabel(it.tva)}</td>
              <td className="dv-c-tot">{eur(it.qte * it.pu)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totals && (
        <div style={{ padding: '9px 14px', background: '#e7f0fa', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#0f1a3a', fontSize: '0.85rem' }}>
          <span>Total des options (si toutes ajoutées)</span>
          <span>+ {eur(totals.ttc)} TTC</span>
        </div>
      )}
    </div>
  )
}

function TotalsBox({ totals, docType, meta }: { totals: DocumentTotals; docType: 'devis' | 'facture'; meta: DocumentMeta }) {
  const hasAcompte = docType === 'devis' && totals.acomptePct > 0
  // V-AVOIR : libelle "Net a crediter" (et pas "Net a payer") + pas d'echeance.
  const isAvoir = docType === 'facture' && Boolean(meta.avoir)
  const netLabel = isAvoir ? 'Net à créditer' : 'Net à payer'
  // 2026-06-10 — Autoliquidation BTP : libelle TVA dedie (au lieu du generique
  // "TVA non applicable" qui evoque la franchise 293 B).
  const tvaLabel = meta.autoliquidationBtp
    ? 'TVA — Autoliquidation (preneur)'
    : 'TVA non applicable'
  return (
    <div className="dv-recap-box">
      <div className="dv-recap-line"><span>Sous-total HT</span><span>{eur(totals.sousTotalHt)}</span></div>
      {totals.tvaLignes.length === 0 && (<div className="dv-recap-line dv-recap-line--mute"><span>{tvaLabel}</span><span>{eur(0)}</span></div>)}
      {totals.tvaLignes.map(l => (
        <div className="dv-recap-line dv-recap-line--mute" key={`t-${l.taux}`}>
          <span>TVA {tauxLabel(l.taux)} <em>(base {eur(l.base)})</em></span><span>{eur(l.montant)}</span>
        </div>
      ))}
      <div className="dv-recap-line dv-recap-line--ttc"><span>Total TTC</span><span>{eur(totals.totalTtc)}</span></div>
      {/* V2 imputation — deductions de REGLEMENT (ex. avoir d'un autre dossier
          impute en paiement). Le Total TTC ci-dessus reste PLEIN (CA + TVA justes) ;
          la deduction n'apparait qu'avant le Net a payer. Jamais sur un avoir. */}
      {!isAvoir && totals.deductions && totals.deductions.map((d, i) => (
        <div className="dv-recap-line dv-recap-line--mute" key={`ded-${i}`}>
          <span>{d.label}</span><span>− {eur(d.montant)}</span>
        </div>
      ))}
      {/* V3.0b.6 — Net a payer = Total TTC (engagement du devis, pas l'acompte),
          ou net apres deductions (imputation d'avoir) si present. */}
      <div className="dv-recap-net">
        <span>{netLabel}</span>
        <strong>{eur(!isAvoir && totals.netAPayer != null ? totals.netAPayer : totals.totalTtc)}</strong>
      </div>
      {/* V3.0b.6 — Mini-bloc : a verser maintenant + reste a la livraison */}
      {hasAcompte && (
        <div className="dv-recap-foot">
          <div className="dv-recap-foot-line"><span>À verser à la commande ({totals.acomptePct} %)</span><strong>{eur(totals.acompteMontant)}</strong></div>
          <div className="dv-recap-foot-line"><span>Reste dû à la livraison</span><strong>{eur(totals.resteDu)}</strong></div>
        </div>
      )}
      {docType === 'facture' && !isAvoir && meta.dateRight && (
        <div className="dv-recap-foot">
          <div className="dv-recap-foot-line"><span>Échéance de règlement</span><strong>{meta.dateRight}</strong></div>
        </div>
      )}
    </div>
  )
}

function RecapDevis({ data }: { data: DocumentData }) {
  const { totals, meta } = data
  const hasAcompte = totals.acomptePct > 0
  const conditionsLibres = meta.conditionsPaiement?.trim()
  const hasTvaReduite = totals.tvaLignes.some(l => l.taux === 5.5 || l.taux === 10)
  return (
    <div className="dv-recap">
      <div className="dv-recap-notes">
        <div className="dv-recap-notes-title">Conditions de paiement</div>
        {conditionsLibres ? (<p>{conditionsLibres}</p>) : hasAcompte ? (
          <p>Acompte de <strong>{totals.acomptePct} %</strong> à la commande, soit <strong>{eur(totals.acompteMontant)}</strong>. Solde à la réception des travaux. Règlement par virement ou chèque sous 30 jours.</p>
        ) : (<p>Règlement à la réception des travaux, par virement ou chèque, sous 30 jours.</p>)}
        {hasTvaReduite && (
          <div className="dv-attest-tva">
            <p>Je certifie, en qualité de preneur de la prestation, que les travaux réalisés concernent des locaux à usage d&apos;habitation achevés depuis plus de deux ans, qu&apos;ils n&apos;ont pas eu pour effet, sur une période de deux ans au plus, de concourir à la production d&apos;un immeuble neuf au sens du 2° du 2 du I de l&apos;article 257 du CGI, ni d&apos;entraîner une augmentation de la surface de plancher des locaux existants supérieure à 10 %, et, le cas échéant, qu&apos;ils ont la nature de travaux de rénovation.</p>
            {totals.tvaLignes.some(l => l.taux === 5.5) && (
              <p>Je certifie que les travaux réalisés concernent des locaux à usage d&apos;habitation achevés depuis plus de deux ans et constituent des travaux de rénovation ou d&apos;amélioration de la qualité énergétique au sens de l&apos;article 18 bis de l&apos;annexe IV du CGI.</p>
            )}
          </div>
        )}
        {meta.dechets && (
          <div className="dv-dechets">
            <div className="dv-dechets-k">Gestion des déchets (AGEC)</div>
            <div className="dv-dechets-text">
              {[
                meta.dechets.nature && `Nature : ${meta.dechets.nature}`,
                meta.dechets.responsable,
                meta.dechets.tri && `Tri : ${meta.dechets.tri}`,
                meta.dechets.collecteNom && `Collecte : ${meta.dechets.collecteNom}${meta.dechets.collecteType ? ` (${meta.dechets.collecteType})` : ''}`,
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
        )}
      </div>
      <TotalsBox totals={totals} docType="devis" meta={meta} />
    </div>
  )
}

function RecapFacture({ data }: { data: DocumentData }) {
  const { artisan, totals, meta } = data
  // V-AVOIR : un avoir n'a ni penalites de retard, ni echeance de reglement,
  // ni escompte. On affiche un libelle remboursement a la place.
  const isAvoir = Boolean(meta.avoir)
  const penalites = meta.penalitesCustom?.trim() || "En cas de retard : pénalités au taux de 3× l'intérêt légal + indemnité forfaitaire de 40 € (art. L.441-10 C. com.). Pas d'escompte pour paiement anticipé."
  return (
    <div className="dv-recap">
      <div className="dv-recap-notes">
        <div className="dv-recap-notes-title">{isAvoir ? 'Avoir' : 'Conditions de paiement'}</div>
        {isAvoir ? (
          <p>Cet avoir vient en déduction des sommes dues. Si la facture d&apos;origine a déjà été réglée, le montant est à rembourser au client.</p>
        ) : (
          <>
            <p>Méthodes acceptées : <strong>Virement bancaire, chèque</strong>.{meta.dateRight && <> Règlement attendu au plus tard le <strong>{meta.dateRight}</strong>.</>}</p>
            <p>{penalites}</p>
          </>
        )}
        {!isAvoir && (artisan.iban || artisan.bic) && (
          <div className="dv-pay">
            <div className="dv-pay-k">Pour régler par virement</div>
            {artisan.iban && (<div className="dv-pay-row"><span>IBAN</span><strong>{artisan.iban}</strong></div>)}
            {artisan.bic && (<div className="dv-pay-row"><span>BIC</span><strong>{artisan.bic}</strong></div>)}
            <div className="dv-pay-row"><span>Bénéficiaire</span><strong>{artisan.nom}</strong></div>
          </div>
        )}
      </div>
      <TotalsBox totals={totals} docType="facture" meta={meta} />
    </div>
  )
}

function Signature({ artisan }: { artisan: DocumentArtisan }) {
  const imgSrc = artisan.signatureBase64 || artisan.tamponBase64
  const imgAlt = artisan.signatureBase64 ? 'Signature' : 'Tampon'
  return (
    <div className="dv-sign">
      <div className="dv-sign-box">
        <div className="dv-sign-label">Bon pour accord — Le client</div>
        <div className="dv-sign-hint">Date, mention « Bon pour accord » et signature</div>
      </div>
      <div className="dv-sign-box">
        <div className="dv-sign-label">{artisan.nom || "L'entreprise"}</div>
        {imgSrc ? (
          <div className="dv-sign-img-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc} alt={imgAlt} className="dv-sign-img" />
          </div>
        ) : (<div className="dv-sign-hint">Signature &amp; cachet de l&apos;entreprise</div>)}
      </div>
    </div>
  )
}

function LegalDevis({ data }: { data: DocumentData }) {
  const { artisan, clientType } = data
  const mediation = artisan.mediateurAdresse || 'Médiateur de la consommation : mediation-conso.fr — recours gratuit.'
  const statutJuridique = [artisan.formeJuridique, artisan.rcs].filter(Boolean).join(' · ')
  return (
    <div className="dv-legal">
      <div className="dv-legal-grid">
        {artisan.assurance && (<div><span className="dv-legal-k">Assurance décennale</span>{artisan.assurance}</div>)}
        {statutJuridique && (
          <div><span className="dv-legal-k">Statut juridique</span>{artisan.nom}{artisan.formeJuridique ? ` — ${artisan.formeJuridique}` : ''}{artisan.rcs && <><br />{artisan.rcs}</>}</div>
        )}
        <div><span className="dv-legal-k">Médiateur</span>{mediation}</div>
        {clientType === 'particulier' && (<div><span className="dv-legal-k">Rétractation</span>Rétractation 14 jours pour travaux hors établissement (art. L221-18 C. conso.).</div>)}
      </div>
    </div>
  )
}

function LegalFacture({ data }: { data: DocumentData }) {
  const { artisan, clientType } = data
  // V-AVOIR : pas de penalites de retard sur un avoir (ce n'est pas une creance).
  const isAvoir = Boolean(data.meta.avoir)
  const mediation = artisan.mediateurAdresse || 'Médiateur de la consommation : mediation-conso.fr — recours gratuit.'
  const hasTvaReduite = data.totals.tvaLignes.some(l => l.taux === 5.5 || l.taux === 10)
  const statutJuridique = [artisan.formeJuridique, artisan.rcs].filter(Boolean).join(' · ')
  return (
    <div className="dv-legal">
      <div className="dv-legal-grid">
        {hasTvaReduite && (<div><span className="dv-legal-k">Attestation TVA</span>Le client atteste que les travaux portent sur des locaux d&apos;habitation achevés depuis plus de 2 ans, ouvrant droit aux taux de TVA réduits.</div>)}
        <div><span className="dv-legal-k">Cadre légal</span>Facture émise conformément aux articles L.441-3 et suivants du Code de commerce.</div>
        {artisan.assurance && (<div><span className="dv-legal-k">Assurance décennale</span>{artisan.assurance}</div>)}
        {statutJuridique && (
          <div><span className="dv-legal-k">Statut juridique</span>{artisan.nom}{artisan.formeJuridique ? ` — ${artisan.formeJuridique}` : ''}{artisan.rcs && <><br />{artisan.rcs}</>}</div>
        )}
        <div><span className="dv-legal-k">Médiation</span>{mediation}</div>
        {clientType === 'particulier' && !isAvoir && (<div><span className="dv-legal-k">Pénalités</span>En cas de retard : pénalités au taux de 3× l&apos;intérêt légal. Pas d&apos;escompte pour paiement anticipé.</div>)}
      </div>
    </div>
  )
}

// 2026-06-10 — Mention obligatoire d'autoliquidation TVA en sous-traitance BTP.
// Affichee uniquement quand meta.autoliquidationBtp === true. Bandeau navy
// discret aligne sur le style du recap (border + padding compact).
function AutoliquidationMention() {
  return (
    <div className="dv-autoliq">
      <span className="dv-autoliq-k">Autoliquidation TVA</span>
      <span className="dv-autoliq-v">
        TVA due par le preneur — art. 283-2 nonies du CGI (sous-traitance BTP). Aucune TVA n&apos;est facturee par le sous-traitant.
      </span>
    </div>
  )
}

// V3.0b.5 — Footer riche SANS pagination (la pagination reviendra avec le PDF)
function PageFootRich({ artisan }: { artisan: DocumentArtisan }) {
  const line1Parts = [
    artisan.nom,
    [artisan.adresseLine1, artisan.adresseLine2].filter(Boolean).join(', '),
    artisan.siret && `SIRET : ${artisan.siret}`,
    artisan.email && `Email : ${artisan.email}`,
  ].filter(Boolean)
  const line2Parts = [artisan.tel && `Tél : ${artisan.tel}`, artisan.assurance].filter(Boolean)
  const line3Parts = [artisan.rcs, artisan.ape].filter(Boolean)
  return (
    <div className="dv-page-foot-rich">
      {line1Parts.length > 0 && <div>{line1Parts.join(' — ')}</div>}
      {line2Parts.length > 0 && <div>{line2Parts.join(' — ')}</div>}
      {line3Parts.length > 0 && <div className="dv-pf-rcs">{line3Parts.join(' — ')}</div>}
    </div>
  )
}
