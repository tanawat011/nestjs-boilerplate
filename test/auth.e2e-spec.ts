import {
  createE2eApp,
  login,
  register,
  type E2eApp,
} from './support/e2e-app.js';

let ctx: E2eApp;

beforeAll(async () => {
  ctx = await createE2eApp({ AUTH_THROTTLE_LIMIT: '1000' });
});
afterAll(async () => {
  await ctx.app.close();
});

describe('auth (e2e)', () => {
  it('registers, never returning the password or token hash', async () => {
    const res = await register(ctx.http, 'alice').expect(201);
    expect(res.body).toMatchObject({
      email: 'alice@example.com',
      role: 'user',
      isActive: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|refreshTokenHash/);

    await register(ctx.http, 'alice').expect(409);
  });

  it('validates input: unknown fields and bad values are 400', async () => {
    await ctx.http
      .post('/api/v1/auth/register')
      .send({
        email: 'not-an-email',
        password: 'short',
        firstName: '',
        lastName: 'x',
      })
      .expect(400);
    await ctx.http
      .post('/api/v1/auth/register')
      .send({
        email: 'x@example.com',
        password: 'correct-horse',
        firstName: 'x',
        lastName: 'x',
        role: 'admin',
      })
      .expect(400);
  });

  it('logs in and serves /auth/me', async () => {
    await ctx.http
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' })
      .expect(401);
    const { accessToken } = await login(ctx.http, 'alice');

    await ctx.http.get('/api/v1/auth/me').expect(401);
    const me = await ctx.http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.email).toBe('alice@example.com');
    expect(me.body.password).toBeUndefined();
  });

  it('rotates refresh tokens and signs out everywhere on reuse', async () => {
    const first = await login(ctx.http, 'alice');
    const second = (
      await ctx.http
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200)
    ).body as { refreshToken: string; accessToken: string };

    // Reusing the old refresh token is refused and ends the session.
    await ctx.http
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    await ctx.http
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second.refreshToken })
      .expect(401);
    // An access token cannot be used to refresh.
    await ctx.http
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second.accessToken })
      .expect(401);
  });

  it('logs out: the refresh token stops working', async () => {
    const pair = await login(ctx.http, 'alice');
    await ctx.http
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${pair.accessToken}`)
      .expect(204);
    await ctx.http
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: pair.refreshToken })
      .expect(401);
  });

  it('refuses a deactivated account', async () => {
    await ctx.db.query(
      `UPDATE users SET is_active = false WHERE email = 'alice@example.com'`,
    );
    await ctx.http
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'correct-horse' })
      .expect(403);
  });
});
