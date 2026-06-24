'use client'

// ---------------------------------------------------------------------------
// Calculatrices GROS OEUVRE : Beton/ciment (macon), Carrelage, Toiture (pente).
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { NumberInput, ChoiceSelect, ResultRow, ResultBox, Highlight, Disclaimer, fmt } from './ui'

// ===========================================================================
// BETON & sacs de ciment — volume puis dosage (ciment, sable, gravier, eau)
// ===========================================================================
export function CalcBeton() {
  const [longueur, setLongueur] = useState(4)
  const [largeur, setLargeur] = useState(3)
  const [epaisseur, setEpaisseur] = useState(12) // cm
  const [dosage, setDosage] = useState('350') // kg de ciment / m3

  const r = useMemo(() => {
    const volume = longueur * largeur * (epaisseur / 100) // m3
    const d = Number(dosage)
    const cimentKg = d * volume
    const sacs35 = Math.ceil(cimentKg / 35)
    const sacs25 = Math.ceil(cimentKg / 25)
    const sableM3 = 0.5 * volume
    const gravierM3 = 0.8 * volume
    const sableKg = sableM3 * 1600
    const gravierKg = gravierM3 * 1500
    const eauL = 0.5 * cimentKg
    return { volume, cimentKg, sacs35, sacs25, sableM3, gravierM3, sableKg, gravierKg, eauL }
  }, [longueur, largeur, epaisseur, dosage])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <NumberInput label="Longueur" value={longueur} onChange={setLongueur} unit="m" step={0.1} />
        <NumberInput label="Largeur" value={largeur} onChange={setLargeur} unit="m" step={0.1} />
        <NumberInput label="Epaisseur" value={epaisseur} onChange={setEpaisseur} unit="cm" step={1} />
      </div>
      <ChoiceSelect
        label="Dosage du beton"
        value={dosage}
        onChange={setDosage}
        options={[
          { value: '250', label: '250 kg/m3 - beton de proprete / fondation legere' },
          { value: '350', label: '350 kg/m3 - dalle / usage courant' },
          { value: '400', label: '400 kg/m3 - beton arme / structure' },
        ]}
      />
      <ResultBox>
        <Highlight label="Volume de beton" value={fmt(r.volume, 2)} unit="m3" />
        <ResultRow label="Ciment" value={`${fmt(r.cimentKg)} kg`} />
        <ResultRow label="Sacs de 35 kg" value={`${fmt(r.sacs35)} sacs`} />
        <ResultRow label="Sacs de 25 kg" value={`${fmt(r.sacs25)} sacs`} />
        <ResultRow label="Sable" value={`${fmt(r.sableM3, 2)} m3 (~${fmt(r.sableKg)} kg)`} />
        <ResultRow label="Gravier" value={`${fmt(r.gravierM3, 2)} m3 (~${fmt(r.gravierKg)} kg)`} />
        <ResultRow label="Eau" value={`~${fmt(r.eauL)} L`} />
      </ResultBox>
      <Disclaimer>
        Estimation pour un beton courant. Prevois une marge (~10%) et adapte le dosage selon
        l'ouvrage. Sable et gravier en volume foisonne (densite moyenne).
      </Disclaimer>
    </div>
  )
}

