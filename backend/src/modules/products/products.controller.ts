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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { QueryProductsDto, SearchProductsDto } from './dtos/query-products.dto';
import {
  PaginatedProductsDto,
  ProductItemDto,
  ProductSearchResultDto,
} from './dtos/product-response.dto';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({
    summary: 'Smart fuzzy search for products (Manager & Staff)',
    description:
      'High-performance trigram fuzzy search using pg_trgm GIN index on SKU and product name. Returns ranked relevance matches.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [ProductSearchResultDto] })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('search')
  async search(@Query() searchDto: SearchProductsDto): Promise<ProductSearchResultDto[]> {
    return this.productsService.search(
      searchDto.q || '',
      searchDto.limit,
      searchDto.offset,
    );
  }

  @ApiOperation({
    summary: 'Create product (Inventory Manager only)',
    description:
      'Registers a new product master record with unique SKU, pricing, category, and UoM. If initialStock is specified (> 0), creates the initial stock_ledger entry and stock_balances row atomically.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: ProductItemDto })
  @ApiConflictResponse({ description: 'Product with SKU already exists' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: { id: string },
  ): Promise<ProductItemDto> {
    return this.productsService.create(dto, user.id);
  }

  @ApiOperation({
    summary: 'List products with filters and pagination (Manager & Staff)',
    description:
      'Returns paginated products with category, UoM, aggregated total stock on hand across all locations, and low-stock indicator.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedProductsDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async findAll(@Query() query: QueryProductsDto): Promise<PaginatedProductsDto> {
    return this.productsService.findAll(query);
  }

  @ApiOperation({
    summary: 'Get product details by ID (Manager & Staff)',
    description:
      'Retrieves complete product record including category, UoM, and breakdown of stock balances across all warehouse locations.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: ProductItemDto })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ProductItemDto> {
    return this.productsService.findOne(id);
  }

  @ApiOperation({
    summary: 'Update product (Inventory Manager only)',
    description: 'Modifies product properties like SKU, name, unit cost, reorder rules, category, or UoM.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: ProductItemDto })
  @ApiConflictResponse({ description: 'SKU collision with existing product' })
  @ApiNotFoundResponse({ description: 'Product, category, or UoM not found' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductItemDto> {
    return this.productsService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Delete product (Inventory Manager only)',
    description:
      'Deletes a product. Strictly blocked (HTTP 409) if stock ledger entries or document lines exist.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product successfully deleted' })
  @ApiConflictResponse({
    description: 'Conflict: Product has stock movement history or active document lines',
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.productsService.remove(id);
  }
}
