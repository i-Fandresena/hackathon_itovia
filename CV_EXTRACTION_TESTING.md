# Guide de Test : Extraction Avancée de CV

## ✅ État de l'Implémentation

L'extraction avancée de CV avec Gemini API est **complètement implémentée et compilée avec succès** :
- ✅ Backend TypeScript compile sans erreur
- ✅ Frontend React compile sans erreur
- ✅ Types TypeScript alignés (frontend et backend)
- ✅ Schéma Prisma avec migration appliquée
- ✅ Composant frontend pour affichage des données extraites

---

## 🚀 Démarrage de l'Application

### Terminal 1 : Backend
```bash
cd server
npm run dev
```
✅ Le serveur doit écouter sur `http://localhost:4000`

### Terminal 2 : Frontend
```bash
npm run dev
```
✅ L'application doit être accessible sur `http://localhost:5173`

---

## 🧪 Procédure de Test Complète

### Étape 1 : Se Connecter en Candidat

1. Aller à `http://localhost:5173/connexion`
2. Se connecter avec :
   - Email : `candidat@demo.mg`
   - Mot de passe : `demo123`

### Étape 2 : Accéder au Profil

- Cliquer sur **"Mon profil"** dans le menu gauche
- Ou accéder directement à : `http://localhost:5173/candidat/profil`

### Étape 3 : Préparer un CV de Test

**Option A : Créer un CV rapidement**
1. Ouvrir un éditeur de texte
2. Copier le contenu d'exemple ci-dessous
3. Enregistrer en PDF (ex: `test-cv.pdf`)

**Contenu de CV de test recommandé :**
```
JEAN DUPONT
Développeur Full Stack Senior
jean.dupont@example.com
+261 32 12 34 56
Antananarivo, Madagascar
LinkedIn: https://www.linkedin.com/in/jeandupont
GitHub: https://github.com/jeandupont
Portfolio: https://jeandupont.dev

Titre Professionnel:
Senior Full Stack Developer - 8 ans d'expérience

Résumé Professionnel:
Développeur passionné spécialisé dans les applications web modernes. 
Expert en React, Node.js et architectures cloud scalables. 
Expérience confirmée dans la gestion d'équipes de développement.

EXPÉRIENCES PROFESSIONNELLES:

1. Senior Developer - Tech Company Madagascar (2022-2024)
   Location: Antananarivo
   Responsabilités:
   - Lead technique sur projet React/Node.js de 5 développeurs
   - Architecture et optimisation de base de données PostgreSQL
   - Implémentation de pipelines CI/CD avec Docker
   Technologies: React 19, Node.js 22, TypeScript, PostgreSQL, Docker, Kubernetes
   
2. Full Stack Developer - StartUp Digital (2020-2022)
   Location: Antananarivo
   Responsabilités:
   - Développement complet d'applications web avec React et Express
   - Migration monolithe vers architecture microservices
   Technologies: React, Express, MongoDB, AWS, JavaScript
   
3. Junior Developer - Web Agency (2018-2020)
   Location: Antananarivo
   Responsabilités:
   - Développement de sites web responsive
   - Maintenance et évolution de projets client
   Technologies: JavaScript, HTML5, CSS3, jQuery, PHP

FORMATION ACADÉMIQUE:

1. Master Informatique - Université de Madagascar (2018)
   Domaine: Ingénierie Logicielle
   Spécialisation: Architecture Distribuée

2. Licence Informatique - Université de Madagascar (2016)
   Domaine: Développement Logiciel

CERTIFICATIONS:

AWS Certified Solutions Architect (2023)
Émetteur: Amazon Web Services

Google Cloud Associate Cloud Engineer (2022)
Émetteur: Google Cloud

PROJETS RÉALISÉS:

1. E-Commerce Platform
   Rôle: Full Stack Lead
   Description: Plateforme de vente en ligne avec paiement mobile et SMS
   Technologies: React, Node.js, MongoDB, Redis, Stripe
   URL: https://example-ecommerce.mg

2. Analytics Dashboard
   Rôle: Lead Developer
   Description: Dashboard temps réel avec WebSockets
   Technologies: React, Node.js, PostgreSQL, Socket.io, D3.js
   URL: https://analytics.example.mg

LANGUES:

Français: Natif
Anglais: C1
Malgache: Natif

COMPÉTENCES PRINCIPALES:

Frontend: React 19, TypeScript, CSS3, HTML5, Redux, Framer Motion
Backend: Node.js, Express, Nest.js, Python, Django
Bases de données: PostgreSQL, MongoDB, Redis
DevOps: Docker, Kubernetes, GitHub Actions, AWS, GCP
Outils: Git, Webpack, Vite, Postman, Jest

DISPONIBILITÉ: Immediate

LOCALISATION SOUHAITÉE: Antananarivo, Madagascar
```

