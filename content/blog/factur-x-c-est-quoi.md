---
title: "Factur-X, c'est quoi ? Explication simple pour artisans (PDF + XML)"
description: "Factur-X, c'est quoi ? Le format hybride PDF + XML de la facture électronique expliqué simplement aux artisans, avec exemple concret et le bon profil à utiliser."
slug: "factur-x-c-est-quoi"
category: "Réglementation"
date: "23 juin 2026"
updated: "2026-06-23"
publishedDate: "2026-06-23"
readingTime: "7 min"
heroImage: ""
author:
  name: "Jérémy Schmitt"
  role: "Fondateur de Nexartis, à l'écoute des artisans du BTP"
  bio: "Jérémy Schmitt a fondé Nexartis avec une obsession : créer le logiciel ultime pour les artisans français. En écoutant chaque jour les besoins du terrain — devis, factures, planning, chantiers — il développe un outil pensé pour leur réalité quotidienne."
authorRole: "Fondateur de Nexartis, à l'écoute des artisans du BTP"
tags: ["Factur-X", "facture électronique", "format facture", "PDF XML", "EN 16931", "artisan BTP", "réforme 2026"]
canonical: "https://nexartis.fr/blog/factur-x-c-est-quoi"
ogImage: ""
---

**Factur-X, c'est un format de facture électronique** : un seul fichier qui contient à la fois un **PDF** que vous lisez normalement à l'écran, et un fichier **XML** invisible que les logiciels lisent automatiquement. Deux factures en une : une pour l'humain, une pour la machine. C'est l'un des **trois formats** retenus par la réforme française (avec UBL et CII), et de loin le plus adapté aux artisans.

Beaucoup découvrent ce terme dans un courrier de leur comptable ou de l'administration, sans qu'on leur explique vraiment de quoi il s'agit. Cette page met les choses au clair, sans jargon, avec un exemple concret et ce qui vous concerne directement.

## Factur-X, c'est quoi exactement ?

Factur-X est un **standard franco-allemand** de facture électronique, créé pour que les entreprises des deux pays parlent le même langage de facturation. Techniquement, c'est un fichier **PDF/A-3** (un PDF conçu pour l'archivage longue durée) à l'intérieur duquel est glissé un fichier **XML**.

Le PDF, c'est la partie que vous connaissez : votre facture avec votre logo, vos lignes et vos totaux, lisible par vous comme par votre client. Le XML contient exactement les mêmes informations, mais sous forme de **données structurées** que seul un logiciel sait lire.

Votre client ouvre le fichier et voit une facture parfaitement normale. De son côté, son logiciel de comptabilité lit le XML caché et **récupère les montants tout seul**, sans aucune ressaisie. C'est tout l'intérêt du format : plus de recopie manuelle, donc plus d'erreurs de saisie.

Factur-X est aussi la première application concrète de la **norme européenne EN 16931**, qui définit ce que doit contenir une facture électronique valide en Europe. L'organisme qui pilote ce format en France est le [Forum National de la Facture Électronique](https://fnfe-mpe.org/factur-x/), qui en publie les spécifications officielles.

## À quoi ressemble une facture Factur-X ?

C'est la question que se posent la plupart des artisans, et la réponse va vous rassurer : **une facture Factur-X ressemble à une facture normale**. À l'écran, vous ne voyez aucune différence avec un PDF classique. Même logo, même mise en page, mêmes totaux.

La différence est cachée. Si vous ouvrez le document dans un lecteur de PDF, vous pouvez parfois repérer un petit **trombone** ou une mention de **pièce jointe** : c'est le fichier XML embarqué. Vous n'avez jamais à l'ouvrir ni à le toucher.

Comment savoir alors qu'une facture est bien en Factur-X ? Le plus simple : **votre logiciel vous l'indique** au moment de l'export ou de l'envoi. Une facture créée dans un outil conforme est automatiquement au bon format, sans que vous ayez quoi que ce soit à vérifier vous-même.

