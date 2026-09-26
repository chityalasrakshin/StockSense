import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryDocumentsDto {
  @ApiPropertyOptional({
    description: 'Filter by document type (RECEIPT, DELIVERY, TRANSFER, ADJUSTMENT)',
    enum: DocumentType,
  })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @ApiPropertyOptional({
    description: 'Filter by lifecycle status (DRAFT, WAITING, READY, DONE, CANCELED)',
    enum: DocumentStatus,
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({
    description: 'Search by reference number, contact, or partner reference',
    example: 'WH/IN',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page index (1-based)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}
