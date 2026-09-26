import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { JsonLoggerService } from './json-logger.service';

@Global()
@Module({ controllers: [MetricsController], providers: [MetricsService, JsonLoggerService], exports: [MetricsService, JsonLoggerService] })
export class ObservabilityModule {}
