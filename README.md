# NestJS Boilerplate

A production-ready NestJS boilerplate with TypeORM, PostgreSQL, JWT authentication, and Docker support.

## Tech Stack

- **NestJS** 10
- **TypeORM** with PostgreSQL
- **JWT** Authentication
- **Docker** Compose for local development

## Getting Started

```bash
# start postgres
docker compose -f docker/docker-compose.yaml up -d

# install deps
yarn install

# run dev
yarn start:dev
```

## Project Structure

```
src/
├── middleware/     # Auth & Logger middleware
├── modules/
│   ├── auth/      # JWT authentication
│   ├── customer/  # Customer CRUD
│   └── user/      # User CRUD
├── utils/         # Bcrypt helpers
├── app.module.ts
└── main.ts
```

## License

MIT
