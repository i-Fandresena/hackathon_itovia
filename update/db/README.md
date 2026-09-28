# Base de données OffRec — installation locale

Ce dossier contient tout le nécessaire pour avoir une base OffRec fonctionnelle
sur ta machine, avec un jeu de données de démonstration cohérent.

## Pourquoi il n'y a pas de dump de la production ici

La base de production contient de vraies données personnelles : comptes réels avec
adresses email nominatives, numéros de téléphone, CV téléversés et conversations
privées. Le projet interdit explicitement que des noms réels et des téléphones
privés se retrouvent dans des données partagées (`CLAUDE.md`, section *Trust engine*
— règle issue du processus de collecte terrain, voir `collecte/GUIDE-COLLECTE.md`).

Les fichiers de ce dossier ont donc été générés depuis une base **vierge** remplie
par `server/prisma/seed.ts`. Ils reproduisent fidèlement la structure de la
production (mêmes 10 migrations, même schéma) avec des données 100 % fictives :
entreprises inventées, numéros en `+261 3X ...` factices, aucun CV.

## Contenu

| Fichier | Description | Poids |
|---|---|---|
| `offrec_demo.sql` | Schéma **+** données de démonstration. Restaurable en une commande. Inclut la table `_prisma_migrations`, donc Prisma considère la base à jour juste après restauration. | 97 Ko |
| `offrec_schema.sql` | Structure seule, sans aucune donnée. Utile comme référence pour lire le modèle ou repartir d'une base vide. | 43 Ko |

Généré avec PostgreSQL 16.15 (`pg_dump --no-owner --no-privileges`), donc
restaurable quel que soit le nom de ton utilisateur PostgreSQL local.

## Parcours A — recommandé : migrations + seed

C'est le parcours à privilégier : il part des migrations Prisma versionnées, donc
tu obtiens exactement la même base que la production, et tu peux relancer le seed
autant de fois que tu veux pour repartir d'un état propre.

```bash
# 1. Une base PostgreSQL 16 dans Docker
docker run --name offrec-db \
  -e POSTGRES_USER=offrec -e POSTGRES_PASSWORD=offrec -e POSTGRES_DB=offrec \
  -p 5433:5432 -d postgres:16

# 2. Le backend
cd server
npm install
cp .env.example .env          # DATABASE_URL y pointe déjà sur le port 5433
npx prisma migrate deploy     # applique les 10 migrations
npm run seed                  # remplit le jeu de démonstration
npm run dev                   # API sur http://localhost:4000

# 3. Le frontend, dans un second terminal, à la racine du dépôt
npm install
npm run dev                   # http://localhost:5173
```

## Parcours B — restauration du dump

Utile si tu veux une base prête en une seule commande, ou si le seed échoue chez toi.

```bash
docker run --name offrec-db \
  -e POSTGRES_USER=offrec -e POSTGRES_PASSWORD=offrec -e POSTGRES_DB=offrec \
  -p 5433:5432 -d postgres:16

# Attendre quelques secondes que PostgreSQL accepte les connexions, puis :
docker exec -i offrec-db psql -U offrec -d offrec < update/db/offrec_demo.sql
```

Le dump commence par des `DROP ... IF EXISTS` : sur une base vierge, PostgreSQL
affiche des `NOTICE: ... does not exist, skipping`. C'est normal, ce ne sont pas
des erreurs.

Vérifier ensuite que Prisma est satisfait :

```bash
cd server && npx prisma migrate status
# → "Database schema is up to date!"
```

### Sans Docker

Si tu as PostgreSQL 16 installé directement :

```bash
createdb offrec
psql -d offrec -f update/db/offrec_demo.sql
```

Adapte alors `DATABASE_URL` dans `server/.env` à ton port (5432 par défaut au lieu
de 5433) et à tes identifiants.

## Comptes de démonstration

Mot de passe identique pour tous : `demo123`

| Rôle | Email | Ce que tu vois en te connectant |
|---|---|---|
| Candidat | `candidat@demo.mg` | Ses suggestions de mise en relation à différents stades |
| Recruteur | `recruteur@demo.mg` | Ses offres, sa shortlist, un fil de messagerie avec OffRec |
| Admin | `admin@demo.mg` | Le back-office complet : mise en relation, modération, placements |
| Agent de terrain | `agent.analamanga@demo.mg` | Les talents à vérifier, la veille de sourcing |
| Particulier | `particulier@demo.mg` | L'annuaire de confiance côté contributeur |

Quatre autres candidats (`faniry.andria@demo.mg`, `nomena.fara@demo.mg`,
`sitraka.ravo@demo.mg`, `tahiana.raz@demo.mg`), un second agent
(`agent.terrain2@demo.mg`) et huit contributeurs de l'annuaire
(`member-1@demo.mg` … `member-8@demo.mg`) existent pour donner du volume aux
listes et aux scores de confiance.

> Le compte administrateur réel de la production n'est **pas** dans ces fichiers.
> Il est créé par un script séparé, jamais versionné.

## Volumétrie du jeu de démonstration

| Table | Lignes |
|---|---|
| `User` | 27 |
| `Opportunity` | 12 |
| `Provider` | 10 |
| `Recommendation` | 29 |
| `TalentProfile` | 6 |
| `MatchSuggestion` | 3 |
| `Placement` | 3 |
| `SourcingLead` | 3 |
| `Message` | 2 |

Assez pour que chaque écran de chaque rôle ait du contenu, et pour que le tunnel
de mise en relation (`proposee_candidat` → `interet_candidat` → `proposee_recruteur`
→ `interet_recruteur` → `mise_en_relation`) soit observable à plusieurs stades
simultanément.

## À savoir avant de coder

L'inscription via l'interface est **bloquée** sans `RESEND_API_KEY` :
`POST /api/verification/send-code` renvoie une erreur 502. Ce n'est pas un bug de
ton installation. Tu n'as pas besoin de t'inscrire — utilise les comptes ci-dessus,
ils existent directement en base.

Le détail complet de ce qui marche, de ce qui ne marche pas et du backlog est dans
[HANDOFF_FONCTIONNEL_OFFREC.md](../HANDOFF_FONCTIONNEL_OFFREC.md).

## Régénérer ces fichiers

Si le schéma évolue et qu'il faut rafraîchir ce dossier, depuis une base de travail
remplie par le seed :

```bash
pg_dump -U offrec -d <base> --no-owner --no-privileges --clean --if-exists \
  > update/db/offrec_demo.sql
pg_dump -U offrec -d <base> --no-owner --no-privileges --schema-only \
  > update/db/offrec_schema.sql
```

**Jamais depuis la base de production** : elle contient des données personnelles
réelles.
