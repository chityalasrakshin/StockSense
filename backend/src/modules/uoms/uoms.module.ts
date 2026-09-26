import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { UomsService } from './uoms.service';
import { UomsController } from './uoms.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UomsController],
  providers: [UomsService],
  exports: [UomsService],
})
export class UomsModule {}
