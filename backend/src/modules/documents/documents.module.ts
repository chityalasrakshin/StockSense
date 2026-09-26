import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { IdempotencyService } from './services/idempotency.service';
import { EventPublisherService } from './services/event-publisher.service';

@Module({
  imports: [PrismaModule, LedgerModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, IdempotencyService, EventPublisherService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
