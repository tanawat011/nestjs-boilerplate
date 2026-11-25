import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/database-errors.js';
import {
  paginate,
  type Paginated,
  type PaginationQueryDto,
} from '../../common/dto/pagination.dto.js';
import { definedOnly } from '../users/users.service.js';
import { Customer } from './customer.entity.js';
import type {
  CreateCustomerDto,
  UpdateCustomerDto,
} from './dto/customer.dto.js';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<Paginated<Customer>> {
    const [rows, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(rows, total, query);
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.repo.findOneBy({ id });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    return this.save(
      this.repo.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone ?? null,
      }),
    );
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    Object.assign(customer, definedOnly(dto));
    return this.save(customer);
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.repo.delete({ id });
    if (!affected) throw new NotFoundException('Customer not found');
  }

  private async save(customer: Customer): Promise<Customer> {
    try {
      return await this.repo.save(customer);
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException(
          'A customer with this email already exists',
        );
      throw err;
    }
  }
}
