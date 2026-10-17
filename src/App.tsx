import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { Landing } from './pages/Landing'
import { Login } from './pages/auth/Login'
import { Signup } from './pages/auth/Signup'
import { VerifyEmailLink } from './pages/auth/VerifyEmailLink'
import { TalentAccountSignup } from './pages/auth/TalentAccountSignup'
import { TalentSpace } from './pages/talent/TalentSpace'
import { CandidateDashboard } from './pages/candidate/CandidateDashboard'
import { CandidateProfile } from './pages/candidate/CandidateProfile'
import { CandidateNotifications } from './pages/candidate/CandidateNotifications'
import { CandidateInterviews } from './pages/candidate/CandidateInterviews'
import { OpportunityDetail } from './pages/OpportunityDetail'
import { Directory } from './pages/directory/Directory'
import { DirectoryTabs, LegacyDirectoryRedirect } from './pages/directory/DirectoryTabs'
import { ProviderDetail } from './pages/directory/ProviderDetail'
import { RecommendationForm } from './pages/directory/RecommendationForm'
import { RecruiterDashboard } from './pages/recruiter/RecruiterDashboard'
import { RecruiterOpportunityForm } from './pages/recruiter/RecruiterOpportunityForm'
import { RecruiterOpportunityList } from './pages/recruiter/RecruiterOpportunityList'
import { RecruiterApplications } from './pages/recruiter/RecruiterApplications'
import { RecruiterInterviews } from './pages/recruiter/RecruiterInterviews'
import { IndividualDashboard } from './pages/individual/IndividualDashboard'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminModeration } from './pages/admin/AdminModeration'
import { AdminPlacements } from './pages/admin/AdminPlacements'
import { AdminAgents } from './pages/admin/AdminAgents'
import { AdminTalents } from './pages/admin/AdminTalents'
import { AdminNotifications } from './pages/admin/AdminNotifications'
import { AdminActivity } from './pages/admin/AdminActivity'
import { AdminMatching } from './pages/admin/AdminMatching'
import { AdminInterviews } from './pages/admin/AdminInterviews'
import { Messages } from './pages/messages/Messages'
import { RecruiterBilling } from './pages/recruiter/RecruiterBilling'
import { RecruiterShortlist } from './pages/recruiter/RecruiterShortlist'
import { RecruiterPlacements } from './pages/recruiter/RecruiterPlacements'
import { RecruiterNotifications } from './pages/recruiter/RecruiterNotifications'
import { AgentDashboard } from './pages/agent/AgentDashboard'
import { TalentForm } from './pages/agent/TalentForm'
import { TalentDetail } from './pages/agent/TalentDetail'
import { Leads } from './pages/agent/Leads'
import { Sourcing } from './pages/agent/Sourcing'
import { TalentSignals } from './pages/agent/TalentSignals'
import { AgentNotifications } from './pages/agent/AgentNotifications'
import { TalentSignalDetail } from './pages/agent/TalentSignalDetail'
import { RecommendTalent } from './pages/endorsements/RecommendTalent'
import { MyEndorsements } from './pages/endorsements/MyEndorsements'
import { CvVerification } from './pages/verification/CvVerification'
import { TALENT_RECOMMENDER_ROLES } from './lib/roles'
import { PublicTalents } from './pages/talents/PublicTalents'
import { PublicTalentDetail } from './pages/talents/PublicTalentDetail'
import { ContactRequests } from './pages/agent/ContactRequests'
import { PublicCompanies } from './pages/companies/PublicCompanies'
import { PublicCompanyDetail } from './pages/companies/PublicCompanyDetail'
import { RecommendCompany } from './pages/companies/RecommendCompany'
import { AdminCompanies } from './pages/admin/AdminCompanies'
import { AdminRecruiters } from './pages/admin/AdminRecruiters'
import { AdminCandidates } from './pages/admin/AdminCandidates'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Plein écran, sans le header/footer public — juste un bouton
              retour vers la landing (voir Auth.css `.split-back-link`). */}
          <Route path="connexion" element={<Login />} />
          <Route path="inscription" element={<Signup />} />
          <Route path="inscription-talent" element={<TalentAccountSignup />} />
          <Route path="verification-email" element={<VerifyEmailLink />} />

          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route
              path="mon-espace"
              element={
                <ProtectedRoute role="talent">
                  <TalentSpace />
                </ProtectedRoute>
              }
            />
            <Route
              path="offres/:id"
              element={
                <OpportunityDetail backLabel="Retour à l’accueil" backTo="/" />
              }
            />

            {/* Annuaire : point d'entrée unique de l'affichage des
                recommandations. La consultation est publique, seule la
                contribution demande un compte. Onglets = sous-routes ; les
                segments fixes (`talents`, `entreprises`…) passent avant
                `annuaire/:id` (fiche prestataire, id uuid). */}
            <Route path="annuaire" element={<DirectoryTabs />}>
              <Route index element={<Directory />} />
              {/* Talents ayant donné leur accord explicite ; la demande de
                  contact demande un compte. */}
              <Route path="talents" element={<PublicTalents />} />
              {/* Aucun auteur, aucun commentaire ; recommander demande un compte. */}
              <Route path="entreprises" element={<PublicCompanies />} />
              <Route
                path="mes-recommandations"
                element={
                  <ProtectedRoute role={TALENT_RECOMMENDER_ROLES}>
                    <MyEndorsements />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="annuaire/talents/:ref" element={<PublicTalentDetail />} />
            <Route path="annuaire/entreprises/:id" element={<PublicCompanyDetail />} />
            {/* Recommander un talent : jamais l'agent ni l'admin (garde serveur
                identique dans endorsements.routes.ts). */}
            <Route
              path="annuaire/recommander-un-talent"
              element={
                <ProtectedRoute role={TALENT_RECOMMENDER_ROLES}>
                  <RecommendTalent />
                </ProtectedRoute>
              }
            />
            <Route
              path="annuaire/recommander-une-entreprise"
              element={
                <ProtectedRoute role={['candidate', 'particulier', 'talent']}>
                  <RecommendCompany />
                </ProtectedRoute>
              }
            />
            <Route path="annuaire/:id" element={<ProviderDetail />} />

            {/* Anciennes adresses (en-tête, notifications `/talents#mes-demandes`,
                liens déjà partagés) : redirigées sous `/annuaire` avec le
                même chemin, filtres et ancre conservés. */}
            <Route path="talents" element={<LegacyDirectoryRedirect />} />
            <Route path="talents/:ref" element={<LegacyDirectoryRedirect />} />
            <Route path="entreprises" element={<LegacyDirectoryRedirect />} />
            <Route path="entreprises/:id" element={<LegacyDirectoryRedirect />} />
            <Route path="mes-recommandations" element={<LegacyDirectoryRedirect />} />
            <Route path="recommander-un-talent" element={<LegacyDirectoryRedirect />} />
            <Route path="recommander-une-entreprise" element={<LegacyDirectoryRedirect />} />
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
            {/* Anciennes pages du parcours « postuler offre par offre » : le
                candidat suit désormais ses dossiers depuis le tableau de bord. */}
            <Route path="candidat/offres" element={<Navigate to="/candidat" replace />} />
            <Route path="candidat/favoris" element={<Navigate to="/candidat" replace />} />
            <Route
              path="candidat/offres/:id"
              element={
                <ProtectedRoute role="candidate">
                  <OpportunityDetail backLabel="Retour au tableau de bord" backTo="/candidat" candidate />
                </ProtectedRoute>
              }
            />
            <Route
              path="candidat/entretiens"
              element={
                <ProtectedRoute role="candidate">
                  <CandidateInterviews />
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
              path="recruteur/entretiens"
              element={
                <ProtectedRoute role="recruiter">
                  <RecruiterInterviews />
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
              path="recruteur/notifications"
              element={
                <ProtectedRoute role="recruiter">
                  <RecruiterNotifications />
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
                <ProtectedRoute role={['recruiter', 'particulier', 'admin', 'agent', 'talent']}>
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
              path="admin/mise-en-relation"
              element={
                <ProtectedRoute role="admin">
                  <AdminMatching />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/entretiens"
              element={
                <ProtectedRoute role="admin">
                  <AdminInterviews />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/notifications"
              element={
                <ProtectedRoute role="admin">
                  <AdminNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/activite"
              element={
                <ProtectedRoute role="admin">
                  <AdminActivity />
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
              path="admin/talents"
              element={
                <ProtectedRoute role="admin">
                  <AdminTalents />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/candidats"
              element={
                <ProtectedRoute role="admin">
                  <AdminCandidates />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/recruteurs"
              element={
                <ProtectedRoute role="admin">
                  <AdminRecruiters />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/entreprises"
              element={
                <ProtectedRoute role="admin">
                  <AdminCompanies />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/placements"
              element={
                <ProtectedRoute role="admin">
                  <AdminPlacements />
                </ProtectedRoute>
              }
            />

            {/* Vérification humaine des CV : ouverte à l'admin et aux rôles
                qu'il autorise — garde par capacité, pas par rôle. */}
            <Route
              path="verification-cv"
              element={
                <ProtectedRoute allow={(user) => user.canVerifyCv === true}>
                  <CvVerification />
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
              path="agent/leads"
              element={
                <ProtectedRoute role="agent">
                  <Leads />
                </ProtectedRoute>
              }
            />
            <Route
              path="agent/recommandations"
              element={
                <ProtectedRoute role="agent">
                  <TalentSignals />
                </ProtectedRoute>
              }
            />
            <Route
              path="agent/demandes-talents"
              element={
                <ProtectedRoute role="agent">
                  <ContactRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="agent/notifications"
              element={
                <ProtectedRoute role="agent">
                  <AgentNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="agent/recommandations/:id"
              element={
                <ProtectedRoute role="agent">
                  <TalentSignalDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="agent/veille"
              element={
                <ProtectedRoute role="agent">
                  <Sourcing />
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
