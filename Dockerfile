# syntax=docker/dockerfile:1

# Node runs the app; bun (the project's package manager) installs it.
FROM node:26-alpine AS base
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

# ---- production dependencies only ----
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

# ---- build ----
FROM base AS build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN bun run build

# ---- runtime: compiled code + production dependencies, non-root ----
FROM node:26-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
