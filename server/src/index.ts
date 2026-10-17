import 'dotenv/config'
import { createApp } from './app.js'
import { purgeExpiredSignals } from './lib/talent-signals.js'

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
})
