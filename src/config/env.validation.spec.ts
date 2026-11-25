import { validateEnv } from './env.validation.js';

const secrets = {
  JWT_SECRET: 'a-perfectly-random-access-secret-32-chars',
  JWT_REFRESH_SECRET: 'a-perfectly-random-refresh-secret-32chars',
};

describe('validateEnv', () => {
  it('applies safe defaults and converts types', () => {
    const env = validateEnv({ ...secrets, PORT: '8080', POSTGRES_SSL: 'true' });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 8080,
      POSTGRES_PORT: 15433,
      POSTGRES_SSL: true,
      JWT_EXPIRATION_ACCESS_TOKEN: '15m',
      JWT_EXPIRATION_REFRESH_TOKEN: '7d',
      BCRYPT_ROUNDS: 12,
      THROTTLE_LIMIT: 100,
      AUTH_THROTTLE_LIMIT: 10,
    });
  });

  it('treats empty variables as unset', () => {
    expect(validateEnv({ ...secrets, PORT: '' }).PORT).toBe(3000);
  });

  it.each([
    ['missing secrets', {}, /JWT_SECRET/],
    ['short secret', { ...secrets, JWT_SECRET: 'short' }, /JWT_SECRET/],
    [
      'same secret twice',
      {
        JWT_SECRET: secrets.JWT_SECRET,
        JWT_REFRESH_SECRET: secrets.JWT_SECRET,
      },
      /must differ/,
    ],
    ['weak bcrypt', { ...secrets, BCRYPT_ROUNDS: '6' }, /BCRYPT_ROUNDS/],
    [
      'bad duration',
      { ...secrets, JWT_EXPIRATION_ACCESS_TOKEN: 'soon' },
      /JWT_EXPIRATION_ACCESS_TOKEN/,
    ],
    [
      'example secrets in production',
      {
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me-access-secret-at-least-32-characters-long',
        JWT_REFRESH_SECRET:
          'change-me-refresh-secret-at-least-32-characters-long',
      },
      /still the example value/,
    ],
  ])('refuses %s', (_name, env, message) => {
    expect(() => validateEnv(env)).toThrow(message);
  });
});
