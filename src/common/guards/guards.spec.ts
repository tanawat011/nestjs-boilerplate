import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { testConfig } from '../../../test/support/config.js';
import { TokenService } from '../../modules/auth/token.service.js';
import { Role } from '../../modules/users/user.entity.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

const tokens = new TokenService(new JwtService(), testConfig());

/** An ExecutionContext for a handler carrying the given metadata. */
const contextFor = (
  request: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): ExecutionContext => {
  const handler = () => undefined;
  for (const [key, value] of Object.entries(metadata))
    Reflect.defineMetadata(key, value, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(new Reflector(), tokens);

  it('lets @Public() routes through without a token', async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} }, { [IS_PUBLIC_KEY]: true })),
    ).resolves.toBe(true);
  });

  it('refuses a missing or invalid token', async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: 'Bearer nope' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('sets request.user from a valid access token', async () => {
    const { accessToken, refreshToken } = await tokens.issuePair({
      id: 'u1',
      role: Role.User,
    });
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${accessToken}` },
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', role: Role.User });

    const withRefresh = {
      headers: { authorization: `Bearer ${refreshToken}` },
    };
    await expect(
      guard.canActivate(contextFor(withRefresh)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows routes without @Roles', () => {
    expect(
      guard.canActivate(contextFor({ user: { id: 'u1', role: Role.User } })),
    ).toBe(true);
  });

  it('enforces @Roles', () => {
    const adminOnly = { [ROLES_KEY]: [Role.Admin] };
    expect(
      guard.canActivate(
        contextFor({ user: { id: 'a', role: Role.Admin } }, adminOnly),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        contextFor({ user: { id: 'u', role: Role.User } }, adminOnly),
      ),
    ).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor({}, adminOnly))).toThrow(
      ForbiddenException,
    );
  });
});
