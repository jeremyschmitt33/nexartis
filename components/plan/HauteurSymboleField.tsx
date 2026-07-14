'use client'

/**
 * HauteurSymboleField — Hauteur de pose d'un symbole MURAL (15/07/2026).
 *
 * Demande du fondateur : « si une prise est à 20 cm, il faut respecter cela ».
 *
 * Ne s'affiche QUE pour un symbole mural : `hauteurDe()` est le discriminant,
 * jamais la présence de `hauteurMm` (un legacy est mural sans hauteur, un WC
 * n'est pas mural même si un JSON trafiqué lui en donnait une).
 *
 * Saisie en MÈTRES comme partout ailleurs dans l'éditeur (cotes de pièce, HSP),
 * en réutilisant `mmVersSaisieM` / `lireMetresEnMm` — les deux helpers durcis le
 * 14/07/2026 sur le bug de la cote sacrée. Écrire des helpers « cm » neufs
 * aurait ouvert une surface de bug neuve pour une commodité de frappe que les
 * raccourcis couvrent déjà.
 *
 * ⚠️ Ce composant doit être MONTÉ PAR SYMBOLE (`key={symbole.id}` chez
 * l'appelant) : `useState`/`useRef` ne réexécutent jamais leur initialiseur, et
 * sans remontage le champ afficherait la hauteur du symbole PRÉCÉDENT.
 */

import { useEffect, useRef, useState } from 'react'
import { lireMetresEnMm, mmVersSaisieM } from '@/lib/plan/defaults'
import { H_MAX_PLAUSIBLE_MM, H_SUSPECTE_MM, hauteurDe } from '@/lib/plan/hauteurs'
import { defSymbole } from '@/lib/plan/symboles'
import type { Symbole } from '@/lib/plan/types'
import { toast } from '@/lib/toast'

export interface HauteurSymboleFieldProps {
  symbole: Symbole
  /** HSP résolue de la pièce (mm) : sert l'avertissement « au-dessus du plafond ». */
  hspMm: number
  /** `null` = effacer la hauteur (« non renseignée »). */
  onRegler: (mm: number | null) => void
}

/**
 * Raccourcis par famille, en mm. Toutes SOURCÉES sur `lib/normes-metiers.ts`
 * (« NF C 15-100 — Hauteurs », confiance haute), déjà publié dans le module
 * Aide : aucune valeur inventée ici.
 * - prises : 50 = mini normatif (plinthe) ; 250 = usage ; 1100 = prise de plan
 *   de travail ; 1300 = maxi normatif.
 * - prise 32 A : 120 = mini normatif spécifique.
 * - commandes : 900 à 1300, idéal 1100.
 * - applique : aucune norme, 1800/2000 sont des usages.
 * - tableau : poignées 900-1300 ; bord supérieur <= 1800.
 */
const CHIPS_MM: Record<string, number[]> = {
  prise_16a: [50, 250, 1100, 1300],
  prise_double: [50, 250, 1100, 1300],
  prise_rj45: [50, 250, 1100, 1300],
  prise_tv: [50, 250, 1100, 1300],
  sortie_cable: [50, 250, 1100, 1300],
  prise_32a: [120, 250, 1100],
  interrupteur: [900, 1100, 1300],
  va_et_vient: [900, 1100, 1300],
  applique: [1800, 2000],
  tableau: [900, 1300, 1800],
}

/** « 250 » -> « 25 cm » ; « 1100 » -> « 1,10 m ». Libellé de chip uniquement. */
function labelChip(mm: number): string {
  if (mm < 1000) return `${mm / 10} cm`.replace('.', ',')
  return `${(mm / 1000).toFixed(2)} m`.replace('.', ',')
}

