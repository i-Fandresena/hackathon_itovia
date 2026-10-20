import 'dotenv/config'
import { createApp } from './app.js'
import { purgeExpiredSignals } from './lib/talent-signals.js'
import { repairHiringData } from './lib/hiring-store.js'
import { startHiringJobs } from './lib/hiring-jobs.js'

const port = Number(process.env.PORT ?? 4000)
const app = createApp()

app.listen(port, () => {
  console.log(`OffRec API en écoute sur http://localhost:${port}`)
  // Purge du contact des signaux de talents expirés (60 jours sans suite),
  // sans bloquer le démarrage ; la file des agents la relance au besoin.
  purgeExpiredSignals()
    .then((count) => {
      if (count > 0) console.log(`[talent-signals] ${count} signal(aux) expiré(s) purgé(s).`)
    })
    .catch((err) => console.error('[talent-signals] Purge au démarrage impossible', err))
  // Tours d'entretien et dates de mise en relation écrits par un code
  // antérieur au client Prisma régénéré : ne remplit que des colonnes vides,
  // sans bloquer le démarrage ; ne lève jamais (lib/hiring-store.ts).
  // Puis les tâches « après l'entretien » — rappels d'issue, expiration des
  // propositions d'embauche, rappel J-2 (démarrage + toutes les 15 min),
  // seulement avec HIRING_JOBS_ENABLED=true (lib/hiring-jobs.ts).
  void repairHiringData().then((repaired) => {
    if (repaired && repaired.rounds + repaired.connectedAt > 0) {
      console.log(
        `[hiring] Réparation au démarrage : ${repaired.rounds} tour(s) réactivé(s), ` +
          `${repaired.connectedAt} date(s) de mise en relation reprise(s).`,
      )
    }
    startHiringJobs()
  })
})
