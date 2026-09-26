import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { DashboardKpisDto } from './dtos/dashboard-kpis.dto';
import { FiltersMetadataDto } from './dtos/filters-metadata.dto';
import { AlertsQueryDto, PaginatedAlertsDto } from './dtos/alerts.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({
    summary: 'Get dashboard KPI operational summary (Manager & Staff)',
    description:
      'Returns aggregate inventory indicators: Total Products in Stock, Low Stock / Out of Stock Items, Pending Receipts, Pending Deliveries, and Internal Transfers Scheduled. Aggregated efficiently from derived read models with short-TTL Redis caching.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: DashboardKpisDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('kpis')
  async getKpis(): Promise<DashboardKpisDto> {
    return this.dashboardService.getKpis();
  }

  @ApiOperation({
    summary: 'Get dynamic filter options for documents and catalog (Manager & Staff)',
    description:
      'Returns dynamic filter options (Document types, Statuses, Warehouses/Locations, Product categories) per the StockSense problem specification.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: FiltersMetadataDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('filters-metadata')
  async getFiltersMetadata(): Promise<FiltersMetadataDto> {
    return this.dashboardService.getFiltersMetadata();
  }

  @ApiOperation({
    summary: 'Get paginated low-stock alerts list (Manager & Staff)',
    description:
      'Backs the "Low Stock / Out of Stock Items" KPI drill-down view. Filterable by OPEN / RESOLVED state, with SKU/name search.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAlertsDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('alerts')
  async getAlerts(@Query() query: AlertsQueryDto): Promise<PaginatedAlertsDto> {
    return this.dashboardService.getAlerts(query);
  }
}
