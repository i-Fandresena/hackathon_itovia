# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OffRec — French-language platform for Madagascar, two npm projects in one repo:

- **Frontend** (repo root) — React 19 + TypeScript + Vite 8 SPA, React Router 7, plain CSS.
- **Backend** (`server/`) — Express 4 + TypeScript (ESM, NodeNext) + Prisma 5 + PostgreSQL, JWT cookie sessions, Gemini for AI features, Resend for email.

Three product verticals share the app:

- **Annuaire de confiance** (`/annuaire`) — trust-scored directory of construction tradespeople in Antananarivo, built on member recommendations tied to real jobs.
- **Portail d'opportunités** (`/candidat`, `/recruteur`) — offers matched to graduate candidates, with OffRec as the mandatory intermediary (see below).
- **Emploi vérifié** (`/agent`, `/mon-espace`, `/admin`) — field agents verify non-graduate talents, propose them to offers, and track placements / success fee.

Other docs: `CAHIER_DES_CHARGES.md` and `update/cahier-des-charges-offrec-mvp.md` are the product spec — code comments cite its rules as `§7.3.14`, `§7.3.15`, etc. `update/HANDOFF_DEPLOIEMENT_VPS.md` is the current deployment reference. `server/API_DOCUMENTATION.md` lists endpoints. For product/strategy/pitch/roadmap decisions, use the `offrec-ceo-strategy` skill rather than improvising.

**Stale docs — do not trust for architecture:** `AGENTS.md` ("Produit et état actuel", "Carte du code"), `README.md`, `DEPLOYMENT.md`, `supabase/schema.sql` and the root `.env.example` all describe an older localStorage-only prototype with a planned Supabase migration. That path was abandoned; nothing in `src/` reads `VITE_USE_SUPABASE` or any Supabase variable. `AGENTS.md`'s "Discipline de collaboration" and "Règles métier" sections still apply.

## Commands

Node **22.x** is required for both projects (`.nvmrc`, `engines`).

```bash
# Database (Postgres 16 on host port 5433, not 5432)
docker compose up -d db

# Backend — run from server/
cp .env.example .env          # then fill JWT_SECRET (required), GEMINI_API_KEY, RESEND_API_KEY
npm install
npm run prisma:generate
npm run prisma:migrate        # dev: create/apply migrations (prisma migrate dev)
npm run prisma:deploy         # prod: apply committed migrations only
npm run seed                  # demo data — no-op unless the User table is empty
npm run dev                   # tsx watch, http://localhost:4000
npm run build                 # tsc — the backend type-check

# Frontend — run from repo root
npm install
npm run dev                   # http://localhost:5173
npm run build                 # tsc --noEmit && vite build — the frontend type-check
```

There is no test runner and no ESLint in either project. The two `npm run build` commands are the only automated checks — run the one(s) matching what you touched, and **both** when you edit a file shared with the server (see "Shared code" below). `server/test-all-apis.ts` and `server/add-test-data.ts` are ad hoc scripts against a running server, not a test suite.

Seeded demo accounts (password `demo123`): `candidat@demo.mg`, `recruteur@demo.mg`, `particulier@demo.mg`, `admin@demo.mg`, `agent.analamanga@demo.mg`, `agent.terrain2@demo.mg`.

Environment gotchas:

- `VITE_API_URL` (default `http://localhost:4000/api`) is baked in at **build time** by Vite. It is the only frontend env var that matters.
- The server throws at import time if `JWT_SECRET` is unset (`server/src/lib/jwt.ts`).
- Without `RESEND_API_KEY`, `/verification/send-code` fails, so **no account can be registered** — use the seeded accounts for local work.
- Without `GEMINI_API_KEY`, AI endpoints degrade gracefully (they return `unavailable` / fall back to deterministic results).
- The session cookie is `secure` when `NODE_ENV=production`, so sessions silently fail over plain HTTP in prod.
- `server/package.json`'s `start` runs `node dist/index.js`, but because `tsconfig.json` includes files from `../src`, `tsc` emits to `dist/server/src/index.js`.

## Architecture

### Shared code between frontend and backend

The backend imports frontend modules by relative path (`../../../src/...`): `src/types/index.ts`, `src/lib/trust.ts`, `src/lib/recommendation.ts`, `src/data/constants.ts`, `src/data/endorsements.ts`, `src/lib/interview.ts`, `src/lib/opportunityFields.ts` (listed in `server/tsconfig.json` `include`). Consequences:

- Those seven files must stay free of browser/React/Vite APIs and compile under both tsconfigs.
- `server/` cannot be moved or deployed without the rest of the repo.
- `src/types/index.ts` is the single domain contract; Prisma enums in `server/prisma/schema.prisma` mirror its string unions. A domain change touches: Prisma schema + migration, `src/types`, Zod schemas in `server/src/lib/validation.ts`, the mappers in `server/src/lib/domain.ts` / `serialize.ts`, `src/lib/api.ts`, and `server/prisma/seed.ts`.

### Backend (`server/src`)

`app.ts` wires middleware and mounts one router per domain under `/api/*`. Conventions every route follows:

- `attachSession` decodes the JWT cookie into `req.session = { sub, role }` on every request. Guard with `requireAuth` or `requireRole(...roles)` (`middleware/auth.ts`, `middleware/rbac.ts`); both re-check `User.status` in the DB so suspended/banned accounts lose access immediately. Never trust a role sent by the client.
- Parse bodies with a Zod schema from `lib/validation.ts` and `next(err)` on failure — `errorHandler` turns `ZodError` into a 400 with `details.fieldErrors`, which `src/lib/api.ts` unpacks into the user-facing message.
- Error payloads are `{ error: "<message en français>" }`.
- Return users only through `serializeUser()` — `passwordHash` has leaked before via a raw Prisma include.
- All LLM calls go through `safeGenerate()` in `lib/gemini.ts` (sanitisation, prompt-injection filter, system/retrieved/user separation, timeout). AI is additive, never decisional: callers must still work when it returns `text: null`.
- Sensitive actions write an `AuditLog` row; AI calls write an `AiInteraction` row.
- Admins are told about platform activity through `notifyAdmins()` / `scheduleAdminNotification()` in `lib/notify.ts`: in-app only (never email), sent after the response to every active admin except the actor, tagged with a `NotificationCategory` for the filters of `/admin/notifications`. It is a curated selection of events worded for a human, not a mirror of `AuditLog`; the matching engine sends one summary notification per run that produced something (none otherwise); the text never carries an email, a phone number, or the name of a directory member or non-graduate talent.

### Frontend data layer

`src/lib/api.ts` is the only place that calls `fetch` (with `credentials: 'include'`); it exports one typed `api*` function per endpoint and throws `ApiError`.

`src/context/AppContext.tsx` (`useApp()`) holds the **shared** state: `currentUser`, public opportunities, directory data (`providers`/`recommendations`/`members`), and role-scoped data loaded after login (`mySuggestions` for candidates, `receivedSuggestions` for recruiters, bookmarks, notifications). Its mutations return `{ ok, error? }` rather than throwing. Pages for admin, agent, talent, messaging, billing, placements and shortlist call `api*` functions directly and keep local state — only add to `AppContext` what several pages need.

`src/lib/storage.ts` is a leftover from the localStorage prototype and is unused; `localStorage` now only stores the theme (`src/hooks/useTheme.ts`).

### Roles, routing, shells

Six roles (`UserRole`): `candidate`, `recruiter`, `particulier`, `admin`, `agent`, `talent`. `src/lib/roles.ts` maps each to its home path. Adding a role means updating the Prisma enum, `src/types`, `roles.ts`, the sidebar/tab bar, and route guards on both sides.

`src/App.tsx`: auth pages (`/connexion`, `/inscription`, `/inscription-talent`, `/verification-email`) render full-screen outside `Layout`. Everything else is inside `Layout`, wrapped in `ProtectedRoute role=...`, which waits for `hydrated`, redirects visitors to `/connexion` and wrong-role users to their own home. `/`, `/offres/:id`, `/annuaire`, `/annuaire/:id`, `/annuaire/talents`, `/annuaire/talents/:ref`, `/annuaire/entreprises` and `/annuaire/entreprises/:id` are public (the old `/talents`, `/talents/:ref`, `/entreprises`, `/entreprises/:id`, `/mes-recommandations`, `/recommander-un-talent`, `/recommander-une-entreprise` redirect to the same path under `/annuaire`, query and hash kept). `ProtectedRoute` is UX only — the server guards are the real access control.

The Annuaire (`src/pages/directory/DirectoryTabs.tsx`) is the single entry point for displaying recommendations: tabs Professionnels / Talents recommandés / Entreprises recommandées / Mes recommandations (sub-routes of `/annuaire`; the last one only for the roles allowed to recommend a talent), with the « Recommander un talent / une entreprise » forms at `/annuaire/recommander-un-talent` and `/annuaire/recommander-une-entreprise`; menus have a single « Annuaire » entry for it.