// ===========================================================================
// CARRELAGE — nombre de carreaux (avec chutes) + colle
// ===========================================================================
export function CalcCarrelage() {
  const [surface, setSurface] = useState(20) // m2
  const [carreauL, setCarreauL] = useState(60) // cm
  const [carreaul, setCarreaul] = useState(60) // cm
  const [chutes, setChutes] = useState(10) // %
  const [conso, setConso] = useState(5) // kg colle / m2

  const r = useMemo(() => {
    const surfaceChutes = surface * (1 + chutes / 100)
    const surfCarreau = (carreauL / 100) * (carreaul / 100) // m2
    const nbCarreaux = surfCarreau > 0 ? Math.ceil(surfaceChutes / surfCarreau) : 0
    const colleKg = surface * conso
    const sacsColle = Math.ceil(colleKg / 25)
    return { surfaceChutes, nbCarreaux, colleKg, sacsColle }
  }, [surface, carreauL, carreaul, chutes, conso])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NumberInput label="Surface a carreler" value={surface} onChange={setSurface} unit="m2" step={1} />
        <NumberInput label="Chutes / pertes" value={chutes} onChange={setChutes} unit="%" step={1} hint="10% droit, 15% en diagonale" />
        <NumberInput label="Carreau - longueur" value={carreauL} onChange={setCarreauL} unit="cm" step={1} />
        <NumberInput label="Carreau - largeur" value={carreaul} onChange={setCarreaul} unit="cm" step={1} />
        <NumberInput label="Colle au m2" value={conso} onChange={setConso} unit="kg/m2" step={0.5} hint="~4-6 kg selon format" />
      </div>
      <ResultBox>
        <Highlight label="Carreaux a prevoir" value={fmt(r.nbCarreaux)} unit="carreaux" />
        <ResultRow label="Surface avec chutes" value={`${fmt(r.surfaceChutes, 1)} m2`} />
        <ResultRow label="Colle a carrelage" value={`${fmt(r.colleKg)} kg`} />
        <ResultRow label="Sacs de colle (25 kg)" value={`${fmt(r.sacsColle)} sacs`} />
      </ResultBox>
      <Disclaimer>
        Achete toujours 1 a 2 carreaux de plus par lot pour les casses et les retouches futures
        (memes bain/teinte).
      </Disclaimer>
    </div>
  )
}

// ===========================================================================
// TOITURE — surface REELLE selon la pente (le calcul "intelligent") + tuiles
// ===========================================================================
export function CalcToiture() {
  const [longueur, setLongueur] = useState(10) // m (emprise au sol)
  const [largeur, setLargeur] = useState(8) // m (emprise au sol)
  const [pente, setPente] = useState(30) // %
  const [tuilesM2, setTuilesM2] = useState(12) // tuiles / m2

  const r = useMemo(() => {
    const emprise = longueur * largeur // m2 projetes au sol
    const angle = Math.atan(pente / 100) // radians
    const cos = Math.cos(angle)
    const surfaceReelle = cos > 0 ? emprise / cos : emprise
    const angleDeg = (angle * 180) / Math.PI
    const nbTuiles = Math.ceil(surfaceReelle * tuilesM2)
    const ecran = surfaceReelle * 1.1
    return { emprise, surfaceReelle, angleDeg, nbTuiles, ecran }
  }, [longueur, largeur, pente, tuilesM2])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NumberInput label="Longueur au sol" value={longueur} onChange={setLongueur} unit="m" step={0.5} />
        <NumberInput label="Largeur au sol" value={largeur} onChange={setLargeur} unit="m" step={0.5} />
        <NumberInput label="Pente du toit" value={pente} onChange={setPente} unit="%" step={1} hint={`soit ~${fmt(r.angleDeg, 0)} deg`} />
        <NumberInput label="Tuiles au m2" value={tuilesM2} onChange={setTuilesM2} unit="/m2" step={1} hint="selon modele (10 a 22)" />
      </div>
      <ResultBox>
        <Highlight label="Surface reelle de toiture" value={fmt(r.surfaceReelle, 1)} unit="m2" />
        <ResultRow label="Surface au sol (projetee)" value={`${fmt(r.emprise, 1)} m2`} />
        <ResultRow label="Tuiles a prevoir" value={`${fmt(r.nbTuiles)} tuiles`} />
        <ResultRow label="Ecran sous-toiture" value={`~${fmt(r.ecran, 1)} m2`} />
      </ResultBox>
      <Disclaimer>
        La surface reelle tient compte de la pente (toujours superieure a la surface au sol).
        Ajoute les debords de toit et les recouvrements selon le modele de tuile.
      </Disclaimer>
    </div>
  )
}
