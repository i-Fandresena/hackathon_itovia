# OFFREC — REFONTE COMPLÈTE, MVP PRODUCTION-READY ET MOBILE-FIRST

Tu travailles sur **OffRec**, une plateforme web existante accessible actuellement à :

https://off-rec-vert.vercel.app/

Ta mission est de transformer cette plateforme existante en un **produit réellement fonctionnel, mobile-first, sécurisé, intuitif et prêt à être déployé sur un VPS avec un nom de domaine**, tout en conservant et en améliorant fortement l'identité visuelle actuelle.

Le résultat attendu n'est PAS une simple maquette.

Je veux une **application fonctionnelle de bout en bout**, avec frontend, backend, base de données, authentification, gestion des rôles, matching intelligent, IA, règles métier, sécurité, données de démonstration et architecture prête pour la production.

---

# 1. AVANT DE CODER : AUDIT COMPLET

Commence par analyser l'intégralité du projet existant.

Inspecte :

* structure du projet ;
* frontend ;
* backend existant ;
* routes ;
* composants ;
* modèles ;
* base de données ;
* authentification ;
* dépendances ;
* variables d'environnement ;
* API existantes ;
* logique métier ;
* responsive actuel ;
* identité visuelle ;
* fonctionnalités déjà implémentées.

Ne supprime rien d'utile sans raison.

Identifie clairement :

1. ce qui fonctionne ;
2. ce qui est incomplet ;
3. ce qui est simulé ;
4. ce qui doit être refactorisé ;
5. ce qui doit être remplacé ;
6. ce qui manque pour avoir un vrai MVP.

Avant toute modification majeure, comprends l'architecture actuelle et réutilise au maximum les éléments pertinents.

---

# 2. OBJECTIF PRODUIT

OffRec est une plateforme de mise en relation entre :

* talents ;
* demandeurs d'emploi ;
* freelances ;
* indépendants ;
* travailleurs du secteur informel disposant de compétences ;
* entreprises ;
* particuliers recherchant des professionnels.

La proposition de valeur centrale :

> **OffRec connecte les compétences aux opportunités grâce à un matching intelligent et à des recommandations fondées sur des expériences réelles.**

Le cœur du produit est :

**Profil → Compétences → Besoin → Matching → Recommandation → Contact → Recrutement / Mission → Évaluation**

Ne transforme PAS OffRec en simple job board.

Le matching doit être une fonctionnalité centrale du produit.

---

# 3. MOBILE-FIRST

Refais toute l'expérience selon une approche :

**Mobile First → Tablet → Desktop**

Sur smartphone :

* bottom navigation ;
* boutons suffisamment grands ;
* navigation simple ;
* formulaires courts ;
* cartes ;
* filtres sous forme de bottom sheet ;
* recherche accessible ;
* CTA principaux facilement accessibles ;
* informations importantes visibles immédiatement.

La navigation mobile doit être différente et optimisée, pas simplement une version réduite du desktop.

### Talent

Bottom navigation :

Accueil | Opportunités | Candidatures | Messages | Profil

### Entreprise

Accueil | Offres | Talents | Messages | Profil

### Particulier

Accueil | Recherche | Demandes | Messages | Profil

### Admin

Dashboard | Utilisateurs | Modération | Revenus | Plus

Sur desktop :

sidebar professionnelle + contenu principal.

---

# 4. IDENTITÉ VISUELLE

Analyse le landing page existant avant de modifier les interfaces.

Conserve :

* palette ;
* couleurs principales ;
* typographie ;
* formes ;
* boutons ;
* arrondis ;
* style des cartes ;
* iconographie ;
* ambiance.

Mais améliore fortement la cohérence du design system.

Créer un véritable :

**OffRec Design System**

avec :

* couleurs ;
* typography ;
* spacing ;
* buttons ;
* inputs ;
* cards ;
* badges ;
* avatars ;
* modals ;
* alerts ;
* dropdowns ;
* tables ;
* charts ;
* navigation ;
* bottom navigation ;
* empty states ;
* loading states ;
* skeletons ;
* error states.

Le design doit être :

