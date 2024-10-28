import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.repo.find();
  }

  async findOne(id: number): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .select(['user.id', 'user.username', 'user.firstName', 'user.lastName'])
      .getOne();
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.repo.findOneBy({ username });
  }

  async create(user: User): Promise<User> {
    return this.repo.save(user);
  }

  async update(id: number, user: User): Promise<User> {
    await this.repo.update(id, user);
    return this.repo
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .select(['user.id', 'user.username', 'user.firstName', 'user.lastName'])
      .getOne();
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
