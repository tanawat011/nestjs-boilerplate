import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUTH_THROTTLE_KEY } from './common/decorators/auth-throttle.decorator.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import {
  validateEnv,
  type EnvironmentVariables,
} from './config/env.validation.js';
import { databaseOptions } from './database/data-source.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { UsersModule } from './modules/users/users.module.js';

type Config = ConfigService<EnvironmentVariables, true>;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: Config) =>
        databaseOptions({
          POSTGRES_HOST: config.get('POSTGRES_HOST', { infer: true }),
          POSTGRES_PORT: config.get('POSTGRES_PORT', { infer: true }),
          POSTGRES_USERNAME: config.get('POSTGRES_USERNAME', { infer: true }),
          POSTGRES_PASSWORD: config.get('POSTGRES_PASSWORD', { infer: true }),
          POSTGRES_DATABASE: config.get('POSTGRES_DATABASE', { infer: true }),
          POSTGRES_SSL: config.get('POSTGRES_SSL', { infer: true }),
        }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: Config) => ({
        throttlers: [
          // Every route (health excepted): THROTTLE_LIMIT per minute per client.
          {
            name: 'default',
            ttl: 60_000,
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
          // Routes marked @AuthThrottle(): AUTH_THROTTLE_LIMIT per minute.
          {
            name: 'auth',
            ttl: 60_000,
            limit: config.get('AUTH_THROTTLE_LIMIT', { infer: true }),
            skipIf: (ctx) =>
              Reflect.getMetadata(AUTH_THROTTLE_KEY, ctx.getHandler()) !== true,
          },
        ],
      }),
    }),
    AuthModule,
    UsersModule,
    CustomersModule,
    HealthModule,
  ],
  providers: [
    // Order matters: rate limit, then authentication, then roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Honours @Exclude() on entities (password, refresh token hash).
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule {}