* professionnel ;
* moderne ;
* polyvalent ;
* humain ;
* crédible ;
* accessible ;
* premium sans être compliqué.

Ne pas surcharger l'interface avec des effets inutiles.

---

# 5. AUTHENTIFICATION

Implémenter une vraie authentification backend.

Fonctionnalités :

* inscription ;
* connexion ;
* déconnexion ;
* mot de passe oublié ;
* réinitialisation ;
* vérification email ;
* session sécurisée ;
* gestion des erreurs ;
* protection des routes.

Prévoir une architecture permettant ultérieurement :

* Google OAuth ;
* téléphone ;
* MFA.

---

# 6. RBAC — GESTION DES RÔLES

Implémenter un véritable système de contrôle d'accès basé sur les rôles.

Rôles minimum :

### TALENT

Peut :

* créer son profil ;
* gérer ses compétences ;
* gérer ses expériences ;
* consulter les opportunités ;
* recevoir des recommandations ;
* candidater ;
* communiquer ;
* gérer ses candidatures ;
* recevoir des recommandations ;
* évaluer une expérience.

### COMPANY

Peut :

* créer son entreprise ;
* gérer son profil ;
* créer des offres ;
* rechercher des talents ;
* recevoir des recommandations ;
* consulter les profils ;
* gérer les candidatures ;
* contacter les talents ;
* gérer ses recrutements ;
* accéder à ses statistiques ;
* gérer son abonnement ;
* consulter ses factures.

### INDIVIDUAL

Peut :

* créer un besoin ;
* rechercher un professionnel ;
* recevoir des recommandations ;
* contacter un professionnel ;
* gérer une demande ;
* évaluer une prestation.

### ADMIN

Peut :

* gérer les utilisateurs ;
* gérer les entreprises ;
* vérifier les comptes ;
* modérer ;
* gérer les catégories ;
* gérer les compétences ;
* gérer les signalements ;
* superviser le matching ;
* gérer les abonnements ;
* consulter les revenus ;
* gérer les paramètres ;
* consulter les statistiques.

IMPORTANT :

Le RBAC doit être appliqué :

1. frontend ;
2. backend ;
3. API ;
4. base de données lorsque pertinent.

Ne jamais faire confiance au rôle envoyé par le frontend.

---

# 7. COMPTES ET OFFRES ENTREPRISE

Créer plusieurs niveaux d'accès entreprise.

### FREE

* profil entreprise ;
* nombre limité d'offres ;
* réception de candidatures ;
* accès limité au matching ;
* statistiques basiques.

### STARTER

Exemple :

100 000 Ar / mois

* plus d'offres ;
* matching amélioré ;
* recherche avancée ;
* shortlist ;
* statistiques.

### PRO

Exemple :

250 000 Ar / mois

* matching avancé ;
* recommandations prioritaires ;
* recherche avancée ;
* shortlist intelligente ;
* analytics ;
* outils RH avancés.

### BUSINESS

Exemple :

500 000 Ar / mois

* volume élevé ;
* accès avancé au matching ;
* analytics avancés ;
* support prioritaire ;
* fonctionnalités RH avancées.

IMPORTANT :

Les prix doivent être centralisés dans la base de données / configuration et facilement modifiables.

Ne jamais hardcoder les prix dans les composants.

---

# 8. TALENTS : ACCESSIBILITÉ

Le talent doit pouvoir utiliser OffRec gratuitement dans son accès de base.

Cela doit inclure :

* demandeurs d'emploi ;
* diplômés ;
* freelances ;
* indépendants ;
* travailleurs informels.

Un talent ne doit pas être obligé de posséder un diplôme pour créer un profil.

Créer deux concepts distincts :

**Formation**

et

**Compétences / expérience**

Exemple :

Électricien

5 ans d'expérience

Pas de diplôme formel

→ profil parfaitement valable.

---

# 9. PROFIL TALENT

Créer un profil complet :

* photo ;
* nom ;
* titre ;
* description ;
* compétences ;
* niveau de compétence ;
* expériences ;
* formations ;
* certifications ;
* portfolio ;
* localisation ;
* disponibilité ;
* type d'emploi ;
* type de mission ;
* rémunération souhaitée ;
* langues ;
* recommandations ;
* évaluations ;
* réputation ;
* vérifications.

