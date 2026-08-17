# Cahier des charges — OffRec

> Document de référence unique pour toute personne ou tout agent (humain ou IA)
> intervenant sur ce projet. Il décrit le produit, ce qui est déjà construit,
> ce qui reste à faire, et les règles à respecter pour que les évolutions
> restent cohérentes avec la vision d'origine. **À maintenir à jour** : toute
> évolution significative du périmètre, du modèle de données ou des règles
> métier doit être reportée ici dans la même contribution.
>
> Ce document fusionne l'ancien `CAHIER_DES_CHARGES_V2.md` (cadrage
> stratégique post-hackathon) dans le cahier des charges d'origine — il n'y a
> plus qu'une seule version à tenir à jour. Le raisonnement complet (marché,
> sources chiffrées, positionnement, plan 90 jours) reste détaillé dans
> [`STRATEGIE_OFFREC_2026.md`](./STRATEGIE_OFFREC_2026.md) ; ce fichier-ci n'en
> retient que ce qui contraint la spécification produit.

## 1. Contexte

OffRec est né comme prototype pour un hackathon de concours d'idées
entrepreneuriales à Madagascar, et fait partie des **7 projets finalistes**
retenus tous secteurs confondus. Le produit doit donc désormais être lu à
deux niveaux :

- **Niveau produit** : un prototype fonctionnel qui démontre l'idée devant un
  jury, avec des données de démonstration crédibles et un parcours fluide.
- **Niveau entreprise** : une idée qui doit convaincre qu'elle a un marché,
  un modèle économique et une trajectoire de croissance au-delà du hackathon.

Les décisions techniques doivent donc arbitrer en gardant ces deux niveaux en
tête : ne pas sur-ingénierier un prototype de démo, mais ne pas prendre de
raccourcis qui rendraient une vraie mise en production impossible à
raisonner.

## 2. Problème et proposition de valeur

Madagascar (zone d'usage initiale : agglomération d'Antananarivo) manque de
deux choses que ce produit adresse en un seul écosystème :

1. **Trouver un prestataire de confiance** (artisan, fournisseur de
   matériaux, transporteur…) repose aujourd'hui sur le bouche-à-oreille ou
   des groupes Facebook où l'information se perd en quelques semaines. Il
   n'existe pas d'endroit où retrouver « le bon plan » recommandé il y a six
   mois, avec le prix réellement payé.
2. **Trouver une opportunité professionnelle** (emploi, stage, mission,
   freelance, alternance) adaptée à son profil réel (compétences, province,
   niveau, disponibilité) est dispersé entre plusieurs canaux informels.

La proposition de valeur commune aux deux volets : **transformer une
expérience vécue et datée en information exploitable et durable**, plutôt
qu'une moyenne d'étoiles anonyme ou une offre d'emploi générique.

## 3. Utilisateurs cibles

| Persona | Besoin | Où dans le produit |
|---|---|---|
| Particulier / porteur de chantier | Trouver un artisan fiable, savoir combien payer | `/annuaire` |
| Artisan / fournisseur / transporteur | Être trouvé, revendiquer sa fiche, construire une réputation vérifiable | `/annuaire/:id` (fiche), revendication de fiche (non encore implémentée, voir §8) |
| Partenaire B2B local (quincaillerie, microfinance, programme habitat/emploi, association professionnelle) | Identifier un réseau local plus vérifiable, co-financer la collecte | Aucune surface produit dédiée aujourd'hui — relation commerciale hors app, prévue Phase C/D (§8) |
| Candidat (jeune diplômé, freelance, chercheur d'emploi) | Trouver des opportunités pertinentes pour son profil, postuler, suivre ses candidatures | `/candidat/*` |
| Recruteur (entreprise, particulier employeur) | Publier des offres, recevoir des candidatures qualifiées | `/recruteur/*` |

Un même compte (`User`) peut contribuer à l'annuaire de confiance (en tant
que `Member`) quel que soit son rôle candidat/recruteur — voir §7.

## 4. Décision de lancement : un périmètre resserré

Décision stratégique (détail et sources dans `STRATEGIE_OFFREC_2026.md`) :
**OffRec est le réseau de confiance mobile-first du travail local**, pas un
job board généraliste ni un annuaire national tous secteurs. Cette décision
contraint directement la feuille de route (§8) :

