import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: any;

  const mockProduct = {
    id: 'p-1',
    sku: 'STEEL-001',
    name: 'Steel Rods',
    unitCost: 45,
    categoryId: 'c-1',
    uomId: 'u-1',
    reorderPoint: 25,
    reorderQty: 100,
    totalStock: 50,
    isLowStock: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockProduct),
      findAll: jest.fn().mockResolvedValue({
        items: [mockProduct],
        meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
      }),
      findOne: jest.fn().mockResolvedValue(mockProduct),
      update: jest.fn().mockResolvedValue(mockProduct),
      remove: jest.fn().mockResolvedValue({ message: 'Product successfully deleted', id: 'p-1' }),
      search: jest.fn().mockResolvedValue([
        {
          id: 'p-1',
          sku: 'STEEL-001',
          name: 'Steel Rods',
          unitCost: 45,
          totalStock: 50,
          similarityScore: 0.85,
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: service }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('create delegates to service with caller id', async () => {
    const dto = { sku: 'STEEL-001', name: 'Steel Rods', unitCost: 45 };
    const res = await controller.create(dto, { id: 'mgr-1' });
    expect(res).toEqual(mockProduct);
    expect(service.create).toHaveBeenCalledWith(dto, 'mgr-1');
  });

  it('search delegates to service with query parameter', async () => {
    const res = await controller.search({ q: 'steel', limit: 10, offset: 0 });
    expect(res.length).toBe(1);
    expect(service.search).toHaveBeenCalledWith('steel', 10, 0);
  });

  it('findAll delegates to service', async () => {
    const res = await controller.findAll({ page: 1, limit: 20 });
    expect(res.items.length).toBe(1);
    expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('findOne delegates to service', async () => {
    const res = await controller.findOne('p-1');
    expect(res).toEqual(mockProduct);
    expect(service.findOne).toHaveBeenCalledWith('p-1');
  });

  it('update delegates to service', async () => {
    const res = await controller.update('p-1', { name: 'Updated Name' });
    expect(res).toEqual(mockProduct);
    expect(service.update).toHaveBeenCalledWith('p-1', { name: 'Updated Name' });
  });

  it('remove delegates to service', async () => {
    const res = await controller.remove('p-1');
    expect(res.id).toBe('p-1');
    expect(service.remove).toHaveBeenCalledWith('p-1');
  });
});
