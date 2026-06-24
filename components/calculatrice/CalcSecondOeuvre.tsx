'use client'

// ---------------------------------------------------------------------------
// Calculatrices SECOND OEUVRE + DIFFERENCIANTES :
//   - Peinture (peintre)
//   - Section de cable / chute de tension (electricien)  <- VOX BATI ne l'a pas
//   - Puissance de chauffage (chauffagiste)              <- VOX BATI ne l'a pas
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { NumberInput, ChoiceSelect, ResultRow, ResultBox, Highlight, Disclaimer, fmt } from './ui'

// ===========================================================================
// PEINTURE — litres et pots selon surface, couches, rendement, sous-couche
// ===========================================================================
export function CalcPeinture() {
  const [surface, setSurface] = useState(40) // m2 a peindre
  const [couches, setCouches] = useState(2)
  const [rendement, setRendement] = useState(10) // m2 / L / couche
  const [sousCouche, setSousCouche] = useState('non')
  const [pot, setPot] = useState('2.5') // L

  const r = useMemo(() => {
    const rdt = rendement > 0 ? rendement : 1
    const litresFinition = (surface * couches) / rdt
    const litresSC = sousCouche === 'oui' ? surface / 8 : 0 // sous-couche : 1 couche, ~8 m2/L
    const totalLitres = litresFinition + litresSC
    const contenance = Number(pot)
    const pots = contenance > 0 ? Math.ceil(totalLitres / contenance) : 0
    return { litresFinition, litresSC, totalLitres, pots, contenance }
  }, [surface, couches, rendement, sousCouche, pot])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NumberInput label="Surface a peindre" value={surface} onChange={setSurface} unit="m2" step={1} />
        <NumberInput label="Nombre de couches" value={couches} onChange={setCouches} unit="couches" step={1} />
        <NumberInput label="Rendement peinture" value={rendement} onChange={setRendement} unit="m2/L" step={1} hint="~10-12 m2/L par couche" />
        <ChoiceSelect
          label="Sous-couche / primaire"
          value={sousCouche}
          onChange={setSousCouche}
          options={[
            { value: 'non', label: 'Non' },
            { value: 'oui', label: 'Oui (1 couche)' },
          ]}
        />
        <ChoiceSelect
          label="Contenance des pots"
          value={pot}
          onChange={setPot}
          options={[
            { value: '1', label: '1 L' },
            { value: '2.5', label: '2,5 L' },
            { value: '5', label: '5 L' },
            { value: '10', label: '10 L' },
            { value: '15', label: '15 L' },
          ]}
        />
      </div>
      <ResultBox>
        <Highlight label="Peinture totale" value={fmt(r.totalLitres, 1)} unit="L" />
        <ResultRow label="Finition" value={`${fmt(r.litresFinition, 1)} L`} />
        {r.litresSC > 0 && <ResultRow label="Sous-couche" value={`${fmt(r.litresSC, 1)} L`} />}
        <ResultRow label={`Pots de ${r.contenance} L`} value={`${fmt(r.pots)} pots`} />
      </ResultBox>
      <Disclaimer>
        Le rendement reel depend du support (neuf, poreux, fonce). Prevois une marge pour les
        retouches.
      </Disclaimer>
    </div>
  )
}

const SECTIONS_NORM = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120]

