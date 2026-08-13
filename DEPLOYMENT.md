# Déployer OffRec sur Vercel (avec base de données)

## Vue d’ensemble

| Composant | Rôle |
|-----------|------|
| **Vercel** | Héberge le front React (build Vite) |
| **Supabase** | PostgreSQL + Auth (recommandé pour ce prototype) |
| **localStorage** | Mode actuel sans Supabase (données par navigateur uniquement) |

Sans base externe, l’app **fonctionne sur Vercel** mais chaque visiteur a ses propres données dans son navigateur (pas de partage entre utilisateurs).

Pour une **vraie base partagée** (offres visibles par tous, candidatures persistées), suivez aussi la partie Supabase ci-dessous.

---

## Partie 1 — Déploiement front sur Vercel (15 min)

### Prérequis

- Compte [Vercel](https://vercel.com)
- Dépôt GitHub : `https://github.com/i-Fandresena/OffRec`

### Étapes

1. Connectez-vous sur [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. **Import** le repo GitHub `OffRec`.
3. Vercel détecte **Vite**. Vérifiez :

   | Paramètre | Valeur |
   |-----------|--------|
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |
   | Node.js Version | **22.x** |

   > **Version de Node — cause d'échec la plus fréquente ici.** Vite 8 et
   > `@vitejs/plugin-react` 6 exigent Node `^20.19` ou `>=22.12`. Le projet
   > déclare donc `engines.node: "22.x"` dans `package.json` (et `.nvmrc`),
   > ce que Vercel lit pour choisir sa version. Si un build échoue dès
   > l'installation ou au lancement de `vite`, vérifiez d'abord ce réglage
   > dans **Project → Settings → General → Node.js Version** : un projet
   > créé il y a plusieurs mois peut être resté figé sur une version
   > antérieure, incompatible avec la chaîne de build actuelle.

4. **Environment Variables** (premier déploiement, optionnel) :

   ```
   VITE_USE_SUPABASE=false
   ```

5. Cliquez **Deploy**.

6. Après le build, ouvrez l’URL `https://offrec-xxx.vercel.app`.

### Routing (React Router)

Le fichier `vercel.json` redirige toutes les routes vers `index.html` pour que `/candidat`, `/connexion`, etc. fonctionnent au rechargement.

### Tester la démo en production

- Candidat : `candidat@demo.mg` / `demo123`
- Recruteur : `recruteur@demo.mg` / `demo123`

Les comptes démo sont dans le **seed JavaScript** ; en production sans Supabase, ils restent utilisables tant que le navigateur n’a pas vidé le stockage local.

---

## Partie 2 — Base de données Supabase (recommandé)

Vercel ne fournit pas une base SQL intégrée « en un clic » pour une app Vite seule. Le duo standard est :

**Vercel (front) + Supabase (PostgreSQL + Auth).**

### 2.1 Créer le projet Supabase

1. [supabase.com](https://supabase.com) → **New project**.
2. Choisissez une région proche (ex. `eu-west-1` ou la plus proche de Madagascar possible).
3. Notez le mot de passe base de données.

### 2.2 Créer les tables

1. Supabase → **SQL Editor** → **New query**.
2. Collez le contenu de `supabase/schema.sql` du repo.
3. **Run**.

### 2.3 Récupérer les clés API

Supabase → **Project Settings** → **API** :

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY`

Ne commitez jamais la clé `service_role` côté front.

### 2.4 Variables sur Vercel

Vercel → votre projet OffRec → **Settings** → **Environment Variables** :

| Name | Value | Environments |
|------|-------|----------------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` | Production, Preview, Development |
| `VITE_USE_SUPABASE` | `true` | Production, Preview, Development |

Puis **Redeploy** (Deployments → … → Redeploy).

### 2.5 Auth Supabase (pour plus tard)

Le code actuel utilise une auth **mock** (localStorage). Pour lier Supabase Auth :

1. Supabase → **Authentication** → **Providers** → activer **Email**.
2. (Optionnel) Désactiver « Confirm email » en phase hackathon.
3. Une prochaine évolution du code remplacera `AppContext` par des appels Supabase.

En attendant, vous pouvez **peupler** `opportunities` via le SQL Editor pour des offres partagées visibles par tous (lecture publique prévue dans le schéma).

Exemple d’insertion manuelle :

```sql
insert into public.opportunities (
  recruiter_id, company_name, title, category, description,
  province, city, opportunity_type, required_skills, level, deadline, featured
) values (
  '00000000-0000-0000-0000-000000000001', -- remplacer par un vrai profile id
  'TechMada Solutions',
  'Assistant marketing digital',
  'Marketing',
  'Description de l''offre…',
  'Antananarivo',
  'Antananarivo',
  'emploi',
  array['Réseaux sociaux', 'Canva'],
  'junior',
  '2026-12-31',
  true
);
```

---

## Partie 3 — Alternative : Vercel Postgres (Neon)

1. Vercel → projet → **Storage** → **Create Database** → **Postgres** (Neon).
2. Vous obtenez `POSTGRES_URL` (côté serveur uniquement).
3. Il faudrait ajouter des **Vercel Serverless Functions** (`/api/*`) : le front Vite actuel ne se connecte pas directement à Postgres sans couche API.

Pour un hackathon, **Supabase est plus rapide** (client JS + RLS).

---

## Dépannage

### Page blanche ou 404 sur `/candidat`

- Vérifiez que `vercel.json` est bien sur `main`.
- Redéployez après merge.

### Build échoue (mémoire / TypeScript)

Sur Vercel → **Settings** → **Environment Variables** :

```
NODE_OPTIONS=--max-old-space-size=4096
```

### Variables `VITE_*` non prises en compte

- Elles doivent être définies **avant** le build.
- Après ajout, faites un **Redeploy** complet (pas seulement un refresh).

### Données différentes entre deux navigateurs

Normal en mode `localStorage`. Activez Supabase + migration du code pour un stockage centralisé.

---

## Checklist rapide

- [ ] Repo importé sur Vercel
- [ ] Build vert, URL accessible
- [ ] Routes `/connexion`, `/candidat` OK au refresh
- [ ] (Optionnel) Projet Supabase + `schema.sql` exécuté
- [ ] (Optionnel) Variables `VITE_SUPABASE_*` sur Vercel + redeploy

---

## Commandes locales (vérifier avant deploy)

```bash
npm install
npm run build
npm run preview
```

Si le build passe en local, il passera en général sur Vercel.
