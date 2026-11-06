import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

// Đọc mã nguồn thay vì nạp AppModule: ConfigModule.forRoot kiểm biến môi trường ngay lúc nạp, nên test này sẽ
// lỗi trên CI (không có .env) dù chạy được ở máy có .env.
describe('AppModule: thứ tự module quyết định thứ tự đăng ký route', () => {
  it('DanhGiaModule đứng trước UngDungModule, nếu không GET ung-dung/:id/danh-gia bị ung-dung/:owner/:repo nuốt (404)', () => {
    const nguon = readFileSync(join(__dirname, 'app.module.ts'), 'utf8');
    const danhSachImports = nguon.slice(nguon.indexOf('imports: ['));

    const viTriDanhGia = danhSachImports.indexOf('DanhGiaModule,');
    const viTriUngDung = danhSachImports.indexOf('UngDungModule,');
    expect(viTriDanhGia).toBeGreaterThan(-1);
    expect(viTriUngDung).toBeGreaterThan(-1);
    expect(viTriDanhGia).toBeLessThan(viTriUngDung);
  });
});
