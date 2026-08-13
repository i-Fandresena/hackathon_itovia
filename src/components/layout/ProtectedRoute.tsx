import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Loading } from '../ui/Loading'
import type { UserRole } from '../../types'

interface ProtectedRouteProps {
  role?: UserRole
  children: React.ReactNode
}

export function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const { currentUser, hydrated } = useApp()
  const location = useLocation()

  if (!hydrated) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/connexion" state={{ from: location }} replace />
  }

  if (role && currentUser.role !== role) {
    const redirect =
      currentUser.role === 'candidate' ? '/candidat' : '/recruteur'
    return <Navigate to={redirect} replace />
  }

  return <>{children}</>
}