Ajouter un indicateur :

**Profil complété à 87 %**

Et expliquer comment augmenter le score.

---

# 10. PROFIL ENTREPRISE

Créer :

* logo ;
* nom ;
* secteur ;
* description ;
* taille ;
* localisation ;
* site ;
* contact ;
* informations légales pertinentes ;
* statut de vérification ;
* historique ;
* avis ;
* offres actives.

Afficher :

**Entreprise vérifiée ✓**

si elle satisfait les règles de vérification.

---

# 11. RÈGLES STRICTES POUR LES ENTREPRISES

Mettre en place de vraies règles métier.

Une entreprise ne doit pas pouvoir :

* publier des offres frauduleuses ;
* demander illégalement des informations personnelles ;
* publier des offres discriminatoires ;
* publier du contenu trompeur ;
* spammer les talents ;
* contourner la plateforme ;
* utiliser OffRec pour des activités interdites ;
* créer plusieurs comptes frauduleux ;
* publier des offres inexistantes.

Prévoir :

* validation ;
* modération ;
* signalement ;
* suspension ;
* blocage ;
* historique des actions administratives.

Créer un système :

**Warning → Restriction → Suspension → Bannissement**

avec journalisation.

---

# 12. CRÉATION D'OFFRE

Créer un parcours guidé.

### Étape 1

Poste

### Étape 2

Description

### Étape 3

Compétences

### Étape 4

Expérience

### Étape 5

Localisation

### Étape 6

Type de contrat

### Étape 7

Rémunération

### Étape 8

Publication

Avant publication :

**Résumé de l'offre**

* validation des règles.

---

# 13. MATCHING INTELLIGENT — CŒUR DU PRODUIT

Le matching est la fonctionnalité la plus importante d'OffRec.

Ne pas créer uniquement une recherche par mots-clés.

Construire une architecture de matching permettant de comparer :

### TALENT

* compétences ;
* niveau ;
* expérience ;
* formation ;
* certifications ;
* localisation ;
* disponibilité ;
* préférences ;
* type de contrat ;
* rémunération ;
* langue ;
* recommandations ;
* historique lorsque pertinent.

### OFFRE

* compétences requises ;
* niveau ;
* expérience ;
* localisation ;
* disponibilité ;
* type de contrat ;
* rémunération ;
* autres critères.

Retourner :

**score de compatibilité**

Exemple :

94 %

Puis fournir :

### Pourquoi ?

✓ 5 compétences correspondent

✓ expérience compatible

✓ localisation compatible

✓ disponibilité compatible

✓ rémunération compatible

---

# 14. MATCHING EXPLICABLE

Ne jamais afficher uniquement :

"94 %"

Créer une explication compréhensible.

Exemple :

**94 % compatible**

Compétences : 96 %

Expérience : 92 %

Localisation : 100 %

Disponibilité : 90 %

Préférences : 88 %

Ces pondérations doivent être configurables.

Créer un service :

matchingService

avec une abstraction permettant d'améliorer ultérieurement l'algorithme.

---

# 15. IA POUR CHAQUE RÔLE

Intégrer une couche IA avec des assistants différents.

### TALENT AI ASSISTANT

Peut aider à :

* améliorer le profil ;
* identifier les compétences ;
* améliorer une description ;
* suggérer des compétences manquantes ;
* expliquer pourquoi une offre correspond ;
* préparer une candidature ;
* préparer un entretien ;
* recommander des opportunités.

### COMPANY AI ASSISTANT

Peut :

* aider à rédiger une offre ;
* identifier les compétences nécessaires ;
* améliorer les critères ;
* expliquer les profils recommandés ;
* créer une shortlist ;
* aider à préparer un entretien ;
* analyser les résultats du recrutement.

### INDIVIDUAL AI ASSISTANT

Peut :

* reformuler un besoin ;
* identifier le type de professionnel recherché ;
* suggérer des critères ;
* expliquer les profils proposés.

