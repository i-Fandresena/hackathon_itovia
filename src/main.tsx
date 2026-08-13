import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './components/ui/Button.css'
import './components/ui/Badge.css'
import './components/ui/Card.css'
import './components/ui/Form.css'
import './components/ui/MatchScore.css'
import './components/ui/EmptyState.css'
import './components/ui/Loading.css'
import './components/layout/Header.css'
import './components/layout/Footer.css'
import './components/opportunity/OpportunityCard.css'
import './components/opportunity/OpportunityFilters.css'
import './components/brand/Logo.css'
import './components/brand/HeroVisual.css'
import './components/brand/MadagascarMap.css'
import './components/brand/MatchRing.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
