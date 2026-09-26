import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Role } from '@prisma/client';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CategoriesController } from '../categories/categories.controller';
import { CategoriesService } from '../categories/categories.service';
import { UomsController } from '../uoms/uoms.controller';
import { UomsService } from '../uoms/uoms.service';
import { WarehousesController } from '../warehouses/warehouses.controller';
import { WarehousesService } from '../warehouses/warehouses.service';
import { ConflictException } from '@nestjs/common';

describe('Master Data & RBAC Integration Tests', () => {
  let app: INestApplication;
  let productsService: any;
  let categoriesService: any;
  let uomsService: any;
  let warehousesService: any;
  let currentUserRole: Role = Role.INVENTORY_MANAGER;

  beforeAll(async () => {
    productsService = {
      create: jest.fn().mockImplementation((dto) => {
        if (dto.sku === 'DUPLICATE-SKU') {
          throw new ConflictException(`Product with SKU "${dto.sku}" already exists`);
        }
        return {
          id: 'prod-new-1',
          sku: dto.sku,
          name: dto.name,
          unitCost: dto.unitCost ?? 0,
          totalStock: dto.initialStock ?? 0,
          isLowStock: false,
        };
      }),
      findAll: jest.fn().mockResolvedValue({ items: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 1 } }),
      findOne: jest.fn().mockResolvedValue({ id: 'prod-1', sku: 'STEEL-001', name: 'Steel' }),
      update: jest.fn().mockResolvedValue({ id: 'prod-1', sku: 'STEEL-001', name: 'Steel Updated' }),
      remove: jest.fn().mockResolvedValue({ message: 'Deleted', id: 'prod-1' }),
      search: jest.fn().mockResolvedValue([
        { id: 'prod-1', sku: 'STEEL-001', name: 'Steel Rods', similarityScore: 0.9 },
      ]),
    };

    categoriesService = {
      create: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Raw Materials' }),
      findAll: jest.fn().mockResolvedValue([]),
      getTree: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Raw Materials' }),
      update: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Raw Materials Updated' }),
      remove: jest.fn().mockImplementation((id: string) => {
        if (id === 'cat-with-products') {
          throw new ConflictException(
            'Cannot delete category "Raw Materials": it is referenced by 3 product(s). Please reassign or delete the products first.',
          );
        }
        return { message: 'Category deleted', id };
      }),
    };

    uomsService = {
      create: jest.fn().mockResolvedValue({ id: 'uom-1', code: 'kg', name: 'Kilograms' }),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'uom-1', code: 'kg', name: 'Kilograms' }),
      update: jest.fn().mockResolvedValue({ id: 'uom-1', code: 'kg', name: 'Kilograms' }),
      remove: jest.fn().mockResolvedValue({ message: 'UoM deleted', id: 'uom-1' }),
    };

    warehousesService = {
      create: jest.fn().mockResolvedValue({ id: 'wh-1', name: 'Main WH', shortCode: 'WH' }),
      findAll: jest.fn().mockResolvedValue([]),
      getTree: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'wh-1', name: 'Main WH', shortCode: 'WH' }),
      update: jest.fn().mockResolvedValue({ id: 'wh-1', name: 'Main WH', shortCode: 'WH' }),
      remove: jest.fn().mockResolvedValue({ message: 'Location deleted', id: 'wh-1' }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [
        ProductsController,
        CategoriesController,
        UomsController,
        WarehousesController,
      ],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: UomsService, useValue: uomsService },
        { provide: WarehousesService, useValue: warehousesService },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: 'mock-user-id',
            email: currentUserRole === Role.INVENTORY_MANAGER ? 'manager@stocksense.dev' : 'staff@stocksense.dev',
            role: currentUserRole,
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. RBAC Boundary Enforcement', () => {
    beforeEach(() => {
      currentUserRole = Role.WAREHOUSE_STAFF;
    });

    it('blocks WAREHOUSE_STAFF with HTTP 403 on POST /products', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send({ sku: 'NEW-SKU-1', name: 'Test Product' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Insufficient permissions');
    });

    it('blocks WAREHOUSE_STAFF with HTTP 403 on PATCH /products/:id', async () => {
      const res = await request(app.getHttpServer())
        .patch('/products/prod-1')
        .send({ name: 'Changed Name' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks WAREHOUSE_STAFF with HTTP 403 on DELETE /products/:id', async () => {
      const res = await request(app.getHttpServer()).delete('/products/prod-1');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks WAREHOUSE_STAFF with HTTP 403 on POST /categories', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'New Category' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks WAREHOUSE_STAFF with HTTP 403 on POST /uoms', async () => {
      const res = await request(app.getHttpServer())
        .post('/uoms')
        .send({ code: 'box', name: 'Boxes' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks WAREHOUSE_STAFF with HTTP 403 on POST /warehouses', async () => {
      const res = await request(app.getHttpServer())
        .post('/warehouses')
        .send({ name: 'Zone B', shortCode: 'WH-ZB' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows WAREHOUSE_STAFF to query GET /products, /categories, /uoms, and /warehouses', async () => {
      const resProducts = await request(app.getHttpServer()).get('/products');
      expect(resProducts.status).toBe(200);

      const resSearch = await request(app.getHttpServer()).get('/products/search?q=steel');
      expect(resSearch.status).toBe(200);

      const resCategories = await request(app.getHttpServer()).get('/categories');
      expect(resCategories.status).toBe(200);

      const resUoms = await request(app.getHttpServer()).get('/uoms');
      expect(resUoms.status).toBe(200);

      const resWarehouses = await request(app.getHttpServer()).get('/warehouses');
      expect(resWarehouses.status).toBe(200);
    });
  });

  describe('2. Manager Operational Access & Error Envelope', () => {
    beforeEach(() => {
      currentUserRole = Role.INVENTORY_MANAGER;
    });

    it('allows INVENTORY_MANAGER to create product (HTTP 201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send({
          sku: 'STEEL-009',
          name: 'High Tensile Steel',
          unitCost: 65,
          initialStock: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.sku).toBe('STEEL-009');
      expect(res.body.totalStock).toBe(50);
    });

    it('SKU uniqueness violation returns a clean HTTP 409 with standard error envelope', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send({
          sku: 'DUPLICATE-SKU',
          name: 'Duplicate Rods',
        });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: {
          code: 'CONFLICT',
          message: 'Product with SKU "DUPLICATE-SKU" already exists',
        },
      });
    });

    it('category deletion is blocked with clean HTTP 409 when products reference it', async () => {
      const res = await request(app.getHttpServer()).delete('/categories/cat-with-products');

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: {
          code: 'CONFLICT',
          message:
            'Cannot delete category "Raw Materials": it is referenced by 3 product(s). Please reassign or delete the products first.',
        },
      });
    });
  });
});
