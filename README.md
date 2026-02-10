# 🚀 NestJS Boilerplate

Production-ready NestJS boilerplate with authentication, database, API docs, and Docker — ready to build on.

## ✨ Features

- 🏗 **NestJS 11** — latest framework with Express v5
- 🗄 **TypeORM** + PostgreSQL — database ORM with auto-migrations
- 🔐 **JWT Authentication** — access + refresh tokens
- 📚 **Swagger/OpenAPI** — auto-generated API docs at `/api`
- 🛡 **Helmet** — security headers
- ✅ **Validation** — class-validator with global pipe
- 🐳 **Docker** — multi-stage build + compose
- 🧪 **Jest** — unit & e2e testing setup

## 🛠 Tech Stack

| Category | Tech |
|----------|------|
| Framework | NestJS 11 |
| Language | TypeScript 5.7 |
| Database | PostgreSQL 17 + TypeORM |
| Auth | JWT (access + refresh tokens) |
| Docs | Swagger / OpenAPI |
| Container | Docker + Docker Compose |
| Testing | Jest + Supertest |

## 📁 Project Structure

```
src/
├── middleware/         # Auth & Logger middleware
├── modules/
│   ├── auth/          # JWT authentication (login, logout)
│   ├── customer/      # Customer CRUD
│   └── user/          # User CRUD
├── utils/             # Bcrypt helpers
├── app.module.ts      # Root module
└── main.ts            # Entry point (Swagger, Helmet, CORS)
```

## 🚀 Getting Started

```bash
# Start PostgreSQL
docker compose -f docker/docker-compose.yaml up db -d

# Install dependencies
bun install

# Copy env
cp .env.example .env

# Run dev server
bun run start:dev
```

Open:
- App: http://localhost:3000
- Swagger: http://localhost:3000/api

## 🐳 Docker

```bash
# Run everything (app + db)
docker compose -f docker/docker-compose.yaml up -d
```

## 📄 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/login/customer` | Customer login |
| GET | `/auth/logout` | Logout |
| GET | `/user` | List users (auth required) |
| POST | `/user` | Create user |
| GET | `/customer` | List customers |
| POST | `/customer` | Create customer |

## License

MIT