### ADMIN AI ASSISTANT

Peut :

* résumer les statistiques ;
* détecter des anomalies ;
* aider à analyser les signalements ;
* synthétiser les activités ;
* assister la modération.

IMPORTANT :

L'IA est un assistant.

Elle ne doit pas prendre seule les décisions critiques de :

* bannissement ;
* recrutement ;
* paiement ;
* validation légale ;
* discrimination ;
* suspension définitive.

L'humain conserve le contrôle.

---

# 16. GARDE-FOU CONTEXTUEL CONTRE LE PROMPT INJECTION

Créer une architecture de sécurité spécifique pour l'IA.

Ne jamais envoyer directement toutes les données utilisateur au modèle sans filtrage.

Séparer :

### SYSTEM CONTEXT

Instructions internes OffRec.

### USER INPUT

Texte fourni par l'utilisateur.

### RETRIEVED DATA

Données récupérées de la base.

Les contenus récupérés doivent être considérés comme **non fiables**.

L'utilisateur ne doit jamais pouvoir modifier :

* les instructions système ;
* les règles de sécurité ;
* les permissions ;
* les règles métier ;
* les politiques internes.

Détecter les tentatives telles que :

* "ignore previous instructions" ;
* "ignore les règles" ;
* demande d'accès aux system prompts ;
* extraction de secrets ;
* manipulation des permissions ;
* injection via description d'offre ;
* injection via profil ;
* injection via avis ;
* injection via documents.

Créer un pipeline :

INPUT
↓
Validation
↓
Sanitization
↓
Prompt Injection Detection
↓
Context Filtering
↓
LLM
↓
Output Validation
↓
Response

Ne jamais mettre de secrets API dans le frontend.

Ajouter :

* rate limiting ;
* logs ;
* limites de tokens ;
* validation des sorties ;
* timeout ;
* fallback ;
* protection contre abus.

---

# 17. DONNÉES PERSONNELLES / DATA PROTECTION

Créer une vraie politique de protection des données.

Prévoir :

* consentement ;
* minimisation des données ;
* finalité ;
* contrôle utilisateur ;
* suppression du compte ;
* export des données ;
* modification ;
* politique de conservation ;
* journalisation des accès sensibles.

Les données personnelles ne doivent pas être exposées publiquement par défaut.

Créer des niveaux de visibilité :

PUBLIC
PRIVATE
EMPLOYER_ONLY
VERIFIED_ONLY

Un talent contrôle les informations qu'une entreprise peut voir.

---

# 18. PROPRIÉTÉ INTELLECTUELLE

Créer une section claire dans les règles OffRec.

Prévoir notamment :

* propriété du contenu utilisateur ;
* licence nécessaire à OffRec pour afficher / traiter le contenu ;
* propriété du code OffRec ;
* propriété de la marque ;
* droits sur les logos ;
* portfolio ;
* documents ;
* contenus générés par IA ;
* interdiction de copier ou exploiter les données de la plateforme sans autorisation.

Ne pas rédiger de fausses garanties juridiques.

Prévoir des textes clairement identifiés comme :

**Conditions d'utilisation**

**Politique de confidentialité**

**Politique de propriété intellectuelle**

**Politique de contenu**

Ces textes doivent être facilement modifiables par l'administrateur.

---

# 19. RECOMMANDATION COMMUNAUTAIRE

Créer :

**Recommander ce talent**

Une recommandation doit contenir :

* relation avec le talent ;
* contexte ;
* expérience ;
* compétences observées ;
* commentaire ;
* date.

Exemple :

"J'ai travaillé avec Sarah pendant 8 mois sur un projet web."

"Compétence observée : React"

"Respect des délais : excellent"

Créer un mécanisme de confiance.

Éviter les faux avis anonymes.

Prévoir :

* signalement ;
* modération ;
* vérification ;
* historique.

---

# 20. PARTICULIER

Créer un parcours simple.

Exemple :

"De quoi avez-vous besoin ?"

→ Électricien

→ Plombier

→ Développeur

→ Designer

→ Réparateur

→ Consultant

etc.

