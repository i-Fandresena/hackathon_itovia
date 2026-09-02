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
retenus tous secteurs confondus. Le projet est présenté devant un jury
d'investisseurs, bailleurs et partenaires incluant EDBM, MDE, ITOVIA et l'AFD
(voir alignement bailleurs dans `STRATEGIE_OFFREC_2026.md`). Le produit doit
donc désormais être lu à deux niveaux :

- **Niveau produit** : un prototype fonctionnel qui démontre l'idée devant un
  jury, avec des données de démonstration crédibles et un parcours fluide.
- **Niveau entreprise** : une idée qui doit convaincre qu'elle a un marché,
  un modèle économique et une trajectoire de croissance au-delà du hackathon.

Les décisions techniques doivent donc arbitrer en gardant ces deux niveaux en
tête : ne pas sur-ingénierier un prototype de démo, mais ne pas prendre de
raccourcis qui rendraient une vraie mise en production impossible à
raisonner.

## 2. Problème et proposition de valeur

Madagascar (zone d'usage initiale : agglomération d'Antananarivo, extension
Analamanga) manque de plusieurs choses que ce produit adresse en un seul
écosystème à deux verticales (§4) :

1. **Trouver un prestataire de confiance** (artisan, fournisseur de
   matériaux, transporteur…) repose aujourd'hui sur le bouche-à-oreille ou
   des groupes Facebook où l'information se perd en quelques semaines. Il
   n'existe pas d'endroit où retrouver « le bon plan » recommandé il y a six
   mois, avec le prix réellement payé. *(verticale annuaire)*
2. **Trouver une opportunité professionnelle** (emploi, stage, mission,
   freelance, alternance) adaptée à son profil réel (compétences, province,
   niveau, disponibilité) est dispersé entre plusieurs canaux informels.
   *(verticale emploi — talents diplômés)*
3. **Faire reconnaître une compétence réelle sans diplôme** : les personnes
   compétentes mais non-diplômées, souvent issues de l'économie informelle
   (très majoritairement des femmes à Madagascar — voir
   `STRATEGIE_OFFREC_2026.md`), sont mal servies par les circuits de
   recrutement classiques qui filtrent sur le diplôme plutôt que la
   compétence réelle. *(verticale emploi — talents non-diplômés, ajouté le
   2026-09-01)*

La proposition de valeur commune aux trois : **transformer une expérience ou
une compétence réelle et vérifiée en information exploitable et durable**,
plutôt qu'une moyenne d'étoiles anonyme, un diplôme comme seul filtre, ou une
offre d'emploi générique. Philosophie transversale à la verticale emploi :
**« Compétences d'abord »**.

## 3. Utilisateurs cibles

Depuis le 2026-09-01, OffRec porte **deux verticales qui coexistent** (voir
§4) : le réseau de confiance du travail local (annuaire) et l'emploi vérifié
(agents de terrain + matching CV). Chaque persona ci-dessous est rattaché à
sa verticale.

| Persona | Verticale | Besoin | Où dans le produit |
|---|---|---|---|
| Particulier / porteur de chantier | Annuaire | Trouver un artisan fiable, savoir combien payer | `/annuaire`, espace `/particulier` |
| Artisan / fournisseur / transporteur | Annuaire | Être trouvé, revendiquer sa fiche, construire une réputation vérifiable | `/annuaire/:id` (fiche), revendication de fiche (non encore implémentée, voir §8) |
| Partenaire B2B local (quincaillerie, microfinance, programme habitat/emploi, association professionnelle) | Annuaire | Identifier un réseau local plus vérifiable, co-financer la collecte | Aucune surface produit dédiée aujourd'hui — relation commerciale hors app, prévue Phase C/D (§8) |
| Talent diplômé (jeune diplômé, freelance) | Emploi | Créer son profil, déposer un CV, être matché à des offres, postuler, suivre ses candidatures | `/candidat/*` (rôle `candidate`, existant) |
| Talent non-diplômé (économie informelle, compétent mais sans diplôme) | Emploi | Voir ses compétences vérifiées par un agent, être recommandé à des entreprises sans barrière du diplôme | Profil vérifié créé et géré **exclusivement par un agent de terrain** (§4.1 du cahier MVP, §7.3 règle 14) ; un compte de connexion "de suivi" optionnel (rôle `talent`) permet de voir son statut, sans pouvoir sur le profil — voir §8 |
| Agent de terrain | Emploi | Créer et vérifier des profils de talents non-diplômés, suivre ses propres indicateurs | Nouveau rôle `agent`, back-office dédié — voir §8 |
| Entreprise | Emploi | Publier des offres, recevoir une shortlist distinguant profils vérifiés humainement et profils matchés par IA, contacter, suivre le success fee d'un placement | `/recruteur/*` (rôle `recruiter`, existant) |
| Administrateur OffRec | Les deux | Superviser utilisateurs, offres, annuaire, KPIs pilote (dont le KPI d'inclusion féminine), statuts financiers | `/admin/*` |

Un même compte (`User`) peut contribuer à l'annuaire de confiance (en tant
que `Member`) quel que soit son rôle candidat/recruteur/particulier — voir
§7.1. Le rôle `agent` est distinct : il gère des profils pour le compte
d'autrui, il ne contribue pas à l'annuaire en tant que `Member`.