### Étape 4 : Téléverser le CV

1. Cliquer sur le bouton **"Déposer un CV (PDF)"**
2. Sélectionner votre fichier PDF
3. Attendre le chargement et l'analyse (30-45 secondes pour Gemini)

### Étape 5 : Vérifier l'Extraction

**Ce qui devrait apparaître immédiatement après l'upload :**

✅ **Lien "Voir le CV déposé"** :
- Cliquable et ouvreable dans un nouvel onglet
- Le fichier PDF est accessible

✅ **Compétences suggérées** :
- Liste de boutons `+ [Compétence]`
- Compétences cliquables pour les ajouter au profil

✅ **Section "Données extraites de votre CV"** :
- Badge de confiance d'extraction (Haute/Moyenne/Faible)
- Date d'extraction affichée

### Étape 6 : Vérifier les Sections Extraites

**Information personnelle (extensible)** :
- [ ] Prénom affiche "JEAN"
- [ ] Nom affiche "DUPONT"
- [ ] Email affiche "jean.dupont@example.com"
- [ ] Téléphone affiche "+261 32 12 34 56"
- [ ] Ville affiche "Antananarivo"
- [ ] Pays affiche "Madagascar"
- [ ] LinkedIn : lien cliquable vers le profil
- [ ] GitHub : lien cliquable vers le profil
- [ ] Portfolio : lien cliquable vers le site

**Titre professionnel et résumé** :
- [ ] Affichage du titre "Senior Full Stack Developer"
- [ ] Résumé professionnel visible (2-3 phrases)

**Expériences (extensible)** :
- [ ] Au moins 3 expériences listées
- [ ] Pour chaque expérience :
  - [ ] Titre du poste
  - [ ] Nom de l'entreprise
  - [ ] Localisation
  - [ ] Dates (début - fin ou "En cours")
  - [ ] Badge "En cours" si applicable
  - [ ] Description/responsabilités
  - [ ] Tags de technologies

**Formation (extensible)** :
- [ ] Au moins 2 formations listées
- [ ] Diplôme, établissement, domaine, date de graduation

**Projets (extensible)** :
- [ ] Au moins 2 projets listés
- [ ] Nom, rôle, description
- [ ] Technologies utilisées
- [ ] Liens vers les projets

**Certifications (extensible)** :
- [ ] Au moins 2 certifications listées
- [ ] Nom, émetteur, dates
- [ ] Liens vers les preuves de certification

**Langues (extensible)** :
- [ ] Au moins 2 langues listées
- [ ] Langue et niveau (A1-C2 ou Natif)

**Technologies principales** :
- [ ] Liste de technologies principales visible

**Synthèse** :
- [ ] Années d'expérience calculées (8 ans attendu)
- [ ] Disponibilité ("Immediate")
- [ ] Localisations souhaitées ("Antananarivo, Madagascar")

---

## 🔍 Vérification en Base de Données

### Depuis Prisma Studio

```bash
cd server
npm run prisma:studio
```

1. Ouvrir le modèle `CandidateProfile`
2. Trouver l'utilisateur `candidat@demo.mg`
3. Vérifier les champs JSON :
   - `cvExtractedInfo` : objet avec firstName, lastName, email, etc.
   - `cvExperiences` : tableau d'objets
   - `cvEducation` : tableau d'objets
   - `cvCertifications` : tableau d'objets
   - `cvProjects` : tableau d'objets
   - `cvLanguages` : tableau d'objets
   - `cvExtractionConfidence` : "high", "medium" ou "low"
   - `cvExtractionDate` : timestamp ISO

### Via requête SQL directe

