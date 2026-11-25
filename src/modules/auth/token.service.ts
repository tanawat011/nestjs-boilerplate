import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { Role } from '../users/user.entity.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access token lifetime, e.g. "15m". */
  expiresIn: string;
}

interface Payload {
  sub: string;
  role?: string;
  type: 'access' | 'refresh';
}

const ISSUER = 'nestjs-boilerplate';
const ROLES = new Set<string>(Object.values(Role));

/**
 * Issues and verifies tokens. Access and refresh tokens use different
 * secrets and carry a "type" claim, so one can never stand in for the other.
 * Only HS256 is accepted.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async issuePair(user: AuthUser): Promise<TokenPair> {
    const accessTtl = this.config.get('JWT_EXPIRATION_ACCESS_TOKEN', {
      infer: true,
    });
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { role: user.role, type: 'access' },
        {
          secret: this.config.get('JWT_SECRET', { infer: true }),
          subject: user.id,
          issuer: ISSUER,
          algorithm: 'HS256',
          expiresIn: accessTtl as never,
        },
      ),
      this.jwt.signAsync(
        { type: 'refresh' },
        {
          secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
          subject: user.id,
          issuer: ISSUER,
          algorithm: 'HS256',
          // A unique id, so two tokens issued in the same second differ.
          jwtid: randomUUID(),
          expiresIn: this.config.get('JWT_EXPIRATION_REFRESH_TOKEN', {
            infer: true,
          }) as never,
        },
      ),
    ]);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTtl,
    };
  }

  /** Returns the caller in a valid access token, or null. */
  async verifyAccess(token: string): Promise<AuthUser | null> {
    const payload = await this.verify(token, 'JWT_SECRET', 'access');
    if (
      !payload ||
      typeof payload.role !== 'string' ||
      !ROLES.has(payload.role)
    )
      return null;
    return { id: payload.sub, role: payload.role as Role };
  }

  /** Returns the user id in a valid refresh token, or null. */
  async verifyRefresh(token: string): Promise<string | null> {
    const payload = await this.verify(token, 'JWT_REFRESH_SECRET', 'refresh');
    return payload?.sub ?? null;
  }

  /** Refresh tokens are stored as SHA-256 hashes (they are long and random). */
  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async verify(
    token: string,
    secretKey: 'JWT_SECRET' | 'JWT_REFRESH_SECRET',
    type: Payload['type'],
  ): Promise<Payload | null> {
    try {
      const payload = await this.jwt.verifyAsync<Payload & { exp?: number }>(
        token,
        {
          secret: this.config.get(secretKey, { infer: true }),
          algorithms: ['HS256'],
          issuer: ISSUER,
        },
      );
      if (
        payload.type !== type ||
        typeof payload.sub !== 'string' ||
        !payload.exp
      )
        return null;
      return payload;
    } catch {
      return null;
    }
  }
}
