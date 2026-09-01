import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import {
  apiBillingPlans,
  apiMySubscription,
  apiSubscribe,
  type Subscription,
  type SubscriptionPlan,
} from '../../lib/api'

export function RecruiterBilling() {
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const load = () => {
    Promise.all([apiBillingPlans(), apiMySubscription()]).then(([p, s]) => {
      setPlans(p)
      setSubscription(s)
    })
  }

  useEffect(load, [])

  const handleSubscribe = async (code: string) => {
    setPending(code)
    setFeedback('')
    try {
      const s = await apiSubscribe(code)
      setSubscription(s)
      setFeedback(
        s.plan.priceAr > 0
          ? `Abonnement ${s.plan.name} activé. Paiement simulé de ${s.plan.priceAr.toLocaleString('fr-FR')} Ar enregistré.`
          : `Vous êtes maintenant sur le plan ${s.plan.name}.`,
      )
    } finally {
      setPending(null)
    }
  }

  if (!plans) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  const currentCode = subscription?.planCode ?? 'FREE'

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Abonnement</h1>
          <p>
            Paiement simulé à des fins de démonstration — aucune transaction réelle n’est
            effectuée.
          </p>
        </header>

        {feedback && <p className="save-ok" style={{ marginBottom: '1rem' }}>{feedback}</p>}

        <div className="grid-3">
          {plans.map((plan) => {
            const isCurrent = plan.code === currentCode
            return (
              <Card key={plan.code} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.1rem' }}>{plan.name}</h2>
                <strong style={{ fontSize: '1.4rem' }}>
                  {plan.priceAr > 0 ? `${plan.priceAr.toLocaleString('fr-FR')} Ar / mois` : 'Gratuit'}
                </strong>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem' }}>
                      <Check size={14} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={isCurrent ? 'outline' : 'primary'}
                  disabled={isCurrent || pending === plan.code}
                  onClick={() => handleSubscribe(plan.code)}
                >
                  {isCurrent ? 'Plan actuel' : pending === plan.code ? 'Traitement…' : 'Choisir ce plan'}
                </Button>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
