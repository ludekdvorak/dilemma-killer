# Dilemma Killer — TypeScript Edition

This is a separate, English, full-stack TypeScript version of Dilemma Killer. The original Java and JavaScript folders remain unchanged.

## Stack

- React 19 + Vite + TypeScript
- Node.js + Express + TypeScript
- PostgreSQL 16
- One npm package and one production web service
- Vitest and Supertest

Express serves both the API and the compiled React application in production. The only separate production dependency is PostgreSQL.

## Features

- Lucky Wheel and Dice Roll are free
- Card Draw is Premium
- Optional email/password accounts
- Saved player roster for signed-in users
- Demo Premium upgrade, always disabled in production
- Per-user play statistics
- Roulette, Horse Racing, and Ticking Bomb placeholders

Statistics are recorded only for successful games played while signed in. PostgreSQL stores the game type, player count, and timestamp; it does not store party-player names or game results.

## Local development

Requirements: Node.js 22.12+ and PostgreSQL. Docker is optional and is used only to provide the local database.

```bash
cd typescript-app
docker compose up -d
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite development server proxies `/api` to Express on port `8080`. The included PostgreSQL container uses host port `5433`, so it can run beside the original project's database on `5432`.

To stop the local database:

```bash
docker compose down
```

The named Docker volume keeps local data. Use `docker compose down -v` only when you intentionally want to delete that local database.

## Commands

```bash
npm run dev          # React and API development servers
npm run typecheck    # strict TypeScript checks
npm test             # unit and API tests; no database required
npm run build        # checks, tests, and production bundles
npm start            # production server; run build first
npm run db:migrate   # apply PostgreSQL migrations manually
npm run test:integration  # real PostgreSQL auth, ownership, and statistics tests
```

## Production deployment

The simplest deployment is:

1. Create one managed PostgreSQL database.
2. Create one Node.js web service with `typescript-app` as its root directory.
3. Use `npm ci --include=dev && npm run build` as the build command.
4. Use `npm start` as the start command.
5. Set the environment variables below.

Required production configuration:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=<output-of-openssl-rand-base64-48>
ALLOW_MOCK_UPGRADE=false
RUN_MIGRATIONS_ON_START=true
```

Set `DATABASE_SSL=true` if required by the database provider. Keep `DATABASE_SSL_REJECT_UNAUTHORIZED=true` when the provider supplies a trusted certificate. The server binds to `0.0.0.0` and reads the platform's `PORT` automatically.

Database migrations run at startup by default and use a PostgreSQL advisory lock, which is suitable for this small single-service deployment. A larger multi-service deployment should run `npm run db:migrate:production` as a separate release step and set `RUN_MIGRATIONS_ON_START=false`.

The included `Dockerfile` packages the same one-service production build if the hosting provider requires a container. `docker-compose.yml` is for the local database, not production deployment.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Local database on port 5433 |
| `JWT_SECRET` | JWT signing secret; required in production | Development-only value |
| `JWT_EXPIRATION_SECONDS` | Login lifetime | `604800` (7 days) |
| `PORT` | Express port | `8080` |
| `HOST` | Bind address | `0.0.0.0` |
| `DATABASE_POOL_SIZE` | Maximum PostgreSQL connections | `10` |
| `DATABASE_SSL` | Enable PostgreSQL TLS | `false` |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Verify the database certificate | `true` |
| `DATABASE_CONNECTION_TIMEOUT_MS` | Maximum wait for a database connection | `5000` |
| `DATABASE_QUERY_TIMEOUT_MS` | Maximum query duration | `15000` |
| `TRUST_PROXY_HOPS` | Trusted reverse-proxy hop count for client IP detection | `0` |
| `ALLOW_MOCK_UPGRADE` | Enable the payment-free Premium demo outside production | Always disabled in production |
| `RUN_MIGRATIONS_ON_START` | Apply committed migrations before listening | `true` |
| `VITE_BACKEND_URL` | Development proxy destination | `http://localhost:8080` |

The frontend and API intentionally use the same origin. Authentication uses an `HttpOnly`, `SameSite=Lax`, and production-only `Secure` session cookie, so no token is exposed to browser JavaScript. If the hosting provider has a reverse proxy, set `TRUST_PROXY_HOPS` to the provider's documented hop count.

Generate a production secret with `openssl rand -base64 48`. The application rejects the example and development secrets in production.

### PostgreSQL integration tests

The Docker initialization creates an isolated `dilemma_killer_ts_test` database. After copying `.env.example` to `.env`, run:

```bash
npm run test:integration
```

If the Docker volume existed before the test database was added, create it once with:

```bash
docker compose exec postgres createdb -U dilemma dilemma_killer_ts_test
```

## API

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/auth/me`, `POST /api/auth/upgrade`
- `GET /api/players`, `POST /api/players`, `DELETE /api/players/:id`
- `GET /api/games`
- `POST /api/wheel/spin`
- `GET /api/wheel/health`
- `POST /api/games/dice/roll`
- `POST /api/games/cards/draw`
- `GET /api/statistics`
- `GET /api/config`, `GET /api/health`, `GET /api/ready`

The upgrade endpoint is deliberately a demo. Do not sell Premium until it has been replaced by a verified payment webhook.