- **Lancement géographique** : Grand Antananarivo, pilote sur 3 à 5 quartiers
  — pas un déploiement multi-province simultané.
- **Verticale de départ** : construction et amélioration de l'habitat (celle
  déjà couverte par `TRADES`/`DISTRICTS` dans `src/data/constants.ts`).
- **Canaux** : web mobile léger, WhatsApp/téléphone, onboarding assisté sur
  le terrain — cohérent avec une pénétration Internet encore limitée à
  Madagascar (voir sources dans `STRATEGIE_OFFREC_2026.md`).
- **Cibles prioritaires** : porteur de chantier, prestataire, partenaire B2B
  local. Le portail d'opportunités (candidats/recruteurs) reste une brique
  **complémentaire** qui renforce le même réseau local, pas un second produit
  à égalité de priorité.

**Ne pas étendre simultanément** à toutes les provinces, tous les corps de
métier et au marché de l'emploi généraliste. Toute extension doit d'abord
passer par un pilote local qui prouve la densité de retours et la capacité de
modération (voir Phase E, §8).

## 5. Périmètre fonctionnel actuel (implémenté)

### 5.1 Annuaire de confiance (`/annuaire`) — cœur différenciant du produit

- Recherche de prestataires par métier, quartier (maille fine : quartier
  d'Antananarivo, pas juste « Tana »), texte libre.
- Fiche prestataire : contact direct (téléphone / WhatsApp), **prix
  constaté** (médiane des prix réellement payés par unité — au sac, au m²,
  au voyage…), historique des retours datés.
- Publication d'une recommandation rattachée à un chantier réel : travail
  décrit, date du chantier, prix payé, preuve (facture, photo, ou aucune).
- Confirmation d'un retour par un autre membre (« j'ai eu la même
  expérience »).
- **Moteur de confiance** (`src/lib/trust.ts`) : score pondéré (pas une
  moyenne d'étoiles) qui tient compte de la preuve fournie, de la fraîcheur
  du chantier, de la fiabilité de l'auteur et des confirmations reçues ;
  produit un niveau de confiance, des raisons explicites et des alertes
  quand l'information est trop mince.
- **Classement anti-manipulation** : moyenne bayésienne pour le tri de
  l'annuaire, afin qu'un 5/5 unique ne passe pas devant un 4,5/5 confirmé par
  six membres.
- **Règles anti-abus** : un membre = un retour par prestataire ; un
  prestataire ayant revendiqué sa fiche ne peut pas s'auto-recommander ; pas
  d'auto-confirmation ; aucune suppression de recommandation possible.
- Consultation publique (sans compte) ; contribution (recommander,
  confirmer, ajouter une fiche) réservée aux comptes connectés.

### 5.2 Portail d'opportunités (`/candidat`, `/recruteur`)

- Page d'accueil publique (proposition de valeur, statistiques, offres à la
  une).
- Inscription / connexion (comptes stockés localement, voir §6).
- Profil candidat (compétences, province, niveau d'étude, niveau
  d'expérience, types d'opportunités souhaités, disponibilité).
- **Moteur de scoring** (`src/lib/recommendation.ts`) : classe les offres
  pour un candidat selon compétences (40 %), localisation (25 %), niveau
  (15 %), type d'opportunité (15 %), disponibilité (5 %), avec raisons
  explicites affichées.
- Fil d'offres recommandées, favoris, notifications, détail d'offre,
  candidature.
- Espace recruteur : publier / modifier / supprimer des offres, consulter
  les candidatures reçues.

## 6. État technique actuel — à connaître avant toute évolution

- **Stack** : React 19 + TypeScript + Vite 8, React Router 7, Framer Motion,
  Lucide React. Pas de state manager externe, pas de CSS-in-JS (CSS simple
  par composant).
- **Données** : tout est en mémoire + `localStorage`
  (`src/context/AppContext.tsx`, `src/lib/storage.ts`). **Il n'y a pas de
  backend branché.** `supabase/schema.sql` décrit un schéma Postgres cible et
  `DEPLOYMENT.md` documente comment brancher Supabase, mais le code source
  ne lit ni n'écrit encore vers Supabase (`VITE_USE_SUPABASE` n'est
  référencé nulle part dans `src/`).
