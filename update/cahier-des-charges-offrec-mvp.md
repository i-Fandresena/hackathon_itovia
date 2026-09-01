# Cahier des Charges Fonctionnelles — OffRec (MVP)

**Document destiné au développement du MVP. À utiliser comme référence de base pour l'implémentation.**

---

## 1. Vision du projet

OffRec (Offre + Recommandation) est une plateforme malgache qui connecte les entreprises à deux catégories de talents habituellement mal servies par les circuits de recrutement classiques :

1. Les personnes compétentes mais non-diplômées (souvent issues de l'économie informelle), recommandées via une **vérification humaine des compétences** par des agents de terrain.
2. Les jeunes diplômés, recommandés via une **analyse et un matching automatisés** de leur CV avec les offres disponibles.

Philosophie du projet : **« Compétences d'abord »** — valoriser la compétence réelle plutôt que le seul diplôme ou le réseau relationnel.

Priorité stratégique transversale : le projet cible en priorité les femmes, très majoritaires dans l'emploi informel malgache et davantage touchées par le chômage, l'emploi inadéquat et l'écart salarial (voir fiche technique associée pour les chiffres). Le MVP doit permettre de suivre ce KPI dès le départ.

---

## 2. Utilisateurs cibles

| Profil utilisateur | Rôle dans la plateforme |
|---|---|
| Talent non-diplômé compétent | Bénéficie d'un profil créé et vérifié par un agent de terrain, reçoit des recommandations |
| Talent diplômé | Crée son propre profil, dépose un CV, reçoit des offres matchées |
| Entreprise | Publie des offres, reçoit des shortlists, consulte des profils, contacte des candidats |
| Agent de terrain | Crée et vérifie les profils des talents non-diplômés, suit ses propres indicateurs |
| Administrateur OffRec | Supervise l'ensemble : utilisateurs, offres, KPIs pilote, statuts financiers |

---

## 3. Périmètre du MVP

Le MVP vise à démontrer la mécanique centrale du projet sur une seule région pilote (Analamanga / Antananarivo), avec un nombre limité d'utilisateurs, avant tout déploiement à plus grande échelle. Il ne doit pas chercher à répliquer toutes les fonctionnalités de la vision long terme (voir section 10 — hors périmètre).

---

## 4. Fonctionnalités détaillées

### 4.1 Espace Talent non-diplômé (profil créé par un agent)
- Formulaire de création de profil rempli par l'agent au nom du talent (nom, contact, localisation, compétences déclarées, disponibilité)
- Grille de vérification de compétences standardisée par métier (checklist + note qualitative de l'agent)
- Statut du profil : `en attente de vérification` / `vérifié` / `recommandé` / `placé`
- Champ genre obligatoire (pour le suivi du KPI d'inclusion féminine)
- Historique des opportunités proposées à ce talent
- Notification au talent (MVP : SMS basique ou email ; l'intégration WhatsApp Business est prévue en V2, l'architecture de notification doit donc être abstraite dès le MVP pour permettre cet ajout sans réécriture)

### 4.2 Espace Talent diplômé
- Création de compte autonome
- Dépôt de CV (upload PDF) et/ou saisie manuelle du profil (compétences, expériences, formations)
- Extraction de mots-clés et compétences depuis le CV (MVP : extraction texte + reconnaissance de mots-clés ; le matching sémantique avancé par IA est prévu en V2, pas requis au MVP)
- Liste des offres compatibles avec un score de matching simple (pondération par nombre de compétences communes)
- Candidature en un clic sur une offre
- Suivi du statut de sa candidature (`envoyée` / `vue par l'entreprise` / `contactée` / `refusée`)

### 4.3 Espace Entreprise
- Création de compte entreprise
- Publication d'une offre : titre, description, compétences requises, localisation, type de contrat, salaire indicatif
- Réception d'une shortlist de 5 à 10 profils par offre, avec distinction visuelle claire entre profils **vérifiés humainement** (agent) et profils **matchés par IA** (diplômés)
- Consultation d'une fiche profil détaillée (compétences, expérience, disponibilité, statut de vérification)
- Contact direct du candidat recommandé (messagerie interne simple)
- Tableau de bord des offres publiées et de leur statut d'avancement
- Distinction de statut de compte : `gratuit` / `premium` (le contenu exact des avantages premium — shortlists prioritaires, analytics — peut être un simple flag au MVP, sans forcément développer toutes les fonctionnalités premium immédiatement)

### 4.4 Espace Agent de terrain (back-office)
- Création de profils de talents non-diplômés
- Remplissage de la grille de vérification de compétences
- Vue de suivi des profils qu'il gère (statut, historique)
- Indicateurs personnels simples : nombre de profils créés, taux de vérification, nombre de placements

### 4.5 Back-office administrateur
- Vue d'ensemble de tous les utilisateurs (talents, entreprises, agents)
- Suivi des offres et candidatures actives
- Suivi financier basique : statut d'abonnement entreprise, statut du success fee par placement (voir 4.6) — un suivi déclaratif/manuel suffit au MVP, pas d'automatisation de paiement obligatoire
- Tableau de bord des KPIs du pilote : nombre de profils vérifiés, pourcentage de profils féminins, nombre d'entreprises partenaires actives, nombre de placements réalisés

### 4.6 Mécanisme de success fee (suivi, pas nécessairement paiement automatisé au MVP)
Le MVP doit permettre d'enregistrer et suivre un paiement en deux étapes par placement :
- Étape 1 : versement dû à la signature du contrat par l'entreprise
- Étape 2 : versement dû à la confirmation du poste après la période d'essai

Chaque placement doit avoir un statut clair : `étape 1 due` / `étape 1 payée` / `étape 2 due` / `étape 2 payée` / `annulé`. L'intégration d'une passerelle de paiement automatisée n'est pas requise au MVP ; un suivi déclaratif dans le back-office suffit dans un premier temps.

---

## 5. Contraintes de conception

- **Mobile-first** et interfaces légères : le contexte malgache présente une pénétration internet faible (environ 20% de la population), le SMS et WhatsApp restant les canaux dominants — voir fiche technique pour les chiffres sourcés. L'architecture de notification doit donc être conçue comme un module indépendant, facilement remplaçable/étendable (email au MVP → SMS/WhatsApp Business API en V2).
- Les formulaires utilisés par les agents de terrain doivent rester simples et utilisables par des profils avec un niveau de littératie numérique variable.
- Prévoir une structure permettant une interface bilingue français/malgache à terme (pas nécessairement traduite au MVP, mais éviter le texte codé en dur dans les composants).

---

## 6. Hors périmètre du MVP (fonctionnalités V2 et au-delà)

- Matching sémantique avancé par IA/NLP pour les CV
- Intégration complète et automatisée SMS / WhatsApp Business API
- Passerelle de paiement automatisée pour les abonnements et success fees
- Application mobile native (le MVP est une web app responsive)
- Système de notation/avis mutuel entreprises-talents
- Déploiement multi-régions à grande échelle (le MVP cible uniquement la région pilote)

---

## 7. Critères d'acceptation du MVP

- [ ] Un agent de terrain peut créer un profil talent non-diplômé et le faire passer du statut "en attente" à "vérifié"
- [ ] Un talent diplômé peut déposer un CV et voir une liste d'offres avec un score de matching
- [ ] Une entreprise peut publier une offre et recevoir une shortlist de profils
- [ ] Une entreprise peut distinguer visuellement un profil vérifié humainement d'un profil matché par IA
- [ ] Le tableau de bord administrateur affiche le KPI de pourcentage de profils féminins recommandés
- [ ] Le statut du success fee (étape 1 / étape 2) est visible et modifiable dans le back-office pour chaque placement
