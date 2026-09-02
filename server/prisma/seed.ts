import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, type Sector } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_PASSWORD = 'demo123'

/** Catégorie d'offre (métiers de bureau, `src/data/constants.ts` CATEGORIES)
 *  → secteur transversal le plus proche, pour peupler le nouveau champ
 *  `Opportunity.sector` sans dupliquer la saisie du jeu de démo. */
const CATEGORY_SECTOR: Record<string, Sector> = {
  Administration: 'services_commerce',
  Marketing: 'digital',
  'IT / Digital': 'digital',
  Ventes: 'services_commerce',
  Design: 'digital',
  Logistique: 'services_commerce',
  'Community management': 'digital',
  'Saisie de données': 'digital',
  'Services freelance': 'digital',
}

/**
 * Jeu de démonstration réaliste (fictif) pour présentation : portail
 * d'opportunités + annuaire de confiance. Porté depuis les anciens seeds
 * frontend (src/data/seed.ts, src/data/seedDirectory.ts) vers de vrais
 * comptes/relations en base, avec les 4 rôles.
 */

interface CompanySeed {
  key: string
  companyName: string
  email: string
  phone: string
  province: string
  city: string
  /** Libellé métier affiché (conservé pour la couleur du jeu de démo). */
  sectorLabel: string
  sector: Sector
}

const COMPANIES: CompanySeed[] = [
  {
    key: 'techmada',
    companyName: 'TechMada Solutions',
    email: 'recruteur@demo.mg',
    phone: '+261 32 98 765 43',
    province: 'Antananarivo',
    city: 'Antananarivo',
    sectorLabel: 'IT / Digital',
    sector: 'digital',
  },
  {
    key: 'port-toamasina',
    companyName: 'Port Logistique Toamasina',
    email: 'contact@port-toamasina.mg',
    phone: '+261 33 11 222 33',
    province: 'Toamasina',
    city: 'Toamasina',
    sectorLabel: 'Logistique / Portuaire',
    sector: 'services_commerce',
  },
  {
    key: 'agence-fianar',
    companyName: 'Agence Créative Fianar',
    email: 'contact@agence-fianar.mg',
    phone: '+261 34 22 333 44',
    province: 'Fianarantsoa',
    city: 'Fianarantsoa',
    sectorLabel: 'Design / Communication',
    sector: 'digital',
  },
  {
    key: 'mahajanga-commerce',
    companyName: 'Mahajanga Commerce Plus',
    email: 'contact@mahajanga-commerce.mg',
    phone: '+261 32 33 444 55',
    province: 'Mahajanga',
    city: 'Mahajanga',
    sectorLabel: 'Commerce / Distribution',
    sector: 'services_commerce',
  },
  {
    key: 'ong-education-sud',
    companyName: 'ONG Éducation Sud',
    email: 'contact@education-sud.org',
    phone: '+261 33 44 555 66',
    province: 'Toliara',
    city: 'Toliara',
    sectorLabel: 'Éducation / ONG',
    sector: 'autre',
  },
  {
    key: 'dataentry-mg',
    companyName: 'DataEntry MG',
    email: 'contact@dataentry.mg',
    phone: '+261 34 55 666 77',
    province: 'Antananarivo',
    city: 'Remote',
    sectorLabel: 'Services administratifs',
    sector: 'services_commerce',
  },
  {
    key: 'tourisme-nord',
    companyName: 'Tourisme Nord Madagascar',
    email: 'contact@tourisme-nord.mg',
    phone: '+261 32 66 777 88',
    province: 'Antsiranana',
    city: 'Antsiranana',
    sectorLabel: 'Tourisme',
    sector: 'services_commerce',
  },
  {
    key: 'livraison-tana',
    companyName: 'Startup Livraison Tana',
    email: 'contact@livraison-tana.mg',
    phone: '+261 33 77 888 99',
    province: 'Antananarivo',
    city: 'Antananarivo',
    sectorLabel: 'Logistique / Livraison',
    sector: 'services_commerce',
  },
  {
    key: 'freelance-hub',
    companyName: 'Freelance Hub Mada',
    email: 'contact@freelance-hub.mg',
    phone: '+261 34 88 999 00',
    province: 'Toamasina',
    city: 'Remote',
    sectorLabel: 'Plateforme freelance',
    sector: 'digital',
  },
  {
    key: 'assoc-jeunes-fianar',
    companyName: 'Association Jeunes Fianar',
    email: 'contact@jeunes-fianar.org',
    phone: '+261 32 99 000 11',
    province: 'Fianarantsoa',
    city: 'Fianarantsoa',
    sectorLabel: 'Associatif / Jeunesse',
    sector: 'autre',
  },
]

