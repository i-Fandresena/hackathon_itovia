# Cahier des charges — OffRec

> Document de référence unique pour toute personne ou tout agent (humain ou IA)
> intervenant sur ce projet. Il décrit le produit, ce qui est déjà construit,
> ce qui reste à faire, et les règles à respecter pour que les évolutions
> restent cohérentes avec la vision d'origine. **À maintenir à jour** : toute
> évolution significative du périmètre, du modèle de données ou des règles
> métier doit être reportée ici dans la même contribution.

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
| Artisan / fournisseur / transporteur | Être trouvé, revendiquer sa fiche, construire une réputation vérifiable | `/annuaire/:id` (fiche), revendication de fiche (non encore implémentée, voir §7) |
| Candidat (jeune diplômé, freelance, chercheur d'emploi) | Trouver des opportunités pertinentes pour son profil, postuler, suivre ses candidatures | `/candidat/*` |
| Recruteur (entreprise, particulier employeur) | Publier des offres, recevoir des candidatures qualifiées | `/recruteur/*` |

Un même compte (`User`) peut contribuer à l'annuaire de confiance (en tant
que `Member`) quel que soit son rôle candidat/recruteur — voir §6.2.

## 4. Périmètre fonctionnel actuel (implémenté)

### 4.1 Annuaire de confiance (`/annuaire`) — cœur différenciant du produit

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

### 4.2 Portail d'opportunités (`/candidat`, `/recruteur`)

- Page d'accueil publique (proposition de valeur, statistiques, offres à la
  une).
- Inscription / connexion (comptes stockés localement, voir §5).
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

## 5. État technique actuel — à connaître avant toute évolution

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
- **Déploiement** : Vercel, build via `npm run build` (`tsc --noEmit && vite
  build`), routes réécrites vers `index.html` via `vercel.json`. Voir
  `DEPLOYMENT.md` pour la procédure complète (déjà à jour, ne pas dupliquer
  ici).
- **Pas de suite de tests automatisés, pas de configuration ESLint** à ce
  jour. `npm run build` (qui inclut la vérification de types stricte) est le
  seul garde-fou automatique.

Détails d'architecture (organisation des dossiers, conventions de code,
modèle `User`/`Member`) : voir [CLAUDE.md](./CLAUDE.md), qui reste la
référence technique pour un agent de code. Ce document-ci est la référence
**produit et trajectoire**, les deux sont complémentaires et ne doivent pas
être dupliqués l'un dans l'autre.

## 6. Règles métier non négociables

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
   pas. (Une modification par l'auteur pourrait être envisagée plus tard,
   mais une suppression pure irait à l'encontre de la promesse de
   fiabilité.)
7. Le classement de l'annuaire utilise une moyenne bayésienne : un 5/5 sur
   un seul avis ne doit pas passer devant un 4,5/5 confirmé par plusieurs
   membres — mais le score *affiché* sur la fiche reste toujours la vraie
   moyenne pondérée, jamais la version ajustée utilisée pour le tri.
8. Identité `User` (compte, authentification) et identité `Member`
   (réputation communautaire) sont distinctes par conception — voir
   `CLAUDE.md` §Architecture. Ne pas les fusionner : c'est ce qui permettra,
   plus tard, une identité de contributeur qui survit à la suppression d'un
   compte, ou une modération différenciée.

## 7. Feuille de route évolutive

Priorisée par ce qui rapproche le plus vite le prototype d'un produit
utilisable en conditions réelles, avec une notion de dépendance explicite.

### Phase 1 — Sortir du prototype mono-navigateur (bloquant pour tout usage réel)

- [ ] Brancher un vrai backend partagé. Supabase est déjà the plan documenté
  (`supabase/schema.sql`, `DEPLOYMENT.md` §Partie 2) : Postgres + Auth +
  RLS, cohérent avec les règles anti-abus du §6 qui doivent être **aussi**
  appliquées côté base, pas seulement côté client.
- [ ] Remplacer l'auth mock (`AppContext.login/register`, mot de passe en
  clair dans `localStorage`) par Supabase Auth. **Le mot de passe en clair
  dans le state applicatif est acceptable pour un prototype de démo mais ne
  doit jamais être reproduit dans une version connectée à un vrai backend.**
- [ ] Migrer chaque fonction de `AppContext.tsx` (aujourd'hui des mutations
  synchrones de state) vers des appels réseau avec gestion d'état de
  chargement/erreur — c'est le changement d'architecture le plus large du
  backlog, à planifier en plusieurs PRs plutôt qu'en un seul gros
  changement.

### Phase 2 — Fiabiliser l'annuaire de confiance en conditions réelles

