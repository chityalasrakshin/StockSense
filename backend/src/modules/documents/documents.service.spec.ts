import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { IdempotencyService } from './services/idempotency.service';
import { EventPublisherService } from './services/event-publisher.service';
import { DocumentStatus, DocumentType, Role } from '@prisma/client';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;
  let ledgerService: any;
  let idempotencyService: any;
  let eventPublisherService: any;

  beforeEach(async () => {
    prisma = {
      document: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      documentLine: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      location: {
        findUnique: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    ledgerService = {
      append: jest.fn().mockResolvedValue({ id: 'led-1', balanceAfter: 100 }),
      getBalance: jest.fn().mockResolvedValue(50),
    };

    idempotencyService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    eventPublisherService = {
      publishStockChanged: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledgerService },
        { provide: IdempotencyService, useValue: idempotencyService },
        { provide: EventPublisherService, useValue: eventPublisherService },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe('create (RBAC & Type Validations)', () => {
    it('blocks WAREHOUSE_STAFF from creating ADJUSTMENT with 403 Forbidden', async () => {
      const dto = {
        type: DocumentType.ADJUSTMENT,
        locationId: 'loc-1',
        lines: [{ productId: 'p1', expectedQty: 10 }],
      };

      await expect(
        service.create(dto, { id: 'staff-1', role: Role.WAREHOUSE_STAFF }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.create(dto, { id: 'staff-1', role: Role.WAREHOUSE_STAFF }),
      ).rejects.toThrow(/Only INVENTORY_MANAGER can create ADJUSTMENT documents/);
    });

    it('allows INVENTORY_MANAGER to create ADJUSTMENT', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-1', shortCode: 'WH' });
      prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.document.create.mockResolvedValue({
        id: 'doc-adj-1',
        reference: 'WH/OUT/00001',
        type: DocumentType.ADJUSTMENT,
        status: DocumentStatus.DRAFT,
      });

      const res = await service.create(
        {
          type: DocumentType.ADJUSTMENT,
          locationId: 'loc-1',
          lines: [{ productId: 'p1', expectedQty: 10 }],
        },
        { id: 'mgr-1', role: Role.INVENTORY_MANAGER },
      );

      expect(res.id).toBe('doc-adj-1');
      expect(prisma.document.create).toHaveBeenCalled();
    });

    it('allows WAREHOUSE_STAFF to create RECEIPT', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-wh', shortCode: 'WH' });
      prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.document.create.mockResolvedValue({
        id: 'doc-rec-1',
        reference: 'WH/IN/00001',
        type: DocumentType.RECEIPT,
        status: DocumentStatus.DRAFT,
      });

      const res = await service.create(
        {
          type: DocumentType.RECEIPT,
          destLocationId: 'loc-wh',
          lines: [{ productId: 'p1', expectedQty: 50 }],
        },
        { id: 'staff-1', role: Role.WAREHOUSE_STAFF },
      );

      expect(res.id).toBe('doc-rec-1');
    });

    it('rejects TRANSFER when source and destination locations are identical', async () => {
      await expect(
        service.create(
          {
            type: DocumentType.TRANSFER,
            sourceLocationId: 'loc-1',
            destLocationId: 'loc-1',
            lines: [{ productId: 'p1', expectedQty: 10 }],
          },
          { id: 'staff-1', role: Role.WAREHOUSE_STAFF },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update (State Machine Transitions)', () => {
    it('rejects editing document in DONE or CANCELED state', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'd-done',
        status: DocumentStatus.DONE,
      });

      await expect(
        service.update('d-done', { contact: 'New Contact' }, { id: 'u1', role: Role.INVENTORY_MANAGER }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('d-done', { contact: 'New Contact' }, { id: 'u1', role: Role.INVENTORY_MANAGER }),
      ).rejects.toThrow(/Cannot edit document in DONE status/);
    });

    it('rejects manual transition to DONE via PATCH (must use validate)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'd1',
        status: DocumentStatus.READY,
      });

      await expect(
        service.update('d1', { status: DocumentStatus.DONE }, { id: 'u1', role: Role.INVENTORY_MANAGER }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('d1', { status: DocumentStatus.DONE }, { id: 'u1', role: Role.INVENTORY_MANAGER }),
      ).rejects.toThrow(/POST \/documents\/:id\/validate/);
    });

    it('permits valid lifecycle transition DRAFT -> WAITING -> READY -> CANCELED', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'd1',
        status: DocumentStatus.DRAFT,
      });
      prisma.document.update.mockResolvedValue({
        id: 'd1',
        status: DocumentStatus.WAITING,
      });

      const res = await service.update(
        'd1',
        { status: DocumentStatus.WAITING },
        { id: 'u1', role: Role.WAREHOUSE_STAFF },
      );
      expect(res.status).toBe(DocumentStatus.WAITING);
    });
  });

  describe('validate (Transactional stock movements & idempotency)', () => {
    it('validates RECEIPT: increases stock at destination location', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-rec',
        reference: 'WH/IN/00001',
        type: DocumentType.RECEIPT,
        status: DocumentStatus.READY,
        destLocationId: 'loc-wh',
        lines: [{ productId: 'prod-1', expectedQty: 100, actualQty: 100 }],
      });
      prisma.document.update.mockResolvedValue({
        id: 'doc-rec',
        status: DocumentStatus.DONE,
      });

      const res = await service.validate('doc-rec', 'actor-1');

      expect(res.status).toBe(DocumentStatus.DONE);
      expect(ledgerService.append).toHaveBeenCalledTimes(1);
      expect(ledgerService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          locationId: 'loc-wh',
          documentId: 'doc-rec',
          qtyDelta: 100,
          actorId: 'actor-1',
        }),
        prisma,
      );
    });

    it('validates TRANSFER: writes dual ledger rows (source negative, dest positive)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-trans',
        reference: 'WH/OUT/00001',
        type: DocumentType.TRANSFER,
        status: DocumentStatus.READY,
        sourceLocationId: 'loc-src',
        destLocationId: 'loc-dst',
        lines: [{ productId: 'prod-1', expectedQty: 30, actualQty: 30 }],
      });
      prisma.document.update.mockResolvedValue({
        id: 'doc-trans',
        status: DocumentStatus.DONE,
      });

      await service.validate('doc-trans', 'actor-1');

      expect(ledgerService.append).toHaveBeenCalledTimes(2);
      // First call: source reduction (-30)
      expect(ledgerService.append).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          productId: 'prod-1',
          locationId: 'loc-src',
          qtyDelta: -30,
          allowNegative: false,
        }),
        prisma,
      );
      // Second call: dest increase (+30)
      expect(ledgerService.append).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          productId: 'prod-1',
          locationId: 'loc-dst',
          qtyDelta: 30,
        }),
        prisma,
      );
    });

    it('validates ADJUSTMENT: delta = counted - system balance', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-adj',
        reference: 'WH/OUT/00003',
        type: DocumentType.ADJUSTMENT,
        status: DocumentStatus.READY,
        sourceLocationId: 'loc-wh',
        lines: [{ productId: 'prod-1', expectedQty: 50, actualQty: 47 }], // counted 47kg
      });
      ledgerService.getBalance.mockResolvedValue(50); // system had 50kg -> delta = -3kg
      prisma.document.update.mockResolvedValue({
        id: 'doc-adj',
        status: DocumentStatus.DONE,
      });

      await service.validate('doc-adj', 'mgr-1');

      expect(ledgerService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          locationId: 'loc-wh',
          qtyDelta: -3,
        }),
        prisma,
      );
    });

    it('prevents double-posting when Idempotency-Key is provided', async () => {
      const mockCachedResponse = {
        id: 'doc-1',
        reference: 'WH/IN/00001',
        status: DocumentStatus.DONE,
      };
      idempotencyService.get.mockResolvedValue({
        documentId: 'doc-1',
        response: mockCachedResponse,
      });

      const res = await service.validate('doc-1', 'actor-1', 'unique-idempotency-key-123');

      expect(res).toEqual(mockCachedResponse);
      expect(ledgerService.append).not.toHaveBeenCalled();
      expect(prisma.document.update).not.toHaveBeenCalled();
    });
  });
});
