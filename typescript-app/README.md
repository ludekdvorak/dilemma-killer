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

- Lucky Wheel, 3D Dice Roll, Winner Slots, and Card Draw are free
- Roulette, Horse Racing, and Ticking Bomb are Premium
- Optional email/password accounts
- Google sign-up and sign-in with automatic account creation
- In-game login dialog that preserves the current players and round
- Saved player roster for signed-in users
- Reusable saved player groups
- Editable display name, email, and password
- Main-menu and detailed per-user play statistics
- GoPay Sandbox integration for a recurring €2/month Premium subscription
- Demo Premium upgrade, always disabled in production
- Dice throws with tumbling, table bounces, and staggered landings
- One name card per player, with the drawn winner printed on the revealed card
- Animated star-flight background with reduced-motion support
- Spinning 3D dice and roll animations by default
- Red-and-black Roulette with a thrown ball, 20-second horse races with live commentary, and pass-the-bomb rounds

Statistics are recorded only for successful games played while signed in. PostgreSQL stores the game type, player count, and timestamp; it does not store party-player names or game results.

The player setup renders immediately while the session is checked in the background. Game and account screens load on demand, the game catalog is shared with the API, and fonts are served locally. Guest health, configuration, session checks, and free-game requests bypass Netlify's database migration wait. Authenticated requests still wait for migrations before querying PostgreSQL.

Game actions keep their full timing even when the operating system requests reduced motion. Decorative background effects remain reduced.

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
npm run test:browser      # browser regression tests; API responses are mocked, no database needed
```

Install the test browser once with `npx playwright install chromium` before `npm run test:browser`. To use an already installed Chrome/Chromium instead, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. Browser tests cover every game, default dice animation, reduced motion, and mobile layout.

## Production deployment

### Netlify

The repository root includes `netlify.toml` and the application includes a `serverless-http` wrapper around the existing Express application. The `/api/*` rewrite runs `netlify/functions/api.mts`; all other routes fall back to the React application.

1. Connect Netlify to this Git repository. The root `netlify.toml` sets the base directory to `typescript-app`.
2. Leave the build command and publish directory to `netlify.toml` (`npm run build:netlify` and `dist`). Do not deploy by uploading only the generated `dist` directory because that omits the API function.
3. Create a managed PostgreSQL database that accepts connections from Netlify Functions. Prefer the provider's pooled connection URL when one is available.
4. In **Netlify → Site configuration → Environment variables**, add the runtime values below. Do not put secrets in `netlify.toml`.
5. Trigger a new deploy, then verify `https://your-site.example/api/health` and `https://your-site.example/api/ready`.

For a manual deployment, use the Netlify CLI from the repository root so the function and redirects are uploaded together:

```bash
npx netlify-cli@latest login
npx netlify-cli@latest link
npx netlify-cli@latest deploy --prod
```

Uploading or dragging only `typescript-app/dist` deploys the frontend but cannot deploy the API function.

Required Netlify runtime configuration:

```dotenv
DATABASE_URL=postgresql://...
JWT_SECRET=<output-of-openssl-rand-base64-48>
RUN_MIGRATIONS_ON_START=true
```

The function forces production mode when deployed, caps each warm function instance to two PostgreSQL connections, and runs migrations once per warm instance when a database-backed request first arrives. Migrations use the existing PostgreSQL advisory lock, so simultaneous cold starts cannot apply the same migration twice. For a busier deployment, run migrations as a separate deploy/release task and set `RUN_MIGRATIONS_ON_START=false`.

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
| `GOOGLE_CLIENT_ID` | Google OAuth Web application client ID for sign-up/sign-in | Not set; email login remains available |
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

### Google sign-up and sign-in

1. Follow the [Google Identity Services setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) to create an OAuth client with application type **Web application** and configure the consent screen.
2. Add both `http://localhost` and `http://localhost:5173` for local development, plus the exact production origin (for example, `https://your-site.netlify.app`), under **Authorized JavaScript origins**. Include every origin you use, including custom domains. If you use another local port, authorize that port too. This integration uses the Google popup callback; it does not need an authorized redirect URI or client secret.
3. Set `GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com` in the local `.env` or Netlify runtime environment (Functions scope), then restart/redeploy. If the Google app is in testing mode, add your Google account as a test user in its consent-screen settings.
4. Apply migration 3 with `npm run db:migrate` if startup migrations are disabled. Existing password accounts are preserved.

The official **Continue with Google** button appears on both login and registration. The Google script loads only when the login dialog opens and Google is configured. The server verifies Google's signature, issuer, audience, expiry, verified email, and a short-lived browser-bound nonce before creating its usual HttpOnly session cookie. A first Google sign-in creates the account automatically; subsequent sign-ins find it by Google's stable subject ID. The current game remains mounted during sign-in.

An existing password account with the same email is not automatically linked to Google; sign in with its password. Google-only accounts can change their display name, while email and password are managed by Google. No Google credentials are included in source control. Without `GOOGLE_CLIENT_ID`, the dialog explains that Google is unavailable and email sign-in/sign-up continues to work.

Google verification and account creation are covered by unit and isolated PostgreSQL integration tests using locally signed test identities. A live Google popup still requires your configured OAuth client and an authorized origin.

Google sign-in works on localhost. If the app says it is unavailable, check that `typescript-app/.env` exists, contains your real `GOOGLE_CLIENT_ID`, and the API was restarted after editing it. Without that setting, deploying the app will also leave Google sign-in unavailable. The Vite and local Express servers set the popup and referrer headers recommended by Google for HTTP localhost testing.

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
- `GET /api/auth/google/config`, `POST /api/auth/google`
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
- `POST /api/games/roulette/spin`, `POST /api/games/horserace/race`, `POST /api/games/bomb/start`
- `GET /api/statistics`
- `POST /api/payments/gopay`, `GET /api/payments/order/:order/status`
- `GET /api/payments/subscription/status`, `POST /api/payments/subscription/cancel`
- `GET|POST /api/payments/gopay/notification`
- `GET /api/config`, `GET /api/health`, `GET /api/ready`

The mock upgrade remains for local testing only. Production Premium activation uses verified GoPay
payment status and never trusts a browser redirect by itself.
