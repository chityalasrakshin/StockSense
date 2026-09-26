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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { CategoryItemDto, CategoryTreeNodeDto } from './dtos/category-response.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({
    summary: 'Create category (Inventory Manager only)',
    description: 'Creates a new product category, optionally specifying a parent category ID for nested tree organization.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: CategoryItemDto })
  @ApiConflictResponse({ description: 'Category with name already exists' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryItemDto> {
    return this.categoriesService.create(dto);
  }

  @ApiOperation({
    summary: 'Get category tree hierarchy (Manager & Staff)',
    description: 'Returns the recursive category hierarchy starting from top-level root categories.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [CategoryTreeNodeDto] })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('tree')
  async getTree(): Promise<CategoryTreeNodeDto[]> {
    return this.categoriesService.getTree();
  }

  @ApiOperation({
    summary: 'List all categories (Manager & Staff)',
    description: 'Returns flat list of all categories with parent relationships and counts of assigned products.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [CategoryItemDto] })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async findAll(): Promise<CategoryItemDto[]> {
    return this.categoriesService.findAll();
  }

  @ApiOperation({
    summary: 'Get category details by ID (Manager & Staff)',
    description: 'Retrieves single category metadata including its parent and immediate child categories.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: CategoryItemDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<CategoryItemDto> {
    return this.categoriesService.findOne(id);
  }

  @ApiOperation({
    summary: 'Update category (Inventory Manager only)',
    description: 'Modifies category name or moves category to a new parent in the hierarchy tree.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: CategoryItemDto })
  @ApiConflictResponse({ description: 'Name collision or circular hierarchy detected' })
  @ApiNotFoundResponse({ description: 'Category or parent not found' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryItemDto> {
    return this.categoriesService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Delete category (Inventory Manager only)',
    description:
      'Deletes a category. Operation is strictly blocked (HTTP 409) if any products are assigned or sub-categories exist.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Category successfully deleted' })
  @ApiConflictResponse({
    description: 'Conflict: Category is referenced by active products or has child sub-categories',
  })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.categoriesService.remove(id);
  }
}
