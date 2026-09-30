import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const password = 'demo123'
  const passwordHash = await bcrypt.hash(password, 10)

  // Créer un candidat de test
  console.log('Création du candidat...')
  const candidateEmail = `candidat.test.${Date.now()}@demo.mg`
  const candidate = await prisma.user.upsertMany
    ? await prisma.user.create({
        data: {
          email: candidateEmail,
          passwordHash,
          role: 'candidate',
          candidateProfile: {
            create: {
              fullName: 'Jean Dupont',
              phone: '+261 32 98 765 43',
              province: 'Antananarivo',
              city: 'Antananarivo',
              gender: 'homme',
              educationLevel: 'licence',
              skills: ['JavaScript', 'React', 'Node.js', 'PostgreSQL', 'Git'],
              experienceLevel: 'intermediaire',
              desiredOpportunityTypes: ['emploi', 'freelance'],
              availability: 'immediate',
            },
          },
        },
      })
    : null

  // Créer un recruteur de test
  console.log('Création du recruteur...')
  const recruiterEmail = `recruteur.test.${Date.now()}@demo.mg`
  const recruiter = await prisma.user.create({
    data: {
      email: recruiterEmail,
      passwordHash,
      role: 'recruiter',
      recruiterProfile: {
        create: {
          companyName: 'Tech Solutions Madagascar',
          phone: '+261 32 12 345 67',
          province: 'Antananarivo',
          city: 'Antananarivo',
          sector: 'digital',
        },
      },
    },
  })
  console.log(`✓ Recruteur créé : ${recruiterEmail}`)

  // Créer une opportunité
  console.log('Création de l\'annonce...')
  const opportunity = await prisma.opportunity.create({
    data: {
      recruiterId: recruiter.id,
      companyName: 'Tech Solutions Madagascar',
      title: 'Développeur Full Stack React/Node',
      category: 'IT / Digital',
      sector: 'digital',
      description: `
Nous cherchons un développeur Full Stack expérimenté pour rejoindre notre équipe.

Responsabilités :
- Développer des features front-end avec React et TypeScript
- Concevoir des APIs avec Node.js et Express
- Optimiser les performances

Profil recherché :
- 2+ ans d'expérience React
- Maîtrise de Node.js
- Connaissance de PostgreSQL
- Anglais courant
      `,
      province: 'Antananarivo',
      city: 'Antananarivo',
      opportunityType: 'emploi',
      requiredSkills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Git'],
      level: 'intermediaire',
      deadline: new Date('2026-12-31'),
      featured: true,
    },
  })
  console.log(`✓ Annonce créée : ${opportunity.title}`)

  console.log('\n✅ Données de test créées avec succès!')
  console.log('\nIdentifiants de connexion :')
  if (candidate) {
    console.log(`  Email candidat : ${candidateEmail}`)
  }
  console.log(`  Email recruteur : ${recruiterEmail}`)
  console.log(`  Mot de passe : ${password}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