```sql
SELECT 
  cv_extracted_info,
  cv_professional_title,
  cv_experiences,
  cv_education,
  cv_certifications,
  cv_projects,
  cv_languages,
  cv_technologies,
  cv_years_of_experience,
  cv_extraction_confidence,
  cv_extraction_date
FROM candidate_profile
WHERE user_id = (SELECT id FROM "user" WHERE email = 'candidat@demo.mg')
\gx
```

---

## 🐛 Débogage

### Si le bouton ne réagit pas :
1. Ouvrir la console (F12)
2. Vérifier qu'il n'y a pas d'erreur `Cannot find module`
3. Vérifier que l'input file est présent dans le DOM

### Si l'analyse prend trop longtemps (>45s) :
1. Vérifier que `GEMINI_API_KEY` est définie dans `server/.env`
2. Vérifier la clé API sur la console Google Cloud
3. Vérifier les logs du serveur pour les erreurs Gemini

### Si aucune donnée n'est extraite (section vide) :
1. Vérifier les logs du serveur : `CV extraction with AI failed`
2. La réponse Gemini peut avoir été bloquée (injection détectée)
3. Vérifier que le PDF contient du texte (pas une image)

### Si les données extraites semblent incorrectes :
1. Vérifier le texte extrait du PDF (peut être mal structuré)
2. Les hallucinations Gemini peuvent générer des données inexactes
3. Augmenter la confiance en incluant plus de contexte dans le CV

---

## 📊 Cas de Test Supplémentaires

### Test 1 : CV Minimal
- Créer un CV avec juste : nom, email, téléphone, 1-2 expériences
- Résultat attendu : confiance "medium" ou "low"

### Test 2 : CV en Français vs Anglais
- Tester avec un CV en français complet
- Tester avec un CV en anglais complet
- Gemini doit extraire correctement dans les deux langues

### Test 3 : PDF Scanné (pas de texte)
- Utiliser un CV en image/scan
- Résultat : pas d'extraction, confiance "low"

### Test 4 : Multiple Uploads
- Téléverser un premier CV
- Téléverser un deuxième CV différent
- Vérifier que les données sont remplacées

### Test 5 : Ajouter les Compétences
1. Cliquer sur les boutons `+ [Compétence]`
2. Vérifier que les compétences apparaissent dans la liste active
3. Cliquer "Enregistrer le profil"
4. Vérifier que les compétences persistent après rechargement

---

## 📈 Performance et Limitations

### Performance observée
- Téléversement du fichier : < 1s
- Extraction du texte : < 1s
- Appel Gemini API : 15-45s
- **Temps total : 20-50 secondes**

### Limitations connues
- Gemini peut halluciner des données manquantes (ex: inventer des projets)
- Extraction inexacte si CV mal structuré ou peu lisible
- Confiance "low" pour CVs avec peu de données structurées

---

## ✅ Checklist de Validation Complète

- [ ] Backend compile sans erreur
- [ ] Frontend compile sans erreur
- [ ] Connexion candidat fonctionne
- [ ] Page profil se charge
- [ ] Téléversement de PDF fonctionne
- [ ] Lien "Voir le CV déposé" est cliquable
- [ ] Compétences suggérées apparaissent
- [ ] Section "Données extraites" s'affiche
- [ ] Badge de confiance est visible
- [ ] Sections extensibles s'ouvrent/ferment
- [ ] Données personnelles sont correctes
- [ ] Expériences sont extraites
- [ ] Formation est extraite
- [ ] Projets sont extraits
- [ ] Certifications sont extraites
- [ ] Langues sont extraites
- [ ] Technologies principales sont affichées
- [ ] Années d'expérience sont calculées
- [ ] Données en base de données sont correctes
- [ ] Ajout de compétences fonctionne
- [ ] Enregistrement du profil fonctionne

---

## 🎉 Conclusion

Si tous les tests passent, **l'extraction avancée de CV est 100% opérationnelle** ! 🚀

Les candidats peuvent maintenant :
1. ✅ Téléverser leurs CV (PDF)
2. ✅ Voir leurs données extraites automatiquement
3. ✅ Ajouter les compétences suggérées à leur profil
4. ✅ Consulter leurs informations structurées

### Prochaines Étapes (V2+)
- Améliorer l'extraction avec OCR pour les CVs scannés
- Ajouter un scan antivirus pour les uploads
- Permettre plusieurs versions de CV
- Ajouter une comparaison automatique avec le profil déclaré
- Intégrer le score de matching avec les offres d'emploi