Le particulier décrit son besoin.

OffRec recommande des profils.

Afficher :

* compétences ;
* expérience ;
* localisation ;
* recommandations ;
* évaluations ;
* disponibilité.

---

# 21. SYSTÈME DE MESSAGERIE

Créer une messagerie interne.

Fonctionnalités :

* conversation ;
* notifications ;
* statut lu/non lu ;
* blocage ;
* signalement ;
* pièces jointes si pertinent.

Ne pas exposer les coordonnées personnelles inutilement.

---

# 22. NOTIFICATIONS

Créer un vrai système de notifications.

Types :

* nouvelle recommandation ;
* nouvelle candidature ;
* candidature vue ;
* nouveau message ;
* entretien ;
* recrutement ;
* nouvelle recommandation communautaire ;
* paiement ;
* abonnement ;
* modération.

Prévoir email + notifications in-app dans l'architecture.

---

# 23. MONÉTISATION

Implémenter la logique économique OffRec.

Sources potentielles :

### 1. Abonnements entreprises

FREE
STARTER
PRO
BUSINESS

### 2. Mise en avant des offres

### 3. Services RH premium

### 4. Commission

Hypothèse de démonstration :

**10 %**

Exemple :

Mission / prestation :

1 000 000 Ar

Commission OffRec :

100 000 Ar

Net :

900 000 Ar

IMPORTANT :

Les 10 % doivent être considérés comme une **hypothèse configurable**, pas comme une règle juridique définitive.

---

# 24. DASHBOARD FINANCIER ADMIN

Créer :

* revenus mensuels ;
* revenus annuels ;
* abonnements ;
* commissions ;
* offres premium ;
* entreprises payantes ;
* ARPU ;
* transactions ;
* croissance.

Exemple mock :

Entreprises payantes : 42

Abonnement moyen : 150 000 Ar

Recrutements : 18

Commission moyenne : 300 000 Ar

Calculer automatiquement les revenus.

Ne pas afficher de chiffres statiques dans les graphiques.

---

# 25. PAIEMENT

Préparer une architecture de paiement.

Créer :

paymentService

Aujourd'hui :

MockPaymentProvider

Architecture permettant demain :

Stripe
ou
solution de paiement locale.

Ne jamais mettre les informations sensibles directement dans le frontend.

---

# 26. DONNÉES RÉALISTES DE DÉMONSTRATION

Le produit doit être immédiatement démontrable en local.

Créer des données seed :

### Talents

minimum 15 profils réalistes.

Profils variés :

* développeur ;
* designer ;
* commercial ;
* comptable ;
* artisan ;
* électricien ;
* graphiste ;
* community manager ;
* technicien ;
* freelance ;
* etc.

### Entreprises

minimum 8.

### Offres

minimum 15.

### Candidatures

minimum 20.

### Recommandations

minimum 15.

### Avis

minimum 20.

### Transactions

minimum 20.

### Abonnements

plusieurs plans.

Les données doivent être fictives.

---

# 27. SCÉNARIOS DE DÉMONSTRATION

Créer des comptes de démonstration facilement accessibles en environnement local.

### DEMO TALENT

email :

[talent.demo@offrec.local](mailto:talent.demo@offrec.local)

mot de passe :

Demo123!

### DEMO ENTREPRISE

email :

[company.demo@offrec.local](mailto:company.demo@offrec.local)

mot de passe :

Demo123!

### DEMO PARTICULIER

email :

[individual.demo@offrec.local](mailto:individual.demo@offrec.local)

mot de passe :

Demo123!

### DEMO ADMIN

email :

[admin.demo@offrec.local](mailto:admin.demo@offrec.local)

mot de passe :

Demo123!

IMPORTANT :

Ces comptes sont uniquement destinés au développement/démonstration locale et doivent être clairement désactivables en production.

---

# 28. ENVIRONNEMENT LOCAL

Le projet doit fonctionner avec :

npm install
npm run dev

ou la commande adaptée au stack existant.

Créer un fichier :

.env.example

Documenter toutes les variables :

DATABASE_URL
JWT_SECRET
AI_API_KEY
PAYMENT_SECRET
etc.

