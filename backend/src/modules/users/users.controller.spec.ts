import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: any;

  const mockUserItem = {
    id: 'user-uuid-1',
    email: 'manager@stocksense.dev',
    role: Role.INVENTORY_MANAGER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({
        users: [mockUserItem],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      findById: jest.fn().mockResolvedValue(mockUserItem),
      create: jest.fn().mockResolvedValue(mockUserItem),
      update: jest.fn().mockResolvedValue(mockUserItem),
      remove: jest.fn().mockResolvedValue({ message: 'User deactivated' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('getMe should retrieve profile for caller', async () => {
    const result = await controller.getMe({ id: 'user-uuid-1' });
    expect(result).toEqual(mockUserItem);
    expect(service.findById).toHaveBeenCalledWith('user-uuid-1');
  });

  it('getManagerOnlyPlaceholder returns manager access confirmation', () => {
    const result = controller.getManagerOnlyPlaceholder({
      email: 'manager@stocksense.dev',
      role: Role.INVENTORY_MANAGER,
    });
    expect(result.message).toContain('INVENTORY_MANAGER');
  });

  it('getStaffAccessiblePlaceholder returns staff access confirmation', () => {
    const result = controller.getStaffAccessiblePlaceholder({
      email: 'staff@stocksense.dev',
      role: Role.WAREHOUSE_STAFF,
    });
    expect(result.message).toContain('Warehouse operational route');
  });

  it('findAll delegates to UsersService with pagination query', async () => {
    const result = await controller.findAll({ page: 1, limit: 10 });
    expect(result.total).toBe(1);
    expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('create delegates to UsersService', async () => {
    const dto = {
      email: 'new@stocksense.dev',
      password: 'Password123!',
      role: Role.WAREHOUSE_STAFF,
    };
    const result = await controller.create(dto);
    expect(result).toEqual(mockUserItem);
    expect(service.create).toHaveBeenCalledWith(dto);
  });
});
