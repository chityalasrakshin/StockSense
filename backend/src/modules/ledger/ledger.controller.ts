import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LedgerService } from './ledger.service';
import { QueryLedgerDto } from './dtos/query-ledger.dto';
import { PaginatedLedgerDto } from './dtos/ledger-response.dto';

@ApiTags('Stock Ledger')
@ApiBearerAuth()
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @ApiOperation({
    summary: 'Query Stock Ledger / Move History (Manager & Staff)',
    description:
      'The Move History audit trail: returns append-only immutable stock movements with filters for product, location, and date range.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedLedgerDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async getMoveHistory(@Query() query: QueryLedgerDto): Promise<PaginatedLedgerDto> {
    return this.ledgerService.findMoveHistory(query);
  }
}
