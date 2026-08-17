# OffRec — stratégie CEO, concours et lancement

> Version de travail — 17 août 2026. Distinguer systématiquement faits sourcés,
> hypothèses à tester et objectifs ; ne jamais présenter les deux derniers comme
> des résultats acquis.

## Décision stratégique

**OffRec est le réseau de confiance mobile-first du travail local.** Il permet
de choisir, contacter et recommander un prestataire à partir d'une expérience
vérifiable, puis de faire circuler des opportunités locales.

Le marché initial est la chaîne construction et amélioration de l'habitat dans
le Grand Antananarivo, pas « tous les emplois à Madagascar ». Le portail
d'opportunités reste une brique complémentaire. La promesse principale est la
confiance vérifiable, ce qui évite une comparaison frontale avec les job boards.

## Problème et réponse

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

Le B2C reste gratuit. Monétisation :

1. Pilote partenaire : collecte, vérification et tableau de couverture pour
   quincaillerie, microfinance, programme habitat/emploi ou association pro.
2. Profil professionnel optionnel : outils de contact, statistiques, fiche
   enrichie et formation, jamais une meilleure note/place.
3. Abonnement organisation/recruteur après preuve de mises en relation utiles.

Prix, coûts SMS, conversion et marge sont des hypothèses. Obtenir trois lettres
d'intention ou pilotes payants avant un prévisionnel.

## Plan 0–90 jours

| Horizon | Résultat à obtenir | Seuil de décision |
| --- | --- | --- |
| J0–30 | 25 entretiens : 10 clients, 10 prestataires, 5 partenaires. | Itérer si moins de 60 % jugent preuves/prix utiles. |
| J31–60 | 40–50 prestataires, 120–150 retours, ≥60 contributeurs, 3–5 quartiers. | Ne pas élargir sous 3 retours par prestataire en médiane. |
| J61–90 | 1 partenaire terrain, 100 recherches ou intentions de contact, 20 suivis. | Vendre seulement si valeur et retour utilisateur observés. |

Ce sont des objectifs internes, pas une traction actuelle.

## Réponses jury

| Objection | Réponse courte |
| --- | --- |
| « Il existe déjà des job boards. » | Oui. Nous partons de la confiance vérifiable dans le travail local, pas du volume d'annonces. |
| « Comment évitez-vous les faux avis ? » | Travail daté, preuve et auteur pondèrent le score ; pas de double avis ni d'auto-confirmation. |
| « Pourquoi paieraient-ils ? » | Les organisations paient l'onboarding et les outils, jamais la réputation. |
| « Comment démarrez-vous ? » | Collecte consentie, concentrée sur 40–50 prestataires et 3–5 retours par fiche, avec un partenaire local. |
| « Pas de backend ? » | Limite assumée de démo ; Supabase Auth + RLS est le premier jalon production. |

## Identité de marque

- Mission : rendre le travail local plus sûr, visible et digne.
- Promesse : « Une expérience réelle. Une confiance qui se construit. »
- Ton : direct, utile, respectueux, jamais paternaliste.
- Preuve : afficher aussi les limites et alertes ; transparence avant promesse.
