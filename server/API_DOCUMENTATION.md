# 📚 Documentation Complète des APIs - OffRec Backend

**Dernière mise à jour** : 30 septembre 2026  
**Version** : 1.0.0  
**Base URL** : `http://localhost:4000/api`

---

## 📋 Table des matières

1. [Authentication](#authentication)
2. [Verification](#verification)
3. [Opportunities](#opportunities)
4. [Applications](#applications)
5. [Notifications](#notifications)
6. [Messages](#messages)
7. [Directory (Annuaire)](#directory)
8. [AI Assistant](#ai-assistant)
9. [Admin](#admin)
9b. [CV Verification](#cv-verification)
10. [Agent](#agent)
10b. [Recommandations de talents](#recommandations-de-talents)
11. [Talent Account](#talent-account)
12. [Match Suggestions](#match-suggestions)
12b. [Recruiter (tableau de bord)](#recruiter)
13. [Placements](#placements)
14. [Billing](#billing)
15. [Reports](#reports)
16. [Public](#public)

---

## 🔐 Authentication

Base path: `/auth`

### 1. Register (Créer un compte)

**Endpoint** : `POST /auth/register`

**Description** : Crée un nouveau compte utilisateur après vérification email

**Headers** :
```
Content-Type: application/json
```

**Body** :
```json
{
  "email": "user@example.mg",
  "password": "SecurePassword123!",
  "role": "candidate|recruiter|particulier|agent|talent",
  "verificationToken": "token-from-verify-code",
  
  "candidateProfile": {
    "fullName": "Jean Dupont",
    "phone": "+261 32 12 345 67",
    "province": "Antananarivo",
    "city": "Antananarivo",
    "gender": "homme|femme|autre",
    "educationLevel": "bac|licence|master|autodidacte|technique",
    "skills": ["JavaScript", "React", "Node.js"],
    "experienceLevel": "debutant|junior|intermediaire|senior",
    "desiredOpportunityTypes": ["emploi", "stage", "mission", "freelance"],
    "availability": "immediate|m1|m3|flexible",
    "sector": "btp|textile_artisanat|digital|agroalimentaire|services_commerce|autre"
  },
  
  "recruiterProfile": {
    "companyName": "Tech Solutions Madagascar",
    "phone": "+261 32 98 765 43",
    "province": "Antananarivo",
    "city": "Antananarivo",
    "sector": "digital"
  },
  
  "individualProfile": {
    "fullName": "Njaka Randriamampionona",
    "phone": "+261 34 99 111 22",
    "province": "Antananarivo",
    "city": "Antananarivo"
  }
}
```

**Response** (201) :
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.mg",
    "role": "candidate",
    "createdAt": "2026-09-30T10:00:00Z"
  },
  "token": "jwt-token"
}
```

**Erreurs** :
- `400` : Email invalide ou mot de passe trop faible
- `409` : Email déjà utilisé
- `422` : Token de vérification invalide ou expiré

---

### 2. Login (Se connecter)

**Endpoint** : `POST /auth/login`

**Description** : Authentifie un utilisateur et retourne un token JWT

**Body** :
```json
{
  "email": "user@example.mg",
  "password": "SecurePassword123!"
}
```

**Response** (200) :
```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "email": "user@example.mg",
    "role": "candidate",
    "status": "active"
  }
}
```

**Erreurs** :
- `401` : Email ou mot de passe incorrect
- `429` : Trop de tentatives (rate-limited: 20/15min)

---

### 3. Logout (Se déconnecter)

**Endpoint** : `POST /auth/logout`

**Headers** :
```
Authorization: Bearer {token}
```

**Description** : Invalide la session de l'utilisateur (journalisé)

**Response** (200) :
```json
{
  "message": "Déconnecté avec succès"
}
```

---

### 4. Get Current User (Mon profil)

**Endpoint** : `GET /auth/me`

**Headers** :
```
Authorization: Bearer {token}
```

**Description** : Retourne les informations du profil utilisateur connecté

**Response** (200) :
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.mg",
    "role": "candidate",
    "status": "active",
    "createdAt": "2026-09-30T10:00:00Z",
    "candidateProfile": {
      "fullName": "Jean Dupont",
      "phone": "+261 32 12 345 67",
      "skills": ["JavaScript", "React"],
      "cvUrl": "https://...",
      "cvSkillsSuggested": ["Node.js"]
    }
  }
}
```

---

### 5. Update Candidate Profile (Mettre à jour mon profil candidat)

**Endpoint** : `PUT /auth/profile/candidate`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `candidate`

**Body** :
```json
{
  "fullName": "Jean Dupont",
  "phone": "+261 32 12 345 67",
  "province": "Antananarivo",
  "city": "Antananarivo",
  "gender": "homme",
  "educationLevel": "licence",
  "skills": ["JavaScript", "React", "Node.js", "PostgreSQL"],
  "experienceLevel": "junior",
  "desiredOpportunityTypes": ["emploi", "freelance"],
  "availability": "immediate",
  "sector": "digital",
  "cvUrl": "https://example.com/cv.pdf",
  "cvSkillsSuggested": ["TypeScript", "Git"]
}
```

**Response** (200) :
```json
{
  "candidateProfile": {
    "userId": "uuid",
    "fullName": "Jean Dupont",
    "skills": ["JavaScript", "React", "Node.js", "PostgreSQL"],
    "cvUrl": "https://example.com/cv.pdf"
  }
}
```

---

### 6. Upload CV (Télécharger un CV)

**Endpoint** : `POST /auth/profile/candidate/cv`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Rôle requis** : `candidate`

**Body** (multipart) :
```
cv: [binary PDF file, 5 Mo max]
attestation: "true"       (obligatoire — attestation sur l'honneur)
matchingConsent: "true"   (optionnel — case « j'accepte qu'OffRec propose mon profil aux entreprises »)
```

**Description** : 
- Extrait le texte (pdf-parse) puis les données structurées (Gemini) ; rien n'est appliqué automatiquement au profil
- Attestation obligatoire (`cvAttestedAt` enregistré)
- Identité graduée : nom du CV incompatible avec le profil = rejet ; email ou téléphone différent = simple drapeau
- Contrôles automatiques **non décisionnels** (`flags`) : aucun rejet ni sanction n'en découle
- Le fichier n'est écrit sur disque qu'après les validations bloquantes
- Chaque dépôt accepté crée une ligne `CvSubmission`, remet la vérification à `non_verifie` et écrit un `AuditLog` (`cv_upload`)
- `matchingConsent=true` pose `matchingConsentAt` s'il ne l'est pas déjà (`AuditLog` `matching_consent_given`, `source: "cv_upload"`). L'absence du champ ne retire **jamais** un consentement existant
- Après la réponse, le moteur de matching est relancé pour ce candidat (voir [Admin Matching](#admin-matching) — règle hybride). Le score reste calculé sur le profil confirmé, jamais sur les données extraites du CV

**Response** (200) :
```json
{
  "cvUrl": "/uploads/cv/uuid.pdf",
  "suggestedSkills": ["JavaScript", "React", "Node.js", "Git"],
  "extractedData": { "candidateInfo": {}, "experiences": [], "education": [], "...": "..." },
  "validationWarnings": ["L'email du CV (x@y.mg) est différent de l'email du compte."],
  "flags": [
    { "code": "email_different", "severity": "info", "message": "L'email du CV (x@y.mg) est différent de l'email du compte." }
  ],
  "verificationStatus": "non_verifie",
  "matchingConsentAt": "2026-10-08T10:00:00.000Z"
}
```

`matchingConsentAt` : consentement de matching en vigueur après ce dépôt (date ISO), ou `null`.

`validationWarnings` = messages de `flags`. `extractedData` vaut `{}` si l'extraction IA est indisponible.

**Drapeaux** (`{ code, severity: "info" | "alerte", message }`) :

| Code | Gravité | Déclencheur |
|------|---------|-------------|
| `email_different` | info | Email du CV différent de celui du compte |
| `telephone_different` | info | Téléphone du CV différent de celui du profil |
| `doublon_fichier` | alerte | Même fichier (sha256) déjà déposé par un autre compte |
| `dates_chevauchement` | alerte | Deux postes à temps plein, dans deux structures, se recouvrant d'au moins 6 mois |
| `experience_incoherente` | alerte / info | Années couvertes par le CV en dessous (alerte) ou au-dessus (info) du `experienceLevel` déclaré |
| `formation_incoherente` | alerte / info | Diplôme le plus élevé du CV inférieur au `educationLevel` déclaré (alerte), ou aucune formation listée (info) |
| `extraction_ia_indisponible` | info | Extraction IA indisponible : contrôles de cohérence non effectués |

**Erreurs** (toutes `400`, `{ "error": "..." }`) :
- Fichier absent, non-PDF, signature PDF invalide, ou supérieur à 5 Mo
- `attestation` absent ou différent de `"true"`
- Texte du PDF non extractible
- Nom du CV incompatible avec le profil : `{ "error", "validationErrors": ["..."], "message" }`

---

### 6b. Matching Consent (Consentement de matching)

Décision produit 2026-10-08 : le candidat ne postule plus offre par offre. Il donne **un consentement global** (« j'accepte qu'OffRec propose mon profil aux entreprises »), horodaté et révocable. Le serveur le revérifie avant toute transmission d'un profil à un recruteur.

**Donner** : `POST /auth/profile/candidate/matching-consent` — rôle `candidate`, pas de corps.

- Idempotent : si le consentement est déjà actif, sa date d'origine est conservée
- `AuditLog` `matching_consent_given` (`source: "profile"`)
- Relance le moteur de matching après la réponse (sans effet tant qu'aucun CV n'est déposé)

**Response** (200) : `{ "candidateProfile": { "...": "...", "matchingConsentAt": "2026-10-08T10:00:00.000Z" } }`

**Retirer** : `DELETE /auth/profile/candidate/matching-consent` — rôle `candidate`, pas de corps.

- `matchingConsentAt` repasse à `null` : plus aucune nouvelle proposition
- Les suggestions encore en file de validation (`suggeree`) de ce candidat passent à `ecartee`
- Les dossiers déjà transmis à un recruteur (`proposee_recruteur`, `interet_recruteur`) ne sont **pas** retirés : le candidat s'en retire un par un via `POST /match-suggestions/{id}/decline`
- `AuditLog` `matching_consent_withdrawn` (`withdrawnSuggestions`)
- Redonner son consentement plus tard ne réactive pas les lignes écartées

**Response** (200) : `{ "candidateProfile": { "...": "...", "matchingConsentAt": null }, "withdrawnSuggestions": 2 }`

**Erreurs** : `401` non authentifié · `403` autre rôle ou compte suspendu/banni · `404` profil candidat introuvable.

`matchingConsentAt` figure dans `user.candidateProfile` (`/auth/login`, `/auth/me`, `PUT /auth/profile/candidate`). `PUT /auth/profile/candidate` ne permet ni de le poser ni de le retirer (champ ignoré) ; il relance simplement le matching après la réponse. Ce champ n'est jamais transmis à un recruteur.

---

### 7. Download CV (Fichier CV protégé)

**Endpoint** : `GET /uploads/cv/{uuid}.pdf` (hors préfixe `/api`)

**Description** : 
- Remplace l'ancien accès statique public à `/uploads`
- Autorisé au candidat propriétaire (son `cvUrl` ou une de ses `CvSubmission`), à un admin, ou à un vérificateur de CV habilité
- Authentification par cookie de session ; nom de fichier validé strictement (UUID + `.pdf`)

**Erreurs** :
- `401` : Non authentifié
- `403` : Fichier d'un autre candidat, ou compte suspendu/banni
- `404` : Nom invalide ou fichier absent

---

### Champ `canVerifyCv`

L'objet `user` renvoyé par `POST /auth/register`, `POST /auth/login` et `GET /auth/me` porte `canVerifyCv: boolean` — vrai pour un admin ou pour un rôle habilité par l'admin (voir [CV Verification](#cv-verification)).

---

## ✅ Verification

Base path: `/verification`

### 1. Send Verification Code (Envoyer code)

**Endpoint** : `POST /verification/send-code`

**Headers** :
```
Content-Type: application/json
```

**Body** :
```json
{
  "email": "user@example.mg"
}
```

**Description** : 
- Envoie un code de vérification à 4 chiffres par email (Resend)
- Rate-limité : 5 tentatives / 15 minutes
- Code valide 15 minutes

**Response** (200) :
```json
{
  "message": "Code de vérification envoyé",
  "email": "user@example.mg",
  "expiresIn": 900
}
```

**Erreurs** :
- `400` : Email invalide
- `429` : Trop de tentatives
- `503` : Erreur Resend (email non configuré)

---

### 2. Verify Code (Vérifier code)

**Endpoint** : `POST /verification/verify-code`

**Body** :
```json
{
  "email": "user@example.mg",
  "code": "1234"
}
```

**Description** : 
- Vérifie le code à 4 chiffres
- Génère un token de vérification unique
- Rate-limité : 30 tentatives / 15 minutes

**Response** (200) :
```json
{
  "verificationToken": "unique-token",
  "message": "Code vérifié"
}
```

**Erreurs** :
- `400` : Code invalide ou expiré
- `429` : Trop de tentatives

---

### 3. Verification Status (Statut vérification)

**Endpoint** : `GET /verification/status?email=user@example.mg`

**Description** : 
- Vérifie si un email a été confirmé (polling frontend)
- Public (pas d'authentification requise)

**Response** (200) :
```json
{
  "email": "user@example.mg",
  "verified": true,
  "verifiedAt": "2026-09-30T10:00:00Z"
}
```

---

### 4. Confirm via Link (Confirmer via lien)

**Endpoint** : `GET /verification/confirm?token=unique-token`

**Description** : 
- Alternative au code : confirmation via lien email
- Redirection après confirmation

**Response** : Redirection 302 ou message de confirmation

---

## 💼 Opportunities

Base path: `/opportunities`

### 1. List All Opportunities (Toutes les offres)

**Endpoint** : `GET /opportunities`

**Headers** :
```
Authorization: Bearer {token} (optionnel)
```

**Query Parameters** :
```
?province=Antananarivo
?city=Antananarivo
?opportunityType=emploi|stage|mission|freelance|alternance
?sector=digital
?level=junior
?featured=true
```

**Description** : 
- Liste toutes les offres avec score de compatibilité pour candidat connecté
- Scoring automatique si candidat authentifié
- Classement par score décroissant pour candidat

**Response** (200) :
```json
{
  "opportunities": [
    {
      "id": "uuid",
      "recruiterId": "uuid",
      "companyName": "Tech Solutions Madagascar",
      "title": "Développeur React",
      "category": "IT / Digital",
      "sector": "digital",
      "description": "Rejoignez notre équipe...",
      "province": "Antananarivo",
      "city": "Antananarivo",
      "opportunityType": "emploi",
      "requiredSkills": ["React", "TypeScript", "Git"],
      "level": "junior",
      "deadline": "2026-12-31T23:59:59Z",
      "featured": true,
      "createdAt": "2026-09-30T10:00:00Z",
      "score": 87,
      "reasons": ["Compétences React alignées", "Basé à Antananarivo"]
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

---

### 2. Get My Opportunities (Mes offres - Recruteur)

**Endpoint** : `GET /opportunities/mine`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `recruiter`

**Query Parameters** :
```
?status=draft|published|closed
?page=1&limit=20
```

**Response** (200) :
```json
{
  "opportunities": [
    {
      "id": "uuid",
      "title": "Développeur React",
      "status": "published",
      "applicationCount": 12,
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 5
}
```

---

### 3. Get Opportunity Details (Détails d'une offre)

**Endpoint** : `GET /opportunities/{id}`

**Headers** :
```
Authorization: Bearer {token} (optionnel)
```

**Response** (200) :
```json
{
  "opportunity": {
    "id": "uuid",
    "recruiterId": "uuid",
    "companyName": "Tech Solutions Madagascar",
    "title": "Développeur React",
    "category": "IT / Digital",
    "sector": "digital",
    "description": "Rejoignez notre équipe agile...",
    "province": "Antananarivo",
    "city": "Antananarivo",
    "opportunityType": "emploi",
    "requiredSkills": ["React", "TypeScript", "Node.js"],
    "missions": ["Développer les écrans web à partir des maquettes", "Participer aux revues de code"],
    "level": "junior",
    "deadline": "2026-12-31T23:59:59Z",
    "featured": true,
    "createdAt": "2026-09-30T10:00:00Z",
    "score": 87,
    "reasons": ["Compétences React alignées"]
  },
  "recruiter": {
    "companyName": "Tech Solutions Madagascar",
    "phone": "+261 32 12 345 67",
    "sector": "digital"
  }
}
```

---

### 4. Create Opportunity (Créer une offre)

**Endpoint** : `POST /opportunities`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `recruiter`

**Body** :
```json
{
  "title": "Développeur Full Stack",
  "category": "IT / Digital",
  "sector": "digital",
  "description": "Rejoint notre équipe de 5 développeurs...",
  "province": "Antananarivo",
  "city": "Antananarivo",
  "opportunityType": "emploi",
  "requiredSkills": ["React", "Node.js", "PostgreSQL", "Git"],
  "missions": [
    "Concevoir et développer les nouvelles fonctionnalités",
    "Maintenir l’API et la base de données",
    "Relire le code de l’équipe"
  ],
  "level": "intermediaire",
  "deadline": "2026-12-31T23:59:59Z",
  "featured": false,
  "sectorDetails": {
    "stack": "React, Node.js, PostgreSQL",
    "teamSize": 5
  }
}
```

**Response** (201) :
```json
{
  "opportunity": {
    "id": "uuid",
    "title": "Développeur Full Stack",
    "status": "published",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

**Règles `requiredSkills`** (partagées avec le formulaire, `src/lib/opportunityFields.ts`) :
- Suggestions (`COMMON_SKILLS`) **ou saisie libre** ; espaces nettoyés, 2 à 50 caractères, ni email, ni téléphone, ni adresse web.
- Une saisie équivalente à une suggestion à la casse et aux accents près prend le libellé de la suggestion (`"javascript"` → `"JavaScript"`, `"francais"` → `"Français"`) ; les doublons sont fusionnés (le premier est gardé) ; 20 compétences au plus après fusion.
- Le matching (`scoreOpportunity()`, inchangé) compare les compétences sans tenir compte de la casse, mais **avec** les accents : une compétence libre ne compte que si le profil confirmé du candidat porte le même libellé (en pratique : venu de l'extraction du CV).

**Règles `missions`** (facultatif, liste ordonnée, défaut `[]`) :
- Lignes vides ignorées, espaces nettoyés ; 15 missions au plus, 3 à 200 caractères chacune, sans doublon (casse et accents ignorés).
- Ni email, ni téléphone, ni adresse web (OffRec reste l'intermédiaire). Les missions sont montrées au candidat **avant** la mise en relation (`GET /match-suggestions/mine`) : le recruteur ne doit pas y écrire le nom de l'entreprise (aide affichée sous le champ, non détectable automatiquement).
- Renvoyées par `GET /opportunities`, `GET /opportunities/:id`, `GET /opportunities/mine`, `GET /match-suggestions/mine`, la présélection admin (`preselection.opportunity.missions`) et `GET /admin/recruiters/:id`. Elles n'entrent dans aucun score.

**Erreurs** :
- `400` : Données invalides — `details.fieldErrors.missions` (ex. `"Mission 2 : 3 caractères minimum."`, `"15 missions au maximum."`) ou `details.fieldErrors.requiredSkills` (ex. `"« a » : 2 caractères minimum."`, `"20 compétences au maximum."`)
- `401` : Non authentifié
- `403` : Rôle invalide
- `503` : missions non vides alors que le client Prisma du serveur précède la colonne `missions` (serveur à régénérer et redémarrer) ; une offre sans missions reste acceptée

---

### 5. Update Opportunity (Modifier une offre)

**Endpoint** : `PUT /opportunities/{id}`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `recruiter`

**Body** : Mêmes champs que la création. `missions` absent : les missions enregistrées sont conservées ; `missions: []` les efface. Mêmes règles et mêmes erreurs (`400`, `503`) que la création.

**Response** (200) :
```json
{
  "opportunity": {
    "id": "uuid",
    "title": "Développeur Full Stack (Mis à jour)",
    "updatedAt": "2026-09-30T11:00:00Z"
  }
}
```

**Erreurs** :
- `403` : Vous n'êtes pas propriétaire de cette offre
- `404` : Offre non trouvée

---

### 6. Delete Opportunity (Supprimer une offre)

**Endpoint** : `DELETE /opportunities/{id}`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `recruiter`

**Description** : 
- Supprime l'offre et toutes les candidatures associées
- Les favoris sont aussi supprimés

**Response** (204) : Pas de contenu

---

### 7. Get Shortlist (Liste courte - Candidats pour une offre)

**Endpoint** : `GET /opportunities/{id}/shortlist`

**Rôle requis** : `recruiter` (propriétaire de l'offre)

**Description** :
- `opportunity` : `{ id, title }` de l'offre (titre repris dans la modale d'entretien).
- `matched` : candidats diplômés transmis par OffRec (`proposee_recruteur` et au-delà), triés par score. Liste blanche : le **nom** du candidat seulement — **jamais** son email ni son téléphone (corrigé le 2026-10-16 : l'email était renvoyé). « Ce profil m'intéresse » passe par `POST /match-suggestions/{id}/interview` (modale `InterviewScheduleModal`), comme dans « Candidats proposés » ; l'ancien `/interest` répond `400`.
- `proposed` : talents non-diplômés proposés par un agent. Deux scores **séparés, jamais additionnés** :
  `match` (« Adéquation à l'offre », `scoreOpportunity()` inchangé via `talentMatch()`) et `trust`
  (« Confiance », calculée par le serveur). Tri : `match.score` décroissant → `compareSubjectTrust`
  (niveau, E, sources) → `proposedAt` croissant → `talentId` ; coupe à 10 **après** le tri.
- Jamais dans `proposed` : téléphone, commentaire des recommandations, nom des auteurs, photo ou URL de preuve, empreinte d'auteur.

**Response** (200) :
```json
{
  "opportunity": { "id": "uuid", "title": "Développeur React" },
  "matched": [
    { "source": "matche_ia", "suggestionId": "uuid", "candidateId": "uuid", "fullName": "…",
      "status": "proposee_recruteur", "match": { "score": 82, "reasons": ["…"] } }
  ],
  "proposed": [
    {
      "source": "verifie_humain",
      "talentId": "uuid",
      "fullName": "Vololona Randria",
      "trade": "Couturière",
      "city": "Antananarivo",
      "district": "Analamahitsy",
      "status": "place",
      "proposedAt": "2026-09-05T08:00:00.000Z",
      "match": { "score": 44, "reasons": ["Même province : Antananarivo", "Compatible avec votre disponibilité"] },
      "trust": {
        "index": 45, "level": "recommande", "recommendationCount": 4, "independentSources": 4,
        "sourcesWithProof": 1, "evidenceWeight": 2.5, "lastJobAt": "2026-07-12T00:00:00.000Z",
        "reasons": ["4 personnes différentes l’ont recommandée, dont 1 avec photo du travail", "…"],
        "warnings": []
      },
      "verification": { "verifiedAt": "2026-09-30T10:00:00.000Z", "trade": "Couturière", "validated": 3, "total": 3 },
      "endorsements": [
        { "id": "uuid", "authorLabel": "Un client · Analamahitsy", "relation": "client",
          "jobLabel": "Robe de cérémonie sur mesure", "jobDate": "2026-07-12T00:00:00.000Z",
          "highlights": ["Travail soigné"], "proofVerified": true, "createdAt": "2026-08-02T08:00:00.000Z" }
      ]
    }
  ]
}
```
`endorsements` : recommandations retenues (non écartées, une par auteur). `jobLabel` vaut `null` tant que l'agent ne l'a pas revue, ou s'il l'a masquée. `verification` : dernière grille (points validés / total), `null` si aucune.

---

### 8. Bookmark Opportunity (Ajouter aux favoris)

**Endpoint** : `POST /opportunities/{id}/bookmark`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `candidate`

**Response** (201) :
```json
{
  "bookmark": {
    "opportunityId": "uuid",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 9. Remove Bookmark (Retirer des favoris)

**Endpoint** : `DELETE /opportunities/{id}/bookmark`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `candidate`

**Response** (204) : Pas de contenu

---

## 📧 Applications

Base path: `/applications`

### 1. Get My Applications (Mes candidatures)

**Endpoint** : `GET /applications/mine`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `candidate`

**Query Parameters** :
```
?status=envoyee|vue|contactee|refusee
?page=1&limit=20
```

**Response** (200) :
```json
{
  "applications": [
    {
      "id": "uuid",
      "opportunityId": "uuid",
      "opportunityTitle": "Développeur React",
      "companyName": "Tech Solutions Madagascar",
      "status": "vue",
      "createdAt": "2026-09-30T10:00:00Z",
      "updatedAt": "2026-09-30T11:00:00Z"
    }
  ],
  "total": 5
}
```

---

### 2. Get Received Applications (Candidatures reçues)

**Endpoint** : `GET /applications/received`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `recruiter`

Ancien parcours (candidatures directes). Liste blanche : `id`, `opportunityId`, `candidateId`, `candidateName`, `candidateProvince`, `message`, `status`, `createdAt`, `opportunityTitle` — **jamais** l'email ni le téléphone du candidat (`candidateEmail` et `candidatePhone` retirés le 2026-10-16).

**Query Parameters** :
```
?opportunityId=uuid
?status=envoyee|vue|contactee|refusee
?page=1&limit=20
```

**Response** (200) :
```json
{
  "applications": [
    {
      "id": "uuid",
      "candidateId": "uuid",
      "candidateName": "Jean Dupont",
      "opportunityId": "uuid",
      "opportunityTitle": "Développeur React",
      "status": "envoyee",
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 12
}
```

---

### 3. Update Application Status (Mettre à jour statut)

**Endpoint** : `PUT /applications/{id}/status`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `recruiter` (propriétaire de l'offre)

**Body** :
```json
{
  "status": "vue|contactee|refusee"
}
```

**Response** (200) :
```json
{
  "application": {
    "id": "uuid",
    "status": "contactee",
    "updatedAt": "2026-09-30T11:00:00Z"
  }
}
```

---

### 4. Get My Bookmarks (Mes favoris)

**Endpoint** : `GET /applications/mine/bookmarks`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `candidate`

**Response** (200) :
```json
{
  "bookmarks": [
    {
      "id": "uuid",
      "opportunityId": "uuid",
      "title": "Développeur React",
      "companyName": "Tech Solutions Madagascar",
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 3
}
```

---

## 🔔 Notifications

Base path: `/notifications` — session par cookie (`requireAuth`) ; chaque route ne porte que sur les notifications du compte connecté.

### 1. Get My Notifications (Mes notifications)

**Endpoint** : `GET /notifications/mine`

**Query Parameters** (tous optionnels, validés par Zod — valeur invalide → 400) :

| Paramètre | Valeurs | Défaut | Effet |
|-----------|---------|--------|-------|
| `limit` | entier de 1 à 500 | `200` | Nombre maximum de notifications renvoyées (les plus récentes d'abord) |
| `category` | `candidat` \| `recruteur` \| `agent` \| `systeme` \| `moderation` \| `annuaire` | — | Ne renvoie que cette catégorie |
| `unread` | `true` \| `false` | `false` | `true` : uniquement les non lues |

**Response** (200) :
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "category": "recruteur",
      "title": "Mise en relation à confirmer",
      "message": "Tech Solutions est intéressé par le profil de Hery Rakoto pour « Développeur React ». La mise en relation attend votre confirmation.",
      "link": "/admin/mise-en-relation",
      "read": false,
      "createdAt": "2026-10-09T10:00:00.000Z"
    }
  ],
  "total": 5,
  "unreadCount": 3
}
```

- `category` vaut `null` pour les notifications personnelles (candidat, recruteur…) et pour celles créées avant l'ajout de la colonne ; elle n'est renseignée que pour les notifications destinées aux administrateurs.
- `total` et `unreadCount` portent sur **toutes** les notifications du compte, indépendamment de `limit`, `category` et `unread`.

**Erreurs** : `401` sans session, `403` compte suspendu ou banni, `400` paramètre invalide.

---

### 2. Mark Notification as Read (Marquer comme lu)

**Endpoint** : `POST /notifications/{id}/read`

**Response** : `204` sans corps. `404` `{ "error": "Notification introuvable." }` si la notification n'existe pas ou appartient à un autre compte.

---

### 3. Mark All Notifications as Read (Tout marquer comme lu)

**Endpoint** : `POST /notifications/read-all`

Marque comme lues toutes les notifications non lues du compte connecté (jamais celles d'un autre compte : l'identifiant vient de la session). Aucun corps de requête.

**Response** (200) :
```json
{ "updated": 12 }
```

---

### Notifications des administrateurs (`notifyAdmins()`)

Aucun endpoint dédié : les administrateurs lisent leurs notifications par les routes ci-dessus. Côté serveur, `notifyAdmins()` (`src/lib/notify.ts`) crée une notification **in-app** (jamais d'email) pour chaque compte `admin` non suspendu ni banni, hors l'auteur de l'action (`excludeUserId`). Elle est appelée après la réponse HTTP (`scheduleAdminNotification()`), ne fait jamais échouer la requête d'origine et écrit un `AuditLog` `notification_dispatch` par appel.

C'est une **sélection** d'événements, pas un miroir du journal d'audit :

| Catégorie | Événements (`event`) | `link` |
|-----------|----------------------|--------|
| `candidat` | `candidate_registered`, `cv_upload` / `cv_upload_with_consent`, `matching_consent_given`, `matching_consent_withdrawn`, `candidate_declined` | `/admin`, `/verification-cv`, `/admin/mise-en-relation` |
| `recruteur` | `recruiter_registered`, `opportunity_created`, `opportunity_updated`, `opportunity_deleted`, `recruiter_interested`, `recruiter_declined`, `subscription_created` / `subscription_changed`, `placement_declared`, `placement_stage_updated`, « Nouveau message » d'un recruteur | `/admin`, `/admin/mise-en-relation`, `/admin/placements`, `/messages?c=…` |
| `agent` | `talent_created`, `talent_verified`, `talent_proposed`, `sourcing_lead_created`, `talent_lead_received`, `talent_account_registered`, `cv_verification_delegated` | `/admin/agents`, `/admin/placements`, `/verification-cv` |
| `systeme` | `matching_run_summary` — **une** notification récapitulative par exécution du moteur qui a mis des suggestions en file ou envoyé des profils ; rien si l'exécution ne produit rien | `/admin/mise-en-relation` |
| `moderation` | `report_created` | `/admin/moderation` |
| `annuaire` | `individual_registered`, `provider_created`, `provider_claimed` | `/admin`, `/annuaire/{id}` |

Le texte ne contient jamais d'adresse email, de numéro de téléphone, ni le nom d'un membre de l'annuaire ou d'un talent non diplômé.

---

## 💬 Messages

Base path: `/messages`

### 1. Get Conversations (Mes conversations)

**Endpoint** : `GET /messages/conversations`

**Headers** :
```
Authorization: Bearer {token}
```

**Description** : 
- Candidats : aucune conversation (messagerie bloquée)
- Recruteurs/Admin/Agents : conversations avec OffRec admin uniquement

**Response** (200) :
```json
{
  "conversations": [
    {
      "id": "uuid",
      "participantName": "OffRec Admin",
      "lastMessage": "Votre candidat est intéressé...",
      "lastMessageAt": "2026-09-30T11:00:00Z",
      "unreadCount": 2
    }
  ],
  "total": 3
}
```

---

### 2. Get Conversation Messages (Messages d'une conversation)

**Endpoint** : `GET /messages/conversations/{id}`

**Headers** :
```
Authorization: Bearer {token}
```

**Query Parameters** :
```
?page=1&limit=50
```

**Response** (200) :
```json
{
  "messages": [
    {
      "id": "uuid",
      "senderId": "uuid",
      "senderName": "Jean Dupont",
      "content": "Bonjour, j'aimerais postuler...",
      "createdAt": "2026-09-30T10:00:00Z",
      "isOwn": true
    }
  ],
  "total": 15,
  "conversationId": "uuid"
}
```

---

### 3. Start Conversation (Démarrer une conversation)

**Endpoint** : `POST /messages/conversations`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "toUserId": "uuid",
  "message": "Bonjour, j'aimerais discuter...",
  "opportunityId": "uuid (optionnel)"
}
```

**Response** (201) :
```json
{
  "conversation": {
    "id": "uuid",
    "participantId": "uuid",
    "createdAt": "2026-09-30T10:00:00Z"
  },
  "message": {
    "id": "uuid",
    "content": "Bonjour, j'aimerais discuter...",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 4. Contact OffRec (Contacter OffRec)

**Endpoint** : `POST /messages/contact-offrec`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `recruiter | particulier | agent`

**Body** :
```json
{
  "message": "J'aimerais poser une question..."
}
```

**Description** : 
- Route directe vers l'équipe OffRec
- Candidats ne peuvent pas contacter directement
- IA Gemini filtre les messages (pas de révélation d'instructions)

**Response** (201) :
```json
{
  "message": {
    "id": "uuid",
    "status": "sent",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 5. Send Message in Conversation (Envoyer un message)

**Endpoint** : `POST /messages/conversations/{id}/messages`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "content": "Merci pour votre réponse..."
}
```

**Response** (201) :
```json
{
  "message": {
    "id": "uuid",
    "conversationId": "uuid",
    "senderId": "uuid",
    "content": "Merci pour votre réponse...",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

## 📚 Directory (Annuaire de confiance)

Base path: `/directory`

### 1. Get Raw Directory Data (Données brutes)

**Endpoint** : `GET /directory/raw`

**Description** : 
- Données brutes pour frontend (fournisseurs, recommandations, membres)
- Cache de 5 minutes

**Response** (200) :
```json
{
  "providers": [...],
  "recommendations": [...],
  "members": [...],
  "cachedAt": "2026-09-30T10:00:00Z"
}
```

---

### 2. List Providers (Liste prestataires)

**Endpoint** : `GET /directory/providers`

**Query Parameters** :
```
?district=Alasora
?trade=Maçon
?page=1&limit=20
```

**Description** : 
- Liste des prestataires classés par score de confiance
- Bayesian prior appliqué au classement uniquement
- Note affichée = score réel (sans prior)

**Response** (200) :
```json
{
  "providers": [
    {
      "id": "uuid",
      "name": "Briqueterie Rasoa",
      "trade": "Fournisseur de briques",
      "description": "Briques cuites fabriquées sur place...",
      "district": "Alasora",
      "phone": "+261 34 05 112 34",
      "score": 4.8,
      "reasons": ["Qualité constante", "Livraison rapide"],
      "recommendationCount": 8,
      "isClaimed": false
    }
  ],
  "total": 45
}
```

---

### 3. Get Provider Details (Détails prestataire)

**Endpoint** : `GET /directory/providers/{id}`

**Query Parameters** :
```
?district=Alasora
```

**Response** (200) :
```json
{
  "provider": {
    "id": "uuid",
    "name": "Briqueterie Rasoa",
    "trade": "Fournisseur de briques",
    "description": "Briques cuites fabriquées sur place à Alasora...",
    "district": "Alasora",
    "phone": "+261 34 05 112 34",
    "whatsapp": "+261 34 05 112 34",
    "addedBy": "Hery R.",
    "claimedBy": null,
    "createdAt": "2025-02-10T00:00:00Z"
  },
  "score": {
    "average": 4.8,
    "count": 8,
    "wouldUseAgainRate": 100,
    "reasons": ["Qualité constante", "Livraison rapide"],
    "warnings": []
  },
  "recommendations": [
    {
      "id": "uuid",
      "rating": 5,
      "wouldUseAgain": true,
      "jobLabel": "Livraison de 3 000 briques",
      "jobDate": "2026-06-12T00:00:00Z",
      "pricePaid": 480,
      "priceUnit": "par brique",
      "comment": "Briques bien cuites, très peu de casse...",
      "proof": "facture|photo|aucune",
      "authorName": "Hery R.",
      "confirmations": 2
    }
  ]
}
```

---

### 4. Create Provider (Créer fiche prestataire)

**Endpoint** : `POST /directory/providers`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : Authentifié (crée/met à jour le membre)

**Body** :
```json
{
  "name": "Équipe Randria — maçonnerie",
  "trade": "Maçon",
  "description": "Chef de chantier et équipe de 5 maçons...",
  "district": "Ambohimangakely",
  "city": "Antananarivo",
  "province": "Antananarivo",
  "phone": "+261 33 12 556 78",
  "whatsapp": "+261 33 12 556 78",
  "authorDisplayName": "Fanja N.",
  "authorDistrict": "Ambohimangakely"
}
```

**Response** (201) :
```json
{
  "provider": {
    "id": "uuid",
    "name": "Équipe Randria — maçonnerie",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

**Invariants** :
- Une seule fiche par prestataire + membre
- Pas de suppression de fiche (historique)
- Les doublons sont dédoublonnés par auteur

---

### 5. Claim Provider (Revendiquer fiche)

**Endpoint** : `POST /directory/providers/{id}/claim`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "authorDisplayName": "Fanja N.",
  "authorDistrict": "Ambohimangakely"
}
```

**Response** (200) :
```json
{
  "provider": {
    "id": "uuid",
    "claimedBy": "uuid",
    "claimedAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 6. Add Recommendation (Ajouter retour d'expérience)

**Endpoint** : `POST /directory/providers/{id}/recommendations`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "rating": 5,
  "wouldUseAgain": true,
  "jobLabel": "Livraison de 3 000 briques",
  "jobDate": "2026-06-12T00:00:00Z",
  "pricePaid": 480,
  "priceUnit": "par brique",
  "comment": "Briques bien cuites, très peu de casse...",
  "proof": "facture|photo|aucune",
  "authorDisplayName": "Hery R.",
  "authorDistrict": "Alasora"
}
```

**Invariants** :
- Une seule recommandation par membre/prestataire
- Pas d'auto-recommandation si fiche revendiquée
- Prix uniquement avec unité
- Travail daté, commentaire suffisamment renseigné
- Pas de suppression (historique)

**Response** (201) :
```json
{
  "recommendation": {
    "id": "uuid",
    "providerId": "uuid",
    "rating": 5,
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 7. Confirm Recommendation (Confirmer retour)

**Endpoint** : `POST /directory/recommendations/{id}/confirm`

**Headers** :
```
Authorization: Bearer {token}
```

**Description** : 
- Confirme une recommandation (valide l'expérience)
- Pas d'auto-confirmation
- Augmente le poids de confiance du score

**Response** (201) :
```json
{
  "confirmation": {
    "id": "uuid",
    "recommendationId": "uuid",
    "confirmedAt": "2026-09-30T10:00:00Z"
  }
}
```

---

## 🤖 AI Assistant

Base path: `/ai`

### 1. Match Explanation (Explication score)

**Endpoint** : `POST /ai/match-explanation`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `candidate`

**Body** :
```json
{
  "opportunityId": "uuid"
}
```

**Description** : 
- Génère une explication en langage naturel du score de compatibilité
- Utilise Gemini AI (gemini-3.6-flash)
- Rate-limité : 30/15min

**Response** (200) :
```json
{
  "explanation": "Vous avez un score de 87% pour cette offre parce que vos compétences en React et TypeScript correspondent parfaitement à la demande. Cependant, l'expérience requise est intermédiaire et vous êtes au niveau junior, ce qui réduit légèrement votre score."
}
```

---

### 2. AI Assistant (Assistant conversationnel)

**Endpoint** : `POST /ai/assistant`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "message": "Comment augmenter mes chances de trouver un emploi?"
}
```

**Description** : 
- Assistant IA conversationnel, adapté au rôle
- Système prompt différent par rôle (candidate/recruiter/agent/etc.)
- Rate-limité : 30/15min
- Ne révèle jamais les instructions système

**Response** (200) :
```json
{
  "response": "Pour augmenter vos chances de trouver un emploi, je vous recommande de : 1) Compléter votre profil avec des compétences détaillées, 2) Télécharger un CV formaté, 3) Mettre à jour votre disponibilité, 4) Accepter les suggestions de matching."
}
```

---

### 3. Summarize Profile (Résumé profil candidat)

**Endpoint** : `POST /ai/summarize-profile`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `candidate`

**Description** : 
- Génère un résumé du profil candidat en 3 phrases
- Utilisé pour les fiches candidat
- Rate-limité : 30/15min

**Response** (200) :
```json
{
  "summary": "Jean est un développeur React junior avec 2 ans d'expérience et une maîtrise de TypeScript et Node.js. Il cherche activement un emploi à Antananarivo et est disponible immédiatement. Il dispose également de compétences complémentaires en Git et gestion de base de données PostgreSQL."
}
```

---

### 4. Summarize Provider (Résumé fiche prestataire)

**Endpoint** : `POST /ai/summarize-provider/{id}`

**Headers** :
```
Authorization: Bearer {token}
```

**Description** : 
- Résumé d'une fiche prestataire pour visiteurs
- Rate-limité : 30/15min

**Response** (200) :
```json
{
  "summary": "Briqueterie Rasoa est une entreprise familiale de fabrication de briques cuites. Basée à Alasora, elle offre des briques de haute qualité avec livraison sur l'agglomération d'Antananarivo. Les avis des clients sont excellents (4.8/5)."
}
```

---

## 👨‍💼 Admin

Base path: `/admin`

### 1. Get Dashboard Stats (Tableau de bord)

**Endpoint** : `GET /admin/stats`

**Authentification** : cookie de session (`requireRole('admin')`) — 401 sans session, 403 pour tout autre rôle.

Unique source du tableau de bord `/admin`. Tout est lu en base au moment de l'appel (`computedAt`) en requêtes groupées (`groupBy` / `count` / `aggregate`, une lecture par série datée réduite en jours côté serveur, aucune requête par jour) — `server/src/lib/admin-dashboard.ts`. Aucune donnée n'est exclue (les comptes de test `@offrec-test.invalid` sont comptés).

Conventions :
- **Jours** : calendrier de Madagascar, UTC+3 fixe. `seriesDays` = les 30 jours `AAAA-MM-JJ` (aujourd'hui inclus, du plus ancien au plus récent) ; chaque série a 30 valeurs alignées, jour sans événement = 0. « 30 derniers jours » = ces 30 jours entiers.
- **Tendances** : `last7` = événements des 7 × 24 h précédant `computedAt`, `prev7` = les 7 × 24 h d'avant (fenêtres glissantes, jamais une journée partielle comparée à une pleine).
- **Offre ouverte** : `deadline` ≥ début du jour UTC (même définition que le moteur de matching et la présélection).

**Response** (200) — champs historiques conservés tels quels, plus les indicateurs du tableau de bord :
```json
{
  "computedAt": "2026-10-14T13:25:21.096Z",
  "timezone": "UTC+3",
  "seriesDays": ["2026-09-15", "…", "2026-10-14"],
  "signups": {
    "total": [0, 2, 1, "… 30 valeurs"],
    "byRole": { "candidate": ["… 30"], "recruiter": ["…"], "particulier": ["…"], "agent": ["…"], "talent": ["…"], "admin": ["…"] },
    "last30": 66, "last7": 17, "prev7": 15,
    "weeksByRole": { "candidate": { "last7": 9, "prev7": 3 }, "…": {} }
  },
  "accounts": {
    "total": 67,
    "byRole": { "candidate": 25, "recruiter": 15, "particulier": 19, "agent": 2, "talent": 5, "admin": 1 },
    "byStatus": { "active": 65, "warned": 1, "restricted": 0, "suspended": 1, "banned": 0 }
  },
  "candidates": { "total": 25, "withCv": 10, "withConsent": 18, "cvToVerify": 6, "cvVerified": 3, "cvRejected": 1 },
  "matching": {
    "byStatus": { "suggeree": 5, "proposee_candidat": 0, "interet_candidat": 0, "proposee_recruteur": 4, "interet_recruteur": 2, "mise_en_relation": 5, "ecartee": 2 },
    "toValidate": 5, "transmitted": 4, "interest": 2, "connected": 5, "dismissed": 2,
    "sentToRecruiter": 11, "conversionPercent": 45.5,
    "connectedSeries": ["… 30"], "connectedLast30": 4, "connectedLast7": 3, "connectedPrev7": 1,
    "createdLast7": 9, "createdPrev7": 4
  },
  "offers": { "total": 12, "open": 9, "expired": 3, "recruitersWithOpenOffer": 7, "newLast7": 5, "newPrev7": 5 },
  "verifiedEmployment": {
    "talentsTotal": 6,
    "talentsByStatus": { "en_attente": 1, "verifie": 2, "recommande": 2, "place": 1 },
    "signalsToProcess": 1, "signalsInProgress": 0,
    "contactRequestsNew": 1, "contactRequestsOpen": 1, "talentLeadsNew": 0
  },
  "trust": { "companyProofsToReview": 0, "companiesVisible": 2, "talentEndorsements": 6, "companyEndorsements": 6 },
  "billing": {
    "plans": [{ "code": "FREE", "name": "Free", "priceAr": 0, "subscribers": 0 }, { "code": "STARTER", "name": "Starter", "priceAr": 100000, "subscribers": 1 }],
    "paidSubscriptions": 2, "monthlyCatalogAr": 350000,
    "transactionsLast30Ar": 450000, "transactionsLast30Count": 3
  },
  "placements": {
    "total": 3,
    "byStage": { "etape1_due": 1, "etape1_payee": 1, "etape2_due": 1, "etape2_payee": 0, "annule": 0 },
    "inProgress": 3, "completed": 0, "cancelled": 0, "last30": 3
  },
  "notifications": { "adminUnread": 0 },

  "users": { "candidates": 25, "recruiters": 15, "individuals": 19, "agents": 2 },
  "opportunities": 12,
  "applications": 0,
  "providers": 10,
  "recommendations": 29,
  "members": 14,
  "openReports": 3,
  "revenue": { "payingRecruiters": 2, "totalAr": 700000, "transactionCount": 4 },
  "employment": {
    "femalePercent": 66.7, "genderPoolSize": 3, "placements": 3,
    "placementsByStage": { "etape1_due": 1 }, "activePartnerCompanies": 9
  }
}
```

Définitions :
- `candidates.withCv` / `cvToVerify` / `cvVerified` / `cvRejected` : profils candidats avec un CV déposé, par `cvVerificationStatus` (même périmètre que la file `/cv-verification/queue`). `withConsent` : `matchingConsentAt` renseigné.
- `matching.toValidate` : `suggeree` + statuts hérités `proposee_candidat` / `interet_candidat` (même file que « À valider » de la page Mise en relation). `sentToRecruiter` = `proposee_recruteur` + `interet_recruteur` + `mise_en_relation` ; `conversionPercent` = `mise_en_relation` / `sentToRecruiter` (une décimale, `null` si rien n'a été transmis) — les dossiers transmis puis écartés n'y sont pas comptés (leur passé n'est pas conservé sur la ligne).
- `matching.connectedSeries` / `connectedLast7` / `connectedPrev7` : lignes `mise_en_relation` datées par `updatedAt` — statut terminal, donc date de la mise en relation.
- `verifiedEmployment.signalsToProcess` / `signalsInProgress` : signaux `nouveau` / `pris_en_charge` non expirés (`expiresAt` ≥ maintenant ; la purge n'est pas déclenchée par cet appel). `contactRequestsOpen` = `nouvelle` + `transmise`. `talentLeadsNew` : `TalentLead` au statut `nouveau`.
- `trust.companyProofsToReview` : recommandations d'entreprise avec un document joint pas encore examiné (même périmètre que `pendingProofs` de `GET /admin/companies`). `companiesVisible` : fiches non masquées. `talentEndorsements` / `companyEndorsements` : recommandations non écartées.
- `billing` : **paiements simulés**, prix issus de `SubscriptionPlan` ; `monthlyCatalogAr` = Σ prix catalogue × abonnements en cours (revenu théorique, pas un encaissement). `placements` : suivi **déclaratif** du success fee, aucun montant calculé.
- `notifications.adminUnread` : notifications non lues de l'admin qui appelle.

Le journal d'activité n'est plus renvoyé par cet endpoint (champs `recentActivity` et `recentLoginCount` retirés) : il a sa page dédiée, voir § 11 `GET /admin/activity`.

---

### 2. Provision Agent (Créer compte agent)

**Endpoint** : `POST /admin/agents`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `admin`

**Body** :
```json
{
  "email": "agent.terrain@demo.mg",
  "password": "GeneratedPassword123!",
  "agentProfile": {
    "fullName": "Voninkazo Rasolofoson",
    "phone": "+261 34 20 111 22",
    "province": "Antananarivo",
    "city": "Antananarivo"
  }
}
```

**Response** (201) :
```json
{
  "agent": {
    "id": "uuid",
    "email": "agent.terrain@demo.mg",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 3. Get Reports (Signalements)

**Endpoint** : `GET /admin/reports`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `admin`

**Query Parameters** :
```
?status=open|resolved
?targetType=opportunity|provider|recommendation|user
```

**Response** (200) :
```json
{
  "reports": [
    {
      "id": "uuid",
      "type": "opportunity",
      "targetId": "uuid",
      "targetName": "Offre de test",
      "reason": "Contenu offensant",
      "filedBy": "Jean Dupont",
      "status": "open",
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 3
}
```

---

### 4. Resolve Report (Résoudre signalement)

**Endpoint** : `POST /admin/reports/{id}/resolve`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `admin`

**Body** :
```json
{
  "action": "dismiss|warning|restriction|suspension|ban",
  "note": "Contenu vérifié, suppression recommandée"
}
```

**Description** : 
- Pipeline : Warning → Restriction → Suspension → Bannissement
- Actions journalisées (auditLog)

**Response** (200) :
```json
{
  "report": {
    "id": "uuid",
    "status": "resolved",
    "action": "warning",
    "resolvedAt": "2026-09-30T11:00:00Z"
  }
}
```

---

### 5. Get CV Verifier Roles (Rôles habilités à vérifier les CV)

**Endpoint** : `GET /admin/cv-verifier-roles`

**Rôle requis** : `admin`

**Response** (200) :
```json
{
  "roles": ["agent"],
  "grantable": ["agent", "particulier"]
}
```

`roles` = rôles actuellement habilités (l'admin peut toujours vérifier, il n'y figure pas). `grantable` = rôles habilitables. `candidate` et `talent` sont exclus (conflit d'intérêts), `recruiter` aussi (OffRec reste l'intermédiaire : un recruteur n'accède pas aux coordonnées d'un candidat).

---

### 6. Set CV Verifier Roles (Définir les rôles habilités)

**Endpoint** : `PUT /admin/cv-verifier-roles`

**Rôle requis** : `admin`

**Body** (remplace la liste entière) :
```json
{
  "roles": ["agent", "particulier"]
}
```

**Response** (200) : même forme que le `GET`.

**Erreurs** :
- `400` : Un rôle n'est pas dans `grantable`, ou rôle inconnu

Journalisé (`AuditLog` : `admin:cv_verifier_roles`). L'effet est immédiat : l'habilitation est relue en base à chaque requête.

---

### 7. Get Talents (Talents — lecture seule)

**Endpoint** : `GET /admin/talents`

**Response** (200) :
```json
{
  "talents": [
    { "id": "uuid", "fullName": "…", "trade": "Couturière", "sector": "textile_artisanat", "province": "…", "city": "…",
      "district": null, "status": "recommande", "createdAt": "…", "consentAt": null,
      "agent": { "id": "uuid", "name": "Hanta R." },
      "verification": { "verifiedAt": "…", "trade": "…", "validated": 3, "total": 4 },
      "verificationCount": 1, "proposalCount": 1, "placementCount": 0,
      "trust": { "level": "nouveau", "index": null, "...": "SubjectTrust" } }
  ]
}
```
Ni téléphone ni empreinte. Aucune écriture : seul l'agent qui suit un talent le crée ou le modifie.

---

### 8. Get Talent Signals (Signaux « talent recommandé »)

**Endpoint** : `GET /admin/talent-signals?status=nouveau|pris_en_charge|injoignable|converti|refuse|expire|fusionne`

Purge paresseuse des signaux expirés (comme la file des agents). Contact visible pour l'admin (jamais public).

**Response** (200) :
```json
{
  "counts": { "nouveau": 1, "converti": 1 },
  "signals": [
    { "id": "uuid", "trade": "Mécanicien", "sector": "autre", "province": "…", "city": "…", "district": "…",
      "status": "nouveau", "createdAt": "…", "expiresAt": "…", "contactPurged": false,
      "subjectName": "Rado T.", "contactPhone": "034 00 000 01", "contactHint": "…",
      "agentName": null, "talentId": null, "mergedIntoId": null, "endorsementCount": 2,
      "trust": { "level": "nouveau", "...": "SubjectTrust" } }
  ]
}
```

---

### 9. Recruiter Accounts (Comptes recruteurs — consultation)

Lecture seule (page `/admin/recruteurs`). Réponses construites par liste blanche : ni `passwordHash`, ni téléphone du recruteur. Compteurs calculés par requêtes groupées (pas une requête par compte). `GET /admin/companies/recruiters` reste la liste légère utilisée pour lier une fiche entreprise.

**Endpoint** : `GET /admin/recruiters?q=&status=&sort=&limit=&offset=`

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `q` | ≤ 80 caractères ; cherche (sans casse) dans l'email, l'entreprise déclarée et le nom de la fiche entreprise liée | — |
| `status` | `active` \| `warned` \| `restricted` \| `suspended` \| `banned` | tous |
| `sort` | `activity` (dernière activité d'abord) \| `recent` (inscription) \| `name` (entreprise A→Z) | `activity` |
| `limit` | 1–100 | 50 |
| `offset` | ≥ 0 | 0 |

Paramètre invalide -> 400 (`details.fieldErrors`). Sans session -> 401 ; autre rôle qu'admin -> 403.

**Response** (200) :
```json
{
  "total": 2, "totalRecruiters": 2, "limit": 50, "offset": 0,
  "statusCounts": { "active": 2, "warned": 0, "restricted": 0, "suspended": 0, "banned": 0 },
  "recruiters": [
    { "id": "uuid", "email": "recruteur@demo.mg", "displayName": "Entreprise", "status": "active",
      "createdAt": "…", "lastActivityAt": "…",
      "profile": { "companyName": "…", "sector": "digital", "city": "…", "province": "…" },
      "subscription": { "planCode": "PRO", "planName": "…", "priceAr": 0, "startedAt": "…" },
      "linkedCompany": { "id": "uuid", "name": "…", "city": "…", "hidden": false,
                         "trust": { "level": "nouveau", "index": null, "independentSources": 0 } },
      "counts": { "offers": 3, "openOffers": 2, "expiredOffers": 1, "awaitingValidation": 1,
                  "proposedProfiles": 2, "interests": 1, "connections": 1, "discarded": 0,
                  "talentProposals": 1, "placements": 1, "openReports": 0 } }
  ]
}
```
- `statusCounts` porte sur la recherche `q`, sans le filtre `status` (compteurs des puces de filtre) ; `total` = comptes filtrés, `totalRecruiters` = tous les recruteurs.
- `displayName` = entreprise déclarée, à défaut l'email. `profile`, `subscription`, `linkedCompany` valent `null` s'ils n'existent pas ; `linkedCompany.trust` vient de `loadCompanyTrust()`.
- `proposedProfiles` = suggestions actuellement `proposee_recruteur` + `interet_recruteur` + `mise_en_relation` ; `interests` = `interet_recruteur` + `mise_en_relation` ; `connections` = `mise_en_relation` ; `awaitingValidation` = `suggeree` ; `discarded` = `ecartee` ; `talentProposals` = talents proposés par les agents sur ses offres ; `openReports` = signalements ouverts visant le compte. Offre ouverte = date limite ≥ début du jour UTC (même borne que la présélection).
- `lastActivityAt` = la plus récente des dates : inscription, publication d'offre, mise à jour d'une suggestion, proposition de talent, mise à jour d'un placement.

**Endpoint** : `GET /admin/recruiters/:id`

`:id` non UUID -> 400 ; compte absent ou non recruteur -> 404 « Compte recruteur introuvable. »

**Response** (200) :
```json
{
  "recruiter": { "…": "même forme qu'un élément de la liste" },
  "conversationId": "uuid ou null",
  "opportunitiesTotal": 3,
  "opportunities": [
    { "id": "uuid", "title": "…", "companyName": "…", "category": "…", "sector": "digital",
      "opportunityType": "emploi", "level": "junior", "province": "…", "city": "…",
      "requiredSkills": ["React"], "featured": false, "createdAt": "…", "deadline": "…", "expired": false,
      "suggestions": { "suggeree": 1, "proposee_recruteur": 1, "interet_recruteur": 0,
                       "mise_en_relation": 1, "ecartee": 0, "legacy": 0 },
      "talentProposals": 1, "placements": 1 }
  ]
}
```
- Offres ouvertes d'abord (date limite la plus proche en tête), puis expirées (les plus récentes en tête) ; 200 offres au plus (`opportunitiesTotal` donne le total, les compteurs portent sur toutes).
- `suggestions.legacy` regroupe les statuts hérités `proposee_candidat` / `interet_candidat`.
- `conversationId` : conversation existante entre l'admin connecté et ce recruteur (ouvrir `/messages?c=<id>`), sinon `null`.

Liens côté interface (paramètres de requête facultatifs, rétrocompatibles) : `/admin/mise-en-relation?offre=<opportunityId>` présélectionne l'offre, `/admin/moderation?compte=<email>` filtre les signalements visant ce compte, `/admin/entreprises?entreprise=<companyId>` n'affiche que cette fiche.

---

### 10. Candidate Accounts (Comptes candidats — consultation)

Lecture seule (page `/admin/candidats`), `requireRole('admin')`. Réponses construites par liste blanche (`server/src/routes/admin-candidates.routes.ts`, `server/src/lib/admin-candidates.ts`) : ni `passwordHash`, ni empreinte de fichier (`cvFileHash`), ni objet Prisma étalé. Le téléphone n'apparaît que dans le détail. Compteurs calculés par requêtes groupées (pas une requête par compte). Aucune action ici : décision sur le CV via `/cv-verification`, transmission via `/admin/matching`, sanction via `/admin/reports`.

**Endpoint** : `GET /admin/candidates?q=&status=&consent=&cv=&sort=&limit=&offset=`

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `q` | ≤ 80 caractères ; cherche sans casse ni accents dans le nom, l'email et les compétences confirmées du profil | — |
| `status` | `active` \| `warned` \| `restricted` \| `suspended` \| `banned` | tous |
| `consent` | `given` (consentement de matching en vigueur) \| `missing` (jamais donné ou retiré) | tous |
| `cv` | `present` \| `absent` \| `non_verifie` \| `verifie` \| `rejete` (CV déposé dans ce statut) | tous |
| `sort` | `activity` (dernière activité d'abord) \| `recent` (inscription) \| `name` (A→Z) \| `completion` (profil le plus complet d'abord, puis activité) | `activity` |
| `limit` | 1–100 | 50 |
| `offset` | ≥ 0 | 0 |

Paramètre invalide -> 400 (`details.fieldErrors`). Sans session -> 401 ; autre rôle qu'admin -> 403.

**Response** (200) :
```json
{
  "total": 1, "totalCandidates": 5, "limit": 50, "offset": 0,
  "statusCounts": { "active": 1, "warned": 0, "restricted": 0, "suspended": 0, "banned": 0 },
  "candidates": [
    { "id": "uuid", "email": "candidat@demo.mg", "displayName": "Miora Rakoto", "status": "active",
      "createdAt": "…", "lastActivityAt": "…",
      "profile": { "city": "Antananarivo", "province": "Antananarivo", "educationLevel": "licence",
                   "experienceLevel": "junior", "sector": "digital", "skillsCount": 5 },
      "completion": 86,
      "cv": { "uploaded": true, "verificationStatus": "non_verifie", "submittedAt": "…", "flagCount": 1 },
      "matchingConsentAt": "…",
      "counts": { "suggeree": 0, "proposee_recruteur": 0, "interet_recruteur": 0, "mise_en_relation": 1,
                  "ecartee": 0, "legacy": 0, "openReports": 0 } }
  ]
}
```
- `statusCounts` porte sur la recherche et les filtres `consent` / `cv`, sans le filtre `status` (compteurs des puces) ; `total` = comptes filtrés, `totalCandidates` = tous les candidats.
- `displayName` = nom du profil, à défaut l'email ; `profile` et `completion` valent `null` sans profil candidat.
- `completion` (0–100) = même règle que la carte « Complétez votre profil » du candidat : `candidateProfileCompletion()` de `src/lib/recommendation.ts` (nom, téléphone, province, ville, compétences, types d'opportunité, CV).
- `cv.verificationStatus` vaut `null` sans CV ; `cv.submittedAt` = dernier dépôt (`CvSubmission`), à défaut l'attestation puis l'extraction (comme la file des CV).
- `counts` : dossiers (`MatchSuggestion`) par statut, `legacy` regroupant `proposee_candidat` / `interet_candidat` ; `openReports` = signalements ouverts visant le compte.
- `lastActivityAt` = la plus récente des dates : inscription, dernière action du compte au journal d'audit (connexion, dépôt de CV, consentement…), dernier dépôt de CV, consentement, mise à jour d'un dossier.
- Recherche, filtres et tris sont appliqués en mémoire sur une projection étroite des comptes candidats (volume attendu : quelques milliers au plus).

**Endpoint** : `GET /admin/candidates/:id`

`:id` non UUID -> 400 ; compte absent ou non candidat -> 404 « Compte candidat introuvable. »

**Response** (200) :
```json
{
  "candidate": { "…": "même forme qu'un élément de la liste" },
  "profile": { "…": "même forme que GET /admin/matching/candidates/{id} (profil confirmé, téléphone compris)" },
  "completionMissing": ["CV"],
  "cv": {
    "url": "/uploads/cv/uuid.pdf", "submittedAt": "…", "attestedAt": "…",
    "verificationStatus": "rejete", "verifiedAt": "…", "verificationNote": "…",
    "flags": [{ "code": "email_different", "severity": "info", "message": "…" }],
    "submissions": [{ "submittedAt": "…", "current": true, "flagCount": 1 }],
    "history": [{ "decision": "rejete", "note": "…", "verifierName": "Équipe OffRec", "createdAt": "…" }]
  },
  "extracted": {
    "extractedAt": "…", "confidence": "medium", "professionalTitle": "…", "professionalSummary": "…",
    "yearsOfExperience": 3, "skillsNotInProfile": ["Docker"], "technologies": ["Docker"],
    "experiences": [{ "jobTitle": "…", "company": "…", "location": null, "startDate": "2022-01", "endDate": null,
                      "isCurrent": true, "description": "…" }],
    "education": [{ "degree": "…", "school": "…", "field": null, "graduationDate": "2021" }],
    "certifications": [{ "name": "…", "issuer": "…", "issueDate": null }],
    "languages": [{ "name": "Français", "level": "C1" }],
    "projects": [{ "name": "…", "role": null, "description": "…" }],
    "desiredLocations": [], "availability": null
  },
  "dossiersTotal": 1,
  "dossiers": [
    { "id": "uuid", "status": "mise_en_relation", "score": 92, "origin": "systeme", "reasons": ["…"],
      "preselectionRank": null, "createdAt": "…", "updatedAt": "…",
      "opportunity": { "id": "uuid", "title": "…", "companyName": "…", "city": "…", "deadline": "…", "expired": false },
      "recruiter": { "id": "uuid", "email": "recruteur@demo.mg", "displayName": "TechMada" } }
  ]
}
```
- `profile` = profil CONFIRMÉ (liste blanche partagée avec l'aperçu de la mise en relation : `toAdminCandidateProfile()`), `null` sans profil.
- `extracted` = suggestions extraites du CV, NON confirmées par le candidat, `null` sans CV : jamais appliquées au profil ni utilisées dans un score. Les colonnes JSON `cv*` sont relues champ par champ (liste blanche). `skillsNotInProfile` = compétences détectées (`cvSkillsSuggested`) absentes du profil confirmé (comparaison sans casse ni accents). Sans `GEMINI_API_KEY`, seules ces compétences (extraction simple) peuvent être renseignées.
- `cv.url` s'ouvre par le chemin protégé existant `GET /uploads/cv/:file` (admin ou vérificateur habilité) ; les dépôts antérieurs (`submissions`) sont listés sans lien. `history` = décisions de vérification (jamais écrasées), la plus récente d'abord ; `verifierName` jamais un email.
- `dossiers` : les plus récemment mis à jour d'abord, 200 au plus (`dossiersTotal` donne le total ; les compteurs de `candidate.counts` portent sur tous). Offre expirée = date limite < début du jour UTC.

Liens côté interface : `/verification-cv?candidat=<userId>` ouvre directement la fiche de vérification de ce candidat (paramètre facultatif) ; `/admin/mise-en-relation?offre=<opportunityId>`, `/admin/moderation?compte=<email>` et `/admin/recruteurs?id=<userId>` comme ci-dessus.


### 11. Activity Log (Journal d'activité — consultation)

Lecture seule (page `/admin/activite`), `requireRole('admin')`, tirée d'`AuditLog` (`server/src/routes/admin-activity.routes.ts`). Libellés, familles et phrases composés côté serveur dans **un seul module** : `server/src/lib/activity.ts` (aucune table de libellés côté client). Distinct de `/notifications` (sélection d'événements rédigés pour un humain) : ici toutes les actions journalisées.

**Endpoint** : `GET /admin/activity?family=&role=&q=&from=&to=&system=&cursor=&limit=`

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `family` | `comptes` \| `candidats` \| `matching` \| `recruteurs` \| `talents` \| `recommandations` \| `entreprises` \| `moderation` \| `placements` \| `administration` \| `autre` | toutes |
| `role` | rôle de l'acteur : `candidate` \| `recruiter` \| `particulier` \| `admin` \| `agent` \| `talent` | tous |
| `q` | ≤ 80 caractères ; acteur par email, nom du candidat ou de l'agent, raison sociale du recruteur (sans casse) | — |
| `from` | ISO 8601 avec fuseau, inclus | — |
| `to` | ISO 8601 avec fuseau, **exclu** ; doit suivre `from` | — |
| `system` | `1` / `true` : inclure les événements système (`matching_run`, `notification_dispatch`, `talent_signals_purged`) | exclus |
| `cursor` | `nextCursor` de la page précédente (`<ms>_<uuid>`) | — |
| `limit` | 1–100 | 50 |

Paramètre invalide -> 400 (`details.fieldErrors`). Sans session -> 401 ; autre rôle qu'admin -> 403.

Pagination **par curseur** (ordre `createdAt` desc puis `id` desc) : le journal grossit en continu, un décalage (`offset`) ferait réapparaître ou sauter des lignes quand de nouveaux événements arrivent entre deux pages.

**Response** (200) :
```json
{
  "items": [
    { "id": "uuid", "createdAt": "…", "action": "match_suggestion_status", "family": "matching", "system": false,
      "label": "Dossier de mise en relation mis à jour",
      "detail": "Profil : Miora Rakoto · à valider → transmis au recruteur",
      "actor": { "id": "uuid", "displayName": "Administrateur", "role": "admin", "email": "admin@demo.mg", "link": null },
      "actorMasked": false,
      "target": { "type": "offre", "id": "uuid", "label": "« Développeur React »" },
      "link": "/admin/mise-en-relation?offre=uuid" }
  ],
  "nextCursor": "1760434800000_uuid",
  "total": 42,
  "families": [{ "key": "comptes", "label": "Comptes et connexions", "count": 30 }],
  "allCount": 120,
  "includeSystem": false
}
```
- Jamais la `metadata` brute : seuls des éléments utiles et non sensibles en sont extraits (statut, nombre, titre d'offre, nom d'une fiche entreprise, métier et ville d'un talent ou d'un signal). Jamais de téléphone, de contact ni de nom d'un talent recommandé, de commentaire, d'URL ni d'empreinte de fichier.
- `actor` : `null` pour une action de la plateforme (aucun compte) ou quand `actorMasked` vaut `true` — auteur d'une recommandation de talent (`talent_endorsement_created`) ou d'entreprise (`company_endorsement_created`), jamais exposé. Ces lignes sont **exclues** dès que `role` ou `q` est renseigné (le filtre suffirait sinon à révéler l'auteur). `displayName` suit la règle des notifications admin : nom du candidat, raison sociale du recruteur, nom de l'agent ; « Administrateur », « Particulier », « Compte de suivi talent » sinon (jamais nommés). `link` = fiche admin de l'acteur (`/admin/candidats?id=`, `/admin/recruteurs?id=`, `/admin/agents`) ou `null`.
- `target.type` : `compte` \| `offre` \| `entreprise` \| `talent` \| `signal` \| `placement` ; `link` = écran admin concerné (`/admin/mise-en-relation?offre=`, `/verification-cv?candidat=`, `/admin/candidats?id=`, `/admin/recruteurs?id=`, `/admin/entreprises?entreprise=`, `/admin/moderation?compte=`, `/admin/talents`, `/admin/agents`, `/admin/placements`) ou `null`.
- `families` : compteurs par famille sous tous les filtres **sauf** `family` ; `autre` (action inconnue, libellé générique « Action non répertoriée ») n'apparaît que s'il est non nul. `allCount` = leur somme ; `total` = nombre de lignes correspondant aux filtres, famille comprise.
- Acteurs, offres, dossiers, entreprises, talents et signaux référencés sont résolus en un nombre fixe de requêtes groupées (pas de N+1).

Familles et actions (`AuditLog.action`) :

| Famille | Actions |
|---|---|
| `comptes` — Comptes et connexions | `register`, `login`, `logout` |
| `candidats` — Candidats et CV | `matching_consent_given`, `matching_consent_withdrawn`, `cv_upload`, `cv_verification`, `candidate_interested`, `candidate_declined` |
| `matching` — Matching et mise en relation | `match_suggestion_created`, `match_suggestion_status`, `matching_run` (système), `interview_created`, `interview_rescheduled`, `interview_cancelled`, `interview_confirmed`, `interview_unavailable`, `interview_calendar_resync` (lien `/admin/entretiens?periode=tous&offre=…` ; jamais le motif d'un empêchement) |
| `recruteurs` — Offres et recruteurs | `recruiter_interested`, `recruiter_declined` |
| `talents` — Talents et agents de terrain | `talent_consent_profile`, `talent_signal_converted`, `talent_consent_public_granted`, `talent_consent_public_revoked`, `talent_signal_taken`, `talent_signal_status`, `talent_signal_merged`, `talent_contact_requested`, `talent_contact_request_transmise`, `talent_contact_request_close`, `talent_signals_purged` (système) |
| `recommandations` — Recommandations et annuaire | `talent_endorsement_created` (acteur masqué), `endorsement_reviewed`, `endorsement_excluded` |
| `entreprises` — Entreprises | `company_endorsement_created` (acteur masqué), `company_endorsement_proof_reviewed`, `company_endorsement_excluded`, `company_hidden`, `company_unhidden`, `company_recruiter_linked`, `company_recruiter_unlinked` |
| `moderation` — Modération | `moderation:dismiss`, `moderation:warning`, `moderation:restriction`, `moderation:suspension`, `moderation:ban` (tout `moderation:*`) |
| `placements` — Abonnements et placements | `placement_declared` (talent : métier et ville, jamais son nom), `placement_stage_updated`, `admin_corrected_placement_stage` |
| `administration` — Administration | `admin:create_agent`, `admin:cv_verifier_roles`, `notification_dispatch` (système) |
| `autre` — Autres actions | toute action absente de cette table |

Index : `AuditLog` n'a qu'un index sur `userId` ; un index `(createdAt)` ou `(action, createdAt)` accélérerait ce journal sur un gros volume (non ajouté : pas de migration).

---

## 📄 CV Verification

Base path: `/cv-verification`

**Accès** : `admin`, ou rôle habilité par l'admin (`canVerifyCv`). Sinon `401` / `403`.

Les drapeaux automatiques n'éclairent que la lecture : la décision est toujours humaine, et chaque décision est ajoutée à l'historique (jamais écrasée).

### 1. Get Queue (File de vérification)

**Endpoint** : `GET /cv-verification/queue?status=non_verifie|verifie|rejete`

`status` vaut `non_verifie` par défaut. Seuls les candidats ayant un `cvUrl` sont listés, du dépôt le plus ancien au plus récent.

**Response** (200) :
```json
{
  "candidates": [
    {
      "candidateId": "uuid",
      "fullName": "Jean Dupont",
      "email": "jean@example.mg",
      "cvUrl": "/uploads/cv/uuid.pdf",
      "submittedAt": "2026-10-01T10:00:00.000Z",
      "verificationStatus": "non_verifie",
      "flags": [{ "code": "doublon_fichier", "severity": "alerte", "message": "..." }]
    }
  ]
}
```

`submittedAt` peut être `null` pour un CV déposé avant la mise en place de l'historique.

---

### 2. Get Candidate (Fiche de vérification)

**Endpoint** : `GET /cv-verification/candidates/{id}`

**Response** (200) :
```json
{
  "candidate": {
    "candidateId": "uuid",
    "fullName": "Jean Dupont",
    "email": "jean@example.mg",
    "phone": "+261 32 12 345 67",
    "province": "Antananarivo",
    "city": "Antananarivo",
    "educationLevel": "licence",
    "experienceLevel": "junior",
    "skills": ["React"],
    "cvUrl": "/uploads/cv/uuid.pdf",
    "cvProfessionalTitle": "Développeur web",
    "cvExperiences": [],
    "cvEducation": [],
    "cvCertifications": [],
    "cvYearsOfExperience": 2,
    "flags": [],
    "verificationStatus": "rejete",
    "verifiedAt": "2026-10-01T11:00:00.000Z",
    "verificationNote": "Diplôme non justifié",
    "history": [
      { "decision": "rejete", "note": "Diplôme non justifié", "verifierName": "Équipe OffRec", "createdAt": "2026-10-01T11:00:00.000Z" }
    ]
  }
}
```

`history` est trié du plus récent au plus ancien. `verifierName` est le nom du profil agent/particulier, ou « Équipe OffRec » pour un admin (jamais son email).

**Erreurs** : `404` Candidat introuvable

---

### 3. Decide (Décision de vérification)

**Endpoint** : `POST /cv-verification/candidates/{id}/decision`

**Body** :
```json
{
  "decision": "verifie|rejete",
  "note": "Obligatoire si rejete (1000 caractères max)",
  "cvUrl": "/uploads/cv/uuid.pdf (optionnel : fichier lu par le vérificateur)"
}
```

**Response** (200) :
```json
{
  "verificationStatus": "verifie"
}
```

**Description** : 
- Ajoute une ligne `CvVerification`, met à jour le profil (`cvVerificationStatus`, `cvVerifiedAt`, `cvVerifiedById`, `cvVerificationNote`)
- `AuditLog` (`cv_verification`) + `Notification` au candidat (`link: "/candidat/profil"`)
- Un nouveau dépôt de CV remet le statut à `non_verifie`

**Erreurs** :
- `400` : Décision invalide, note manquante pour un rejet, ou candidat sans CV
- `403` : Décision sur son propre compte
- `409` : `cvUrl` fourni différent du CV actuel (le candidat a déposé un nouveau fichier entre-temps)
- `404` : Candidat introuvable

---

## 👥 Agent (Terrain)

Base path: `/agent`

### 1. Get Leads (Demandes non-diplômés)

**Endpoint** : `GET /agent/leads`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `agent`

**Query Parameters** :
```
?status=nouveau|contacte|converti|ignore
```

**Response** (200) :
```json
{
  "leads": [
    {
      "id": "uuid",
      "fullName": "Vololona Randria",
      "phone": "+261 34 40 111 22",
      "trade": "Couturière",
      "province": "Antananarivo",
      "city": "Antananarivo",
      "experience": "Détail expérience...",
      "status": "nouveau",
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 12
}
```

---

### 2. Get Lead Details (Détails demande)

**Endpoint** : `GET /agent/leads/{id}`

**Headers** :
```
Authorization: Bearer {token}
```

**Response** (200) :
```json
{
  "lead": {
    "id": "uuid",
    "fullName": "Vololona Randria",
    "phone": "+261 34 40 111 22",
    "trade": "Couturière",
    "status": "nouveau",
    "details": "Atelier de couture à Analamahitsy...",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 3. Update Lead Status (Mettre à jour statut demande)

**Endpoint** : `PATCH /agent/leads/{id}`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "status": "contacte|converti|ignore"
}
```

**Response** (200) :
```json
{
  "lead": {
    "id": "uuid",
    "status": "contacte",
    "updatedAt": "2026-09-30T11:00:00Z"
  }
}
```

---

### 4. Get Talents (Mes talents)

**Endpoint** : `GET /agent/talents`

**Rôle requis** : `agent` (ses talents seulement)

**Response** (200) : `{ "talents": [ TalentProfile + { "trust": { "level": "recommande", "recommendationCount": 4 } } ] }`
(`TalentProfile` : `id`, `fullName`, `phone`, `province`, `city`, `district`, `gender`, `trade`, `sector`, `skills`, `availability`, `status`, `consentAt`, dates — jamais `phoneKey`).

---

### 5. Get Talent Details (Détails talent)

**Endpoint** : `GET /agent/talents/{id}`

**Response** (200) :
```json
{
  "talent": {
    "id": "uuid", "fullName": "Vololona Randria", "phone": "+261 34 40 111 22", "district": "Analamahitsy",
    "trade": "Couturière", "status": "verifie", "consentAt": "2026-08-20T09:00:00.000Z",
    "verifications": [ { "id": "uuid", "trade": "Couturière", "checklist": {"Couture": true}, "note": "…", "verifiedAt": "…" } ],
    "proposals": [ { "id": "uuid", "opportunityId": "uuid", "proposedAt": "…", "opportunity": { "...": "…" } } ],
    "trust": { "index": 45, "level": "recommande", "recommendationCount": 4, "independentSources": 4, "...": "SubjectTrust" },
    "endorsements": [ { "id": "uuid", "relation": "client", "jobLabel": "…", "comment": "privé", "proof": "photo",
      "proofFileUrl": "/uploads/preuves/…", "proofAccepted": true, "reviewedAt": "…", "hiddenJobLabel": false,
      "excludedAt": null, "authorName": "Miora R.", "authorRoleLabel": "Un candidat", "authorDistrict": "…" } ],
    "opportunityMatches": [ { "opportunityId": "uuid", "score": 44, "reasons": ["…"] } ]
  }
}
```
`consentAt: null` : profil antérieur, accord non tracé. La revue des recommandations passe par `PATCH /agent/endorsements/{id}` (autorisé à l'agent qui suit le talent).

---

### 6. Create Talent (Créer profil talent)

**Endpoint** : `POST /agent/talents`

**Body** :
```json
{
  "fullName": "Vololona Randria",
  "phone": "+261 34 40 111 22",
  "province": "Antananarivo",
  "city": "Antananarivo",
  "district": "Analamahitsy (optionnel)",
  "gender": "femme",
  "trade": "Couturière",
  "sector": "textile_artisanat",
  "skills": ["Couture", "Broderie", "Retouche"],
  "availability": "immediate",
  "consent": true,
  "fromLeadId": "uuid (optionnel)",
  "fromSourcingLeadId": "uuid (optionnel)",
  "fromSignalId": "uuid (optionnel)"
}
```
- `consent: true` **obligatoire** pour toute création (sinon 400) : « La personne a accepté d'avoir un profil OffRec et d'être proposée à des entreprises ». Remplit `consentAt` et écrit un `AuditLog` `talent_consent_profile` (`{ talentId, origin }`).
- Une seule origine à la fois (400 sinon). `phoneKey` est calculé à partir de `phone`.
- `fromSignalId` (même transaction) : signal `nouveau` libre ou suivi par cet agent → `converti` avec `talentId` ; les signaux fusionnés dedans reçoivent le même `talentId` (statut `fusionne` conservé) ; contact effacé. Signal suivi par un autre agent → 409 ; signal déjà traité → 409 ; inconnu → 404. Notification admin « … à partir d'une recommandation ».

**Response** (201) : `{ "talent": TalentProfile }`

**Invariant** : Un profil talent n'est jamais créé sans agent responsable ni sans accord tracé (§7.3.14)

---

### 7. Update Talent (Modifier talent)

**Endpoint** : `PUT /agent/talents/{id}`

**Body** : mêmes champs que la création, sans `consent` ni origine (`district` optionnel). `phoneKey` est recalculé.

**Response** (200) : `{ "talent": TalentProfile }`

---

### 8. Verify Talent (Vérifier talent)

**Endpoint** : `POST /agent/talents/{id}/verify`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "trade": "Couturière",
  "checklist": {
    "Couture": true,
    "Broderie": true,
    "Retouche": true
  },
  "note": "Compétences vérifiées sur le terrain par démo"
}
```

**Response** (201) :
```json
{
  "verification": {
    "id": "uuid",
    "talentId": "uuid",
    "status": "verifie",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 9. Propose Talent (Proposer talent pour offre)

**Endpoint** : `POST /agent/talents/{id}/propose`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "opportunityId": "uuid"
}
```

**Response** (201) :
```json
{
  "proposal": {
    "id": "uuid",
    "talentId": "uuid",
    "opportunityId": "uuid",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 10. Get Agent Stats (Statistiques agent)

**Endpoint** : `GET /agent/stats`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `agent`

**Response** (200) :
```json
{
  "stats": {
    "talentsCreated": 8,
    "talentsVerified": 5,
    "talentsPlaced": 2,
    "verificationRate": 0.625,
    "placementRate": 0.25,
    "leadsProcessed": 15,
    "leadsConverted": 8
  }
}
```

---

### 11. Get Sourcing Leads (Pistes de sourcing)

**Endpoint** : `GET /agent/sourcing`

**Headers** :
```
Authorization: Bearer {token}
```

**Query Parameters** :
```
?status=nouveau|contacte|converti|ignore
?type=talent|opportunity
```

**Response** (200) :
```json
{
  "leads": [
    {
      "id": "uuid",
      "type": "talent",
      "source": "Groupe Facebook « Bâtiment Antananarivo »",
      "trade": "Peintre en bâtiment",
      "sector": "btp",
      "description": "Plusieurs photos de chantiers...",
      "status": "nouveau",
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 5
}
```

---

### 12. Get Sourcing Lead Details

**Endpoint** : `GET /agent/sourcing/{id}`

**Headers** :
```
Authorization: Bearer {token}
```

**Response** (200) :
```json
{
  "lead": {
    "id": "uuid",
    "type": "talent",
    "source": "Groupe Facebook « Bâtiment Antananarivo »",
    "trade": "Peintre en bâtiment",
    "status": "nouveau",
    "description": "Plusieurs photos de chantiers récents...",
    "sourceUrl": "https://facebook.com/...",
    "talentId": null,
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 13. Create Sourcing Lead (Créer piste)

**Endpoint** : `POST /agent/sourcing`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "type": "talent|opportunity",
  "source": "Groupe Facebook « Bâtiment Antananarivo »",
  "trade": "Peintre en bâtiment",
  "sector": "btp",
  "province": "Antananarivo",
  "city": "Antananarivo",
  "description": "Plusieurs photos de chantiers récents...",
  "sourceUrl": "https://facebook.com/..."
}
```

**Response** (201) :
```json
{
  "lead": {
    "id": "uuid",
    "type": "talent",
    "status": "nouveau",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 14. Update Sourcing Lead Status

**Endpoint** : `PATCH /agent/sourcing/{id}`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "status": "contacte|converti|ignore"
}
```

**Response** (200) :
```json
{
  "lead": {
    "id": "uuid",
    "status": "contacte",
    "updatedAt": "2026-09-30T11:00:00Z"
  }
}
```

---

## 🤝 Recommandations de talents

Un membre connecté recommande une personne qu'il a vue travailler (talent informel, sans profil). La recommandation alimente un **signal privé** traité par un agent de terrain : elle ne crée jamais de profil (§7.3.14), rien n'est public. Contact (`subjectName`, `contactPhone`, `contactHint`) et `comment` ne sont lisibles que par l'agent habilité et les admins, et purgés 60 jours après la dernière activité (ou immédiatement en cas de refus). Positif seulement : un problème grave passe par `POST /reports` (`targetType: "endorsement"`).

### 1. Recommander un talent

**Endpoint** : `POST /endorsements/talents` — rôles `candidate`, `particulier`, `recruiter`, `talent` (agent/admin : 403).

**Content-Type** : `multipart/form-data`
- `payload` (texte, JSON) :
```json
{
  "trade": "Mécanicien",
  "sector": "autre",
  "province": "Antananarivo",
  "city": "Antananarivo",
  "district": "Ambohimangakely",
  "subjectName": "Rado",
  "contactPhone": "034 12 345 67",
  "contactHint": "Garage près du marché",
  "relation": "client|employeur|collegue",
  "jobLabel": "Réparation de l'embrayage (8 caractères min.)",
  "jobDate": "2026-09-20",
  "highlights": ["Travail soigné", "Prix respecté"],
  "comment": "Facultatif, ≤ 1000, vu par l'agent seulement",
  "authorDistrict": "Facultatif : quartier de l'auteur"
}
```
  Au moins un de `subjectName` / `contactPhone` / `contactHint`. Téléphone : 9 chiffres après normalisation (`261` ou `0` initial retiré). `jobDate` jamais future. `highlights` : 1 à 5, liste fermée `TALENT_HIGHLIGHTS` (`src/data/endorsements.ts`).
- `proof` (fichier, facultatif) : photo JPEG/PNG/WebP, 5 Mo max, contrôle des octets magiques, segments EXIF (APP1) des JPEG retirés. Stockée sous `uploads/preuves/<uuid>.<ext>`.

**Regroupement** : téléphone d'un `TalentProfile` existant → rattachement au talent (signal `converti`, contact non conservé, notification à son agent) ; sinon signal ouvert de même téléphone → rattachement (échéance repoussée) ; sinon nouveau signal (notification aux agents de la province, à défaut à tous).

**Response** (201) — toujours la même, la personne soit-elle connue ou non :
```json
{ "ok": true, "message": "Merci, un agent OffRec va traiter votre recommandation." }
```

**Erreurs** : 400 (validation, photo non image ou > 5 Mo, point fort inconnu, « Vous ne pouvez pas vous recommander vous-même »), 401, 403 (rôle), 409 (« Vous avez déjà recommandé cette personne »), 429 (10 requêtes / 15 min / IP ; 3 recommandations / 24 h et 10 / 30 jours par membre).

### 2. Mes recommandations

**Endpoint** : `GET /endorsements/mine` — mêmes rôles.

**Response** (200) : `{ "endorsements": [{ "id", "trade", "city", "district", "relation", "jobLabel", "jobDate", "highlights", "hasProof", "proofFileUrl", "createdAt", "status": "en_cours|traitee" }] }` — statut neutre, ni contact ni commentaire.

### 3. File des agents

Base `/agent` (rôle `agent`). Un signal `nouveau` est visible de tous les agents (contact compris, sur la fiche) ; une fois pris en charge, seulement de l'agent qui l'a pris. La purge des signaux expirés tourne au démarrage du serveur et, au plus une fois par heure, au début de ces deux GET.

- `GET /agent/talent-signals?status=nouveau|pris_en_charge|converti|refuse|injoignable|expire|fusionne` — sans `status` : `nouveau` + mes signaux ouverts. Réponse `{ counts, signals: [{ id, trade, sector, province, city, district, status, mine, createdAt, updatedAt, expiresAt, contactPurged, mergedIntoId, talentId, subjectName (si visible), hasPhone, endorsementCount, proofCount, mergedCount, trust: SubjectTrust, possibleDuplicateIds }] }`. Pas de téléphone dans la liste.
- `GET /agent/talent-signals/:id` — fiche : contact, `trust` (calculé serveur par `evaluateSubject`, sans empreinte d'auteur), `endorsements` (avec `comment`, `proofFileUrl`, revue, exclusion, `authorName` « Prénom I. », `authorRoleLabel`, `authorDistrict`), `merged` (signaux fusionnés ici, avec leur contact), `possibleDuplicates`. 404 si pris par un autre agent.
- `POST /agent/talent-signals/:id/take` — prise en charge atomique (`nouveau` sans agent → `pris_en_charge`). 409 si déjà pris.
- `PATCH /agent/talent-signals/:id` `{ "status": "nouveau|pris_en_charge|injoignable|refuse" }` — agent du signal seulement. Transitions : `pris_en_charge → nouveau (rendu à la file) | injoignable | refuse`, `injoignable → pris_en_charge | refuse`. `refuse` purge immédiatement contact, commentaires et photos. 409 si transition impossible.
- `POST /agent/talent-signals/:id/merge` `{ "intoId": "uuid" }` — fusionne un doublon (ouvert, visible) dans un autre : statut `fusionne`, recommandations et contact gardés et visibles depuis la cible, purgés avec elle.
- `PATCH /agent/endorsements/:id` `{ "proofAccepted"?: bool, "reviewed"?: true, "hiddenJobLabel"?: bool, "exclude"?: { "reason": "≥ 3 caractères" } }` — agent du signal (ou du talent rattaché). Seule une preuve acceptée pèse dans la confiance ; une recommandation écartée (auteur lié) reste en base et ne compte plus. Aucune route DELETE.

La création du profil depuis un signal (`converti`, accord de la personne) n'existe pas encore : le lien « Créer le profil » ouvre `/agent/talents/nouveau?fromSignal=<id>` en préremplissage seulement.

### 4. Photo de preuve

**Endpoint** : `GET /uploads/preuves/:file` (hors `/api`, cookie de session) — admin ; agent si le signal est `nouveau`, lui est attribué, ou si le talent rattaché est le sien ; auteur de la recommandation. `Cache-Control: private, no-store`, `Cross-Origin-Resource-Policy: same-site`.

---

## 🎯 Match Suggestions

Base path: `/match-suggestions`

OffRec est l'intermédiaire : candidat et recruteur ne se contactent jamais directement. Depuis la décision du 2026-10-08, le candidat ne postule plus : les suggestions sont créées par le moteur de matching (`origin: "systeme"`) ou par un admin (`origin: "admin"`).

**Statuts** (`MatchSuggestionStatus`) :

| Statut | Sens |
|--------|------|
| `suggeree` | En file de validation admin — invisible du candidat et du recruteur |
| `proposee_recruteur` | Profil transmis au recruteur (par l'admin, ou directement par le moteur si score ≥ seuil haut et CV vérifié) |
| `interet_recruteur` | Intérêt marqué sans date (ancien parcours, plus produit depuis le 2026-10-14) — le recruteur fixe un entretien, ou l'admin confirme |
| `mise_en_relation` | Mise en relation (terminal) : le recruteur a fixé un entretien (`POST /{id}/interview`, décision 2026-10-14) ou l'admin l'a confirmée — seul moment où le candidat est notifié |
| `ecartee` | Écartée par l'admin, déclinée par le recruteur, ou retrait du candidat (terminal) |
| `proposee_candidat`, `interet_candidat` | **Hérités** (parcours « postuler offre par offre ») : plus jamais produits, mais les lignes existantes restent valides et peuvent avancer |

### 1. Get My Suggestions (Mes dossiers - Candidat)

**Endpoint** : `GET /match-suggestions/mine`

**Rôle requis** : `candidate`

**Description** :
- Uniquement les dossiers à partir de `proposee_recruteur` (`proposee_recruteur`, `interet_recruteur`, `mise_en_relation`), plus les lignes héritées `proposee_candidat` / `interet_candidat` encore actives
- Jamais les lignes `suggeree` ni `ecartee`
- `opportunity` est une liste blanche : pas de `recruiterId`, et `companyName` vaut `null` tant que le statut n'est pas `mise_en_relation`

**Response** (200) :
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "opportunityId": "uuid",
      "candidateId": "uuid",
      "score": 87,
      "reasons": ["Compétences alignées : React, Git", "Même province : Antananarivo"],
      "status": "proposee_recruteur",
      "origin": "systeme",
      "createdAt": "2026-10-08T10:00:00.000Z",
      "updatedAt": "2026-10-08T10:00:00.000Z",
      "opportunity": {
        "id": "uuid",
        "title": "Développeur React",
        "category": "Informatique",
        "sector": "digital",
        "sectorDetails": {},
        "description": "...",
        "province": "Antananarivo",
        "city": "Antananarivo",
        "opportunityType": "emploi",
        "requiredSkills": ["React", "Git"],
        "level": "junior",
        "deadline": "2026-12-31T00:00:00.000Z",
        "createdAt": "2026-10-01T10:00:00.000Z",
        "featured": false,
        "companyName": null
      }
    }
  ]
}
```

---

### 2. Get Received Suggestions (Profils reçus - Recruteur)

**Endpoint** : `GET /match-suggestions/received`

**Rôle requis** : `recruiter`

**Description** : profils transmis par OffRec (validation admin ou envoi direct du moteur) pour les offres de ce recruteur — statuts `proposee_recruteur`, `interet_recruteur`, `mise_en_relation`. Le profil candidat est une liste blanche : ni email, ni téléphone, ni CV, ni vérification du CV, ni consentement (l'email du compte candidat n'est plus renvoyé depuis le 2026-10-14).

Triés par offre, de la plus récemment publiée à la plus ancienne (`opportunity.createdAt` décroissant, id de l'offre en départage), puis par score décroissant (id du dossier en départage). `opportunity` ne porte que `id`, `title` et `createdAt` (date de publication de l'offre). Chaque profil porte `fit`, son adéquation critère par critère avec l'offre du recruteur (même calcul que la présélection admin, uniquement dérivé des champs de la liste blanche et de sa propre offre ; `null` si le profil est introuvable), et `preselectionRank`, son rang dans la présélection au moment de la transmission groupée (`null` pour un envoi direct du moteur ou une transmission unitaire). Ne sont jamais transmis : l'origine de la suggestion, l'indice « présent dans le CV », le statut de vérification et les points relevés sur le CV.

**Response** (200) :
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "opportunityId": "uuid",
      "candidateId": "uuid",
      "score": 87,
      "reasons": ["Compétences alignées : React, Git"],
      "status": "proposee_recruteur",
      "preselectionRank": 2,
      "createdAt": "2026-10-08T10:00:00.000Z",
      "updatedAt": "2026-10-08T10:00:00.000Z",
      "opportunity": { "id": "uuid", "title": "Développeur React", "createdAt": "2026-10-01T09:00:00.000Z" },
      "fit": {
        "skills": { "covered": ["React", "Git"], "missing": ["TypeScript"] },
        "location": { "match": "meme_ville", "province": "Antananarivo", "city": "Antananarivo" },
        "level": { "required": "junior", "candidate": "junior", "conforme": true },
        "type": { "offered": "emploi", "match": "souhaite" }
      },
      "candidate": {
        "id": "uuid",
        "candidateProfile": {
          "fullName": "…", "province": "…", "city": "…", "educationLevel": "licence",
          "experienceLevel": "junior", "skills": ["React"], "desiredOpportunityTypes": ["emploi"],
          "availability": "immediate", "sector": "digital"
        }
      }
    }
  ]
}
```

---

### 3. Express Interest (Exprimer un intérêt)

**Endpoint** : `POST /match-suggestions/{id}/interest`

**Rôles** : `candidate` (hérité uniquement) ; `recruiter` → toujours `400`

**Description** :
- **Recruteur** : **retiré** (décision 2026-10-14). « Ce profil m'intéresse » exige une date d'entretien et met directement en relation : voir `POST /match-suggestions/{id}/interview`. Cet endpoint répond `400` avec la marche à suivre et ne modifie rien
- **Candidat** : accepté uniquement pour une ligne héritée `proposee_candidat` (→ `interet_candidat`). Pour tout autre statut : `400` explicite — le consentement global remplace l'intérêt par offre

**Response** (200) : `{ "suggestion": { "id": "uuid", "status": "interet_recruteur", "...": "..." } }`

**Erreurs** : `400` statut incompatible · `403` autre rôle · `404` suggestion introuvable ou appartenant à un autre compte.

---

### 4. Decline Suggestion (Décliner / se retirer)

**Endpoint** : `POST /match-suggestions/{id}/decline`

**Rôles** : `candidate`, `recruiter`

**Description** :
- **Candidat** : se retire d'un dossier, à tout moment avant `mise_en_relation` → `ecartee`. `AuditLog` `candidate_declined` (`metadata.from` = statut quitté, depuis 2026-10-15 — lu par `GET /recruiter/stats`). Une ligne retirée n'est jamais réactivée par le moteur
- **Recruteur** : écarte un profil `proposee_recruteur` ou `interet_recruteur` → `ecartee`. `AuditLog` `recruiter_declined`
- **Écriture conditionnelle** (depuis 2026-10-16) : les deux retraits passent par `commitMatchTransition()` (`lib/preselection-service.ts`, `updateMany` sur le statut lu). Si le dossier a changé entre la lecture et l'écriture (entretien fixé par le recruteur, transition admin, autre retrait), rien n'est écrit et la réponse est `409` « Ce dossier a changé entre-temps. Rechargez la page. » — un retrait et un « Ce profil m'intéresse » simultanés ne passent jamais tous les deux

**Response** (200) : `{ "suggestion": { "id", "opportunityId", "candidateId", "score", "reasons", "status": "ecartee", "preselectionRank", "createdAt", "updatedAt" } }` (liste blanche, sans `origin`)

**Erreurs** : `400` dossier déjà en `mise_en_relation` / `ecartee` (candidat) ou statut incompatible (recruteur) · `403` · `404` · `409` dossier modifié entre-temps.

---

### 5. Interviews (Entretiens — décision 2026-10-14)

« Ce profil m'intéresse » = le recruteur fixe **une** date d'entretien ; le dossier passe aussitôt en `mise_en_relation`. Un seul entretien par dossier (reprogrammé ou annulé en place). Le candidat ne propose jamais de date : il **confirme** ou **signale un empêchement**. Logique : `server/src/lib/interviews.ts` ; la transition réutilise `checkMatchTransition` / `commitMatchTransition` / `notifyMiseEnRelation` (`lib/preselection-service.ts`, table `RECRUITER_ALLOWED_TRANSITIONS`).

**Objet `interview`** (vue candidat et recruteur — liste blanche, jamais `googleEventId`, `calendarError` ni `createdById`) :
```json
{
  "id": "uuid", "suggestionId": "uuid",
  "scheduledAt": "2026-10-20T07:00:00.000Z",
  "durationMinutes": 45,
  "message": "Message du recruteur ou null",
  "status": "planifie | confirme | empechement | annule",
  "provider": "google | simule",
  "meetStatus": "disponible | en_attente | simule",
  "meetUrl": "https://meet.google.com/xxx-xxxx-xxx ou null (toujours null si annulé)",
  "declineReason": "motif de l'empêchement ou null",
  "respondedAt": null, "cancelledAt": null, "rescheduleCount": 0,
  "createdAt": "…", "updatedAt": "…"
}
```
Il apparaît aussi dans `GET /match-suggestions/mine` (champ `interview`, **uniquement** pour un dossier `mise_en_relation`) et `GET /match-suggestions/received`.

**Horaires** : `scheduledAt` est un instant ISO 8601 **avec fuseau** (le client envoie l'heure de Madagascar avec `+03:00`, `Indian/Antananarivo`, UTC+3 fixe), stocké en UTC ; au moins 2 h après maintenant, au plus 60 jours. `durationMinutes` ∈ {30, 45, 60}. `message` (≤ 500) et `reason` (3 à 300) ne doivent contenir ni email ni numéro de téléphone (OffRec reste l'intermédiaire).

**Agenda Google** (`lib/google-calendar.ts`, appels REST directs) : événement dans l'agenda d'OffRec (`GOOGLE_CALENDAR_ID`), lien Meet via `conferenceData.createRequest` (`hangoutsMeet`, `conferenceDataVersion=1`), **sans aucun `attendees`** et avec `sendUpdates=none` : Google n'écrit à personne et aucune adresse n'est exposée ; titre et description sans email ni téléphone. Délai de 8 s par appel, une seule nouvelle tentative. **Si Google échoue, la mise en relation et l'entretien sont enregistrés quand même** (`meetStatus: en_attente`, admins notifiés « Agenda Google à régulariser »). Sans `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN` : **mode simulé** (`provider: simule`, `meetStatus: simule`, `meetUrl: null` — jamais de faux lien).

#### 5a. `POST /match-suggestions/{id}/interview` — fixer l'entretien (recruteur)

**Body** : `{ "scheduledAt": "2026-10-20T10:00:00+03:00", "durationMinutes": 45, "message": "facultatif" }`

- Recruteur **propriétaire de l'offre** ; dossier `proposee_recruteur` ou `interet_recruteur` (→ `mise_en_relation` dans la même transaction que la création de l'entretien), ou `mise_en_relation` sans entretien (confirmé par un admin : l'entretien est seulement ajouté)
- Revérifie le compte candidat actif et son accord de matching (`matchingConsentAt`)
- Écriture conditionnelle + contrainte unique : un double clic ou des requêtes simultanées ne créent jamais deux entretiens
- Candidat notifié **plateforme + email** (`notifyUser()`) : offre, entreprise, date et heure de Madagascar, durée, lien Meet ou « lien à venir », message, action Confirmer / Signaler un empêchement. Recruteur : notification de confirmation. Admins : `notifyAdmins` catégorie `recruteur` (sans email ni téléphone)
- `AuditLog` `match_suggestion_status` (`source: recruiter_interview`) et `interview_created`

**Response** (201) : `{ "suggestion": { "id": "uuid", "status": "mise_en_relation", "…": "…" }, "interview": { … } }` — `suggestion` en liste blanche, sans `origin` (interne à OffRec, comme dans `/received`).

**Erreurs** : `400` corps invalide (date passée, < 2 h, > 60 jours, sans fuseau, durée, coordonnées dans le message) ou dossier non éligible (`ecartee`, `suggeree`…) · `403` autre recruteur ou autre rôle · `404` dossier introuvable · `409` accord retiré, compte candidat suspendu/banni, entretien déjà fixé, dossier modifié entre-temps · `503` client Prisma non régénéré / migration absente (message avec la marche à suivre).

#### 5b. `PATCH /match-suggestions/{id}/interview` — reprogrammer (recruteur)

**Body** : `{ "scheduledAt": "…+03:00", "durationMinutes": 30, "message": "facultatif" }` — `message` omis = conservé, `""`/`null` = effacé.

Depuis n'importe quel statut (après un empêchement, une annulation, ou pour changer). L'entretien repart à `planifie` (`declineReason`, `respondedAt`, `cancelledAt` remis à `null`, `rescheduleCount` + 1) ; l'événement Google est mis à jour (`PATCH`, `sendUpdates=none`) ou recréé. Candidat notifié plateforme + email. `AuditLog` `interview_rescheduled`. **Erreurs** : `400` · `403` · `404` aucun entretien · `409` accord retiré / compte inactif / modification concurrente.

#### 5c. `POST /match-suggestions/{id}/interview/cancel` — annuler (recruteur)

`status: annule`, événement Google supprimé (`sendUpdates=none`). La mise en relation reste acquise. Candidat notifié plateforme + email. `AuditLog` `interview_cancelled`. **Erreurs** : `403` · `404` · `409` déjà annulé.

#### 5d. `POST /match-suggestions/{id}/interview/confirm` — confirmer (candidat)

`planifie` → `confirme` (idempotent si déjà confirmé). Recruteur notifié dans la plateforme. `AuditLog` `interview_confirmed`. **Erreurs** : `403` autre rôle · `404` dossier d'un autre candidat ou pas encore `mise_en_relation` (le candidat ne voit l'entretien qu'à partir de là) · `409` annulé, empêchement déjà signalé, entretien passé.

#### 5e. `POST /match-suggestions/{id}/interview/unavailable` — signaler un empêchement (candidat)

**Body** : `{ "reason": "Examen ce jour-là, disponible la semaine suivante." }`

`planifie`/`confirme` → `empechement`. Recruteur notifié dans la plateforme (avec le motif) ; admins notifiés (catégorie `candidat`, sans le motif). `AuditLog` `interview_unavailable` (sans le texte du motif). **Erreurs** : `400` motif absent, trop court/long ou avec coordonnées · `403` · `404` · `409` annulé ou déjà signalé.

La messagerie reste fermée aux candidats : ces endpoints ne l'ouvrent pas.

#### 5f. `GET /match-suggestions/interviews` — onglet « Entretiens » (recruteur)

**Rôle requis** : `recruiter`. Lecture seule (`server/src/lib/interview-list.ts`).

Entretiens des **offres de ce recruteur uniquement**, sur des dossiers `mise_en_relation`. Chaque ligne est une liste blanche : l'objet `interview` ci-dessus, l'offre (`id`, `title`) et le **nom** du candidat — jamais son email, son téléphone ni rien de son CV.

**Query** (validée par Zod, `400` sinon) :
- `period` : `a_venir` (défaut : non annulé et pas encore terminé, un entretien en cours compris) · `passes` (non annulé, terminé) · `annules` · `tous`
- `status` : `planifie` · `confirme` · `empechement` · `annule` (facultatif)
- `opportunityId` : uuid (facultatif ; l'offre d'un autre recruteur donne une liste vide)

**Tri** : à venir du plus proche au plus lointain, puis passés et annulés du plus récent au plus ancien (`compareInterviewsForList`, `src/lib/interview.ts`). Les compteurs (`counts`, et par offre dans `offers`) portent sur **tous** ses entretiens, indépendamment des filtres ; `toHandle` = empêchements signalés. Plafond de 1 000 entretiens (`truncated: true` au-delà).

**Response** (200) :
```json
{
  "interviews": [
    {
      "interview": { "id": "uuid", "suggestionId": "uuid", "scheduledAt": "2026-10-21T07:00:00.000Z", "durationMinutes": 30, "status": "empechement", "provider": "simule", "meetStatus": "simule", "meetUrl": null, "declineReason": "…", "…": "…" },
      "suggestionId": "uuid",
      "opportunity": { "id": "uuid", "title": "Développeur React" },
      "candidate": { "fullName": "…" }
    }
  ],
  "offers": [{ "id": "uuid", "title": "Développeur React", "total": 3, "upcoming": 2, "toHandle": 1 }],
  "counts": { "total": 6, "upcoming": 4, "toHandle": 1 },
  "truncated": false
}
```

**Erreurs** : `400` filtre invalide · `401` · `403` autre rôle · `503` client Prisma non régénéré ou migration absente.

---

## 📈 Recruiter

Base path: `/recruiter`

### 1. Get Recruiter Dashboard Stats (Tableau de bord recruteur)

**Endpoint** : `GET /recruiter/stats`

**Authentification** : cookie de session (`requireRole('recruiter')`) — 401 sans session, 403 pour tout autre rôle (admin compris). Aucun paramètre : le périmètre est toujours le recruteur de la session (un `?recruiterId=` est ignoré).

Unique source du tableau de bord `/recruteur`. Recalculé à chaque appel (`computedAt`) en requêtes groupées, sans requête par ligne ni par jour — `server/src/lib/recruiter-dashboard.ts`. **Strictement limité** aux offres, dossiers, entretiens, placements, abonnement, notifications et messages du recruteur connecté. Réponse construite par liste blanche : aucun email ni téléphone de candidat, aucun identifiant de candidat, rien de la présélection ATS (ni rang, ni score, ni candidat non transmis, ni suggestion `suggeree`).

Conventions identiques à `GET /admin/stats` (définitions communes de `server/src/lib/day-series.ts`) : jours au calendrier de Madagascar (UTC+3 fixe), `seriesDays` = 30 jours `AAAA-MM-JJ` aujourd'hui inclus, séries de 30 valeurs (jour sans événement = 0), tendances `last7` / `prev7` sur 7 × 24 h glissantes, offre ouverte = `deadline` ≥ début du jour UTC (comme le moteur de matching).

**Response** (200) :
```json
{
  "computedAt": "2026-10-15T07:29:14.621Z",
  "timezone": "UTC+3",
  "seriesDays": ["2026-09-16", "…", "2026-10-15"],
  "offers": { "total": 6, "open": 5, "expired": 1, "newLast7": 4, "newPrev7": 1 },
  "profiles": {
    "received": 15, "toReview": 5, "transmitted": 4, "interest": 1, "connected": 5,
    "dismissed": 5, "declinedByYou": 2, "connectionRate": 33.3,
    "receivedSeries": ["… 30 valeurs"],
    "receivedSeriesByStatus": { "toReview": ["… 30"], "connected": ["… 30"], "dismissed": ["… 30"] },
    "receivedLast30": 14, "receivedLast7": 6, "receivedPrev7": 4,
    "connectedSeries": ["… 30"], "connectedLast30": 4, "connectedLast7": 3, "connectedPrev7": 0
  },
  "byOffer": [
    { "id": "uuid", "title": "Comptable junior", "open": true, "deadline": "2026-11-04T07:29:07.896Z",
      "received": 5, "toReview": 2, "connected": 2, "dismissed": 1 }
  ],
  "interviews": {
    "total": 5, "upcoming": 3, "upcomingConfirmed": 1, "awaitingReply": 1, "toHandle": 1,
    "pastLast30": 1, "cancelled": 1,
    "next": {
      "suggestionId": "uuid", "scheduledAt": "2026-10-16T07:29:07.896Z", "durationMinutes": 60,
      "status": "confirme", "opportunity": { "id": "uuid", "title": "Comptable junior" },
      "candidateName": "Nom du candidat"
    }
  },
  "placements": {
    "total": 7,
    "byStage": { "etape1_due": 2, "etape1_payee": 2, "etape2_due": 1, "etape2_payee": 1, "annule": 1 },
    "inProgress": 5, "completed": 1, "cancelled": 1, "feeStepsDue": 3, "last30": 5
  },
  "subscription": { "planCode": "PRO", "planName": "Pro", "priceAr": 250000, "maxActiveOpportunities": 30, "startedAt": "2026-09-25T07:29:07.896Z" },
  "notifications": { "unread": 4 },
  "messages": { "unread": 4 }
}
```

Définitions :
- **Profils reçus** (`profiles.received`) : dossiers des offres du recruteur que OffRec lui a transmis — statuts `proposee_recruteur`, `interet_recruteur`, `mise_en_relation`, plus les `ecartee` dont la transmission est **prouvée** : transmission journalisée (`AuditLog` `match_suggestion_status` vers `proposee_recruteur`), sortie journalisée depuis un statut visible (admin `from` `proposee_recruteur`/`interet_recruteur` → `ecartee`, `recruiter_declined`, `candidate_declined` avec `from` visible) ou `preselectionRank` renseigné. Un dossier écarté par l'admin dans sa file interne avant transmission n'est jamais compté ; `suggeree` et les statuts hérités `proposee_candidat` / `interet_candidat` ne sont jamais lus. Limite connue : un dossier envoyé directement par le moteur puis retiré par le candidat **avant** le 2026-10-15 (journal sans `from`) n'est pas compté.
- `toReview` = `transmitted` (`proposee_recruteur`) + `interest` (`interet_recruteur`, lignes héritées) ; `connected` = `mise_en_relation` ; `dismissed` = écartés après transmission, dont `declinedByYou` déclinés par ce recruteur ; `connectionRate` = `connected` / `received` en % (une décimale, `null` sans profil reçu).
- **Date de réception** (séries, tendances) : transmission journalisée par un admin si elle existe ; sinon, pour un dossier encore `proposee_recruteur`, sa dernière mise à jour (passage à ce statut) ; sinon sa création (envoi direct du moteur). `receivedSeriesByStatus` répartit chaque jour selon le statut **actuel** des profils reçus ce jour-là.
- `connectedSeries` / `connectedLast7` / `connectedPrev7` : dossiers `mise_en_relation` datés par `updatedAt` (statut terminal) — même règle que l'admin.
- `byOffer` : toutes les offres du recruteur (100 au plus), triées par profils reçus décroissants, puis mises en relation, puis offre la plus récente.
- `interviews` : même périmètre que l'onglet « Entretiens » (`GET /match-suggestions/interviews`, dossiers `mise_en_relation` de ses offres). `upcoming` = non annulé et pas encore terminé (`isInterviewUpcoming`) ; `awaitingReply` = `planifie` pas encore commencé ; `toHandle` = `empechement` ; `pastLast30` = non annulés terminés, débutés dans les 30 jours de la série ; `next` = le plus proche à venir, avec le seul nom du candidat (déjà visible dans « Entretiens »). `interviews` vaut `null` si le modèle `Interview` n'est pas disponible sur le serveur.
- `placements` : suivi **déclaratif** (aucun montant) ; `feeStepsDue` = `etape1_due` + `etape2_due` ; `last30` = déclarés depuis le début de la série.
- `subscription` : plan en cours (**paiement simulé**) ou `null`. Le schéma ne porte pas d'échéance : seule la date de souscription est renvoyée.
- `notifications.unread` : notifications non lues du recruteur ; `messages.unread` : messages reçus non lus dans ses conversations (avec OffRec).

**Erreurs** : `401` · `403`.

---

## 👤 Talent Account

Base path: `/talent-account`

### 1. Get My Talent Profile (Mon profil - Talent)

**Endpoint** : `GET /talent-account/me`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `talent`

**Description** : 
- Lecture seule
- Le talent observe son statut, il n'a jamais créé/modifié son profil
- Seul l'agent peut modifier

**Response** (200) :
```json
{
  "talent": {
    "id": "uuid",
    "fullName": "Vololona Randria",
    "trade": "Couturière",
    "sector": "textile_artisanat",
    "status": "verifie",
    "skills": ["Couture", "Broderie"],
    "availability": "immediate",
    "agentName": "Voninkazo Rasolofoson",
    "verifications": [
      {
        "verifiedAt": "2026-09-30T10:00:00Z",
        "note": "Compétences vérifiées sur le terrain"
      }
    ]
  }
}
```

**Recommandations** : `talent.trust` = `{ "level": "recommande", "recommendationCount": 4, "independentSources": 4 }` — niveau et nombre seulement, jamais l'identité des auteurs, leurs commentaires ni leurs photos. `phoneKey` n'est jamais renvoyé.

---

## 💰 Placements

Base path: `/placements`

### 1. Create Placement (Créer placement)

**Endpoint** : `POST /placements`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `recruiter`

**Body** :
```json
{
  "opportunityId": "uuid (obligatoire)",
  "candidateId": "uuid (pour diplômés)",
  "talentId": "uuid (pour non-diplômés)",
  "monthlySalaryAr": 450000
}
```
Exactement un de `candidateId` / `talentId`.

**Description** :
- Crée un placement pour un candidat diplômé ou un talent non-diplômé et initialise le suivi **déclaratif** du success fee (`stage: etape1_due`)
- Contrôles (depuis 2026-10-16) :
  - l'offre appartient au recruteur connecté (`404` « Offre introuvable. » sinon — même réponse pour une offre inexistante) ;
  - la personne lui a été **proposée pour cette offre** : diplômé → `MatchSuggestion` de ce couple offre/candidat en `proposee_recruteur`, `interet_recruteur` ou `mise_en_relation` ; talent → `TalentOpportunityProposal` créée par un agent. Sinon `400` ;
  - pas de doublon : même offre, même personne, placement non `annule` → `409`. Les déclarations d'une même offre sont sérialisées (verrou `FOR UPDATE` sur la ligne `Opportunity`, sans contrainte unique en base)
- `AuditLog` `placement_declared` dans la même transaction (`placementId`, `opportunityId`, `kind: candidat|talent`, `candidateId` + `suggestionId` ou `talentId`, `monthlySalaryAr` s'il est fourni). Admins notifiés in-app (`placement_declared`)

**Response** (201) :
```json
{
  "placement": {
    "id": "uuid",
    "opportunityId": "uuid",
    "recruiterId": "uuid",
    "candidateId": "uuid",
    "talentId": null,
    "monthlySalaryAr": 450000,
    "stage": "etape1_due",
    "createdAt": "2026-09-30T10:00:00Z",
    "updatedAt": "2026-09-30T10:00:00Z"
  }
}
```

**Erreurs** : `400` corps invalide (offre absente, les deux ou aucun de `candidateId`/`talentId`) ou personne non proposée pour cette offre · `403` autre rôle · `404` offre introuvable ou d'un autre recruteur · `409` placement déjà déclaré.

---

### 2. Get My Placements (Mes placements)

**Endpoint** : `GET /placements/mine`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `recruiter`

**Response** (200) :
```json
{
  "placements": [
    {
      "id": "uuid", "opportunityId": "uuid", "recruiterId": "uuid",
      "candidateId": "uuid", "talentId": null,
      "monthlySalaryAr": 450000, "stage": "etape1_payee",
      "createdAt": "2026-09-30T10:00:00Z", "updatedAt": "2026-09-30T10:00:00Z",
      "opportunity": { "id": "uuid", "title": "Développeur React", "companyName": "TechMada" },
      "candidate": { "id": "uuid", "fullName": "Jean Dupont" },
      "talent": null
    }
  ]
}
```
Liste blanche : le **nom** du candidat ou du talent, **jamais** son email ni son téléphone (corrigé le 2026-10-16 : `candidate.email` était renvoyé).

---

### 3. Update Placement Stage (Mettre à jour étape)

**Endpoint** : `PUT /placements/{id}/stage`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "stage": "etape1_due|etape1_payee|etape2_due|etape2_payee|annule"
}
```

**Description** :
- Suivi déclaratif du success fee (recruteur propriétaire du placement, ou admin)
- Journalisé : `AuditLog` `admin_corrected_placement_stage` pour une correction d'admin ; `placement_stage_updated` (`placementId`, `fromStage`, `toStage`) quand le recruteur change réellement l'étape (depuis 2026-10-16)
- Réponse en liste blanche (mêmes champs que `POST`)

**Response** (200) :
```json
{
  "placement": {
    "id": "uuid",
    "stage": "etape1_payee",
    "updatedAt": "2026-09-30T11:00:00Z"
  }
}
```

---

### 4. Get All Placements (Admin)

**Endpoint** : `GET /placements`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `admin`

**Response** (200) :
```json
{
  "placements": [
    {
      "id": "uuid",
      "recruiterName": "Tech Solutions Madagascar",
      "candidateName": "Jean Dupont",
      "monthlySalaryAr": 450000,
      "stage": "etape1_payee",
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 34
}
```

---

## 💳 Billing

Base path: `/billing`

### 1. Get Plans (Plans disponibles)

**Endpoint** : `GET /billing/plans`

**Description** : Public, pas d'authentification

**Response** (200) :
```json
{
  "plans": [
    {
      "code": "FREE",
      "name": "Free",
      "priceAr": 0,
      "maxActiveOpportunities": 2,
      "features": ["Profil entreprise", "Candidatures reçues", "Statistiques basiques"]
    },
    {
      "code": "STARTER",
      "name": "Starter",
      "priceAr": 100000,
      "maxActiveOpportunities": 10,
      "features": ["Plus d'offres", "Matching amélioré", "Recherche avancée"]
    },
    {
      "code": "PRO",
      "name": "Pro",
      "priceAr": 250000,
      "maxActiveOpportunities": 30,
      "features": ["Matching avancé", "Recommandations prioritaires", "Analytics"]
    },
    {
      "code": "BUSINESS",
      "name": "Business",
      "priceAr": 500000,
      "maxActiveOpportunities": null,
      "features": ["Volume élevé", "Analytics avancés", "Support prioritaire"]
    }
  ]
}
```

---

### 2. Get My Subscription (Mon abonnement)

**Endpoint** : `GET /billing/subscription`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `recruiter`

**Response** (200) :
```json
{
  "subscription": {
    "id": "uuid",
    "plan": {
      "code": "PRO",
      "name": "Pro",
      "priceAr": 250000,
      "maxActiveOpportunities": 30
    },
    "status": "active",
    "startDate": "2026-09-01T00:00:00Z",
    "nextBillingDate": "2026-10-01T00:00:00Z"
  }
}
```

---

### 3. Subscribe to Plan (S'abonner)

**Endpoint** : `POST /billing/subscribe`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `recruiter`

**Body** :
```json
{
  "planCode": "PRO"
}
```

**Description** : 
- Paiement simulé (MockPaymentProvider)
- Crée une transaction dans la base
- Journalisé (auditLog)

**Response** (201) :
```json
{
  "subscription": {
    "id": "uuid",
    "planCode": "PRO",
    "status": "active",
    "createdAt": "2026-09-30T10:00:00Z"
  },
  "transaction": {
    "id": "uuid",
    "type": "subscription",
    "amountAr": 250000,
    "description": "Abonnement Pro"
  }
}
```

---

## 📢 Reports

Base path: `/reports`

### 1. File Report (Signaler)

**Endpoint** : `POST /reports`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "targetType": "opportunity|provider|recommendation|user|endorsement|talent",
  "targetId": "uuid (ou publicRef pour talent)",
  "reason": "Contenu offensant"
}
```

**Description** :
- Crée un signalement
- Admin reçoit notification (catégorie `moderation`, sans motif ni nom)
- `talent` : fiche publique « Talents recommandés ». Le client envoie le `publicRef` (10 caractères `[a-z2-9]`), résolu côté serveur en id du profil (stocké dans `targetId`) ; fiche non publique → 404. La cible de modération (`targetUserId`) est l'**agent qui suit le talent** (il a recueilli l'accord et seul il gère le profil, §7.3.14). L'admin peut aussi retirer la fiche (`PUT /admin/talents/:id/public-visibility`).

**Response** (201) — minimale (ni `targetId` résolu ni `targetUserId`) :
```json
{
  "report": {
    "id": "uuid",
    "targetType": "talent",
    "status": "open",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

`GET /admin/reports` ajoute `targetLabel` (« Couturière · Analamahitsy, Antananarivo ») pour un signalement `talent`.

---

## 🌍 Public

Base path: `/talent-leads`

### 1. Register Talent Lead (Demande de contact)

**Endpoint** : `POST /talent-leads`

**Description** : 
- Formulaire public pour demande de contact non-diplômé
- Pas d'authentification requise
- Rate-limité : 10/15min

**Body** :
```json
{
  "fullName": "Vololona Randria",
  "phone": "+261 34 40 111 22",
  "trade": "Couturière",
  "experience": "Atelier personnel depuis 5 ans...",
  "province": "Antananarivo",
  "city": "Antananarivo"
}
```

**Response** (201) :
```json
{
  "lead": {
    "id": "uuid",
    "fullName": "Vololona Randria",
    "trade": "Couturière",
    "status": "nouveau",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

## 🌟 Talents recommandés (vitrine publique)

Base path: `/talents-recommandes`. Lecture **sans authentification**. N'apparaît qu'un talent dont l'agent a recueilli l'**accord explicite de visibilité publique** (`publicConsentAt`, distinct de `consentAt`, révocable), avec en plus : `consentAt` renseigné, au moins une `TalentVerification`, agent ni suspendu ni banni, compte de suivi du talent (s'il existe) ni suspendu ni banni (`PUBLIC_TALENT_WHERE`, `server/src/lib/public-talents.ts`). Réponses `Cache-Control: no-store`. Limiteur lecture : 300 / 15 min / IP.

**Liste blanche exacte d'un talent public (`PublicTalent`)** — rien d'autre n'est jamais renvoyé (ni nom, même partiel, ni téléphone, ni id interne, ni photo, ni agent, ni commentaire, ni libellé de travail, ni auteur) :
```json
{
  "publicRef": "v7k2mpq4ta",
  "trade": "Couturière",
  "sector": "textile_artisanat",
  "city": "Antananarivo",
  "district": "Analamahitsy",
  "level": "tres_recommande",
  "independentSources": 4,
  "highlights": ["Travail soigné", "Ponctuel·le", "Prix respecté"],
  "verifiedMonth": "2026-10"
}
```
`highlights` : les 3 points forts les plus cités (recommandations retenues). `verifiedMonth` : mois (UTC+3) de la dernière vérification.

### 1. Liste — `GET /talents-recommandes?trade=&city=&limit=`
Filtres `trade`, `city` (≤ 80 car., égalité insensible à la casse), `limit` 1–100 (défaut 60, par section). Tri par confiance seule (`compareSubjectTrust`), puis accord public le plus ancien, puis `publicRef`.
```json
{
  "recommended": ["PublicTalent"],
  "newcomers": ["PublicTalent"],
  "total": { "recommended": 1, "newcomers": 1 },
  "filters": { "trades": ["Couturière"], "cities": ["Antananarivo"] }
}
```
`newcomers` = niveau `nouveau` (section « Nouveaux talents vérifiés », jamais pénalisée).

### 2. Fiche — `GET /talents-recommandes/:publicRef`
`{ "talent": PublicTalent }`. 404 si la fiche n'est pas (ou plus) publique : après un retrait, l'ancien `publicRef` renvoie 404 ; un nouvel accord crée un nouveau `publicRef`.

### 3. Demande de contact — `POST /talents-recommandes/:publicRef/contact`
Rôles : `candidate`, `recruiter`, `particulier`, `talent` (sans session → 401 ; `agent`/`admin` → 403). Body `{ "need": "20 à 1000 caractères" }`. 400 si le compte de suivi du talent se vise lui-même ; 409 si une demande `nouvelle`/`transmise` existe déjà pour ce talent ; 429 au-delà de 5 demandes / 24 h / utilisateur, et limiteur IP 10 / 15 min. Crée une `TalentContactRequest` (`nouvelle`), `AuditLog` `talent_contact_requested`, notifie in-app l'agent du talent (`/agent/demandes-talents`) et les admins (catégorie `agent`) — métier et ville seulement.
```json
{ "request": { "id": "uuid", "status": "nouvelle", "createdAt": "…" }, "message": "Demande envoyée : …" }
```
OffRec reste l'intermédiaire : la plateforme ne transmet jamais les coordonnées du talent ; l'agent organise le contact hors ligne.

### 4. Mes demandes — `GET /talents-recommandes/mes-demandes`
Mêmes rôles. `{ requests: [{ id, need, status, createdAt, handledAt, talent: { trade, city, district, publicRef|null } }] }` (`publicRef` seulement si la fiche est encore publique).

### Agent (rôle `agent`, ses talents seulement — sinon 404)
- `PUT /agent/talents/:id/public-visibility` `{ "granted": boolean }` → `{ publicVisibility: { granted, publicConsentAt, publicRef, visible, blockers[] } }`. Accord : 409 sans `consentAt` ou sans vérification ; nouveau `publicRef` aléatoire ; `AuditLog` `talent_consent_public_granted` `{ talentId }`. Retrait : `publicConsentAt` et `publicRef` à `null`, `AuditLog` `talent_consent_public_revoked` `{ talentId }`. Répéter l'état courant est sans effet. Notification admin (catégorie `agent`).
- `GET /agent/talents/:id` ajoute `publicVisibility` et `publicPreview` (même liste blanche que la vitrine).
- `GET /agent/contact-requests?status=nouvelle|transmise|close` → `{ counts, requests: [{ id, status, need, createdAt, handledAt, talent: { id, fullName, trade, city, district }, requester: { role, roleLabel, name, email, phone } }] }`.
- `PATCH /agent/contact-requests/:id` `{ "status": "transmise" | "close" }` : `nouvelle → transmise → close` ou `nouvelle → close` (sinon 409). `AuditLog` `talent_contact_request_<statut>`. À `transmise`, le demandeur est notifié in-app (lien `/talents#mes-demandes`, sans nom ni contact du talent).

### Admin (rôle `admin`)
- `GET /admin/talents` ajoute `publicConsentAt`, `publicRef`, `publicVisible`, `openContactRequests`.
- `PUT /admin/talents/:id/public-visibility` `{ "granted": false }` : retrait seulement (modération), `AuditLog` `talent_consent_public_revoked`, l'agent est notifié.

### Compte talent
- `GET /talent-account/me` : `talent.publicVisibility = { visible, publicConsentAt, publicRef }` (lecture seule).

---

## 🏢 Entreprises recommandées

Des employeurs recommandés par d'anciens salariés, stagiaires ou prestataires. Positif seulement (un problème grave passe par `POST /reports` avec `targetType: "company"`). **Aucun auteur** (même pseudonyme), **aucun commentaire**, aucun poste ni aucune date ne sortent des réponses publiques, recruteur ou des notifications. Une entreprise masquée par un admin (`hiddenAt`) n'apparaît nulle part. Toutes les lectures publiques renvoient `Cache-Control: no-store` et passent par un limiteur de 300 requêtes / 15 min / IP.

**Liste blanche publique (`PublicCompany`)** : `id`, `name`, `sector`, `city`, `level` (`nouveau` | `recommande` | `tres_recommande`), `independentSources`, `relations` (`{ salarie, stagiaire, prestataire }`, ou `null` sous 3 recommandations retenues), `highlights` (`[{ label, count }]`, du plus cité au moins cité).

### 1. Vitrine et recherche — `GET /companies?q=&city=&sector=&limit=`
Sans authentification. `q` est comparé au nom normalisé (`nameKey` : minuscules, sans accents ni ponctuation, sans SARL/SA/SARLU/SAS/EURL/Ets/Société…). Réponse : `{ companies: PublicCompany[], total, filters: { cities } }`, triée par confiance puis par nom. `q`/`city` > 80 caractères ou secteur inconnu -> 400.

### 2. Fiche — `GET /companies/:id`
`{ company: PublicCompany }` ; id invalide, inconnu ou fiche masquée -> 404.

### 3. Employeur d'une offre — `GET /companies/by-opportunity/:opportunityId`
`{ company: PublicCompany | null }` : fiche visible liée au recruteur de l'offre. Le frontend ne l'appelle que sur `/offres/:id` (public) et dans un dossier candidat **après** `mise_en_relation`.

### 4. Encart du recruteur — `GET /companies/mine` (rôle `recruiter`)
`{ company: { id, name, sector, city, level, recommendationCount, independentSources, highlights } | null }` — `null` si aucune fiche liée ou si elle est masquée.

### 5. Recommander — `POST /endorsements/companies` (rôles `candidate`, `particulier`, `talent` ; sinon 403)
`multipart/form-data` : champ `payload` (JSON) + fichier `proof` facultatif (JPEG, PNG, WebP ou PDF, 5 Mo, octets magiques vérifiés).
```json
{ "companyId": "uuid" }  // OU
{ "company": { "name": "Bâtisseurs du Lac SARL", "sector": "btp", "province": "Antananarivo", "city": "Antananarivo" },
  "relation": "salarie | stagiaire | prestataire", "jobLabel": "Aide-maçon", "jobDate": "2026-08-10",
  "highlights": ["Paie à l’heure"], "comment": "privé, admin seulement", "authorDistrict": "Itaosy" }
```
- Fiche créée si absente, dédoublonnée par `nameKey` + ville canonique.
- 400 : auteur = l'entreprise (recruteur lié, `RecruiterProfile.companyName` normalisé identique, ou même téléphone qu'un recruteur de cette entreprise) ; validation ; fichier refusé. 404 : `companyId` inconnu ou masqué. 409 : déjà recommandée par ce membre. 429 : limiteur IP (10 / 15 min, partagé avec `POST /endorsements/talents`) ou plafond par membre (3 / 24 h, 10 / 30 jours, **communs** aux talents et entreprises).
- 201 `{ ok: true, message }` — message neutre identique dans tous les cas.
- La preuve est enregistrée comme document (`proof: facture`) ; seul un admin et l'auteur peuvent l'ouvrir (`GET /uploads/preuves/:file`).

`GET /endorsements/mine` inclut ces recommandations (`subjectType: "entreprise"`, `companyName`, `companyId` si la fiche est visible, statut neutre `en_cours` tant qu'une preuve attend la revue, `traitee` ensuite).

### Admin (rôle `admin`) — `/admin/companies`
| Méthode | Route | Effet |
|---|---|---|
| GET | `/admin/companies` | Toutes les fiches (masquées comprises), confiance, recruteur lié, `pendingProofs` |
| GET | `/admin/companies/recruiters` | Comptes recruteurs pour la liaison |
| GET | `/admin/companies/:id` | Recommandations avec auteur, commentaire, état de la preuve |
| PATCH | `/admin/companies/endorsements/:id` | `{ proofAccepted: true|false }` -> décision + **fichier supprimé du disque** (409 si aucune preuve en attente) ; `{ exclude: { reason } }` -> écartée (jamais supprimée) |
| PATCH | `/admin/companies/:id/visibility` | `{ hidden: true, reason }` ou `{ hidden: false }` |
| PUT | `/admin/companies/:id/recruiter` | `{ recruiterUserId: uuid | null }` ; non-recruteur -> 400, recruteur déjà lié ailleurs -> 409 ; le recruteur est notifié in-app |

Notifications admin : catégorie `annuaire`, lien `/admin/entreprises`, nom et ville de l'entreprise seulement. Le recruteur lié n'est jamais notifié d'une recommandation.

---

## 📊 Admin Matching

Base path: `/admin/matching` — **rôle requis : `admin`** pour tous les endpoints.

### Moteur de matching (règle hybride, décision 2026-10-08)

`server/src/lib/matching.ts` crée les `MatchSuggestion` automatiquement :

- **Candidats éligibles** : rôle `candidate`, compte actif (`active` ou `warned`), consentement donné (`matchingConsentAt`), CV déposé (`cvUrl`)
- **Offres éligibles** : date limite non dépassée, compte recruteur actif
- **Score** : `scoreOpportunity()` inchangé, calculé sur le profil confirmé par le candidat (jamais sur les colonnes `cv*`) — fonctionne à l'identique sans `GEMINI_API_KEY`. Il faut en plus **au moins une compétence en commun** avec l'offre
- Score ≥ `MATCH_AUTO_THRESHOLD` (défaut 80) **et** CV `verifie` → créée directement en `proposee_recruteur` (le recruteur est notifié)
- Sinon score ≥ `MATCH_THRESHOLD` (défaut 60) → créée en `suggeree` (file de validation admin)
- Au plus `MATCH_MAX_PER_RUN` (défaut 10) créations par exécution, meilleurs scores d'abord
- Idempotent : seules les lignes encore `suggeree` sont rafraîchies (score) ou promues en `proposee_recruteur` ; une ligne `ecartee` n'est jamais réactivée par le moteur ; une ligne avancée ou héritée n'est jamais touchée
- **Déclencheurs** (après la réponse HTTP, sans jamais faire échouer la requête) : dépôt de CV, enregistrement du profil candidat, don du consentement, CV validé par un vérificateur, création ou modification d'une offre
- `AuditLog` `matching_run` : `{ scope, trigger, opportunityId?, evaluated, queued, sentDirect, promoted, refreshed, ignored }` — compteurs uniquement

### 1. Get Preselection (Présélection ATS d'une offre)

**Endpoint** : `GET /admin/matching/opportunities/{id}/preselection`

Remplace l'ancien `GET …/candidate-pool` (supprimé). Lecture seule : rien n'est créé ni transmis. Aucun appel IA — fonctionne à l'identique sans `GEMINI_API_KEY`.

**Query Parameters** :
```
?top=5|10                 (défaut 5)
&verifiedOnly=true|false  CV vérifié uniquement
&sameProvince=true|false  même province que l'offre
&levelMatch=true|false    niveau conforme (écart d'au plus un niveau)
&desiredType=true|false   type d'opportunité déclaré comme recherché par le candidat
```

**Description** (logique pure dans `server/src/lib/preselection.ts`, couche au-dessus de `scoreOpportunity()` dont ni la formule ni les poids ne changent) :

1. **Filtres éliminatoires**, évalués dans cet ordre — un candidat éliminé porte le premier motif rencontré :
   `offre_fermee` (date limite dépassée ou compte recruteur inactif) → `compte_inactif` → `sans_consentement` → `sans_cv` → `deja_ecarte` (suggestion `ecartee` pour cette offre) → `aucune_competence_commune` → `score_insuffisant` (score < `MATCH_THRESHOLD`) → filtres optionnels `cv_non_verifie`, `autre_province`, `niveau_non_conforme`, `type_non_souhaite`.
2. **Classement** des candidats restants : score décroissant, puis nombre de compétences requises couvertes, puis proximité (même ville, même province, autre), puis CV vérifié avant non vérifié avant rejeté, puis moins de points relevés sur le CV, puis consentement le plus ancien, puis identifiant du candidat.
3. **Top N** : les `top` premiers (`ranked`). `counts.qualified` compte tous ceux qui ont passé les filtres.

Tous les comptes candidats sont évalués ; les profils déjà transmis (par un admin ou par l'envoi direct du moteur) restent dans le classement avec l'état de leur suggestion et `transmissible: false`.

`cvHintSkills` : compétences requises absentes du profil mais détectées par l'IA dans le CV (`cvSkillsSuggested`). **Indice affiché uniquement** : il n'entre ni dans le score, ni dans les filtres, ni dans le classement, et n'est jamais transmis au recruteur. `sectorMatch` est une information (le secteur n'est pas un critère).

**Response** (200) :
```json
{
  "preselection": {
    "opportunity": {
      "id": "uuid", "title": "Développeur React", "companyName": "…", "category": "Informatique", "sector": "digital",
      "province": "Antananarivo", "city": "Antananarivo", "opportunityType": "emploi",
      "requiredSkills": ["React", "TypeScript", "Git"], "level": "junior",
      "deadline": "2026-12-31T00:00:00.000Z", "open": true, "closedReason": null
    },
    "top": 5,
    "filters": { "verifiedOnly": false, "sameProvince": false, "levelMatch": false, "desiredType": false },
    "threshold": 60,
    "counts": {
      "evaluated": 12, "eliminated": 5, "qualified": 7, "retained": 5,
      "byMotif": [{ "motif": "sans_consentement", "label": "Accord de matching non donné ou retiré", "count": 3 }]
    },
    "ranked": [
      {
        "rank": 1,
        "candidateId": "uuid", "fullName": "…", "email": "candidat@example.mg",
        "score": 89, "reasons": ["Compétences alignées : React, TypeScript"],
        "fit": {
          "skills": { "covered": ["React", "TypeScript"], "missing": ["Git"] },
          "location": { "match": "meme_ville", "province": "Antananarivo", "city": "Antananarivo" },
          "level": { "required": "junior", "candidate": "junior", "conforme": true },
          "type": { "offered": "emploi", "match": "souhaite" }
        },
        "cvHintSkills": ["Git"],
        "sectorMatch": "identique",
        "cvVerificationStatus": "verifie", "cvFlagCount": 0,
        "consentAt": "2026-10-08T10:00:00.000Z",
        "suggestion": { "id": "uuid", "status": "suggeree", "origin": "systeme" },
        "transmissible": true, "blockedReason": null
      }
    ],
    "eliminated": [
      { "candidateId": "uuid", "fullName": "…", "motif": "sans_cv", "motifLabel": "Aucun CV déposé", "score": 74, "suggestion": null }
    ]
  }
}
```

`fit.location.match` : `meme_ville` | `meme_province` | `autre`. `fit.type.match` : `souhaite` | `sans_preference` | `non_souhaite`. `suggestion` vaut `null` si aucune ligne n'existe pour la paire.

**Erreurs** : `400` `top` différent de 5 ou 10, ou filtre différent de `true`/`false` · `404` offre introuvable.

---

### 1 bis. Transmit Preselection (Transmission groupée au recruteur)

**Endpoint** : `POST /admin/matching/opportunities/{id}/preselection/transmit`

**Body** :
```json
{
  "candidateIds": ["uuid", "uuid"],
  "top": 5,
  "filters": { "verifiedOnly": false, "sameProvince": false, "levelMatch": false, "desiredType": false }
}
```

`candidateIds` : 1 à 10 identifiants distincts. `top` (défaut 5) et `filters` (défaut : aucun) doivent être ceux de la présélection affichée.

**Description** :
- Le serveur **recalcule** la présélection avec ces options : seul un candidat retenu (top N) et `transmissible` part chez le recruteur
- Pour chacun : la suggestion est créée si elle n'existe pas (`origin: "admin"`, `AuditLog` `match_suggestion_created`), puis passe à `proposee_recruteur` par **la même transition que le PATCH unitaire** (§5) : consentement relu en base, transitions autorisées, notification in-app au recruteur, `AuditLog` `match_suggestion_status` (avec `source: "preselection"`, `preselectionRank`, `preselectionTop`)
- Le score et les raisons sont rafraîchis, et le rang est enregistré dans `MatchSuggestion.preselectionRank`
- Une ligne `ecartee` n'est **jamais** réactivée ici : le candidat est refusé (« déjà écarté pour cette offre »). La réactivation reste une action explicite par candidat (`POST /admin/matching/match-suggestions`)
- Un refus n'annule pas les autres envois ; aucune notification n'est envoyée aux candidats

**Response** (200) :
```json
{
  "outcomes": [
    { "candidateId": "uuid", "fullName": "…", "transmitted": true, "reason": null, "rank": 2, "suggestionId": "uuid" },
    { "candidateId": "uuid", "fullName": "…", "transmitted": false, "reason": "Déjà transmis au recruteur.", "rank": 1, "suggestionId": "uuid" }
  ],
  "transmitted": 1,
  "refused": 1
}
```

**Erreurs** : `400` corps invalide (liste vide, plus de 10 identifiants, doublon, identifiant non UUID, `top` invalide) · `404` offre introuvable.

---

### 2. Get Candidate Profile (Profil candidat)

**Endpoint** : `GET /admin/matching/candidates/{id}`

**Response** (200) :
```json
{
  "candidate": {
    "fullName": "…",
    "email": "candidat@example.mg",
    "phone": "+261 …",
    "province": "Antananarivo",
    "city": "Antananarivo",
    "gender": "femme",
    "educationLevel": "licence",
    "skills": ["React", "TypeScript"],
    "experienceLevel": "junior",
    "desiredOpportunityTypes": ["emploi"],
    "availability": "immediate",
    "cvUrl": "/uploads/cv/uuid.pdf",
    "cvVerificationStatus": "non_verifie",
    "cvFlags": [],
    "sector": "digital",
    "matchingConsentAt": "2026-10-08T10:00:00.000Z",
    "memberSince": "2026-09-01T10:00:00.000Z"
  }
}
```

Liste blanche partagée avec `GET /admin/candidates/:id` (`profile`) : `toAdminCandidateProfile()` dans `server/src/lib/admin-candidates.ts`.

---

### 3. Create Match Suggestion (« Proposer » manuel)

**Endpoint** : `POST /admin/matching/match-suggestions`

Mise en file manuelle d'un candidat (depuis la liste des éliminés de la présélection). C'est la seule façon de réactiver un candidat écarté pour une offre.

**Body** :
```json
{ "opportunityId": "uuid", "candidateId": "uuid" }
```

**Description** :
- Crée la suggestion en `suggeree`, `origin: "admin"` — l'admin la transmet ensuite au recruteur par le PATCH (§5)
- Si une ligne `ecartee` existe pour cette paire, elle est réactivée en `suggeree` (seul un admin peut le faire)
- **Aucune notification** n'est envoyée au candidat (la notification « Nouvelle offre recommandée » est supprimée)
- `AuditLog` `match_suggestion_created`

**Response** (201) :
```json
{
  "suggestion": {
    "id": "uuid", "opportunityId": "uuid", "candidateId": "uuid",
    "score": 79, "reasons": ["…"], "status": "suggeree", "origin": "admin",
    "createdAt": "2026-10-08T10:00:00.000Z", "updatedAt": "2026-10-08T10:00:00.000Z"
  }
}
```

**Erreurs** : `400` corps invalide · `404` offre ou candidat introuvable · `409` une suggestion active existe déjà pour cette paire.

---

### 4. Get Match Suggestions (Suivi et file de validation)

**Endpoint** : `GET /admin/matching/match-suggestions`

**Query Parameters** :
```
?status=suggeree|proposee_recruteur|interet_recruteur|mise_en_relation|ecartee|proposee_candidat|interet_candidat
```

**Description** : sans `status`, toutes les suggestions (mise à jour la plus récente d'abord). `?status=suggeree` = **file de validation**, triée par score décroissant.

**Response** (200) :
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "opportunityId": "uuid",
      "candidateId": "uuid",
      "score": 79,
      "reasons": ["Même province : Antananarivo", "Niveau d’expérience compatible"],
      "status": "suggeree",
      "origin": "systeme",
      "createdAt": "2026-10-08T10:00:00.000Z",
      "updatedAt": "2026-10-08T10:00:00.000Z",
      "opportunity": { "id": "uuid", "title": "Développeur React", "companyName": "…" },
      "candidate": { "id": "uuid", "email": "candidat@example.mg", "candidateProfile": { "fullName": "…" } },
      "cvVerificationStatus": "non_verifie",
      "cvFlagCount": 0,
      "matchingConsent": true,
      "interview": null
    }
  ]
}
```

Pour un dossier `mise_en_relation`, `interview` porte l'entretien fixé par le recruteur (objet de `/match-suggestions` §5, plus `calendarError` et `hasGoogleEvent`), sinon `null`.

**Erreurs** : `400` statut inconnu.

---

### 5. Update Suggestion Status (Transmettre / écarter / mettre en relation)

**Endpoint** : `PATCH /admin/matching/match-suggestions/{id}`

**Body** :
```json
{ "status": "proposee_recruteur" }
```

**Transitions autorisées** :

| Depuis | Vers |
|--------|------|
| `suggeree` | `proposee_recruteur`, `ecartee` |
| `proposee_recruteur` | `ecartee` |
| `interet_recruteur` | `mise_en_relation`, `ecartee` |
| `proposee_candidat` (hérité) | `proposee_recruteur`, `ecartee` |
| `interet_candidat` (hérité) | `proposee_recruteur`, `ecartee` |
| `mise_en_relation`, `ecartee` | — (terminaux) |

**Description** :
- Tout passage à `proposee_recruteur` exige le consentement en vigueur du candidat, sinon `409` ; tout passage à `mise_en_relation` exige aussi ce consentement et un compte candidat non suspendu/banni (mêmes règles que le recruteur qui fixe un entretien, `checkMatchTransition`)
- Écriture conditionnelle : si le dossier a changé entre-temps, `409`
- `proposee_recruteur` : notification in-app au recruteur (« Nouveau candidat proposé »)
- `mise_en_relation` : notification in-app au recruteur, et **notification in-app + email au candidat** (nom de l'entreprise, lien vers son espace) via `notifyUser()` — c'est le seul moment où le candidat est notifié. Sans `RESEND_API_KEY`, l'email n'est pas envoyé mais la notification in-app est créée. Chaque tentative écrit un `AuditLog` `notification_dispatch` `{ event, channel, status, reason }` sans donnée personnelle
- `AuditLog` `match_suggestion_status` (`from`, `to`)

**Response** (200) : `{ "suggestion": { "id": "uuid", "status": "proposee_recruteur", "...": "..." } }`

**Erreurs** : `400` transition non autorisée ou corps invalide · `404` suggestion introuvable · `409` consentement du candidat absent ou retiré.

---

### 6. Run Matching (Relancer le matching d'une offre)

**Endpoint** : `POST /admin/matching/opportunities/{id}/run-matching`

**Description** : exécute le moteur pour cette offre, de façon synchrone, avec la même règle hybride que les déclencheurs automatiques.

**Response** (200) :
```json
{
  "result": {
    "scope": "opportunity",
    "eligible": true,
    "evaluated": 12,
    "queued": 3,
    "sentDirect": 1,
    "promoted": 0,
    "refreshed": 2,
    "ignored": 6
  },
  "config": { "threshold": 60, "autoThreshold": 80, "maxPerRun": 10 }
}
```

`queued` = créées en `suggeree` ; `sentDirect` = créées en `proposee_recruteur` ; `promoted` = `suggeree` → `proposee_recruteur` ; `refreshed` = score mis à jour ; `ignored` = sans effet (sous le seuil, sans compétence commune, déjà traitée, écartée, plafond atteint).

**Erreurs** : `404` offre introuvable · `409` offre expirée ou compte recruteur inactif.

---

### 7. Resync Interview Calendar (Régulariser l'agenda Google d'un entretien)

**Endpoint** : `POST /admin/matching/interviews/{id}/calendar-sync`

**Description** : relance la synchronisation de l'événement Google d'un entretien (lien Meet en attente, horaire non reporté, suppression échouée), ou crée l'événement et le lien Meet d'un entretien fixé en mode simulé avant la configuration de Google (il passe alors en `provider: google`). Quand un lien devient disponible ou change, le candidat (plateforme + email) et le recruteur (plateforme) sont prévenus ; rien n'est renvoyé si le lien est inchangé. Un entretien annulé portant encore un événement : l'événement est supprimé. `AuditLog` `interview_calendar_resync`.

**Response** (200) : `{ "interview": { …, "calendarError": null, "hasGoogleEvent": true } }`

**Erreurs** : `404` entretien introuvable · `409` agenda Google non configuré (mode simulé), entretien terminé, ou entretien annulé sans événement Google · `502` Google échoue encore (`calendarError` mis à jour) · `503` client Prisma non régénéré.

---

### 8. List Interviews (Onglet « Entretiens » de l'admin)

**Endpoint** : `GET /admin/matching/interviews`

**Description** : tous les entretiens de la plateforme, lecture seule (`server/src/lib/interview-list.ts`). Deux requêtes au plus par page (entretiens, puis leurs dossiers), jamais une par ligne ; liste blanche explicite (ni `passwordHash`, ni email ni téléphone).

**Query** (validée par Zod, `400` sinon) :
- `period` : `a_venir` (défaut) · `passes` · `annules` · `tous` — mêmes définitions que le recruteur
- `status` : `planifie` · `confirme` · `empechement` · `annule`
- `opportunityId`, `recruiterId` : uuid
- `calendarIssue=true` : seulement les problèmes d'agenda, exactement les cas où l'action « Créer le lien Meet » / « Relancer l'agenda Google » est proposée (`calendarActionLabel`, `src/lib/interview.ts`) : à venir sans lien Meet (simulé ou en attente), à venir avec un échec Google, annulé dont l'événement Google n'a pas pu être supprimé
- `offset` (défaut 0), `limit` (défaut 30, 100 au plus)

**Tri** : identique au recruteur (à venir croissant, puis passés et annulés décroissant), pagination comprise pour `tous`. Index `Interview(scheduledAt)` (migration `20261014150000_interview_scheduled_at_index`).

**Response** (200) :
```json
{
  "interviews": [
    {
      "interview": { "id": "uuid", "scheduledAt": "…", "durationMinutes": 30, "status": "planifie", "provider": "google", "meetStatus": "en_attente", "meetUrl": null, "calendarError": "Délai dépassé…", "hasGoogleEvent": false, "…": "…" },
      "suggestionId": "uuid",
      "suggestionStatus": "mise_en_relation",
      "opportunity": { "id": "uuid", "title": "Développeur React", "companyName": "TechMada Solutions" },
      "recruiter": { "id": "uuid", "companyName": "TechMada Solutions" },
      "candidate": { "id": "uuid", "fullName": "…" }
    }
  ],
  "total": 9,
  "nextOffset": 30,
  "counts": { "upcoming": 6, "impediments": 2, "calendarIssues": 5 },
  "offers": [{ "id": "uuid", "title": "…", "companyName": "…", "recruiterId": "uuid" }],
  "recruiters": [{ "id": "uuid", "companyName": "…" }]
}
```

`counts` porte sur l'offre / le recruteur filtrés (sinon toute la plateforme), indépendamment de la période, du statut et du filtre agenda. `offers` et `recruiters` : valeurs possibles des filtres (au moins un entretien). `nextOffset` vaut `null` quand tout est chargé.

**Erreurs** : `400` filtre invalide · `401` · `403` autre rôle · `503` client Prisma non régénéré ou migration absente.

---

## 🔒 Security & Rate Limiting

### Authentication
- JWT Bearer token
- Token en header : `Authorization: Bearer {token}`
- Expiration : 7 jours
- Invalidation logout immédiate (journalisé)

### Rate Limiters
| Endpoint | Limite |
|----------|--------|
| `/auth/register`, `/auth/login` | 20/15 min |
| `/verification/send-code` | 5/15 min |
| `/verification/verify-code` | 30/15 min |
| `/talent-leads` | 10/15 min |
| `GET /talents-recommandes*` | 300/15 min |
| `POST /talents-recommandes/:ref/contact` | 10/15 min (+ 5 / 24 h / utilisateur en base) |
| `/ai/*` | 30/15 min |

### Roles & Permissions
- `candidate` : Accès portail + applications
- `recruiter` : Gestion offres + candidatures
- `particulier` : Accès annuaire + contributions
- `agent` : Gestion talents non-diplômés
- `talent` : Profil lecture seule
- `admin` : Accès complet + modération

---

## 📝 Response Codes

| Code | Signification |
|------|---|
| 200 | OK - Succès |
| 201 | Created - Ressource créée |
| 204 | No Content - Succès, pas de contenu |
| 400 | Bad Request - Données invalides |
| 401 | Unauthorized - Non authentifié |
| 403 | Forbidden - Authentifié, pas d'accès |
| 404 | Not Found - Ressource non trouvée |
| 409 | Conflict - Doublon/Conflit (ex: email existant) |
| 422 | Unprocessable Entity - Validation échouée |
| 429 | Too Many Requests - Rate limite dépassée |
| 500 | Internal Server Error - Erreur serveur |
| 503 | Service Unavailable - Service indisponible (ex: Resend) |

---

## 📞 Support

Pour toute question sur les APIs :
- Consultez ce document
- Vérifiez les logs du serveur
- Contactez l'équipe OffRec via `/messages/contact-offrec`

