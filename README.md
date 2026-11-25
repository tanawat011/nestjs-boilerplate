# NestJS Boilerplate

[![CI](https://github.com/tanawat011/nestjs-boilerplate/actions/workflows/ci.yml/badge.svg)](https://github.com/tanawat011/nestjs-boilerplate/actions/workflows/ci.yml)

A small, tested starting point for a REST API on NestJS 12 (ESM): TypeORM with
PostgreSQL and versioned migrations, JWT access + refresh tokens with rotation,
role-based access, rate limiting, Swagger, and Docker.

It is meant to be cloned and changed, not installed as a package.

## Features

- **Auth**: register, login, refresh, logout, `GET /auth/me`. Short-lived
  access tokens (15 min) and refresh tokens (7 days) signed with different
  secrets. Refresh tokens rotate on every use and are stored only as SHA-256
  hashes; presenting a used one ends the session everywhere (theft detection).
- **Access rules**: a global JWT guard (`@Public()` to opt out) and a roles
  guard (`@Roles(Role.Admin)`). Users read, edit and delete only themselves;
  admins anyone; only admins change `role` or `isActive`.
- **Customers**: a sample resource with DTO validation, pagination and
  Swagger docs; any signed-in user can create and edit, only admins delete.
- **Secure defaults**: environment validated at startup (secrets at least 32
  characters, different from each other, example values refused in
  production); passwords hashed with bcrypt (cost 12); Helmet; CORS closed
  unless you list origins; global rate limit plus a tighter one on
  register / login / refresh; unknown request fields rejected; password and
  token hashes never serialised; `trust proxy` explicit; Swagger off in
  production unless enabled.
- **Database**: TypeORM 1.x on PostgreSQL 18, `synchronize` off, migrations
  committed and applied when the app starts; UUID keys via `gen_random_uuid()`.
- **Ops**: `/health` (Terminus, checks the database), graceful shutdown,
  multi-stage Docker image running as the non-root `node` user.
- **Tests**: Vitest. Unit tests cover config, tokens, auth, users and the
  guards; end-to-end tests boot the real app against PostgreSQL. CI runs
  oxlint, Prettier, type check, both test suites, `bun audit` and a
  `docker compose` smoke test.

## Quick start

Requires Docker.

```bash
git clone https://github.com/tanawat011/nestjs-boilerplate.git
cd nestjs-boilerplate
docker compose up --build
```

The API is on <http://localhost:3000/api/v1>, Swagger UI on
<http://localhost:3000/docs>. Try it:

```bash
curl localhost:3000/health

curl -X POST localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"correct-horse","firstName":"Alice","lastName":"Liddell"}'

curl -X POST localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"correct-horse"}'
# -> {"accessToken":"...","refreshToken":"...","tokenType":"Bearer","expiresIn":"15m"}

curl localhost:3000/api/v1/auth/me -H "Authorization: Bearer <accessToken>"
```

### Run on the host instead

Requires Node.js 22.13+ and [Bun](https://bun.sh) (the package manager).

```bash
cp .env.example .env              # then set both JWT secrets (openssl rand -base64 48)
docker compose up -d --wait db    # PostgreSQL only, on 127.0.0.1:15433
bun install
bun run start:dev                 # applies migrations, watches for changes
```

## API

| Method   | Path                      | Who                      | Notes |
|----------|---------------------------|--------------------------|-------|
| `GET`    | `/health`                 | anyone                   | 200, or 503 if the database is down |
| `POST`   | `/api/v1/auth/register`   | anyone (rate limited)    | `email`, `password` (8–72 bytes), `firstName`, `lastName` |
| `POST`   | `/api/v1/auth/login`      | anyone (rate limited)    | → `accessToken`, `refreshToken` |
| `POST`   | `/api/v1/auth/refresh`    | anyone (rate limited)    | `refreshToken` → a new pair; the old one stops working |
| `POST`   | `/api/v1/auth/logout`     | signed in                | ends the refresh-token session |
| `GET`    | `/api/v1/auth/me`         | signed in                | |
| `GET`    | `/api/v1/users`           | admin                    | `?page=1&limit=10` (max 100), newest first |
| `GET`    | `/api/v1/users/:id`       | that user or admin       | |
| `PATCH`  | `/api/v1/users/:id`       | that user or admin       | `email`, `firstName`, `lastName`; admin only: `role`, `isActive` |
| `DELETE` | `/api/v1/users/:id`       | that user or admin       | |
| `GET`    | `/api/v1/customers`       | signed in                | paginated |
| `GET`    | `/api/v1/customers/:id`   | signed in                | |
| `POST`   | `/api/v1/customers`       | signed in                | `firstName`, `lastName`, `email`, `phone` |
| `PATCH`  | `/api/v1/customers/:id`   | signed in                | |
| `DELETE` | `/api/v1/customers/:id`   | admin                    | |

Errors use NestJS's standard shape (`statusCode`, `message`, `error`):
400 validation (unknown fields included), 401, 403, 404, 409 email taken,
429 rate limited.

**Making the first admin**: register normally, promote the account in the
database, then log in again (the role is part of the access token):

```bash
docker compose exec db psql -U postgres -d nestjs \
  -c "UPDATE users SET role = 'admin' WHERE email = 'alice@example.com';"
```

## Project structure

```
src/
  main.ts                  bootstrap
  app.module.ts            config, database, rate limits, global guards
  app.setup.ts             Helmet, CORS, prefix, validation, Swagger (shared with e2e tests)
  config/                  environment validation
  common/                  decorators (@Public, @Roles, @CurrentUser, @AuthThrottle),
                           guards (JWT, roles), pagination
  database/                data source (app + CLI) and migrations
  modules/
    auth/                  register / login / refresh / logout, token service
    users/                 user entity, profile and admin endpoints
    customers/             sample CRUD resource
    health/                /health
test/                      e2e tests, global setup, test helpers
```

## Configuration

See `.env.example`. The app refuses to start when a value is missing or unsafe.

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `production` refuses example secrets and turns Swagger off |
| `PORT` | `3000` | HTTP port |
| `POSTGRES_HOST` / `POSTGRES_PORT` | `localhost` / `15433` | |
| `POSTGRES_USERNAME` / `POSTGRES_PASSWORD` / `POSTGRES_DATABASE` | `postgres` / *(empty)* / `nestjs` | |
| `POSTGRES_SSL` | `false` | `true` = TLS with certificate verification |
| `JWT_SECRET` | *(required)* | Access-token secret, at least 32 characters |
| `JWT_REFRESH_SECRET` | *(required)* | Refresh-token secret, at least 32 characters, different |
| `JWT_EXPIRATION_ACCESS_TOKEN` | `15m` | |
| `JWT_EXPIRATION_REFRESH_TOKEN` | `7d` | |
| `BCRYPT_ROUNDS` | `12` | 10–15 |
| `CORS_ORIGINS` | *(empty)* | Comma-separated origins; empty = same-origin only; `*` = any |
| `TRUST_PROXY` | `false` | Express `trust proxy`: `false`, hop count, or proxy IPs |
| `THROTTLE_LIMIT` | `100` | Requests per minute per client, all routes but `/health` |
| `AUTH_THROTTLE_LIMIT` | `10` | Per minute per client on register, login and refresh |
| `SWAGGER_ENABLED` | on outside production | Swagger UI at `/docs` |

## Testing

```bash
bun run test        # unit tests, no database needed
bun run test:e2e    # needs PostgreSQL: docker compose up -d --wait db
bun run lint        # oxlint (type-aware)
bun run typecheck
bun audit
```

The e2e tests read `TEST_DATABASE_URL` (an account that can create
databases; `.env.example` has the compose one). Each run creates its own
database, lets the app apply the migrations, and drops it afterwards.

## Database changes

Change an entity, then generate and commit a migration (against a database
that has the current migrations applied):

```bash
bun run migration:generate src/database/migrations/DescribeTheChange
```

Add the new class to `src/database/migrations/index.ts`; the app applies
pending migrations when it starts (`bun run migration:run` does it by hand).

## Deployment notes

- Build with `docker build -t nestjs-boilerplate .` and run with
  `NODE_ENV=production`, two random JWT secrets, real database credentials
  and `POSTGRES_SSL=true`.
- Migrations run at start-up. With several replicas starting at once, run
  `migration:run` as a release step instead and set `migrationsRun: false`
  in `src/database/data-source.ts`.
- Behind a load balancer set `TRUST_PROXY` (e.g. `1`), or every client
  shares the proxy's IP in the rate limiter. Limits are counted in memory,
  per instance; with several replicas use a shared Throttler storage
  (e.g. Redis) or limit at the edge.
- Access tokens are stateless: a role change or deactivation applies when
  the current access token expires (15 minutes by default). Deactivating an
  account ends its refresh-token session at once.

## Upgrading from the old version

The November 2026 refresh (2.0.0) changes the API. In short:

- Every route is under `/api/v1` (except `/health`); `/user` and `/customer`
  became `/api/v1/users` and `/api/v1/customers`.
- Swagger UI moved from `/api` to `/docs`.
- Every user and customer route needs sign-in with a bearer token; sign-in
  returns access + refresh tokens instead of using a session.
- `PATCH` updates and `DELETE` deletes (was `POST /:id/delete`); ids are UUIDs.
- The schema comes from migrations: start from an empty database.

See [CHANGELOG.md](CHANGELOG.md) for the full list.

## History

Started in October 2024 on NestJS 10; moved to NestJS 11 in February 2026.
Refreshed in November 2026: NestJS 12 (ESM) and TypeORM 1.x, migrations
instead of `synchronize`, bearer access + refresh tokens with rotation in
place of the session-based login, roles, rate limits, tests and CI.

## License

MIT, see [LICENSE](LICENSE).
