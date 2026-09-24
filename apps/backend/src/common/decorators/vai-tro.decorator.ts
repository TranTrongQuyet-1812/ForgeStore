import { SetMetadata } from '@nestjs/common';
import { VaiTro } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Chỉ định danh sách vai trò có quyền truy cập endpoint (kết hợp với RolesGuard).
 */
export const VaiTroYeuCau = (...roles: VaiTro[]) => SetMetadata(ROLES_KEY, roles);
