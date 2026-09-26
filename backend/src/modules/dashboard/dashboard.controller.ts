import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { AlertsQueryDto } from './dtos/alerts.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis')
  async kpis() { return this.dashboard.getKpis(); }
  async getKpis() { return this.kpis(); }

  @Get('filters')
  async filters() { return this.dashboard.getFiltersMetadata(); }
  async getFiltersMetadata() { return this.filters(); }

  @Get('alerts')
  async alerts(@Query() query: AlertsQueryDto) { return this.dashboard.getAlerts(query); }
  async getAlerts(@Query() query: AlertsQueryDto) { return this.alerts(query); }
}
