import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { DanhGiaModule } from './modules/danh-gia/danh-gia.module';
import { UngDungModule } from './modules/ung-dung/ung-dung.module';

describe('AppModule: thứ tự module quyết định thứ tự đăng ký route', () => {
  it('DanhGiaModule đứng trước UngDungModule, nếu không GET ung-dung/:id/danh-gia bị ung-dung/:owner/:repo nuốt (404)', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
    expect(imports.indexOf(DanhGiaModule)).toBeGreaterThanOrEqual(0);
    expect(imports.indexOf(DanhGiaModule)).toBeLessThan(imports.indexOf(UngDungModule));
  });
});
