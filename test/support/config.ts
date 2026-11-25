import { ConfigService } from '@nestjs/config';
import {
  validateEnv,
  type EnvironmentVariables,
} from '../../src/config/env.validation.js';

/** A ConfigService over validated test values (fast bcrypt, test secrets). */
export const testConfig = (
  overrides: Record<string, string> = {},
): ConfigService<EnvironmentVariables, true> =>
  new ConfigService(
    validateEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'test-access-secret-that-is-at-least-32-chars',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars',
      BCRYPT_ROUNDS: '10',
      ...overrides,
    }) as unknown as Record<string, unknown>,
  ) as unknown as ConfigService<EnvironmentVariables, true>;