Ne jamais committer de secrets.

---

# 29. BASE DE DONNÉES

Créer une structure propre pour au minimum :

User
Role
TalentProfile
Company
IndividualProfile
Skill
Experience
Education
Certification
Portfolio
Job
Application
Match
Recommendation
Review
Conversation
Message
Notification
Subscription
Payment
Transaction
Report
ModerationAction
AIInteraction
AuditLog

Utiliser les relations correctement.

Créer migrations + seed.

---

# 30. AUDIT LOG

Créer une journalisation des actions sensibles :

* login ;
* changement de rôle ;
* changement de permissions ;
* publication ;
* modification ;
* suppression ;
* suspension ;
* paiement ;
* abonnement ;
* modération ;
* accès aux données sensibles.

L'admin doit pouvoir consulter les événements importants.

---

# 31. ADMINISTRATION ET MODÉRATION

Créer un dashboard Admin professionnel.

KPIs :

Utilisateurs
Entreprises
Talents
Offres
Candidatures
Matchs
Recrutements
Revenus
Signalements

Créer une file :

**À vérifier**

**À modérer**

**Signalements**

**Entreprises suspendues**

---

# 32. UX — UTILISATEURS DE TOUS NIVEAUX

L'interface doit être utilisable par quelqu'un qui n'est pas technophile.

Utiliser des formulations simples :

❌ "Configurer les paramètres de matching"

✓ "Dites-nous ce que vous recherchez"

❌ "Créer une entité"

✓ "Créer votre profil"

Ajouter :

* onboarding ;
* tooltips ;
* explications ;
* exemples ;
* états vides ;
* confirmation avant actions critiques ;
* messages d'erreur humains.

---

# 33. ACCESSIBILITÉ

Respecter autant que possible WCAG.

Prévoir :

* contraste ;
* taille de texte ;
* focus visible ;
* labels ;
* navigation clavier ;
* aria ;
* boutons accessibles ;
* messages d'erreur explicites.

---

# 34. PERFORMANCE

Optimiser :

* lazy loading ;
* images ;
* requêtes ;
* pagination ;
* cache ;
* bundle ;
* API.

Éviter les appels inutiles.

---

# 35. SEO ET DÉPLOIEMENT

Préparer l'application pour :

**offrec.[domaine]**

ou domaine principal.

Prévoir :

* variables d'environnement ;
* configuration production ;
* HTTPS ;
* reverse proxy ;
* CORS ;
* cookies sécurisés ;
* headers de sécurité ;
* logs ;
* backup database ;
* health check ;
* Docker si adapté au projet.

Le résultat doit pouvoir être déployé sur un VPS Linux.

Créer si pertinent :

Dockerfile
docker-compose.yml
Nginx configuration
README deployment

---

# 36. TESTS

Ne considère pas une fonctionnalité comme terminée simplement parce que l'interface existe.

Tester réellement :

* inscription ;
* connexion ;
* rôles ;
* permissions ;
* création profil ;
* création offre ;
* matching ;
* candidature ;
* messagerie ;
* recommandations ;
* paiement simulé ;
* abonnement ;
* modération ;
* suppression compte.

Créer des tests unitaires / intégration sur les parties critiques.

---

# 37. RÈGLE DE DÉVELOPPEMENT

Chaque fonctionnalité doit être :

**UI + logique + backend + base de données + validation + gestion d'erreur**

Une fonctionnalité ne doit pas être simplement :

"bouton → console.log"

ou

"bouton → données statiques"

Si une fonctionnalité n'est pas encore connectée au backend, crée une abstraction propre et indique clairement son état.

---

# 38. NE PAS SUR-ENGINEER

Le produit doit rester un MVP.

Priorité :

### P0

Authentification
RBAC
Profils
Entreprises
Offres
Matching
Recommandations
Candidatures
Messagerie
Admin
Abonnements
Paiement simulé
Sécurité

### P1

IA assistants
Évaluations avancées
Analytics
Vérification avancée

### P2

Fonctionnalités avancées futures.

---

# 39. CRITÈRE DE RÉUSSITE

