# VELOCITY ISLAND (جزيرة السرعة)

A 3D arcade kart racer with an original "Tropical Future Arcade" identity —
8 vehicles, 6 tracks, 9 power-ups, AI bots, and authoritative online
multiplayer. Arabic-first (RTL) with full English support.

Everything is procedurally generated at runtime: vehicle models, tracks,
environments, and audio are built from code (Three.js primitives/geometry
and the WebAudio API) rather than shipped as external assets.

## Stack

- **Client** — TypeScript, Vite, Three.js, Rapier3D physics (`@dimforge/rapier3d-compat`)
- **Server** — Node.js, Fastify (REST), Colyseus (authoritative race rooms), Prisma/PostgreSQL, Redis
- **Shared** — `packages/shared`: types, Zod validators, and every gameplay number (balance data)

```
apps/client/          Vite + Three.js game client
apps/server/           Fastify + Colyseus backend
packages/shared/       Shared types, validators, and balance/*.json
database/prisma/       Prisma schema, migrations, seed script
tests/unit/            Vitest unit tests
tests/integration/     Vitest integration tests
tests/e2e/             Playwright end-to-end tests
```

## Prerequisites

- Node.js >= 20
- Docker + Docker Compose (recommended), **or** a local PostgreSQL 16 and Redis instance

## Quick start (Docker Compose)

This is the easiest way to run the whole stack (Postgres, Redis, migrations, server, client):

```bash
cp .env.example .env
# Edit .env and set real JWT_ACCESS_SECRET / JWT_REFRESH_SECRET for anything beyond local use:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

docker compose up --build
```

- Client: http://localhost:8080
- Server (REST + WebSocket): http://localhost:2567

`docker compose up` runs Postgres and Redis, applies Prisma migrations and
seeds the database once (the `migrate` service), then starts the server and
client. Note: the Docker artifacts (`docker-compose.yml`, the two
`Dockerfile`s, `nginx.conf`) were written to the same spec as the rest of
the project but the sandbox this was built in has no Docker daemon, so they
could not be build-tested here — please report any image build issues.

## Running without Docker

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL and Redis

Use your own local instances, or run just the data services from compose:

```bash
docker compose up postgres redis
```

### 3. Configure environment

```bash
cp .env.example .env
```

For a non-Docker Postgres/Redis, point `DATABASE_URL` and `REDIS_URL` at
`localhost` instead of the `postgres`/`redis` service hostnames, e.g.:

```
DATABASE_URL=postgresql://velocity:velocity@localhost:5432/velocity_island
REDIS_URL=redis://localhost:6379
```

The server reads its environment from real process env vars (see
`apps/server/src/env.ts`), so either export the `.env` file's contents into
your shell (`set -a && source .env && set +a`) or use a tool like
`dotenv-cli` before running server commands.

### 4. Set up the database

```bash
npm run prisma:generate
npm run prisma:migrate     # creates/updates tables from database/prisma/schema.prisma
npm run prisma:seed        # seeds reference data
```

### 5. Run the server and client (two terminals)

```bash
npm run dev:server   # Fastify + Colyseus on :2567
npm run dev:client   # Vite dev server on :5173
```

Open http://localhost:5173.

## Creating an account

The game works immediately as a guest (progress saved to `localStorage`
only). To back up progress to the server:

1. Open **Settings** → **Account**.
2. Fill in email, password, and a display name, then **Save Account (Guest → Email)**
   to upgrade the current guest profile, or **Sign In** if you already have
   an account.

This calls the server's `/auth/register`, `/auth/login`, and `/auth/upgrade`
REST endpoints (Argon2id-hashed passwords, JWT access + rotated refresh
tokens).

## Multiplayer

Toggle **ONLINE** on the Play screen for Quick Race / Ranked matchmaking, or
use **Private Lobby** to create a room and share its 6-character code, or
join one. Online races are relayed through an authoritative Colyseus room
(`apps/server/src/rooms/RaceRoom.ts`) that validates checkpoint order and
timing plausibility and owns final results/rewards.

**Scope note:** the server is authoritative for checkpoint/lap sequencing,
timing-plausibility anti-cheat, and race results — it does not run a full
server-side physics replica of every car. Each client remains
physics-authoritative for its own vehicle (for responsive local driving
feel); other players are rendered as interpolated "ghosts" from periodic
position reports. This is a deliberate scope boundary, not an oversight —
see the comments at the top of `RaceRoom.ts`.

## Editing gameplay balance

No gameplay numbers live in TypeScript. Every tunable value — vehicle
stats, track lengths, power-up effects, XP/coin curves, achievement
thresholds — lives in `packages/shared/src/balance/*.json`:

```
achievements.json   economy.json   powerups.json
races.json           tracks.json    vehicles.json   weapons.json
```

Edit the JSON, then rebuild the shared package (`npm run build:shared`) or
just restart the dev servers — both `apps/client` and `apps/server` import
these values through `@velocity-island/shared`.

## Tests

```bash
npm run test          # Vitest: unit + integration (tests/unit, tests/integration)
npm run test:watch    # Vitest watch mode
npm run typecheck      # TypeScript across all workspaces
npm run lint            # ESLint
```

### End-to-end tests

```bash
npm run dev:server                     # server must be running (real DB)
npm run test:e2e                       # Playwright drives the real client against it
```

`playwright.config.ts` auto-starts the client dev server for you if it
isn't already running. The golden-path spec
(`tests/e2e/golden-path.spec.ts`) covers registration → garage vehicle
selection → track/lap setup → starting a race → live HUD/physics → pause/quit
→ reload persistence, against the real server and database.

It deliberately does not drive a full lap to the finish line: doing that
with literal real-time keyboard input in headless Chromium would make the
suite slow and flaky (checkpoint navigation depends on precise steering).
Full lap-completion, checkpoint-sequencing, and reward-crediting logic is
instead covered deterministically by `tests/integration/raceManager.test.ts`,
`tests/unit/checkpointValidator.test.ts`, and the achievement evaluation
logic.

## Production build

```bash
npm run build          # builds packages/shared, apps/client, apps/server in order
npm run prisma:deploy  # applies migrations without prompting (production-safe)
npm run start -w apps/server   # node apps/server/dist/index.js
```

Serve `apps/client/dist` with any static file server (the provided
`apps/client/Dockerfile` uses nginx — see `apps/client/nginx.conf` for the
required `.wasm` MIME type and SPA fallback needed for the Rapier physics
WASM bundle and client-side routing).

## Deployment

- `docker-compose.yml` is a reference deployment: Postgres + Redis + a
  one-shot migration/seed job + the server + an nginx-served client build.
- Set real secrets in `.env` before deploying anything beyond local dev —
  `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` in particular.
- Point the client's `VITE_SERVER_HTTP_URL` / `VITE_SERVER_WS_URL` build
  args at your deployed server's public hostname.

## Known limitations

- Full server-authoritative physics replication is out of scope (see
  **Multiplayer** above) — the server governs race integrity and results,
  not per-frame car physics for every player.
- Docker images were written to spec but not build-tested (no Docker daemon
  was available in the environment this was built in).
- A handful of achievement metrics that require additional runtime
  telemetry beyond what's tracked today (e.g. "no braking for an entire
  race", certain combat-specific counters) are evaluated conservatively and
  documented inline in `apps/server/src/services/AchievementService.ts`
  rather than faked.
