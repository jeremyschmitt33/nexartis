# Idée — Devis à partir d'une photo (notée le 11/07/2026 — ÉTUDE DE FAISABILITÉ FAITE, développement NON commencé)

> **Étude complète du 11/07/2026 dans `docs/devis-photo/`** (`etude-devis-photo.md` +
> `confrontation-devis-photo.md`). Verdict du confrontateur : **GO AVEC RÉSERVES** —
> ~60 % de l'infra existe déjà (pipeline du devis vocal : IA → JSON validé →
> pré-remplissage du formulaire ; upload R2 privé ; `maxDuration=60` déjà en prod).
> Coût estimé ~0,05 €/photo (≈3,5 % du MRR à intégrer au pricing, offre Complet = 25 € HT).
> Effort réaliste : 15-18 jours. Reste à trancher par jeremy : calendrier (la file de
> priorités place cette feature APRÈS l'import Daniela, le module Dépenses & Banque et
> l'idempotence), choix du fournisseur IA via banc d'essai comparatif Claude vs Gemini
> (1,5 j, ~2 €, seule action lançable dès maintenant), et quota/essai gratuit.

## Le concept

L'artisan prend en photo ses notes de chantier — même brouillonnes, écrites à la main
sur une feuille de papier — et Nexartis en extrait les informations (client, prestations,
quantités, prix) pour pré-remplir un devis propre au format Nexartis.

**Valeur ajoutée** : c'est exactement le quotidien d'un artisan (griffonnage sur le
chantier → devis propre le soir). Aucun concurrent type Clementine ne le fait bien.

## Exigence de rigueur (non négociable, comme pour l'import Clementine)

- **Jamais de devis envoyé automatiquement** : la photo pré-remplit un BROUILLON que
  l'artisan relit et valide ligne par ligne avant tout envoi.
- **Signaler l'incertitude** : toute info illisible ou ambiguë (chiffre douteux, mot
  incertain) doit être marquée visuellement "à vérifier", jamais inventée en silence.
- **Réconciliation des montants** : si la photo contient un total, le comparer au total
  recalculé des lignes extraites ; en cas d'écart, alerter.
- **Rattachement intelligent** : réutiliser la logique de l'import Clementine —
  reconnaître un client existant plutôt que créer un doublon.
- **TVA** : respecter le régime du compte (ex. franchise = 0 %), pas de taux deviné.
- **Méthode de dev** : équipe d'agents (expert DB, vérificateur, confrontateur),
  brainstorming préalable, audit avant push, test bout-en-bout sur cas réels
  (photos floues, écritures difficiles, notes partielles).

## Inventaire EXHAUSTIF des données à capter sur le papier (rien ne doit être perdu)

Une note manuscrite d'artisan peut contenir bien plus que des lignes de prestations.
L'extraction doit chercher TOUTES les catégories ci-dessous, et lister à la fin ce
qu'elle a trouvé + ce qu'elle n'a pas su lire :

**1. Le client**
- Nom / prénom / société, téléphone, email, adresse du client
- Adresse du chantier si différente (très fréquent)

**2. Les prestations et le chiffrage**
- Désignation de chaque poste (même abrégée : "tableau élec", "3 PC cuisine"…)
- Quantités et unités (m², ml, U, forfait, heures)
- Prix unitaires ET prix totaux par ligne s'ils sont notés
- Remises, gestes commerciaux ("-10%", "offert")
- Main d'œuvre vs fourniture si distinguées
- Totaux intermédiaires et TOTAL général → **réconciliation obligatoire** :
  recalculer lignes vs total noté, alerter au moindre écart au centime

**3. Les conditions financières et bancaires**
- Acompte demandé (montant ou %, ex. "30% à la commande")
- Échéancier ("moitié au démarrage, solde fin de chantier")
- Mode de paiement évoqué (virement, chèque, espèces, CB)
- **IBAN / RIB noté sur le papier** : le détecter, mais NE JAMAIS l'écrire en clair
  dans le devis ni le stocker en base applicative (donnée sensible → même règle
  que les CNI/RIB de l'import Clementine : coffre-fort chiffré uniquement)
- Références de paiements déjà reçus ("a déjà versé 200 €")

**4. Le contexte chantier**
- Dates évoquées (début souhaité, durée estimée, date de la note)
- Contraintes techniques (accès, hauteur, existant à déposer…)
- Croquis / dimensions dessinées : signaler leur présence, joindre la photo
  au devis en pièce jointe (on n'essaie pas d'interpréter un dessin en V1)

**5. Cas tordus à gérer dès la conception**
- PLUSIEURS ventes/clients sur la même feuille → détecter et proposer de
  scinder en plusieurs devis, jamais tout fusionner en silence
- Ratures et corrections (le chiffre barré n'est pas le bon)
- Unités implicites ("12 spots" = quantité 12, unité U)
- Prix TTC vs HT ambigus → en franchise TVA c'est identique, mais si le compte
  est assujetti, demander confirmation au lieu de deviner
- Numéros de téléphone/SIRET partiels : compléter depuis la fiche client
  existante si le client est reconnu, sinon marquer "à compléter"

## Pistes techniques (à creuser au démarrage, rien de décidé)

- Extraction via un modèle de vision (API Claude ou équivalent) plutôt qu'un OCR
  classique : meilleure lecture du manuscrit et compréhension du contexte.
- Coût par photo à chiffrer → peut justifier une limite ou une option payante.
- Entrée : photo depuis mobile (le dashboard doit être irréprochable à 375 px).
- Sortie : réutiliser le formulaire de devis existant en mode "pré-rempli", pas un
  nouveau moteur de devis.

## Priorité

Après : (1) import réel sur le compte de Daniela, (2) Mission 2 — onglet
Dépenses / Banque (V1 import CSV), (3) idempotence + rapport d'import.
