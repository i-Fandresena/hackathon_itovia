# Contexte de collaboration — OffRec

Ce fichier est le point d'entrée commun aux agents intervenant sur ce dépôt.
Lire aussi les documents métier concernés avant une modification :

- `CAHIER_DES_CHARGES.md` : vision produit et périmètre de référence ;
- `collecte/GUIDE-COLLECTE.md` : règles de collecte terrain et confidentialité ;
- `DEPLOYMENT.md` : déploiement Vercel et trajectoire Supabase ;
- `CLAUDE.md` : guide historique détaillé. En cas de divergence avec le code,
  le code et ce fichier priment ; signaler la divergence dans la livraison.

Pour toute décision de stratégie, produit, concurrence, pitch, marque,
partenariat, modèle économique ou roadmap, utiliser le skill projet
`offrec-ceo-strategy` (`skills/offrec-ceo-strategy/SKILL.md`, ou
`.claude/skills/offrec-ceo-strategy/SKILL.md` selon l'agent). Il impose de
séparer faits, hypothèses, cibles et résultats réels.

## Produit et état actuel

OffRec est un prototype de hackathon en français pour Madagascar. Il rassemble
deux produits dans une seule SPA React :

1. **Portail d'opportunités** : candidats, recruteurs, offres, candidatures,
   favoris, notifications et recommandations d'offres.
2. **Annuaire de confiance** : prestataires de construction de l'agglomération
   d'Antananarivo, recommandations d'expériences réelles et score explicable.

L'application est aujourd'hui un front autonome : aucune API ni aucun client
Supabase n'est présent dans `src/`. Les données sont des seeds puis sont
persistées, par navigateur, dans `localStorage`. Le schéma SQL Supabase et les
variables `VITE_USE_SUPABASE` décrivent une évolution prévue, pas une
fonctionnalité disponible. Ne pas annoncer ni implémenter partiellement une
persistance partagée sans une tâche qui couvre explicitement la migration.

## Environnement et vérification

- Stack : React 19, TypeScript, Vite 8, React Router 7, Framer Motion,
  Lucide React ; CSS classique (pas de Tailwind ni de bibliothèque UI).
- Node **22.x** est requis (`.nvmrc`, `package.json`).
- Commandes : `npm run dev`, `npm run build`, `npm run preview`.
- `npm run build` exécute `tsc --noEmit` puis le build Vite. Il n'existe ni
  tests automatisés ni configuration ESLint : exécuter ce build après toute
  modification de code et rapporter le résultat.
- Comptes seed : `candidat@demo.mg` / `demo123` et
  `recruteur@demo.mg` / `demo123`.
- Le state est sauvegardé sous la clé réelle `offrec_app_state_v1` (préfixe
  `offrec_` appliqué dans `src/lib/storage.ts`). Des tests manuels fiables
  nécessitent parfois de supprimer cette clé dans le navigateur.

## Carte du code

| Zone | Emplacement | Responsabilité |
| --- | --- | --- |
| Démarrage/routage | `src/main.tsx`, `src/App.tsx` | Arbre React et toutes les routes. |
| Données et mutations | `src/context/AppContext.tsx` | Source unique de vérité, auth mock, localStorage, opérations métier. |
| Types du domaine | `src/types/index.ts` | Contrats `User`, opportunités et annuaire. Modifier avant les consommateurs. |
| Opportunités | `src/pages/candidate/`, `src/pages/recruiter/`, `src/lib/recommendation.ts` | Parcours candidat/recruteur et score de correspondance. |
| Annuaire | `src/pages/directory/`, `src/components/provider/`, `src/lib/trust.ts` | Recherche, fiche et moteur de confiance. |
| Composants partagés | `src/components/ui/`, `src/components/layout/`, `src/components/brand/` | Primitives, coquilles, identité visuelle. |
| Données de démonstration | `src/data/seed.ts`, `src/data/seedDirectory.ts`, `src/data/constants.ts` | Démo et vocabulaires contrôlés. |
| Collecte | `collecte/` | Modèle CSV, règles terrain, import local. |
| Évolution backend | `supabase/schema.sql`, `DEPLOYMENT.md` | Cible PostgreSQL/RLS non branchée au front. |

Chaque nouveau composant ou page doit garder la convention existante : fichier
`.tsx` et fichier CSS homonyme côte à côte. Réutiliser les primitives de
`components/ui` et les wrappers de `components/motion/Motion.tsx` au lieu de
créer des variantes isolées.

## Routage, accès et coquilles

Les routes publiques sont `/`, `/connexion`, `/inscription`, `/offres/:id`,
`/annuaire` et `/annuaire/:id`. La publication d'une recommandation
(`/annuaire/:id/recommander`) demande seulement une connexion. Les routes
`/candidat/**` et `/recruteur/**` sont protégées avec leur rôle respectif.

`ProtectedRoute` attend l'hydratation du localStorage, renvoie les visiteurs
vers `/connexion`, et renvoie un utilisateur du mauvais rôle vers son tableau
de bord. Ne pas contourner cette logique depuis les pages.

`Layout` choisit la coquille sur l'existence de `currentUser`, et non sur la
route : connecté = `AppShell` à trois colonnes ; déconnecté = `Header` +
`Footer`. Vérifier une page dans les deux états si son layout change. Les
pages publiques redirigent volontairement les membres déjà connectés vers leur
espace ; préserver ce comportement récent.

## Règles métier à préserver

### Opportunités

`scoreOpportunity()` dans `src/lib/recommendation.ts` est indépendant du score
de confiance. Ses pondérations actuelles sont : compétences 40 %, localisation
25 %, niveau 15 %, type 15 %, disponibilité 5 %. Le résultat comprend un score
et des raisons affichées à l'utilisateur ; modifier l'algorithme implique de
mettre à jour ces explications.

Les mutations d'offres/candidatures/favoris/notifications passent par `useApp()`.
Supprimer une offre supprime aussi ses candidatures et favoris. Une candidature
est unique par couple candidat/offre et déclenche des notifications au candidat
et au recruteur.

### Annuaire de confiance

`User` (compte, rôle) et `Member` (identité communautaire) sont distincts. Un
compte détermine un unique membre via `memberIdFor(userId)` ; celui-ci est créé
ou actualisé lors de la première contribution. Ne pas fusionner ces modèles
sans migration des données et des règles associées.

Le score `evaluateProvider()` est une moyenne pondérée, jamais une simple
moyenne d'étoiles. Son poids combine la preuve (`facture` > `photo` >
`aucune`), la fraîcheur du chantier, la fiabilité de l'auteur et les
confirmations. `rankProviders()` applique en plus un a priori bayésien pour le
classement uniquement : la note affichée doit rester le score réel. Les champs
`reasons` et `warnings` sont visibles par les utilisateurs : toute évolution du
calcul doit maintenir des explications cohérentes.

