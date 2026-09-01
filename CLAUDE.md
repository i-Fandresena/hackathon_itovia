# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OffRec — hackathon prototype (React 19 + TypeScript + Vite) for a Madagascar jobs/opportunities platform, in French. Two products in one app:

- **Portail d'opportunités** (`/candidat`, `/recruteur`) — job board with a scoring engine that ranks opportunities for a candidate profile.
- **Annuaire de confiance** (`/annuaire`) — a trust-scored directory of local service providers (construction trades in Antananarivo), where members publish recommendations tied to real jobs.

All state currently lives in `localStorage` (no backend wired up yet — see Data layer below).

`AGENTS.md` is the cross-tool collaboration doc (French) and, per its own text, takes precedence over this file if the two ever disagree — check it too, especially for collaboration/delivery discipline (git hygiene, what must never be committed). `CAHIER_DES_CHARGES.md` is the product spec. For product/strategy/pitch/roadmap decisions, use the `offrec-ceo-strategy` skill rather than improvising.

## Commands

```bash
npm install
npm run dev       # start Vite dev server (usually http://localhost:5173)
npm run build     # tsc --noEmit && vite build — this is also the type-check/lint step, run it before considering a task done
npm run preview   # preview the production build
```

There is no test suite and no ESLint config in this repo — `npm run build` (which runs `tsc --noEmit`) is the only automated correctness check available.

Demo accounts (seeded, see `src/data/seed.ts`):
| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Candidat | `candidat@demo.mg` | `demo123` |
| Recruteur | `recruteur@demo.mg` | `demo123` |

Node 22.x is required (see `.nvmrc` / `engines` in `package.json`) — Vite 8 and `@vitejs/plugin-react` 6 need it.

## Architecture

### Data layer: single context, no backend

`src/context/AppContext.tsx` is the entire data layer: one `AppProvider` holding all app state (users, opportunities, applications, bookmarks, notifications, members, providers, recommendations) in a single `useState`, persisted to `localStorage` under key `offrec_app_state_v1` via `src/lib/storage.ts`. There is no API layer, no React Query, no server — every mutation is a synchronous state update inside `AppContext.tsx` exposed through `useApp()`.

`supabase/schema.sql` and `DEPLOYMENT.md` describe a planned Supabase migration (Postgres + Auth) for shared data across users, but **it is not implemented in `src`** — `VITE_USE_SUPABASE` is not read anywhere in the code yet. When working on persistence, assume localStorage-only unless asked to build the Supabase integration.

Two identity concepts are distinct and easy to conflate:
- **`User`** — the auth account (email/password, role `candidate` | `recruiter`), created via `register`/`login`.
- **`Member`** — the community identity that carries directory reputation (`src/types/index.ts`). One `User` maps to exactly one `Member` via `memberIdFor(userId)` in `AppContext.tsx`; members are upserted lazily the first time a user adds a provider or recommendation, capturing whatever district they declared at that moment.

Routing (`src/App.tsx`) nests almost every route under `ProtectedRoute` (`src/components/layout/ProtectedRoute.tsx`), which redirects unauthenticated users to `/connexion` and cross-role users to their own dashboard. The directory (`/annuaire`, `/annuaire/:id`) is deliberately public for browsing; only publishing a recommendation requires auth.

`src/components/layout/Layout.tsx` swaps the entire shell based on auth state: logged-in users get `AppShell` (three-column layout with sidebar + right rail), logged-out users get a simple `Header`/`Footer` shell. Keep this in mind when adding pages — which shell you land in depends on whether `currentUser` is set, not on the route itself.

### Trust engine (`src/lib/trust.ts`)

The core differentiator of the directory. `evaluateProvider()` does **not** average star ratings — it computes a weighted score per provider where each `Recommendation`'s weight depends on:
- proof strength (`facture` > `photo` > `aucune`, via `PROOF_FACTOR`),
- recency of the job (`recencyFactor` — decays after 6 months, floors at 24),
- the author's `Member` reliability (`memberReliability` — phone verification, account age, history, confirmation rate from other members),
- number of peer confirmations on that recommendation.

`rankProviders()` (used for directory sort order) further pulls scores toward a Bayesian prior (`PRIOR_SCORE`/`PRIOR_WEIGHT`) so a single 5★ review can't outrank a well-confirmed 4.4★ — but the *displayed* score from `evaluateProvider()` is always the real weighted average, never the prior-adjusted one.

Anti-abuse invariants enforced in `canRecommend()` / `eligibleRecommendations()` and mirrored in `supabase/schema.sql` for when a real backend lands:
- one recommendation per member per provider (`eligibleRecommendations()` also dedupes to the most recent per author, as a read-side backstop),
- a provider that has "claimed" its own listing (`claimedByMemberId`) cannot have its own recommendations counted,
- no self-confirmation, no recommendation deletion.

If you touch scoring, `evaluateProvider()`'s `reasons`/`warnings` arrays are user-facing explanations of the score — keep them consistent with whatever weighting logic changes.

Real names and private phone numbers of members must never reach seeds, public directory data, or the UI — this is a hard privacy rule from the field-data collection process (`collecte/GUIDE-COLLECTE.md`, `collecte/import-collecte.mjs`), not just a style preference.

### Opportunity matching (`src/lib/recommendation.ts`)

`scoreOpportunity()` produces a `MatchResult` (0–100 score + reasons) per candidate/opportunity pair from weighted sub-scores (skills 0.4, location 0.25, level 0.15, type 0.15, availability 0.05, hardcoded in the function). `rankOpportunities()` sorts a candidate's feed by this score. This is independent from the trust engine above — don't conflate the two scoring systems.

### UI conventions

- Every component under `src/components/**` and `src/pages/**` pairs a `.tsx` with a same-named `.css` file (plain CSS, no CSS-in-JS/Tailwind) — follow that pattern for new components.
- `src/components/motion/Motion.tsx` wraps `framer-motion` page/element transitions (e.g. `PageMotion` used in `Layout.tsx`) — reuse these wrappers rather than adding ad hoc animation.
- `src/components/ui/` holds generic primitives (Button, Card, Badge, Form, EmptyState, Loading, MatchScore); `src/components/opportunity/` and `src/components/provider/` hold feature-specific presentational components (e.g. `TrustBadge` renders a `TrustResult`, `OpportunityCard` renders a `ScoredOpportunity`).
- French is the UI language and the convention in code comments/domain naming (`jobLabel`, `pricePaid`, but also French terms like `annuaire`, `prestataire` show up in identifiers) — match existing terminology when extending the domain model rather than mixing in English naming.
