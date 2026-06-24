'use client'

// ---------------------------------------------------------------------------
// Calculatrice PAYSAGISTE : sable pour gazon synthetique
//   - Lit de pose (sable sous le gazon, en epaisseur)
//   - Lestage (sable brosse sur le gazon, en kg/m2)
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { NumberInput, ChoiceSelect, ResultRow, ResultBox, Highlight, Disclaimer, fmt } from './ui'

export function CalcSableGazon() {
  const [mode, setMode] = useState('lit') // lit | lestage
  const [surface, setSurface] = useState(30) // m2
  const [epaisseur, setEpaisseur] = useState(4) // cm (lit de pose)
  const [dose, setDose] = useState(5) // kg/m2 (lestage)

  const r = useMemo(() => {
    const densite = 1600 // kg/m3 (sable sec, valeur moyenne)
    let volumeM3 = 0
    let masseKg = 0
    if (mode === 'lit') {
      volumeM3 = surface * (epaisseur / 100)
      masseKg = volumeM3 * densite
    } else {
      masseKg = surface * dose
      volumeM3 = densite > 0 ? masseKg / densite : 0
    }
    const sacs25 = Math.ceil(masseKg / 25)
    const bigBags = Math.ceil(masseKg / 1000) // big-bag ~1 tonne
    return { volumeM3, masseKg, sacs25, bigBags }
  }, [mode, surface, epaisseur, dose])

  return (
    <div className="space-y-3">
      <ChoiceSelect
        label="Usage du sable"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'lit', label: 'Lit de pose (sous le gazon)' },
          { value: 'lestage', label: 'Lestage (brosse sur le gazon)' },
        ]}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NumberInput label="Surface" value={surface} onChange={setSurface} unit="m2" step={1} />
        {mode === 'lit' ? (
          <NumberInput label="Epaisseur du lit" value={epaisseur} onChange={setEpaisseur} unit="cm" step={0.5} hint="~3 a 5 cm" />
        ) : (
          <NumberInput label="Dose de lestage" value={dose} onChange={setDose} unit="kg/m2" step={1} hint="selon hauteur de fibre (~4 a 20)" />
        )}
      </div>
      <ResultBox>
        <Highlight label="Sable necessaire" value={fmt(r.masseKg)} unit="kg" />
        <ResultRow label="Volume" value={`${fmt(r.volumeM3, 2)} m3`} />
        <ResultRow label="Sacs de 25 kg" value={`${fmt(r.sacs25)} sacs`} />
        <ResultRow label="Big-bags (~1 t)" value={`${fmt(r.bigBags)}`} />
      </ResultBox>
      <Disclaimer>
        Estimation avec une densite moyenne de sable sec (1600 kg/m3). Le lestage depend de la
        hauteur de fibre du gazon : reporte-toi a la fiche technique du fabricant.
      </Disclaimer>
    </div>
  )
}