const OPPORTUNITIES = [
  {
    key: 'opp-1',
    companyKey: 'techmada',
    title: 'Assistant·e marketing digital',
    category: 'Marketing',
    description:
      'Rejoignez une équipe agile à Antananarivo. Vous participerez à la création de contenus, à la gestion des réseaux sociaux et au suivi des campagnes locales. Idéal pour un·e jeune diplômé·e motivé·e.',
    province: 'Antananarivo',
    city: 'Antananarivo',
    opportunityType: 'emploi',
    requiredSkills: ['Réseaux sociaux', 'Canva', 'Communication', 'Français'],
    level: 'junior',
    deadline: '2026-06-30',
    featured: true,
  },
  {
    key: 'opp-2',
    companyKey: 'techmada',
    title: 'Développeur·se React junior',
    category: 'IT / Digital',
    description:
      'Construisez des interfaces web modernes pour des clients malgaches. Stack : React, TypeScript, API REST. Mentorat assuré.',
    province: 'Antananarivo',
    city: 'Antananarivo',
    opportunityType: 'emploi',
    requiredSkills: ['JavaScript', 'React', 'Git', 'Français'],
    level: 'junior',
    deadline: '2026-07-15',
    featured: true,
  },
  {
    key: 'opp-3',
    companyKey: 'port-toamasina',
    title: 'Stagiaire administration logistique',
    category: 'Logistique',
    description:
      'Stage de 3 mois au port. Soutien à la coordination des flux, saisie de données et relation fournisseurs.',
    province: 'Toamasina',
    city: 'Toamasina',
    opportunityType: 'stage',
    requiredSkills: ['Excel', 'Communication', 'Français'],
    level: 'debutant',
    deadline: '2026-05-20',
    featured: true,
  },
  {
    key: 'opp-4',
    companyKey: 'agence-fianar',
    title: 'Graphiste freelance — affiches événementielles',
    category: 'Design',
    description:
      'Mission ponctuelle pour une série d’événements culturels. Livrables : 5 visuels print et web. Télétravail possible.',
    province: 'Fianarantsoa',
    city: 'Fianarantsoa',
    opportunityType: 'freelance',
    requiredSkills: ['Photoshop', 'Canva', 'Communication'],
    level: 'junior',
    deadline: '2026-04-30',
  },
  {
    key: 'opp-5',
    companyKey: 'mahajanga-commerce',
    title: 'Commercial·e terrain — produits locaux',
    category: 'Ventes',
    description:
      'Développez un réseau de détaillants sur Mahajanga et environs. Véhicule fourni. Prime sur objectifs.',
    province: 'Mahajanga',
    city: 'Mahajanga',
    opportunityType: 'emploi',
    requiredSkills: ['Vente terrain', 'Communication', 'Malagasy', 'Français'],
    level: 'intermediaire',
    deadline: '2026-08-01',
  },
  {
    key: 'opp-6',
    companyKey: 'ong-education-sud',
    title: 'Community manager bénévole (mi-temps)',
    category: 'Community management',
    description:
      'Animez les pages Facebook et TikTok d’une ONG éducative. 15 h/semaine, possibilité de télétravail partiel.',
    province: 'Toliara',
    city: 'Toliara',
    opportunityType: 'mission',
    requiredSkills: ['Réseaux sociaux', 'Rédaction', 'Français', 'Malagasy'],
    level: 'debutant',
    deadline: '2026-05-01',
  },
  {
    key: 'opp-7',
    companyKey: 'dataentry-mg',
    title: 'Agent saisie de données (télétravail)',
    category: 'Saisie de données',
    description:
      'Saisie et vérification de formulaires clients. Connexion internet stable requise. Formation rapide fournie.',
    province: 'Antananarivo',
    city: 'Remote',
    opportunityType: 'mission',
    requiredSkills: ['Excel', 'Français', 'Saisie'],
    level: 'debutant',
    deadline: '2026-06-01',
    featured: true,
  },
  {
    key: 'opp-8',
    companyKey: 'tourisme-nord',
    title: 'Assistant·e accueil & réservations',
    category: 'Administration',
    description:
      'Accueil clients, gestion des réservations et support administratif pour une agence à Antsiranana.',
    province: 'Antsiranana',
    city: 'Antsiranana',
    opportunityType: 'emploi',
    requiredSkills: ['Service client', 'Français', 'Anglais', 'Excel'],
    level: 'junior',
    deadline: '2026-07-01',
  },
  {
    key: 'opp-9',
    companyKey: 'livraison-tana',
    title: 'Livreur·se / coordinatrice logistique',
    category: 'Logistique',
    description:
      'Rejoignez une équipe de livraison urbaine. Horaires flexibles, bon pour débuter dans la logistique.',
    province: 'Antananarivo',
    city: 'Antananarivo',
    opportunityType: 'emploi',
    requiredSkills: ['Livraison', 'Communication'],
    level: 'debutant',
    deadline: '2026-05-15',
  },
  {
    key: 'opp-10',
    companyKey: 'freelance-hub',
    title: 'Rédacteur·rice web SEO (freelance)',
    category: 'Services freelance',
    description:
      'Rédaction d’articles en français pour sites locaux. Rémunération à l’article. Portfolio souhaité.',
    province: 'Toamasina',
    city: 'Remote',
    opportunityType: 'freelance',
    requiredSkills: ['Rédaction', 'SEO', 'Français'],
    level: 'intermediaire',
    deadline: '2026-06-15',
  },
  {
    key: 'opp-11',
    companyKey: 'techmada',
    title: 'Stage développement Python / data',
    category: 'IT / Digital',
    description:
      'Stage de 6 mois : scripts d’automatisation, nettoyage de données et tableaux de bord simples.',
    province: 'Antananarivo',
    city: 'Antananarivo',
    opportunityType: 'stage',
    requiredSkills: ['Python', 'Excel', 'SQL'],
    level: 'debutant',
    deadline: '2026-04-20',
  },
  {
    key: 'opp-12',
    companyKey: 'assoc-jeunes-fianar',
    title: 'Animateur·rice ateliers numériques',
    category: 'Community management',
    description:
      'Encadrez des ateliers initiation au numérique pour jeunes. Contrat mission 4 mois.',
    province: 'Fianarantsoa',
    city: 'Fianarantsoa',
    opportunityType: 'mission',
    requiredSkills: ['Communication', 'Français', 'Malagasy'],
    level: 'junior',
    deadline: '2026-05-30',
  },
] as const

