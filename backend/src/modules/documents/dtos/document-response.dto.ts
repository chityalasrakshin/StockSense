import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { ProductItemDto } from '../../products/dtos/product-response.dto';
import { LocationItemDto } from '../../warehouses/dtos/location-response.dto';
import { UserItemDto } from '../../users/dtos/user-response.dto';

export class DocumentLineItemDto {
  @ApiProperty({ example: 'f0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'd0000000-0000-0000-0000-000000000001' })
  documentId!: string;

  @ApiProperty({ example: 'p0000000-0000-0000-0000-000000000001' })
  productId!: string;

  @ApiProperty({ example: 100 })
  expectedQty!: number;

  @ApiPropertyOptional({ example: 100, nullable: true })
  actualQty!: number | null;

  @ApiPropertyOptional({ type: () => ProductItemDto })
  product?: ProductItemDto;
}

export class DocumentItemDto {
  @ApiProperty({ example: 'd0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'WH/IN/00001' })
  reference!: string;

  @ApiProperty({ enum: DocumentType, example: DocumentType.RECEIPT })
  type!: DocumentType;

  @ApiProperty({ enum: DocumentStatus, example: DocumentStatus.DRAFT })
  status!: DocumentStatus;

  @ApiPropertyOptional({ example: null, nullable: true })
  sourceLocationId!: string | null;

  @ApiPropertyOptional({ example: 'l0000000-0000-0000-0000-000000000001', nullable: true })
  destLocationId!: string | null;

  @ApiPropertyOptional({ example: 'Vandertramp Steels Ltd.', nullable: true })
  contact!: string | null;

  @ApiPropertyOptional({ example: 'PO-2026-STEEL-001', nullable: true })
  partnerRef!: string | null;

  @ApiPropertyOptional({ example: '2026-09-28T09:00:00.000Z', nullable: true })
  scheduleDate!: Date | null;

  @ApiProperty({ example: 'a0000000-0000-0000-0000-000000000001' })
  createdById!: string;

  @ApiProperty({ example: 'a0000000-0000-0000-0000-000000000002' })
  responsibleUserId!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  validatedById!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  validatedAt!: Date | null;

  @ApiProperty({ example: '2026-09-26T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-26T12:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => LocationItemDto, nullable: true })
  sourceLocation?: LocationItemDto | null;

  @ApiPropertyOptional({ type: () => LocationItemDto, nullable: true })
  destLocation?: LocationItemDto | null;

  @ApiPropertyOptional({ type: () => UserItemDto })
  createdBy?: UserItemDto;

  @ApiPropertyOptional({ type: () => UserItemDto })
  responsibleUser?: UserItemDto;

  @ApiPropertyOptional({ type: () => UserItemDto, nullable: true })
  validatedBy?: UserItemDto | null;

  @ApiPropertyOptional({ type: () => [DocumentLineItemDto] })
  lines?: DocumentLineItemDto[];
}

export class DocumentPaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 5 })
  totalItems!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedDocumentsDto {
  @ApiProperty({ type: () => [DocumentItemDto] })
  items!: DocumentItemDto[];

  @ApiProperty({ type: () => DocumentPaginationMetaDto })
  meta!: DocumentPaginationMetaDto;
}
