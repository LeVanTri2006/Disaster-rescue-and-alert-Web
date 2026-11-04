import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../users/enums/user-role.enum';

interface MockUser {
  role?: UserRole;
  rescueProfile?: {
    verificationStatus?: string;
  };
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let getAllAndOverride: jest.Mock;

  const routingRoles = [
    UserRole.RESCUER,
    UserRole.ADMIN,
    UserRole.MODERATOR,
  ];

  function createExecutionContext(
    user?: MockUser,
  ): ExecutionContext {
    const handler = jest.fn();
    const controller = class TestController {};

    return {
      getHandler: jest.fn().mockReturnValue(handler),
      getClass: jest.fn().mockReturnValue(controller),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    getAllAndOverride = jest.fn();

    const reflector = {
      getAllAndOverride,
    } as unknown as Reflector;

    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles are required', () => {
    getAllAndOverride.mockReturnValue(undefined);

    expect(
      guard.canActivate(createExecutionContext()),
    ).toBe(true);
  });

  it('should deny access when user is missing', () => {
    getAllAndOverride.mockReturnValue(routingRoles);

    expect(
      guard.canActivate(createExecutionContext()),
    ).toBe(false);
  });

  it('should deny access when user has no role', () => {
    getAllAndOverride.mockReturnValue(routingRoles);

    expect(
      guard.canActivate(createExecutionContext({})),
    ).toBe(false);
  });

  it('should deny USER when USER is not in required roles', () => {
    getAllAndOverride.mockReturnValue(routingRoles);

    expect(
      guard.canActivate(
        createExecutionContext({ role: UserRole.USER }),
      ),
    ).toBe(false);
  });

  it('should allow USER when USER is explicitly required', () => {
    getAllAndOverride.mockReturnValue([UserRole.USER]);

    expect(
      guard.canActivate(
        createExecutionContext({ role: UserRole.USER }),
      ),
    ).toBe(true);
  });

  it('should allow ADMIN when ADMIN is required', () => {
    getAllAndOverride.mockReturnValue(routingRoles);

    expect(
      guard.canActivate(
        createExecutionContext({ role: UserRole.ADMIN }),
      ),
    ).toBe(true);
  });

  it('should allow MODERATOR when MODERATOR is required', () => {
    getAllAndOverride.mockReturnValue(routingRoles);

    expect(
      guard.canActivate(
        createExecutionContext({ role: UserRole.MODERATOR }),
      ),
    ).toBe(true);
  });

  it('should allow an APPROVED RESCUER', () => {
    getAllAndOverride.mockReturnValue(routingRoles);

    expect(
      guard.canActivate(
        createExecutionContext({
          role: UserRole.RESCUER,
          rescueProfile: {
            verificationStatus: 'APPROVED',
          },
        }),
      ),
    ).toBe(true);
  });

  it('should deny a PENDING RESCUER for routing roles', () => {
    getAllAndOverride.mockReturnValue(routingRoles);

    expect(
      guard.canActivate(
        createExecutionContext({
          role: UserRole.RESCUER,
          rescueProfile: {
            verificationStatus: 'PENDING',
          },
        }),
      ),
    ).toBe(false);
  });

  it('should deny a RESCUER without an approved rescue profile', () => {
    getAllAndOverride.mockReturnValue(routingRoles);

    expect(
      guard.canActivate(
        createExecutionContext({
          role: UserRole.RESCUER,
        }),
      ),
    ).toBe(false);
  });

  it('should preserve existing behavior for PENDING RESCUER when USER is also allowed', () => {
    getAllAndOverride.mockReturnValue([
      UserRole.USER,
      UserRole.RESCUER,
    ]);

    expect(
      guard.canActivate(
        createExecutionContext({
          role: UserRole.RESCUER,
          rescueProfile: {
            verificationStatus: 'PENDING',
          },
        }),
      ),
    ).toBe(true);
  });
});
