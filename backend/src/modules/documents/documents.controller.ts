import {
  Body,
  Controller,
  Get,
  Headers,
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
  ApiHeader,
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
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dtos/create-document.dto';
import { UpdateDocumentDto } from './dtos/update-document.dto';
import { QueryDocumentsDto } from './dtos/query-documents.dto';
import { DocumentItemDto, PaginatedDocumentsDto } from './dtos/document-response.dto';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @ApiOperation({
    summary: 'Create document draft (Manager or Staff for RECEIPT/DELIVERY/TRANSFER; Manager only for ADJUSTMENT)',
    description:
      'Creates a new workflow document in DRAFT status with specified line items and locations. Auto-generates sequence reference if omitted.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: DocumentItemDto })
  @ApiForbiddenResponse({ description: 'Warehouse staff attempting to create ADJUSTMENT' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async create(
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<DocumentItemDto> {
    return this.documentsService.create(dto, user);
  }

  @ApiOperation({
    summary: 'List documents with filters (Manager & Staff)',
    description:
      'Retrieves paginated documents with filtering by type, lifecycle status (DRAFT, WAITING, READY, DONE, CANCELED), or search keywords.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedDocumentsDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async findAll(@Query() query: QueryDocumentsDto): Promise<PaginatedDocumentsDto> {
    return this.documentsService.findAll(query);
  }

  @ApiOperation({
    summary: 'Get document details by ID (Manager & Staff)',
    description: 'Retrieves complete document metadata including line items, locations, and audit actors.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: DocumentItemDto })
  @ApiNotFoundResponse({ description: 'Document not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<DocumentItemDto> {
    return this.documentsService.findOne(id);
  }

  @ApiOperation({
    summary: 'Update document lines or advance status (Manager & Staff)',
    description:
      'Edits lines or transitions status (DRAFT → WAITING → READY, or CANCELED). Edits are strictly rejected once DONE or CANCELED.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: DocumentItemDto })
  @ApiConflictResponse({ description: 'Invalid status transition or document already in terminal state' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<DocumentItemDto> {
    return this.documentsService.update(id, dto, user);
  }

  @ApiOperation({
    summary: 'Validate document & post to Stock Ledger (Manager & Staff)',
    description:
      'THE critical transactional endpoint: executes document movement, posts immutable stock_ledger entries, updates stock_balances with SELECT ... FOR UPDATE pessimistic row locks, and transitions status to DONE.\n\nAccepts an Idempotency-Key header to safely handle network retries without double-posting inventory.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Optional unique client UUID to prevent duplicate stock mutations on network retries',
  })
  @ApiResponse({ status: HttpStatus.OK, type: DocumentItemDto })
  @ApiConflictResponse({
    description: 'Document already validated, or insufficient stock for outgoing dispatch',
  })
  @ApiNotFoundResponse({ description: 'Document not found' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/validate')
  async validate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Headers('idempotency-key') headerKeyLower?: string,
    @Headers('Idempotency-Key') headerKeyUpper?: string,
  ): Promise<DocumentItemDto> {
    const idempotencyKey = headerKeyLower || headerKeyUpper;
    return this.documentsService.validate(id, user.id, idempotencyKey);
  }
}
