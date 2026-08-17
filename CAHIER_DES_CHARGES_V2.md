# Cahier des charges V2 — OffRec Trust Network

> Cadrage après hackathon. Il complète `CAHIER_DES_CHARGES.md` sans falsifier
> l'état du prototype ; l'implémentation suit les phases ci-dessous.

## 1. Périmètre décidé

OffRec est une infrastructure de confiance pour le travail local. Un utilisateur
identifie un prestataire, comprend les expériences réelles et prix observés,
puis le contacte. Les opportunités sont complémentaires lorsqu'elles renforcent
ce même réseau.

- Lancement : Grand Antananarivo, pilote sur 3–5 quartiers.
- Verticale : construction et amélioration de l'habitat.
- Canaux : web mobile léger, WhatsApp/téléphone, onboarding assisté.
- Cibles : client de chantier, prestataire, partenaire B2B local.

Ne pas étendre simultanément à toutes les provinces, tous les services et au
marché d'emploi généraliste. Toute extension nécessite un pilote local prouvant
densité de retours et capacité de modération.

## 2. Phases et critères

| Phase | Livrable | Critère d'acceptation |
| --- | --- | --- |
| A — données partagées | Supabase Auth, RLS, chargement/erreurs, migration localStorage | Deux appareils voient la même fiche et les règles d'écriture sont appliquées en base. |
| B — confiance opérationnelle | Revendication, OTP, signalement, modération, correction factuelle | Personne ne peut modifier son score, supprimer un retour ou s'auto-recommander. |
| C — pilote terrain | Import consentements, couverture, analytics, contact WhatsApp | Densité, recherche, contact et retour sont mesurables sans exposer de données privées. |
| D — revenus | Espace partenaire, profil pro, offre B2B | Le paiement ne modifie jamais score, rang organique ou modération. |
| E — extension | Nouvelle zone/verticale ou opportunités approfondies | Pilote, runbook de collecte, modération et économie unitaire validés. |

## 3. Règles de confiance et données

1. Consentement du membre et accord de publication du prestataire sont obligatoires ; conserver une trace de consentement, pas plus de données que nécessaire.
2. Afficher source, date et niveau de confiance ; séparer score, rang et contenu sponsorisé.
3. Prévoir signalement, preuve, décision humaine, journal et correction factuelle. Ne jamais supprimer un retour pour protéger un payeur.
4. Les médias de preuve sont privés jusqu'à revue ; expurger numéro, adresse et données sensibles avant publication.
5. Définir conservation des médias et politique de contestation avant import massif ; demander un avis juridique local avant toute promesse de conformité.

## 4. Exigences UX et techniques

- Chaque écran clé fonctionne en connexion lente et sur écran étroit.
- Chaque écriture réseau fournit chargement, succès, erreur et reprise.
- Toute règle de domaine est validée côté client et côté serveur.
- Les analytics sont pseudonymisés ; ni numéro, ni nom complet, ni preuve brute ne part vers un outil analytique.
- Ajouter des tests ciblés pour `trust.ts`, RLS et recommandation ; `npm run build` reste obligatoire.

## 5. Événements et critères de sortie

Instrumenter : `provider_viewed`, `provider_contact_intent`, `recommendation_submitted`, `recommendation_moderated` et `opportunity_matched`. Chaque événement porte uniquement les identifiants, zone, source ou décision nécessaires à sa mesure.

Le pilote peut s'étendre seulement avec au moins 40 prestataires, trois recommandations par prestataire en médiane, 60 contributeurs distincts, consentements traçables, modération opérationnelle et un partenaire validant la valeur. Ce sont des seuils internes de qualité, pas de la traction annoncée.

## 6. Hors périmètre lancement

- Paiement/escrow et règlement des litiges de chantier.
- IA opaque qui décide à la place des personnes.
- Vente de classement, suppression d'avis ou coordonnées privées.
- Déploiement national sans opération locale de collecte et modération.
- Promesse d'emploi, contrat ou prix garanti.
