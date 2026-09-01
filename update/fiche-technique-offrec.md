# Fiche Technique de Suivi — Projet OffRec

**Document de référence pour le suivi des données, hypothèses et évolutions majeures du projet.**
**Légende : `[SOURCÉ]` = donnée vérifiable par une source externe citée. `[HYPOTHÈSE]` = estimation de travail à valider, pas une donnée confirmée.**

---

## 1. Résumé du projet

- Nom : OffRec (Offre + Recommandation) — Madagascar
- Problème adressé : difficulté d'accès à l'emploi pour les non-diplômés compétents et les jeunes diplômés ; difficulté des entreprises à identifier rapidement les bons profils
- Solution : double mécanisme de recommandation — humain (agents de terrain, vérification de compétences) pour les non-diplômés, IA (analyse de CV) pour les diplômés
- Philosophie : « Compétences d'abord »
- Cible stratégique prioritaire : les femmes, surreprésentées dans l'emploi informel malgache
- Cadre : projet présenté dans un concours entrepreneurial devant investisseurs, bailleurs et partenaires : EDBM, MDE, ITOVIA, AFD

---

## 2. Statistiques marché — sourcées

### Emploi et chômage (national)
- `[SOURCÉ]` Taux de chômage national au sens du BIT : 6,6% ; 9,0% en milieu urbain contre 6,0% en milieu rural ; 7,4% chez les femmes contre 6,0% chez les hommes. (Observatoire de la Jeunesse Madagascar, données récentes)
- `[SOURCÉ]` Taux de chômage des jeunes (15-24 ans) : 11,2% ; 43,4% des jeunes sont NEET (ni en emploi, ni en formation, ni en études). (Observatoire de la Jeunesse Madagascar)
- `[SOURCÉ]` Environ 500 000 jeunes arrivent chaque année sur le marché du travail malgache, avec un déséquilibre croissant entre offre et demande d'emploi.
- `[SOURCÉ]` Enquête Afrobarometer 2024 : 42% des 18-35 ans se déclarent sans emploi et à la recherche d'un emploi (mesure subjective, plus élevée que les taux officiels BIT).
- `[SOURCÉ]` Le sous-emploi/emploi inadéquat toucherait environ 50% de la population active selon une estimation d'un économiste malgache basée sur des données de la Banque mondiale.
- `[SOURCÉ]` Taux d'emploi inadéquat : 82,2% en moyenne, 87% chez les femmes contre 75,8% chez les hommes (analyse ONU Madagascar).

### Informalité
- `[SOURCÉ]` Le secteur informel représente 83,3% des unités économiques et 95,2% de l'emploi total (89,8% hors agriculture). (Observatoire de la Jeunesse Madagascar)
- `[SOURCÉ]` 88% des actifs occupés dans l'agriculture informelle, 70% des actifs occupés dans le non-agricole informel. (ONU Madagascar)
- `[SOURCÉ]` Madagascar affiche l'un des taux d'informalité les plus élevés au monde, jusqu'à 95% des actifs selon plusieurs sources récentes (INSTAT/ENEMPSI 2024, Banque mondiale, OIT).

### Genre
- `[SOURCÉ]` Les femmes occupent 52% des emplois du secteur informel malgache ; 58,1% des travailleurs indépendants sont des femmes. (ENEMPSI 2012, PNUD)
- `[SOURCÉ]` Le salaire des hommes dépasse de 37% celui des femmes ; les femmes sont 20% plus susceptibles d'être au chômage que les hommes. (Afrobarometer, données Gaye 2020 / Marsden 2023)
- `[SOURCÉ]` Écart de salaire médian de 28,9 points entre hommes et femmes. Participation des femmes au marché du travail : 71% (moins élevée que celle des hommes). Les femmes de l'informel sont davantage exposées au harcèlement et à la violence basée sur le genre sur le lieu de travail. (Étude Banque mondiale, février 2024)

### Connectivité et canaux
- `[SOURCÉ]` Seulement 20% de la population malgache était connectée à Internet en octobre 2025 ; Madagascar figure parmi les 10 pays avec le plus faible niveau d'adoption d'internet au monde.
- `[SOURCÉ]` 21,8 millions de connexions mobiles actives (voix, SMS, données), soit environ 66% de la population — justifie une stratégie de canal SMS/WhatsApp plutôt que 100% internet.

### Salaires (repères pour budgets et success fee)
- `[SOURCÉ]` SMIG (salaire minimum interprofessionnel garanti) 2026 : 300 000 Ar/mois (~61,5€) à partir de mars 2026, puis 315 000 Ar/mois à partir d'octobre 2026.
- `[SOURCÉ]` Salaire net moyen national : ~196 359 Ar/mois (~37-40€). Salaire médian : ~108 250 Ar/mois (~21€) — la moitié des salariés gagne moins que ce montant.
- `[SOURCÉ]` Formation professionnelle : seulement 0,8% des dépenses publiques de l'État malgache y étaient consacrées en 2018 (AFD).

