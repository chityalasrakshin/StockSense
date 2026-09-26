import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('StockSenseBootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const cookieSecret = configService.get<string>(
    'COOKIE_SECRET',
    'stocksense_cookie_secret_dev_key_32_chars_123',
  );

  // Helmet security headers
  app.use(helmet());

  // Cookie parser middleware for httpOnly refresh tokens
  app.use(cookieParser(cookieSecret));

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix: /api/v1 (exclude swagger docs)
  app.setGlobalPrefix('api/v1', {
    exclude: ['api/docs', 'api/docs/(.*)'],
  });

  // Global input validation pipe via class-validator DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter with standard error envelope
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger / OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('StockSense API')
    .setDescription(
      'StockSense Inventory Management System — OpenAPI Specification\n\n' +
        'Core endpoints for Authentication, OTP Password Reset, RBAC Verification, and User Management.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT access token (~15min TTL)',
      },
      'bearer',
    )
    .addTag('Health', 'System health checks')
    .addTag('Auth', 'Authentication, JWT rotation, and OTP password reset')
    .addTag('Users', 'User CRUD and RBAC role verification (Manager vs Staff)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'StockSense API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  logger.log(`StockSense API server running on port: ${port}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
  logger.log(`Health check endpoint: http://localhost:${port}/api/v1/health`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during backend bootstrap:', err);
  process.exit(1);
});
