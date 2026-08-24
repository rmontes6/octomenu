# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal weekly menu generator ("OctoMenu") supporting multiple private accounts (e.g. family members), each with their own isolated dish catalog and menus. Next.js 14 App Router + Prisma/Postgres + NextAuth credentials login. Each user maintains a catalog of dishes ("platos") they like to cook, each tagged with a course category and whether it's for lunch/dinner/both; the app randomly assembles a full week's menu from that catalog and derives a shopping list from the chosen dishes' ingredients. UI strings, labels, and dish/category names are all in Spanish — keep new user-facing text consistent with that.

Sibling project: `../trip2millionaire` (personal finance tracker), built by the same user with the same stack/conventions. Both are deployed to the same EC2 host — see "Deploying" below before touching anything infra-related.

## Product rules (already decided, don't re-litigate without asking)

- A meal slot (comida/cena on a given day) is either a single "plato único" or a "primero + segundo" (with an optional "acompañamiento" added on top). Never both structures at once.
- A dish can be flagged `yieldsTwoMeals` ("rinde para 2 tomas"): when chosen, it automatically repeats in the **same meal type** (comida→comida, cena→cena) on the **next day**, without re-rolling. It never propagates more than one extra day.
- The generator never repeats a dish within the same generated week (except the automatic "rinde 2 tomas" copy, which is the same dish by design, not a new pick).
- Any single meal slot can be individually re-rolled without touching the rest of the week.
- The shopping list is derived, not hand-maintained: it's the sum of ingredients from that week's chosen dishes.

## Commands

```bash
npm run dev              # next dev (expects DATABASE_URL etc. already available, e.g. via scripts/dev.sh)
./scripts/dev.sh          # full local bootstrap: starts Postgres in Docker, creates .env from .env.example
                           # with generated secrets if missing, npm install if needed, prisma generate,
                           # prisma migrate deploy, seed, then `next dev` with hot reload — the normal way
                           # to start working on this repo from a clean checkout
npm run build             # next build
npm run start             # next start (production server, after build)
npm run lint              # next lint (NOTE: build itself has eslint.ignoreDuringBuilds = true in next.config.js,
                           # so lint is NOT run as part of npm run build; there's also no committed ESLint
                           # config yet — `next lint` will prompt to create one interactively)
npm run prisma:generate   # prisma generate
npm run prisma:deploy     # prisma migrate deploy (applies pending migrations, no prompts — used in dev/deploy)
npm run seed              # tsx prisma/seed.ts
```

There is no test suite in this repo (no test runner configured). Don't invent one unless asked.

To create a new migration during schema changes, use `npx prisma migrate dev --name <description>` (not `prisma:deploy`, which only applies existing ones).

### Deploying

`./scripts/deploy.sh` builds the Docker image **locally**, saves it as a tarball, and ships it to the host defined by `DEPLOY_HOST`/`DEPLOY_PATH` in `.env` — the remote server never receives source, only the built image plus `compose.yml`, `Caddyfile` and `.env`. This is a real, user-facing action (SSHes to a remote host and starts services) — treat it like any other deploy and don't run it without the user asking. As of this writing the user has explicitly said **not** to deploy yet ("trabajaremos solo en DEV").

**Infra constraint — read before touching anything Docker/Caddy-related:** OctoMenu shares its EC2 host (`nubito`) with the already-live `trip2millionaire`, which already owns host ports 80/443 with its own Caddy (real Let's Encrypt cert). OctoMenu deliberately runs its **own, fully isolated** stack instead of sharing that Caddy: its own Postgres (host port 5433 in dev via `DB_PORT`), its own Caddy on `CADDY_PORT` (default 8443). Caddy serves **plain HTTP** for now (no `tls` directive — the user decided to defer TLS rather than deal with `tls internal`'s self-signed-cert browser warning; Let's Encrypt can't issue a real cert outside 80/443 anyway since those are owned by trip2millionaire). Requires an inbound rule for `CADDY_PORT` (TCP, `0.0.0.0/0`) in the EC2 Security Group — plain HTTP means login credentials and session cookies travel unencrypted, an accepted tradeoff for this single-user personal app. This isolated-stack approach was a deliberate tradeoff the user chose (isolation over the RAM/cert benefits of a shared host-level Caddy) specifically to avoid modifying trip2millionaire's working deploy. **Do not** "fix" this by refactoring trip2millionaire's `compose.yml`/Caddy setup, merging the two Caddy configs, or reintroducing `tls internal`, unless the user explicitly reopens that decision.

