import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { inject } from 'vitest';

export interface E2eApp {
  app: INestApplication;
  http: ReturnType<typeof request>;
  db: DataSource;
}

/**
 * Boots the real AppModule (migrations included) against the e2e database,
 * with main.ts's configureApp. Environment overrides must be set before
 * AppModule is first imported, so it is imported here.
 */
export async function createE2eApp(
  env: Record<string, string> = {},
): Promise<E2eApp> {
  const url = new URL(inject('databaseUrl'));
  Object.assign(process.env, {
    NODE_ENV: 'test',
    POSTGRES_HOST: url.hostname,
    POSTGRES_PORT: url.port,
    POSTGRES_USERNAME: decodeURIComponent(url.username),
    POSTGRES_PASSWORD: decodeURIComponent(url.password),
    POSTGRES_DATABASE: url.pathname.slice(1),
    JWT_SECRET: 'e2e-access-secret-that-is-at-least-32-chars',
    JWT_REFRESH_SECRET: 'e2e-refresh-secret-that-is-at-least-32-chars',
    BCRYPT_ROUNDS: '10',
    SWAGGER_ENABLED: 'true',
    ...env,
  });

  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/app.setup.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  const db = app.get(DataSource);
  await db.query('TRUNCATE users, customers');
  return { app, http: request(app.getHttpServer()), db };
}

export const register = (http: E2eApp['http'], name: string) =>
  http.post('/api/v1/auth/register').send({
    email: `${name}@example.com`,
    password: 'correct-horse',
    firstName: name,
    lastName: 'Test',
  });

export const login = async (http: E2eApp['http'], name: string) => {
  const res = await http
    .post('/api/v1/auth/login')
    .send({ email: `${name}@example.com`, password: 'correct-horse' })
    .expect(200);
  return res.body as { accessToken: string; refreshToken: string };
};
