import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto, RegisterDto } from './dto/auth.dto.js';
import { TokenService, type TokenPair } from './token.service.js';

/** bcrypt only reads the first 72 bytes; longer passwords are refused. */
const MAX_PASSWORD_BYTES = 72;

@Injectable()
export class AuthService {
  private readonly rounds: number;
  private readonly dummyHash: string;

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.rounds = config.get('BCRYPT_ROUNDS', { infer: true });
    // Compared against when the email is unknown, so a failed login takes the
    // same time whether or not the account exists.
    this.dummyHash = bcrypt.hashSync('timing-equaliser', this.rounds);
  }

  async register(dto: RegisterDto): Promise<User> {
    if (Buffer.byteLength(dto.password, 'utf8') > MAX_PASSWORD_BYTES) {
      throw new BadRequestException(['password must be at most 72 bytes']);
    }
    return this.users.create({
      email: dto.email,
      password: await bcrypt.hash(dto.password, this.rounds),
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      await bcrypt.compare(dto.password, this.dummyHash);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) throw new ForbiddenException('Account is disabled');

    const pair = await this.tokens.issuePair({ id: user.id, role: user.role });
    await this.users.setRefreshTokenHash(
      user.id,
      TokenService.hash(pair.refreshToken),
    );
    return pair;
  }

  /**
   * Exchanges a refresh token for a new pair and invalidates the old one
   * (rotation). Presenting an already-used refresh token signs the user out
   * everywhere: it means the token was copied.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const userId = await this.tokens.verifyRefresh(refreshToken);
    const user = userId ? await this.users.findById(userId) : null;
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const presented = TokenService.hash(refreshToken);
    const pair = await this.tokens.issuePair({ id: user.id, role: user.role });
    const rotated = await this.users.replaceRefreshTokenHash(
      user.id,
      presented,
      TokenService.hash(pair.refreshToken),
    );
    if (!rotated) {
      await this.users.setRefreshTokenHash(user.id, null);
      throw new UnauthorizedException(
        'Refresh token was already used; signed out everywhere',
      );
    }
    return pair;
  }

  async logout(userId: string): Promise<void> {
    await this.users.setRefreshTokenHash(userId, null);
  }
}
