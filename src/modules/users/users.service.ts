import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { isUniqueViolation } from '../../common/database-errors.js';
import {
  paginate,
  type Paginated,
  type PaginationQueryDto,
} from '../../common/dto/pagination.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { Role, User } from './user.entity.js';

export interface NewUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Drops undefined fields so a partial update never blanks a column. */
export const definedOnly = <T extends object>(dto: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(dto).filter(([, v]) => v !== undefined),
  ) as Partial<T>;

const canAccess = (actor: AuthUser, id: string): boolean =>
  actor.role === Role.Admin || actor.id === id;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  async create(data: NewUser): Promise<User> {
    if (await this.repo.existsBy({ email: data.email })) {
      throw new ConflictException('Email already exists');
    }
    try {
      return await this.repo.save(
        this.repo.create({ ...data, role: Role.User }),
      );
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException('Email already exists');
      throw err;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  /** Admin only (enforced by @Roles on the route). Newest first. */
  async findAll(query: PaginationQueryDto): Promise<Paginated<User>> {
    const [users, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(users, total, query);
  }

  /** Users may read themselves; admins anyone. */
  async findOne(actor: AuthUser, id: string): Promise<User> {
    if (!canAccess(actor, id))
      throw new ForbiddenException('Insufficient permissions');
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Users may edit their profile; only admins change role or isActive. */
  async update(actor: AuthUser, id: string, dto: UpdateUserDto): Promise<User> {
    if (
      (dto.role !== undefined || dto.isActive !== undefined) &&
      actor.role !== Role.Admin
    ) {
      throw new ForbiddenException('Only admins can change role or isActive');
    }
    const user = await this.findOne(actor, id);

    if (
      dto.email &&
      dto.email !== user.email &&
      (await this.repo.existsBy({ email: dto.email }))
    ) {
      throw new ConflictException('Email already exists');
    }
    Object.assign(user, definedOnly(dto));
    // Deactivating an account also ends its refresh-token session.
    if (dto.isActive === false) user.refreshTokenHash = null;

    try {
      return await this.repo.save(user);
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException('Email already exists');
      throw err;
    }
  }

  /** Users may delete themselves; admins anyone. */
  async remove(actor: AuthUser, id: string): Promise<void> {
    if (!canAccess(actor, id))
      throw new ForbiddenException('Insufficient permissions');
    const { affected } = await this.repo.delete({ id });
    if (!affected) throw new NotFoundException('User not found');
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.repo.update({ id }, { refreshTokenHash: hash });
  }

  /**
   * Swaps the stored refresh-token hash only if it still equals `expected`,
   * in one statement, so a token can be used once even under concurrency.
   */
  async replaceRefreshTokenHash(
    id: string,
    expected: string,
    next: string,
  ): Promise<boolean> {
    const { affected } = await this.repo.update(
      { id, refreshTokenHash: expected },
      { refreshTokenHash: next },
    );
    return affected === 1;
  }
}
