import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WarehousesService } from './warehouses.service';
import { CreateLocationDto } from './dtos/create-location.dto';
import { UpdateLocationDto } from './dtos/update-location.dto';
import { QueryLocationsDto } from './dtos/query-locations.dto';
import { LocationItemDto, LocationTreeNodeDto } from './dtos/location-response.dto';

@ApiTags('Warehouses')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @ApiOperation({
    summary: 'Create warehouse / location (Inventory Manager only)',
    description:
      'Creates a location node in the self-referencing warehouse tree (WAREHOUSE, ZONE, RACK, BIN).',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: LocationItemDto })
  @ApiConflictResponse({ description: 'Short code already exists' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async create(@Body() dto: CreateLocationDto): Promise<LocationItemDto> {
    return this.warehousesService.create(dto);
  }

  @ApiOperation({
    summary: 'Get hierarchical warehouse tree (Manager & Staff)',
    description:
      'Returns the full nested hierarchy of warehouses, zones, racks, and bins modeled after ERPNext tree structure.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [LocationTreeNodeDto] })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('tree')
  async getTree(): Promise<LocationTreeNodeDto[]> {
    return this.warehousesService.getTree();
  }

  @ApiOperation({
    summary: 'List locations with optional filters (Manager & Staff)',
    description:
      'Returns list of locations with optional filtering by type, parent location, or search keyword.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [LocationItemDto] })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async findAll(@Query() query: QueryLocationsDto): Promise<LocationItemDto[]> {
    return this.warehousesService.findAll(query);
  }

  @ApiOperation({
    summary: 'Get location details by ID (Manager & Staff)',
    description: 'Retrieves location details including parent and immediate child locations.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: LocationItemDto })
  @ApiNotFoundResponse({ description: 'Location not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<LocationItemDto> {
    return this.warehousesService.findOne(id);
  }

  @ApiOperation({
    summary: 'Update location (Inventory Manager only)',
    description: 'Updates location name, short code, type, or parent location in the hierarchy.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: LocationItemDto })
  @ApiConflictResponse({ description: 'Short code collision or circular hierarchy detected' })
  @ApiNotFoundResponse({ description: 'Location or parent not found' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationItemDto> {
    return this.warehousesService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Delete location (Inventory Manager only)',
    description:
      'Deletes a warehouse location. Blocked (HTTP 409) if it contains child locations, non-zero stock balances, document references, or ledger entries.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Location successfully deleted' })
  @ApiConflictResponse({
    description:
      'Conflict: Location has child sub-locations, active inventory, or workflow document references',
  })
  @ApiNotFoundResponse({ description: 'Location not found' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.warehousesService.remove(id);
  }
}
