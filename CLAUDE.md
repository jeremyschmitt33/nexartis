# Nexartis — Instructions pour Claude

## Profil de l'utilisateur

L'utilisateur (jeremy) **n'a jamais programmé**. Il faut donc :
- Expliquer chaque terme technique en français simple (entre parenthèses).
- Donner les commandes PowerShell exactes prêtes à copier-coller.
- Décrire précisément où cliquer dans Vercel / Supabase / GitHub (pas juste "va dans les settings").
- Anticiper les erreurs probables et les solutions associées.

L'utilisateur est intransigeant sur la qualité : il ne veut **plus jamais** voir un bug en production. Tout livrable doit être audité, double-vérifié, et présenté comme tel.

## Stack technique

- **Framework** : Next.js 14 App Router + React 18 + TypeScript
- **Style** : Tailwind CSS, palette définie dans `tailwind.config.ts` (`navy`, `sky`, `orange`, `gold`, `cream`)
- **Polices** : Syne (display), Manrope (body), Plus Jakarta Sans (alternative)
- **Auth + DB** : Supabase (multi-tenant via RLS, filtre `user_id = auth.uid()`)
- **Paiements** : Stripe (webhook `/api/stripe/webhook`)
- **PDFs** : jsPDF + jspdf-autotable (générateurs dans `lib/pdf*.ts`)
- **Déploiement** : Vercel (auto-deploy sur push `master`)

## Conventions du projet

