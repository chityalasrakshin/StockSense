import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateDocumentLineDto {
  @ApiProperty({
    description: 'UUID of the product to move or count',
    example: 'p0000000-0000-0000-0000-000000000001',
  })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description: 'Expected quantity of product according to order or transfer dispatch',
    example: 100,
  })
  @IsInt()
  @Min(1)
  expectedQty!: number;

  @ApiPropertyOptional({
    description:
      'Actual counted or processed quantity on the floor. For ADJUSTMENT, this is the physical counted quantity.',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  actualQty?: number;
}

export class CreateDocumentDto {
  @ApiProperty({
    description: 'Document movement type (RECEIPT, DELIVERY, TRANSFER, ADJUSTMENT)',
    enum: DocumentType,
    example: DocumentType.RECEIPT,
  })
  @IsEnum(DocumentType)
  @IsNotEmpty()
  type!: DocumentType;

  @ApiPropertyOptional({
    description:
      'Optional manual document reference. If omitted, server generates <warehouse.short_code>/<IN or OUT>/<sequence>',
    example: 'WH/IN/00001',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description:
      'Source location UUID (mandatory for DELIVERY and TRANSFER; target for downward ADJUSTMENT)',
    example: 'l0000000-0000-0000-0000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  sourceLocationId?: string;

  @ApiPropertyOptional({
    description:
      'Destination location UUID (mandatory for RECEIPT and TRANSFER; target for upward ADJUSTMENT)',
    example: 'l0000000-0000-0000-0000-000000000002',
  })
  @IsOptional()
  @IsUUID()
  destLocationId?: string;

  @ApiPropertyOptional({
    description:
      'Convenience location UUID for ADJUSTMENT documents (maps to source/dest location automatically)',
    example: 'l0000000-0000-0000-0000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'External contact name (customer, vendor, or internal department)',
    example: 'Vandertramp Steels Ltd.',
  })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiPropertyOptional({
    description: 'External partner reference number (e.g. PO, SO, or tracking code)',
    example: 'PO-2026-STEEL-001',
  })
  @IsOptional()
  @IsString()
  partnerRef?: string;

  @ApiPropertyOptional({
    description: 'Scheduled execution date in ISO 8601 format',
    example: '2026-09-28T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduleDate?: string;

  @ApiPropertyOptional({
    description: 'UUID of the user responsible for floor execution (defaults to creator)',
    example: 'a0000000-0000-0000-0000-000000000002',
  })
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiProperty({
    description: 'List of line items specifying products and quantities',
    type: [CreateDocumentLineDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'A document must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentLineDto)
  lines!: CreateDocumentLineDto[];
}