- **Conséquence directe** : chaque visiteur a ses propres données, propres à
  son navigateur. Il n'y a **pas de partage de données entre utilisateurs**
  en l'état — un candidat ne voit pas les offres publiées par un recruteur
  sur un autre appareil. Ce point doit être présenté clairement au jury
  comme une limite de prototype assumée, pas cachée.
- **Les statistiques affichées sur la page d'accueil** (`STATS` dans
  `src/data/constants.ts` : offres, candidats, recruteurs, provinces) sont
  des **constantes de démonstration**, pas des données mesurées. Ne jamais
  les présenter comme une traction réelle (voir aussi le skill
  `offrec-ceo-strategy`, §« garde-fous factuels »).
- **Déploiement** : Vercel, build via `npm run build` (`tsc --noEmit && vite
  build`), routes réécrites vers `index.html` via `vercel.json`. Voir
  `DEPLOYMENT.md` pour la procédure complète (déjà à jour, ne pas dupliquer
  ici).
- **Pas de suite de tests automatisés, pas de configuration ESLint** à ce
  jour. `npm run build` (qui inclut la vérification de types stricte) est le
  seul garde-fou automatique.

Détails d'architecture (organisation des dossiers, conventions de code,
modèle `User`/`Member`) : voir [CLAUDE.md](./CLAUDE.md) et
[AGENTS.md](./AGENTS.md), qui restent la référence technique pour un agent de
code. Ce document-ci est la référence **produit et trajectoire** ; les trois
sont complémentaires et ne doivent pas être dupliqués l'un dans l'autre.

## 7. Règles métier non négociables

### 7.1 Moteur de confiance

Ces règles sont au cœur de la crédibilité du produit ; toute évolution du
moteur de confiance ou du modèle de données doit continuer à les respecter,
et toute proposition qui les affaiblirait doit être signalée explicitement
plutôt qu'implémentée silencieusement.

1. Une recommandation sans travail réalisé et sans date n'a pas de valeur —
   les deux champs sont obligatoires.
2. Le score d'un prestataire n'est jamais une simple moyenne d'étoiles : il
   est pondéré par la preuve, la fraîcheur, la fiabilité de l'auteur et les
   confirmations reçues (`src/lib/trust.ts`).
3. Un membre ne peut publier qu'un seul retour par prestataire.
4. Un prestataire qui a revendiqué sa fiche ne peut pas s'auto-recommander,
   et ses propres retours sont exclus du calcul de son score.
