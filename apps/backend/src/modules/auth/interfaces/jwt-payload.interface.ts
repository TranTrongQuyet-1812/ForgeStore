import { VaiTro } from '@prisma/client';

export interface JwtPayload {
  sub: string; // maNguoiDung
  sid: string; // maPhien
  did: string; // maThietBi
  role: VaiTro; // vaiTro
  iat?: number;
  exp?: number;
}

export interface UserSessionContext {
  maNguoiDung: string;
  maPhien: string;
  maThietBi: string;
  vaiTro: VaiTro;
}
