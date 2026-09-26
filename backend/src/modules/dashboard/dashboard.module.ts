import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardCacheService } from './services/dashboard-cache.service';

@Module({ imports: [PrismaModule], controllers: [DashboardController], providers: [DashboardService, DashboardCacheService] })
export class DashboardModule {}