5. On ne confirme pas son propre retour.
6. **Aucune suppression de recommandation** — un avis négatif ne disparaît
   pas, y compris pour protéger un payeur ou un partenaire. (Une
   modification par l'auteur, avec journal, pourrait être envisagée plus
   tard — voir la correction factuelle en §7.2 — mais une suppression pure
   irait à l'encontre de la promesse de fiabilité.)
7. Le classement de l'annuaire utilise une moyenne bayésienne : un 5/5 sur
   un seul avis ne doit pas passer devant un 4,5/5 confirmé par plusieurs
   membres — mais le score *affiché* sur la fiche reste toujours la vraie
   moyenne pondérée, jamais la version ajustée utilisée pour le tri.
8. Identité `User` (compte, authentification) et identité `Member`
   (réputation communautaire) sont distinctes par conception — voir
   `CLAUDE.md` / `AGENTS.md` §Architecture. Ne pas les fusionner : c'est ce
   qui permettra, plus tard, une identité de contributeur qui survit à la
   suppression d'un compte, ou une modération différenciée.

### 7.2 Consentement et gouvernance des données

Ces règles s'appliquent dès qu'une collecte réelle (terrain ou pilote)
dépasse les données de démonstration :

9. Le consentement du membre et l'accord de publication du prestataire sont
   obligatoires ; conserver une trace de ce consentement, sans collecter
   plus de données que nécessaire.
10. Toujours afficher la source, la date et le niveau de confiance d'un
    retour ; séparer clairement score, rang de classement et tout contenu
    sponsorisé — un partenaire ne doit jamais pouvoir confondre les trois
    aux yeux de l'utilisateur.
11. Prévoir un chemin de signalement avec preuve, décision humaine, journal
    et possibilité de correction factuelle — sans jamais supprimer un
    retour.
12. Les médias de preuve (facture, photo) sont privés jusqu'à revue ;
    expurger numéro de téléphone, adresse précise et toute donnée sensible
    avant publication.
13. Définir une politique de conservation des médias et de contestation
    avant tout import massif de données ; demander un avis juridique local
    avant toute promesse de conformité (RGPD ou équivalent local).

## 8. Feuille de route évolutive

Phases lettrées et priorisées selon la décision de lancement (§4) : les
fondamentaux de confiance (A → C) passent avant toute extension (D → E). Un
agent qui reçoit une tâche « ajoute [fonctionnalité] » doit d'abord vérifier
si elle correspond à un point déjà identifié ici, pour respecter ces
dépendances ; si elle n'y figure pas, l'ajouter à la phase pertinente en même
temps que l'implémentation.

| Phase | Livrable | Critère d'acceptation |
|---|---|---|
| **A — Données partagées** | Supabase Auth, RLS, gestion chargement/erreur, migration depuis `localStorage` | Deux appareils voient la même fiche et les règles d'écriture (§7) sont appliquées en base, pas seulement côté client. |
| **B — Confiance opérationnelle** | Revendication de fiche, vérification téléphone (OTP), signalement, modération, correction factuelle | Personne ne peut modifier son propre score, supprimer un retour ou s'auto-recommander — vérifié en base, pas seulement en UI. |
| **C — Pilote terrain** | Import des consentements collectés, tableau de couverture, analytics, contact WhatsApp | Densité de retours, recherche, contact et retour utilisateur sont mesurables sans exposer de données privées. |
| **D — Revenus** | Espace partenaire, profil professionnel optionnel, offre B2B/organisation | Le paiement ne modifie jamais le score, le rang organique ou la modération (voir §7.2). |
| **E — Extension** | Nouvelle zone géographique, nouvelle verticale, ou approfondissement du portail d'opportunités | Pilote, runbook de collecte, capacité de modération et économie unitaire validés avant d'élargir. |

### Détail par phase

**Phase A — sortir du prototype mono-navigateur (bloquant pour tout usage réel)**
- [ ] Brancher Supabase (Postgres + Auth + RLS) — schéma déjà documenté dans
  `supabase/schema.sql`, cohérent avec les règles anti-abus du §7 qui
  doivent être appliquées **aussi** côté base.
- [ ] Remplacer l'auth mock (`AppContext.login/register`, mot de passe en
  clair dans `localStorage`) par Supabase Auth. **Le mot de passe en clair
  est acceptable pour un prototype de démo mais ne doit jamais être
  reproduit dans une version connectée à un vrai backend.**
- [ ] Migrer chaque fonction de `AppContext.tsx` (aujourd'hui des mutations
  synchrones de state) vers des appels réseau avec gestion d'état de
  chargement/erreur/reprise — le changement d'architecture le plus large du
  backlog, à planifier en plusieurs PRs plutôt qu'en un seul gros
  changement.

