# OffRec — stratégie CEO, concours et lancement

> Version de travail — 17 août 2026, révisée le 1er septembre 2026 (pivot à
> deux verticales, voir « Journal des changements »). Distinguer
> systématiquement faits sourcés, hypothèses à tester et objectifs ; ne jamais
> présenter les deux derniers comme des résultats acquis.

## Décision stratégique

**OffRec connecte les compétences aux opportunités par un double mécanisme de
confiance : vérification humaine pour les non-diplômés, matching pour les
diplômés — et fait aussi office de réseau de confiance mobile-first du travail
local.** Le produit porte désormais **deux verticales qui coexistent**, sans
priorité affichée entre elles (décision du 1er septembre 2026) :

1. **Emploi vérifié** (nouvelle verticale) : des agents de terrain vérifient
   les compétences de talents non-diplômés (économie informelle) ; les jeunes
   diplômés sont matchés par analyse de CV ; les entreprises reçoivent une
   shortlist qui distingue clairement les deux origines. Philosophie :
   « Compétences d'abord ». Cible prioritaire transversale : les femmes,
   très majoritaires dans l'emploi informel malgache (voir sources ci-dessous).
2. **Réseau de confiance du travail local** (verticale d'origine) : choisir,
   contacter et recommander un prestataire de la chaîne construction/
   amélioration de l'habitat dans le Grand Antananarivo, à partir d'une
   expérience vérifiable et datée (annuaire `/annuaire`, moteur `trust.ts`).

Chacune garde son mécanisme de preuve propre (vérification humaine par agent
côté emploi ; preuve + fraîcheur + fiabilité auteur côté annuaire) — ne pas les
fusionner techniquement ni marketing : ce sont deux démonstrations de la même
thèse (une réputation vérifiable vaut mieux qu'un diplôme, un réseau ou une
étoile anonyme), pas un seul produit à message unique.

## Problème et réponse — verticale « réseau de confiance du travail local »

La Banque africaine de développement rapporte 83,3 % de l'économie et 95,2 %
de l'emploi dans l'informel (estimation 2020). La Banque mondiale indique 94,4
% d'emploi informel adulte et 98,9 % chez les jeunes en 2022. Ces chiffres ne
prouvent pas une taille de marché OffRec ; ils justifient un produit qui réduit
l'asymétrie d'information et aide les micro-prestataires à construire une
réputation portable. [AfDB](https://www.afdb.org/sites/default/files/documents/projects-and-operations/madagascar_-_mid-term_review_of_the_country_strategy_paper_2022-2026.pdf), [Banque mondiale](https://humancapital.worldbank.org/en/economy/MDG).

Seulement 6,60 M de personnes utilisaient Internet en janvier 2025 (20,4 % de
pénétration). Le pilote doit donc être téléphone d'abord, léger,
WhatsApp/téléphone et assisté sur le terrain, sans promesse nationale immédiate.
[DataReportal](https://datareportal.com/reports/digital-2025-madagascar)

| Acteur | Valeur immédiate | Preuve dans OffRec |
| --- | --- | --- |
| Porteur de chantier | Réduire le risque et estimer un prix | Retours datés, preuve, médiane, alertes. |
| Prestataire | Construire une visibilité par le travail réel | Fiche revendiquable, réputation par des tiers. |
| Partenaire B2B | Identifier un réseau local plus vérifiable | Cohortes vérifiées et onboarding. |
| Candidat | Voir des opportunités locales pertinentes | Score explicable et réseau local. |

## Problème et réponse — verticale « emploi vérifié »

`[SOURCÉ]` Statistiques nationales (Observatoire de la Jeunesse Madagascar,
sauf mention contraire) : taux de chômage BIT 6,6 % (9,0 % en milieu urbain,
7,4 % chez les femmes contre 6,0 % chez les hommes) ; chômage des 15-24 ans
11,2 %, dont 43,4 % de NEET ; ~500 000 jeunes arrivent chaque année sur le
marché du travail. `[SOURCÉ]` Afrobarometer 2024 : 42 % des 18-35 ans se
déclarent sans emploi (mesure subjective, plus haute que le taux BIT).
`[SOURCÉ]` Emploi inadéquat : 82,2 % en moyenne, 87 % chez les femmes contre
75,8 % chez les hommes (ONU Madagascar). `[SOURCÉ]` Secteur informel : 83,3 %
des unités économiques, 95,2 % de l'emploi total (Observatoire de la
Jeunesse) — cohérent avec les chiffres AfDB/Banque mondiale cités plus haut.

`[SOURCÉ]` Genre : les femmes occupent 52 % des emplois informels et 58,1 %
des travailleurs indépendants sont des femmes (ENEMPSI 2012, PNUD) ; écart de
salaire médian de 28,9 points (Banque mondiale, février 2024) ; le salaire des
hommes dépasse de 37 % celui des femmes et les femmes sont 20 % plus
susceptibles d'être au chômage (Afrobarometer). Ces chiffres justifient le KPI
d'inclusion féminine du pilote (voir « KPIs cibles du pilote ») — ils ne le
garantissent pas : le taux réel de profils féminins recommandés reste à
mesurer dès les premières semaines.

`[SOURCÉ]` Connectivité : 20 % de pénétration Internet en octobre 2025, mais
21,8 M de connexions mobiles actives (~66 % de la population) — justifie une
architecture de notification abstraite (email au MVP, SMS/WhatsApp Business
API en V2) plutôt qu'un canal unique.

`[SOURCÉ]` Repères salariaux : SMIG 300 000 Ar/mois à partir de mars 2026
(315 000 Ar en octobre 2026) ; salaire net moyen national ~196 359 Ar/mois,
salaire médian ~108 250 Ar/mois. Utiles pour calibrer le success fee (voir
« Modèle économique — success fee ») mais pas comme prévisionnel de marge.

### Paysage concurrentiel — verticale emploi

| Acteur | Positionnement `[SOURCÉ]` | Menace |
| --- | --- | --- |
| MadaJob.mg | Agents terrain, 18 ans d'ancienneté revendiqués, 856 agents accompagnés, 454+ recrutements | Directe sur la « recommandation humaine » — différenciation nécessaire : protocole de vérification standardisé, gratuité talents, double humain+IA |
| Asako.mg | 100 000+ abonnés, candidature rapide, suivi de CV | Indirecte — agrégateur, pas de vérification humaine ni ciblage non-diplômé |
| Job2mada | 2 500+ offres actualisées quotidiennement | Indirecte — agrégateur |
| PortalJob, OptionCarrière | Tableaux d'annonces | Indirecte — pas de vérification ni matching différenciant |

### Alignement bailleurs et partenaires

- **EDBM** `[SOURCÉ]` : agence de promotion des investissements, logique
  business / climat des affaires.
- **MDE** (Ministère du Travail, de l'Emploi et de la Fonction publique) :
  logique de politique nationale de l'emploi.
- **ITOVIA** `[SOURCÉ]` : programme piloté par l'EDBM, financé par l'AFD à
  hauteur de 1,52 M€, réduction des inégalités de genre dans l'accès des
  femmes à l'entrepreneuriat, régions Analamanga, Haute Matsiatra,
  Amoron'i Mania, Vakinankaratra. **Le pilote emploi doit se positionner sur
  ces régions pour maximiser l'alignement** — cohérent avec le choix
  Analamanga déjà retenu pour la verticale annuaire (§ Plan 0-90 jours).
- **AFD** `[SOURCÉ]` : soutient l'employabilité des jeunes (PNEFP, FMFP) côté
  offre de compétences (formation). OffRec se positionne comme le chaînon
  manquant côté demande (mise en relation), complémentaire et non concurrent.

## Différenciation et modèle économique

Le noyau existant est défendable : preuve, fraîcheur, fiabilité de l'auteur et
confirmations pondèrent le score ; le classement est bayésien ; les protections
anti-manipulation sont explicites. Le fossé n'est pas « l'IA », mais la densité
de données consenties, vérifiées et localisées, collectées avec une méthode
répétable.

Asako, Jobmada et Asa Mada publient déjà des offres. OffRec ne cherche pas à
gagner par le volume. Ce n'est ni un annuaire pay-to-win ni une marketplace de
paiement au lancement : aucun paiement ne modifie score, rang organique,
alertes ou droit de retirer un avis négatif.

Le B2C reste gratuit sur les deux verticales — aucun talent ni particulier ne
paie jamais. Monétisation, verticale annuaire :

1. Pilote partenaire : collecte, vérification et tableau de couverture pour
   quincaillerie, microfinance, programme habitat/emploi ou association pro.
2. Profil professionnel optionnel : outils de contact, statistiques, fiche
   enrichie et formation, jamais une meilleure note/place.
3. Abonnement organisation/recruteur après preuve de mises en relation utiles.

### Modèle économique — verticale emploi

`[HYPOTHÈSE — à valider/négocier avant tout engagement contractuel]`

- Abonnement entreprise à 4 paliers (Free / Starter / Pro / Business), déjà
  implémenté comme configuration en base (`SubscriptionPlan`), jamais codé en
  dur dans le frontend.
- **Success fee en deux étapes par placement** : un versement dû à la
  signature du contrat par l'entreprise, un second dû à la confirmation du
  poste après la période d'essai. Exemple de calibrage (non contractuel) : un
  placement à 400 000 Ar/mois → 200 000 Ar à la signature + 200 000 Ar à la
  confirmation. Segment diplômés/IA : taux plus élevé envisageable (repère de
  secteur généraliste : un à deux mois de salaire, pas une donnée malgache
  vérifiée). Le MVP suit ce statut de façon déclarative (`Placement.status` :
  `étape1_due` / `étape1_payée` / `étape2_due` / `étape2_payée` / `annulé`)
  sans passerelle de paiement automatisée — cohérent avec les paliers gratuits
  d'infrastructure tant qu'il n'y a pas de revenu réel.
- Comme pour l'annuaire : **aucun paiement ne modifie un score, un statut de
  vérification ou une position dans une shortlist.**

Prix, coûts SMS, conversion et marge restent des hypothèses sur les deux
verticales. Obtenir trois lettres d'intention ou pilotes payants avant tout
prévisionnel chiffré.

## Plan 0–90 jours — verticale annuaire

| Horizon | Résultat à obtenir | Seuil de décision |
| --- | --- | --- |
| J0–30 | 25 entretiens : 10 clients, 10 prestataires, 5 partenaires. | Itérer si moins de 60 % jugent preuves/prix utiles. |
| J31–60 | 40–50 prestataires, 120–150 retours, ≥60 contributeurs, 3–5 quartiers. | Ne pas élargir sous 3 retours par prestataire en médiane. |
| J61–90 | 1 partenaire terrain, 100 recherches ou intentions de contact, 20 suivis. | Vendre seulement si valeur et retour utilisateur observés. |

Ce sont des objectifs internes, pas une traction actuelle.

## Budget et KPIs cibles — pilote emploi (6 mois)

`[HYPOTHÈSE DE TRAVAIL — non validée, à ajuster]`

- Durée 6 mois, région Analamanga (extension possible Haute Matsiatra) — 4
  agents de terrain (~380 000 Ar/mois + 60 000 Ar transport chacun), 1
  coordinateur (~700 000 Ar/mois), 1 développeur/matching (~600 000 Ar/mois +
  coûts API SMS/WhatsApp), communication terrain (~300 000 Ar/mois). Total
  estimé : ~23 000 000 Ar (≈ 4 700 €).
- KPIs cibles : 150 à 200 profils vérifiés ; **au moins 55 à 60 % de profils
  recommandés via le canal humain doivent être des femmes** (KPI d'inclusion
  suivi dès le tableau de bord admin du MVP) ; 15 à 20 entreprises partenaires
  fondatrices ; taux de placement cible 20 à 30 % des profils recommandés.

Ces seuils sont des objectifs de pilote, pas une traction actuelle — même
statut que le plan 0-90 jours de la verticale annuaire ci-dessus.

## Réponses jury

| Objection | Réponse courte |
| --- | --- |
| « Il existe déjà des job boards. » | Sur l'annuaire : oui, mais nous partons de la confiance vérifiable dans le travail local, pas du volume d'annonces. Sur l'emploi : les job boards (MadaJob, Asako, Job2mada) ne vérifient pas les compétences des non-diplômés ni ne ciblent l'inclusion féminine. |
| « Comment évitez-vous les faux avis ? » | Annuaire : travail daté, preuve et auteur pondèrent le score ; pas de double avis ni d'auto-confirmation. Emploi : vérification humaine par agent de terrain avec grille standardisée par métier, pas une auto-déclaration. |
| « Pourquoi paieraient-ils ? » | Les organisations paient l'onboarding, les outils et le succès du placement (success fee), jamais la réputation ni le score. |
| « Comment démarrez-vous ? » | Annuaire : collecte consentie, 40–50 prestataires et 3–5 retours par fiche, avec un partenaire local. Emploi : 4 agents de terrain sur Analamanga, alignés sur les régions ITOVIA/AFD. |
| « Pourquoi deux verticales à la fois ? » | Elles démontrent la même thèse (réputation vérifiable > diplôme/réseau/étoile anonyme) sur deux segments différents ; elles partagent l'infrastructure (auth, RBAC, backend) mais pas le mécanisme de preuve — un jury peut voir la thèse se généraliser sans qu'on ait tout reconstruit deux fois. |
| « Pas de backend partagé ? » | Résolu : backend Node/Express + PostgreSQL réel, auth et RBAC appliqués côté serveur (voir `CAHIER_DES_CHARGES.md` §6). |

## Identité de marque

- Mission : rendre le travail local plus sûr, visible et digne — sur le
  chantier comme dans l'emploi salarié.
- Promesse : « Une expérience réelle. Une confiance qui se construit. » /
  côté emploi : « Les compétences d'abord. »
- Ton : direct, utile, respectueux, jamais paternaliste.
- Preuve : afficher aussi les limites et alertes ; transparence avant promesse.

## Journal des changements majeurs

*Format : date, nature du changement, impact.*

| Date | Changement | Impact |
| --- | --- | --- |
| 2026-08-17 | Version initiale (verticale unique : réseau de confiance du travail local, annuaire construction). | — |
| 2026-09-01 | Pivot à deux verticales : ajout de la verticale « emploi vérifié » (agents de terrain, talents non-diplômés/diplômés, entreprises), alignée ITOVIA/AFD/EDBM/MDE avec KPI d'inclusion féminine. Les deux verticales coexistent sans priorité affichée ; le mécanisme de preuve de chacune reste distinct. Source : `update/cahier-des-charges-offrec-mvp.md`, `update/fiche-technique-offrec.md`. | Nouveau rôle produit (agent de terrain), nouvelles entités (talent non-diplômé, placement/success fee), nouveaux KPIs admin (% profils féminins, entreprises partenaires actives, placements). Voir `CAHIER_DES_CHARGES.md` §3-4-8 pour le détail fonctionnel. |