### Routing & layout
- `app/layout.tsx` injecte un layout global via `<ConditionalLayout header={<Header />} footer={<Footer />}>`.
- `components/ConditionalLayout.tsx` contient une **liste HIDDEN_ROUTES** des routes où le header et le footer ne s'affichent PAS (`/dashboard`, `/onboarding`, `/login`, `/register`, `/auth`, `/signer`, `/maintenance`).
- **Toute nouvelle page standalone (page d'erreur, page promo isolée, page légale autonome) doit être ajoutée à `HIDDEN_ROUTES`** si elle ne doit pas hériter du header/footer marketing.

### Middleware
- `middleware.ts` (racine) délègue à `lib/supabase/middleware.ts` pour l'auth, mais intercepte d'abord le mode maintenance (variable `MAINTENANCE_MODE`).
- Le matcher est `['/((?!_next/static|_next/image|.*\\..*).*)']` (intercepte tout sauf assets statiques).
- Le webhook Stripe `/api/stripe/webhook` doit toujours rester accessible, y compris en maintenance.

### Mode maintenance
- Activer/désactiver via la variable Vercel `MAINTENANCE_MODE=true|false` puis redéployer.
- Bypass admin via URL secrète : `/api/maintenance-bypass?secret=<MAINTENANCE_BYPASS_SECRET>`.
- Doc complète : voir `MAINTENANCE_MODE.md` à la racine.

### Base de données
- Toutes les tables sensibles doivent avoir RLS activée + policies SELECT/INSERT/UPDATE/DELETE.
- ⚠️ **Pattern RLS à jour (12/07/2026, vérifié en prod)** : les tables financières (achats, paiements, factures, factures_recues, comptes_tresorerie, banque_*) utilisent `entreprise_of_user(user_id) IN (SELECT current_entreprise_ids()) AND current_role_in(entreprise_of_user(user_id)) = 'dirigeant'` — PAS le vieux `user_id = auth.uid()` seul. Toute nouvelle table financière réplique ce pattern (modèle : les policies live de `achats`).
- Les encaissements de factures passent par les RPC `rpc_enregistrer_paiement` / `rpc_annuler_paiement` (source de vérité = table `paiements`, `factures.montant_paye` = simple cache). Ne jamais écrire `montant_paye` directement dans du NOUVEAU code (3 écritures legacy encore à migrer : factures/[id]/page.tsx ×2, lib/services/cop-facture.ts, route d'import).
- Soft delete via colonne `deleted_at TIMESTAMPTZ` + filtre `WHERE deleted_at IS NULL` côté code.
- Architecture détaillée : voir `ARCHITECTURE_LIAISONS.md`.

### Templates PDF / HTML
- ⚠️ Risque de divergence connu : le même devis/facture peut être rendu en 4 endroits (HTML dashboard, PDF download, PDF email, page `/signer/[token]`) et ces 4 rendus doivent rester strictement identiques. Toute modification de l'un doit être répliquée sur les 3 autres, ou idéalement extraite dans un composant/helper partagé.
- Mentions légales obligatoires françaises (devis + facture) : voir checklist dans `audit-pdf-html.md` (dans le dossier outputs).

### Sécurité — non-négociable
- Utiliser `lib/api-security.ts` sur toute nouvelle route API (auth + rate-limit + validation).
- Toujours utiliser `getUser()` (sécurisé), jamais `getSession()` côté serveur.
- Routes admin : vérifier le rôle admin (ne PAS se baser sur l'email seul).
- Webhook Stripe : vérifier la signature avec `stripe.webhooks.constructEvent` + table d'idempotence pour éviter les rejeux.
- Tokens publics (signature de devis) : UUID v4 + expiration + un seul usage.

## Règles de méthode pour Claude

### ⚠️ Avant de créer ou modifier un fichier dans ce projet

**Toujours d'abord lire les fichiers suivants** (au moins une fois par session de travail) pour comprendre les conventions :

1. `app/layout.tsx` — pour comprendre quoi est injecté globalement (header, footer, providers, analytics).
2. `components/ConditionalLayout.tsx` — pour savoir comment les pages standalone sont gérées.
3. `middleware.ts` + `lib/supabase/middleware.ts` — pour comprendre l'auth, les redirections et le mode maintenance.
4. `tailwind.config.ts` — pour utiliser les couleurs et polices officielles du projet (PAS de hex hardcodés).
5. `lib/supabase/client.ts` et `lib/supabase/server.ts` — pour utiliser le bon client Supabase selon le contexte (client vs serveur).
6. `lib/api-security.ts` — pour appliquer la sécurisation standard sur toute nouvelle route API.

### Checklist obligatoire avant de proposer une nouvelle page Next.js

- [ ] Le layout global injecte-t-il un header/footer ? Si oui, dois-je l'exclure pour cette page (ajouter à `HIDDEN_ROUTES`) ?
- [ ] La page nécessite-t-elle l'auth ? Si oui, le middleware la couvre-t-il déjà ?
- [ ] Utilise-t-elle les couleurs Tailwind du `tailwind.config.ts` (navy, sky, orange, gold, cream) plutôt que des hex hardcodés ?
- [ ] Utilise-t-elle les polices déclarées (`font-syne`, `font-manrope`, `font-jakarta`) ?
- [ ] Si elle expose une route API : passe-t-elle par `lib/api-security.ts` ?
- [ ] Si elle interroge Supabase : RLS bien configurée sur la table cible ?
- [ ] Metadata SEO renseignée (`title`, `description`, `robots` si page privée) ?
- [ ] Responsive testé mentalement à 375px (mobile) ?
- [ ] Accessibilité de base : `alt` sur images, `aria-label` sur boutons icône, contraste 4.5:1 ?

### Checklist obligatoire avant de proposer une nouvelle route API

- [ ] Auth utilisateur vérifiée via `lib/api-security.ts` ou `getUser()` ?
- [ ] Vérification de propriété de la ressource (`user_id = current user`) ?
- [ ] Validation des inputs (zod ou validation manuelle stricte) ?
- [ ] Rate limit appliqué ?
- [ ] Gestion d'erreur (try/catch + status codes corrects : 400/401/403/404/409/500) ?
- [ ] Pas de fuite de données dans les erreurs (`error.message` brut → mauvais) ?
- [ ] Logs côté serveur (pas dans le navigateur client) ?
- [ ] Timeout Vercel respecté (10s hobby, 60s pro) si génération PDF/email/import ?
- [ ] Idempotence si POST/webhook ?

### Quand le user push une modif

- Lui rappeler **où** est-ce qu'il faut push depuis (toujours `C:\Users\monbi.DESKTOP-F25M7C8\Desktop\CLAUDE\Nexartis`).
- Donner les commandes PowerShell exactes copier-coller (pas de pseudo-code).
- Lui dire ce qu'il devrait voir s'afficher pour confirmer le succès.
- Lister les erreurs probables et leur solution.
- Vérifier que Vercel a bien redéployé en "Ready" (vert) avant de continuer.

### Quand on touche au mode maintenance

- Toujours rappeler à l'utilisateur :
  1. De pousser le code AVANT d'activer Vercel (sinon l'activation foire).
  2. De tester en navigation privée pour voir ce que les visiteurs voient.
  3. De récupérer son cookie de bypass via l'URL secrète pour ne pas se bloquer lui-même.
  4. De renouveler le bypass tous les 7 jours.

## Documents de référence dans ce projet

- `ARCHITECTURE_LIAISONS.md` : architecture métier (Devis → Chantier → Planning → Facture → Paiement).
- `ARTIDOC_CHARTE_EDITORIALE.md` : ton de voix de Nexartis.
- `ARTIDOC_SECURITY_FIX.md` : historique des correctifs sécurité (lire avant de toucher à l'auth).
- `STRIPE-LIVE-GUIDE.md` : configuration Stripe production.
- `MAINTENANCE_MODE.md` : utilisation du mode maintenance.
- `GUIDE_IMPLEMENTATION.md` : conventions de code.
- `FEATURE_CRENEAUX_HORAIRES.md` : spécifs planning.

## Rapports d'audit (dans le dossier outputs Cowork)

- `audit-securite.md` : failles sécurité (RLS, secrets, auth)
- `audit-backend-metier.md` : bugs backend, calculs, conformité légale française
- `audit-frontend.md` : bugs comportementaux des pages React
- `audit-pdf-html.md` : divergences entre rendus PDF et HTML
- `audit-ux-accessibilite.md` : WCAG, touch, responsive
- `audit-design-visuel.md` : cohérence visuelle, identité de marque

**À lire AVANT de toucher au code concerné** pour ne pas réintroduire un bug connu.