À la fin, je dois pouvoir lancer OffRec localement et faire une démonstration complète :

### SCÉNARIO

Je me connecte en tant que Talent.

Je complète mon profil.

OffRec me recommande des opportunités.

Je consulte une offre.

Je vois :

**94 % compatible**

Je comprends pourquoi.

Je postule.

---

Je me connecte ensuite en tant qu'Entreprise.

Je crée :

"Développeur Full Stack"

OffRec analyse le besoin.

Il me recommande les meilleurs talents.

Je consulte leurs profils.

Je vois les recommandations communautaires.

Je contacte un talent.

Je passe à l'étape recrutement.

Je souscris à un plan.

Le paiement simulé apparaît dans les revenus.

---

Je me connecte en Admin.

Je vois :

* l'entreprise ;
* le talent ;
* l'offre ;
* le matching ;
* la candidature ;
* la transaction ;
* les revenus ;
* les logs.

Je peux modérer.

---

# 40. IMPORTANT — QUALITÉ DU PRODUIT

Ne cherche pas uniquement à "faire beaucoup de pages".

Je préfère :

**20 fonctionnalités réellement fonctionnelles**

à :

**100 fonctionnalités visuellement présentes mais fictives.**

Chaque écran doit avoir un objectif.

Chaque bouton principal doit fonctionner.

Chaque formulaire doit être validé.

Chaque donnée importante doit provenir du backend.

Chaque rôle doit avoir une expérience cohérente.

---

# 41. LIVRABLE FINAL

À la fin du développement, fournir :

1. application fonctionnelle localement ;
2. frontend mobile-first ;
3. backend fonctionnel ;
4. base de données ;
5. migrations ;
6. seed de démonstration ;
7. authentification ;
8. RBAC ;
9. matching ;
10. recommandations ;
11. IA ;
12. protection prompt injection ;
13. modération ;
14. règles d'utilisation ;
15. protection des données ;
16. propriété intellectuelle ;
17. système de paiement simulé ;
18. dashboard revenus ;
19. comptes de démonstration ;
20. .env.example ;
21. README ;
22. documentation du déploiement VPS ;
23. tests des fonctionnalités critiques.

---

# 42. ORDRE D'EXÉCUTION

Travaille dans cet ordre :

### PHASE 1

Audit du projet existant.

### PHASE 2

Architecture cible + base de données.

### PHASE 3

Design system + refonte mobile-first.

### PHASE 4

Authentification + RBAC.

### PHASE 5

Profils Talent / Entreprise / Particulier.

### PHASE 6

Offres + candidatures.

### PHASE 7

Matching intelligent.

### PHASE 8

Recommandations communautaires.

### PHASE 9

Messagerie + notifications.

### PHASE 10

IA + garde-fous.

### PHASE 11

Abonnements + paiement simulé.

### PHASE 12

Admin + modération + analytics.

### PHASE 13

Protection des données + règles d'utilisation + propriété intellectuelle.

### PHASE 14

Seed + scénarios de démonstration.

### PHASE 15

Tests + sécurité + performance.

### PHASE 16

Préparation VPS + documentation deployment.

Après chaque phase, vérifie que le projet fonctionne avant de passer à la suivante.

---

# RÈGLE FINALE

**Ne réécris pas aveuglément OffRec.**

Commence par comprendre l'existant.

Conserve ce qui est bon.

Améliore ce qui est faible.

Remplace ce qui est nécessaire.

Le résultat final doit être reconnaissable comme **OffRec**, mais donner l'impression d'un produit professionnel prêt à être présenté à :

* investisseurs ;
* entreprises ;
* utilisateurs ;
* partenaires RH ;
* AFD ;
* EDBM ;
* bailleurs ;
* concours entrepreneuriaux.

Le produit doit être **simple pour l'utilisateur, puissant en arrière-plan et strict sur la sécurité, les données et les règles métier.**

Commence maintenant par l'audit complet du projet et présente-moi d'abord les constats techniques, l'architecture actuelle, les fonctionnalités existantes et le plan de migration avant d'entreprendre les modifications majeures.
