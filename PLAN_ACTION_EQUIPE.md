# Plan d'action opérationnel — OffRec

> Point de départ : 17 août 2026. Source produit : `CAHIER_DES_CHARGES.md`.
> Ce plan sépare la préparation du jury de la validation terrain. Les nombres
> cibles sont des objectifs internes, jamais de la traction à annoncer avant
> mesure réelle.

## 1. Règle de priorisation

Pendant la préparation du concours, l'équipe ne cherche pas à construire toutes
les phases A–E. Elle doit démontrer une promesse nette, un prototype stable et
une méthode de validation crédible. Après le concours, l'ordre obligatoire est
**A → B → C → D → E** : données partagées, confiance opérationnelle, pilote,
revenus, puis extension.

| Horizon | But | Décision de sortie |
| --- | --- | --- |
| Avant jury | Convaincre avec un récit vrai, un parcours démo sans erreur et un plan de validation | Démo répétable, preuves sourcées, réponses alignées, rôles attribués. |
| J0–30 | Vérifier que preuves et prix aident réellement à choisir | Itérer si moins de 60 % des 25 entretiens confirment cette utilité. |
| J31–60 | Créer une cohorte dense et consentie | Ne pas élargir sous 3 retours par prestataire en médiane. |
| J61–90 | Démontrer valeur partenaire et usage | Décider un pilote payant seulement avec valeur observée et retours utilisateurs. |

## 2. Tableau de pilotage

Créer un tableau unique (Notion, Sheets ou Trello) avec ces colonnes :
`ID`, `chantier`, `responsable`, `échéance`, `dépendance`, `preuve de fini`,
`statut`, `risque`, `prochaine action`.

Rituels : point de 15 minutes chaque jour de préparation ; revue hebdomadaire
pendant le pilote ; aucun élément n'est « terminé » sans sa preuve de fini.

## 3. To-do agents IA

Les agents lisent `AGENTS.md` puis utilisent
`skills/offrec-ceo-strategy/SKILL.md` pour les sujets business. Toute PR doit
contenir la validation exécutée et ne peut inventer ni traction, ni partenariat,
ni intégration Supabase.

| ID | Priorité | Tâche IA | Dépendance | Preuve de fini |
| --- | --- | --- | --- | --- |
| IA-01 | P0 | Auditer les parcours de démo : visite annuaire, fiche, recommandation, connexion candidat, match, recruteur. Corriger uniquement les blocages. | Comptes seed | Parcours répété sans erreur sur viewport mobile et desktop ; `npm run build` vert. |
| IA-02 | P0 | Préparer un mode démo reproductible : réinitialisation localStorage, comptes, données seed, script de déroulé et plan B sans réseau. | IA-01 | Document de 5–7 minutes suivi par une personne non technique. |
| IA-03 | P0 | Auditer tous les textes et statistiques affichés : distinguer clairement données de démo, chiffres sourcés et hypothèses. | Sources du skill | Aucune stat seed présentée comme traction ; sources datées dans les supports. |
| IA-04 | P1 | Ajouter des tests unitaires ciblés de `trust.ts` et `recommendation.ts`, sans modifier l'algorithme. | Choix framework de test | Cas anti-abus, score, classement et matching couverts ; build/tests verts. |
| IA-05 | P1 | Découper la migration Supabase en PRs : modèle, Auth, lecture annuaire, écritures, RLS, migration. Ne pas lancer une migration partielle. | Accès Supabase fourni par équipe | ADR/plan technique, schéma relu, critères d'acceptation par PR. |
| IA-06 | P1 | Concevoir les écrans de Phase B : revendication, signalement, statut de modération, correction factuelle. | Politique humaine validée | Maquettes ou composants avec états succès/erreur, sans prétendre que l'OTP existe. |
| IA-07 | P2 | Créer le tableau de couverture métiers × quartiers et la spécification des événements pseudonymisés. | Données de collecte | Schéma de données, métriques et absence de PII dans les événements vérifiés. |
| IA-08 | P2 | Préparer l'espace partenaire comme proposition et maquette, pas comme classement payant. | Validation prix/partenaire | Parcours séparant strictement outil payé et score organique. |

## 4. To-do équipe humaine — présentation et jury