// ===========================================================================
// SECTION DE CABLE / CHUTE DE TENSION (electricien) — estimation indicative
// ===========================================================================
export function CalcCable() {
  const [type, setType] = useState('mono') // mono 230V | tri 400V
  const [puissance, setPuissance] = useState(3500) // W
  const [longueur, setLongueur] = useState(20) // m (aller simple)
  const [materiau, setMateriau] = useState('cuivre')
  const [chute, setChute] = useState(3) // % admissible

  const r = useMemo(() => {
    const U = type === 'mono' ? 230 : 400
    const cosPhi = 1
    const I = type === 'mono' ? puissance / (U * cosPhi) : puissance / (Math.sqrt(3) * U * cosPhi)
    const rho = materiau === 'cuivre' ? 0.0225 : 0.036 // ohm.mm2/m
    const deltaU = U * (chute / 100) // volts admissibles
    const k = type === 'mono' ? 2 : Math.sqrt(3)
    const sectionMin = deltaU > 0 ? (k * rho * longueur * I) / deltaU : 0
    const sectionNorm = SECTIONS_NORM.find((s) => s >= sectionMin) ?? SECTIONS_NORM[SECTIONS_NORM.length - 1]
    return { U, I, sectionMin, sectionNorm }
  }, [type, puissance, longueur, materiau, chute])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChoiceSelect
          label="Type d'alimentation"
          value={type}
          onChange={setType}
          options={[
            { value: 'mono', label: 'Monophase 230 V' },
            { value: 'tri', label: 'Triphase 400 V' },
          ]}
        />
        <ChoiceSelect
          label="Materiau du conducteur"
          value={materiau}
          onChange={setMateriau}
          options={[
            { value: 'cuivre', label: 'Cuivre' },
            { value: 'alu', label: 'Aluminium' },
          ]}
        />
        <NumberInput label="Puissance" value={puissance} onChange={setPuissance} unit="W" step={100} />
        <NumberInput label="Longueur du cable" value={longueur} onChange={setLongueur} unit="m" step={1} hint="aller simple" />
        <NumberInput label="Chute de tension admissible" value={chute} onChange={setChute} unit="%" step={0.5} hint="3% eclairage, 5% autres" />
      </div>
      <ResultBox>
        <Highlight label="Section recommandee" value={fmt(r.sectionNorm, r.sectionNorm % 1 ? 1 : 0)} unit="mm2" />
        <ResultRow label="Courant" value={`${fmt(r.I, 1)} A`} />
        <ResultRow label="Section mini (chute de tension)" value={`${fmt(r.sectionMin, 2)} mm2`} />
      </ResultBox>
      <Disclaimer>
        Estimation INDICATIVE basee sur la chute de tension (cos phi = 1). La section finale doit
        aussi respecter le courant admissible, le calibre du disjoncteur et la norme NF C 15-100.
        A faire valider par un electricien.
      </Disclaimer>
    </div>
  )
}

// ===========================================================================
// PUISSANCE DE CHAUFFAGE (chauffagiste) — estimation par volume + isolation
// ===========================================================================
export function CalcChauffage() {
  const [surface, setSurface] = useState(25) // m2
  const [hauteur, setHauteur] = useState(2.5) // m
  const [isolation, setIsolation] = useState('moyenne')
  const [tInt, setTInt] = useState(20) // C
  const [tExt, setTExt] = useState(-5) // C base

  const r = useMemo(() => {
    const G: Record<string, number> = { bonne: 0.75, moyenne: 1.1, mauvaise: 1.6 }
    const coeff = G[isolation] ?? 1.1
    const volume = surface * hauteur
    const deltaT = tInt - tExt
    const puissanceW = volume * coeff * deltaT
    return { volume, deltaT, puissanceW, puissanceKw: puissanceW / 1000 }
  }, [surface, hauteur, isolation, tInt, tExt])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NumberInput label="Surface de la piece" value={surface} onChange={setSurface} unit="m2" step={1} />
        <NumberInput label="Hauteur sous plafond" value={hauteur} onChange={setHauteur} unit="m" step={0.1} />
        <ChoiceSelect
          label="Isolation du logement"
          value={isolation}
          onChange={setIsolation}
          options={[
            { value: 'bonne', label: 'Bonne (recente / RT2012+)' },
            { value: 'moyenne', label: 'Moyenne' },
            { value: 'mauvaise', label: 'Faible (ancien non isole)' },
          ]}
        />
        <NumberInput label="Temperature souhaitee" value={tInt} onChange={setTInt} unit="C" step={1} />
        <NumberInput label="Temperature exterieure de base" value={tExt} onChange={setTExt} unit="C" step={1} hint="selon region (~-5 a -10)" />
      </div>
      <ResultBox>
        <Highlight label="Puissance de chauffage" value={fmt(r.puissanceKw, 2)} unit="kW" />
        <ResultRow label="Volume a chauffer" value={`${fmt(r.volume, 1)} m3`} />
        <ResultRow label="Ecart de temperature" value={`${fmt(r.deltaT)} C`} />
      </ResultBox>
      <Disclaimer>
        Estimation INDICATIVE (methode volume x coefficient x ecart). Un bilan thermique precis
        (deperditions reelles, surfaces vitrees, renouvellement d'air) reste recommande pour
        dimensionner une installation.
      </Disclaimer>
    </div>
  )
}
