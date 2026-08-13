import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { Landing } from './pages/Landing'
import { Login } from './pages/auth/Login'
import { Signup } from './pages/auth/Signup'
import { CandidateDashboard } from './pages/candidate/CandidateDashboard'
import { CandidateProfile } from './pages/candidate/CandidateProfile'
import { CandidateOpportunities } from './pages/candidate/CandidateOpportunities'
import { CandidateSaved } from './pages/candidate/CandidateSaved'
import { CandidateNotifications } from './pages/candidate/CandidateNotifications'
import { OpportunityDetail } from './pages/OpportunityDetail'
import { Directory } from './pages/directory/Directory'
import { ProviderDetail } from './pages/directory/ProviderDetail'
import { RecommendationForm } from './pages/directory/RecommendationForm'
import { RecruiterDashboard } from './pages/recruiter/RecruiterDashboard'
import { RecruiterOpportunityForm } from './pages/recruiter/RecruiterOpportunityForm'
import { RecruiterOpportunityList } from './pages/recruiter/RecruiterOpportunityList'
import { RecruiterApplications } from './pages/recruiter/RecruiterApplications'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="connexion" element={<Login />} />
            <Route path="inscription" element={<Signup />} />
            <Route
              path="offres/:id"
              element={
                <OpportunityDetail
                  basePath="/offres"
                  backLabel="Retour à l’accueil"
                  backTo="/"
                  canBookmark={false}
                />
              }
            />

            {/* Annuaire de confiance : la consultation est publique,
                seule la contribution demande un compte. */}
            <Route path="annuaire" element={<Directory />} />
            <Route path="annuaire/:id" element={<ProviderDetail />} />
            <Route
              path="annuaire/:id/recommander"
              element={
                <ProtectedRoute>
                  <RecommendationForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="candidat"
              element={
                <ProtectedRoute role="candidate">
                  <CandidateDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="candidat/profil"
              element={
                <ProtectedRoute role="candidate">
                  <CandidateProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="candidat/offres"
              element={
                <ProtectedRoute role="candidate">
                  <CandidateOpportunities />
                </ProtectedRoute>
              }
            />
            <Route
              path="candidat/offres/:id"
              element={
                <ProtectedRoute role="candidate">
                  <OpportunityDetail
                    basePath="/candidat/offres"
                    backLabel="Retour aux offres"
                    backTo="/candidat/offres"
                    canApply
                    canBookmark
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="candidat/favoris"
              element={
                <ProtectedRoute role="candidate">
                  <CandidateSaved />
                </ProtectedRoute>
              }
            />
            <Route
              path="candidat/notifications"
              element={
                <ProtectedRoute role="candidate">
                  <CandidateNotifications />
                </ProtectedRoute>
              }
            />

            <Route
              path="recruteur"
              element={
                <ProtectedRoute role="recruiter">
                  <RecruiterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="recruteur/publier"
              element={
                <ProtectedRoute role="recruiter">
                  <RecruiterOpportunityForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="recruteur/offres"
              element={
                <ProtectedRoute role="recruiter">
                  <RecruiterOpportunityList />
                </ProtectedRoute>
              }
            />
            <Route
              path="recruteur/offres/:id/modifier"
              element={
                <ProtectedRoute role="recruiter">
                  <RecruiterOpportunityForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="recruteur/candidatures"
              element={
                <ProtectedRoute role="recruiter">
                  <RecruiterApplications />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
