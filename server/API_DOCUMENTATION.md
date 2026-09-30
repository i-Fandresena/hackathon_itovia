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
10. [Agent](#agent)
11. [Talent Account](#talent-account)
12. [Match Suggestions](#match-suggestions)
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

**Body** :
```
cv: [binary PDF file]
```

**Description** : 
- Télécharge un CV et extrait les compétences suggérées par mots-clés
- Retourne les compétences détectées (non appliquées automatiquement)
- Support format : PDF uniquement

**Response** (200) :
```json
{
  "cvUrl": "/uploads/cv/uuid.pdf",
  "suggestedSkills": ["JavaScript", "React", "Node.js", "Git"]
}
```

**Erreurs** :
- `400` : Fichier requis
- `422` : Format invalide (non-PDF)

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

**Erreurs** :
- `400` : Données invalides
- `401` : Non authentifié
- `403` : Rôle invalide

---

### 5. Update Opportunity (Modifier une offre)

**Endpoint** : `PUT /opportunities/{id}`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `recruiter`

**Body** : Mêmes champs que la création (partiels acceptés)

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

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `recruiter` (propriétaire de l'offre)

**Description** : 
- Liste les candidats diplômés + talents non-diplômés proposés
- Classés par score de compatibilité

**Response** (200) :
```json
{
  "shortlist": [
    {
      "candidateId": "uuid",
      "fullName": "Jean Dupont",
      "score": 92,
      "reasons": ["Compétences React", "Disponibilité immédiate"],
      "type": "candidate|talent"
    }
  ],
  "total": 8
}
```

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

Base path: `/notifications`

### 1. Get My Notifications (Mes notifications)

**Endpoint** : `GET /notifications/mine`

**Headers** :
```
Authorization: Bearer {token}
```

**Query Parameters** :
```
?page=1&limit=20
?unreadOnly=true
```

**Response** (200) :
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "new_opportunity|application_status|message|match_suggestion",
      "title": "Nouvelle offre correspondant à votre profil",
      "message": "Développeur React - Tech Solutions Madagascar",
      "link": "/offres/uuid",
      "read": false,
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 5,
  "unreadCount": 3
}
```

---

### 2. Mark Notification as Read (Marquer comme lu)

**Endpoint** : `POST /notifications/{id}/read`

**Headers** :
```
Authorization: Bearer {token}
```

**Response** (200) :
```json
{
  "notification": {
    "id": "uuid",
    "read": true,
    "readAt": "2026-09-30T11:00:00Z"
  }
}
```

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

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `admin`

**Response** (200) :
```json
{
  "stats": {
    "users": {
      "total": 245,
      "candidates": 180,
      "recruiters": 45,
      "agents": 15,
      "particuliers": 5
    },
    "opportunities": {
      "total": 89,
      "published": 76,
      "closed": 13
    },
    "placements": {
      "total": 34,
      "revenue": 12500000,
      "successFeeCollected": 2500000
    },
    "kpi": {
      "femaleRate": 0.62,
      "placementRate": 0.38,
      "avgTimeToHire": 18
    }
  }
}
```

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

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `agent`

**Response** (200) :
```json
{
  "talents": [
    {
      "id": "uuid",
      "fullName": "Vololona Randria",
      "trade": "Couturière",
      "sector": "textile_artisanat",
      "status": "verifie|recommande|place",
      "skills": ["Couture", "Broderie"],
      "verifications": 1,
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 8
}
```

---

### 5. Get Talent Details (Détails talent)

**Endpoint** : `GET /agent/talents/{id}`

**Headers** :
```
Authorization: Bearer {token}
```

**Response** (200) :
```json
{
  "talent": {
    "id": "uuid",
    "fullName": "Vololona Randria",
    "phone": "+261 34 40 111 22",
    "trade": "Couturière",
    "sector": "textile_artisanat",
    "status": "verifie",
    "skills": ["Couture", "Broderie", "Retouche"],
    "availability": "immediate",
    "verifications": [
      {
        "id": "uuid",
        "trade": "Couturière",
        "checklist": {"Couture": true, "Broderie": true},
        "note": "Compétences vérifiées sur le terrain",
        "verifiedAt": "2026-09-30T10:00:00Z"
      }
    ],
    "proposals": [
      {
        "opportunityId": "uuid",
        "opportunityTitle": "Graphiste freelance",
        "proposedAt": "2026-09-30T10:00:00Z"
      }
    ]
  }
}
```

---

### 6. Create Talent (Créer profil talent)

**Endpoint** : `POST /agent/talents`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** :
```json
{
  "fullName": "Vololona Randria",
  "phone": "+261 34 40 111 22",
  "province": "Antananarivo",
  "city": "Antananarivo",
  "gender": "femme",
  "trade": "Couturière",
  "sector": "textile_artisanat",
  "skills": ["Couture", "Broderie", "Retouche"],
  "availability": "immediate",
  "status": "en_attente|verifie|recommande|place",
  "fromLeadId": "uuid (optionnel)",
  "fromSourcingLeadId": "uuid (optionnel)"
}
```

**Response** (201) :
```json
{
  "talent": {
    "id": "uuid",
    "fullName": "Vololona Randria",
    "status": "en_attente",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

**Invariant** : Un profil talent n'est jamais créé sans agent responsable (§7.3.14)

---

### 7. Update Talent (Modifier talent)

**Endpoint** : `PUT /agent/talents/{id}`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body** : Mêmes champs que la création (partiels)

**Response** (200) :
```json
{
  "talent": {
    "id": "uuid",
    "fullName": "Vololona Randria",
    "skills": ["Couture", "Broderie", "Retouche", "Design"],
    "updatedAt": "2026-09-30T11:00:00Z"
  }
}
```

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

## 🎯 Match Suggestions

Base path: `/match-suggestions`

### 1. Get My Suggestions (Mes suggestions - Candidat)

**Endpoint** : `GET /match-suggestions/mine`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `candidate`

**Response** (200) :
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "opportunityId": "uuid",
      "opportunityTitle": "Développeur React",
      "companyName": "Tech Solutions Madagascar",
      "score": 87,
      "reasons": ["Compétences React", "Disponibilité immédiate"],
      "status": "proposee_candidat|interet_candidat|decline",
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 5
}
```

---

### 2. Get Received Suggestions (Suggestions reçues - Recruteur)

**Endpoint** : `GET /match-suggestions/received`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `recruiter`

**Response** (200) :
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "candidateName": "Jean Dupont",
      "opportunityId": "uuid",
      "score": 87,
      "reasons": ["Compétences React alignées"],
      "status": "proposee_recruteur|interet_recruteur",
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 3
}
```

---

### 3. Express Interest (Exprimer intérêt)

**Endpoint** : `POST /match-suggestions/{id}/interest`

**Headers** :
```
Authorization: Bearer {token}
```

**Description** : 
- Journalisé dans auditLog
- Transition de statut
- Déclenche notification

**Response** (200) :
```json
{
  "suggestion": {
    "id": "uuid",
    "status": "interet_candidat|interet_recruteur",
    "updatedAt": "2026-09-30T11:00:00Z"
  }
}
```

---

### 4. Decline Suggestion (Decliner)

**Endpoint** : `POST /match-suggestions/{id}/decline`

**Headers** :
```
Authorization: Bearer {token}
```

**Response** (200) :
```json
{
  "suggestion": {
    "id": "uuid",
    "status": "decline",
    "updatedAt": "2026-09-30T11:00:00Z"
  }
}
```

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
  "opportunityId": "uuid",
  "candidateId": "uuid (pour diplômés)",
  "talentId": "uuid (pour non-diplômés)",
  "monthlySalaryAr": 450000
}
```

**Description** : 
- Crée un placement pour un candidat diplômé ou un talent non-diplômé
- Initialise le suivi du success fee

**Response** (201) :
```json
{
  "placement": {
    "id": "uuid",
    "opportunityId": "uuid",
    "candidateId": "uuid",
    "monthlySalaryAr": 450000,
    "stage": "etape1_due",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

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
      "id": "uuid",
      "opportunityTitle": "Développeur React",
      "candidateName": "Jean Dupont",
      "monthlySalaryAr": 450000,
      "stage": "etape1_payee",
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "total": 3
}
```

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
- Suivi déclaratif du success fee
- Si appelé par admin : journalisé (auditLog)

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
  "targetType": "opportunity|provider|recommendation|user",
  "targetId": "uuid",
  "reason": "Contenu offensant"
}
```

**Description** : 
- Crée un signalement
- Admin reçoit notification

**Response** (201) :
```json
{
  "report": {
    "id": "uuid",
    "targetType": "opportunity",
    "reason": "Contenu offensant",
    "status": "open",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

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

## 📊 Admin Matching

Base path: `/admin/matching`

### 1. Get Candidate Pool (Vivier candidats)

**Endpoint** : `GET /admin/matching/opportunities/{id}/candidate-pool`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `admin`

**Query Parameters** :
```
?limit=50
```

**Description** : 
- Vivier de candidats diplômés + talents non-diplômés
- Classés par score de compatibilité

**Response** (200) :
```json
{
  "candidates": [
    {
      "id": "uuid",
      "name": "Jean Dupont",
      "score": 92,
      "type": "candidate|talent",
      "skills": ["React", "TypeScript"],
      "reasons": ["Compétences alignées"]
    }
  ],
  "total": 15
}
```

---

### 2. Get Candidate Profile (Profil candidat)

**Endpoint** : `GET /admin/matching/candidates/{id}`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `admin`

**Response** (200) :
```json
{
  "candidate": {
    "id": "uuid",
    "fullName": "Jean Dupont",
    "email": "jean@example.mg",
    "phone": "+261 32 12 345 67",
    "skills": ["React", "TypeScript", "Node.js"],
    "experienceLevel": "junior",
    "availability": "immediate",
    "applications": 5,
    "placements": 1
  }
}
```

---

### 3. Create Match Suggestion (Créer suggestion)

**Endpoint** : `POST /admin/matching/match-suggestions`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `admin`

**Body** :
```json
{
  "opportunityId": "uuid",
  "candidateId": "uuid"
}
```

**Response** (201) :
```json
{
  "suggestion": {
    "id": "uuid",
    "status": "proposee_candidat",
    "createdAt": "2026-09-30T10:00:00Z"
  }
}
```

---

### 4. Get Match Suggestions (Suggestions)

**Endpoint** : `GET /admin/matching/match-suggestions`

**Headers** :
```
Authorization: Bearer {token}
```

**Rôle requis** : `admin`

**Query Parameters** :
```
?status=proposee_candidat|interet_candidat|proposee_recruteur
```

**Response** (200) :
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "opportunityTitle": "Développeur React",
      "candidateName": "Jean Dupont",
      "score": 87,
      "status": "proposee_candidat"
    }
  ],
  "total": 45
}
```

---

### 5. Update Suggestion Status (Mettre à jour statut)

**Endpoint** : `PATCH /admin/matching/match-suggestions/{id}`

**Headers** :
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Rôle requis** : `admin`

**Body** :
```json
{
  "status": "proposee_candidat|interet_candidat|proposee_recruteur|interet_recruteur|mise_en_relation|decline"
}
```

**Response** (200) :
```json
{
  "suggestion": {
    "id": "uuid",
    "status": "interet_candidat",
    "updatedAt": "2026-09-30T11:00:00Z"
  }
}
```

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

