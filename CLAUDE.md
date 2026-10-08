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

The backend imports frontend modules by relative path (`../../../src/...`): `src/types/index.ts`, `src/lib/trust.ts`, `src/lib/recommendation.ts`, `src/data/constants.ts` (listed in `server/tsconfig.json` `include`). Consequences:

- Those four files must stay free of browser/React/Vite APIs and compile under both tsconfigs.
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

### Frontend data layer

`src/lib/api.ts` is the only place that calls `fetch` (with `credentials: 'include'`); it exports one typed `api*` function per endpoint and throws `ApiError`.

`src/context/AppContext.tsx` (`useApp()`) holds the **shared** state: `currentUser`, public opportunities, directory data (`providers`/`recommendations`/`members`), and role-scoped data loaded after login (`mySuggestions` for candidates, `receivedSuggestions` for recruiters, bookmarks, notifications). Its mutations return `{ ok, error? }` rather than throwing. Pages for admin, agent, talent, messaging, billing, placements and shortlist call `api*` functions directly and keep local state — only add to `AppContext` what several pages need.

`src/lib/storage.ts` is a leftover from the localStorage prototype and is unused; `localStorage` now only stores the theme (`src/hooks/useTheme.ts`).

### Roles, routing, shells

Six roles (`UserRole`): `candidate`, `recruiter`, `particulier`, `admin`, `agent`, `talent`. `src/lib/roles.ts` maps each to its home path. Adding a role means updating the Prisma enum, `src/types`, `roles.ts`, the sidebar/tab bar, and route guards on both sides.

`src/App.tsx`: auth pages (`/connexion`, `/inscription`, `/inscription-talent`, `/verification-email`) render full-screen outside `Layout`. Everything else is inside `Layout`, wrapped in `ProtectedRoute role=...`, which waits for `hydrated`, redirects visitors to `/connexion` and wrong-role users to their own home. `/`, `/offres/:id`, `/annuaire` and `/annuaire/:id` are public. `ProtectedRoute` is UX only — the server guards are the real access control.

`Layout` picks the shell from `currentUser`, not the route: logged in → `AppShell` (sidebar + right rail + tab bar), logged out → `Header`/`Footer`. Check a public page in both states when changing its layout.

Registration is two-step: verify the email first (4-digit code or emailed link via `/api/verification/*`, `EmailVerificationModal` polls status), then `POST /auth/register` consumes the single-use `verificationToken`. No unverified account ever exists in the DB.

### Product invariants enforced in code

These are deliberate product decisions, not incidental behaviour — preserve them on both client and server:

