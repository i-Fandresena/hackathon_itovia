# Handoff — déploiement production sur VPS (branche `update`)

> Destiné à un autre agent Claude Code, exécuté directement sur le VPS
> cible. Ce document est autonome : il ne suppose aucun contexte de la
> conversation qui a produit ce code. Suivre les étapes dans l'ordre.
>
> **Ignorer `DEPLOYMENT.md` à la racine du repo** : il décrit un chemin de
> déploiement historique (Vercel + Supabase) qui n'a jamais été branché
> dans `src/` et ne s'applique pas à cette version. Ce fichier-ci est la
> seule référence à jour.

## 0. Ce que tu déploies

OffRec est composé de **deux projets dans un seul repo** :

- **Frontend** (racine du repo) — React 19 + TypeScript + Vite, build
  statique servi par un reverse proxy (Nginx recommandé).
- **Backend** (`server/`) — Node/Express + TypeScript + Prisma + PostgreSQL,
  process long-running (API + auth + IA + upload de CV).

Le backend importe directement certains fichiers du frontend
(`src/lib/trust.ts`, `src/lib/recommendation.ts`, `src/types/index.ts`,
`src/data/constants.ts`) via des chemins relatifs (`../../../src/...`). **Le
repo doit donc être cloné dans son intégralité** — ne clone pas seulement
`server/`, et ne déplace pas `server/` hors de l'arborescence du repo.

Branche à déployer : **`update`** (pas `main`, pas `collab`).

## 1. Prérequis sur le VPS

- Node.js **22.x** (voir `.nvmrc` et `engines.node` dans `package.json` /
  `server/package.json` — Vite 8 et `@vitejs/plugin-react` 6 exigent cette
  version).
- PostgreSQL accessible (via `docker-compose.yml` fourni à la racine, ou une
  instance PostgreSQL déjà installée sur le VPS — les deux fonctionnent).
- Un nom de domaine (ou sous-domaine) pointant vers le VPS, avec **HTTPS**
  configuré (voir §6 — obligatoire, pas optionnel).
- Un gestionnaire de process pour le backend (`pm2`, `systemd`, ou
  équivalent) : **aucune configuration de ce type n'existe encore dans le
  repo**, c'est à toi de la créer et de choisir l'outil.

## 2. Cloner et checkout

```bash
git clone https://github.com/i-Fandresena/hackathon_itovia.git
cd hackathon_itovia
git checkout update
```

## 3. Base de données PostgreSQL

Option A — via `docker-compose.yml` (à la racine du repo) :

```bash
docker compose up -d db
```

Le fichier mappe actuellement le port `5433:5432` **parce que sur la
machine de développement, le port 5432 natif était déjà pris** — ce n'est
pas une contrainte de prod. Si le port 5432 est libre sur le VPS, tu peux
soit garder `5433:5432` (le plus simple, aucune modif requise), soit
changer le mapping en `5432:5432` et ajuster `DATABASE_URL` en conséquence.
Dans tous les cas, `DATABASE_URL` (voir §4) doit correspondre exactement au
port réellement exposé.

Option B — PostgreSQL déjà installé sur le VPS : crée une base et un
utilisateur dédiés, puis renseigne `DATABASE_URL` en conséquence. Le
`docker-compose.yml` n'est alors pas utilisé.

## 4. Variables d'environnement backend (`server/.env`)

Ce fichier est **gitignored** et n'existe pas dans le repo cloné — il faut
le créer à partir de `server/.env.example` :

```bash
cp server/.env.example server/.env
```

Puis éditer `server/.env` avec des valeurs **de production**, distinctes de
celles utilisées en développement :

