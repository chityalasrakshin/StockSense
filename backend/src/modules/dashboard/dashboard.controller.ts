import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('kpis')
  async kpis() {
    const [totalProducts, lowStockItems, pendingReceipts, pendingDeliveries, internalTransfersCount, recentLedgerActivity] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { balances: { some: { quantity: { lte: 0 } } } } }),
      this.prisma.document.count({ where: { type: 'RECEIPT', status: { not: 'DONE' } } }),
      this.prisma.document.count({ where: { type: 'DELIVERY', status: { not: 'DONE' } } }),
      this.prisma.document.count({ where: { type: 'TRANSFER', status: { not: 'DONE' } } }),
      this.prisma.stockLedger.count({ where: { postedAt: { gte: new Date(Date.now() - 86400000) } } }),
    ]);
    return { totalProducts, lowStockItems, pendingReceipts, pendingDeliveries, internalTransfersCount, recentLedgerActivity };
  }
}
