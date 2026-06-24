'use client'

// ---------------------------------------------------------------------------
// Calculatrices UNIVERSELLES (tous metiers) : TVA travaux + Taux horaire.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { NumberInput, ChoiceSelect, ResultRow, ResultBox, Highlight, Disclaimer, fmt } from './ui'

// ===========================================================================
// 1) TVA TRAVAUX — determine le taux (5,5 / 10 / 20 %) puis convertit HT <-> TTC
// ===========================================================================
export function CalcTva() {
  const [age, setAge] = useState('ancien') // ancien (>2 ans) | neuf (<2 ans / construction)
  const [nature, setNature] = useState('energetique') // energetique | renovation | neuf
  const [montantHt, setMontantHt] = useState(1000)

  const taux = useMemo(() => {
    if (age === 'neuf') return 20
    if (nature === 'energetique') return 5.5
    if (nature === 'renovation') return 10
    return 20
  }, [age, nature])

  const explication = useMemo(() => {
    if (taux === 5.5)
      return "Travaux de renovation energetique dans un logement de plus de 2 ans (isolation, chauffage performant...)."
    if (taux === 10)
      return "Travaux d'amelioration, transformation ou entretien dans un logement de plus de 2 ans."
    return "Construction neuve, agrandissement, logement de moins de 2 ans, ou travaux hors taux reduits."
  }, [taux])

  const tva = montantHt * (taux / 100)
  const ttc = montantHt + tva

  return (
    <div className="space-y-3">
      <ChoiceSelect
        label="Age du logement"
        value={age}
        onChange={setAge}
        options={[
          { value: 'ancien', label: 'Plus de 2 ans' },
          { value: 'neuf', label: 'Moins de 2 ans / construction neuve' },
        ]}
      />
      {age === 'ancien' && (
        <ChoiceSelect
          label="Nature des travaux"
          value={nature}
          onChange={setNature}
          options={[
            { value: 'energetique', label: 'Renovation energetique' },
            { value: 'renovation', label: 'Amelioration / entretien / transformation' },
            { value: 'neuf', label: 'Agrandissement / surelevation' },
          ]}
        />
      )}
      <NumberInput label="Montant HT" value={montantHt} onChange={setMontantHt} unit="EUR" step={50} />

      <ResultBox>
        <Highlight label="Taux de TVA applicable" value={fmt(taux, taux % 1 ? 1 : 0)} unit="%" />
        <p className="text-xs text-navy/60">{explication}</p>
        <ResultRow label="Montant de TVA" value={`${fmt(tva, 2)} EUR`} />
        <ResultRow label="Montant TTC" value={`${fmt(ttc, 2)} EUR`} />
      </ResultBox>
      <Disclaimer>
        Indicatif. Les taux reduits supposent un logement acheve depuis plus de 2 ans et une
        attestation client. Verifiez l'eligibilite au cas par cas.
      </Disclaimer>
    </div>
  )
}

// ===========================================================================
// 2) TAUX HORAIRE — cout de revient -> taux de vente -> prix a la journee
//    (memes formules que la page publique calculateur-taux-horaire-artisan)
// ===========================================================================
export function CalcTauxHoraire() {
  const [revenuNet, setRevenuNet] = useState(28000)
  const [charges, setCharges] = useState(12000)
  const [fraisPro, setFraisPro] = useState(9000)
  const [heures, setHeures] = useState(1200)
  const [marge, setMarge] = useState(25)
  const [heuresJour, setHeuresJour] = useState(7)

  const r = useMemo(() => {
    const totalAnnuel = revenuNet + charges + fraisPro
    const h = heures > 0 ? heures : 1
    const coutRevient = totalAnnuel / h
    const tauxVente = coutRevient * (1 + marge / 100)
    const prixJournee = tauxVente * (heuresJour > 0 ? heuresJour : 0)
    return { totalAnnuel, coutRevient, tauxVente, prixJournee }
  }, [revenuNet, charges, fraisPro, heures, marge, heuresJour])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NumberInput label="Revenu net vise / an" value={revenuNet} onChange={setRevenuNet} unit="EUR" step={500} />
        <NumberInput label="Charges (cotisations, impots) / an" value={charges} onChange={setCharges} unit="EUR" step={500} />
        <NumberInput label="Frais pro (vehicule, outils, assur.) / an" value={fraisPro} onChange={setFraisPro} unit="EUR" step={500} />
        <NumberInput label="Heures facturables / an" value={heures} onChange={setHeures} unit="h" step={50} hint="Hors devis, trajets, admin" />
        <NumberInput label="Marge souhaitee" value={marge} onChange={setMarge} unit="%" step={5} />
        <NumberInput label="Heures travaillees / jour" value={heuresJour} onChange={setHeuresJour} unit="h" step={1} />
      </div>

      <ResultBox>
        <Highlight label="Taux horaire de vente (HT)" value={fmt(r.tauxVente, 2)} unit="EUR/h" />
        <ResultRow label="Cout de revient horaire" value={`${fmt(r.coutRevient, 2)} EUR/h`} />
        <ResultRow label="Prix d'une journee" value={`${fmt(r.prixJournee, 2)} EUR`} />
        <ResultRow label="Total a couvrir / an" value={`${fmt(r.totalAnnuel)} EUR`} />
      </ResultBox>
      <Disclaimer>
        Le taux de vente couvre ton revenu, tes charges et tes frais, plus ta marge. C'est un
        minimum a ne pas descendre en dessous pour rester rentable.
      </Disclaimer>
    </div>
  )
}