## Architecture

**Auth**: NextAuth with a single `CredentialsProvider` (`src/lib/auth.ts`) checking `username`/bcrypt hash against the `User` table. `User.isAdmin` (plain boolean, same pattern as trip2millionaire) gates the users panel: any authenticated user can reset their own password, only an admin can create users, reset others' passwords, or delete accounts. JWT session strategy, 30-day maxAge; `isAdmin` is propagated onto the JWT/session in the `jwt`/`session` callbacks. `src/middleware.ts` gate-keeps everything except `/api/auth`, `/login`, and static assets, redirecting unauthenticated visits to `/login`. Server-side handlers get the current user via `requireUserId()` (`src/lib/session.ts`), which returns `null` (not a throw) when unauthenticated — every API route must check it and return 401 explicitly; there's no shared middleware wrapper for this. `isAdminUser(userId)` (also in `session.ts`) re-queries the DB fresh on every call rather than trusting the JWT claim, so admin revocation takes effect immediately. Every `Dish`/`WeeklyMenu` is owned by exactly one `User` (`onDelete: Cascade`) and every query/mutation in the API layer and `menuService.ts` is scoped by the caller's `userId` — catalogs and menus are private per account, not shared.

**Data model** (`prisma/schema.prisma`):

- `Dish` — owned by a `userId` (`@@index([userId, category, mealType, active])`), `category` (`PLATO_UNICO`/`PRIMERO`/`SEGUNDO`/`ACOMPANAMIENTO`), `mealType` (`COMIDA`/`CENA`/`AMBAS`), `yieldsTwoMeals`, `active` (the "no disponible ahora" toggle — inactive dishes are excluded from generation but not deleted), plus `DishIngredient[]` (free-text `name` + optional `quantity`/`unit`, no shared ingredient master table — quantities are per-dish, aggregated at shopping-list time by normalized name+unit).
- `WeeklyMenu` — one row per week per user, `@@unique([userId, weekStart])` (`weekStart` a `@db.Date`, always the Monday of that week).
- `MenuEntry` — one row per filled slot: `dayOfWeek` (0=Monday..6=Sunday), `mealType` (`COMIDA`/`CENA`), `slot` (which `DishCategory` this entry occupies), `dishId`, and a self-relation `leftoverOf`/`leftoverOfId` linking a "rinde 2 tomas" copy back to the original entry it was carried over from (`onDelete: Cascade`, so deleting the original also deletes its copy). `@@unique([weeklyMenuId, dayOfWeek, mealType, slot])`.
- `ShoppingListCheck` — persisted checked/unchecked state per `(weeklyMenuId, itemKey)`, independent of the computed shopping list itself, so ticking items off survives a reroll or regeneration as long as the ingredient's key doesn't change.

**Date handling**: `src/lib/dates.ts` implements `parseDateOnly`/`formatDateOnly`/`mondayOf`/`addDaysUTC`/`dayLabel` using **native `Date` UTC methods only** (`getUTCDay`, `setUTCDate`, `toISOString().slice(0,10)`), deliberately avoiding `date-fns`'s default local-time-based functions (`startOfWeek`, `addDays`, etc.) and avoiding local-time `Date` getters. This was a conscious choice to keep "which Monday is this" stable regardless of the server's timezone — don't reintroduce local-time date math for week/day calculations, and don't add `date-fns` back for this without preserving that UTC-safety.

