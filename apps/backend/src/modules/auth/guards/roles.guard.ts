import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { VaiTro } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/vai-tro.decorator';
import { UserSessionContext } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<VaiTro[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as UserSessionContext | undefined;

    if (!user || !requiredRoles.includes(user.vaiTro)) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này');
    }

    return true;
  }
}
