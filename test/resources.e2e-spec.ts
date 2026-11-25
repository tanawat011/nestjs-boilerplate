import {
  createE2eApp,
  login,
  register,
  type E2eApp,
} from './support/e2e-app.js';

let ctx: E2eApp;
let alice: { id: string; token: string };
let bob: { id: string; token: string };
let admin: string;

beforeAll(async () => {
  ctx = await createE2eApp({ AUTH_THROTTLE_LIMIT: '1000' });
  const make = async (name: string) => {
    const { body } = await register(ctx.http, name).expect(201);
    return body.id as string;
  };
  const aliceId = await make('alice');
  const bobId = await make('bob');
  await make('root');
  await ctx.db.query(
    `UPDATE users SET role = 'admin' WHERE email = 'root@example.com'`,
  );
  alice = { id: aliceId, token: (await login(ctx.http, 'alice')).accessToken };
  bob = { id: bobId, token: (await login(ctx.http, 'bob')).accessToken };
  admin = (await login(ctx.http, 'root')).accessToken;
});
afterAll(async () => {
  await ctx.app.close();
});

const as = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('health and docs (e2e)', () => {
  it('reports the database, without a token or rate limit', async () => {
    const res = await ctx.http.get('/health').expect(200);
    expect(res.body.details.database.status).toBe('up');
  });

  it('serves the OpenAPI document', async () => {
    const res = await ctx.http.get('/docs-json').expect(200);
    expect(Object.keys(res.body.paths)).toContain('/api/v1/auth/login');
  });

  it('sends security headers', async () => {
    const res = await ctx.http.get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('users (e2e)', () => {
  it('enforces ownership and roles', async () => {
    await ctx.http.get('/api/v1/users').expect(401);
    await ctx.http.get('/api/v1/users').set(as(alice.token)).expect(403);
    const list = await ctx.http
      .get('/api/v1/users?page=1&limit=2')
      .set(as(admin))
      .expect(200);
    expect(list.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    await ctx.http
      .get(`/api/v1/users/${alice.id}`)
      .set(as(alice.token))
      .expect(200);
    await ctx.http
      .get(`/api/v1/users/${bob.id}`)
      .set(as(alice.token))
      .expect(403);
    await ctx.http.get('/api/v1/users/not-a-uuid').set(as(admin)).expect(400);

    await ctx.http
      .patch(`/api/v1/users/${alice.id}`)
      .set(as(alice.token))
      .send({ role: 'admin' })
      .expect(403);
    const edited = await ctx.http
      .patch(`/api/v1/users/${alice.id}`)
      .set(as(alice.token))
      .send({ firstName: 'Alicia' })
      .expect(200);
    expect(edited.body).toMatchObject({
      firstName: 'Alicia',
      email: 'alice@example.com',
    });

    await ctx.http
      .delete(`/api/v1/users/${bob.id}`)
      .set(as(alice.token))
      .expect(403);
    await ctx.http.delete(`/api/v1/users/${bob.id}`).set(as(admin)).expect(204);
    await ctx.http.get(`/api/v1/users/${bob.id}`).set(as(admin)).expect(404);
  });
});

describe('customers (e2e)', () => {
  it('supports CRUD for signed-in users; delete is admin only', async () => {
    await ctx.http.get('/api/v1/customers').expect(401);

    const created = await ctx.http
      .post('/api/v1/customers')
      .set(as(alice.token))
      .send({
        firstName: 'Somchai',
        lastName: 'Jaidee',
        email: 'Somchai@Example.com',
        phone: '+66 81 234 5678',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      email: 'somchai@example.com',
      isActive: true,
    });
    const id = created.body.id as string;

    await ctx.http
      .post('/api/v1/customers')
      .set(as(alice.token))
      .send({
        firstName: 'Other',
        lastName: 'Person',
        email: 'somchai@example.com',
      })
      .expect(409);
    await ctx.http
      .post('/api/v1/customers')
      .set(as(alice.token))
      .send({
        firstName: 'Bad',
        lastName: 'Phone',
        email: 'p@example.com',
        phone: 'call me',
      })
      .expect(400);

    const updated = await ctx.http
      .patch(`/api/v1/customers/${id}`)
      .set(as(alice.token))
      .send({ phone: '02 123 4567' })
      .expect(200);
    expect(updated.body).toMatchObject({
      phone: '02 123 4567',
      firstName: 'Somchai',
    });

    const list = await ctx.http
      .get('/api/v1/customers')
      .set(as(alice.token))
      .expect(200);
    expect(list.body.meta.total).toBe(1);

    await ctx.http
      .delete(`/api/v1/customers/${id}`)
      .set(as(alice.token))
      .expect(403);
    await ctx.http.delete(`/api/v1/customers/${id}`).set(as(admin)).expect(204);
    await ctx.http
      .get(`/api/v1/customers/${id}`)
      .set(as(alice.token))
      .expect(404);
  });
});
