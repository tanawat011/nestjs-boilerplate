import 'reflect-metadata';
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const DURATION = /^\d+[smhd]$/;

/**
 * Example values from .env.example and docker-compose.yml. Fine for local
 * development, refused when NODE_ENV=production.
 */
const PLACEHOLDER_SECRETS = new Set([
  'change-me-access-secret-at-least-32-characters-long',
  'change-me-refresh-secret-at-least-32-characters-long',
  'dev-only-insecure-access-secret-do-not-use-in-production',
  'dev-only-insecure-refresh-secret-do-not-use-in-production',
]);

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

/**
 * Every environment variable the app reads, with its default. Explicit type
 * annotations matter: class-transformer converts strings using them.
 */
export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  POSTGRES_HOST: string = 'localhost';

  @IsInt()
  POSTGRES_PORT: number = 15433;

  @IsString()
  POSTGRES_USERNAME: string = 'postgres';

  @IsString()
  POSTGRES_PASSWORD: string = '';

  @IsString()
  POSTGRES_DATABASE: string = 'nestjs';

  @Transform(toBool)
  @IsBoolean()
  POSTGRES_SSL: boolean = false;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  @Matches(DURATION, {
    message: 'JWT_EXPIRATION_ACCESS_TOKEN must look like 15m, 1h or 7d',
  })
  JWT_EXPIRATION_ACCESS_TOKEN: string = '15m';

  @Matches(DURATION, {
    message: 'JWT_EXPIRATION_REFRESH_TOKEN must look like 15m, 1h or 7d',
  })
  JWT_EXPIRATION_REFRESH_TOKEN: string = '7d';

  @IsInt()
  @Min(10)
  @Max(15)
  BCRYPT_ROUNDS: number = 12;

  /** Comma-separated origins; empty = no CORS; "*" = any origin. */
  @IsString()
  CORS_ORIGINS: string = '';

  /** Express "trust proxy": false, a hop count, or proxy IPs / subnets. */
  @IsString()
  TRUST_PROXY: string = 'false';

  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 100;

  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT: number = 10;

  /** Swagger UI at /docs. Defaults to on outside production. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  SWAGGER_ENABLED?: boolean;
}

/** ConfigModule validate hook: fails fast with every problem listed. */
export function validateEnv(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  // Empty variables count as unset, so defaults apply.
  const defined = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v !== ''),
  );
  const env = plainToInstance(EnvironmentVariables, defined, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  const problems = errors.flatMap((e) => Object.values(e.constraints ?? {}));
  if (env.NODE_ENV === 'production') {
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (PLACEHOLDER_SECRETS.has(env[key]))
        problems.push(`${key} is still the example value`);
    }
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must differ');
  }
  if (problems.length > 0) {
    throw new Error(`Invalid configuration: ${problems.join('; ')}`);
  }
  return env;
}

export const parseList = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const parseTrustProxy = (value: string): boolean | number | string => {
  const v = value.trim();
  if (v === '' || v === 'false') return false;
  if (v === 'true') return true;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
};
