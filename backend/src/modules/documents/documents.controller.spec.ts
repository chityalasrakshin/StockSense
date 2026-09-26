import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentStatus, DocumentType, Role } from '@prisma/client';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: any;

  const mockDoc = {
    id: 'doc-1',
    reference: 'WH/IN/00001',
    type: DocumentType.RECEIPT,
    status: DocumentStatus.DRAFT,
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockDoc),
      findAll: jest.fn().mockResolvedValue({ items: [mockDoc], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } }),
      findOne: jest.fn().mockResolvedValue(mockDoc),
      update: jest.fn().mockResolvedValue(mockDoc),
      validate: jest.fn().mockResolvedValue({ ...mockDoc, status: DocumentStatus.DONE }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: service }],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  it('create delegates to service', async () => {
    const dto = { type: DocumentType.RECEIPT, destLocationId: 'loc-1', lines: [] };
    const res = await controller.create(dto as any, { id: 'staff-1', role: Role.WAREHOUSE_STAFF });
    expect(res).toEqual(mockDoc);
    expect(service.create).toHaveBeenCalledWith(dto, { id: 'staff-1', role: Role.WAREHOUSE_STAFF });
  });

  it('validate passes Idempotency-Key header to service', async () => {
    const res = await controller.validate(
      'doc-1',
      { id: 'actor-1', role: Role.WAREHOUSE_STAFF },
      undefined,
      'test-idempotency-key-abc',
    );
    expect(res.status).toBe(DocumentStatus.DONE);
    expect(service.validate).toHaveBeenCalledWith('doc-1', 'actor-1', 'test-idempotency-key-abc');
  });

  it('findAll delegates to service', async () => {
    const res = await controller.findAll({ type: DocumentType.RECEIPT });
    expect(res.items.length).toBe(1);
    expect(service.findAll).toHaveBeenCalledWith({ type: DocumentType.RECEIPT });
  });

  it('findOne delegates to service', async () => {
    const res = await controller.findOne('doc-1');
    expect(res).toEqual(mockDoc);
    expect(service.findOne).toHaveBeenCalledWith('doc-1');
  });

  it('update delegates to service', async () => {
    const res = await controller.update(
      'doc-1',
      { status: DocumentStatus.READY },
      { id: 'u1', role: Role.WAREHOUSE_STAFF },
    );
    expect(res).toEqual(mockDoc);
    expect(service.update).toHaveBeenCalledWith('doc-1', { status: DocumentStatus.READY }, { id: 'u1', role: Role.WAREHOUSE_STAFF });
  });
});
