# OffRec — Offres & Recommandations (Madagascar)

Prototype web responsive pour hackathon : plateforme de recommandation d’opportunités professionnelles à Madagascar.

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir l’URL affichée (souvent `http://localhost:5173`).

## Comptes démo

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Candidat | `candidat@demo.mg` | `demo123` |
| Recruteur | `recruteur@demo.mg` | `demo123` |

## Fonctionnalités

### Annuaire de confiance — `/annuaire`

Le cœur du produit : trouver un prestataire fiable (construction, agglomération
d’Antananarivo) recommandé par des membres qui ont réellement travaillé avec lui.

- Recherche par métier, quartier et texte libre — ce qu’un groupe Facebook ne
  permet pas : retrouver le bon plan publié il y a six mois
- Fiche prestataire : contact direct (téléphone / WhatsApp), **prix constaté**
  (médiane des prix réellement payés), retours datés
- Publication d’une recommandation rattachée à un chantier réel : travail
  décrit, date du chantier, prix payé, preuve (facture / photo)
- Confirmation d’un retour par un autre membre (« j’ai eu la même expérience »)

Le moteur de confiance ([`src/lib/trust.ts`](./src/lib/trust.ts)) ne calcule pas
une moyenne d’étoiles. Chaque retour est pondéré par la preuve fournie, la
fraîcheur du chantier, la fiabilité de son auteur (ancienneté, numéro vérifié,
historique confirmé) et le nombre de confirmations reçues. Il produit une note,
un **niveau de confiance**, des raisons explicites et — surtout — des **alertes**
quand l’information est trop mince pour qu’on s’y fie.

Règles anti-abus appliquées côté code et côté base :

- un membre ne peut publier qu’un seul retour par prestataire ;
- un prestataire qui a revendiqué sa fiche ne peut pas s’auto-recommander ;
- on ne confirme pas son propre retour ;
- aucune suppression de recommandation (un avis négatif ne disparaît pas) ;
- le classement utilise une moyenne bayésienne : 5/5 sur un seul avis ne passe
  pas devant 4,5/5 sur six membres.

### Portail d’opportunités — `/candidat`, `/recruteur`

- Page d’accueil (valeur, statistiques, offres à la une)
- Inscription / connexion (données en `localStorage`)
- Profil candidat et moteur de scoring (compétences, province, niveau, type)
- Fil d’offres recommandées, favoris, notifications
- Espace recruteur : publier, modifier, supprimer des offres, voir les candidatures

## Stack

- React 19 + TypeScript + Vite
- React Router
- Lucide React (icônes)

## Build

```bash
npm run build
npm run preview
```

## Déploiement Vercel + base de données

Guide détaillé (Vercel, Supabase, variables d’environnement) : **[DEPLOYMENT.md](./DEPLOYMENT.md)**.
