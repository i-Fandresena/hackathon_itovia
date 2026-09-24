# OffRec — Passation fonctionnelle et technique

**Destinataire :** développeur reprenant le produit pour le finaliser.
**Date de l'audit :** 24 septembre 2026.
**Périmètre :** inventaire de l'existant, ce qui marche en production, ce qui ne marche pas, ce qui manque, et par où commencer.

> Ce document complète `HANDOFF_DEPLOIEMENT_VPS.md` (infrastructure, déploiement) et `fiche-technique-offrec.md` (chiffres marché sourcés, modèle économique, KPI). Ici on parle **produit et code**.

---

## 1. À lire en premier (5 minutes)

OffRec est une plateforme malgache de mise en relation emploi. Sa promesse : **vérifier les compétences plutôt que les diplômes**, avec deux canaux — vérification humaine par des agents de terrain pour les non-diplômés, matching automatisé pour les diplômés — OffRec restant **l'unique intermédiaire** (ni candidat ni entreprise ne se contactent directement avant validation).

**L'état réel en une phrase :** le socle technique est complet et déployé, le parcours « entreprise ↔ candidat diplômé » fonctionne de bout en bout avec de vrais utilisateurs, mais **le différenciateur du produit — le volet non-diplômé — n'a jamais été utilisé une seule fois en conditions réelles**, et plusieurs parcours secondaires sont des impasses.

**Les trois choses à traiter en priorité :**

1. Une **faille de sécurité** sur la vérification email (§4.1) — permet de créer un compte avec l'adresse d'un tiers.
2. **Aucune notification sortante** hors vérification email (§6.4) : un candidat à qui on propose une offre ne l'apprend que s'il revient sur le site de lui-même. Dans un pays à 20 % de pénétration internet, c'est le trou le plus coûteux du produit.
3. Le **pipeline non-diplômé n'a jamais tourné** (§3.6, §6.1) : zéro demande de contact déposée, zéro compte de suivi créé. Soit le parcours est inaccessible en pratique, soit il n'a pas été mis devant des utilisateurs.

---

## 2. Ce qui tourne en production aujourd'hui

**URL :** https://offrec.qualitec.mg — en ligne, API `/api/health` répond.

| Composant | État | Détail |
|---|---|---|
| API Node/Express | ✅ en ligne | pm2 `offrec-api`, 21 jours d'uptime sans incident |
| Frontend React | ✅ en ligne | conteneur Docker `offrec-web` (nginx), 3 semaines |
| PostgreSQL | ✅ en ligne | conteneur `hackathon_itovia-db-1`, 10 migrations Prisma appliquées |
| Envoi d'emails (Resend) | ⚠️ fonctionne, mais spam | SPF/DKIM/DMARC corrects, domaine vérifié — voir §4.2 |
| IA (Gemini) | ⚠️ opérationnel, non branché | clé valide, modèle `gemini-3.6-flash` testé OK — mais aucun écran ne l'appelle (§5.1) |

### Volumétrie réelle (base de production)

| Donnée | Volume | Lecture |
|---|---|---|
| Comptes | 32 dont **13 réels** (3 candidats, 10 recruteurs) | inscription réelle fonctionnelle |
| Offres publiées | 14 | publication fonctionnelle |
| Suggestions de mise en relation | 10 | le pipeline admin a réellement servi |
| Profils talents (non-diplômés) | 7 + 5 vérifications | créés par agents, **tous en données de démo** |
| Annuaire | 10 prestataires, 29 recommandations | données de collecte terrain |
| Placements déclarés | 4 | success fee amorcé |
| Messages | 10 dans 5 conversations | messagerie utilisée |
| Pistes de veille agent | 3 | fonctionnalité récente, peu utilisée |

### Volumétrie à zéro — ce qui n'a jamais servi

