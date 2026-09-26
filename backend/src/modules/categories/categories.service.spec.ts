import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      category: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      product: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('create', () => {
    it('creates a new category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        id: 'cat-1',
        name: 'Metals',
        parentId: null,
      });

      const result = await service.create({ name: 'Metals' });
      expect(result.id).toBe('cat-1');
      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'Metals', parentId: null },
        }),
      );
    });

    it('throws ConflictException if category name already exists', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Metals' });

      await expect(service.create({ name: 'Metals' })).rejects.toThrow(ConflictException);
      await expect(service.create({ name: 'Metals' })).rejects.toThrow(/already exists/);
    });

    it('throws NotFoundException if parentId does not exist', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce(null) // for name check
        .mockResolvedValueOnce(null); // for parentId check

      await expect(
        service.create({ name: 'Alloys', parentId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTree', () => {
    it('builds recursive category tree correctly', async () => {
      const mockCategories = [
        { id: 'c1', name: 'Root', parentId: null, _count: { products: 2 } },
        { id: 'c2', name: 'Child', parentId: 'c1', _count: { products: 1 } },
        { id: 'c3', name: 'Grandchild', parentId: 'c2', _count: { products: 0 } },
      ];
      prisma.category.findMany.mockResolvedValue(mockCategories);

      const tree = await service.getTree();
      expect(tree.length).toBe(1);
      expect(tree[0].id).toBe('c1');
      expect(tree[0].children.length).toBe(1);
      expect(tree[0].children[0].id).toBe('c2');
      expect(tree[0].children[0].children[0].id).toBe('c3');
    });
  });

  describe('remove (Deletion blocking rule)', () => {
    it('blocks category deletion with 409 ConflictException when products reference it', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Metals' });
      prisma.product.count.mockResolvedValue(3); // 3 products assigned

      await expect(service.remove('cat-1')).rejects.toThrow(ConflictException);
      await expect(service.remove('cat-1')).rejects.toThrow(
        /referenced by 3 product\(s\)/,
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('blocks category deletion with 409 ConflictException when sub-categories exist', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Metals' });
      prisma.product.count.mockResolvedValue(0);
      prisma.category.count.mockResolvedValue(2); // 2 child sub-categories

      await expect(service.remove('cat-1')).rejects.toThrow(ConflictException);
      await expect(service.remove('cat-1')).rejects.toThrow(
        /has 2 sub-category\(ies\)/,
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('successfully deletes category when neither products nor sub-categories exist', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Metals' });
      prisma.product.count.mockResolvedValue(0);
      prisma.category.count.mockResolvedValue(0);
      prisma.category.delete.mockResolvedValue({ id: 'cat-1' });

      const res = await service.remove('cat-1');
      expect(res.id).toBe('cat-1');
      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
    });
  });
});
