/**
 * Grille de vérification de compétences standardisée par métier (cahier
 * des charges §7.3 règle 15) : un référentiel commun, pas un champ libre
 * que chaque agent redéfinit à sa façon. `TalentDetail.tsx` charge la
 * checklist correspondant au `trade` du talent au lieu de la générer
 * depuis les compétences déclarées par le talent lui-même.
 *
 * Couvre au minimum les métiers des secteurs actifs du pilote (BTP,
 * Textile/Artisanat, Digital) ; `default` sert de repli pour tout métier
 * pas encore couvert.
 */
export const VERIFICATION_GRIDS: Record<string, string[]> = {
  default: [
    'A démontré la compétence déclarée devant l’agent (ou preuve équivalente)',
    'Dispose des outils/matériel de base pour exercer le métier',
    'A déjà exercé ce métier de façon rémunérée',
    'Respecte les consignes de sécurité de base du métier',
    'Se présente et communique de façon fiable (ponctualité, disponibilité déclarée cohérente)',
  ],

  // BTP / Construction
  'Maçon': [
    'Sait doser un mélange béton correctement',
    'Maîtrise l’aplomb et le niveau',
    'Connaît les normes d’armature de base',
    'A déjà travaillé sur un chantier supervisé',
    'Respecte les consignes de sécurité de chantier',
  ],
  'Charpentier': [
    'Sait lire un plan de charpente simple',
    'Maîtrise l’assemblage et la fixation des bois de structure',
    'Connaît les essences de bois adaptées à l’usage local',
    'A déjà réalisé une charpente complète ou une réparation majeure',
    'Respecte les consignes de sécurité en hauteur',
  ],
  'Menuisier': [
    'Maîtrise la découpe et l’assemblage précis',
    'Sait choisir le bois/matériau adapté à la commande',
    'Produit une finition soignée (ponçage, jointure)',
    'A un portfolio ou des réalisations vérifiables',
  ],
  'Plombier': [
    'Sait diagnostiquer une fuite ou un bouchon',
    'Maîtrise le raccordement et l’étanchéité des tuyauteries',
    'Connaît les normes sanitaires de base',
    'A déjà réalisé une installation ou réparation complète sans supervision',
  ],
  'Électricien': [
    'Connaît les normes de sécurité électrique de base',
    'Sait diagnostiquer une panne simple',
    'Maîtrise le câblage et la pose de tableau électrique',
    'A déjà réalisé une installation électrique complète',
    'Utilise un équipement de protection individuelle',
  ],
  'Peintre': [
    'Maîtrise la préparation de surface (ponçage, enduit)',
    'Applique une peinture uniforme sans coulures',
    'Sait calculer la quantité de matériau nécessaire',
    'A des réalisations vérifiables (photos, chantier récent)',
  ],
  'Carreleur': [
    'Maîtrise la pose à niveau et l’alignement',
    'Sait préparer le mortier-colle correctement',
    'Produit des joints réguliers',
    'A déjà réalisé une pose complète (sol ou mur) sans supervision',
  ],
  'Soudeur / ferronnier': [
    'Maîtrise au moins une technique de soudure courante',
    'Produit des soudures solides et propres',
    'Connaît les consignes de sécurité (protection, ventilation)',
    'A déjà livré un ouvrage métallique complet',
  ],
  'Transport de matériaux': [
    'Dispose d’un véhicule ou moyen de transport en état de fonctionner',
    'Connaît les itinéraires et contraintes de livraison locales',
    'A un historique de livraisons fiables (délais, état des matériaux)',
  ],
  'Terrassement': [
    'Sait évaluer un terrain avant travaux',
    'Maîtrise les techniques de nivellement de base',
    'Dispose ou sait mobiliser l’équipement nécessaire',
    'A déjà réalisé un chantier de terrassement complet',
  ],
  'Puisatier': [
    'Connaît les techniques de creusement sécurisées',
    'Sait évaluer la profondeur/qualité d’une nappe locale',
    'Respecte les consignes de sécurité (étayage, ventilation)',
    'A déjà réalisé un puits fonctionnel',
  ],
  'Dessinateur / architecte': [
    'Sait produire un plan lisible et coté',
    'Maîtrise les normes de construction locales de base',
    'A un portfolio de plans/réalisations vérifiable',
  ],
  'Fournisseur de briques': [
    'Produit ou fournit des briques de qualité constante',
    'Respecte les délais de livraison annoncés',
    'A des références vérifiables (chantiers déjà fournis)',
  ],
  'Fournisseur ciment / fer': [
    'Fournit des matériaux conformes (pas de produit dégradé/périmé)',
    'Respecte les délais de livraison annoncés',
    'A des références vérifiables (chantiers déjà fournis)',
  ],

  // Textile / Artisanat
  'Couturière': [
    'Sait prendre des mesures précises',
    'Maîtrise la réalisation d’un patron simple',
    'Produit des finitions soignées (ourlets, coutures)',
    'Respecte les délais annoncés',
    'A un portfolio de réalisations vérifiable',
  ],
  'Tisserand': [
    'Maîtrise au moins une technique de tissage traditionnelle',
    'Produit un tissu régulier, sans défaut majeur',
    'Connaît les matières premières locales et leur préparation',
    'A des réalisations vérifiables',
  ],
  'Cordonnier': [
    'Maîtrise la réparation et l’assemblage de chaussures/maroquinerie',
    'Produit des finitions solides et durables',
    'A des réalisations vérifiables',
  ],
  'Brodeuse': [
    'Maîtrise au moins deux points de broderie',
    'Produit un motif régulier et propre',
    'Respecte les délais annoncés',
    'A un portfolio de réalisations vérifiable',
  ],

  // Digital
  'Développeur web': [
    'Écrit du code lisible et fonctionnel',
    'Utilise un gestionnaire de version (Git ou équivalent)',
    'Sait livrer une démonstration fonctionnelle de son travail',
    'A des réalisations vérifiables (portfolio, dépôt de code, sites en ligne)',
  ],
  'Community manager': [
    'Sait planifier et publier un contenu adapté à la plateforme',
    'Maîtrise les bases du calendrier éditorial',
    'A des exemples de comptes/campagnes gérés vérifiables',
    'Sait lire des statistiques d’engagement de base',
  ],
  'Graphiste': [
    'Maîtrise au moins un outil de création graphique',
    'Produit des visuels cohérents avec une charte donnée',
    'A un portfolio de réalisations vérifiable',
    'Respecte les délais annoncés',
  ],
}