| Donnée | Volume | Ce que ça signifie |
|---|---|---|
| `TalentLead` | **0** | Le formulaire « je n'ai pas de diplôme mais je sais faire un métier » n'a jamais été rempli |
| `TalentAccountProfile` / comptes `talent` | **0** | Aucun compte de suivi non-diplômé n'existe |
| `Application` | **0** | Modèle mort (ancien produit, avant le pivot) |
| `Report` | **0** | La modération n'a jamais été déclenchée |
| `Bookmark` | **0** | Les favoris candidat ne servent pas |

### Comptes de démonstration

| Rôle | Email | Mot de passe |
|---|---|---|
| Candidat | `candidat@demo.mg` | `demo123` |
| Recruteur | `recruteur@demo.mg` | `demo123` |
| Agent de terrain | `agent.analamanga@demo.mg` | `demo123` |
| Particulier | `particulier@demo.mg` | `demo123` |
| Admin (démo) | `admin@demo.mg` | `demo123` |
| Admin (réel, production) | `administration.offrec@qualitec.mg` | *demander à l'équipe — jamais committé* |

---

## 3. Inventaire fonctionnel par rôle

### 3.1 Visiteur non connecté — ⚠️ une impasse

**Fonctionne :** page d'accueil, annuaire de confiance public (`/annuaire`) avec recherche, filtres métier/quartier et tri par score de confiance, fiche prestataire avec téléphone/WhatsApp et signalement, inscription/connexion, vérification email.

**Manque / cassé :**
- La carte « Artisans & fournisseurs » de l'accueil renvoie vers l'inscription, mais **l'inscription n'offre pas ce parcours** (seulement candidat / recruteur / particulier). Un artisan qui veut se référencer n'a aucun chemin.
- L'annuaire invite à « ajouter la fiche d'un prestataire » — la fonction `addProvider` existe dans `src/context/AppContext.tsx` et l'endpoint `POST /api/directory/providers` fonctionne, mais **aucune page ne les appelle**. Le formulaire n'a jamais été construit.

### 3.2 Candidat diplômé — ✅ le plus abouti côté utilisateur final

**Fonctionne :** tableau de bord (statistiques, top suggestions), profil complet avec **upload de CV PDF et extraction de compétences suggérées**, fil d'offres recommandées (uniquement celles qu'OffRec lui propose — jamais le catalogue complet, c'est volontaire), détail d'offre avec score de compatibilité expliqué, Postuler / Annuler sa candidature, favoris, notifications cliquables.

