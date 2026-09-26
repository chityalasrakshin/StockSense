import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard (RBAC)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access if route is marked as @Public()', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return true;
      return undefined;
    });

    const context = createMockContext(null);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if route does not specify any @Roles()', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'roles') return undefined;
      return undefined;
    });

    const context = createMockContext({ id: 'u1', role: Role.WAREHOUSE_STAFF });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should block WAREHOUSE_STAFF from INVENTORY_MANAGER route with 403 Forbidden', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'roles') return [Role.INVENTORY_MANAGER];
      return undefined;
    });

    const context = createMockContext({ id: 'staff-1', role: Role.WAREHOUSE_STAFF });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(/Insufficient permissions/);
  });

  it('should allow INVENTORY_MANAGER to access INVENTORY_MANAGER route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'roles') return [Role.INVENTORY_MANAGER];
      return undefined;
    });

    const context = createMockContext({ id: 'manager-1', role: Role.INVENTORY_MANAGER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow both WAREHOUSE_STAFF and INVENTORY_MANAGER on shared routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'roles') return [Role.WAREHOUSE_STAFF, Role.INVENTORY_MANAGER];
      return undefined;
    });

    const staffContext = createMockContext({ id: 'staff-1', role: Role.WAREHOUSE_STAFF });
    const managerContext = createMockContext({ id: 'manager-1', role: Role.INVENTORY_MANAGER });

    expect(guard.canActivate(staffContext)).toBe(true);
    expect(guard.canActivate(managerContext)).toBe(true);
  });

  it('should throw ForbiddenException if user credentials are missing from request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'roles') return [Role.INVENTORY_MANAGER];
      return undefined;
    });

    const context = createMockContext(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