---

## 3. Paysage concurrentiel

| Acteur | Positionnement | Menace pour OffRec |
|---|---|---|
| MadaJob.mg | `[SOURCÉ]` Plateforme de recrutement avec agents terrain, 18 ans d'ancienneté revendiqués, 856 agents accompagnés, 454+ recrutements, système de shortlists | Directe sur le volet "recommandation humaine" — nécessite une différenciation claire (protocole de vérification standardisé, gratuité talents, double IA+humain) |
| Asako.mg | `[SOURCÉ]` Plus de 100 000 abonnés, candidature rapide, suivi de CV | Indirecte — agrégateur digital, pas de vérification humaine ni ciblage non-diplômé |
| Job2mada | `[SOURCÉ]` Plus de 2 500 offres actualisées quotidiennement | Indirecte — agrégateur digital |
| PortalJob, OptionCarriere | `[SOURCÉ]` Tableaux d'annonces d'emploi | Indirecte — pas de vérification ni matching différenciant |

---

## 4. Alignement bailleurs / partenaires

- **EDBM** : `[SOURCÉ]` Agence de Promotion des Investissements de Madagascar, mission de renforcement de la compétitivité du secteur privé et de facilitation de l'investissement — logique business / climat des affaires.
- **MDE** (Ministère du Travail, de l'Emploi et de la Fonction publique) : logique de politique nationale de l'emploi.
- **ITOVIA** : `[SOURCÉ]` Programme piloté par l'EDBM, financé par l'AFD à hauteur de 1,52 M€, objectif de réduction des inégalités de genre en facilitant l'accès des femmes à l'entrepreneuriat, déployé dans les régions Analamanga, Haute Matsiatra, Amoron'i Mania, Vakinankaratra. **Le pilote OffRec doit se positionner sur ces régions pour maximiser l'alignement.**
- **AFD** : `[SOURCÉ]` Soutient l'employabilité des jeunes dans le cadre de la Politique Nationale de l'Emploi et de la Formation Professionnelle (PNEFP), notamment via le Fonds Malgache de Financement de la Formation Professionnelle (FMFP) — logique côté offre de compétences (formation). OffRec doit se positionner comme le chaînon manquant côté demande (mise en relation emploi), complémentaire et non concurrent de ces programmes.

---

## 5. Modèle économique

- Gratuit à 100% pour tous les talents (diplômés et non-diplômés)
- Revenus : abonnement premium entreprises, commission de succès (success fee), formations courtes payantes, services additionnels, partenariats centres de formation

### Mécanisme de success fee `[HYPOTHÈSE — à valider/négocier]`
- Paiement en deux étapes par placement : 50% à la signature du contrat, 50% à la confirmation post-période d'essai (ex. 3 mois)
- Exemple chiffré : placement à 400 000 Ar/mois → 200 000 Ar à la signature + 200 000 Ar à la confirmation
- Segment diplômés/IA : taux plus élevé envisageable (repère du secteur du recrutement en général : un à deux mois de salaire), non spécifique à une donnée malgache vérifiée

---

## 6. Budget pilote proposé `[HYPOTHÈSE DE TRAVAIL — non validée, à ajuster]`

- Durée : 6 mois — Région : Analamanga (extension possible Haute Matsiatra)
- 4 agents de terrain (~380 000 Ar/mois + 60 000 Ar transport chacun)
- 1 coordinateur de pilote (~700 000 Ar/mois)
- 1 développeur / gestion matching (~600 000 Ar/mois + coûts API SMS/WhatsApp)
- Communication terrain (~300 000 Ar/mois)
- Total estimé sur 6 mois : ~23 000 000 Ar (≈ 4 700 €)

---

## 7. KPIs cibles du pilote `[HYPOTHÈSE DE TRAVAIL]`

- 150 à 200 profils vérifiés sur 6 mois
- Au moins 55 à 60% de profils recommandés via le canal humain doivent être des femmes
- 15 à 20 entreprises partenaires fondatrices engagées
- Taux de placement cible : 20 à 30% des profils recommandés (hypothèse à ajuster selon les premiers résultats réels)

---

## 8. Journal des changements majeurs

*Section à compléter à chaque évolution significative du projet (changement de périmètre, nouvelle donnée validée, pivot stratégique, résultat réel de traction obtenu). Format suggéré : date, nature du changement, impact sur le cahier des charges ou la fiche technique.*

| Date | Changement | Impact |
|---|---|---|
| — | Version initiale du document | — |
