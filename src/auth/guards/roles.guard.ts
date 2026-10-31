import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !user.role) {
      return false;
    }

    if (requiredRoles.includes(user.role)) {
      if (user.role === UserRole.RESCUER) {
        if (user.rescueProfile?.verificationStatus === 'APPROVED') {
          return true;
        }
        // If PENDING rescuer, they can only access if USER is also in requiredRoles
        if (requiredRoles.includes(UserRole.USER)) {
          return true;
        }
        return false;
      }
      return true;
    }
    
    return false;
  }
}