export default function HauteurSymboleField({ symbole, hspMm, onRegler }: HauteurSymboleFieldProps) {
  const info = hauteurDe(symbole)
  // Discriminant : seul un mural porte une hauteur. Un WC, un évier, un DCL au
  // plafond n'ont pas de champ du tout — pas un champ grisé, PAS DE CHAMP.
  const mural = info.kind === 'mural' || info.kind === 'mural-inconnue'

  const valeurInitiale = info.kind === 'mural' ? mmVersSaisieM(info.mm) : ''
  const [valeur, setValeur] = useState(valeurInitiale)
  /**
   * Chaîne d'ouverture : si l'artisan n'a rien tapé, on ne réécrit RIEN.
   * `onBlur` se déclenche sur une simple consultation — sans cette garde,
   * OUVRIR un panneau pour LIRE une hauteur la réécrirait en base. C'est le bug
   * du 14/07, à l'identique. Même ceinture-bretelles que CoteInput.
   */
  const initiale = useRef(valeurInitiale)

  /**
   * RESYNCHRONISATION sur la donnée (Ctrl+Z / Ctrl+Y).
   *
   * `key={symbole.id}` chez l'appelant ne remonte le champ que si l'on change DE
   * SYMBOLE. Un undo change la hauteur DU MÊME symbole : pas de remontage, et
   * l'initialiseur de `useState` ne réexécute JAMAIS → le champ resterait sur
   * « 1,1 » pendant que la donnée, l'écho en cm et le chip actif diraient tous
   * « 0,25 ». Trois lectures contradictoires dans le même panneau.
   *
   * ⚠️ La dépendance est la CHAÎNE `valeurInitiale`, JAMAIS `symbole` : `muter`
   * (usePlanState) fait `clone()` à chaque geste du plan, donc `symbole` est un
   * objet NEUF dès qu'on déplace une AUTRE prise — la dép `[symbole]` ferait
   * tirer l'effet et ÉCRASERAIT la frappe en cours. Ne pas « simplifier ».
   *
   * Ne peut pas écraser une frappe en cours : `valeurInitiale` ne change que
   * lorsque la DONNÉE change — au blur, au chip, ou à l'undo, jamais pendant la
   * saisie.
   *
   * ⚠️ Doit rester AVANT le `return null` (règle des hooks).
   */
  useEffect(() => {
    initiale.current = valeurInitiale
    setValeur(valeurInitiale)
  }, [valeurInitiale])

  if (!mural) return null

  const def = defSymbole(symbole.type)
  const chips = CHIPS_MM[symbole.type] ?? []

  const valider = () => {
    // Champ non touché : on ne touche à rien. Y compris « vide » resté vide.
    if (valeur === initiale.current) return

    const brut = valeur.trim()
    if (brut === '') {
      // Déjà « non renseignée » : effacer ce qui n'existe pas produirait une
      // écriture en base + un cran d'undo qui n'annule RIEN de visible.
      // `muter` ne compare jamais avant/après : la garde est ici ou nulle part.
      if (info.kind === 'mural-inconnue') {
        initiale.current = ''
        setValeur('')
        return
      }
      // Effacement VOLONTAIRE : « je ne connais pas la hauteur de cet existant ».
      // C'est le seul moyen de ne pas mentir, il doit rester possible.
      onRegler(null)
      initiale.current = ''
      // `setValeur('')` et pas seulement `initiale.current` : une saisie « ␣␣␣ »
      // laisserait sinon `valeur` = « ␣␣␣ » ≠ initiale.current = « » → CHAQUE
      // blur suivant rejouerait onRegler(null), soit une écriture en base + un
      // cran d'undo fantôme par blur, sur une donnée pourtant inchangée.
      setValeur('')
      return
    }

    const mm = lireMetresEnMm(brut)
    if (mm === null || mm <= 0) {
      toast.warning('Hauteur invalide', { description: 'Exemple : 0,25 (en mètres, depuis le sol fini).' })
      setValeur(initiale.current)
      return
    }

    // ⚠️ BORNE HAUTE OBLIGATOIRE — ne pas retirer.
    // `hauteurDe` rejette toute valeur > H_MAX_PLAUSIBLE_MM en 'mural-inconnue'.
    // Sans ce garde, « 1e3 » (= 1000 m) partirait EN BASE puis deviendrait
    // INVISIBLE : la 3D la dessinerait comme un legacy sans hauteur, et le champ
    // se rouvrirait sur « non renseignée ». Donnée écrite, invisible, non
    // modifiable — un fantôme. Un champ n'écrit jamais ce qu'il ne sait pas relire.
    // Ce n'est PAS un écrêtage (la cote saisie est sacrée) : on n'écrit RIEN et
    // on rend la main à l'artisan.
    if (mm > H_MAX_PLAUSIBLE_MM) {
      toast.warning('Hauteur invalide', {
        description: `Maximum ${mmVersSaisieM(H_MAX_PLAUSIBLE_MM)} m. La saisie est en MÈTRES : pour 20 cm, tapez 0,20.`,
      })
      setValeur(initiale.current)
      return
    }

    // On ACCEPTE et on écrit — puis on avertit. Jamais d'écrêtage : la cote
    // saisie est sacrée, et le cas est parfois vrai (mezzanine, HSP mal
    // renseignée, relevé d'un existant non conforme).
    onRegler(mm)
    initiale.current = mmVersSaisieM(mm)
    setValeur(initiale.current)

    if (mm > H_SUSPECTE_MM) {
      toast.warning(`Hauteur inhabituelle : ${mmVersSaisieM(mm)} m`, {
        description: 'La saisie est en MÈTRES. Pour 20 cm, tapez 0,20.',
      })
    } else if (hspMm > 0 && mm > hspMm) {
      toast.warning('Au-dessus du plafond', {
        description: `La pièce fait ${mmVersSaisieM(hspMm)} m sous plafond. Valeur conservée — à vérifier.`,
      })
    }
  }

  const poserChip = (mm: number) => {
    onRegler(mm)
    initiale.current = mmVersSaisieM(mm)
    setValeur(initiale.current)
  }

  return (
    <div>
      <span className="mb-1.5 block font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Hauteur / sol fini
      </span>

      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          aria-label="Hauteur de pose en mètres depuis le sol fini"
          placeholder="non renseignée"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setValeur(initiale.current)
              e.currentTarget.blur()
            }
          }}
          className="h-9 w-[104px] rounded-xl border-[1.5px] border-gray-200 bg-white px-2.5 text-center font-spline-mono text-[14px] font-medium text-navy transition-colors focus:border-orange focus:outline-none"
        />
        <span className="font-hanken text-[13px] font-semibold text-gray-500">m</span>
        {/* Écho en cm : l'artisan pense en centimètres. C'est LE garde-fou qui
            rend visible un « 20 » tapé par réflexe (= 20 m = 2 000 cm).
            gray-500 (4,83:1, AA) et pas gray-400 (2,54:1) : l'écho est une
            relecture de COTE — le texte le moins lisible du panneau serait
            celui qui rattrape l'erreur la plus chère.
            `String().replace` : virgule française, comme partout ailleurs. */}
        {info.kind === 'mural' && (
          <span className="font-hanken text-[12px] text-gray-500">
            = {String(info.mm / 10).replace('.', ',')} cm
          </span>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((mm) => {
            const actif = info.kind === 'mural' && info.mm === mm
            return (
              <button
                key={mm}
                type="button"
                onClick={() => poserChip(mm)}
                aria-label={`Régler la hauteur à ${labelChip(mm)}`}
                className={`inline-flex h-9 min-w-[56px] items-center justify-center rounded-xl border-[1.5px] px-2.5 font-hanken text-[12.5px] font-bold transition-colors ${
                  actif
                    ? 'border-orange bg-orange/10 text-orange'
                    : 'border-gray-200 bg-white text-navy hover:border-orange'
                }`}
              >
                {labelChip(mm)}
              </button>
            )
          })}
        </div>
      )}

      <p className="mt-1.5 font-hanken text-[11.5px] leading-snug text-gray-500">
        {def?.hauteurHint ? `${def.hauteurHint}, ` : 'Axe de l’appareillage, '}
        depuis le sol fini. Videz le champ si vous ne connaissez pas la hauteur.
      </p>
    </div>
  )
}
