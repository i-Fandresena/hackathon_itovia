import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Loading } from '../ui/Loading'
import { homePathForRole } from '../../lib/roles'
import type { UserRole } from '../../types'

interface ProtectedRouteProps {
  role?: UserRole | UserRole[]
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

  const allowedRoles = Array.isArray(role) ? role : role ? [role] : null
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={homePathForRole(currentUser.role)} replace />
  }

  return <>{children}</>
}