- [ ] Revendication de fiche prestataire par le prestataire lui-même
  (`claimedByMemberId` existe déjà dans le modèle de données, le parcours
  utilisateur pour le renseigner n'est pas encore construit).
- [ ] Vérification de numéro de téléphone (`Member.phoneVerified` existe déjà
  dans le modèle et pèse dans `memberReliability()`, mais rien ne le fait
  passer à `true` aujourd'hui — SMS OTP ou équivalent à définir).
- [ ] Modération : signalement d'une fiche ou d'un retour abusif, et un
  chemin de traitement (staff produit, dans un premier temps manuel).
- [ ] Élargir la couverture géographique au-delà d'Antananarivo (le modèle
  `DISTRICTS`/`TRADES` dans `src/data/constants.ts` est actuellement
  centré sur l'agglomération d'Antananarivo et les métiers de la
  construction — étendre à d'autres provinces et d'autres secteurs de
  services est une extension de configuration, pas une réécriture).

### Phase 3 — Portail d'opportunités : profondeur

- [ ] Notifications réellement poussées (email / SMS / push) au lieu du fil
  de notifications in-app actuel.
- [ ] Pièces jointes de candidature (CV, portfolio) — aujourd'hui la
  candidature est un message texte simple.
- [ ] Tableau de bord recruteur avec statut de candidature (vu, contacté,
  refusé…) au lieu d'une liste plate.

### Phase 4 — Modèle économique et échelle

- [ ] Définir et instrumenter le modèle de monétisation (à trancher avec les
  parties prenantes métier — mise en avant de fiches, abonnement recruteur,
  commission ? — **ce choix n'est pas encore fait**, ne pas le présumer dans
  le code).
- [ ] Observabilité minimale (analytics produit, taux de conversion
  recommandation → contact, offre → candidature) pour objectiver les
  décisions de priorisation futures.

> Un agent qui reçoit une tâche « ajoute [fonctionnalité] » doit d'abord
> vérifier si elle correspond à un point déjà identifié ici (pour respecter
> les dépendances de phase) ; si elle n'y figure pas, l'ajouter à la phase
> pertinente en même temps que l'implémentation.

## 8. Exigences non fonctionnelles

- **Langue** : produit et code (identifiants, commentaires) en français,
  cohérent avec le marché cible. Ne pas introduire d'anglais dans l'UI.
- **Responsive** : le produit est pensé mobile-first (majorité des usages
  visés sur smartphone à Madagascar) — toute nouvelle page doit être testée
  au moins en largeur mobile.
- **Résilience réseau** : la connectivité peut être intermittente ; une fois
  le backend réel branché (Phase 1), prévoir une dégradation propre (états
  de chargement, messages d'erreur explicites) plutôt que des écrans blancs.
- **Coût d'infrastructure** : rester sur les paliers gratuits/faibles de
  Vercel + Supabase tant que le produit n'a pas de revenus — éviter toute
  dépendance payante non indispensable à ce stade.
- **Accessibilité** : pas d'exigence formelle (WCAG) fixée à ce stade, mais
  éviter les régressions évidentes (contraste, alternatives textuelles) à
  l'occasion des évolutions.

## 9. Contraintes et risques connus

| Risque | Impact | Mitigation actuelle / prévue |
|---|---|---|
| Pas de backend partagé | Le produit ne peut pas être utilisé au-delà d'une démo mono-navigateur | Phase 1 de la feuille de route |
| Amorçage de l'annuaire (« cold start ») | Un annuaire sans recommandations n'a pas de valeur ; personne ne publie de retour sur un annuaire vide | À traiter au niveau go-to-market (hors code) : import initial de données, partenariats locaux — voir `collecte/` pour l'outillage déjà prévu pour la collecte manuelle de données prestataires |
| Faux avis / manipulation de score | Détruit la promesse de confiance, cœur du produit | Poids de fiabilité auteur + moyenne bayésienne (§6) déjà en place côté client ; à faire respecter aussi côté base une fois le backend branché |
| Mot de passe en clair (prototype) | Non acceptable en production | Ne pas répliquer au-delà du prototype ; remplacé par Supabase Auth en Phase 1 |

Un outil de collecte de données existe déjà (`collecte/import-collecte.mjs`,
`collecte/GUIDE-COLLECTE.md`, `collecte/modele-collecte.csv`) pour peupler
l'annuaire avec de vrais prestataires avant un lancement — à utiliser plutôt
que de ré-écrire un import ad hoc si une tâche future implique d'importer des
données de prestataires.

## 10. Indicateurs de succès (à instrumenter, Phase 4)

Pour l'instant qualitatifs (posture hackathon), à quantifier dès que
l'observabilité (Phase 4) existe :

- Annuaire : nombre de fiches avec au moins une recommandation à preuve
  (facture/photo), taux de confirmation, part des fiches en confiance
  « forte ».
- Portail d'opportunités : taux de candidature sur offre recommandée en tête
  de fil vs. offre découverte par recherche libre (validerait ou non le
  moteur de scoring).

## 11. Glossaire

| Terme | Définition |
|---|---|
| Prestataire (`Provider`) | Artisan, fournisseur ou transporteur référencé dans l'annuaire |
| Membre (`Member`) | Identité communautaire qui porte la réputation ; distincte du compte `User` (voir §6.8) |
| Recommandation | Retour d'un membre sur un chantier réel avec un prestataire ; unité de base du moteur de confiance |
| Confiance (`TrustResult`) | Sortie du moteur de `src/lib/trust.ts` : score, niveau de confiance, raisons, alertes |
| Prix constaté | Médiane des prix réellement payés pour un prestataire, par unité de facturation |
| Opportunité (`Opportunity`) | Offre publiée par un recruteur : emploi, stage, mission, freelance ou alternance |
| Score de correspondance (`MatchResult`) | Sortie du moteur de `src/lib/recommendation.ts` : classe les offres pour un profil candidat |

---

*Ce document décrit l'état au 2026-08-17. Toute PR qui change le périmètre
fonctionnel, le modèle de données ou une règle métier du §6 doit mettre ce
fichier à jour dans le même commit.*
