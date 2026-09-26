import { Test, TestingModule } from '@nestjs/testing';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

describe('LedgerController', () => {
  let controller: LedgerController;
  let service: any;

  beforeEach(async () => {
    service = {
      findMoveHistory: jest.fn().mockResolvedValue({
        items: [],
        meta: { page: 1, limit: 20, totalItems: 0, totalPages: 1 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LedgerController],
      providers: [{ provide: LedgerService, useValue: service }],
    }).compile();

    controller = module.get<LedgerController>(LedgerController);
  });

  it('getMoveHistory delegates to LedgerService', async () => {
    const query = { product: 'STEEL', page: 1, limit: 10 };
    const res = await controller.getMoveHistory(query);
    expect(res.items).toEqual([]);
    expect(service.findMoveHistory).toHaveBeenCalledWith(query);
  });
});
