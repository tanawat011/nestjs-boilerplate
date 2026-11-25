import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { MemoryRepository } from '../../../test/support/memory-repository.js';
import { Role, type User } from './user.entity.js';
import { UsersService } from './users.service.js';

describe('UsersService access rules', () => {
  let users: UsersService;
  let alice: AuthUser;
  let bob: AuthUser;
  let admin: AuthUser;

  beforeEach(async () => {
    const repo = new MemoryRepository<User & { id: string }>();
    users = new UsersService(repo as unknown as Repository<User>);
    const make = async (name: string) =>
      users.create({
        email: `${name}@example.com`,
        password: 'hash',
        firstName: name,
        lastName: 'X',
      });
    alice = { id: (await make('alice')).id, role: Role.User };
    bob = { id: (await make('bob')).id, role: Role.User };
    const root = await make('root');
    await users.update({ id: root.id, role: Role.Admin }, root.id, {
      role: Role.Admin,
    });
    admin = { id: root.id, role: Role.Admin };
  });

  it('lets users read themselves and admins anyone', async () => {
    expect((await users.findOne(alice, alice.id)).firstName).toBe('alice');
    await expect(users.findOne(alice, bob.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect((await users.findOne(admin, bob.id)).firstName).toBe('bob');
    await expect(
      users.findOne(admin, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pages newest first', async () => {
    const page = await users.findAll({ page: 1, limit: 2 });
    expect(page.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(page.data.map((u) => u.firstName)).toEqual(['root', 'bob']);
  });

  it('lets users edit their profile, never their role or status', async () => {
    const updated = await users.update(alice, alice.id, {
      firstName: 'Alicia',
    });
    expect(updated).toMatchObject({
      firstName: 'Alicia',
      lastName: 'X',
      email: 'alice@example.com',
    });

    await expect(
      users.update(alice, bob.id, { firstName: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.update(alice, alice.id, { role: Role.Admin }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.update(alice, alice.id, { isActive: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.update(alice, alice.id, { email: 'bob@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ends the session of a deactivated account', async () => {
    await users.setRefreshTokenHash(bob.id, 'a'.repeat(64));
    const updated = await users.update(admin, bob.id, { isActive: false });
    expect(updated.isActive).toBe(false);
    expect(updated.refreshTokenHash).toBeNull();
  });

  it('lets users delete themselves and admins anyone', async () => {
    await expect(users.remove(alice, bob.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await users.remove(alice, alice.id);
    await expect(users.findOne(admin, alice.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(users.remove(admin, alice.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('swaps a refresh-token hash only if it still matches', async () => {
    await users.setRefreshTokenHash(alice.id, 'old');
    expect(await users.replaceRefreshTokenHash(alice.id, 'old', 'new')).toBe(
      true,
    );
    expect(await users.replaceRefreshTokenHash(alice.id, 'old', 'newer')).toBe(
      false,
    );
  });
});
