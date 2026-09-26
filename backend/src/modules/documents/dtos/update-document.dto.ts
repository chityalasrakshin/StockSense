import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
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

export class UpdateDocumentLineDto {
  @ApiPropertyOptional({
    description: 'Line item UUID if updating an existing line (omit when adding a new line)',
    example: 'f0000000-0000-0000-0000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    description: 'UUID of the product',
    example: 'p0000000-0000-0000-0000-000000000001',
  })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    description: 'Expected quantity',
    example: 100,
  })
  @IsInt()
  @Min(1)
  expectedQty!: number;

  @ApiPropertyOptional({
    description: 'Actual processed or counted quantity',
    example: 95,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  actualQty?: number;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({
    description:
      'Lifecycle status transition (DRAFT, WAITING, READY, CANCELED). To finalize and post to ledger, use POST /documents/:id/validate instead.',
    enum: DocumentStatus,
    example: DocumentStatus.READY,
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({
    description: 'Updated contact name',
    example: 'Apex Metal Suppliers',
  })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiPropertyOptional({
    description: 'Updated partner reference',
    example: 'PO-2026-REVISED-02',
  })
  @IsOptional()
  @IsString()
  partnerRef?: string;

  @ApiPropertyOptional({
    description: 'Updated scheduled execution date',
    example: '2026-09-30T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduleDate?: string;

  @ApiPropertyOptional({
    description: 'Updated source location UUID',
    example: 'l0000000-0000-0000-0000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  sourceLocationId?: string;

  @ApiPropertyOptional({
    description: 'Updated destination location UUID',
    example: 'l0000000-0000-0000-0000-000000000002',
  })
  @IsOptional()
  @IsUUID()
  destLocationId?: string;

  @ApiPropertyOptional({
    description: 'Updated responsible staff UUID',
    example: 'a0000000-0000-0000-0000-000000000002',
  })
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional({
    description: 'Updated list of document lines (replaces existing lines if provided)',
    type: [UpdateDocumentLineDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDocumentLineDto)
  lines?: UpdateDocumentLineDto[];
}