Invariants anti-abus à conserver simultanément dans le front et, lorsqu'une
migration est menée, dans `supabase/schema.sql` :

- une seule recommandation par membre et prestataire ;
- aucune auto-recommandation si la fiche est revendiquée ;
- aucune auto-confirmation ;
- pas de suppression de recommandation ;
- les doublons historiques sont dédoublonnés par auteur dans le calcul ;
- prix uniquement avec une unité ; travail daté, commentaire et détail du
  chantier suffisamment renseignés.

L'annuaire est public ; publier une fiche ou un retour exige un compte. La
collecte terrain exige les consentements du membre **et** du prestataire ; les
noms complets et numéros privés des membres ne doivent jamais rejoindre les
données publiques, les seeds ou les interfaces.

## Discipline de collaboration

1. Examiner `git status` avant toute écriture. Le dépôt peut contenir des
   travaux non liés : ne pas les écraser, reformater massivement ou réinitialiser.
2. Pour une tâche ciblée, changer la plus petite surface utile et respecter les
   contrats de types existants. Centraliser les mutations dans `AppContext`.
3. Toute modification du modèle de données doit être tracée dans : types,
   seeds, persistance locale et consommateurs concernés. Si elle prépare
   Supabase, maintenir le schéma/documentation cohérents, sans prétendre que le
   branchement est achevé.
4. Préserver le français de l'interface, les formats Ariary et le contexte
   Madagascar. Les commentaires techniques peuvent être français ou anglais,
   mais les textes utilisateur doivent rester français cohérent.
5. Ne jamais committer `.env`, clé Supabase `service_role`, données personnelles
   de collecte, `node_modules`, `dist` ou `collecte/sortie/`.
6. Livrer avec : résumé des fichiers modifiés, comportement vérifié, commande
   de validation exécutée et limites/risques éventuels. Si le build échoue pour
   une cause préexistante, l'indiquer avec son erreur exacte.

## Déploiement

La cible front est Vercel (`vercel.json` réécrit les routes SPA vers
`index.html`). Le build est `npm run build`, le répertoire de sortie `dist` et
Node 22.x est obligatoire. Les variables `VITE_*` sont injectées au build ;
aucune clé secrète côté client. Sans une intégration Supabase complète, le
déploiement reste volontairement local au navigateur de chaque visiteur.
