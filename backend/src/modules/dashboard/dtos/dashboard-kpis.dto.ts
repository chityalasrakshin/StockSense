import { ApiProperty } from '@nestjs/swagger';

export class DashboardKpisDto {
  @ApiProperty({
    description: 'Total number of distinct products currently having positive balance across warehouses',
    example: 1,
  })
  totalProductsInStock!: number;

  @ApiProperty({
    description: 'Alias for frontend compatibility matching DashboardKpis interface',
    example: 1,
  })
  totalProducts!: number;

  @ApiProperty({
    description: 'Count of items currently at or below their reorder threshold or out of stock',
    example: 2,
  })
  lowStockItems!: number;

  @ApiProperty({
    description: 'Explicit name matching PDF problem statement (Low Stock / Out of Stock Items)',
    example: 2,
  })
  lowStockOrOutOfStockItems!: number;

  @ApiProperty({
    description: 'Count of incoming receipts in pending state (DRAFT, WAITING, or READY)',
    example: 1,
  })
  pendingReceipts!: number;

  @ApiProperty({
    description: 'Count of customer delivery orders in pending state (DRAFT, WAITING, or READY)',
    example: 0,
  })
  pendingDeliveries!: number;

  @ApiProperty({
    description: 'Count of internal transfers scheduled in pending state (DRAFT, WAITING, or READY)',
    example: 0,
  })
  internalTransfersScheduled!: number;

  @ApiProperty({
    description: 'Alias for frontend compatibility matching internalTransfersCount',
    example: 0,
  })
  internalTransfersCount!: number;

  @ApiProperty({
    description: 'Total count of immutable stock ledger entries in the system',
    example: 5,
  })
  recentLedgerActivity!: number;
}
