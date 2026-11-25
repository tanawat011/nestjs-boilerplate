import { JwtService } from '@nestjs/jwt';
import { testConfig } from '../../../test/support/config.js';
import { Role } from '../users/user.entity.js';
import { TokenService } from './token.service.js';

const config = testConfig();
const jwt = new JwtService();
const tokens = new TokenService(jwt, config);

describe('TokenService', () => {
  it('issues an access / refresh pair that verify to the user', async () => {
    const pair = await tokens.issuePair({ id: 'user-1', role: Role.Admin });
    expect(pair).toMatchObject({ tokenType: 'Bearer', expiresIn: '15m' });
    expect(await tokens.verifyAccess(pair.accessToken)).toEqual({
      id: 'user-1',
      role: Role.Admin,
    });
    expect(await tokens.verifyRefresh(pair.refreshToken)).toBe('user-1');
  });

  it('never accepts one kind of token as the other', async () => {
    const pair = await tokens.issuePair({ id: 'user-1', role: Role.User });
    expect(await tokens.verifyAccess(pair.refreshToken)).toBeNull();
    expect(await tokens.verifyRefresh(pair.accessToken)).toBeNull();
  });

  it('issues a different refresh token every time', async () => {
    const a = await tokens.issuePair({ id: 'user-1', role: Role.User });
    const b = await tokens.issuePair({ id: 'user-1', role: Role.User });
    expect(a.refreshToken).not.toBe(b.refreshToken);
    expect(TokenService.hash(a.refreshToken)).toMatch(/^[0-9a-f]{64}$/);
  });

  const secret = 'test-access-secret-that-is-at-least-32-chars';
  const base = { role: 'user', type: 'access' };
  const ok = {
    subject: 'user-1',
    issuer: 'nestjs-boilerplate',
    expiresIn: '1h' as const,
  };

  it.each([
    ['garbage', () => 'not.a.token'],
    [
      'another key',
      () =>
        jwt.sign(base, {
          ...ok,
          secret: 'another-secret-that-is-also-32-chars!!',
        }),
    ],
    [
      'another issuer',
      () => jwt.sign(base, { ...ok, secret, issuer: 'someone-else' }),
    ],
    ['expired', () => jwt.sign(base, { ...ok, secret, expiresIn: -10 })],
    ['HS512', () => jwt.sign(base, { ...ok, secret, algorithm: 'HS512' })],
    [
      'no expiry',
      () =>
        jwt.sign(base, {
          subject: 'user-1',
          issuer: 'nestjs-boilerplate',
          secret,
        }),
    ],
    [
      'unknown role',
      () => jwt.sign({ ...base, role: 'root' }, { ...ok, secret }),
    ],
  ])('rejects an access token with %s', async (_name, make) => {
    expect(await tokens.verifyAccess(make())).toBeNull();
  });
});
