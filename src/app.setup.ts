import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import {
  parseList,
  parseTrustProxy,
  type EnvironmentVariables,
} from './config/env.validation.js';

/**
 * Everything main.ts applies to the app, shared with the e2e tests so they
 * exercise the same pipeline.
 */
export function configureApp(app: NestExpressApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Only trust X-Forwarded-For from the proxies in TRUST_PROXY; the rate
  // limiter keys on the resulting client IP.
  app.set(
    'trust proxy',
    parseTrustProxy(config.get('TRUST_PROXY', { infer: true })),
  );
  app.use(helmet());

  const origins = parseList(config.get('CORS_ORIGINS', { infer: true }));
  if (origins.length > 0) {
    // Bearer tokens, not cookies: credentials are never allowed.
    app.enableCors({ origin: origins.includes('*') ? '*' : origins });
  }

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const swagger =
    config.get('SWAGGER_ENABLED', { infer: true }) ??
    config.get('NODE_ENV', { infer: true }) !== 'production';
  if (swagger) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('NestJS Boilerplate API')
        .setDescription(
          'Auth (access + refresh tokens), users with roles, customers',
        )
        .setVersion('2.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }
}