`Layout` picks the shell from `currentUser`, not the route: logged in → `AppShell` (sidebar + right rail + tab bar), logged out → `Header`/`Footer`. Check a public page in both states when changing its layout.

Registration is two-step: verify the email first (4-digit code or emailed link via `/api/verification/*`, `EmailVerificationModal` polls status), then `POST /auth/register` consumes the single-use `verificationToken`. No unverified account ever exists in the DB.

### Product invariants enforced in code

These are deliberate product decisions, not incidental behaviour — preserve them on both client and server:

- **OffRec is the intermediary (decisions 2026-09-02, 2026-10-08 and 2026-10-14).** Candidates and recruiters never contact each other directly, and candidates no longer apply offer by offer: they upload a CV and give one global, timestamped, revocable consent (`CandidateProfile.matchingConsentAt`, `POST`/`DELETE /auth/profile/candidate/matching-consent`), which replaces per-offer interest. A `MatchSuggestion` is created by the matching engine (`server/src/lib/matching.ts`, `origin: systeme`) or by an admin (`admin-matching.routes.ts`, `origin: admin`) — never by a candidate or recruiter. The engine scores with the unchanged `scoreOpportunity()` on the confirmed profile, requires at least one shared skill, and applies the hybrid rule: score ≥ `MATCH_AUTO_THRESHOLD` (80) **and** a human-verified CV → created directly as `proposee_recruteur`; otherwise score ≥ `MATCH_THRESHOLD` (60) → `suggeree`, waiting for admin validation. Status chain: `suggeree → proposee_recruteur → interet_recruteur → mise_en_relation` (or `ecartee`); `proposee_candidat` and `interet_candidat` are legacy values, never produced any more but still valid on existing rows — see `ADMIN_ALLOWED_TRANSITIONS`. The server re-checks consent before every move to `proposee_recruteur` and to `mise_en_relation` (plus an active candidate account for the latter) — one rule set, `checkMatchTransition()` / `commitMatchTransition()` (conditional write, so concurrent requests never advance a file twice) / `notifyMiseEnRelation()` in `lib/preselection-service.ts`, shared by `applyAdminTransition()` and the recruiter; the engine only refreshes or promotes rows still `suggeree` and never reactivates an `ecartee` row. Recruiters decline, or — **decision 2026-10-14** — click « Ce profil m'intéresse », which requires one interview date and moves the file straight to `mise_en_relation` (`RECRUITER_ALLOWED_TRANSITIONS`: from `proposee_recruteur` or `interet_recruteur`; `POST /match-suggestions/:id/interview`, `server/src/lib/interviews.ts`); the admin is only informed. The old date-less recruiter `/interest` now returns 400; existing `interet_recruteur` rows take an interview, or an admin still confirms them. Interview rules: one `Interview` per file (unique `suggestionId`, rescheduled or cancelled in place, never a second row); the recruiter alone sets a single date (Madagascar time, UTC+3 fixed, stored UTC, 2 h to 60 days ahead, 30/45/60 min), reschedules or cancels (the connection stays); the candidate only confirms or reports an impediment with a short reason; free texts carry no email or phone (`contactDetailsError()`, `src/lib/interview.ts`, shared). Google Calendar (`lib/google-calendar.ts`, plain `fetch`): the event lives in OffRec's calendar with **no `attendees`** and `sendUpdates=none` (Google must never expose one party's address to the other or email them) — OffRec sends the Meet link itself; a Google failure never undoes the connection (`meetStatus: en_attente`, admins notified to resync via `POST /admin/matching/interviews/:id/calendar-sync`); without `GOOGLE_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN` it is simulated (`provider`/`meetStatus: simule`, never a fake `meet.google.com` link, shown as such in the UI). Interview create/reschedule/cancel/impediment write `AuditLog` rows. The « Entretiens » tabs (`/recruteur/entretiens`, `/admin/entretiens`) read `GET /match-suggestions/interviews` (own offers only) and `GET /admin/matching/interviews` (`lib/interview-list.ts`, explicit whitelists); a recruiter only ever gets the candidate's name — never email or phone, neither there nor in `/received`, the offer shortlist (`GET /opportunities/:id/shortlist`), `/placements/mine` or the legacy `/applications/received` (explicit `select` whitelists, fixed 2026-10-16); the recruiter's interview detail modal is shared (`RecruiterInterviewDetail`). Candidates can only withdraw from a file (`/decline`) before `mise_en_relation`; both the candidate's withdrawal and the recruiter's « Écarter » write through `commitMatchTransition()` (409 if the file changed meanwhile, so a withdrawal and a concurrent interview never both succeed). The candidate is notified only at `mise_en_relation` (now usually the interview proposal: offer, company, date, duration, Meet link or « à venir »), in-app **and** by email (`notifyUser()` in `lib/notify.ts`), never at `interet_recruteur`; the interview is returned to the candidate only from `mise_en_relation`. The candidate feed is `mySuggestions` (files from `proposee_recruteur` onward), not the full catalogue, and the server withholds the company name there until `mise_en_relation`. Messaging is blocked for candidates and restricted to recruiter ↔ admin, server-side (`assertConversationAccess`).
- **ATS preselection per offer is a layer above `scoreOpportunity()`, never a new score.** `preselect()` in `server/src/lib/preselection.ts` (pure, no DB, no AI) applies knock-out filters in a fixed order (offer open, active account, consent, CV, not already `ecartee`, at least one shared skill, score ≥ `MATCH_THRESHOLD`, plus the admin's optional filters), then ranks by score and deterministic tie-breaks, and keeps the top 5 or 10; the weights are untouched. Skills found by AI in the CV (`cvSkillsSuggested`) surface only as a displayed hint (`cvHintSkills`, admin-only) — never in the score, filters or ranking. The admin transmits a selection in bulk (`POST /admin/matching/opportunities/:id/preselection/transmit`), which recomputes the preselection server-side and goes through `applyAdminTransition()` — the single implementation shared with the unit PATCH — and never reactivates an `ecartee` row. That module also holds the one definition of eligibility used by the matching engine.
- **A `TalentProfile` is only ever created and edited by an agent (§7.3.14).** `TalentLead` (self-service request) and `SourcingLead` (signal spotted by an agent) are never profiles themselves. The `talent` login role (`TalentAccountProfile`) is a read-only tracking account. Verification uses the standardised per-trade checklists in `src/data/verificationGrids.ts` (§7.3.15), and each `TalentVerification` is appended, never overwritten.
- **Talent recommendation is a private signal, never a profile.** Only `candidate`, `particulier`, `recruiter` and `talent` may recommend a talent (`POST /api/endorsements/talents`; `agent`/`admin` get 403), positively only (a serious problem goes through a `Report`), and always get the same neutral answer. Each `Endorsement` feeds a `TalentSignal` grouped by normalised phone (`server/src/lib/talent-signals.ts`); only an agent creates the `TalentProfile` after meeting the person. The contact (`subjectName`, `contactPhone`, `contactHint`) and the `comment` are visible only to the agent who took the signal (any agent while it is `nouveau`) and to admins — never in any other response nor in any notification — and are purged 60 days after the last activity (`purgeExpiredSignals`, at startup and lazily from the agent queue) or at once on refusal. Proof photos (`lib/proof-upload.ts`) are served only through `uploads.routes.ts`. Trust is computed server-side (`buildTrustEvidence` + `evaluateSubject`); `authorLinkKey` never leaves the server. No endorsement is ever deleted: an agent excludes it. Creating a `TalentProfile` always requires `consent: true` (`talentCreateSchema`, any origin: direct, `fromLeadId`, `fromSourcingLeadId`, `fromSignalId`) → `consentAt` + `AuditLog` `talent_consent_profile`; older profiles with `consentAt = null` show « accord non tracé ». `fromSignalId` converts the signal in the same transaction (free or held by this agent; another agent's → 409): `converti` + `talentId` on it and on the signals merged into it, contact erased. `TalentProfile.phoneKey` (kept in sync on every create/update) attaches later recommendations to the talent. A talent's trust comes from `loadTalentTrust()` (`server/src/lib/talent-trust.ts`, one grouped pass); the recruiter sees recommendations without comment, author name, photo or contact (`recruiterEndorsementView`), and the job label only once reviewed and not hidden. The UI label of `TalentStatus.recommande` is « Proposé à une offre » (`TALENT_STATUS_LABELS`), distinct from the trust level « Recommandé ». The public showcase « Talents recommandés » (`/api/talents-recommandes`, `server/src/lib/public-talents.ts`) shows a talent only with an explicit public-visibility consent collected by its agent (`publicConsentAt`, distinct from `consentAt`, revocable via `PUT /agent/talents/:id/public-visibility`, `AuditLog` `talent_consent_public_granted`/`_revoked` `{ talentId }`), and only while `PUBLIC_TALENT_WHERE` holds (`consentAt` set, at least one verification, agent and linked talent account neither suspended nor banned). Every public response is built by the explicit whitelist `toPublicTalent()` (trade, sector, city/district, level, independent sources, top 3 highlights, verification month) — never a spread of a Prisma object, never a name, phone, internal id, photo, agent, comment, job label or author. The public id is a random `publicRef`, regenerated on each new consent and nulled on revocation (the old link returns 404). Contact goes through OffRec: a signed-in non-agent, non-admin user files a `TalentContactRequest` (5 / 24 h / user + IP limiter), handled by the talent's agent (`nouvelle → transmise → close`), who arranges the contact offline; the requester is notified in-app at `transmise`. A public profile can be reported (`ReportTargetType.talent`, the client sends the `publicRef`; moderation target = the talent's agent); an admin can only revoke it.
- **Company recommendation protects its authors.** Only `candidate`, `particulier` and `talent` recommend an employer (`POST /api/endorsements/companies`; recruiter/agent/admin get 403), positively only, with a neutral answer; an author recognised as the company (linked recruiter, same normalised `companyName`, or same phone as one of its recruiters) gets 400. A `Company` is created on first recommendation and deduplicated by `nameKey` + canonical city (`server/src/lib/companies.ts`). No author (not even a pseudonym) and no comment ever reach a public response, the linked recruiter or a notification; public output goes through the `toPublicCompany()` whitelist (relation breakdown hidden under `COMPANY_RELATION_MIN`). The optional proof (photo or PDF) is readable by admins and the author only, reviewed by an admin, then deleted from disk whether accepted or refused — only `proofAccepted` remains. Only an admin links a company to a recruiter account (no self-claim) or hides it (`hiddenAt`: invisible everywhere). Never show a company's trust in the candidate feed or file before `mise_en_relation` (it would reveal the company).
- **CV upload never auto-applies to the profile.** `POST /auth/profile/candidate/cv` extracts text with `pdf-parse`, structures it via Gemini (`lib/cv-extraction.ts`), rejects the CV if its name contradicts the profile (a different email or phone is only a flag), and stores results in `cv*` columns as suggestions the candidate confirms in the UI. The upload may carry the matching consent (`matchingConsent=true`; omitting it never withdraws an existing consent) and triggers the matching engine, which still scores the confirmed profile only — never the `cv*` columns — so matching works identically without `GEMINI_API_KEY`.
- **Billing and success fee are declarative.** `Transaction` is a simulated payment; `Placement.stage` is tracked manually. Prices come from `SubscriptionPlan` rows, never hardcoded in the frontend. `POST /placements` (recruiter) still declares a placement by hand but checks, since 2026-10-16: the offer is the recruiter's (404), the person was proposed to him for that offer — a `MatchSuggestion` at `proposee_recruteur` or beyond for a graduate, a `TalentOpportunityProposal` for a talent (400) —, no non-cancelled duplicate for the same person and offer (409, declarations of one offer serialised by a `FOR UPDATE` row lock, no DB constraint); it writes `AuditLog` `placement_declared`, and a recruiter's stage change writes `placement_stage_updated`.
- **Moderation escalates** warning → restriction → suspension → ban (`UserStatus`), driven by `Report` + `ModerationAction`.
- `Sector` is a cross-cutting filter tag, not a navigation section and not a matching constraint.

### Trust engine (`src/lib/trust.ts`)

Runs on both sides (server computes rankings and enforces rules in `directory.routes.ts`; the client recomputes from `/directory/raw` for display). Two evaluators share one weighting core — `weightOf()` (proof strength `facture` > `photo` > `aucune` × job recency × author reliability × peer confirmations) and `reliabilityFrom()`:

- **`evaluateProvider()` — the directory, unchanged.** It does **not** average stars — each `Recommendation` is weighted by `weightOf()` with the author `Member`'s reliability (`memberReliability()`, a wrapper over `reliabilityFrom()`). `rankProviders()` additionally pulls toward a Bayesian prior for sort order only; the displayed score is always the real weighted average. No diversity rule here (decision F2: seed members share one phone and field collection dates reviews by collection day and district, so it would wrongly penalise the directory) — its output must stay identical.
- **`evaluateSubject()` — talents and companies.** Positive recommendations without a rating, fed as `TrustEvidence` built server-side (`authorLinkKey` is an opaque author fingerprint, never sent to the client). Excluded rows (`excludedAt`) don't count; one per author (latest); only an agent-accepted proof weighs, otherwise it counts as `aucune`. Diversity: `independentSourceGroups()` unions recommendations sharing an `authorLinkKey` or created the same Madagascar calendar day (fixed UTC+3, no `Intl`) from the same declared district; in each group the strongest counts fully, the others × 0.25. E = sum of effective weights; displayed index `round(100·E/(E+3))`, hidden while `nouveau`. Levels (`trustLevel()`): `nouveau` (< 2 sources or E < 1.2 — neutral badge, never a warning), `recommande` (≥ 2 sources and E ≥ 1.2), `tres_recommande` (≥ 4 sources, E ≥ 2.8, ≥ 1 source with accepted proof, last job ≤ 12 months). `compareSubjectTrust()` orders by level, then E, then independent sources (0 on full tie — the caller adds its own tie-breaks); it is only a tie-breaker at equal offer fit, never added to `scoreOpportunity()`. Labels and closed positive highlight lists live in `src/data/endorsements.ts`. `cd server && npx tsx scripts/trust-examples.ts` checks the reference cases.

The `reasons`/`warnings` arrays of both evaluators are user-facing explanations — keep them consistent with any weighting change.

Anti-abuse rules (`canRecommend()` / `eligibleRecommendations()`, plus DB unique constraints): one recommendation per member per provider, no counting recommendations from a provider who claimed their own listing, no self-confirmation, no recommendation deletion.

`User` (auth account) and `Member` (community identity carrying directory reputation) are distinct. A `Member` is created lazily by `getOrCreateMember()` on first contribution; the district declared at the latest contribution wins. `currentUser.memberId` is `null` until then.

Real names and private phone numbers of members must never reach seeds, public directory data, or the UI — a hard privacy rule from field-data collection (`collecte/GUIDE-COLLECTE.md`).

### Opportunity matching (`src/lib/recommendation.ts`)

`scoreOpportunity()` returns a 0–100 score plus user-facing reasons from fixed weights (skills 0.4, location 0.25, level 0.15, type 0.15, availability 0.05). Skills are compared trimmed and case-insensitively, but not accent-insensitively. An offer's `requiredSkills` may hold free entries besides `COMMON_SKILLS`; `src/lib/opportunityFields.ts` (shared, the server's Zod schema uses it) normalises them and maps any entry equal to a suggestion, ignoring case and accents, to the suggestion's label. A free skill only matches a candidate whose confirmed profile carries the same label (in practice, one taken from the CV). `Opportunity.missions` (ordered, optional, max 15) is display-only: it never enters a score. Candidates see it before `mise_en_relation`, so the server rejects emails, phone numbers and URLs in it, and the form tells the recruiter not to name the company. The server uses it to build the admin's candidate pool and the recruiter shortlist. It is independent of the trust engine — don't conflate the two. For agent-proposed talents, `talentMatch()` (`server/src/lib/talent-match.ts`) adapts a `TalentProfile` (skills + trade, unknown level and types → neutral, so ≈ 84 max) and calls `scoreOpportunity()` unchanged. The recruiter shortlist shows « Adéquation à l'offre » and « Confiance » side by side, never summed, sorted by fit desc → `compareSubjectTrust` → `proposedAt` asc → id, cut to 10 after sorting.

### UI conventions

- Components and pages pair a `.tsx` with a same-named `.css` (plain CSS; no Tailwind or CSS-in-JS). Pages within one area often share a stylesheet (e.g. `pages/auth/Auth.css`).
- Reuse `src/components/ui/` primitives and the `framer-motion` wrappers in `src/components/motion/Motion.tsx` rather than adding ad hoc variants.
- UI text is French; amounts are in Ariary (`src/lib/format.ts`). Domain identifiers mix English and French (`pricePaid`, `annuaire`, `mise_en_relation`) — match existing terms when extending the model.

## Deployment and git

Production is a VPS at `offrec.qualitec.mg`: the frontend `dist/` is served by nginx in a container (`Dockerfile.web`, `nginx.prod.conf`, `docker-compose.prod.yml` behind Traefik), which proxies `/api/` and `/uploads/` to the Express process on the host at port 4000. `server/uploads/` (candidate CVs) is gitignored and must persist across deploys.

Branches: `collab` is the integration branch (PR target); `update` is the branch the VPS handoff deploys. Never commit `.env` files, `server/uploads/`, `collecte/sortie/`, or personal data from field collection.