const CANDIDATES = [
  {
    key: 'candidat-1',
    email: 'candidat@demo.mg',
    fullName: 'Miora Rakoto',
    phone: '+261 34 12 345 67',
    province: 'Antananarivo',
    city: 'Antananarivo',
    gender: 'femme' as const,
    educationLevel: 'licence',
    skills: ['Excel', 'Communication', 'Réseaux sociaux', 'Canva', 'Français'],
    experienceLevel: 'junior',
    desiredOpportunityTypes: ['emploi', 'stage', 'mission'],
    availability: 'immediate',
  },
  {
    key: 'candidat-2',
    email: 'faniry.andria@demo.mg',
    fullName: 'Faniry Andrianarivo',
    phone: '+261 33 45 678 12',
    province: 'Antananarivo',
    city: 'Antananarivo',
    gender: 'homme' as const,
    educationLevel: 'master',
    skills: ['JavaScript', 'React', 'Git', 'Python', 'SQL'],
    experienceLevel: 'intermediaire',
    desiredOpportunityTypes: ['emploi', 'freelance'],
    availability: 'flexible',
  },
  {
    key: 'candidat-3',
    email: 'tahiana.raz@demo.mg',
    fullName: 'Tahiana Razafy',
    phone: '+261 32 56 789 23',
    province: 'Toamasina',
    city: 'Toamasina',
    gender: 'femme' as const,
    educationLevel: 'bac',
    skills: ['Excel', 'Vente terrain', 'Malagasy', 'Français'],
    experienceLevel: 'debutant',
    desiredOpportunityTypes: ['emploi', 'stage'],
    availability: 'm1' as const,
  },
  {
    key: 'candidat-4',
    email: 'nomena.fara@demo.mg',
    fullName: 'Nomena Faralahy',
    phone: '+261 34 67 890 34',
    province: 'Fianarantsoa',
    city: 'Fianarantsoa',
    gender: 'homme' as const,
    educationLevel: 'technique',
    skills: ['Photoshop', 'Canva', 'Rédaction'],
    experienceLevel: 'junior',
    desiredOpportunityTypes: ['freelance', 'mission'],
    availability: 'flexible',
  },
  {
    key: 'candidat-5',
    email: 'sitraka.ravo@demo.mg',
    fullName: 'Sitraka Ravonjiarison',
    phone: '+261 33 78 901 45',
    province: 'Mahajanga',
    city: 'Mahajanga',
    gender: 'femme' as const,
    educationLevel: 'autodidacte',
    skills: ['Livraison', 'Communication', 'Service client'],
    experienceLevel: 'debutant',
    desiredOpportunityTypes: ['emploi'],
    availability: 'immediate',
  },
] as const

/** Agents de terrain (verticale emploi vérifié) — comptes provisionnés par l'admin. */
const AGENTS = [
  {
    key: 'agent-1',
    email: 'agent.analamanga@demo.mg',
    fullName: 'Voninkazo Rasolofoson',
    phone: '+261 34 20 111 22',
    province: 'Antananarivo',
    city: 'Antananarivo',
  },
  {
    key: 'agent-2',
    email: 'agent.terrain2@demo.mg',
    fullName: 'Tovonirina Andriamampianina',
    phone: '+261 33 21 333 44',
    province: 'Antananarivo',
    city: 'Antananarivo',
  },
] as const

/**
 * Talents non-diplômés : profils créés et suivis par un agent, pas de
 * compte de connexion propre (décision produit du 2026-09-01). Mix de
 * statuts et de genres cohérent avec le KPI d'inclusion féminine cible
 * (55-60 % de profils recommandés).
 */
const TALENTS = [
  {
    key: 'talent-1', agentKey: 'agent-1', fullName: 'Vololona Randria',
    phone: '+261 34 40 111 22', province: 'Antananarivo', city: 'Antananarivo',
    gender: 'femme' as const, trade: 'Couturière', sector: 'textile_artisanat' as const,
    skills: ['Couture', 'Broderie', 'Retouche'],
    availability: 'immediate' as const, status: 'place' as const,
  },
  {
    key: 'talent-2', agentKey: 'agent-1', fullName: 'Herimanana Rakotoson',
    phone: '+261 33 41 222 33', province: 'Antananarivo', city: 'Antananarivo',
    gender: 'homme' as const, trade: 'Électricien', sector: 'btp' as const,
    skills: ['Installation électrique', 'Dépannage'],
    availability: 'flexible' as const, status: 'recommande' as const,
  },
  {
    key: 'talent-3', agentKey: 'agent-1', fullName: 'Sahondra Rabemananjara',
    phone: '+261 32 42 333 44', province: 'Antananarivo', city: 'Antananarivo',
    gender: 'femme' as const, trade: 'Cuisine / restauration', sector: 'agroalimentaire' as const,
    skills: ['Cuisine malgache', 'Hygiène alimentaire'],
    availability: 'immediate' as const, status: 'verifie' as const,
  },
  {
    key: 'talent-4', agentKey: 'agent-2', fullName: 'Fenosoa Andriamihaja',
    phone: '+261 34 43 444 55', province: 'Antananarivo', city: 'Antananarivo',
    gender: 'femme' as const, trade: 'Vente / commerce', sector: 'services_commerce' as const,
    skills: ['Vente terrain', 'Caisse', 'Relation client'],
    availability: 'immediate' as const, status: 'recommande' as const,
  },
  {
    key: 'talent-5', agentKey: 'agent-2', fullName: 'Rado Ramanantsoa',
    phone: '+261 33 44 555 66', province: 'Antananarivo', city: 'Antananarivo',
    gender: 'homme' as const, trade: 'Conduite / livraison', sector: 'services_commerce' as const,
    skills: ['Permis B', 'Livraison', 'Ponctualité'],
    availability: 'immediate' as const, status: 'verifie' as const,
  },
  {
    key: 'talent-6', agentKey: 'agent-2', fullName: 'Onja Rasoanirina',
    phone: '+261 32 45 666 77', province: 'Antananarivo', city: 'Antananarivo',
    gender: 'femme' as const, trade: 'Ménage / entretien', sector: 'services_commerce' as const,
    skills: ['Nettoyage', 'Repassage', 'Organisation'],
    availability: 'm1' as const, status: 'en_attente' as const,
  },
] as const

