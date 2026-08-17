---
name: offrec-ceo-strategy
description: Make evidence-led CEO, product, go-to-market, pitch, partnership, pricing, KPI, risk, or investment decisions for OffRec. Use when an agent works on OffRec's strategy, brand identity, roadmap, business model, hackathon preparation, market research, investor materials, or any feature that may change the product's positioning.
---

# OffRec CEO Strategy

> Mirrored at `skills/offrec-ceo-strategy/SKILL.md` (discovered by Codex) and
> `.claude/skills/offrec-ceo-strategy/SKILL.md` (discovered by Claude Code) so
> either agent finds it through its own convention. Edit both copies together
> — only the reference paths below differ between them.

Use this skill to keep product, business, social impact and pitch work aligned.
Read `AGENTS.md` first. Then choose only the needed reference:

- Market evidence, sources and claims: `../../../skills/offrec-ceo-strategy/references/madagascar-market.md`.
- Strategic direction and execution targets: `../../../STRATEGIE_OFFREC_2026.md`.
- Product scope and delivery criteria: `../../../CAHIER_DES_CHARGES.md`.

## Non-negotiable positioning

Position OffRec as a **mobile-first trust infrastructure for local work**, not
as a generic job board or a paid ranking directory. Start with the construction
and home-improvement value chain in Greater Antananarivo. The opportunity feed
supports the same local-work network; it must not dilute the initial wedge.

Protect the public trust score: never sell a better score, a higher organic
rank, removal of a negative review, or access to personal contributor data.

## Repo-specific factual guardrails

Check these before any claim in a pitch, a README, UI copy, or an investor
conversation — they are the most likely ways an agent unintentionally
overstates what OffRec actually does today:

- `src/data/constants.ts`'s `STATS` object (`opportunities: 240, candidates:
  1800, recruiters: 120, provinces: 6`) is a **static placeholder** that only
  feeds the landing page's stat cards. It is not derived from real usage.
  Never cite these numbers as traction, adoption, or a current user base.
- There is no shared backend: `VITE_USE_SUPABASE` is declared but not read
  anywhere in `src/`. Every visitor's data lives only in their own browser's
  `localStorage`. Never claim multi-device persistence, a shared dataset, or
  a live production user base exists today.
- The seeded accounts (`candidat@demo.mg`, `recruteur@demo.mg`) and the
  providers/recommendations in `src/data/seed.ts` /
  `src/data/seedDirectory.ts` are demo fixtures for a jury walkthrough, not
  real members or real chantiers. Do not present them as market validation.
- Market-size and informality statistics are sourced with a date in
  `../../../skills/offrec-ceo-strategy/references/madagascar-market.md`;
  re-verify a figure at its cited URL before it goes into a live pitch, and
  refresh any source older than six months.

## Decision workflow

1. State the user, problem, geographic scope and decision to make in one sentence. Separate a fact, a validated learning, an assumption and a target.
2. Test strategic fit: does it increase verified supply, trustworthy demand, successful matches, or operational quality in the initial pilot?
3. Check feasibility for low-connectivity, mobile-first use. Avoid a feature whose value depends on continuous data, expensive devices or a large moderation team from day one.
4. Preserve domain invariants in `AGENTS.md`: proof-aware scoring, one review per member/provider, no self-confirmation and no review deletion.
5. Specify one leading KPI, one guardrail and an owner. Define the smallest pilot that can falsify the assumption within 30 days.
6. For any number pulled from this codebase or a pitch draft, first rule out that it is one of the placeholders above; for external market claims, browse primary or credible sources and cite the date/source. Do not turn estimates into facts.
7. End every proposal with: decision, why now, cost/risks, next experiment and kill/iterate threshold.

## Investor and jury standard

Make the argument in this order: painful local problem → narrow beachhead →
working proof mechanism → repeatable acquisition → revenue that does not
corrupt trust → measurable impact → credible execution plan. Demonstrate the
prototype rather than claiming unbuilt integrations.

When challenged on the two product areas, explain the sequence: the trust
directory is the initial monetisable wedge; local work opportunities become a
retention and liquidity layer after trust and supply density are demonstrated.

## Required outputs by task

| Task | Minimum deliverable |
| --- | --- |
| Feature idea | User problem, hypothesis, acceptance criteria, KPI, risk. |
| Market/pitch claim | Source, date, interpretation, limitation. |
| Partnership | Partner value exchange, data boundaries, pilot offer, owner. |
| Revenue proposal | Payer, price assumption, unit economics, trust guardrail. |
| Roadmap | Outcome, dependency, effort band, 30/60/90-day milestone. |
| Pitch/rehearsal | One-line answer, evidence, demo proof, honest limitation. |

Never invent adoption, revenue, partnership, impact or technical completion.
Label projections and validate them in the field.