**Manque :**
- **Pas de page « mes candidatures »** : pour connaître l'état d'une candidature, il faut rouvrir chaque offre une par une.
- Le candidat est **exclu de la messagerie** (choix produit assumé : OffRec est l'intermédiaire), mais `Messages.tsx` contient encore le texte « Échangez directement avec les recruteurs et candidats » — texte mort à nettoyer.
- Aucun moyen de supprimer son compte ou d'exporter ses données (§6.6).

### 3.3 Recruteur / entreprise — ✅ parcours le plus complet

**Fonctionne :** tableau de bord, publication et modification d'offres (avec champs conditionnels par secteur BTP/digital), liste et suppression d'offres, shortlist par offre distinguant **talents vérifiés par un agent** et **profils matchés** (jamais confondus, c'est une règle métier), marquer son intérêt / écarter un profil, déclaration de placement avec salaire, suivi du success fee en 2 étapes, abonnement (paiement simulé), messagerie restreinte à OffRec avec **réponse automatique par IA au tout premier message**.

**Manque :**
- La shortlist d'une offre n'est **accessible que depuis « Mes offres »** — pas de vue consolidée de tous les candidats proposés par offre.
- L'abonnement est un paiement **simulé** : aucun opérateur (Mvola/Orange Money/carte) n'est branché.
- Aucune facture ni justificatif généré, alors que le success fee est le cœur du modèle économique (§6.5).

### 3.4 Agent de terrain — ✅ cohérent et complet

**Fonctionne :** tableau de bord avec statistiques personnelles, demandes de contact entrantes (marquer contacté / convertir en profil / ignorer), **veille** (journaliser une piste repérée en ligne ou sur le terrain, la suivre jusqu'à conversion), création et modification de profils talents, **grille de vérification standardisée par métier** avec note, proposition d'un talent vérifié à une offre.

**Manque :** rien de bloquant. Seul angle mort : l'agent ne voit pas ce que devient un talent qu'il a proposé (pas de retour sur le placement).

### 3.5 Administrateur OffRec — ⚠️ le back-office est le maillon faible

**Fonctionne :** tableau de bord (statistiques utilisateurs, KPI emploi dont part de femmes, revenus simulés, activité journalisée), **mise en relation** — le cœur : vivier de candidats classé par score, aperçu du profil complet en modale, proposer / annuler, transmettre au recruteur, débloquer le contact, écarter — modération des signalements (5 niveaux : classement, avertissement, restriction, suspension, bannissement), placements de tous les recruteurs avec correction d'étape journalisée, création de comptes agents.

**Manque — c'est ici que le travail est le plus utile :**
- **Aucune gestion des utilisateurs** : impossible de lister, rechercher, consulter, désactiver un candidat, un recruteur ou un particulier depuis le back-office.
- **Aucune gestion de l'annuaire** : impossible de modérer une fiche prestataire ou une recommandation depuis l'admin.
- `/admin/agents` ne fait que **créer** un agent : pas de liste, pas de désactivation, pas de suivi d'activité.
- Aucune gestion des abonnements/facturation.
- La file de mise en relation n'a **ni filtre, ni recherche, ni priorisation** — ingérable au-delà de quelques dizaines de dossiers (§6.3).

### 3.6 Particulier et Talent — ❌ deux impasses

**Particulier** (9 comptes en base) : son tableau de bord est un simple champ de recherche qui redirige vers l'annuaire. Aucune donnée propre, aucun historique, aucun favori. Le lien « Messages » de son menu mène à une page où **il n'a aucun moyen d'ouvrir une conversation** (le bouton « Contacter OffRec » est réservé aux recruteurs). La page « recommander un prestataire » existe mais n'est dans aucun menu.

**Talent** (compte de suivi non-diplômé, **0 compte existant**) : une seule page en lecture seule affichant le statut de vérification. C'est un choix produit assumé (§7 — seul un agent peut créer/modifier un profil talent), mais le lien « Messages » de son menu débouche sur la même impasse. **Ce rôle n'a jamais été exercé par un vrai utilisateur.**

---

## 4. Ce qui ne marche pas — bugs et failles

### 4.1 🔴 Faille : le token de vérification email est exposé publiquement

**Où :** `server/src/routes/verification.routes.ts` (`GET /status`) et `server/src/routes/auth.routes.ts` (`POST /register`).

`GET /api/verification/status?email=<email>` renvoie **le token de vérification en clair, sans aucune authentification**, dès qu'une vérification a abouti pour cet email. Cet endpoint existe pour que la modale d'inscription détecte automatiquement un clic sur le lien reçu par email (fonctionnalité légitime), mais il ne protège pas le token.

Aggravant : `POST /register` vérifie `verifiedAt` et l'email, **mais pas `expiresAt`**. Le délai de 10 minutes n'est donc pas appliqué à cette étape. Conséquence : si quelqu'un vérifie son adresse puis abandonne l'inscription, son token reste exploitable **indéfiniment** par toute personne connaissant son adresse email.

**Scénario d'attaque :** un tiers appelle `/status?email=victime@gmail.com`, récupère le token, appelle `/register` avec cet email et son propre mot de passe → il possède un compte à l'adresse de la victime.

**Correctif suggéré :** ne plus renvoyer le token dans `/status` (renvoyer seulement `{verified: true}` et faire consommer le token par la session/onglet qui a initié la demande, via un identifiant de session de vérification stocké côté client) **et** contrôler `expiresAt` dans `register`. Purger aussi les records expirés.

### 4.2 🟠 Les emails de vérification arrivent en spam

Diagnostic déjà fait, à ne pas refaire : SPF, DKIM et DMARC sont **corrects et vérifiés**, le domaine d'envoi `aura-plus.site` est validé côté Resend, et tous les envois ressortent en `delivered` (acceptés par le serveur destinataire). Le format de l'email a déjà été amélioré (version texte + HTML, reply-to réel, identification de l'expéditeur, code retiré du sujet).

**Cause restante :** `aura-plus.site` est un domaine récent, emprunté, sans historique d'envoi, sur un TLD `.site` — Gmail filtre agressivement ce profil quelle que soit la conformité technique. **Ce n'est pas corrigeable par le code.** Deux options : configurer l'envoi depuis `offrec.qualitec.mg` (domaine déjà lié au produit, meilleure cohérence de marque), ou laisser la réputation d'`aura-plus.site` se construire dans le temps.

### 4.3 🟠 Un échec réseau peut laisser une page en chargement infini — corrigé partiellement

Le motif `apiXxx().then(setState)` sans `.catch()` laissait l'écran bloqué sur le spinner à la moindre erreur. **9 pages ont été corrigées** (état d'erreur + bouton « Réessayer »). À vérifier sur toute nouvelle page : ne jamais charger de données sans gérer l'échec.

### 4.4 🟡 Points de vigilance mineurs

- `/api/admin` est monté **avant** `/api/admin/matching` : les requêtes matching traversent deux fois le garde admin. Sans effet aujourd'hui, mais fragile.
- Les favoris sont éclatés entre deux routeurs : `POST/DELETE /opportunities/:id/bookmark` d'un côté, `GET /applications/mine/bookmarks` de l'autre (héritage du modèle mort).
- Bundle JS monolithique de ~560 kB (aucun découpage par route) — pénalisant sur connexion lente, ce qui est précisément le contexte d'usage visé.

---

## 5. Code mort à supprimer

À traiter en un seul passage de nettoyage — gain de lisibilité immédiat pour qui reprend le projet.

### 5.1 Tout le domaine IA (front + back) — décision produit à prendre

4 endpoints existent, fonctionnent, et **ne sont appelés par rien** :

| Endpoint | Fonction front correspondante | Usage |
|---|---|---|
| `POST /api/ai/match-explanation` | `apiAiMatchExplanation` | 0 import |
| `POST /api/ai/assistant` | `apiAiAssistant` | 0 import |
| `POST /api/ai/summarize-profile` | `apiAiSummarizeProfile` | 0 import |
| `POST /api/ai/summarize-provider/:id` | `apiAiSummarizeProvider` | 0 import |

La seule IA réellement active en production est la **réponse automatique au premier message d'une entreprise** (dans `messages.routes.ts`), qui fonctionne bien.

⚠️ **Décision à prendre, pas juste un nettoyage :** le pitch produit met en avant le « matching intelligent ». Aujourd'hui le score affiché est **déterministe** (`src/lib/recommendation.ts` : compétences 40 %, localisation 25 %, niveau 15 %, type 15 %, disponibilité 5 %) — ce qui est honnête et explicable, un vrai atout. Soit on branche ces endpoints pour enrichir l'explication, soit on les supprime ; les laisser en l'état entretient une ambiguïté.

### 5.2 Le modèle `Application` (ancien produit, avant le pivot)

0 ligne en base, aucune route de création. Subsistent : `GET /applications/mine`, `GET /applications/received`, `PUT /applications/:id/status` (qui crée encore une notification !), le modèle `Application` dans `schema.prisma`, `applicationStatusSchema` dans `validation.ts`, le `_count.applications` de `opportunities.routes.ts`, et un compteur « Candidatures » affiché dans les statistiques admin (toujours à 0).

⚠️ Conserver `GET /applications/mine/bookmarks` (seule route vivante du fichier) ou la déplacer vers le routeur opportunités.

### 5.3 Endpoints sans interface

- `GET /api/opportunities/mine` et `GET /api/opportunities/:id` — jamais appelés.
- `GET /api/directory/providers` et `/providers/:id` — le classement par score de confiance est refait côté client depuis `/raw`.
- `POST /api/directory/providers/:id/claim` — **capacité complète sans interface** : un prestataire peut revendiquer sa fiche (ce qui exclut ses propres recommandations du score, règle anti-abus importante). À exposer plutôt qu'à supprimer.
- `POST /api/messages/conversations` — atteignable seulement via `apiStartConversation`, jamais importée.

---

## 6. Analyse : besoins anticipés et manques structurels

### 6.1 🔴 Le différenciateur du produit n'a jamais été exercé

C'est le constat le plus important de cet audit. Le positionnement d'OffRec repose sur la vérification humaine des travailleurs non-diplômés. Or : **0 demande de contact déposée, 0 compte de suivi créé**, et les 7 profils talents existants proviennent tous des données de démonstration. Pendant ce temps, 10 recruteurs et 3 candidats diplômés se sont inscrits réellement.

Autrement dit : **le produit dérive vers ce qu'il affirme ne pas être** — un portail d'offres de plus. Avant d'ajouter des fonctionnalités, il faut comprendre pourquoi. Hypothèses à tester : le formulaire est-il trouvable depuis l'accueil ? Est-il réaliste de demander à un maçon sans diplôme de remplir un formulaire web alors que la cible n'a que 20 % d'accès internet ? Le canal d'entrée ne devrait-il pas être **l'agent lui-même** (déjà outillé, via la veille) plutôt que l'auto-inscription ?

### 6.2 🔴 Le parcours « prestataire de l'annuaire » n'existe pas

L'annuaire de confiance est présenté comme le premier levier monétisable. Pourtant un artisan ne peut ni créer sa fiche, ni la revendiquer, alors que **les deux endpoints existent et fonctionnent**. C'est le meilleur rapport valeur/effort du backlog : l'essentiel du travail serveur est déjà fait.

### 6.3 🟠 Le back-office ne tiendra pas la charge du pilote

Le pilote vise 150 à 200 profils vérifiés sur 6 mois. Chaque mise en relation demande aujourd'hui **trois actions manuelles d'un admin** (proposer → transmettre → débloquer), dans une file sans filtre, sans recherche, sans tri, sans priorisation, sans alerte sur les dossiers qui stagnent. À 20 dossiers ça passe ; à 200 c'est ingérable. Besoins : filtres et recherche, indicateur d'ancienneté, actions groupées, et une vue « ce qui attend depuis plus de X jours ».

### 6.4 🔴 Aucune boucle de rappel vers l'utilisateur

Les notifications sont **uniquement in-app**. Un candidat à qui OffRec propose une offre ne l'apprend que s'il revient spontanément sur le site. Une entreprise dont un candidat s'est dit intéressé idem. Le seul email envoyé est celui de la vérification.

Dans un pays à **20 % de pénétration internet contre 66 % de couverture mobile** (chiffres sourcés dans la fiche technique), c'est structurellement le trou le plus coûteux : le produit suppose un usage web régulier que la cible n'a pas. La fiche technique prévoit d'ailleurs un canal SMS/WhatsApp — **rien n'est implémenté**. À minima : un email transactionnel sur les 3 événements clés (offre proposée, profil transmis, mise en relation débloquée), l'infrastructure Resend étant déjà en place.

### 6.5 🟠 Le modèle économique n'est pas instrumenté

Le success fee (50 % à la signature, 50 % après période d'essai) est **entièrement déclaratif** : le recruteur avance lui-même les étapes, sans facture générée, sans relance automatique, sans preuve, sans date d'échéance. L'admin peut corriger une étape (c'est journalisé), mais rien ne déclenche ni ne trace un encaissement réel. Et l'abonnement est un paiement simulé.

### 6.6 🟠 Conformité et réversibilité absentes

Le produit stocke des CV, des numéros de téléphone, des données de genre (nécessaires au KPI d'inclusion féminine), et des recommandations nominatives. Il manque : suppression de compte, export de données, politique de confidentialité, mentions légales, durée de conservation. À traiter avant toute mise en avant institutionnelle (EDBM, AFD, ITOVIA sont des interlocuteurs exigeants sur ce point).

### 6.7 🟡 Qualité technique

Aucun test automatisé, aucun ESLint/Prettier. Le seul garde-fou est `npm run build` (qui inclut `tsc --noEmit`). Le code est propre par ailleurs (aucun TODO/FIXME traînant). Vu la densité de règles métier (transitions de statut, anti-abus du score de confiance), **quelques tests ciblés sur le moteur de scoring et la machine à états des mises en relation** rapporteraient beaucoup plus que n'importe quel test d'interface.

---

## 7. Règles métier à ne jamais casser

Ces invariants portent la promesse du produit. Les enfreindre casse le positionnement, pas seulement le code.

1. **Seul un agent crée ou modifie un profil talent non-diplômé.** Le compte de suivi (`talent`) observe, il n'écrit jamais. Un profil n'est « vérifié » qu'après une vérification humaine réelle via la grille standardisée par métier.
2. **Ne jamais confondre un profil vérifié humainement et un profil matché automatiquement.** Le badge de provenance est toujours visible côté recruteur.
3. **OffRec est l'unique intermédiaire.** Aucun contact direct candidat ↔ entreprise avant le statut `mise_en_relation`. L'identité de l'entreprise est masquée au candidat jusque-là.
4. **Le score de confiance de l'annuaire ne se vend pas.** Jamais de meilleur score payant, jamais de suppression d'avis négatif, jamais de revente de données de contributeurs.
5. **Anti-abus de l'annuaire** : une recommandation par membre et par prestataire, pas d'auto-recommandation, pas d'auto-confirmation, aucune suppression d'avis. Le poids d'un avis dépend de la preuve fournie (facture > photo > aucune), de sa fraîcheur et de la fiabilité de son auteur.
6. **Vie privée terrain** : noms réels et téléphones privés des membres ne doivent jamais atterrir dans les données de démonstration, l'annuaire public ou l'interface.
7. **Ne jamais inventer de chiffres d'adoption.** Les statistiques affichées sur l'accueil sont des chiffres **marché** sourcés, pas des chiffres d'usage. Toute donnée de traction doit être vérifiable.

---

## 8. Backlog proposé

Priorisation fondée sur l'audit ci-dessus. Les efforts sont indicatifs.

### P0 — à faire avant toute démonstration publique

| # | Sujet | Effort | Pourquoi |
|---|---|---|---|
| 1 | Corriger la faille du token de vérification (§4.1) | 0,5 j | Sécurité : usurpation d'identité possible |
| 2 | Emails transactionnels sur les 3 événements clés (§6.4) | 1–2 j | Sans ça le produit ne rappelle jamais l'utilisateur |
| 3 | Mentions légales + politique de confidentialité + suppression de compte (§6.6) | 1–2 j | Exigence des bailleurs institutionnels |

### P1 — complète le produit

| # | Sujet | Effort | Pourquoi |
|---|---|---|---|
| 4 | Parcours prestataire annuaire : créer et revendiquer sa fiche (§6.2) | 1–2 j | Endpoints déjà faits, meilleur rapport valeur/effort |
| 5 | Gestion des utilisateurs dans le back-office (§3.5) | 2–3 j | Aujourd'hui aucun moyen de gérer un compte |
| 6 | Outillage de la file de mise en relation : filtres, recherche, ancienneté (§6.3) | 2 j | Condition de tenue du pilote à 150-200 profils |
| 7 | Page « mes candidatures » côté candidat (§3.2) | 0,5 j | Trou de parcours visible |
| 8 | Sortir les rôles `particulier` et `talent` de l'impasse (§3.6) | 1–2 j | Deux rôles aujourd'hui sans usage réel |
| 9 | Trancher le sort du domaine IA, puis nettoyer le code mort (§5) | 1 j | Clarté du code et honnêteté du discours produit |

### P2 — durcissement

| # | Sujet | Effort |
|---|---|---|
| 10 | Instrumenter le success fee : factures, échéances, relances (§6.5) | 3–4 j |
| 11 | Canal SMS/WhatsApp pour les notifications (§6.4) | 3–5 j |
| 12 | Tests sur le moteur de scoring et la machine à états (§6.7) | 1–2 j |
| 13 | Découpage du bundle par route (§4.4) | 0,5 j |
| 14 | Modération de l'annuaire depuis le back-office (§3.5) | 1–2 j |

---

## 9. Démarrer en local — le chemin le plus court

Objectif : avoir l'application complète qui tourne sur ta machine, avec des données réalistes, en une quinzaine de minutes. **Tu ne touches jamais à la production** — nous nous chargeons du redéploiement quand ton travail est prêt (§10).

### Prérequis

- **Node.js 22.x** (impératif — Vite 8 l'exige ; un `.nvmrc` est fourni, fais `nvm use`)
- **Docker** (uniquement pour la base de données, c'est le plus simple)
- **Git**

### Étapes

```bash
# 1. Récupérer le code (la branche par défaut contient tout le travail à jour)
git clone https://github.com/i-Fandresena/hackathon_itovia.git
cd hackathon_itovia

# 2. Base de données PostgreSQL locale
docker run --name offrec-db -e POSTGRES_USER=offrec -e POSTGRES_PASSWORD=offrec \
  -e POSTGRES_DB=offrec -p 5433:5432 -d postgres:16

# 3. Backend
cd server
npm install
cp .env.example .env        # puis renseigner les valeurs (voir ci-dessous)
npx prisma migrate deploy   # applique les 10 migrations
npm run seed                # jeu de données de démonstration complet
npm run dev                 # API sur http://localhost:4000

# 4. Frontend (dans un second terminal, à la racine du projet)
npm install
npm run dev                 # interface sur http://localhost:5173
```

### Contenu minimal de `server/.env` en local

```
DATABASE_URL=postgresql://offrec:offrec@127.0.0.1:5433/offrec?schema=public
JWT_SECRET=<n_importe_quelle_chaine_aleatoire_longue>
JWT_EXPIRES_IN=7d
COOKIE_NAME=offrec_session
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
GEMINI_API_KEY=            # facultatif : sans clé, l'IA renvoie « indisponible », rien ne casse
RESEND_API_KEY=            # voir l'encadré ci-dessous
RESEND_FROM_EMAIL=OffRec <verification@ton-domaine-verifie>
```

> ⚠️ **Le piège à connaître avant de perdre du temps.** Sans `RESEND_API_KEY`, **l'inscription est bloquée dans l'interface** : `POST /api/verification/send-code` renvoie une erreur 502 et la modale affiche un échec. Le code est bien journalisé dans la console du serveur en développement, et l'enregistrement est bien créé en base — mais l'interface, elle, s'arrête là.
>
> **Pour développer, tu n'as pas besoin de t'inscrire :** `npm run seed` crée tous les comptes de démonstration directement en base, sans passer par la vérification email. Connecte-toi simplement avec `candidat@demo.mg` / `demo123` (ou n'importe quel compte du tableau §2) et tu as accès à tout le produit.
>
> Tu n'as besoin d'une vraie clé Resend (gratuite, largement suffisante en développement) **que si tu travailles spécifiquement sur le parcours d'inscription**.

### Comptes après `npm run seed`

Tous les comptes de démonstration du tableau §2 sont créés, mot de passe `demo123`. L'admin local est `admin@demo.mg`.

### Vérifier avant de livrer

```bash
npm run build          # à la racine : tsc --noEmit + build Vite
cd server && npm run build   # tsc côté serveur
```

Il n'y a **ni tests ni linter** : ces deux commandes sont le seul filet de sécurité automatique. Fais-les passer avant chaque livraison.

### Conventions du projet

- **Français partout** : interface, commentaires, noms de domaine métier (`annuaire`, `prestataire`, `mise en relation`).
- **CSS classique**, un fichier `.css` par composant, pas de Tailwind ni de CSS-in-JS.
- Les couleurs passent **toujours** par les variables CSS (`var(--color-*)`) — sinon le thème sombre casse.
- **Les migrations Prisma s'écrivent à la main** (`prisma migrate dev` ne fonctionne pas dans cet environnement non interactif) puis s'appliquent avec `prisma migrate deploy`.
- Charger des données sans `.catch()` = page bloquée en chargement infini (§4.3). Toujours prévoir l'état d'erreur.

---

## 10. Répartition du travail

**Toi :** développement en local, sur une branche dédiée (`git checkout -b feat/mon-sujet`), commits et push sur le dépôt. Tu n'as **besoin d'aucun accès au serveur de production**.

**Nous :** revue, fusion vers la branche par défaut (`collab`), migrations de base de données sur la production, redéploiement (pm2 pour l'API, reconstruction du conteneur Docker pour le frontend), vérification en ligne.

**Ce dont nous avons besoin de ta part à chaque livraison :**
1. La liste des migrations Prisma ajoutées (nous devons les appliquer sur la base de production).
2. Les nouvelles variables d'environnement éventuelles (nous les ajoutons au `.env` du serveur, jamais committé).
3. Ce qu'il faut vérifier en ligne après déploiement, et avec quel compte.

**Important :** ne committe jamais de secret (clé API, mot de passe, token). Le `.env` du serveur n'est pas versionné et ne doit pas l'être.

---

## 11. Où trouver quoi

| Sujet | Fichier |
|---|---|
| Règles de collaboration, discipline de livraison | `AGENTS.md` (fait autorité) |
| Architecture, conventions de code | `CLAUDE.md` ⚠️ *partiellement périmé : décrit un stockage navigateur alors qu'un vrai backend PostgreSQL existe depuis* |
| Spécification produit détaillée | `CAHIER_DES_CHARGES.md` |
| Chiffres marché sourcés, modèle économique, KPI du pilote | `update/fiche-technique-offrec.md` |
| Infrastructure, VPS, déploiement | `update/HANDOFF_DEPLOIEMENT_VPS.md` |
| Stratégie, positionnement, garde-fous | `STRATEGIE_OFFREC_2026.md` et le skill `offrec-ceo-strategy` |
| Moteur de score de compatibilité | `src/lib/recommendation.ts` |
| Moteur de score de confiance de l'annuaire | `src/lib/trust.ts` |
| Machine à états des mises en relation | `server/src/routes/admin-matching.routes.ts` (`ADMIN_ALLOWED_TRANSITIONS`) |
| Grilles de vérification par métier | `src/data/verificationGrids.ts` |

---

## 12. Limites de cet audit

Par souci d'honnêteté envers celui qui reprend :

- L'audit porte sur **le code et les données de production au 24 septembre 2026**. Il n'inclut aucun test d'utilisabilité auprès de vrais utilisateurs.
- Les efforts du backlog (§8) sont des **ordres de grandeur**, pas des engagements.
- Le comportement du produit **sur mobile réel en connexion lente n'a pas été mesuré** — or c'est le contexte d'usage principal visé. À tester en priorité sur le terrain.
- Les priorités du §8 sont un avis technique. L'arbitrage produit (notamment sur §6.1 : relancer le volet non-diplômé ou assumer le pivot vers le volet diplômé) appartient à l'équipe.

---

*Document rédigé à partir d'un audit du code, du schéma de base de données et des données réelles de production. Chaque affirmation chiffrée a été vérifiée directement sur l'environnement de production.*