**Menu generation** (`src/lib/menuGenerator.ts`): `generateWeek(dishes, rng?)` is a **pure function** (no DB access, injectable RNG) that walks the 7 days × {COMIDA, CENA} in order and, per slot: (1) fills it from a carried-over "rinde 2 tomas" dish if one is pending from the previous day, else (2) picks a structure (plato único vs. primero+segundo, degrading to primero-only/segundo-only if the catalog can't fill both, or leaving the slot empty if nothing fits) constrained to dishes not yet used this week, (3) optionally adds an acompañamiento (~50% chance when available), (4) if the chosen dish(es) have `yieldsTwoMeals`, schedules the same dish for the identical slot on day+1. It returns a flat list of `PlannedEntry` with a `sourceKey`/`entryKey()` composite (`${day}-${mealType}-${slot}`) so the DB layer can link leftover copies to their originals after insert.

`src/lib/menuService.ts` is the DB-aware layer on top: every exported function (`getWeeklyMenu`, `getWeeklyMenuById`, `createWeeklyMenu`, `rerollEntry`) takes `userId` as its first argument and scopes/verifies ownership before reading or mutating anything — `getWeeklyMenuById` returns `null` if the menu exists but belongs to someone else (indistinguishable from not existing), and `rerollEntry` checks the target `WeeklyMenu.userId` up front, before touching any entry, since an `entryId`/`weeklyMenuId` pair alone proves nothing about the caller. `createWeeklyMenu(userId, weekStart, force)` deletes any existing menu for that week when `force` is true, then inserts inside a `$transaction` in two passes — originals first (to get real ids), then leftover copies referencing the resolved `sourceId`. `rerollEntry(userId, weeklyMenuId, entryId)` re-picks a dish for one slot, excluding dishes already used elsewhere that week; if the target entry **is** a leftover copy, it recurses to reroll the original instead (copies aren't independently editable); after rerolling the original it updates/creates/deletes the linked leftover copy depending on whether the new dish still yields two meals and whether the next-day slot is free.

**Shopping list** (`src/lib/shoppingList.ts`): `buildShoppingList(entries)` is a pure aggregator that only looks at entries where `leftoverOfId === null` — leftover copies represent food already bought/cooked once, so they must not double the ingredients. Ingredients are grouped by `itemKeyFor(name, unit)` (trimmed, lowercased), summing `quantity` when every contributor has one; if any contributor to a group is missing a quantity (e.g. "sal" with no amount), the merged item's quantity collapses to `null` rather than silently dropping data.

**Route structure**: `src/app/(app)/` is the authenticated shell (`platos`, `menu`, `menu/compra`, `usuarios`), wrapped by `src/app/(app)/layout.tsx` (NavBar + children) — no per-route auth checks needed there since `middleware.ts` already covers it. `/login` and the root `page.tsx` (redirects to `/menu`) sit outside that group. `usuarios` has no admin-only route gating — it's a shared page, visible to everyone, with admin-only actions (create/reset-others/delete) enforced in the API layer and conditionally rendered in the UI (same "shared page, role-gated actions" pattern as trip2millionaire's `/admin`). API routes under `src/app/api/` are the only place Prisma is queried directly:

- `dishes`, `dishes/[id]` — CRUD, scoped to the caller's `userId`; `PATCH` either replaces the whole dish (including a full ingredient replace via delete-then-recreate) or, if the body is exactly `{ active }`, does a fast availability toggle.
- `weekly-menus` — `GET ?weekStart=YYYY-MM-DD` (normalizes to that week's Monday server-side), `POST { weekStart, force? }`.
- `weekly-menus/[id]/entries/[entryId]/reroll` — `POST`.
- `weekly-menus/[id]/shopping-list` — `GET` (computed list + checked state), `PATCH { itemKey, checked }`.
- `users` — `GET` (admin sees everyone, non-admin sees only their own row), `POST` (create, admin-only).
- `users/[id]` — `PATCH { password }` (reset; self or admin), `DELETE` (admin-only, blocks deleting the last remaining user).

**Client/server split**: pages are thin server components; interactive UI lives in `*Client.tsx` components (`DishesClient`, `MenuClient`, `ShoppingListClient`) marked `"use client"`, which `fetch()` the JSON API routes and manage their own loading/error state — no SWR/React Query, just `useState`/`useEffect`, matching trip2millionaire's convention.

**Theming**: unlike trip2millionaire (class/`data-theme`-based dark mode), this repo uses `darkMode: "media"` in `tailwind.config.ts` — dark mode follows `prefers-color-scheme` only, there's no manual toggle or `useIsDark` hook here. Brand color is orange (`brand`/`dbrand` in `tailwind.config.ts`, distinct from trip2millionaire's teal) so the two apps are visually distinguishable. Shared utility classes (`.card`, `.btn-primary`, `.input`) live in `src/app/globals.css`.

## Environment / secrets

Config lives in `.env` (gitignored; `.env.example` documents the shape). Key vars: `DATABASE_URL` (assembled from `POSTGRES_*` by `scripts/dev.sh`, not usually set by hand), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `SEED_USERNAME`/`SEED_PASSWORD` (used by both `prisma/seed.ts` and the Docker entrypoint to upsert the initial admin login user on startup — `isAdmin: true` is only set on first creation, never re-applied on later restarts, so a subsequent demotion via the users panel sticks), `DB_PORT`/`APP_PORT` (dev-only port overrides, chosen to not collide with trip2millionaire's defaults), `CADDY_PORT`/`DOMAIN` (deploy-only — see the infra constraint above). Never commit real values from `.env`.