/** Membres de l'annuaire (particuliers ayant publié des retours). */
const MEMBERS = [
  { key: 'member-1', displayName: 'Hery R.', district: 'Alasora', joinedAt: '2024-09-02', phoneVerified: true },
  { key: 'member-2', displayName: 'Fanja N.', district: 'Ambohimangakely', joinedAt: '2025-01-18', phoneVerified: true },
  { key: 'member-3', displayName: 'Tojo A.', district: 'Tanjombato', joinedAt: '2025-03-24', phoneVerified: true },
  { key: 'member-4', displayName: 'Voahangy M.', district: 'Analamahitsy', joinedAt: '2025-06-11', phoneVerified: false },
  { key: 'member-5', displayName: 'Rija S.', district: 'Itaosy', joinedAt: '2024-11-05', phoneVerified: true },
  { key: 'member-6', displayName: 'Lalaina P.', district: 'Ankadikely Ilafy', joinedAt: '2026-04-02', phoneVerified: false },
  { key: 'member-7', displayName: 'Naly R.', district: 'Alasora', joinedAt: '2025-08-19', phoneVerified: true },
  { key: 'member-8', displayName: 'Mamy T.', district: 'Andraharo', joinedAt: '2025-10-30', phoneVerified: true },
] as const

const PROVIDERS = [
  {
    key: 'prov-1', name: 'Briqueterie Rasoa', trade: 'Fournisseur de briques',
    description: 'Briques cuites fabriquées sur place à Alasora. Livraison par camion sur l’agglomération, chargement compris.',
    district: 'Alasora', phone: '+261 34 05 112 34', whatsapp: '+261 34 05 112 34',
    addedByKey: 'member-1', createdAt: '2025-02-10',
  },
  {
    key: 'prov-2', name: 'Quincaillerie Fanilo', trade: 'Fournisseur ciment / fer',
    description: 'Ciment, fer à béton, tôles. Prix affichés, possibilité de livraison sur chantier à partir de 20 sacs.',
    district: 'Andraharo', phone: '+261 32 47 889 01',
    addedByKey: 'member-8', claimedByKey: 'member-8', createdAt: '2025-04-22',
  },
  {
    key: 'prov-3', name: 'Équipe Randria — maçonnerie', trade: 'Maçon',
    description: 'Chef de chantier et équipe de 5 maçons. Fondations, élévation, chape. Devis écrit avant démarrage.',
    district: 'Ambohimangakely', phone: '+261 33 12 556 78', whatsapp: '+261 33 12 556 78',
    addedByKey: 'member-2', createdAt: '2025-05-03',
  },
  {
    key: 'prov-4', name: 'Transport Tsiky — camion benne', trade: 'Transport de matériaux',
    description: 'Camion benne 6 m³ pour sable, gravillon, briques et évacuation de gravats. Zone Tana et périphérie.',
    district: 'Tanjombato', phone: '+261 34 78 220 45', whatsapp: '+261 34 78 220 45',
    addedByKey: 'member-3', createdAt: '2025-07-14',
  },
  {
    key: 'prov-5', name: 'Plomberie Nirina', trade: 'Plombier',
    description: 'Installation sanitaire complète et dépannage fuite. Intervient principalement sur le nord de Tana.',
    district: 'Analamahitsy', phone: '+261 32 90 334 12',
    addedByKey: 'member-4', createdAt: '2026-05-28',
  },
  {
    key: 'prov-6', name: 'Élec Andry', trade: 'Électricien',
    description: 'Installation électrique domestique, tableau et mise aux normes. Devis gratuit.',
    district: 'Ivandry', phone: '+261 33 65 447 90',
    addedByKey: 'member-6', createdAt: '2026-01-09',
  },
  {
    key: 'prov-7', name: 'Menuiserie Hery', trade: 'Menuisier',
    description: 'Portes, fenêtres et placards sur mesure en bois local. Atelier à Itaosy.',
    district: 'Itaosy', phone: '+261 34 33 771 26',
    addedByKey: 'member-5', createdAt: '2024-06-18',
  },
  {
    key: 'prov-8', name: 'Carrelage Miora', trade: 'Carreleur',
    description: 'Pose de carrelage sol et mur, finition soignée. Travaille souvent avec l’équipe Randria.',
    district: 'Ankadikely Ilafy', phone: '+261 34 19 662 03', whatsapp: '+261 34 19 662 03',
    addedByKey: 'member-7', createdAt: '2025-11-12',
  },
  {
    key: 'prov-9', name: 'Terrassement Jaona', trade: 'Terrassement',
    description: 'Décapage, nivellement et fouilles de fondation. Mini-pelle et main-d’œuvre.',
    district: 'Sabotsy Namehana', phone: '+261 32 55 908 77',
    addedByKey: 'member-1', createdAt: '2026-02-20',
  },
  {
    key: 'prov-10', name: 'Charpente Lova', trade: 'Charpentier',
    description: 'Charpente traditionnelle et pose de tôles. Fiche créée par un membre, en attente de premiers retours.',
    district: 'Ambohibao', phone: '+261 33 27 145 58',
    addedByKey: 'member-2', createdAt: '2026-07-30',
  },
] as const

