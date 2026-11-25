# Changelog

All notable changes to this template. Earlier changes are in the git history.

## 2.0.0 (2026-11-25): refresh

### Breaking

- Every route is under `/api/v1` (only `/health` stays at the root), and the
  resources are plural: `/user` is now `/api/v1/users`, `/customer` is now
  `/api/v1/customers`.
- Swagger UI moved from `/api` to `/docs`, and is off in production unless
  `SWAGGER_ENABLED=true`.
- Every user and customer route needs sign-in (`Authorization: Bearer
  <accessToken>`). `GET /users` is admin only; `GET`, `PATCH` and
  `DELETE /users/:id` are allowed for that user or an admin. Deleting a
  customer is admin only.
- Sign-in no longer uses a server-side session. `POST /api/v1/auth/login` takes
  `email` + `password` and returns an access token and a refresh token;
  `POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout` are new;
  `GET /auth/logout` and `POST /auth/login/customer` are gone.
- `POST /user` is replaced by `POST /api/v1/auth/register`.
- Deletes use `DELETE /…/:id` (was `POST /…/:id/delete`).
- Data model: ids are UUIDs; users log in by `email` (no `username`) and have a
  `role`; customers are plain records (`firstName`, `lastName`, `email`,
  `phone`) without a password or login of their own.
- The schema is created by migrations, not `synchronize`. Tables made by the
  old version do not match: start from an empty database.
- Configuration: `JWT_REFRESH_SECRET` is new and required (both secrets 32+
  characters and different); `SESSION_SECRET` is gone; `POSTGRES_PORT`
  defaults to `15433`. The compose file moved from `docker/docker-compose.yaml`
  to `docker-compose.yml` and no longer needs a `.env`.
- The project is ESM (`"type": "module"`) and requires Node.js 22.13 or newer.

### Added

- Refresh-token rotation with reuse detection, `@Public()`, `@Roles()`,
  `@CurrentUser()`, pagination, `/health` (Terminus), global and auth rate
  limits, `CORS_ORIGINS`, `TRUST_PROXY`, `BCRYPT_ROUNDS`.
- Vitest unit and e2e tests against PostgreSQL, oxlint, GitHub Actions CI.
- MIT LICENSE.

### Changed

- NestJS 12, TypeORM 1.x, TypeScript 6 and every other dependency updated
  (`bun audit`: 0). `bun.lock` is committed.
- Password hashes and refresh-token hashes are never returned by the API.