| Variable | Valeur attendue en prod |
|---|---|
| `DATABASE_URL` | `postgresql://<user>:<pass>@<host>:<port>/<db>?schema=public` — doit pointer vers la base créée en §3 |
| `JWT_SECRET` | **Générer une nouvelle valeur aléatoire longue**, ne jamais réutiliser celle de dev. Exemple : `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `7d` (ou selon préférence produit) |
| `COOKIE_NAME` | `offrec_session` |
| `GEMINI_API_KEY` | Clé Gemini réelle (Google AI Studio). Ne jamais exposer côté frontend, ne jamais committer. |
| `GEMINI_MODEL` | Vérifier qu'il s'agit toujours d'un modèle valide via `GET https://generativelanguage.googleapis.com/v1beta/models?key=<clé>` avant de figer la valeur — les noms de modèles Gemini changent régulièrement |
| `PORT` | `4000` (ou autre, à faire correspondre avec la config du reverse proxy §6) |
| `CORS_ORIGIN` | **Le domaine public réel** servant le frontend, ex. `https://offrec.exemple.mg` — jamais `localhost` en prod |
| `NODE_ENV` | `production` — conditionne le flag `secure` du cookie de session (voir §6) |

Ne jamais committer `server/.env` ni afficher son contenu dans des logs
partagés.

## 5. Variable d'environnement frontend (build-time)

Piège connu et déjà rencontré pendant le développement : `src/lib/api.ts`
lit `import.meta.env.VITE_API_URL`, avec pour défaut
`http://localhost:4000/api`. Cette variable est **injectée au moment du
build Vite**, pas à l'exécution — si elle n'est pas définie *avant*
`npm run build`, le site statique généré appellera `localhost:4000` en
production et toutes les requêtes échoueront silencieusement (CORS/connexion
refusée) une fois déployé.

Avant de builder le frontend, exporte la variable ou crée un fichier `.env`
(ou `.env.production`) à la racine du repo :

```bash
echo "VITE_API_URL=https://offrec.exemple.mg/api" > .env.production
```

Remplacer `https://offrec.exemple.mg/api` par le vrai domaine public,
cohérent avec `CORS_ORIGIN` défini en §4.

## 6. HTTPS obligatoire

