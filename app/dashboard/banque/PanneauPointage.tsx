'use client'

// ============================================================================
// PanneauPointage — le tri d'une opération en quelques secondes (Lot 2b)
// ----------------------------------------------------------------------------
// Fidèle à la maquette validée (docs/depenses-banque/maquette-v1.html) :
//  · DÉBIT  : catégorie (chips suggérées + recherche « Autre… »), chantier
//    (chips des chantiers actifs) → c'est LE seul chemin vers la rentabilité :
//    choisir un chantier crée l'achat lié (achats.mouvement_id, décision
//    jeremy n°3 : mouvement → achat → chantier, jamais de chantier_id sur le
//    mouvement), justificatif photo, libellé perso + notes.
//  · CRÉDIT : rapprochement d'une facture non soldée via la RPC
//    rpc_enregistrer_paiement (multi-acomptes : détail « déjà reçu / ce
//    virement / reste dû » ; un même virement peut être ventilé sur
//    2 factures — le garde-fou MOUVEMENT_DEPASSE protège côté base).
//  · Cas particuliers : remboursement / virement interne / c'est perso.
//  · File enchaînée : « Plus que N à trier », passe à la suivante.
//  · Apprentissage (Lot 2c) : quand l'utilisateur choisit/corrige la catégorie
//    d'un DÉBIT importé, une règle apprise (categorisation_regles, source
//    'apprise', priorité 100) est proposée — « Retenir pour les prochaines
//    fois », cochée par défaut — puis appliquée aux autres débits à trier.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { insertRow, updateRow } from '@/lib/hooks'
import { toast } from '@/lib/toast'
import JustificatifUpload from '@/components/dashboard/JustificatifUpload'
import {
  mapPaiementRpcError,
  type PaiementRpcResult,
} from '@/lib/banque/rpc-paiements'
import { extraireMotif } from '@/lib/banque/regles'
import {
  dateFr,
  euros,
  montantSigne,
  parserMontantSaisi,
  MOUVEMENT_COLONNES,
  type Categorie,
  type ChantierLeger,
  type CompteTresorerie,
  type Mouvement,
} from './commun'
import { Loader2, Search, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface FournisseurLeger {
  id: string
  nom: string
}

interface FactureOuverte {
  id: string
  numero: string | null
  client_id: string | null
  objet: string | null
  montant_ttc: number
  montant_paye: number
  avoir_impute_montant: number
  statut: string
  date_emission: string | null
}

interface ClientLeger {
  id: string
  nom: string | null
  prenom: string | null
}

interface AchatLie {
  id: string
  chantier_id: string | null
  fournisseur_id: string | null
  fournisseur_libre: string | null
  taux_tva: number | null
}

/** Reste encaissable en cash sur une facture (TTC − avoir imputé − déjà payé). */
function resteDuFacture(f: FactureOuverte): number {
  return Math.max(
    0,
    Math.round((f.montant_ttc - f.avoir_impute_montant - f.montant_paye) * 100) / 100,
  )
}

/** Déduit le moyen de paiement du libellé bancaire (null si non reconnu). */
function deduireMoyenPaiement(libelle: string, estCaisse: boolean): string | null {
  if (estCaisse) return 'especes'
  const l = libelle.toUpperCase()
  if (/\bCB\b|CARTE/.test(l)) return 'carte'
  if (/PRLV|PRELEVEMENT|PRÉLÈVEMENT/.test(l)) return 'prelevement'
  if (/CHEQUE|CHÈQUE|\bCHQ\b/.test(l)) return 'cheque'
  if (/\bVIR\b|VIREMENT/.test(l)) return 'virement'
  return null
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function PanneauPointage({
  mouvement,
  compte,
  categories,
  franchiseTva,
  resteATrier,
  modeFile,
  onClose,
  onMaj,
  onPointe,
  onPasser,
  onAutresTriees,
}: {
  mouvement: Mouvement
  compte: CompteTresorerie | undefined
  categories: Categorie[]
  /** entreprises.franchise_tva : TVA proposée à 0 sur l'achat créé. */
  franchiseTva: boolean
  /** Nombre d'opérations restant à trier (celle-ci comprise). */
  resteATrier: number
  /** true = file enchaînée (bouton Passer + compteur) ; false = ouverture simple. */
  modeFile: boolean
  onClose: () => void
  /** Mise à jour partielle (ex. justificatif) sans avancer la file. */
  onMaj: (mouvementMaj: Mouvement) => void
  /** Pointage terminé → le parent met à jour la liste et avance la file. */
  onPointe: (mouvementMaj: Mouvement) => void
  onPasser: () => void
  /** Une règle apprise a trié d'autres opérations → le parent met à jour liste + file. */
  onAutresTriees: (mouvementsMaj: Mouvement[]) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const estDebit = mouvement.montant < 0
  const estCaisse = compte?.type === 'caisse'

  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // ── Données chargées à l'ouverture ──
  const [chantiers, setChantiers] = useState<ChantierLeger[]>([])
  const [fournisseurs, setFournisseurs] = useState<FournisseurLeger[]>([])
  const [achatLie, setAchatLie] = useState<AchatLie | null>(null)
  const [factures, setFactures] = useState<FactureOuverte[]>([])
  const [clients, setClients] = useState<Map<string, ClientLeger>>(new Map())
  const [dejaAffecte, setDejaAffecte] = useState(0)
  const [chargement, setChargement] = useState(true)

  // ── État du formulaire débit ──
  const [categorieId, setCategorieId] = useState<string | null>(mouvement.categorie_id)
  const [autresCategoriesOuvert, setAutresCategoriesOuvert] = useState(false)
  const [rechercheCategorie, setRechercheCategorie] = useState('')
  const [chantierId, setChantierId] = useState<string | null>(null)
  const [fournisseurTexte, setFournisseurTexte] = useState('')
  const [tauxTva, setTauxTva] = useState(franchiseTva ? '0' : '20')
  const [libellePerso, setLibellePerso] = useState(mouvement.libelle_perso ?? '')
  const [notes, setNotes] = useState(mouvement.notes ?? '')
  const [detailsOuverts, setDetailsOuverts] = useState(
    Boolean(mouvement.libelle_perso || mouvement.notes),
  )

  // ── Apprentissage des corrections (Lot 2c) ──
  // Motif extrait du libellé bancaire (débits importés uniquement : un libellé
  // saisi à la main dans la caisse n'a rien à apprendre). null = pas de motif
  // exploitable → pas de proposition de règle.
  const motifAppris = useMemo(
    () =>
      estDebit && mouvement.source !== 'manuel' ? extraireMotif(mouvement.libelle_banque) : null,
    [estDebit, mouvement.source, mouvement.libelle_banque],
  )
  /** « Retenir pour les prochaines fois » — cochée par défaut (décision validée). */
  const [retenirRegle, setRetenirRegle] = useState(true)

  // ── État du rapprochement crédit ──
  const [factureChoisieId, setFactureChoisieId] = useState<string | null>(null)
  const [montantSaisiTexte, setMontantSaisiTexte] = useState('')
  const [autresFacturesOuvert, setAutresFacturesOuvert] = useState(false)
  const [rechercheFacture, setRechercheFacture] = useState('')
  const [recetteSansFactureOuvert, setRecetteSansFactureOuvert] = useState(false)

  // Fermeture au clavier.
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', auClavier)
    return () => document.removeEventListener('keydown', auClavier)
  }, [onClose])

  // ── Chargement des données du panneau ──
  useEffect(() => {
    let annule = false
    async function charger() {
      setChargement(true)
      try {
        if (estDebit) {
          const [resChantiers, resFournisseurs, resAchat] = await Promise.all([
            supabase.from('chantiers').select('id, titre, statut'),
            supabase.from('fournisseurs').select('id, nom'),
            supabase
              .from('achats')
              .select('id, chantier_id, fournisseur_id, fournisseur_libre, taux_tva')
              .eq('mouvement_id', mouvement.id)
              .is('deleted_at', null)
              .limit(1)
              .maybeSingle(),
          ])
          if (annule) return
          const actifs = ((resChantiers.data ?? []) as ChantierLeger[]).filter(
            (c) => !['livre', 'cloture', 'archive'].includes(c.statut ?? ''),
          )
          const listeFournisseurs = (resFournisseurs.data ?? []) as FournisseurLeger[]
          setChantiers(actifs)
          setFournisseurs(listeFournisseurs)

          const achat = (resAchat.data ?? null) as AchatLie | null
          setAchatLie(achat)
          if (achat) {
            setChantierId(achat.chantier_id)
            if (achat.taux_tva !== null) setTauxTva(String(achat.taux_tva))
            if (achat.fournisseur_libre) setFournisseurTexte(achat.fournisseur_libre)
            else if (achat.fournisseur_id) {
              const f = listeFournisseurs.find((x) => x.id === achat.fournisseur_id)
              if (f) setFournisseurTexte(f.nom)
            }
          } else {
            // Fournisseur détecté depuis le libellé (règle simple : le nom
            // d'une fiche fournisseur apparaît dans le libellé bancaire).
            const libelle = mouvement.libelle_banque.toUpperCase()
            const detecte = listeFournisseurs.find(
              (f) => f.nom.trim().length >= 3 && libelle.includes(f.nom.trim().toUpperCase()),
            )
            if (detecte) setFournisseurTexte(detecte.nom)
          }
        } else {
          const [resFactures, resClients, resPaiements] = await Promise.all([
            supabase
              .from('factures')
              .select(
                'id, numero, client_id, objet, montant_ttc, montant_paye, avoir_impute_montant, statut, type, date_emission',
              )
              .is('deleted_at', null)
              .in('statut', ['envoyee', 'envoye', 'en_retard', 'partiellement_payee'])
              .order('date_emission', { ascending: false })
              .limit(300),
            supabase.from('clients').select('id, nom, prenom'),
            supabase
              .from('paiements')
              .select('montant')
              .eq('mouvement_id', mouvement.id)
              .is('deleted_at', null),
          ])
          if (annule) return
          const brutes = (resFactures.data ?? []) as (FactureOuverte & { type: string | null })[]
          const ouvertes = brutes
            .map((f) => ({
              ...f,
              montant_ttc: Number(f.montant_ttc ?? 0),
              montant_paye: Number(f.montant_paye ?? 0),
              avoir_impute_montant: Number(f.avoir_impute_montant ?? 0),
            }))
            .filter((f) => (f.type ?? 'standard') !== 'avoir' && resteDuFacture(f) > 0.009)
          setFactures(ouvertes)

          const mapClients = new Map<string, ClientLeger>()
          for (const c of (resClients.data ?? []) as ClientLeger[]) mapClients.set(c.id, c)
          setClients(mapClients)

          const somme = ((resPaiements.data ?? []) as { montant: number }[]).reduce(
            (s, p) => s + Number(p.montant ?? 0),
            0,
          )
          setDejaAffecte(Math.round(somme * 100) / 100)
        }
      } catch (e) {
        console.error('Chargement du panneau de pointage impossible', e)
        if (!annule) setErreur('Impossible de charger les informations. Fermez le panneau et réessayez.')
      } finally {
        if (!annule) setChargement(false)
      }
    }
    void charger()
    return () => {
      annule = true
    }
  }, [supabase, mouvement.id, mouvement.libelle_banque, estDebit])

  // ── Dérivés ──
  const categorieMap = useMemo(() => {
    const map = new Map<string, Categorie>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  const categorieParCode = useCallback(
    (code: string) => categories.find((c) => c.code === code) ?? null,
    [categories],
  )

  /** Chips de catégories suggérées (3 max) : la proposée d'abord, puis les courantes. */
  const suggestionsCategories = useMemo(() => {
    const resultat: Categorie[] = []
    const proposee = mouvement.categorie_id ? categorieMap.get(mouvement.categorie_id) : undefined
    if (proposee && proposee.groupe === 'depense') resultat.push(proposee)
    for (const code of ['materiaux', 'outillage', 'carburant']) {
      const c = categorieParCode(code)
      if (c && !resultat.some((r) => r.id === c.id)) resultat.push(c)
      if (resultat.length >= 3) break
    }
    return resultat
  }, [mouvement.categorie_id, categorieMap, categorieParCode])

  const categoriesDepense = useMemo(
    () =>
      categories
        .filter((c) => c.groupe === 'depense')
        .filter((c) => c.label.toLowerCase().includes(rechercheCategorie.trim().toLowerCase())),
    [categories, rechercheCategorie],
  )

  const categoriesRecette = useMemo(
    () => categories.filter((c) => c.groupe === 'recette'),
    [categories],
  )

  /** Restant à ventiler sur ce virement (crédit). */
  const restantMouvement = useMemo(
    () => Math.max(0, Math.round((mouvement.montant - dejaAffecte) * 100) / 100),
    [mouvement.montant, dejaAffecte],
  )

  const nomClient = useCallback(
    (clientId: string | null) => {
      if (!clientId) return null
      const c = clients.get(clientId)
      if (!c) return null
      return `${c.prenom ?? ''} ${c.nom ?? ''}`.trim() || null
    },
    [clients],
  )

  /** Facture suggérée : le nom du client apparaît dans le libellé du virement. */
  const factureSuggeree = useMemo(() => {
    const libelle = mouvement.libelle_banque.toUpperCase()
    let meilleure: FactureOuverte | null = null
    let meilleurScore = 0
    for (const f of factures) {
      const nom = nomClient(f.client_id)
      if (!nom) continue
      const jetons = nom
        .toUpperCase()
        .split(/\s+/)
        .filter((j) => j.length >= 3)
      const score = jetons.filter((j) => libelle.includes(j)).length
      if (score > meilleurScore) {
        meilleurScore = score
        meilleure = f
      }
    }
    return meilleurScore > 0 ? meilleure : null
  }, [factures, mouvement.libelle_banque, nomClient])

  // Pré-sélection de la facture suggérée + montant pré-rempli.
  useEffect(() => {
    if (estDebit || chargement) return
    if (factureChoisieId) return
    if (factureSuggeree) choisirFacture(factureSuggeree)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargement, estDebit, factureSuggeree])

  const factureChoisie = useMemo(
    () => factures.find((f) => f.id === factureChoisieId) ?? null,
    [factures, factureChoisieId],
  )

  function choisirFacture(f: FactureOuverte) {
    setFactureChoisieId(f.id)
    const preRempli = Math.min(resteDuFacture(f), restantMouvement)
    setMontantSaisiTexte(preRempli > 0 ? preRempli.toFixed(2).replace('.', ',') : '')
    setAutresFacturesOuvert(false)
    setErreur(null)
  }

  const facturesFiltrees = useMemo(() => {
    const terme = rechercheFacture.trim().toLowerCase()
    return factures.filter((f) => {
      if (!terme) return true
      const texte = `${f.numero ?? ''} ${f.objet ?? ''} ${nomClient(f.client_id) ?? ''}`.toLowerCase()
      return texte.includes(terme)
    })
  }, [factures, rechercheFacture, nomClient])

  // ── Écriture : mise à jour du mouvement ──
  const majMouvement = useCallback(
    async (patch: Record<string, unknown>): Promise<Mouvement> => {
      const { data, error } = await supabase
        .from('banque_mouvements')
        .update(patch)
        .eq('id', mouvement.id)
        .select(MOUVEMENT_COLONNES)
        .single()
      if (error) throw error
      return data as Mouvement
    },
    [supabase, mouvement.id],
  )

  // ── Apprentissage : créer/mettre à jour la règle apprise + propager ──
  // Best effort ABSOLU : le pointage est déjà enregistré quand on arrive ici,
  // un échec d'apprentissage ne doit jamais le remettre en cause (log + rien).
  async function apprendreEtPropager(categorieChoisie: Categorie) {
    if (!motifAppris) return
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // 1) Upsert logique de la règle apprise (même user + même pattern →
      //    on met à jour la catégorie au lieu de créer un doublon).
      const { data: existante, error: erreurLecture } = await supabase
        .from('categorisation_regles')
        .select('id, nb_applications')
        .eq('user_id', user.id)
        .eq('pattern', motifAppris)
        .eq('source', 'apprise')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()
      if (erreurLecture) throw erreurLecture

      let regleId: string | null = null
      let nbApplications = 0
      if (existante) {
        regleId = existante.id as string
        nbApplications = Number(existante.nb_applications ?? 0)
        const { error } = await supabase
          .from('categorisation_regles')
          .update({ categorie_id: categorieChoisie.id, sens: 'debit', priorite: 100, actif: true })
          .eq('id', regleId)
        if (error) throw error
      } else {
        const { data: creee, error } = await supabase
          .from('categorisation_regles')
          .insert({
            user_id: user.id,
            pattern: motifAppris,
            type_match: 'contient',
            categorie_id: categorieChoisie.id,
            sens: 'debit',
            priorite: 100, // les règles apprises priment sur les règles système (~900)
            source: 'apprise',
          })
          .select('id')
          .single()
        if (error) throw error
        regleId = (creee?.id as string) ?? null
      }

      // 2) Propagation : les AUTRES débits « à trier » dont le libellé
      //    contient le motif sont triés du même coup (500 max par prudence).
      const motifLike = motifAppris.replace(/[\\%_]/g, (c) => `\\${c}`)
      const { data: autres, error: erreurAutres } = await supabase
        .from('banque_mouvements')
        .select('id')
        .eq('user_id', user.id) // jamais les mouvements d'un autre membre de l'entreprise
        .eq('statut_pointage', 'a_pointer')
        .is('deleted_at', null)
        .lt('montant', 0)
        .neq('id', mouvement.id)
        .ilike('libelle_banque', `%${motifLike}%`)
        .limit(500)
      if (erreurAutres) throw erreurAutres

      let majs: Mouvement[] = []
      const ids = (autres ?? []).map((a) => a.id as string)
      if (ids.length > 0) {
        const { data: pointes, error: erreurMaj } = await supabase
          .from('banque_mouvements')
          .update({
            categorie_id: categorieChoisie.id,
            statut_pointage: 'pointe',
            // Une règle vers la catégorie « prive » sort aussi le mouvement des totaux pro.
            est_prive: categorieChoisie.code === 'prive',
          })
          .in('id', ids)
          .select(MOUVEMENT_COLONNES)
        if (erreurMaj) throw erreurMaj
        majs = (pointes ?? []) as Mouvement[]
      }

      // 3) Compteur d'applications de la règle (best effort).
      if (regleId && majs.length > 0) {
        await supabase
          .from('categorisation_regles')
          .update({ nb_applications: nbApplications + majs.length })
          .eq('id', regleId)
      }

      if (majs.length > 0) {
        onAutresTriees(majs)
        toast.success(
          `Règle retenue ✓ — ${majs.length} autre${majs.length > 1 ? 's' : ''} opération${
            majs.length > 1 ? 's' : ''
          } « ${motifAppris} » triée${majs.length > 1 ? 's' : ''} du même coup.`,
        )
      } else {
        toast.success('Règle retenue ✓ — la prochaine fois, ce sera trié tout seul.')
      }
    } catch (e) {
      console.error('Apprentissage de la règle impossible', e)
      // Silencieux côté utilisateur : son pointage, lui, est bien enregistré.
    }
  }

  // ── Validation d'un DÉBIT ──
  async function validerDebit() {
    if (enregistrement) return
    setErreur(null)
    if (!categorieId) {
      setErreur('Choisissez une catégorie (ou un cas particulier en bas du panneau).')
      return
    }
    const taux = parseFloat(tauxTva)
    setEnregistrement(true)
    try {
      // 1) L'achat lié — LE seul chemin mouvement → achat → chantier.
      const nomChantier = chantierId
        ? chantiers.find((c) => c.id === chantierId)?.titre ?? null
        : null
      if (chantierId || achatLie) {
        const montantTtc = Math.round(Math.abs(mouvement.montant) * 100) / 100
        const montantHt = Math.round((montantTtc / (1 + taux / 100)) * 100) / 100
        const fournisseurNettoye = fournisseurTexte.trim()
        const fournisseurConnu = fournisseurNettoye
          ? fournisseurs.find((f) => f.nom.trim().toLowerCase() === fournisseurNettoye.toLowerCase())
          : undefined
        const valeursAchat: Record<string, unknown> = {
          date_achat: mouvement.date_operation,
          montant_ht: montantHt,
          taux_tva: taux,
          montant_ttc: montantTtc,
          description: (libellePerso.trim() || mouvement.libelle_banque).slice(0, 300),
          chantier_id: chantierId,
          categorie_id: categorieId,
          mouvement_id: mouvement.id,
          moyen_paiement: deduireMoyenPaiement(mouvement.libelle_banque, estCaisse),
          paye_sur_fonds: estCaisse ? 'caisse' : 'pro',
          fournisseur_id: fournisseurConnu?.id ?? null,
          fournisseur_libre: fournisseurConnu ? null : fournisseurNettoye || null,
        }
        if (achatLie) {
          await updateRow('achats', achatLie.id, valeursAchat)
        } else if (chantierId) {
          await insertRow('achats', valeursAchat)
        }
      }

      // 2) Le pointage du mouvement.
      const maj = await majMouvement({
        categorie_id: categorieId,
        libelle_perso: libellePerso.trim() || null,
        notes: notes.trim() || null,
        statut_pointage: 'pointe',
        nature: 'normal',
        est_prive: false,
      })

      if (nomChantier) {
        toast.success(`Achat créé et rattaché au chantier « ${nomChantier} » ✓`)
      } else {
        toast.success('C’est noté ✓')
      }

      // 3) Apprentissage (Lot 2c) : uniquement si la case est cochée, qu'un
      //    motif est exploitable ET que l'utilisateur a réellement choisi /
      //    corrigé la catégorie (confirmer une suggestion déjà correcte issue
      //    d'une règle ne crée rien — la règle existe déjà).
      const categorieChoisie = categorieMap.get(categorieId) ?? null
      if (
        retenirRegle &&
        motifAppris !== null &&
        categorieChoisie !== null &&
        categorieId !== mouvement.categorie_id
      ) {
        await apprendreEtPropager(categorieChoisie)
      }

      onPointe(maj)
    } catch (e) {
      console.error('Pointage du débit impossible', e)
      setErreur('Impossible d’enregistrer ce pointage. Réessayez.')
    } finally {
      setEnregistrement(false)
    }
  }

  // ── Validation d'un CRÉDIT : rapprochement facture via la RPC ──
  async function validerCredit() {
    if (enregistrement) return
    setErreur(null)
    if (!factureChoisie) {
      setErreur('Choisissez la facture que ce virement règle (ou un cas particulier en bas du panneau).')
      return
    }
    const montant = parserMontantSaisi(montantSaisiTexte)
    if (montant === null || montant <= 0) {
      setErreur('Le montant à pointer est illisible. Exemple : 1 200,00')
      return
    }
    if (montant > restantMouvement + 0.009) {
      setErreur(`Ce virement n’a plus que ${euros(restantMouvement)} à pointer.`)
      return
    }
    setEnregistrement(true)
    try {
      const { data, error } = await supabase.rpc('rpc_enregistrer_paiement', {
        p_facture_id: factureChoisie.id,
        p_montant: montant,
        p_date_paiement: mouvement.date_operation,
        // Encaissement en caisse = espèces (le CHECK de paiements.methode accepte
        // 'especes') ; sinon virement bancaire.
        p_methode: estCaisse ? 'especes' : 'virement',
        p_mouvement_id: mouvement.id,
      })
      if (error) {
        setErreur(mapPaiementRpcError(error.message))
        return
      }
      const res = data as PaiementRpcResult
      const numero = factureChoisie.numero ?? 'sans numéro'
      const nouveauAffecte = Math.round((dejaAffecte + montant) * 100) / 100
      const nouveauRestant = Math.max(0, Math.round((mouvement.montant - nouveauAffecte) * 100) / 100)

      if (nouveauRestant <= 0.009) {
        // Virement entièrement pointé → le mouvement passe en « pointé ».
        const resume =
          res.statut === 'payee'
            ? `Encaissement · Facture ${numero} réglée ✓`
            : `Encaissement · Acompte de ${euros(montant)} sur la facture ${numero} — reste dû ${euros(res.reste_du)}`
        const maj = await majMouvement({
          statut_pointage: 'pointe',
          notes: dejaAffecte > 0 ? `Encaissement · Ventilé sur plusieurs factures` : resume,
          nature: 'normal',
          est_prive: false,
        })
        toast.success(
          res.statut === 'payee'
            ? `Facture ${numero} réglée ✓`
            : `Paiement pointé sur la facture ${numero} ✓ Reste dû : ${euros(res.reste_du)}`,
        )
        onPointe(maj)
      } else {
        // Ventilation sur une 2ᵉ facture : on reste dans le panneau.
        setDejaAffecte(nouveauAffecte)
        setFactures((prec) =>
          prec
            .map((f) =>
              f.id === res.facture_id ? { ...f, montant_paye: res.montant_paye, statut: res.statut } : f,
            )
            .filter((f) => resteDuFacture(f) > 0.009),
        )
        setFactureChoisieId(null)
        setMontantSaisiTexte('')
        setAutresFacturesOuvert(true)
        toast.success(
          `${euros(montant)} pointés sur la facture ${numero} ✓ Il reste ${euros(nouveauRestant)} à pointer sur une autre facture.`,
        )
      }
    } catch (e) {
      console.error('Rapprochement facture impossible', e)
      setErreur('Impossible d’enregistrer le paiement. Réessayez.')
    } finally {
      setEnregistrement(false)
    }
  }

  // ── Recette sans facture (crédit) ──
  async function validerRecetteSansFacture(categorie: Categorie) {
    if (enregistrement) return
    setEnregistrement(true)
    setErreur(null)
    try {
      const maj = await majMouvement({
        categorie_id: categorie.id,
        statut_pointage: 'pointe',
        nature: 'normal',
        est_prive: false,
      })
      toast.success('C’est noté ✓')
      onPointe(maj)
    } catch (e) {
      console.error('Pointage de la recette impossible', e)
      setErreur('Impossible d’enregistrer ce pointage. Réessayez.')
    } finally {
      setEnregistrement(false)
    }
  }

  // ── Cas particuliers ──
  async function marquerRemboursement() {
    if (enregistrement) return
    setEnregistrement(true)
    setErreur(null)
    try {
      const maj = await majMouvement({
        nature: 'remboursement',
        statut_pointage: 'pointe',
        est_prive: false,
        categorie_id: categorieId,
      })
      toast.success('Marquée « Remboursement ou avoir » ✓ — elle vient en moins de la catégorie.')
      onPointe(maj)
    } catch (e) {
      console.error('Marquage remboursement impossible', e)
      setErreur('Impossible d’enregistrer. Réessayez.')
    } finally {
      setEnregistrement(false)
    }
  }

  async function marquerInterne() {
    if (enregistrement) return
    setEnregistrement(true)
    setErreur(null)
    try {
      const maj = await majMouvement({
        nature: 'virement_interne',
        statut_pointage: 'pointe',
        est_prive: false,
        categorie_id: categorieParCode('virement_interne')?.id ?? null,
      })
      toast.success('Marquée comme virement entre vos comptes ✓')
      onPointe(maj)
    } catch (e) {
      console.error('Marquage virement interne impossible', e)
      setErreur('Impossible d’enregistrer. Réessayez.')
    } finally {
      setEnregistrement(false)
    }
  }

  async function marquerPerso() {
    if (enregistrement) return
    setEnregistrement(true)
    setErreur(null)
    try {
      const maj = await majMouvement({
        est_prive: true,
        statut_pointage: 'pointe',
        nature: 'normal',
        categorie_id: categorieParCode('prive')?.id ?? null,
      })
      toast.success('Marquée « Perso » ✓ — exclue de vos chiffres pro.')
      onPointe(maj)
    } catch (e) {
      console.error('Marquage perso impossible', e)
      setErreur('Impossible d’enregistrer. Réessayez.')
    } finally {
      setEnregistrement(false)
    }
  }

  // ── Justificatif (mode immédiat : le mouvement existe déjà) ──
  async function surJustificatifChange(path: string | null) {
    const maj = await majMouvement({ justificatif_path: path })
    onMaj(maj)
  }

  // ── Rendu ──
  const chipCls = (selectionne: boolean) =>
    `inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-full border-[1.5px] text-[13px] font-semibold transition ${
      selectionne
        ? 'bg-navy border-navy text-white'
        : 'bg-white border-gray-200 text-gray-700 hover:border-sky'
    }`

  return (
    <>
      <div className="fixed inset-0 bg-navy/40 z-40" onClick={onClose} aria-hidden="true" />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col font-hanken"
        role="dialog"
        aria-modal="true"
        aria-label="Pointage de l’opération"
      >
        {/* ── En-tête ── */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-start gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p
              className={`font-spline-mono font-bold text-[28px] leading-tight tracking-[0.5px] ${
                mouvement.montant > 0 ? 'text-green-700' : 'text-navy'
              }`}
            >
              {montantSigne(mouvement.montant)}
            </p>
            <p className="text-[15px] font-bold text-navy mt-1">
              {mouvement.libelle_perso || mouvement.libelle_banque}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 break-words">{mouvement.libelle_banque}</p>
            <p className="text-[12px] text-gray-500 mt-1">
              <span className="font-spline-mono">{dateFr(mouvement.date_operation)}</span> ·{' '}
              {compte ? compte.nom : 'Compte'} —{' '}
              {mouvement.source === 'manuel' ? 'saisie manuelle' : 'relevé importé'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
            aria-label="Fermer le panneau"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* ── Corps ── */}
        <div className="flex-1 overflow-y-auto">
          {erreur && (
            <div className="mx-5 mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-[13px] text-red-800" role="alert">
              {erreur}
            </div>
          )}

          {chargement ? (
            <div className="flex items-center justify-center py-16 text-gray-400" role="status" aria-live="polite">
              <Loader2 size={20} className="animate-spin mr-2" aria-hidden="true" />
              <span className="text-sm font-semibold">Un instant…</span>
            </div>
          ) : estDebit ? (
            <>
              {/* ── Catégorie ── */}
              <div className="px-5 pt-4 pb-2">
                <p className="font-hanken font-bold text-[15px] text-navy mb-1">C’est quoi cette dépense&nbsp;?</p>
                <p className="text-[12px] text-gray-500 mb-2">On pense à&nbsp;:</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Catégorie de la dépense">
                  {suggestionsCategories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCategorieId(c.id)
                        setAutresCategoriesOuvert(false)
                      }}
                      aria-pressed={categorieId === c.id}
                      className={chipCls(categorieId === c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                  {categorieId &&
                    !suggestionsCategories.some((c) => c.id === categorieId) &&
                    categorieMap.get(categorieId) && (
                      <button aria-pressed="true" className={chipCls(true)}>
                        {categorieMap.get(categorieId)!.label}
                      </button>
                    )}
                  <button
                    onClick={() => setAutresCategoriesOuvert((v) => !v)}
                    aria-expanded={autresCategoriesOuvert}
                    className={chipCls(false)}
                  >
                    Autre…
                  </button>
                </div>

                {autresCategoriesOuvert && (
                  <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="relative border-b border-gray-100">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input
                        type="text"
                        value={rechercheCategorie}
                        onChange={(e) => setRechercheCategorie(e.target.value)}
                        placeholder="Rechercher une catégorie…"
                        aria-label="Rechercher une catégorie"
                        className="w-full h-10 pl-8 pr-3 text-[13px] focus:outline-none"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                      {categoriesDepense.length === 0 ? (
                        <p className="px-3 py-3 text-[12.5px] text-gray-500">Aucune catégorie ne correspond.</p>
                      ) : (
                        categoriesDepense.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setCategorieId(c.id)
                              setAutresCategoriesOuvert(false)
                              setRechercheCategorie('')
                            }}
                            className={`w-full text-left px-3 py-2.5 text-[13px] font-semibold hover:bg-gray-50 transition ${
                              categorieId === c.id ? 'text-orange' : 'text-navy'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* ── Apprentissage : « Retenir pour les prochaines fois » ──
                    Visible dès que l'utilisateur choisit/corrige la catégorie
                    (pas quand il confirme une suggestion déjà correcte). */}
                {motifAppris && categorieId && categorieId !== mouvement.categorie_id && (
                  <label className="mt-3 flex items-start gap-2.5 cursor-pointer select-none rounded-xl bg-cream/60 border border-gold/40 px-3.5 py-2.5">
                    <input
                      type="checkbox"
                      checked={retenirRegle}
                      onChange={(e) => setRetenirRegle(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-orange"
                    />
                    <span className="text-[12.5px] text-gray-600">
                      <span className="block font-hanken font-semibold text-navy">
                        Retenir pour les prochaines fois
                      </span>
                      <span className="block text-[11.5px] text-gray-500 mt-0.5">
                        Les opérations «&nbsp;{motifAppris}&nbsp;» seront triées toutes seules — y compris
                        celles qui attendent déjà.
                      </span>
                    </span>
                  </label>
                )}
              </div>

              {/* ── Chantier ── */}
              <div className="px-5 pt-4 pb-2">
                <p className="font-hanken font-bold text-[15px] text-navy mb-1">Pour quel chantier&nbsp;?</p>
                <p className="text-[12px] text-gray-500 mb-2">
                  En choisissant un chantier, Nexartis crée l’achat correspondant et l’y rattache — c’est lui
                  qui compte dans la rentabilité.
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Chantier de la dépense">
                  {chantiers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChantierId(c.id)}
                      aria-pressed={chantierId === c.id}
                      className={chipCls(chantierId === c.id)}
                    >
                      🏠 {c.titre || 'Chantier sans titre'}
                    </button>
                  ))}
                  <button
                    onClick={() => setChantierId(null)}
                    aria-pressed={chantierId === null}
                    className={chipCls(chantierId === null)}
                  >
                    Aucun / frais généraux
                  </button>
                </div>

                {/* Mini-formulaire de l'achat qui sera créé */}
                {(chantierId || achatLie) && (
                  <div className="mt-3 rounded-xl bg-sky/5 border border-sky/40 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/60 mb-2">
                      {achatLie ? 'L’achat lié sera mis à jour' : 'L’achat qui sera créé'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-navy/80 mb-2">
                      <span>
                        Montant&nbsp;: <strong className="font-spline-mono">{euros(Math.abs(mouvement.montant))}</strong>
                      </span>
                      <span>
                        Date&nbsp;: <strong className="font-spline-mono">{dateFr(mouvement.date_operation)}</strong>
                      </span>
                    </div>
                    <label htmlFor="pointage-fournisseur" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Fournisseur (facultatif)
                    </label>
                    <input
                      id="pointage-fournisseur"
                      type="text"
                      value={fournisseurTexte}
                      onChange={(e) => setFournisseurTexte(e.target.value)}
                      maxLength={120}
                      placeholder="Rexel, Brico Cash…"
                      className="w-full h-10 px-3 rounded-lg border-[1.5px] border-gray-200 bg-white text-[13px] focus:outline-none focus:border-sky transition mb-2"
                    />
                    <label htmlFor="pointage-tva" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      TVA
                    </label>
                    <select
                      id="pointage-tva"
                      value={tauxTva}
                      onChange={(e) => setTauxTva(e.target.value)}
                      className="h-10 px-3 rounded-lg border-[1.5px] border-gray-200 bg-white text-[13px] font-semibold text-navy focus:outline-none focus:border-sky transition"
                    >
                      <option value="0">0&nbsp;% (franchise / autoliquidation)</option>
                      <option value="5.5">5,5&nbsp;%</option>
                      <option value="10">10&nbsp;%</option>
                      <option value="20">20&nbsp;%</option>
                    </select>
                  </div>
                )}
              </div>

              {/* ── Justificatif ── */}
              <div className="px-5 pt-4 pb-2">
                <p className="font-hanken font-bold text-[15px] text-navy mb-2">Justificatif</p>
                <JustificatifUpload
                  path={mouvement.justificatif_path}
                  entite="mouvement"
                  entiteId={mouvement.id}
                  onPathChange={surJustificatifChange}
                />
              </div>

              {/* ── Libellé perso + notes ── */}
              <div className="px-5 pt-3 pb-2">
                {!detailsOuverts ? (
                  <button
                    onClick={() => setDetailsOuverts(true)}
                    className="text-[13px] text-gray-500 underline underline-offset-2 hover:text-navy transition min-h-[32px]"
                  >
                    + Libellé personnalisé, notes (facultatif)
                  </button>
                ) : (
                  <>
                    <label htmlFor="pointage-libelle" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Libellé personnalisé
                    </label>
                    <input
                      id="pointage-libelle"
                      type="text"
                      value={libellePerso}
                      onChange={(e) => setLibellePerso(e.target.value)}
                      maxLength={140}
                      placeholder="Ex. Gaine + disjoncteurs — Rexel"
                      className="w-full h-10 px-3 rounded-lg border-[1.5px] border-gray-200 text-[13px] focus:outline-none focus:border-sky transition mb-3"
                    />
                    <label htmlFor="pointage-notes" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Notes
                    </label>
                    <textarea
                      id="pointage-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="Un détail à ne pas oublier…"
                      className="w-full px-3 py-2 rounded-lg border-[1.5px] border-gray-200 text-[13px] focus:outline-none focus:border-sky transition resize-none"
                    />
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ── Rapprochement facture (crédit) ── */}
              <div className="px-5 pt-4 pb-2">
                <p className="font-hanken font-bold text-[15px] text-navy mb-1">
                  À quelle facture correspond ce virement&nbsp;?
                </p>
                {dejaAffecte > 0 && (
                  <p className="text-[12px] font-semibold text-orange mb-1">
                    Déjà pointé sur ce virement&nbsp;: {euros(dejaAffecte)} — il reste {euros(restantMouvement)}.
                  </p>
                )}

                {factures.length === 0 ? (
                  <p className="text-[13px] text-gray-500 mt-2">
                    Aucune facture en attente de paiement. Si ce virement est une recette, utilisez «&nbsp;C’est
                    une recette sans facture&nbsp;» ci-dessous — sinon, un cas particulier.
                  </p>
                ) : (
                  <>
                    {factureSuggeree && factureChoisieId === factureSuggeree.id && (
                      <p className="text-[12px] text-gray-500 mb-2">
                        Ce virement de {euros(mouvement.montant)} ressemble à un règlement de{' '}
                        <strong>{nomClient(factureSuggeree.client_id) ?? 'ce client'}</strong>. On pense à cette
                        facture&nbsp;:
                      </p>
                    )}

                    {/* Carte de la facture choisie — détail multi-acomptes */}
                    {factureChoisie && (
                      <div className="rounded-xl border-2 border-sky bg-sky/5 p-4">
                        <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                          <p className="font-bold text-[13.5px] text-navy">
                            Facture {factureChoisie.numero ?? 'sans numéro'}
                            {factureChoisie.objet ? ` — ${factureChoisie.objet}` : ''}
                          </p>
                          {nomClient(factureChoisie.client_id) && (
                            <span className="inline-flex items-center px-2 py-px rounded-full bg-sky/15 text-navy text-[11px] font-semibold">
                              {nomClient(factureChoisie.client_id)}
                            </span>
                          )}
                        </div>
                        <div className="text-[12.5px] space-y-1.5 text-navy">
                          <p className="flex justify-between gap-3">
                            <span className="text-gray-500">Total de la facture</span>
                            <span className="font-spline-mono">{euros(factureChoisie.montant_ttc)}</span>
                          </p>
                          {factureChoisie.avoir_impute_montant > 0 && (
                            <p className="flex justify-between gap-3">
                              <span className="text-gray-500">Avoir imputé</span>
                              <span className="font-spline-mono">− {euros(factureChoisie.avoir_impute_montant)}</span>
                            </p>
                          )}
                          <p className="flex justify-between gap-3">
                            <span className="text-gray-500">Déjà reçu</span>
                            <span className="font-spline-mono">{euros(factureChoisie.montant_paye)}</span>
                          </p>
                          <div className="flex justify-between items-center gap-3">
                            <label htmlFor="pointage-montant" className="text-gray-500">
                              Ce virement
                            </label>
                            <input
                              id="pointage-montant"
                              type="text"
                              inputMode="decimal"
                              value={montantSaisiTexte}
                              onChange={(e) => setMontantSaisiTexte(e.target.value)}
                              aria-label="Montant à pointer sur cette facture, en euros"
                              className="w-32 h-9 px-2 rounded-lg border-[1.5px] border-gray-200 bg-white text-right font-spline-mono text-[13px] font-bold text-green-700 focus:outline-none focus:border-sky transition"
                            />
                          </div>
                          <hr className="border-sky/30" />
                          <p className="flex justify-between gap-3 font-bold">
                            <span>Reste dû après pointage</span>
                            <span className="font-spline-mono">
                              {(() => {
                                const saisi = parserMontantSaisi(montantSaisiTexte) ?? 0
                                return euros(Math.max(0, Math.round((resteDuFacture(factureChoisie) - saisi) * 100) / 100))
                              })()}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setAutresFacturesOuvert((v) => !v)}
                      aria-expanded={autresFacturesOuvert}
                      className="mt-2 text-[13px] text-gray-600 underline underline-offset-2 hover:text-navy transition min-h-[32px] text-left"
                    >
                      {factureChoisie
                        ? 'Non, c’est pour une autre facture'
                        : 'Choisir la facture que ce virement règle'}
                    </button>

                    {autresFacturesOuvert && (
                      <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
                        <div className="relative border-b border-gray-100">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                          <input
                            type="text"
                            value={rechercheFacture}
                            onChange={(e) => setRechercheFacture(e.target.value)}
                            placeholder="N° de facture, client…"
                            aria-label="Rechercher une facture"
                            className="w-full h-10 pl-8 pr-3 text-[13px] focus:outline-none"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                          {facturesFiltrees.length === 0 ? (
                            <p className="px-3 py-3 text-[12.5px] text-gray-500">
                              Aucune facture en attente ne correspond.
                            </p>
                          ) : (
                            facturesFiltrees.map((f) => (
                              <button
                                key={f.id}
                                onClick={() => choisirFacture(f)}
                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition flex items-center gap-3"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-bold text-navy truncate">
                                    {f.numero ?? 'Sans numéro'}
                                    {nomClient(f.client_id) ? ` · ${nomClient(f.client_id)}` : ''}
                                  </span>
                                  <span className="block text-[11.5px] text-gray-500 truncate">
                                    {f.objet || (f.date_emission ? `Émise le ${dateFr(f.date_emission)}` : '')}
                                  </span>
                                </span>
                                <span className="text-[12.5px] font-bold text-navy flex-shrink-0">
                                  reste <span className="font-spline-mono">{euros(resteDuFacture(f))}</span>
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Recette sans facture */}
                <button
                  onClick={() => setRecetteSansFactureOuvert((v) => !v)}
                  aria-expanded={recetteSansFactureOuvert}
                  className="mt-2 block text-[13px] text-gray-600 underline underline-offset-2 hover:text-navy transition min-h-[32px] text-left"
                >
                  C’est une recette sans facture
                </button>
                {recetteSansFactureOuvert && (
                  <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Type de recette">
                    {categoriesRecette.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => void validerRecetteSansFacture(c)}
                        disabled={enregistrement}
                        className={chipCls(false)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Cas particuliers ── */}
          {!chargement && (
            <div className="px-5 pt-3 pb-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Cas particuliers
              </p>
              <div className="flex flex-col items-start gap-1.5">
                <button
                  onClick={() => void marquerRemboursement()}
                  disabled={enregistrement}
                  className="text-[13px] text-gray-600 underline underline-offset-2 hover:text-navy transition min-h-[32px] text-left"
                >
                  C’est un remboursement ou un avoir
                </button>
                <button
                  onClick={() => void marquerInterne()}
                  disabled={enregistrement}
                  className="text-[13px] text-gray-600 underline underline-offset-2 hover:text-navy transition min-h-[32px] text-left"
                >
                  C’est un virement entre mes comptes
                </button>
                <button
                  onClick={() => void marquerPerso()}
                  disabled={enregistrement}
                  className="text-[13px] text-gray-600 underline underline-offset-2 hover:text-navy transition min-h-[32px] text-left"
                >
                  C’est perso
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Pied ── */}
        <div className="border-t border-gray-100 p-4 flex-shrink-0">
          {modeFile && resteATrier > 0 && (
            <p className="text-center text-[12px] font-bold text-orange mb-2" aria-live="polite">
              Plus que {resteATrier} à trier
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => void (estDebit ? validerDebit() : validerCredit())}
              disabled={enregistrement || chargement}
              className="flex-1 h-12 rounded-xl bg-orange hover:bg-orange-hover disabled:opacity-60 text-white font-bold transition inline-flex items-center justify-center gap-2"
            >
              {enregistrement && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {modeFile ? 'C’est noté ✓' : 'Enregistrer'}
            </button>
            {modeFile && (
              <button
                onClick={onPasser}
                disabled={enregistrement}
                className="h-12 px-4 rounded-xl border-[1.5px] border-gray-200 font-semibold text-sm text-gray-500 hover:border-gray-300 disabled:opacity-60 transition"
              >
                Passer
              </button>
            )}
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-2">Vous pourrez toujours modifier plus tard.</p>
        </div>
      </aside>
    </>
  )
}
