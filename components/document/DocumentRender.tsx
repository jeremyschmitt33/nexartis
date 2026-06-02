// V3.0b.3 — DocumentRender (footer 4 lignes, pagination isolee)
import { Fragment } from 'react'
import './document.css'
import type { DocumentArtisan, DocumentClient, DocumentData, DocumentGroup, DocumentMeta, DocumentTotals } from '@/lib/document-data'
import { eur, tauxLabel } from '@/lib/document-data'

export default function DocumentRender({ data }: { data: DocumentData }) {
  const isDevis = data.docType === 'devis'
  const hasPage2 = isDevis
  return (
    <div className={`dv-doc dv-dir-D dv-density-compact dv-doctype-${data.docType}`}>
      <section className="dv-page">
        <HeaderD data={data} />
        <div className="dv-body">
          <Objet meta={data.meta} />
          <LinesTable groups={data.groups} />
          {isDevis ? <RecapDevis data={data} /> : <RecapFacture data={data} />}
          {isDevis ? <LegalDevis data={data} /> : <LegalFacture data={data} />}
        </div>
        <PageFootRich artisan={data.artisan} meta={data.meta} docType={data.docType} pageNum={1} totalPages={hasPage2 ? 2 : 1} />
      </section>
      {hasPage2 && (
        <section className="dv-page">
          <PageHead2 artisan={data.artisan} meta={data.meta} docType={data.docType} />
          <div className="dv-body"><Signature artisan={data.artisan} /></div>
          <PageFootSimple meta={data.meta} docType={data.docType} pageNum={2} totalPages={2} />
        </section>
      )}
    </div>
  )
}

function HeaderD({ data }: { data: DocumentData }) {
  const { artisan, meta, docType } = data
  const titre = docType === 'devis' ? 'DEVIS' : 'FACTURE'
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
            {artisan.baseline && <span className="dv-d-base">{artisan.baseline}</span>}
          </div>
        </div>
        <div className="dv-d-title">
          <div className="dv-d-doctype">{titre}</div>
          <div className="dv-d-num">{meta.numero}</div>
          <div className="dv-d-metaline">
            {meta.dateEmission && (<span>Émis le <strong>{meta.dateEmission}</strong></span>)}
            {meta.dateRight && (<span>{meta.dateRightLabel} <strong>{meta.dateRight}</strong></span>)}
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
        {artisan.adresseLine1 && <div>{artisan.adresseLine1}{artisan.adresseLine2 ? `, ${artisan.adresseLine2}` : ''}</div>}
        {!artisan.adresseLine1 && artisan.adresseLine2 && <div>{artisan.adresseLine2}</div>}
        {artisan.siret && <div>SIRET {artisan.siret}</div>}
        {artisan.tvaIntra && <div>TVA {artisan.tvaIntra}</div>}
        {(artisan.tel || artisan.email) && (<div>{artisan.tel}{artisan.tel && artisan.email && ' · '}{artisan.email}</div>)}
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

function Objet({ meta }: { meta: DocumentMeta }) {
  return (
    <div className="dv-objet">
      <div><span className="dv-objet-k">Objet</span>{meta.objet || '—'}</div>
      <div><span className="dv-objet-k">Adresse du chantier</span>{meta.chantierAdresse || '—'}</div>
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
                <td className="dv-c-desg">{it.designation}</td>
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

function TotalsBox({ totals, docType, meta }: { totals: DocumentTotals; docType: 'devis' | 'facture'; meta: DocumentMeta }) {
  return (
    <div className="dv-recap-box">
      <div className="dv-recap-line"><span>Sous-total HT</span><span>{eur(totals.sousTotalHt)}</span></div>
      {totals.tvaLignes.length === 0 && (<div className="dv-recap-line dv-recap-line--mute"><span>TVA non applicable</span><span>{eur(0)}</span></div>)}
      {totals.tvaLignes.map(l => (
        <div className="dv-recap-line dv-recap-line--mute" key={`t-${l.taux}`}>
          <span>TVA {tauxLabel(l.taux)} <em>(base {eur(l.base)})</em></span><span>{eur(l.montant)}</span>
        </div>
      ))}
      <div className="dv-recap-line dv-recap-line--ttc"><span>Total TTC</span><span>{eur(totals.totalTtc)}</span></div>
      {docType === 'devis' && totals.acomptePct > 0 && (
        <div className="dv-recap-line dv-recap-line--mute"><span>Acompte ({totals.acomptePct} %)</span><span>− {eur(totals.acompteMontant)}</span></div>
      )}
      <div className="dv-recap-net">
        <span>{docType === 'devis' && totals.acomptePct > 0 ? 'Net à payer à la commande' : 'Net à payer'}</span>
        <strong>{eur(docType === 'devis' && totals.acomptePct > 0 ? totals.acompteMontant : totals.totalTtc)}</strong>
      </div>
      {docType === 'devis' && totals.acomptePct > 0 && (
        <div className="dv-recap-foot">Reste dû à la livraison : {eur(totals.resteDu)} · Total TTC : {eur(totals.totalTtc)}</div>
      )}
      {docType === 'facture' && meta.dateRight && (<div className="dv-recap-foot">Échéance de règlement : {meta.dateRight}</div>)}
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
  const penalites = meta.penalitesCustom?.trim() || "En cas de retard : pénalités au taux de 3× l'intérêt légal + indemnité forfaitaire de 40 € (art. L.441-10 C. com.). Pas d'escompte pour paiement anticipé."
  return (
    <div className="dv-recap">
      <div className="dv-recap-notes">
        <div className="dv-recap-notes-title">Conditions de paiement</div>
        <p>Méthodes acceptées : <strong>Virement bancaire, chèque</strong>.{meta.dateRight && <> Règlement attendu au plus tard le <strong>{meta.dateRight}</strong>.</>}</p>
        <p>{penalites}</p>
        {(artisan.iban || artisan.bic) && (
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
        {clientType === 'particulier' && (<div><span className="dv-legal-k">Pénalités</span>En cas de retard : pénalités au taux de 3× l&apos;intérêt légal. Pas d&apos;escompte pour paiement anticipé.</div>)}
      </div>
    </div>
  )
}

function PageFootRich({ artisan, meta, docType, pageNum, totalPages }: { artisan: DocumentArtisan; meta: DocumentMeta; docType: 'devis' | 'facture'; pageNum: number; totalPages: number }) {
  const label = docType === 'devis' ? 'Devis' : 'Facture'
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
      <div className="dv-pf-pagenum">
        <span>{label} N° {meta.numero}</span>
        <span>Page {pageNum} sur {totalPages}</span>
      </div>
    </div>
  )
}

function PageFootSimple({ meta, docType, pageNum, totalPages }: { meta: DocumentMeta; docType: 'devis' | 'facture'; pageNum: number; totalPages: number }) {
  const label = docType === 'devis' ? 'Devis' : 'Facture'
  return (
    <div className="dv-page-foot-simple">
      <span>{label} N° {meta.numero}</span>
      <span className="dv-pf-pagenum">Page {pageNum} sur {totalPages}</span>
    </div>
  )
}

function PageHead2({ artisan, meta, docType }: { artisan: DocumentArtisan; meta: DocumentMeta; docType: 'devis' | 'facture' }) {
  const label = docType === 'devis' ? 'Devis' : 'Facture'
  return (
    <div className="dv-page-head2">
      <span className="dv-ph2-brand">{artisan.nom}</span>
      <span className="dv-ph2-meta">{label} {meta.numero}{meta.dateEmission && ` · ${meta.dateEmission}`}</span>
    </div>
  )
}
