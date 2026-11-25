import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { Customer } from '../modules/customers/customer.entity.js';
import { User } from '../modules/users/user.entity.js';
import { migrations } from './migrations/index.js';

export interface DatabaseEnv {
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_USERNAME: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DATABASE: string;
  POSTGRES_SSL: boolean;
}

/**
 * TypeORM options shared by the app and the CLI. The schema is managed by
 * migrations only (synchronize is off); the app applies pending migrations
 * when it starts.
 */
export const databaseOptions = (env: DatabaseEnv): DataSourceOptions => ({
  type: 'postgres',
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  username: env.POSTGRES_USERNAME,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DATABASE,
  ssl: env.POSTGRES_SSL ? { rejectUnauthorized: true } : false,
  // UUID defaults use gen_random_uuid(), built into PostgreSQL 13+.
  uuidExtension: 'pgcrypto',
  entities: [User, Customer],
  migrations,
  migrationsRun: true,
  synchronize: false,
});

/** Used by `typeorm migration:*` (see package.json); reads .env if present. */
const fromProcessEnv = (): DataSourceOptions => {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const e = process.env;
  return databaseOptions({
    POSTGRES_HOST: e.POSTGRES_HOST ?? 'localhost',
    POSTGRES_PORT: Number(e.POSTGRES_PORT ?? 15433),
    POSTGRES_USERNAME: e.POSTGRES_USERNAME ?? 'postgres',
    POSTGRES_PASSWORD: e.POSTGRES_PASSWORD ?? '',
    POSTGRES_DATABASE: e.POSTGRES_DATABASE ?? 'nestjs',
    POSTGRES_SSL: e.POSTGRES_SSL === 'true',
  });
};

export default new DataSource(fromProcessEnv());
