import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { UomsService } from './uoms.service';
import { CreateUomDto } from './dtos/create-uom.dto';
import { UpdateUomDto } from './dtos/update-uom.dto';
import { UomItemDto } from './dtos/uom-response.dto';

@ApiTags('Units of Measure')
@ApiBearerAuth()
@Controller('uoms')
export class UomsController {
  constructor(private readonly uomsService: UomsService) {}

  @ApiOperation({
    summary: 'Create unit of measure (Inventory Manager only)',
    description: 'Registers a new unit of measure code and descriptive name for inventory tracking.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: UomItemDto })
  @ApiConflictResponse({ description: 'Unit of measure code already exists' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async create(@Body() dto: CreateUomDto): Promise<UomItemDto> {
    return this.uomsService.create(dto);
  }

  @ApiOperation({
    summary: 'List all units of measure (Manager & Staff)',
    description: 'Returns all available units of measure with associated product count.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [UomItemDto] })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async findAll(): Promise<UomItemDto[]> {
    return this.uomsService.findAll();
  }

  @ApiOperation({
    summary: 'Get unit of measure by ID (Manager & Staff)',
    description: 'Retrieves single unit of measure metadata by unique ID.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: UomItemDto })
  @ApiNotFoundResponse({ description: 'Unit of measure not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UomItemDto> {
    return this.uomsService.findOne(id);
  }

  @ApiOperation({
    summary: 'Update unit of measure (Inventory Manager only)',
    description: 'Modifies unit of measure code or name.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: UomItemDto })
  @ApiConflictResponse({ description: 'Code collision with existing UoM' })
  @ApiNotFoundResponse({ description: 'Unit of measure not found' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUomDto,
  ): Promise<UomItemDto> {
    return this.uomsService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Delete unit of measure (Inventory Manager only)',
    description:
      'Deletes a unit of measure. Blocked (HTTP 409) if any active products are assigned to this UoM.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'UoM successfully deleted' })
  @ApiConflictResponse({
    description: 'Conflict: UoM is currently assigned to existing products',
  })
  @ApiNotFoundResponse({ description: 'Unit of measure not found' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.uomsService.remove(id);
  }
}
