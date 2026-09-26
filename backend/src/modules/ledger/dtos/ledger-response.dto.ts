import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType, DocumentStatus, LocationType, Role } from '@prisma/client';

export class LedgerProductDto {
  @ApiProperty({ example: 'p0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'STEEL-ROD-001' })
  sku!: string;

  @ApiProperty({ example: 'Steel Rods' })
  name!: string;
}

export class LedgerLocationDto {
  @ApiProperty({ example: 'l0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'WH' })
  shortCode!: string;

  @ApiProperty({ example: 'Main Warehouse' })
  name!: string;

  @ApiProperty({ enum: LocationType, example: LocationType.WAREHOUSE })
  type!: LocationType;
}

export class LedgerDocumentDto {
  @ApiProperty({ example: 'd0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'WH/IN/00001' })
  reference!: string;

  @ApiProperty({ enum: DocumentType, example: DocumentType.RECEIPT })
  type!: DocumentType;

  @ApiProperty({ enum: DocumentStatus, example: DocumentStatus.DONE })
  status!: DocumentStatus;
}

export class LedgerActorDto {
  @ApiProperty({ example: 'a0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'staff@stocksense.dev' })
  email!: string;

  @ApiProperty({ enum: Role, example: Role.WAREHOUSE_STAFF })
  role!: Role;
}

export class StockLedgerEntryDto {
  @ApiProperty({ example: 'e0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'p0000000-0000-0000-0000-000000000001' })
  productId!: string;

  @ApiProperty({ example: 'l0000000-0000-0000-0000-000000000001' })
  locationId!: string;

  @ApiPropertyOptional({ example: 'd0000000-0000-0000-0000-000000000001', nullable: true })
  documentId!: string | null;

  @ApiProperty({ example: 100, description: 'Net inventory delta (positive for inflow, negative for outflow)' })
  qtyDelta!: number;

  @ApiProperty({ example: 100, description: 'Running balance of on-hand inventory immediately following this movement' })
  balanceAfter!: number;

  @ApiProperty({ example: '2026-09-26T12:00:00.000Z' })
  postedAt!: Date;

  @ApiProperty({ example: 'a0000000-0000-0000-0000-000000000001' })
  actorId!: string;

  @ApiPropertyOptional({ type: () => LedgerProductDto })
  product?: LedgerProductDto;

  @ApiPropertyOptional({ type: () => LedgerLocationDto })
  location?: LedgerLocationDto;

  @ApiPropertyOptional({ type: () => LedgerDocumentDto, nullable: true })
  document?: LedgerDocumentDto | null;

  @ApiPropertyOptional({ type: () => LedgerActorDto })
  actor?: LedgerActorDto;
}

export class LedgerPaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 5 })
  totalItems!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedLedgerDto {
  @ApiProperty({ type: () => [StockLedgerEntryDto] })
  items!: StockLedgerEntryDto[];

  @ApiProperty({ type: () => LedgerPaginationMetaDto })
  meta!: LedgerPaginationMetaDto;
}