const RECOMMENDATIONS = [
  { key: 'rec-1', providerKey: 'prov-1', authorKey: 'member-1', rating: 5, wouldUseAgain: true, jobLabel: 'Livraison de 3 000 briques pour une maison R+1', jobDate: '2026-06-12', pricePaid: 480, priceUnit: 'par brique', comment: 'Briques bien cuites, très peu de casse à la livraison (moins de 2 %). Camion arrivé le jour convenu. Le prix annoncé au téléphone était le prix payé.', proof: 'facture', confirmedBy: ['member-7', 'member-2'] },
  { key: 'rec-2', providerKey: 'prov-1', authorKey: 'member-7', rating: 5, wouldUseAgain: true, jobLabel: 'Livraison de 1 200 briques, mur de clôture', jobDate: '2026-07-02', pricePaid: 470, priceUnit: 'par brique', comment: 'Deuxième commande chez eux. Qualité constante. Ils acceptent le paiement en deux fois pour les grosses quantités.', proof: 'photo', confirmedBy: ['member-1'] },
  { key: 'rec-3', providerKey: 'prov-1', authorKey: 'member-2', rating: 4, wouldUseAgain: true, jobLabel: 'Livraison de 2 000 briques', jobDate: '2026-04-18', pricePaid: 500, priceUnit: 'par brique', comment: 'Bonne qualité mais livraison décalée de deux jours à cause de la pluie. Prévenus à l’avance, donc pas de mauvaise surprise.', proof: 'facture', confirmedBy: [] },
  { key: 'rec-4', providerKey: 'prov-1', authorKey: 'member-3', rating: 4, wouldUseAgain: true, jobLabel: 'Livraison de 800 briques', jobDate: '2026-02-27', pricePaid: 490, priceUnit: 'par brique', comment: 'Livraison jusqu’à Tanjombato sans supplément excessif. Compter 15 000 Ar de plus pour le déchargement à la main.', proof: 'aucune', confirmedBy: ['member-8'] },
  { key: 'rec-5', providerKey: 'prov-1', authorKey: 'member-8', rating: 5, wouldUseAgain: true, jobLabel: 'Commande régulière pour deux chantiers', jobDate: '2026-05-30', pricePaid: 475, priceUnit: 'par brique', comment: 'Je travaille avec eux depuis un an. Jamais eu de litige sur les quantités livrées, ce qui est rare.', proof: 'facture', confirmedBy: ['member-1', 'member-7'] },
  { key: 'rec-6', providerKey: 'prov-1', authorKey: 'member-5', rating: 4, wouldUseAgain: true, jobLabel: 'Livraison de 1 500 briques à Itaosy', jobDate: '2026-01-16', pricePaid: 520, priceUnit: 'par brique', comment: 'Plus cher pour moi à cause de la distance depuis Alasora. Reste intéressant par rapport aux briqueteries de l’ouest.', proof: 'photo', confirmedBy: [] },

  { key: 'rec-7', providerKey: 'prov-2', authorKey: 'member-1', rating: 4, wouldUseAgain: true, jobLabel: 'Achat de 60 sacs de ciment', jobDate: '2026-06-05', pricePaid: 39000, priceUnit: 'par sac', comment: 'Prix corrects et stock disponible. Livraison sur chantier incluse au-delà de 20 sacs, comme annoncé.', proof: 'facture', confirmedBy: ['member-3'] },
  { key: 'rec-8', providerKey: 'prov-2', authorKey: 'member-3', rating: 4, wouldUseAgain: true, jobLabel: 'Fer à béton et 25 sacs de ciment', jobDate: '2026-05-11', pricePaid: 40000, priceUnit: 'par sac', comment: 'Conseil utile sur les diamètres de fer. Facture détaillée fournie sans la demander.', proof: 'facture', confirmedBy: [] },
  { key: 'rec-9', providerKey: 'prov-2', authorKey: 'member-5', rating: 3, wouldUseAgain: true, jobLabel: 'Achat de tôles', jobDate: '2026-03-20', pricePaid: 42000, priceUnit: 'par sac', comment: 'Correct sur le ciment, moins compétitif sur les tôles. Comparez avant de prendre tout au même endroit.', proof: 'aucune', confirmedBy: ['member-2'] },
  { key: 'rec-10', providerKey: 'prov-2', authorKey: 'member-2', rating: 5, wouldUseAgain: true, jobLabel: 'Ciment et fer pour dalle', jobDate: '2026-07-19', pricePaid: 38500, priceUnit: 'par sac', comment: 'Ils ont repris deux sacs abîmés sans discuter. Sérieux.', proof: 'photo', confirmedBy: ['member-1'] },
  { key: 'rec-11', providerKey: 'prov-2', authorKey: 'member-7', rating: 4, wouldUseAgain: true, jobLabel: 'Ciment pour chape', jobDate: '2026-04-08', pricePaid: 39500, priceUnit: 'par sac', comment: 'Rien à signaler, commande conforme.', proof: 'aucune', confirmedBy: [] },
  { key: 'rec-12', providerKey: 'prov-2', authorKey: 'member-8', rating: 5, wouldUseAgain: true, jobLabel: 'Notre quincaillerie', jobDate: '2026-07-01', comment: 'Meilleurs prix de Tana, venez nombreux !', proof: 'aucune', confirmedBy: [] },

  { key: 'rec-13', providerKey: 'prov-3', authorKey: 'member-2', rating: 5, wouldUseAgain: true, jobLabel: 'Fondations et élévation, maison 90 m²', jobDate: '2026-05-04', pricePaid: 32000, priceUnit: 'par jour', comment: 'Chantier tenu dans les délais annoncés. Le chef d’équipe explique ce qu’il fait et accepte d’être repris.', proof: 'facture', confirmedBy: ['member-8', 'member-4'] },
  { key: 'rec-14', providerKey: 'prov-3', authorKey: 'member-8', rating: 4, wouldUseAgain: true, jobLabel: 'Mur de clôture 40 m', jobDate: '2026-06-22', pricePaid: 30000, priceUnit: 'par jour', comment: 'Bon travail. Prévoir vous-même l’approvisionnement, ils ne gèrent pas les achats.', proof: 'photo', confirmedBy: [] },
  { key: 'rec-15', providerKey: 'prov-3', authorKey: 'member-4', rating: 4, wouldUseAgain: true, jobLabel: 'Chape et enduit', jobDate: '2026-03-15', pricePaid: 35000, priceUnit: 'par jour', comment: 'Finition correcte. Un peu plus cher que d’autres équipes mais moins de reprises à faire.', proof: 'aucune', confirmedBy: [] },
  { key: 'rec-16', providerKey: 'prov-3', authorKey: 'member-1', rating: 5, wouldUseAgain: true, jobLabel: 'Extension d’une pièce', jobDate: '2026-07-10', pricePaid: 31000, priceUnit: 'par jour', comment: 'Deuxième fois que je les prends. Devis écrit respecté au chiffre près.', proof: 'facture', confirmedBy: ['member-2'] },

  { key: 'rec-17', providerKey: 'prov-4', authorKey: 'member-3', rating: 5, wouldUseAgain: true, jobLabel: 'Six voyages de sable', jobDate: '2026-06-30', pricePaid: 145000, priceUnit: 'par voyage', comment: 'Ponctuel, benne pleine à chaque fois. Il prévient par WhatsApp quand il part.', proof: 'facture', confirmedBy: ['member-7'] },
  { key: 'rec-18', providerKey: 'prov-4', authorKey: 'member-7', rating: 4, wouldUseAgain: true, jobLabel: 'Évacuation de gravats', jobDate: '2026-05-19', pricePaid: 160000, priceUnit: 'par voyage', comment: 'Un peu cher pour l’évacuation, mais il fait le travail proprement.', proof: 'photo', confirmedBy: [] },
  { key: 'rec-19', providerKey: 'prov-4', authorKey: 'member-2', rating: 4, wouldUseAgain: true, jobLabel: 'Trois voyages de gravillon', jobDate: '2026-04-02', pricePaid: 140000, priceUnit: 'par voyage', comment: 'Rien à redire. Négociable si vous commandez plusieurs voyages.', proof: 'aucune', confirmedBy: [] },

  { key: 'rec-20', providerKey: 'prov-5', authorKey: 'member-4', rating: 5, wouldUseAgain: true, jobLabel: 'Installation sanitaire complète', jobDate: '2026-05-25', pricePaid: 850000, priceUnit: 'forfait', comment: 'Travail rapide et propre, je recommande vivement.', proof: 'aucune', confirmedBy: [] },

  { key: 'rec-21', providerKey: 'prov-6', authorKey: 'member-6', rating: 2, wouldUseAgain: false, jobLabel: 'Installation tableau électrique', jobDate: '2026-06-08', pricePaid: 420000, priceUnit: 'forfait', comment: 'Travail fait mais devis dépassé de 30 % sans prévenir. Il a fallu insister pour obtenir une facture.', proof: 'facture', confirmedBy: ['member-4'] },
  { key: 'rec-22', providerKey: 'prov-6', authorKey: 'member-4', rating: 3, wouldUseAgain: false, jobLabel: 'Mise aux normes prises et interrupteurs', jobDate: '2026-02-14', pricePaid: 380000, priceUnit: 'forfait', comment: 'Compétent techniquement, mais très difficile à joindre après le chantier.', proof: 'aucune', confirmedBy: [] },

  { key: 'rec-23', providerKey: 'prov-7', authorKey: 'member-5', rating: 5, wouldUseAgain: true, jobLabel: 'Six fenêtres et deux portes sur mesure', jobDate: '2024-09-10', pricePaid: 240000, priceUnit: 'par unité', comment: 'Très beau travail à l’époque, bois bien choisi.', proof: 'photo', confirmedBy: ['member-1'] },
  { key: 'rec-24', providerKey: 'prov-7', authorKey: 'member-1', rating: 4, wouldUseAgain: true, jobLabel: 'Placard sur mesure', jobDate: '2024-11-22', pricePaid: 310000, priceUnit: 'par unité', comment: 'Bon rapport qualité-prix. Délai un peu long (5 semaines).', proof: 'aucune', confirmedBy: [] },
  { key: 'rec-25', providerKey: 'prov-7', authorKey: 'member-2', rating: 4, wouldUseAgain: true, jobLabel: 'Porte d’entrée', jobDate: '2024-12-05', pricePaid: 280000, priceUnit: 'par unité', comment: 'Satisfaite. Je ne sais pas s’il travaille encore, je n’ai plus de nouvelles.', proof: 'photo', confirmedBy: [] },

  { key: 'rec-26', providerKey: 'prov-8', authorKey: 'member-7', rating: 5, wouldUseAgain: true, jobLabel: 'Carrelage 65 m² séjour et couloir', jobDate: '2026-06-18', pricePaid: 16000, priceUnit: 'par m²', comment: 'Joints réguliers, aucune reprise nécessaire. Il protège le chantier avant de commencer.', proof: 'photo', confirmedBy: ['member-2'] },
  { key: 'rec-27', providerKey: 'prov-8', authorKey: 'member-2', rating: 4, wouldUseAgain: true, jobLabel: 'Carrelage salle de bain et cuisine', jobDate: '2026-07-25', pricePaid: 15000, priceUnit: 'par m²', comment: 'Travail soigné. Prévoyez 10 % de carreaux en plus, il ne récupère pas les chutes.', proof: 'facture', confirmedBy: [] },

  { key: 'rec-28', providerKey: 'prov-9', authorKey: 'member-1', rating: 4, wouldUseAgain: true, jobLabel: 'Fouilles de fondation, terrain de 300 m²', jobDate: '2026-03-09', pricePaid: 45000, priceUnit: 'par m³', comment: 'Mini-pelle en bon état, chantier terminé en deux jours comme prévu.', proof: 'facture', confirmedBy: ['member-3'] },
  { key: 'rec-29', providerKey: 'prov-9', authorKey: 'member-3', rating: 4, wouldUseAgain: true, jobLabel: 'Décapage et nivellement', jobDate: '2026-05-02', pricePaid: 48000, priceUnit: 'par m³', comment: 'Correct. Le devis est au m³, faites mesurer avant de signer.', proof: 'aucune', confirmedBy: [] },
] as const