| ID | Priorité | Tâche équipe | Responsable conseillé | Preuve de fini |
| --- | --- | --- | --- | --- |
| EQ-01 | P0 | Nommer un pilote produit, un pilote terrain/éthique, un pilote business/partenariats et un pilote pitch. Une personne peut cumuler, mais chaque rôle a un titulaire. | CEO équipe | Noms, décisions autorisées et coordonnées dans le tableau de pilotage. |
| EQ-02 | P0 | Écrire le pitch de 3 minutes : problème vécu → cible initiale → démonstration → différenciation → modèle économique → demande précise. | Pilote pitch | Texte chronométré à 2 min 40–2 min 55, sans chiffre non sourcé. |
| EQ-03 | P0 | Préparer une démo de 5–7 minutes et une vidéo/captures de secours. Ne montrer que les fonctions réellement construites. | Pilote produit | Deux répétitions chronométrées, dont une sur le téléphone et une hors connexion. |
| EQ-04 | P0 | Préparer la fiche « vérité produit » : prototype localStorage, seeds, limite backend, roadmap Supabase, règles anti-abus. | Pilote produit | Chaque présentateur répond de façon identique à ces sujets. |
| EQ-05 | P0 | Préparer 10 réponses aux objections : concurrence, faux avis, données personnelles, cold start, monétisation, connectivité, passage à l'échelle, rentabilité, équipe, backend. | Toute l'équipe | Simulation de questions hostiles avec réponses de 30 secondes. |
| EQ-06 | P1 | Réunir le dossier de preuves : sources marché datées, comparatif concurrence, captures du prototype, architecture, guide de collecte. | Pilote business | Dossier partagé, liens vérifiés et une source primaire/fiable par chiffre clé. |
| EQ-07 | P1 | Définir une demande au jury : introductions vers 3 partenaires pilotes, mentorat réglementaire, accès à un réseau de prestataires. | CEO équipe | Demande formulée en une phrase et intégrée à la conclusion. |
| EQ-08 | P1 | Définir une charte de parole : ne jamais promettre emploi, prix, revenu, partenaires ou volume non validés. | CEO équipe | Tous les supports relus et signés par les 4 rôles. |

## 5. To-do équipe humaine — validation terrain et partenariats

| ID | Priorité | Tâche équipe | Mesure / preuve |
| --- | --- | --- | --- |
| TE-01 | P0 | Sélectionner 3–5 quartiers et 8–10 métiers, avec un critère de choix documenté (densité, accessibilité, relais). | Carte de zone et liste justifiée. |
| TE-02 | P0 | Réaliser 25 entretiens : 10 clients de chantier, 10 prestataires, 5 partenaires potentiels. | Guide, consentements, verbatims anonymisés et grille de synthèse. |
| TE-03 | P0 | Tester les hypothèses : prix observé utile, preuve utile, volonté de recommander, volonté de contacter par WhatsApp. | Résultat par question ; séparer citation, conclusion et décision. |
| TE-04 | P1 | Former les collecteurs au guide `collecte/GUIDE-COLLECTE.md`, aux deux consentements et à la non-publication des données privées. | Feuille de présence + exercice de contrôle de qualité. |
| TE-05 | P1 | Constituer la cohorte : 40–50 prestataires, 120–150 recommandations, au moins 60 contributeurs distincts. | CSV validé par `collecte/import-collecte.mjs`; profondeur par fiche contrôlée. |
| TE-06 | P1 | Établir le protocole de modération : qui reçoit un signalement, délai cible, critères, réponse, journal. | SOP d'une page, responsable nommé, registre de décisions. |
| TE-07 | P1 | Prospecter cinq partenaires : quincailleries, microfinance, programme habitat/emploi, association professionnelle. | Fiche par partenaire : problème, valeur offerte, interlocuteur, prochain rendez-vous. |
| TE-08 | P2 | Obtenir au moins une lettre d'intention ou un pilote co-construit avant de fixer des prix définitifs. | LOI ou compte rendu signé ; prix explicitement marqué comme hypothèse si absent. |
| TE-09 | P2 | Suivre 20 intentions de contact : le prestataire a-t-il répondu, l'expérience a-t-elle eu lieu, que faut-il corriger ? | Journal anonymisé ; aucun contrat ou satisfaction n'est supposé sans suivi. |

## 6. Déroulé de présentation recommandé

1. **0:00–0:25 — histoire-problème :** aujourd'hui, choisir un artisan fiable et connaître un prix dépend d'informations dispersées.
2. **0:25–0:55 — cible :** Grand Antananarivo, construction, choix volontairement étroit pour densifier la confiance.
3. **0:55–2:00 — démo :** recherche → fiche → preuve/prix/alerte → recommandation ; montrer aussi la transparence du score.
4. **2:00–2:30 — différence :** pas un job board de plus, pas une note achetable ; confiance fondée sur une expérience datée.
5. **2:30–2:55 — business :** B2C gratuit, partenaire B2B paie l'onboarding et les outils, jamais le rang.
6. **2:55–3:15 — exécution et demande :** pilote 90 jours, seuils de qualité, introductions partenaires recherchées.

## 7. Feu rouge — ne pas avancer sans décision

- Ne pas présenter les stats du prototype, les seeds ou les comptes démo comme
  utilisateurs réels.
- Ne pas démarrer une collecte sans les deux consentements et un responsable de
  protection des données.
- Ne pas déployer un backend réel avec mots de passe mock/localStorage.
- Ne pas monétiser le classement, le score ou la suppression d'un avis.
- Ne pas étendre géographie ou verticale avant les seuils de sortie du pilote.
- Ne pas ajouter de fonctions « IA » opaques : l'explication et le contrôle
  humain sont une partie de la proposition de valeur.
