import { Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { PageMotion } from '../motion/Motion'
import { AppShell } from './AppShell'
import { Footer } from './Footer'
import { Header } from './Header'

/**
 * Deux coquilles distinctes : l'espace connecté passe en trois colonnes,
 * les pages publiques (accueil, annuaire consulté sans compte) gardent le
 * header horizontal et le pied de page.
 */
export function Layout() {
  const { currentUser } = useApp()
  const { pathname } = useLocation()

  if (currentUser) return <AppShell />

  const isLanding = pathname === '/'

  return (
    <>
      <Header floating={isLanding} />
      <main className={`public-main ${isLanding ? 'public-main--no-tabbar' : ''}`.trim()}>
        <PageMotion>
          <Outlet />
        </PageMotion>
      </main>
      <Footer />
    </>
  )
}