async function main() {
  const existing = await prisma.user.count()
  if (existing > 0) {
    console.log(`La base contient déjà ${existing} utilisateur(s) — seed ignoré (base non vide).`)
    return
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const userIdByKey = new Map<string, string>()

  console.log('Comptes recruteurs (entreprises)…')
  for (const c of COMPANIES) {
    const user = await prisma.user.create({
      data: {
        email: c.email,
        passwordHash,
        role: 'recruiter',
        recruiterProfile: {
          create: { companyName: c.companyName, phone: c.phone, province: c.province, city: c.city, sector: c.sector },
        },
      },
    })
    userIdByKey.set(c.key, user.id)
  }

  console.log('Comptes candidats…')
  for (const c of CANDIDATES) {
    const user = await prisma.user.create({
      data: {
        email: c.email,
        passwordHash,
        role: 'candidate',
        candidateProfile: {
          create: {
            fullName: c.fullName,
            phone: c.phone,
            province: c.province,
            city: c.city,
            gender: c.gender,
            educationLevel: c.educationLevel,
            skills: [...c.skills],
            experienceLevel: c.experienceLevel,
            desiredOpportunityTypes: [...c.desiredOpportunityTypes],
            availability: c.availability,
          },
        },
      },
    })
    userIdByKey.set(c.key, user.id)
  }

  console.log('Comptes agents de terrain…')
  for (const a of AGENTS) {
    const user = await prisma.user.create({
      data: {
        email: a.email,
        passwordHash,
        role: 'agent',
        agentProfile: {
          create: { fullName: a.fullName, phone: a.phone, province: a.province, city: a.city },
        },
      },
    })
    userIdByKey.set(a.key, user.id)
  }

  console.log('Compte particulier de démonstration…')
  const individualUser = await prisma.user.create({
    data: {
      email: 'particulier@demo.mg',
      passwordHash,
      role: 'particulier',
      individualProfile: {
        create: { fullName: 'Njaka Randriamampionona', phone: '+261 34 99 111 22', province: 'Antananarivo', city: 'Antananarivo' },
      },
    },
  })

  console.log('Compte admin de démonstration…')
  await prisma.user.create({
    data: { email: 'admin@demo.mg', passwordHash, role: 'admin' },
  })

  console.log('Membres de l’annuaire (contributeurs)…')
  const memberIdByKey = new Map<string, string>()
  for (const m of MEMBERS) {
    // Chaque membre a besoin d'un compte auth ; ce sont des particuliers.
    const user = await prisma.user.create({
      data: {
        email: `${m.key}@demo.mg`,
        passwordHash,
        role: 'particulier',
        individualProfile: {
          create: { fullName: m.displayName, phone: '+261 34 00 000 00', province: 'Antananarivo', city: 'Antananarivo' },
        },
      },
    })
    const member = await prisma.member.create({
      data: {
        userId: user.id,
        displayName: m.displayName,
        district: m.district,
        city: 'Antananarivo',
        phoneVerified: m.phoneVerified,
        joinedAt: new Date(m.joinedAt),
      },
    })
    memberIdByKey.set(m.key, member.id)
  }

  console.log('Opportunités…')
  const opportunityIdByKey = new Map<string, string>()
  for (const o of OPPORTUNITIES) {
    const company = COMPANIES.find((c) => c.key === o.companyKey)!
    const opportunity = await prisma.opportunity.create({
      data: {
        recruiterId: userIdByKey.get(o.companyKey)!,
        companyName: company.companyName,
        title: o.title,
        category: o.category,
        sector: CATEGORY_SECTOR[o.category] ?? 'autre',
        description: o.description,
        province: o.province,
        city: o.city,
        opportunityType: o.opportunityType,
        requiredSkills: [...o.requiredSkills],
        level: o.level,
        deadline: new Date(o.deadline),
        featured: 'featured' in o ? Boolean(o.featured) : false,
      },
    })
    opportunityIdByKey.set(o.key, opportunity.id)
  }

  console.log('Des candidatures de démonstration…')
  await prisma.application.create({
    data: {
      opportunityId: opportunityIdByKey.get('opp-1')!,
      candidateId: userIdByKey.get('candidat-1')!,
      message: 'Très motivée par le marketing local.',
      status: 'contactee',
    },
  })
  await prisma.application.create({
    data: {
      opportunityId: opportunityIdByKey.get('opp-2')!,
      candidateId: userIdByKey.get('candidat-2')!,
      message: 'Trois ans d’expérience React, disponible immédiatement.',
      status: 'vue',
    },
  })
  await prisma.application.create({
    data: {
      opportunityId: opportunityIdByKey.get('opp-5')!,
      candidateId: userIdByKey.get('candidat-3')!,
      message: 'Expérience en vente terrain à Toamasina, mobile sur Mahajanga.',
      status: 'envoyee',
    },
  })

  console.log('Prestataires de l’annuaire…')
  const providerIdByKey = new Map<string, string>()
  for (const p of PROVIDERS) {
    const provider = await prisma.provider.create({
      data: {
        name: p.name,
        trade: p.trade,
        description: p.description,
        district: p.district,
        phone: p.phone,
        whatsapp: 'whatsapp' in p ? p.whatsapp : undefined,
        addedByMemberId: memberIdByKey.get(p.addedByKey)!,
        claimedByMemberId: 'claimedByKey' in p ? memberIdByKey.get(p.claimedByKey as string) : undefined,
        createdAt: new Date(p.createdAt),
      },
    })
    providerIdByKey.set(p.key, provider.id)
  }

  console.log('Recommandations et confirmations…')
  for (const r of RECOMMENDATIONS) {
    const recommendation = await prisma.recommendation.create({
      data: {
        providerId: providerIdByKey.get(r.providerKey)!,
        authorMemberId: memberIdByKey.get(r.authorKey)!,
        authorDistrict: MEMBERS.find((m) => m.key === r.authorKey)!.district,
        rating: r.rating,
        wouldUseAgain: r.wouldUseAgain,
        jobLabel: r.jobLabel,
        jobDate: new Date(r.jobDate),
        pricePaid: 'pricePaid' in r ? r.pricePaid : undefined,
        priceUnit: 'priceUnit' in r ? r.priceUnit : undefined,
        comment: r.comment,
        proof: r.proof,
      },
    })
    for (const confirmerKey of r.confirmedBy) {
      await prisma.recommendationConfirmation.create({
        data: { recommendationId: recommendation.id, memberId: memberIdByKey.get(confirmerKey)! },
      })
    }
  }

  console.log('Grille tarifaire et abonnements…')
  await prisma.subscriptionPlan.createMany({
    data: [
      { code: 'FREE', name: 'Free', priceAr: 0, maxActiveOpportunities: 2, features: ['Profil entreprise', 'Candidatures reçues', 'Statistiques basiques'] },
      { code: 'STARTER', name: 'Starter', priceAr: 100000, maxActiveOpportunities: 10, features: ['Plus d’offres', 'Matching amélioré', 'Recherche avancée', 'Shortlist'] },
      { code: 'PRO', name: 'Pro', priceAr: 250000, maxActiveOpportunities: 30, features: ['Matching avancé', 'Recommandations prioritaires', 'Analytics', 'Outils RH avancés'] },
      { code: 'BUSINESS', name: 'Business', priceAr: 500000, maxActiveOpportunities: null, features: ['Volume élevé', 'Analytics avancés', 'Support prioritaire'] },
    ],
  })
  // Hypothèse de démonstration : deux entreprises abonnées, pour peupler le revenu admin.
  await prisma.subscription.create({
    data: { recruiterId: userIdByKey.get('techmada')!, planCode: 'PRO' },
  })
  await prisma.transaction.create({
    data: { recruiterId: userIdByKey.get('techmada')!, type: 'subscription', amountAr: 250000, description: 'Abonnement Pro' },
  })
  await prisma.subscription.create({
    data: { recruiterId: userIdByKey.get('port-toamasina')!, planCode: 'STARTER' },
  })
  await prisma.transaction.create({
    data: { recruiterId: userIdByKey.get('port-toamasina')!, type: 'subscription', amountAr: 100000, description: 'Abonnement Starter' },
  })

  console.log('Un fil de messagerie de démonstration…')
  const [participantAId, participantBId] = [userIdByKey.get('candidat-1')!, userIdByKey.get('techmada')!].sort()
  const conversation = await prisma.conversation.create({
    data: { participantAId, participantBId, opportunityId: opportunityIdByKey.get('opp-1') },
  })
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: userIdByKey.get('candidat-1')!,
      content: 'Bonjour, je viens de postuler à votre offre d’assistant·e marketing digital. Je suis disponible pour un entretien dès cette semaine.',
    },
  })
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: userIdByKey.get('techmada')!,
      content: 'Merci pour votre candidature ! Nous revenons vers vous d’ici quelques jours.',
    },
  })

  console.log('Talents non-diplômés et vérifications…')
  const talentIdByKey = new Map<string, string>()
  for (const t of TALENTS) {
    const talent = await prisma.talentProfile.create({
      data: {
        agentId: userIdByKey.get(t.agentKey)!,
        fullName: t.fullName,
        phone: t.phone,
        province: t.province,
        city: t.city,
        gender: t.gender,
        trade: t.trade,
        sector: t.sector,
        skills: [...t.skills],
        availability: t.availability,
        status: t.status,
      },
    })
    talentIdByKey.set(t.key, talent.id)
    if (t.status !== 'en_attente') {
      await prisma.talentVerification.create({
        data: {
          talentId: talent.id,
          trade: t.trade,
          checklist: Object.fromEntries(t.skills.map((s) => [s, true])),
          note: `Compétences vérifiées sur le terrain par ${AGENTS.find((a) => a.key === t.agentKey)!.fullName}.`,
        },
      })
    }
  }

  console.log('Propositions d’opportunités par les agents…')
  const proposals: { talentKey: string; opportunityKey: string }[] = [
    { talentKey: 'talent-1', opportunityKey: 'opp-4' },
    { talentKey: 'talent-2', opportunityKey: 'opp-9' },
    { talentKey: 'talent-4', opportunityKey: 'opp-5' },
  ]
  for (const p of proposals) {
    await prisma.talentOpportunityProposal.create({
      data: { talentId: talentIdByKey.get(p.talentKey)!, opportunityId: opportunityIdByKey.get(p.opportunityKey)! },
    })
  }

  console.log('Placements et suivi du success fee…')
  await prisma.placement.create({
    data: {
      opportunityId: opportunityIdByKey.get('opp-1')!,
      recruiterId: userIdByKey.get('techmada')!,
      candidateId: userIdByKey.get('candidat-1')!,
      monthlySalaryAr: 450000,
      stage: 'etape1_payee',
    },
  })
  await prisma.placement.create({
    data: {
      opportunityId: opportunityIdByKey.get('opp-4')!,
      recruiterId: userIdByKey.get('agence-fianar')!,
      talentId: talentIdByKey.get('talent-1')!,
      monthlySalaryAr: 320000,
      stage: 'etape1_due',
    },
  })
  await prisma.placement.create({
    data: {
      opportunityId: opportunityIdByKey.get('opp-5')!,
      recruiterId: userIdByKey.get('mahajanga-commerce')!,
      talentId: talentIdByKey.get('talent-4')!,
      monthlySalaryAr: 300000,
      stage: 'etape2_due',
    },
  })

  console.log('Terminé.')
  console.log('Comptes démo (mot de passe "demo123") :')
  console.log(
    '  candidat@demo.mg, recruteur@demo.mg, particulier@demo.mg, admin@demo.mg, agent.analamanga@demo.mg',
  )
  void individualUser
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
