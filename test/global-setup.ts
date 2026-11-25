import pg from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Creates a throwaway database on the server in TEST_DATABASE_URL and drops
 * it after the run. The app applies its migrations itself on start-up.
 *   TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:15433/postgres
 */
export default async function setup(project: TestProject) {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl)
    throw new Error('TEST_DATABASE_URL is not set (see README, Testing)');

  const name = `nest_test_${Date.now()}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  project.provide('databaseUrl', url.toString());

  return async () => {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  };
}