- **OffRec is the intermediary (decisions 2026-09-02 and 2026-10-08).** Candidates and recruiters never contact each other directly, and candidates no longer apply offer by offer: they upload a CV and give one global, timestamped, revocable consent (`CandidateProfile.matchingConsentAt`, `POST`/`DELETE /auth/profile/candidate/matching-consent`), which replaces per-offer interest. A `MatchSuggestion` is created by the matching engine (`server/src/lib/matching.ts`, `origin: systeme`) or by an admin (`admin-matching.routes.ts`, `origin: admin`) — never by a candidate or recruiter. The engine scores with the unchanged `scoreOpportunity()` on the confirmed profile, requires at least one shared skill, and applies the hybrid rule: score ≥ `MATCH_AUTO_THRESHOLD` (80) **and** a human-verified CV → created directly as `proposee_recruteur`; otherwise score ≥ `MATCH_THRESHOLD` (60) → `suggeree`, waiting for admin validation. Status chain: `suggeree → proposee_recruteur → interet_recruteur → mise_en_relation` (or `ecartee`); `proposee_candidat` and `interet_candidat` are legacy values, never produced any more but still valid on existing rows — see `ADMIN_ALLOWED_TRANSITIONS`. The server re-checks consent before every move to `proposee_recruteur`; the engine only refreshes or promotes rows still `suggeree` and never reactivates an `ecartee` row. Recruiters can express interest or decline; candidates can only withdraw from a file (`/decline`) before `mise_en_relation`. The candidate is notified only at `mise_en_relation`, in-app **and** by email (`notifyUser()` in `lib/notify.ts`), never at `interet_recruteur`. The candidate feed is `mySuggestions` (files from `proposee_recruteur` onward), not the full catalogue, and the server withholds the company name there until `mise_en_relation`. Messaging is blocked for candidates and restricted to recruiter ↔ admin, server-side (`assertConversationAccess`).
- **ATS preselection per offer is a layer above `scoreOpportunity()`, never a new score.** `preselect()` in `server/src/lib/preselection.ts` (pure, no DB, no AI) applies knock-out filters in a fixed order (offer open, active account, consent, CV, not already `ecartee`, at least one shared skill, score ≥ `MATCH_THRESHOLD`, plus the admin's optional filters), then ranks by score and deterministic tie-breaks, and keeps the top 5 or 10; the weights are untouched. Skills found by AI in the CV (`cvSkillsSuggested`) surface only as a displayed hint (`cvHintSkills`, admin-only) — never in the score, filters or ranking. The admin transmits a selection in bulk (`POST /admin/matching/opportunities/:id/preselection/transmit`), which recomputes the preselection server-side and goes through `applyAdminTransition()` — the single implementation shared with the unit PATCH — and never reactivates an `ecartee` row. That module also holds the one definition of eligibility used by the matching engine.
- **A `TalentProfile` is only ever created and edited by an agent (§7.3.14).** `TalentLead` (self-service request) and `SourcingLead` (signal spotted by an agent) are never profiles themselves. The `talent` login role (`TalentAccountProfile`) is a read-only tracking account. Verification uses the standardised per-trade checklists in `src/data/verificationGrids.ts` (§7.3.15), and each `TalentVerification` is appended, never overwritten.
- **CV upload never auto-applies to the profile.** `POST /auth/profile/candidate/cv` extracts text with `pdf-parse`, structures it via Gemini (`lib/cv-extraction.ts`), rejects the CV if its name contradicts the profile (a different email or phone is only a flag), and stores results in `cv*` columns as suggestions the candidate confirms in the UI. The upload may carry the matching consent (`matchingConsent=true`; omitting it never withdraws an existing consent) and triggers the matching engine, which still scores the confirmed profile only — never the `cv*` columns — so matching works identically without `GEMINI_API_KEY`.
- **Billing and success fee are declarative.** `Transaction` is a simulated payment; `Placement.stage` is tracked manually. Prices come from `SubscriptionPlan` rows, never hardcoded in the frontend.
- **Moderation escalates** warning → restriction → suspension → ban (`UserStatus`), driven by `Report` + `ModerationAction`.
- `Sector` is a cross-cutting filter tag, not a navigation section and not a matching constraint.

### Trust engine (`src/lib/trust.ts`)

Runs on both sides (server computes rankings and enforces rules in `directory.routes.ts`; the client recomputes from `/directory/raw` for display). `evaluateProvider()` does **not** average stars — each `Recommendation` is weighted by proof strength (`facture` > `photo` > `aucune`), job recency, the author `Member`'s reliability, and peer confirmations. `rankProviders()` additionally pulls toward a Bayesian prior for sort order only; the displayed score is always the real weighted average. The `reasons`/`warnings` arrays are user-facing explanations — keep them consistent with any weighting change.

Anti-abuse rules (`canRecommend()` / `eligibleRecommendations()`, plus DB unique constraints): one recommendation per member per provider, no counting recommendations from a provider who claimed their own listing, no self-confirmation, no recommendation deletion.

`User` (auth account) and `Member` (community identity carrying directory reputation) are distinct. A `Member` is created lazily by `getOrCreateMember()` on first contribution; the district declared at the latest contribution wins. `currentUser.memberId` is `null` until then.

Real names and private phone numbers of members must never reach seeds, public directory data, or the UI — a hard privacy rule from field-data collection (`collecte/GUIDE-COLLECTE.md`).

### Opportunity matching (`src/lib/recommendation.ts`)

`scoreOpportunity()` returns a 0–100 score plus user-facing reasons from fixed weights (skills 0.4, location 0.25, level 0.15, type 0.15, availability 0.05). The server uses it to build the admin's candidate pool and the recruiter shortlist. It is independent of the trust engine — don't conflate the two.

### UI conventions

- Components and pages pair a `.tsx` with a same-named `.css` (plain CSS; no Tailwind or CSS-in-JS). Pages within one area often share a stylesheet (e.g. `pages/auth/Auth.css`).
- Reuse `src/components/ui/` primitives and the `framer-motion` wrappers in `src/components/motion/Motion.tsx` rather than adding ad hoc variants.
- UI text is French; amounts are in Ariary (`src/lib/format.ts`). Domain identifiers mix English and French (`pricePaid`, `annuaire`, `mise_en_relation`) — match existing terms when extending the model.

## Deployment and git

Production is a VPS at `offrec.qualitec.mg`: the frontend `dist/` is served by nginx in a container (`Dockerfile.web`, `nginx.prod.conf`, `docker-compose.prod.yml` behind Traefik), which proxies `/api/` and `/uploads/` to the Express process on the host at port 4000. `server/uploads/` (candidate CVs) is gitignored and must persist across deploys.

Branches: `collab` is the integration branch (PR target); `update` is the branch the VPS handoff deploys. Never commit `.env` files, `server/uploads/`, `collecte/sortie/`, or personal data from field collection.
