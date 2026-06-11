// lib/facturx/invoicer.ts
// ---------------------------------------------------------------------------
// Instance unique node-zugferd configuree sur le profil EN 16931 (COMFORT),
// profil de reference pour les echanges B2B conformes a la norme europeenne et
// au format Factur-X francais.
//
// IMPORTANT — `strict: false` :
//   En mode strict, node-zugferd appelle un validateur XSD qui requiert un JDK
//   Java au moment de l'execution. Vercel (Node) n'embarque pas de JDK : laisser
//   le mode strict planterait la generation en production.
//   La validation de conformite est donc realisee HORS production, en phase de
//   developpement (xmllint + Schematron Mustangproject), pas au runtime.
//   En production on se contente de PRODUIRE le XML/PDF ; on ne le valide pas
//   via Java. Aucune dependance Java n'est donc requise sur Vercel.
// ---------------------------------------------------------------------------

import { zugferd } from 'node-zugferd'
import { EN16931 } from 'node-zugferd/profile/en16931'

export const invoicer = zugferd({
  profile: EN16931,
  strict: false,
})

/** Type des donnees d'entree attendues par `invoicer.create()` (profil EN 16931). */
export type FacturXSchema = typeof invoicer.$Infer.Schema
