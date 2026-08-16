# Dilemma Killer — TypeScript Edition

This is a separate, English, full-stack TypeScript version of Dilemma Killer. The original Java and JavaScript folders remain unchanged.

## Stack

- React 19 + Vite + TypeScript
- Node.js + Express + TypeScript
- PostgreSQL 16
- Netlify Functions support through the existing Express application
- Vitest and Supertest

The same Express application can run as a conventional Node.js service or inside a Netlify Function. PostgreSQL remains the only separate production dependency.

## Features

- Lucky Wheel, 3D Dice Roll, and Winner Slots are free
- Card Draw is Premium
- Optional email/password accounts
- Saved player roster for signed-in users
- Reusable saved player groups
- Editable display name, email, and password
- Main-menu and detailed per-user play statistics
- GoPay Sandbox integration for a recurring €2/month Premium subscription
- Demo Premium upgrade, always disabled in production
- Animated star-flight background and floating 3D dice
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
npm run build:netlify # checks, tests, and builds the Netlify frontend
npm start            # production server; run build first
npm run db:migrate   # apply PostgreSQL migrations manually
npm run test:integration  # real PostgreSQL auth, ownership, and statistics tests
```

## Production deployment

### Netlify

The repository includes `netlify.toml` and a `serverless-http` wrapper around the existing Express application. The `/api/*` rewrite runs `netlify/functions/api.mts`; all other routes fall back to the React application.

1. Set the Netlify base directory to `typescript-app`.
2. Leave the build command and publish directory to `netlify.toml` (`npm run build:netlify` and `dist`).
3. Create a managed PostgreSQL database that accepts connections from Netlify Functions. Prefer the provider's pooled connection URL when one is available.
4. In **Netlify → Site configuration → Environment variables**, add the runtime values below. Do not put secrets in `netlify.toml`.
5. Trigger a new deploy, then verify `https://your-site.example/api/health` and `https://your-site.example/api/ready`.

Required Netlify runtime configuration:

```dotenv
DATABASE_URL=postgresql://...
JWT_SECRET=<output-of-openssl-rand-base64-48>
RUN_MIGRATIONS_ON_START=true
```

The function forces production mode when deployed, caps each warm function instance to two PostgreSQL connections, and runs migrations once per warm instance. Migrations use the existing PostgreSQL advisory lock, so simultaneous cold starts cannot apply the same migration twice. For a busier deployment, run migrations as a separate deploy/release task and set `RUN_MIGRATIONS_ON_START=false`.

Set `DATABASE_SSL=true` if your database provider requires TLS. Keep `DATABASE_SSL_REJECT_UNAUTHORIZED=true` when it supplies a trusted certificate. Set `APP_BASE_URL` to the public Netlify URL and add the GoPay variables if payments should be enabled.

Netlify environment variables must be configured through the UI, CLI, or API with Functions access; values placed only in `netlify.toml` are not available to functions at runtime.

### Conventional Node.js service

To deploy the same application as a long-running service instead:

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
APP_BASE_URL=https://your-public-app.example
GOPAY_GOID=<your-gopay-goid>
GOPAY_CLIENT_ID=<your-gopay-client-id>
GOPAY_CLIENT_SECRET=<your-gopay-client-secret>
GOPAY_GATEWAY_URL=https://gate.gopay.cz/api
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
| `APP_BASE_URL` | Public HTTPS origin used for GoPay returns and notifications | Not set |
| `GOPAY_GOID` | GoPay merchant account identifier | Not set |
| `GOPAY_CLIENT_ID` | GoPay OAuth client identifier | Not set |
| `GOPAY_CLIENT_SECRET` | GoPay OAuth client secret | Not set |
| `GOPAY_GATEWAY_URL` | GoPay REST API origin | Sandbox API |

The frontend and API intentionally use the same origin. Authentication uses an `HttpOnly`, `SameSite=Lax`, and production-only `Secure` session cookie, so no token is exposed to browser JavaScript. If the hosting provider has a reverse proxy, set `TRUST_PROXY_HOPS` to the provider's documented hop count.

Generate a production secret with `openssl rand -base64 48`. The application rejects the example and development secrets in production.

### GoPay setup

The checkout is intentionally disabled until all GoPay values and `APP_BASE_URL` are configured.
Register a GoPay business/sandbox account to receive your own GoID, Client ID, and Client Secret;
GoPay does not provide shared sandbox credentials. Recurring payments are enabled in sandbox, but
GoPay support must activate recurring payments before production use. Configure your settlement bank
account in the GoPay business account—the application never stores bank or card details.

Premium checkout creates an automatic monthly recurrence for EUR 2.00. Premium is activated only
after the backend independently reads a `PAID` status from GoPay. Notification processing is
idempotent, and each verified monthly charge extends access by one month.

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
- `GET /api/auth/me`, `PATCH /api/auth/profile`, `POST /api/auth/password`
- `POST /api/auth/upgrade` (development demo only)
- `GET /api/players`, `POST /api/players`, `DELETE /api/players/:id`
- `GET /api/groups`, `POST /api/groups`, `PUT /api/groups/:id`, `DELETE /api/groups/:id`
- `GET /api/games`
- `POST /api/wheel/spin`
- `GET /api/wheel/health`
- `POST /api/games/dice/roll`
- `POST /api/games/slots/spin`
- `POST /api/games/cards/draw`
- `GET /api/statistics`
- `POST /api/payments/gopay`, `GET /api/payments/order/:order/status`
- `GET /api/payments/subscription/status`, `POST /api/payments/subscription/cancel`
- `GET|POST /api/payments/gopay/notification`
- `GET /api/config`, `GET /api/health`, `GET /api/ready`

The mock upgrade remains for local testing only. Production Premium activation uses verified GoPay
payment status and never trusts a browser redirect by itself.
