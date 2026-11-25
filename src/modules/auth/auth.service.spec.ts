import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { Repository } from 'typeorm';
import { testConfig } from '../../../test/support/config.js';
import { MemoryRepository } from '../../../test/support/memory-repository.js';
import type { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';

const config = testConfig();

const setup = () => {
  const repo = new MemoryRepository<User & { id: string }>();
  const users = new UsersService(repo as unknown as Repository<User>);
  const tokens = new TokenService(new JwtService(), config);
  return { repo, tokens, auth: new AuthService(users, tokens, config) };
};

const alice = {
  email: 'alice@example.com',
  password: 'correct-horse',
  firstName: 'Alice',
  lastName: 'L',
};

describe('AuthService', () => {
  it('registers with a bcrypt hash and the user role', async () => {
    const { auth, repo } = setup();
    const user = await auth.register(alice);
    expect(user.role).toBe('user');
    const stored = repo.rows[0];
    expect(stored.password).not.toBe('correct-horse');
    expect(await bcrypt.compare('correct-horse', stored.password)).toBe(true);
  });

  it('refuses a taken email and passwords over 72 bytes', async () => {
    const { auth } = setup();
    await auth.register(alice);
    await expect(auth.register(alice)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      auth.register({
        ...alice,
        email: 'bob@example.com',
        password: 'ก'.repeat(25),
      }), // 75 bytes
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logs in, storing only a hash of the refresh token', async () => {
    const { auth, repo, tokens } = setup();
    const user = await auth.register(alice);
    const pair = await auth.login({
      email: alice.email,
      password: alice.password,
    });

    expect(await tokens.verifyAccess(pair.accessToken)).toEqual({
      id: user.id,
      role: 'user',
    });
    expect(repo.rows[0].refreshTokenHash).toBe(
      TokenService.hash(pair.refreshToken),
    );
  });

  it('gives the same 401 for a wrong password and an unknown email; 403 when disabled', async () => {
    const { auth, repo } = setup();
    await auth.register(alice);
    await expect(
      auth.login({ email: alice.email, password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.login({ email: 'nobody@example.com', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    repo.rows[0].isActive = false;
    await expect(
      auth.login({ email: alice.email, password: alice.password }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rotates refresh tokens and signs out everywhere when one is reused', async () => {
    const { auth, repo } = setup();
    await auth.register(alice);
    const first = await auth.login({
      email: alice.email,
      password: alice.password,
    });

    const second = await auth.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // The first token was already used: treat it as stolen.
    await expect(auth.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(repo.rows[0].refreshTokenHash).toBeNull();
    // ...which also ends the legitimate session.
    await expect(auth.refresh(second.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses refresh after logout and for access tokens', async () => {
    const { auth, repo } = setup();
    await auth.register(alice);
    const pair = await auth.login({
      email: alice.email,
      password: alice.password,
    });

    await expect(auth.refresh(pair.accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await auth.logout(repo.rows[0].id);
    await expect(auth.refresh(pair.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
