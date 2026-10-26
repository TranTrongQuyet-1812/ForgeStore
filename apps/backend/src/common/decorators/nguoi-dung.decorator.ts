import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserSessionContext } from '../../modules/xac-thuc/interfaces/jwt-payload.interface';

/**
 * Trích xuất thông tin người dùng và phiên hiện tại từ req.user sau khi JwtAuthGuard xác thực thành công.
 */
export const NguoiDungHienTai = createParamDecorator(
  (data: keyof UserSessionContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserSessionContext | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
