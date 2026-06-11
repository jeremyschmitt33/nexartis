# Factur-X — Architecture & état d'avancement

> Document de référence pour la fonctionnalité **facture électronique Factur-X**.
> À lire avant toute reprise du chantier. Mis à jour le **11 juin 2026**.

## 1. Pourquoi (contexte légal, vérifié juin 2026)

La réforme française de la facturation électronique impose un format structuré :

- **1ᵉʳ septembre 2026** : *toutes* les entreprises assujetties à la TVA doivent pouvoir **recevoir** une facture électronique. Les **grandes entreprises et ETI** doivent aussi **émettre**.
- **1ᵉʳ septembre 2027** : les **TPE / PME / micro-entreprises** (le cœur de cible de Nexartis : les artisans) doivent à leur tour **émettre**.

Donc pour nos utilisateurs, l'obligation d'**émettre** tombe en **septembre 2027**, mais être prêt dès 2026 est un argument commercial fort (les concurrents le sont déjà).

L'émission/réception passera par une **plateforme agréée (PDP)** ou le portail public. Cette transmission est une **phase ultérieure** ; ce module couvre d'abord la **génération du document conforme**.

## 2. Quel format

**Factur-X** = un fichier **PDF/A-3** (lisible par l'humain) qui contient en pièce jointe un **XML CII** (lisible par les machines), conforme à la norme européenne **EN 16931**.

Cinq profils existent. On vise **EN 16931 (COMFORT)**, le profil de référence pour le B2B et le Factur-X français. (Les profils MINIMUM et BASIC WL ne sont **pas** considérés comme des factures valides en France.)

## 3. Audit concurrence (conclusion : on s'aligne)

Tolteck, Obat, Henrri génèrent tous du Factur-X nativement et s'adossent à une plateforme agréée (Tolteck PA intégrée, Obat via Iopole, Henrri via PA). Le Factur-X est donc devenu un **standard obligatoire** : on **s'aligne** sur le format. La différenciation se jouera ailleurs (fluidité d'usage, anticipation, intégration PDP transparente), dans une phase ultérieure.

## 4. Choix technique

- **Librairie : `node-zugferd`** (version épinglée `0.1.1-beta.1`). TypeScript pur, génère le XML CII, l'embarque en PDF/A-3b, supporte tous les profils.
- **Pas de dépendance Java en production.** node-zugferd peut valider le XML via un outil Java (`xsd-schema-validator`), mais cette dépendance est **optionnelle** et l'instance est configurée avec **`strict: false`** (voir `lib/facturx/invoicer.ts`) : en production on se contente de **produire** le XML/PDF, jamais de le valider via Java. Le build Vercel n'est donc pas impacté (l'échec éventuel d'une dépendance optionnelle est non-bloquant). La validation de conformité se fait **hors production** (voir §7).

## 5. Le code livré (`lib/facturx/`)

| Fichier | Rôle |
|---|---|
| `units.ts` | Table de correspondance unités Nexartis (« U », « m² », « h »…) → codes d'unité normalisés UN/ECE Rec 20 (BT-130). |
| `invoicer.ts` | Instance node-zugferd sur le profil EN 16931, `strict:false`. Expose le type des données attendues. |
| `mapping.ts` | **Cœur métier** : traduit une `FactureData` Nexartis → structure EN 16931 (chaque champ mappé sur un Business Term BT-xx). Gère B2B, B2C, autoliquidation BTP, franchise TVA. Recalcule les totaux depuis les lignes pour garantir la cohérence arithmétique (règles BR-CO-*). |
| `index.ts` | API publique : `genererFacturXml(facture)` → XML, et `embarquerFacturX(pdf, facture)` → PDF/A-3 hybride. |

**État : module de FONDATION, non branché.** Aucune route API ne l'importe pour l'instant → **aucun impact sur la production** tant que le branchement (§6) n'est pas fait. Le `package.json` déclare la dépendance ; le code compile sous TypeScript strict (0 erreur).

## 6. Cas couverts par le mapping

| Situation | Catégorie TVA EN 16931 | Traitement |
|---|---|---|
| Client professionnel, TVA normale | `S` (Standard) | n° TVA acheteur repris si présent |
| Client particulier (B2C) | `S` / `Z` | pas de n° TVA acheteur |
| Autoliquidation BTP (art. 283-2 nonies CGI) | `AE` (Reverse charge) | TVA à 0, mention d'exonération, n° TVA vendeur + acheteur requis |
| Franchise en base (art. 293 B CGI, auto-entrepreneur) | `E` (Exempt) | TVA à 0, mention d'exonération, SIRET vendeur comme identifiant fiscal (BT-32) |

## 7. Preuves de conformité (tests réalisés)

Validation **hors production** avec deux outils :

- **`xmllint`** contre les schémas **XSD** officiels Factur-X 1.07.3 fournis par la librairie.
- **Validateur de référence Mustangproject** (Schematron EN 16931 complet, incl. règles de calcul BR-CO-*, TVA BR-S-/BR-AE-/BR-E-*).

Résultat sur les **4 scénarios** (B2B, B2C, autoliquidation, franchise), via le **code de production réel** :

- XSD : **valide** partout.
- Règles **cœur EN 16931** : **0 échec** partout.
- PDF/A-3 : XML `factur-x.xml` correctement **embarqué** (relation `/Alternative`), **identique** au XML validé après extraction (round-trip OK).

> Note : le validateur applique par défaut la surcouche allemande **XRechnung** (règles `BR-DE-*`, `PEPPOL-*`). Ces règles **ne concernent pas** le Factur-X français et sont hors périmètre. Notre identifiant `urn:cen.eu:en16931:2017` est la valeur correcte pour la France.

## 7 bis. Conformité PDF/A-3 : RÉSOLUE (packager pdf-lib maison)

Premier test veraPDF : le PDF hybride produit par `node-zugferd.embedInPdf()` était **non conforme PDF/A-3** (node-zugferd suppose un PDF d'entrée déjà PDF/A ; jsPDF ne produit pas du PDF/A → ni OutputIntent, ni XMP pdfaid, etc.).

**Solution retenue** : un **packager PDF/A-3b maison en pdf-lib pur** (`lib/facturx/pdfa3.ts`), 100% JS donc compatible Vercel (aucun Ghostscript/Java au runtime). node-zugferd ne sert plus qu'à **générer le XML** (déjà prouvé) ; le conteneur PDF/A-3 est construit par notre code, qui ajoute :

- la pièce jointe `factur-x.xml` (AFRelationship « Alternative ») ;
- un **OutputIntent** avec profil **ICC sRGB embarqué** (`lib/facturx/srgb-icc.ts`) ;
- les métadonnées **XMP** : `pdfaid:part=3` / `conformance=B` + le **schéma d'extension Factur-X** ;
- le `/ID` du trailer + une table xref classique (pas de flux xref).

**Résultat validé** (validateur Mustangproject embarquant veraPDF), sur le **code de production réel** :

- PDF/A-3 : **`flavour=3b`, `isCompliant=true`** ✓ (0 assertion en échec)
- XML EN 16931 : **valide** ✓
- Global : **`valid`** ✓

**Dernier point à vérifier** : ce test utilise un PDF source à polices embarquées (façon jsPDF). Il reste à valider une fois sur la **vraie** sortie `generateFacturePdf` (avec logo/tampon réels) — c'est la dernière vérification avant exposition aux utilisateurs.

## 7 ter. Refactor anti-divergence (fait, local)

Pour garantir que le PDF de téléchargement classique et le PDF Factur-X partent des **mêmes données** (règle : dashboard / PDF identiques), l'assemblage `FactureData` a été extrait dans `lib/facturx/build-facture-data.ts`, utilisé par `/api/download-facture` (refactorisé, comportement identique) et par la future route Factur-X. Le visuel reste `generateFacturePdf`, inchangé. Vérifié : typecheck verbatim 0 erreur.

## 8. Prochaines étapes (non faites aujourd'hui)

1. **Validation PDF/A-3 finale avec veraPDF** sur la **vraie** sortie jsPDF de Nexartis. La conformité PDF/A-3 dépend du PDF source (polices entièrement embarquées, profil colorimétrique, OutputIntent). C'est le **point de vigilance n°1** avant branchement : il faudra passer le PDF jsPDF → `embarquerFacturX` au crible de veraPDF et corriger les écarts éventuels.
2. **Branchement aux routes** `app/api/download-facture/route.ts` et `app/api/send-facture/route.ts` : après génération du PDF visuel, appeler `embarquerFacturX(pdfBuffer, factureData)` et renvoyer/joindre le PDF hybride. Stocker le XML dans la colonne `factures.facturx_xml` (déjà existante).
3. **Réconciliation des totaux** : `mapFactureToFacturX` renvoie un récap des totaux recalculés ; vérifier qu'il correspond aux `montant_ht/ttc` stockés (le PDF et le XML doivent être strictement identiques).
4. **Champs de données** : aujourd'hui pays = `FR` et devise = `EUR` par défaut (suffisant pour le marché Nexartis). À rendre paramétrables seulement si export international un jour.
5. **UX utilisateur** (bouton « Télécharger Factur-X », réglages) : passera par le **workflow V1 → brainstorm 3 agents → V2** car c'est une feature visible utilisateur.
6. **Transmission PDP** : phase distincte (choix d'une plateforme agréée partenaire).

## 9. Méthode de test (pour reproduire)

```
# Génère et valide un XML
node  -> genererFacturXml(facture)  -> xmllint --schema Factur-X_1.07.3_EN16931.xsd
# Validation Schematron complète
java -jar Mustang-CLI.jar --action validate --source facture.xml
```