**Phase B — fiabiliser l'annuaire de confiance en conditions réelles**
- [ ] Revendication de fiche prestataire par le prestataire lui-même
  (`claimedByMemberId` existe déjà dans le modèle de données, le parcours
  utilisateur pour le renseigner n'est pas encore construit).
- [ ] Vérification de numéro de téléphone (`Member.phoneVerified` existe déjà
  dans le modèle et pèse dans `memberReliability()`, mais rien ne le fait
  passer à `true` aujourd'hui — SMS OTP ou équivalent à définir).
- [ ] Modération : signalement d'une fiche ou d'un retour abusif, avec preuve,
  décision humaine et journal (§7.2) — dans un premier temps un traitement
  manuel côté équipe produit suffit.

**Phase C — pilote terrain (Grand Antananarivo, 3–5 quartiers)**
- [ ] Import des données collectées avec l'outillage déjà existant
  (`collecte/import-collecte.mjs`, `collecte/GUIDE-COLLECTE.md`,
  `collecte/modele-collecte.csv`) — voir §11 pour les seuils de qualité
  avant d'élargir.
- [ ] Tableau de couverture (métiers × quartiers) pour suivre la densité de
  retours par fiche, pas seulement le nombre de fiches.
- [ ] Analytics pseudonymisées pour les événements listés en §10.
- [ ] Contact WhatsApp instrumenté (au-delà du simple lien `wa.me`).

**Phase D — modèle économique**
- [ ] Espace partenaire B2B (pilote de collecte co-financé — quincaillerie,
  microfinance, programme habitat/emploi, association professionnelle).
- [ ] Profil professionnel optionnel pour le prestataire (outils de contact,
  statistiques, fiche enrichie, formation) — jamais un meilleur score ou un
  meilleur rang organique.
- [ ] Abonnement organisation/recruteur, après preuve de mises en relation
  utiles, pas avant.
- [ ] Observabilité produit (taux de conversion recommandation → contact,
  offre → candidature) pour objectiver ces décisions plutôt que les deviner.
- Prix, coûts (SMS notamment), taux de conversion et marge restent des
  **hypothèses** tant qu'il n'y a pas au moins une lettre d'intention ou un
  pilote payant signé — ne pas les présenter comme un prévisionnel acquis.

**Phase E — extension (géographique, verticale, ou portail d'opportunités)**
- [ ] Élargir la couverture géographique au-delà d'Antananarivo, ou les
  métiers au-delà de la construction (`DISTRICTS`/`TRADES` dans
  `src/data/constants.ts` sont une extension de configuration, pas une
  réécriture) — seulement après validation du pilote (§11).
- [ ] Approfondir le portail d'opportunités, en tant que brique
  complémentaire au réseau de confiance (§4), pas en concurrence de
  priorité avec les phases A–C : notifications réellement poussées
  (email/SMS/push) au lieu du fil in-app actuel, pièces jointes de
  candidature (CV, portfolio), statut de candidature côté recruteur (vu,
  contacté, refusé…) au lieu d'une liste plate.

## 9. Exigences non fonctionnelles et techniques

- **Langue** : produit et code (identifiants, commentaires) en français,
  cohérent avec le marché cible. Ne pas introduire d'anglais dans l'UI.
- **Mobile-first et connexion lente** : chaque écran clé doit fonctionner sur
  un écran étroit et une connexion intermittente — cohérent avec le niveau
  de pénétration Internet à Madagascar (voir `STRATEGIE_OFFREC_2026.md`).
  Une fois un backend réel branché (Phase A), toute écriture réseau doit
  prévoir un état de chargement, de succès, d'erreur et de reprise — pas
  d'écran blanc.
- **Validation double** : toute règle de domaine (§7) doit être vérifiée
  côté client **et** côté serveur dès qu'un backend existe ; le client seul
  n'est jamais une garantie suffisante contre l'abus.
- **Confidentialité analytique** : les événements produit (§10) sont
  pseudonymisés — ni numéro de téléphone, ni nom complet, ni preuve brute ne
  doit partir vers un outil d'analytics.
- **Tests** : ajouter des tests ciblés pour `trust.ts`, les politiques RLS et
  `recommendation.ts` à mesure qu'ils gagnent en complexité ; `npm run
  build` reste la vérification minimale obligatoire dans tous les cas.
- **Coût d'infrastructure** : rester sur les paliers gratuits/faibles de
  Vercel + Supabase tant que le produit n'a pas de revenus.
- **Accessibilité** : pas d'exigence formelle (WCAG) fixée à ce stade, mais
  éviter les régressions évidentes (contraste, alternatives textuelles) à
  l'occasion des évolutions.

## 10. Événements et seuils de sortie du pilote

Instrumenter au minimum ces événements (Phase C) : `provider_viewed`,
`provider_contact_intent`, `recommendation_submitted`,
`recommendation_moderated`, `opportunity_matched`. Chaque événement ne porte
que les identifiants, la zone, la source ou la décision nécessaires à sa
mesure — jamais de contenu personnel brut (§9).

Le pilote ne peut s'étendre (vers Phase E) que si, **simultanément** :

- au moins 40 prestataires référencés ;
- au moins 3 recommandations par prestataire, en médiane (pas en moyenne —
  une poignée de fiches sur-documentées ne doit pas masquer un pilote trop
  peu profond) ;
- au moins 60 contributeurs distincts ;
- les consentements sont traçables (§7.2) ;
- la modération est opérationnelle (Phase B livrée) ;
- au moins un partenaire confirme la valeur observée.

Ce sont des seuils internes de qualité, pas de la traction à annoncer avant
de les avoir atteints.

## 11. Hors périmètre au lancement

Explicitement exclu tant que les phases A–C (§8) ne sont pas validées :

- Paiement ou séquestre (escrow) et règlement des litiges de chantier.
- IA opaque qui déciderait à la place des personnes (modération, score).
- Vente de classement, suppression d'avis ou de coordonnées privées — sous
  quelque forme que ce soit, y compris déguisée en « mise en avant ».
- Déploiement national sans opération locale de collecte et de modération.
- Toute promesse d'emploi, de contrat ou de prix garanti.

## 12. Contraintes et risques connus

| Risque | Impact | Mitigation actuelle / prévue |
|---|---|---|
| Pas de backend partagé | Le produit ne peut pas être utilisé au-delà d'une démo mono-navigateur | Phase A (§8) |
| Amorçage de l'annuaire (« cold start ») | Un annuaire sans recommandations n'a pas de valeur ; personne ne publie de retour sur un annuaire vide | Traité au niveau go-to-market : `collecte/` fournit déjà l'outillage de collecte terrain ; voir seuils de sortie de pilote (§10) |
| Faux avis / manipulation de score | Détruit la promesse de confiance, cœur du produit | Poids de fiabilité auteur + moyenne bayésienne (§7.1) déjà en place côté client ; à faire respecter aussi côté base en Phase A/B |
| Mot de passe en clair (prototype) | Non acceptable en production | Ne pas répliquer au-delà du prototype ; remplacé par Supabase Auth en Phase A |
| Statistiques de démonstration présentées comme réelles | Perte de crédibilité si un jury ou partenaire vérifie et découvre que `STATS` est une constante | Ne jamais citer `STATS` (`src/data/constants.ts`) comme donnée mesurée — voir §6 et le skill `offrec-ceo-strategy` |
| Chiffres de marché non vérifiés en interne | Une source mal citée devant un jury nuit à la crédibilité du reste du dossier | Toute statistique de marché doit être vérifiée à la source avant un pitch public — voir `STRATEGIE_OFFREC_2026.md` et le skill `offrec-ceo-strategy` |

## 13. Indicateurs de succès

Pour l'instant qualitatifs (posture hackathon), à quantifier dès que
l'instrumentation (§10) existe :

- Annuaire : nombre de fiches avec au moins une recommandation à preuve
  (facture/photo), taux de confirmation, part des fiches en confiance
  « forte ».
- Portail d'opportunités : taux de candidature sur offre recommandée en tête
  de fil vs. offre découverte par recherche libre (validerait ou non le
  moteur de scoring).
- Pilote terrain : voir les seuils de sortie de pilote au §10, qui font
  office de jalon de succès avant toute extension.

## 14. Glossaire

| Terme | Définition |
|---|---|
| Prestataire (`Provider`) | Artisan, fournisseur ou transporteur référencé dans l'annuaire |
| Membre (`Member`) | Identité communautaire qui porte la réputation ; distincte du compte `User` (voir §7.1) |
| Recommandation | Retour d'un membre sur un chantier réel avec un prestataire ; unité de base du moteur de confiance |
| Confiance (`TrustResult`) | Sortie du moteur de `src/lib/trust.ts` : score, niveau de confiance, raisons, alertes |
| Prix constaté | Médiane des prix réellement payés pour un prestataire, par unité de facturation |
| Opportunité (`Opportunity`) | Offre publiée par un recruteur : emploi, stage, mission, freelance ou alternance |
| Score de correspondance (`MatchResult`) | Sortie du moteur de `src/lib/recommendation.ts` : classe les offres pour un profil candidat |
| Beachhead / verticale de départ | La construction et l'amélioration de l'habitat dans le Grand Antananarivo — le segment initial sur lequel prouver le modèle avant toute extension (§4) |

---

*Ce document décrit l'état au 2026-08-17. Il remplace `CAHIER_DES_CHARGES_V2.md`
(fusionné ici). Toute PR qui change le périmètre fonctionnel, le modèle de
données ou une règle métier des §7, §10 ou §11 doit mettre ce fichier à jour
dans le même commit.*