## Pourquoi deux fichiers en un seul ?

L'idée peut sembler étrange : pourquoi mêler un PDF et un XML dans le même document ? Parce que les deux mondes en ont besoin, mais pas pour la même raison.

Imaginez un colis avec une étiquette. Vous, vous lisez l'adresse écrite dessus. Le centre de tri, lui, scanne le code-barres. **L'adresse et le code-barres portent la même information**, mais l'un est fait pour l'œil humain, l'autre pour la machine. Factur-X fonctionne pareil : le PDF est votre « adresse écrite », le XML est le « code-barres ».

Ce double usage explique pourquoi le format est **très apprécié des TPE et des artisans**. Vous gardez une facture lisible et imprimable comme avant, tout en étant conforme aux exigences techniques de la réforme. Rien de nouveau à apprendre côté lecture.

## Factur-X, UBL, CII : quelle différence ?

La réforme française accepte **trois formats** de facture électronique. Inutile de tous les retenir, mais voici de quoi vous repérer si on vous en parle.

| Format | Composition | Qui l'utilise plutôt |
|---|---|---|
| **Factur-X** | PDF lisible + XML caché | TPE, artisans, PME (le plus accessible) |
| **UBL** | XML seul | Grandes entreprises, secteur public |
| **CII** | XML seul | Grands groupes, échanges internationaux |

La grande différence est simple : **Factur-X reste lisible par un humain**, alors qu'UBL et CII sont des fichiers de données purs, illisibles sans logiciel. Pour un artisan qui veut continuer à voir ses factures normalement, **Factur-X est le format le plus confortable**.

## Les profils Factur-X : lequel pour un artisan ?

Factur-X existe en plusieurs **profils**, qui correspondent au niveau de détail des données contenues dans le XML. Du plus simple au plus complet : Minimum, Basic WL, Basic, EN 16931 et Extended.

Attention à une nuance importante : les profils **Minimum** et **Basic WL** ne contiennent pas le détail des lignes de facture. Tolérés au lancement de la réforme, ils sont **appelés à disparaître** et ne conviennent pas à la facturation entre entreprises. Le profil de référence à viser est **EN 16931** (parfois appelé « Comfort »), qui inclut toutes les lignes et les informations attendues.

Rassurez-vous : ce choix de profil est **géré automatiquement par votre logiciel**. Vous n'avez pas à le sélectionner, à condition d'utiliser un outil qui produit directement le bon profil.

## Factur-X est-il obligatoire ? En 2026 ou en 2027 ?

C'est la source de confusion numéro un, alors soyons clairs et brefs : pour un artisan, l'obligation d'**émettre** ses factures au format électronique tombe au **1er septembre 2027**, et non en 2026 (cette première date concerne surtout la capacité à **recevoir** les factures, ainsi que les grandes entreprises). Vous avez donc le temps, mais anticiper vous évitera la précipitation.

Le calendrier complet, les plateformes et les cas particuliers sont détaillés dans notre guide dédié : [facturation électronique 2026-2027, ce qui change pour les artisans](/blog/facturation-electronique-artisan). Pour les chiffres officiels, la source de référence reste [economie.gouv.fr](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises).

## Les erreurs fréquentes à éviter

Quelques idées reçues reviennent souvent et peuvent coûter cher. Voici les pièges les plus courants chez les artisans.

- **Croire qu'un PDF classique ou scanné est une facture Factur-X.** Un PDF normal ne contient pas le XML : il n'est donc pas conforme, même s'il est bien présenté.
- **Penser être dispensé en franchise de TVA.** L'auto-entrepreneur en [franchise de TVA](/blog/mentions-obligatoires-facture) devra lui aussi émettre des factures électroniques. La franchise ne change rien à cette obligation.
- **Attendre la dernière minute pour s'équiper.** Changer d'outil en urgence à l'été 2027 est le meilleur moyen de bloquer sa facturation au pire moment.
- **Envoyer la facture par simple e-mail.** À terme, la transmission devra passer par une **plateforme agréée**, pas par une pièce jointe dans votre messagerie habituelle.

