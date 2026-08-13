-- OffRec — schéma initial pour Supabase (PostgreSQL)
-- Exécuter dans : Supabase Dashboard → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- Profils liés à auth.users (Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('candidate', 'recruiter')),
  email text not null,
  full_name text,
  company_name text,
  phone text,
  province text,
  city text,
  profile_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  company_name text not null,
  title text not null,
  category text not null,
  description text not null,
  province text not null,
  city text not null,
  opportunity_type text not null,
  required_skills text[] not null default '{}',
  level text not null,
  deadline date not null,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  message text,
  created_at timestamptz not null default now(),
  unique (opportunity_id, candidate_id)
);

create table if not exists public.bookmarks (
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidate_id, opportunity_id)
);

alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.applications enable row level security;
alter table public.bookmarks enable row level security;

-- Lecture publique des offres (prototype / catalogue)
create policy "opportunities_select_all"
  on public.opportunities for select
  using (true);

-- Recruteur : CRUD sur ses offres
create policy "opportunities_insert_own"
  on public.opportunities for insert
  with check (auth.uid() = recruiter_id);

create policy "opportunities_update_own"
  on public.opportunities for update
  using (auth.uid() = recruiter_id);

create policy "opportunities_delete_own"
  on public.opportunities for delete
  using (auth.uid() = recruiter_id);

-- Profils : chacun lit/écrit le sien
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_upsert_own"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Candidatures
create policy "applications_select_involved"
  on public.applications for select
  using (
    auth.uid() = candidate_id
    or auth.uid() in (
      select recruiter_id from public.opportunities o
      where o.id = opportunity_id
    )
  );

create policy "applications_insert_candidate"
  on public.applications for insert
  with check (auth.uid() = candidate_id);

-- Favoris
create policy "bookmarks_own"
  on public.bookmarks for all
  using (auth.uid() = candidate_id)
  with check (auth.uid() = candidate_id);

-- ---------------------------------------------------------------------------
-- Annuaire de confiance
-- ---------------------------------------------------------------------------

-- Identité communautaire : c'est elle qui porte la réputation, pas le compte
-- d'authentification. Un compte = un membre (contrainte d'unicité sur user_id).
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null,
  district text not null,
  city text not null default 'Antananarivo',
  phone_verified boolean not null default false,
  joined_at timestamptz not null default now()
);

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade text not null,
  description text not null default '',
  district text not null,
  city text not null default 'Antananarivo',
  province text not null default 'Antananarivo',
  phone text not null,
  whatsapp text,
  added_by_member_id uuid not null references public.members (id) on delete restrict,
  -- Renseigné quand le prestataire revendique sa fiche ; ses propres retours
  -- sont alors exclus du score par le moteur de confiance.
  claimed_by_member_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists providers_trade_idx on public.providers (trade);
create index if not exists providers_district_idx on public.providers (district);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  author_member_id uuid not null references public.members (id) on delete cascade,
  author_district text not null,
  rating smallint not null check (rating between 1 and 5),
  would_use_again boolean not null,
  job_label text not null check (char_length(job_label) >= 8),
  -- Date du travail réel, distincte de la date de publication. Une
  -- recommandation sans chantier daté n'est pas exploitable.
  job_date date not null check (job_date <= current_date),
  price_paid integer check (price_paid > 0),
  price_unit text,
  comment text not null check (char_length(comment) >= 40),
  proof text not null default 'aucune' check (proof in ('facture', 'photo', 'aucune')),
  proof_url text,
  created_at timestamptz not null default now(),
  -- Verrou anti-gonflage : un membre ne peut publier qu'un seul retour par
  -- prestataire. Pour corriger son avis, il met à jour le sien.
  unique (provider_id, author_member_id),
  -- Un prix sans unité n'a pas de sens.
  constraint price_needs_unit check (price_paid is null or price_unit is not null)
);

create index if not exists recommendations_provider_idx
  on public.recommendations (provider_id);

-- « J'ai eu la même expérience » : confirmation d'un retour par un autre
-- membre. La clé primaire empêche de confirmer deux fois.
create table if not exists public.recommendation_confirmations (
  recommendation_id uuid not null references public.recommendations (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recommendation_id, member_id)
);

alter table public.members enable row level security;
alter table public.providers enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_confirmations enable row level security;

-- Le membre correspondant au compte connecté.
create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.members where user_id = auth.uid();
$$;

-- L'annuaire est public : chercher un artisan ne demande pas de compte.
-- C'est la porte d'entrée du produit, et ce qui le rend indexable.
create policy "members_select_all" on public.members for select using (true);
create policy "providers_select_all" on public.providers for select using (true);
create policy "recommendations_select_all" on public.recommendations for select using (true);
create policy "confirmations_select_all"
  on public.recommendation_confirmations for select using (true);

create policy "members_write_own"
  on public.members for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Contribuer demande un compte : toute écriture est rattachée à un membre.
create policy "providers_insert_member"
  on public.providers for insert
  with check (added_by_member_id = public.current_member_id());

create policy "providers_update_owner"
  on public.providers for update
  using (
    added_by_member_id = public.current_member_id()
    or claimed_by_member_id = public.current_member_id()
  );

-- Pas d'auto-recommandation sur une fiche revendiquée.
create policy "recommendations_insert_own"
  on public.recommendations for insert
  with check (
    author_member_id = public.current_member_id()
    and public.current_member_id() is distinct from (
      select claimed_by_member_id from public.providers p where p.id = provider_id
    )
  );

-- On peut corriger son propre retour, jamais celui d'un autre. Aucune
-- politique de suppression : un prestataire ne doit pas pouvoir faire
-- disparaître un avis négatif, et l'auteur non plus sur simple pression.
create policy "recommendations_update_own"
  on public.recommendations for update
  using (author_member_id = public.current_member_id())
  with check (author_member_id = public.current_member_id());

-- On ne confirme pas son propre retour.
create policy "confirmations_insert_other"
  on public.recommendation_confirmations for insert
  with check (
    member_id = public.current_member_id()
    and public.current_member_id() is distinct from (
      select author_member_id from public.recommendations r where r.id = recommendation_id
    )
  );

create policy "confirmations_delete_own"
  on public.recommendation_confirmations for delete
  using (member_id = public.current_member_id());
