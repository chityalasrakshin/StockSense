import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