## 4. Décision de lancement : deux verticales resserrées, pas une extension généraliste

Décision stratégique (détail et sources dans `STRATEGIE_OFFREC_2026.md`,
révisée le 2026-09-01) : OffRec porte **deux verticales qui coexistent**, sans
priorité affichée entre elles, mais chacune reste **resserrée** — ni job board
généraliste, ni annuaire national tous secteurs, ni déploiement multi-région
simultané sur l'une ou l'autre.

### Verticale « réseau de confiance du travail local » (annuaire)

- **Lancement géographique** : Grand Antananarivo, pilote sur 3 à 5 quartiers.
- **Verticale de départ** : construction et amélioration de l'habitat (celle
  déjà couverte par `TRADES`/`DISTRICTS` dans `src/data/constants.ts`).
- **Canaux** : web mobile léger, WhatsApp/téléphone, onboarding assisté sur
  le terrain.
- **Cibles prioritaires** : porteur de chantier, prestataire, partenaire B2B
  local.

### Verticale « emploi vérifié »

- **Lancement géographique** : région Analamanga en priorité (extension
  possible Haute Matsiatra), alignée sur les régions du programme ITOVIA
  (Analamanga, Haute Matsiatra, Amoron'i Mania, Vakinankaratra) pour maximiser
  l'alignement bailleurs.
- **Double mécanisme** : vérification humaine par agent de terrain pour les
  talents non-diplômés ; matching automatisé par analyse de CV pour les
  talents diplômés. Philosophie « Compétences d'abord ».
- **Cible prioritaire transversale** : les femmes, très majoritaires dans
  l'emploi informel malgache — KPI suivi dès le MVP (voir §8, §10).
- **Canaux** : web mobile léger + notification abstraite (email au MVP,
  SMS/WhatsApp Business API en V2 sans réécriture de l'architecture).

**Ne pas étendre simultanément**, sur l'une ou l'autre verticale, à toutes les
provinces, tous les corps de métier/secteurs, ou au marché de l'emploi
généraliste. Toute extension doit d'abord passer par un pilote local qui
prouve la densité de retours (annuaire) ou le taux de vérification/placement
(emploi) et la capacité de modération (voir Phase E, §8).

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

### 5.3 Plateforme transverse (les deux verticales)

- **RBAC à 4 rôles** appliqué côté serveur : `candidate`, `recruiter`,
  `particulier` (consommateur de l'annuaire), `admin`. Le rôle `agent`
  (verticale emploi) n'existe pas encore — voir §8.
- **Messagerie interne** 1:1, rattachable à une offre.
- **Abonnements + paiement simulé** côté recruteur (grille tarifaire en base,
  jamais codée en dur), **hors mécanisme de success fee par placement** qui
  reste à construire (§8).
- **Modération** : signalement d'une offre, d'une fiche ou d'une
  recommandation, avec pipeline Warning → Restriction → Suspension →
  Bannissement, journalisé (`AuditLog`).
- **Assistant IA (Gemini)** : explication de matching, assistant
  conversationnel par rôle, résumé de profil/fiche — additif, jamais
  décisionnaire (voir §11).

## 6. État technique actuel — à connaître avant toute évolution

> Mis à jour le 2026-09-01 : le backend partagé (Phase A, ex-§8) est
> **livré** — cette section décrivait jusque-là un prototype mono-navigateur
> sans backend ; ce n'est plus le cas, voir ci-dessous.

- **Frontend** : React 19 + TypeScript + Vite 8, React Router 7, Framer
  Motion, Lucide React. Pas de state manager externe, pas de CSS-in-JS (CSS
  simple par composant).
- **Backend réel** (`server/`) : Node/Express + TypeScript + Prisma +
  PostgreSQL. Auth par mot de passe haché (bcrypt) + JWT en cookie httpOnly —
  le mot de passe en clair du prototype initial a été remplacé, pas
  simplement masqué. RBAC (candidat/recruteur/particulier/admin) appliqué
  **côté serveur** (middlewares `requireAuth`/`requireRole`), jamais sur la
  seule foi d'une donnée envoyée par le client.
- **Partage de données** : les deux appareils voient désormais la même
  donnée — `AppContext.tsx` appelle l'API (`src/lib/api.ts`) au lieu de lire
  `localStorage`. `supabase/schema.sql` reste un schéma de référence
  historique mais n'est plus la cible d'implémentation : le backend réel est
  Postgres via Prisma (`server/prisma/schema.prisma`), pas Supabase.
- **Moteurs métier inchangés et réutilisés tels quels** : `src/lib/trust.ts`
  et `src/lib/recommendation.ts` restent la source unique de vérité pour le
  score de confiance et le matching — le backend les importe directement
  plutôt que de les réimplémenter (voir `server/src/routes/directory.routes.ts`,
  `server/src/routes/opportunities.routes.ts`).
- **Fonctionnalités backend livrées au-delà du socle Phase A** : messagerie
  interne (`Conversation`/`Message`), abonnements + paiement simulé
  (`SubscriptionPlan`/`Subscription`/`Transaction`, jamais de prix codé en
  dur côté frontend), modération (`Report`/`ModerationAction`, pipeline
  Warning → Restriction → Suspension → Bannissement, effectif immédiatement
  y compris pour un JWT déjà émis), IA Gemini pour l'assistance et
  l'explication de matching (pipeline anti prompt-injection : séparation
  system/user/données récupérées, additive et jamais bloquante — voir §11
  sur l'IA non décisionnaire).
- **Les statistiques affichées sur la page d'accueil publique** (`STATS`
  dans `src/data/constants.ts` : offres, candidats, recruteurs, provinces)
  restent des **constantes de démonstration** codées en dur sur la landing,
  distinctes des vraies statistiques désormais servies par
  `GET /api/admin/stats` sur le tableau de bord admin. Ne jamais présenter
  `STATS` comme une traction réelle (voir le skill `offrec-ceo-strategy`).
- **Données de démonstration** : `server/prisma/seed.ts` peuple la vraie
  base (comptes, entreprises, offres, annuaire, abonnements, messagerie) —
  les anciens fichiers `src/data/seed.ts`/`seedDirectory.ts` ne sont plus
  branchés au state applicatif, seules leurs constantes de démo (emails/mot
  de passe des comptes témoins) sont encore réutilisées par l'UI de
  connexion.
- **Déploiement** : cible VPS (clonage + build local du frontend et du
  backend, Postgres via `docker-compose.yml` à la racine ou instance dédiée,
  `server/.env` à recréer sur la machine cible à partir de
  `server/.env.example` — jamais committé). `DEPLOYMENT.md` documente encore
  le chemin Vercel/Supabase historique ; il doit être mis à jour ou marqué
  obsolète avant d'être suivi tel quel (voir feuille de route §8).
- **Pas de suite de tests automatisés, pas de configuration ESLint** à ce
  jour, ni côté frontend ni côté `server/`. `npm run build` (frontend) et
  `npm run build` dans `server/` (qui incluent tous deux `tsc` strict) sont
  le seul garde-fou automatique actuel.

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

### 7.3 Verticale emploi vérifié

Règles à respecter dès l'implémentation du rôle agent et des profils talents
non-diplômés (§8) — non négociables au même titre que §7.1/§7.2 :

14. Un profil talent non-diplômé n'est jamais créé sans agent responsable ;
    son statut (`en attente de vérification` / `vérifié` / `recommandé` /
    `placé`) ne peut avancer que par une action de l'agent qui le suit, jamais
    automatiquement.
15. La grille de vérification de compétences est standardisée par métier —
    pas un champ libre — pour rester comparable d'un agent à l'autre.
16. Le champ genre est obligatoire sur un profil talent (diplômé ou non) : le
    KPI d'inclusion féminine (§10) ne peut pas être mesuré sur des données
    incomplètes.
17. Une shortlist envoyée à une entreprise doit **toujours** distinguer
    visuellement un profil vérifié humainement (agent) d'un profil matché par
    IA (diplômé) — ne jamais présenter les deux comme équivalents.
18. Le statut du success fee (`étape1_due`/`étape1_payée`/`étape2_due`/
    `étape2_payée`/`annulé`) est un suivi déclaratif : aucune automatisation
    de paiement n'est requise au MVP, mais le statut doit toujours refléter la
    réalité déclarée par l'entreprise/l'agent, jamais une valeur par défaut
    optimiste.
19. Comme pour l'annuaire (§7, §11) : l'IA (extraction de mots-clés CV,
    matching) reste additive et explicable, jamais seule décisionnaire d'un
    statut de vérification, d'un placement ou d'une décision de modération.

## 8. Feuille de route évolutive

Phases lettrées et priorisées selon la décision de lancement (§4). A → E
couvrent la verticale annuaire (les fondamentaux de confiance A → C passent
avant toute extension D → E) ; F → I couvrent la verticale emploi, ajoutée le
2026-09-01 — les deux jeux de phases avancent en parallèle, sans dépendance
de l'un vers l'autre au-delà du socle commun de la Phase A. Un
agent qui reçoit une tâche « ajoute [fonctionnalité] » doit d'abord vérifier
si elle correspond à un point déjà identifié ici, pour respecter ces
dépendances ; si elle n'y figure pas, l'ajouter à la phase pertinente en même
temps que l'implémentation.

| Phase | Livrable | Critère d'acceptation | Statut |
|---|---|---|---|
| **A — Données partagées** | Backend réel, auth, RLS applicative, migration depuis `localStorage` | Deux appareils voient la même fiche et les règles d'écriture (§7) sont appliquées en base, pas seulement côté client. | **Livré** (2026-09-01, voir détail) |
| **B — Confiance opérationnelle** | Revendication de fiche, vérification téléphone (OTP), signalement, modération, correction factuelle | Personne ne peut modifier son propre score, supprimer un retour ou s'auto-recommander — vérifié en base, pas seulement en UI. | Modération/signalement livrés ; revendication de fiche et OTP restent à faire |
| **C — Pilote terrain (annuaire)** | Import des consentements collectés, tableau de couverture, analytics, contact WhatsApp | Densité de retours, recherche, contact et retour utilisateur sont mesurables sans exposer de données privées. | À faire |
| **D — Revenus (annuaire)** | Espace partenaire, profil professionnel optionnel, offre B2B/organisation | Le paiement ne modifie jamais le score, le rang organique ou la modération (voir §7.2). | Abonnement recruteur + paiement simulé livrés (génériques, pas spécifiques annuaire) ; espace partenaire B2B à faire |
| **E — Extension (annuaire)** | Nouvelle zone géographique, nouvelle verticale, ou approfondissement du portail d'opportunités | Pilote, runbook de collecte, capacité de modération et économie unitaire validés avant d'élargir. | À faire ; voir aussi F-I ci-dessous (l'« extension verticale » a déjà eu lieu via l'emploi vérifié) |
| **F — RBAC emploi** | Rôle `agent`, profils talent non-diplômé (créés/gérés par l'agent, sans compte propre au MVP), grille de vérification par métier | Un agent peut créer un profil et le faire passer `en attente` → `vérifié` ; aucune autre action ne fait avancer ce statut (§7.3). | À faire |
| **G — Matching diplômés** | Upload CV (PDF), extraction texte/mots-clés, score de matching simple, statut de candidature enrichi (`envoyée`/`vue par l'entreprise`/`contactée`/`refusée`) | Un talent diplômé dépose un CV et voit une liste d'offres avec score ; l'entreprise voit le statut réel de chaque candidature. | À faire |
| **H — Shortlist et success fee** | Shortlist 5-10 profils par offre avec badge vérifié-humain vs matché-IA, entité `Placement` avec statut success fee en 2 étapes | La distinction visuelle vérifié/IA est présente sur chaque shortlist ; le statut success fee est visible et modifiable en back-office (§7.3). | À faire |
| **I — KPI et pilote terrain (emploi)** | Tableau de bord admin avec % profils féminins recommandés, nombre d'entreprises partenaires actives, nombre de placements | Le KPI d'inclusion féminine est visible sur `/admin` et calculé à partir de données réelles, pas d'une estimation. | À faire |

### Détail par phase

**Phase A — sortir du prototype mono-navigateur — LIVRÉ (2026-09-01)**
- [x] Backend réel : Node/Express + Prisma + PostgreSQL (`server/`) — décision
  qui diverge du plan initial « Supabase » (schéma toujours documenté dans
  `supabase/schema.sql` à titre historique, mais ce n'est plus la cible).
- [x] Auth bcrypt + JWT en cookie httpOnly, RBAC appliqué côté serveur — le
  mot de passe en clair du prototype n'existe plus.
- [x] `AppContext.tsx` migré vers des appels réseau (`src/lib/api.ts`) avec
  état `hydrated`/erreurs par mutation ; les sélecteurs synchrones existants
  (`isBookmarked`, `hasApplied`…) sont conservés pour limiter la casse sur
  les pages consommatrices.
- Reste à faire dans l'esprit de la Phase A : suite de tests automatisés
  (aucune à ce jour, §6), et RLS Postgres native si un jour le backend est
  interrogé autrement que via l'API Express (pas nécessaire tant que
  l'API reste le seul point d'accès).

**Phase B — fiabiliser l'annuaire de confiance en conditions réelles**
- [ ] Revendication de fiche prestataire par le prestataire lui-même
  (`claimedByMemberId` existe déjà dans le modèle de données, le parcours
  utilisateur pour le renseigner n'est pas encore construit).
- [ ] Vérification de numéro de téléphone (`Member.phoneVerified` existe déjà
  dans le modèle et pèse dans `memberReliability()`, mais rien ne le fait
  passer à `true` aujourd'hui — SMS OTP ou équivalent à définir).
- [x] Modération : signalement d'une fiche, d'une offre ou d'un retour
  abusif, avec décision humaine et journal (`Report`/`ModerationAction`,
  `AuditLog`) — pipeline Warning → Restriction → Suspension → Bannissement
  livré et effectif immédiatement (y compris sur un JWT déjà émis). La
  « correction factuelle » (modification tracée par l'auteur plutôt que
  suppression) reste à faire.

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
- [x] Abonnement recruteur à 4 paliers + paiement simulé (`SubscriptionPlan`/
  `Subscription`/`Transaction`) — générique aux deux verticales, pas
  spécifique à un profil professionnel prestataire.
- [ ] Espace partenaire B2B (pilote de collecte co-financé — quincaillerie,
  microfinance, programme habitat/emploi, association professionnelle).
- [ ] Profil professionnel optionnel pour le prestataire (outils de contact,
  statistiques, fiche enrichie, formation) — jamais un meilleur score ou un
  meilleur rang organique.
- [ ] Observabilité produit (taux de conversion recommandation → contact,
  offre → candidature) pour objectiver ces décisions plutôt que les deviner.
- Prix, coûts (SMS notamment), taux de conversion et marge restent des
  **hypothèses** tant qu'il n'y a pas au moins une lettre d'intention ou un
  pilote payant signé — ne pas les présenter comme un prévisionnel acquis.

**Phase E — extension géographique/verticale de l'annuaire**
- [ ] Élargir la couverture géographique au-delà d'Antananarivo, ou les
  métiers au-delà de la construction (`DISTRICTS`/`TRADES` dans
  `src/data/constants.ts` sont une extension de configuration, pas une
  réécriture) — seulement après validation du pilote (§11).
- [x] Approfondir le portail d'opportunités a eu lieu, mais **comme nouvelle
  verticale à part entière** (emploi vérifié, phases F-I ci-dessous) plutôt
  que comme simple brique complémentaire — décision du 2026-09-01, voir §4
  et `STRATEGIE_OFFREC_2026.md` (journal des changements). Notifications
  réellement poussées (email/SMS/push) restent à faire.

**Phase F — RBAC emploi : rôle agent et talents non-diplômés**
- [ ] Nouveau rôle `agent` (RBAC serveur, §7.3) : back-office dédié, sans
  accès aux fonctions candidat/recruteur/particulier/admin.
- [x] Entité talent non-diplômé : créée et modifiée **uniquement par l'agent**
  qui la suit (§7.3 règle 14, inchangée) ; champs nom, contact, localisation,
  compétences déclarées, disponibilité, **genre (obligatoire)**. Décision du
  2026-09-01 (pas de compte de connexion propre au MVP) **révisée le
  2026-09-02** : un compte de connexion "de suivi" (`TalentAccountProfile`)
  peut désormais être créé en self-service après une demande de contact
  (`TalentLead`), mais il n'a **aucun pouvoir d'écriture** sur le profil
  vérifié — il observe seulement le statut (lead puis, une fois lié, le
  `TalentProfile` réel). Le profil vérifié et la grille de compétences
  restent exclusivement créés/remplis par l'agent.
- [ ] Grille de vérification de compétences standardisée par métier
  (checklist + note qualitative de l'agent) — un référentiel par métier, pas
  un champ libre (§7.3, règle 15).
- [ ] Statut de profil (`en attente de vérification` / `vérifié` /
  `recommandé` / `placé`), historique des opportunités proposées.
- [ ] Indicateurs personnels de l'agent : profils créés, taux de
  vérification, nombre de placements.
- [ ] Architecture de notification abstraite (interface commune), email au
  MVP, SMS/WhatsApp Business API branchable en V2 sans réécriture (§9).

**Phase G — matching des talents diplômés**
- [ ] Upload de CV (PDF) sur le profil candidat existant (`candidateProfile`)
  — en plus de la saisie manuelle déjà supportée, pas en remplacement.
- [ ] Extraction texte + reconnaissance de mots-clés depuis le CV (MVP :
  extraction simple, pas de matching sémantique IA — hors périmètre MVP,
  voir cahier MVP §6). Le score de matching reste `scoreOpportunity()`
  (`src/lib/recommendation.ts`), pas un moteur séparé.
- [ ] Statut de candidature enrichi côté candidat et recruteur (`envoyée` /
  `vue par l'entreprise` / `contactée` / `refusée`) au lieu du champ actuel
  binaire (candidature existe / n'existe pas).

**Phase H — shortlist entreprise et success fee**
- [ ] Génération d'une shortlist de 5 à 10 profils par offre, mêlant profils
  vérifiés humainement (agent) et profils matchés IA (diplômés), avec badge
  visuel distinctif obligatoire sur chacun (§7.3, règle 17).
- [ ] Distinction de statut de compte entreprise `gratuit` / `premium` — peut
  rester un simple flag au MVP, sans construire toutes les fonctionnalités
  premium immédiatement (cahier MVP §4.3).
- [ ] Entité `Placement` : statut success fee en 2 étapes
  (`étape1_due`/`étape1_payée`/`étape2_due`/`étape2_payée`/`annulé`), suivi
  déclaratif en back-office, sans passerelle de paiement automatisée
  (§7.3, règle 18 ; hors périmètre MVP, cahier MVP §6).

**Phase I — KPI pilote et back-office (emploi)**
- [ ] Tableau de bord admin étendu : nombre de profils vérifiés, **%
  de profils féminins recommandés** (KPI d'inclusion prioritaire, §4, §10),
  nombre d'entreprises partenaires actives, nombre de placements réalisés.
- [ ] Vue d'ensemble admin incluant le rôle agent (aujourd'hui : candidats,
  recruteurs, particuliers uniquement).
- Seuils de sortie de pilote emploi : voir `STRATEGIE_OFFREC_2026.md` §
  « Budget et KPIs cibles — pilote emploi » — objectifs internes, pas une
  traction actuelle.

## 9. Exigences non fonctionnelles et techniques

- **Langue** : produit et code (identifiants, commentaires) en français,
  cohérent avec le marché cible. Ne pas introduire d'anglais dans l'UI.
- **Mobile-first et connexion lente** : chaque écran clé doit fonctionner sur
  un écran étroit et une connexion intermittente — cohérent avec le niveau
  de pénétration Internet à Madagascar (voir `STRATEGIE_OFFREC_2026.md`).
  Le backend réel est branché depuis la Phase A (§8) : toute écriture réseau
  doit prévoir un état de chargement, de succès, d'erreur et de reprise —
  pas d'écran blanc.
- **Validation double** : toute règle de domaine (§7) doit être vérifiée
  côté client **et** côté serveur — le backend existe désormais, le client
  seul n'est jamais une garantie suffisante contre l'abus.
- **Notification abstraite (verticale emploi)** : ne jamais coder en dur un
  canal unique — interface commune, email au MVP, SMS/WhatsApp Business API
  branchable en V2 sans réécriture (§8, Phase F).
- **Confidentialité analytique** : les événements produit (§10) sont
  pseudonymisés — ni numéro de téléphone, ni nom complet, ni preuve brute ne
  doit partir vers un outil d'analytics.
- **Tests** : ajouter des tests ciblés pour `trust.ts`, `recommendation.ts`
  et les routes backend sensibles (auth, RBAC, modération) à mesure qu'ils
  gagnent en complexité ; `npm run build` (racine et `server/`) reste la
  vérification minimale obligatoire dans tous les cas.
- **Coût d'infrastructure** : rester sur des paliers gratuits/faibles (VPS
  modeste, Postgres auto-hébergé) tant que le produit n'a pas de revenus.
- **Accessibilité** : pas d'exigence formelle (WCAG) fixée à ce stade, mais
  éviter les régressions évidentes (contraste, alternatives textuelles) à
  l'occasion des évolutions.
- **Littératie numérique variable (verticale emploi)** : les formulaires
  utilisés par les agents de terrain doivent rester simples, utilisables par
  des profils avec un niveau de littératie numérique variable — éviter le
  jargon technique dans l'UI agent (cahier MVP §5).

## 10. Événements et seuils de sortie du pilote

### Verticale annuaire (Phase C)

Instrumenter au minimum ces événements : `provider_viewed`,
`provider_contact_intent`, `recommendation_submitted`,
`recommendation_moderated`, `opportunity_matched`. Chaque événement ne porte
que les identifiants, la zone, la source ou la décision nécessaires à sa
mesure — jamais de contenu personnel brut (§9).

Le pilote annuaire ne peut s'étendre (vers Phase E) que si, **simultanément** :

- au moins 40 prestataires référencés ;
- au moins 3 recommandations par prestataire, en médiane (pas en moyenne —
  une poignée de fiches sur-documentées ne doit pas masquer un pilote trop
  peu profond) ;
- au moins 60 contributeurs distincts ;
- les consentements sont traçables (§7.2) ;
- la modération est opérationnelle (Phase B livrée) ;
- au moins un partenaire confirme la valeur observée.

### Verticale emploi (Phase I)

Instrumenter au minimum : `talent_profile_created`,
`talent_profile_verified`, `cv_uploaded`, `application_status_changed`,
`shortlist_sent`, `placement_status_changed`. Même contrainte de
confidentialité qu'au-dessus — jamais de nom complet, numéro ou CV brut dans
un outil d'analytics, uniquement des identifiants et statuts.

Seuils de pilote emploi (hypothèses de travail, voir
`STRATEGIE_OFFREC_2026.md` § « Budget et KPIs cibles ») : 150 à 200 profils
vérifiés, **au moins 55 à 60 % de profils recommandés via le canal humain
sont des femmes**, 15 à 20 entreprises partenaires fondatrices, taux de
placement de 20 à 30 % des profils recommandés.

Ce sont, sur les deux verticales, des seuils internes de qualité, pas de la
traction à annoncer avant de les avoir atteints.

## 11. Hors périmètre au lancement

Explicitement exclu tant que les phases pertinentes (§8) ne sont pas
validées, sur les deux verticales :

- Paiement ou séquestre (escrow) et règlement des litiges de chantier
  (annuaire).
- Passerelle de paiement automatisée pour les abonnements et le success fee
  (emploi) — suivi déclaratif uniquement au MVP (§7.3, §8 Phase H).
- Matching sémantique avancé par IA/NLP sur les CV (emploi) — extraction de
  mots-clés simple au MVP (§8 Phase G).
- IA opaque qui déciderait à la place des personnes (modération, score,
  statut de vérification, placement) — voir §7.3 règle 19.
- Vente de classement, suppression d'avis ou de coordonnées privées — sous
  quelque forme que ce soit, y compris déguisée en « mise en avant ».
- Application mobile native (le produit reste une web app responsive).
- Système de notation/avis mutuel entreprises-talents (emploi).
- Déploiement national ou multi-province simultané sans opération locale de
  collecte, de vérification et de modération, sur l'une ou l'autre verticale.
- Toute promesse d'emploi, de contrat, de placement ou de prix garanti.

## 12. Contraintes et risques connus

| Risque | Impact | Mitigation actuelle / prévue |
|---|---|---|
| Amorçage de l'annuaire (« cold start ») | Un annuaire sans recommandations n'a pas de valeur ; personne ne publie de retour sur un annuaire vide | Traité au niveau go-to-market : `collecte/` fournit déjà l'outillage de collecte terrain ; voir seuils de sortie de pilote (§10) |
| Faux avis / manipulation de score (annuaire) | Détruit la promesse de confiance, cœur du produit | Poids de fiabilité auteur + moyenne bayésienne (§7.1), appliqué côté serveur depuis la Phase A |
| Statistiques de démonstration présentées comme réelles | Perte de crédibilité si un jury ou partenaire vérifie et découvre que `STATS` est une constante | Ne jamais citer `STATS` (`src/data/constants.ts`) comme donnée mesurée — voir §6 et le skill `offrec-ceo-strategy` |
| Chiffres de marché non vérifiés en interne | Une source mal citée devant un jury nuit à la crédibilité du reste du dossier | Toute statistique de marché doit être vérifiée à la source avant un pitch public — voir `STRATEGIE_OFFREC_2026.md` et le skill `offrec-ceo-strategy` |
| Deux verticales diluent le message investisseur | Un jury peut lire « deux produits » plutôt que « une thèse, deux preuves » | Toujours présenter les deux comme des démonstrations de la même thèse de réputation vérifiable (voir « Réponses jury » dans `STRATEGIE_OFFREC_2026.md`) |
| KPI d'inclusion féminine non atteint | Fragilise l'alignement ITOVIA/AFD, condition implicite du partenariat | Champ genre obligatoire dès la création de profil (§7.3 règle 16) pour pouvoir mesurer, pas seulement viser, le KPI dès le pilote |
| Statut de vérification agent non fiable | Un agent pressé pourrait valider une grille de compétences sans vérification réelle, détruisant la promesse « compétences vérifiées » | Grille standardisée par métier (§7.3 règle 15) + indicateurs personnels de l'agent (taux de vérification) visibles par l'admin (§8 Phase F/I) — pas encore de contrôle qualité croisé, à définir avant le pilote |

## 13. Indicateurs de succès

Pour l'instant qualitatifs (posture hackathon/concours), à quantifier dès que
l'instrumentation (§10) existe :

- Annuaire : nombre de fiches avec au moins une recommandation à preuve
  (facture/photo), taux de confirmation, part des fiches en confiance
  « forte ».
- Portail d'opportunités (diplômés) : taux de candidature sur offre
  recommandée en tête de fil vs. offre découverte par recherche libre
  (validerait ou non le moteur de scoring).
- Emploi vérifié (non-diplômés) : taux de vérification par agent, part de
  profils recommandés qui sont des femmes, taux de placement.
- Pilote terrain (les deux verticales) : voir les seuils de sortie de pilote
  au §10, qui font office de jalon de succès avant toute extension.

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
| Talent non-diplômé | Personne compétente issue de l'économie informelle, sans diplôme requis ; profil créé et vérifié par un agent de terrain (§3, §7.3) |
| Talent diplômé | Jeune diplômé qui crée son propre compte, dépose un CV, reçoit des offres matchées (rôle `candidate` existant) |
| Agent de terrain | Rôle back-office qui crée et vérifie les profils de talents non-diplômés à l'aide d'une grille standardisée par métier (§7.3, §8 Phase F) |
| Grille de vérification | Checklist standardisée par métier + note qualitative de l'agent, qui fait passer un profil talent de « en attente » à « vérifié » (§7.3 règle 15) |
| Placement | Mise en relation aboutie entre un talent (diplômé ou non) et une entreprise, porteuse du suivi success fee (§7.3 règle 18, §8 Phase H) |
| Success fee | Commission en 2 étapes (signature du contrat, confirmation post-période d'essai) due par l'entreprise pour un placement — suivi déclaratif au MVP, pas de paiement automatisé |
| Verticale | Ligne de produit indépendante avec son propre mécanisme de preuve (annuaire = preuve communautaire pondérée ; emploi = vérification humaine par agent + matching CV) ; les deux coexistent depuis le 2026-09-01 (§4) |

---

*Ce document décrit l'état au 2026-09-01 (pivot à deux verticales, voir §4
et le journal des changements de `STRATEGIE_OFFREC_2026.md`). Version
précédente : 2026-08-17, qui remplaçait déjà `CAHIER_DES_CHARGES_V2.md`
(fusionné). Toute PR qui change le périmètre fonctionnel, le modèle de
données ou une règle métier des §7, §10 ou §11 doit mettre ce fichier à jour
dans le même commit.*
