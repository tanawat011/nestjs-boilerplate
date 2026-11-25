import { createE2eApp, type E2eApp } from './support/e2e-app.js';

let ctx: E2eApp;

beforeAll(async () => {
  ctx = await createE2eApp({ AUTH_THROTTLE_LIMIT: '3' });
});
afterAll(async () => {
  await ctx.app.close();
});

describe('rate limiting (e2e)', () => {
  it('limits login attempts per client, not other routes', async () => {
    const attempt = () =>
      ctx.http
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever' });

    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after-auth']).toBeDefined();

    await ctx.http.get('/health').expect(200);
  });
});