En production (`NODE_ENV=production`), le cookie de session JWT est posé
avec le flag `secure: true` (voir `server/src/...` middleware d'auth) : un
navigateur **refuse d'envoyer un cookie `secure` sur une origine HTTP**.
Sans HTTPS effectif de bout en bout (reverse proxy → navigateur), la
connexion semblera réussir côté API mais aucune session ne persistera côté
client — c'est un piège silencieux à vérifier explicitement pendant les
tests post-déploiement, pas seulement au niveau du code.

Mettre en place un certificat (Let's Encrypt via `certbot` typiquement) sur
le domaine choisi avant de considérer le déploiement terminé.

## 7. Build

Frontend (racine du repo) :

```bash
npm install
npm run build   # tsc --noEmit && vite build → sortie dans dist/
```

Backend (`server/`) :

```bash
cd server
npm install
npm run build   # tsc -p tsconfig.json → sortie dans dist/
```

## 8. Migrations et données

Depuis `server/`, avec `server/.env` déjà configuré (§4) et la base
PostgreSQL accessible (§3) :

```bash
npx prisma generate
npx prisma migrate deploy
```

**Utiliser `migrate deploy`, jamais `migrate dev`** — `migrate dev` est
l'outil de développement (il peut réinitialiser/reset la base dans certains
cas) ; `migrate deploy` applique uniquement les migrations déjà commitées
dans `server/prisma/migrations/`, sans prompt interactif, adapté à la prod.

**Seed de données de démo (optionnel)** :

```bash
npm run seed
```

Le script est protégé par une garde d'idempotence (`if (await
prisma.user.count() > 0) return`) — il ne s'exécute que sur une base
**vide**, donc sans risque de double-exécution accidentelle. Il crée des
comptes de démonstration destinés à une présentation/jury, tous avec le mot
de passe `demo123` :

| Rôle | Email |
|---|---|
| Candidat | `candidat@demo.mg` |
| Recruteur | `recruteur@demo.mg` |
| Particulier | `particulier@demo.mg` |
| Admin | `admin@demo.mg` |
| Agent (× 2) | `agent.analamanga@demo.mg`, `agent.terrain2@demo.mg` |

Ne pas exécuter `npm run seed` sur une base destinée à de vraies données
utilisateurs — seulement pour un environnement de démo/staging.

## 9. Dossier d'upload de CV

Le backend écrit les CV PDF uploadés sous `server/uploads/cv/<uuid>.pdf` et
les sert en statique via `express.static` sur `/uploads`
(`server/src/app.ts`). Ce dossier n'est pas versionné (gitignored) :

```bash
mkdir -p server/uploads/cv
```

Le code crée le dossier automatiquement au premier upload
(`mkdir({recursive:true})`), mais s'assurer que le process qui exécute le
backend a les droits d'écriture sur `server/uploads/`. **Ce dossier doit
persister entre les déploiements** (ne pas le supprimer lors d'un futur
`git pull`/redeploy) — sinon les CV déjà uploadés deviennent inaccessibles.

## 10. Lancer le backend

Aucun fichier `pm2.config.js`/unité `systemd` n'existe dans le repo — à
créer selon l'outil choisi sur ce VPS. Le point d'entrée compilé est
`server/dist/index.js` (`npm start` dans `server/` équivaut à `node
dist/index.js`), et lit ses variables depuis `server/.env` via `dotenv`.

Exemple minimal avec `pm2` :

```bash
cd server
pm2 start dist/index.js --name offrec-api
pm2 save
```

Le process doit tourner en continu (redémarrage auto en cas de crash,
survie au reboot du VPS).

## 11. Reverse proxy

Le frontend est un site statique (`dist/` à la racine du repo, généré en
§7) : servir son contenu directement par Nginx (ou équivalent). Router :

- `/` → fichiers statiques de `dist/` (avec fallback SPA vers `index.html`
  pour les routes React Router côté client).
- `/api/*` → proxy vers le backend (`http://127.0.0.1:<PORT>`, `PORT` défini
  en §4).
- `/uploads/*` → proxy vers le backend également (les CV sont servis par
  Express, pas par Nginx directement).

Certificat HTTPS sur ce même virtual host (§6).

## 12. Vérification post-déploiement

1. `GET https://<domaine>/api/health` doit répondre `{"ok":true,"timestamp":"..."}`.
2. Se connecter avec un compte seedé (§8) depuis un navigateur réel, sur le
   domaine HTTPS public — vérifier que la session persiste après un
   rafraîchissement de page (test direct du piège cookie `secure`, §6).
3. Tester un appel qui dépend de `CORS_ORIGIN` (n'importe quelle requête
   authentifiée) — une erreur CORS dans la console navigateur indique un
   mauvais réglage de `CORS_ORIGIN` (§4) ou `VITE_API_URL` (§5).
4. Tester l'upload d'un CV candidat (`/candidat/profil`) pour valider les
   droits d'écriture sur `server/uploads/` (§9) et le rendu du fichier
   servi en statique.
5. Si une clé Gemini réelle est configurée, tester une fonctionnalité IA
   (ex. suggestions côté candidat/recruteur) pour confirmer que
   `GEMINI_API_KEY`/`GEMINI_MODEL` sont valides.

## 13. Contexte produit (pour comprendre ce qui est déployé)

Cette branche ajoute une seconde verticale produit, « emploi vérifié »
(agents de terrain qui vérifient des talents non diplômés + matching
CV/IA pour diplômés + shortlist entreprise + suivi de placement/success
fee), en plus de l'annuaire de confiance existant. Détails fonctionnels et
justification stratégique : `update/cahier-des-charges-offrec-mvp.md`,
`update/fiche-technique-offrec.md`, et les mises à jour correspondantes
dans `CAHIER_DES_CHARGES.md` / `STRATEGIE_OFFREC_2026.md` à la racine du
repo. Rien de tout cela n'affecte les étapes de déploiement ci-dessus — ce
sont des routes/pages applicatives supplémentaires, pas des changements
d'infrastructure.
