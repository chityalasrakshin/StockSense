import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('StockSenseBootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix: /api/v1 (exclude swagger docs)
  app.setGlobalPrefix('api/v1', {
    exclude: ['api/docs', 'api/docs/(.*)'],
  });

  // Global exception filter with standard error envelope
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger / OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('StockSense API')
    .setDescription('StockSense Inventory Management System — OpenAPI / Swagger Specification')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Health', 'System health checks')
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
