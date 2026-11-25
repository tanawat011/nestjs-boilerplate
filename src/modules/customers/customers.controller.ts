import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  PaginationQueryDto,
  type Paginated,
} from '../../common/dto/pagination.dto.js';
import { Role } from '../users/user.entity.js';
import { Customer } from './customer.entity.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto.js';

/** Any signed-in user may read, create and edit customers; only admins delete. */
@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto): Promise<Paginated<Customer>> {
    return this.customers.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: Customer })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Customer> {
    return this.customers.findOne(id);
  }

  @Post()
  @ApiCreatedResponse({ type: Customer })
  create(@Body() dto: CreateCustomerDto): Promise<Customer> {
    return this.customers.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: Customer })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customers.update(id, dto);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.customers.remove(id);
  }
}
