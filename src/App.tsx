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
import { IndividualDashboard } from './pages/individual/IndividualDashboard'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminModeration } from './pages/admin/AdminModeration'
import { AdminAgents } from './pages/admin/AdminAgents'
import { Messages } from './pages/messages/Messages'
import { RecruiterBilling } from './pages/recruiter/RecruiterBilling'
import { RecruiterShortlist } from './pages/recruiter/RecruiterShortlist'
import { RecruiterPlacements } from './pages/recruiter/RecruiterPlacements'
import { AgentDashboard } from './pages/agent/AgentDashboard'
import { TalentForm } from './pages/agent/TalentForm'
import { TalentDetail } from './pages/agent/TalentDetail'

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
            <Route
              path="recruteur/abonnement"
              element={
                <ProtectedRoute role="recruiter">
                  <RecruiterBilling />
                </ProtectedRoute>
              }
            />
            <Route
              path="recruteur/offres/:id/shortlist"
              element={
                <ProtectedRoute role="recruiter">
                  <RecruiterShortlist />
                </ProtectedRoute>
              }
            />
            <Route
              path="recruteur/placements"
              element={
                <ProtectedRoute role="recruiter">
                  <RecruiterPlacements />
                </ProtectedRoute>
              }
            />

            <Route
              path="messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />

            <Route
              path="particulier"
              element={
                <ProtectedRoute role="particulier">
                  <IndividualDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/moderation"
              element={
                <ProtectedRoute role="admin">
                  <AdminModeration />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/agents"
              element={
                <ProtectedRoute role="admin">
                  <AdminAgents />
                </ProtectedRoute>
              }
            />

            <Route
              path="agent"
              element={
                <ProtectedRoute role="agent">
                  <AgentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="agent/talents/nouveau"
              element={
                <ProtectedRoute role="agent">
                  <TalentForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="agent/talents/:id"
              element={
                <ProtectedRoute role="agent">
                  <TalentDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="agent/talents/:id/modifier"
              element={
                <ProtectedRoute role="agent">
                  <TalentForm />
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