## Comment créer une facture Factur-X quand on est artisan ?

Vous n'avez pas à fabriquer le fichier XML à la main : ce serait impossible. C'est votre **logiciel de facturation** qui le génère, à partir des informations que vous saisissez déjà (client, lignes, TVA, totaux).

Concrètement, vous créez votre facture comme d'habitude, et le logiciel produit en sortie un fichier Factur-X conforme, prêt à être transmis. La seule chose qui compte vraiment : que **votre outil sache produire le bon format** et le transmettre via une plateforme agréée.

C'est exactement ce que fait **Nexartis**. Notre [logiciel de devis et factures](/logiciel-devis-factures) pour artisans du bâtiment génère des factures **Factur-X conformes** à la norme EN 16931, sans manipulation de votre part, et est raccordé à une plateforme agréée. Vous restez concentré sur vos chantiers, la conformité se fait en arrière-plan. Pour fixer vos prix au passage, notre [calculateur de taux horaire](/calculateur-taux-horaire-artisan) peut aussi vous être utile. Vous pouvez [tester Nexartis gratuitement pendant 14 jours](/register).

> **À retenir**
>
> - Factur-X = un seul fichier réunissant un **PDF lisible** et un **XML caché**.
> - Visuellement, ça ressemble à une facture normale ; le XML est invisible.
> - Le profil de référence pour les entreprises est **EN 16931**.
> - L'obligation d'**émettre** concerne les artisans au **1er septembre 2027**.
> - Le format est **généré automatiquement** par un logiciel conforme.

## Questions fréquentes sur Factur-X

### Quelle différence entre une facture PDF classique et une facture Factur-X ?

Une facture PDF classique ne contient que l'image de la facture. Une Factur-X ajoute, dans le même fichier, des données structurées (le XML) que les logiciels lisent sans ressaisie. Visuellement identiques, seule la Factur-X est conforme à la réforme.

### Factur-X est-il obligatoire pour les auto-entrepreneurs du bâtiment ?

Oui, à terme. L'obligation d'émettre des factures électroniques s'appliquera aux micro-entreprises et auto-entrepreneurs au 1er septembre 2027. La franchise de TVA ne dispense pas de cette obligation.

### Peut-on lire une facture Factur-X sans logiciel spécial ?

Oui. Comme une Factur-X est avant tout un PDF, vous l'ouvrez avec n'importe quel lecteur de PDF, comme une facture normale. Le fichier XML reste invisible tant qu'un logiciel ne vient pas le lire.

### Quel profil Factur-X faut-il choisir ?

Le profil de référence en France est EN 16931, aussi appelé « Comfort ». Les profils plus légers ne conviennent pas au B2B. En pratique, vous n'avez pas à choisir : un bon logiciel génère directement le bon profil.

### Factur-X est-il gratuit ?

Le format en lui-même est ouvert et gratuit. Ce que vous payez, c'est le logiciel qui produit vos factures Factur-X et les transmet via une plateforme agréée. Les tarifs des logiciels pour artisans démarrent autour de 15 € par mois.

### Comment recevoir une facture Factur-X de mes fournisseurs ?

Vous recevrez ces factures via une plateforme agréée, à laquelle votre logiciel ou votre compte sera raccordé. Vous pourrez les ouvrir comme un PDF normal, et leurs données pourront être intégrées automatiquement à votre comptabilité.

### Faut-il changer de logiciel pour passer à Factur-X ?

Pas forcément, mais votre logiciel doit savoir produire le format Factur-X et le transmettre via une plateforme agréée. Si votre outil actuel ne le fait pas, il faudra en changer avant l'échéance. Mieux vaut le vérifier dès maintenant.
