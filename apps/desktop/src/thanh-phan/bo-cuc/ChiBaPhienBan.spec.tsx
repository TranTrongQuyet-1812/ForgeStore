import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// zustand khi render tĩnh (renderToStaticMarkup) luôn trả trạng thái gốc, nên giả kho để đặt trạng thái theo từng ca
const kho = vi.hoisted(() => ({
  trangThai: { banMoi: null as unknown, dangTai: false, tienDo: null as number | null },
}));
vi.mock('../../kho-trang-thai/useTuCapNhatStore', () => ({
  useTuCapNhatStore: () => kho.trangThai,
}));

vi.mock('../../dich-vu/tu-cap-nhat/tu-cap-nhat.service', () => ({
  caiBanMoi: vi.fn(),
  layPhienBanHienTai: vi.fn().mockResolvedValue('0.1.2'),
}));

import { ChiBaPhienBan } from './ChiBaPhienBan';

// Lớp tạo vệt sáng lướt qua (không tính lớp chữ `chi-bao-cap-nhat-chu` trượt vào)
const VET_SANG = /chi-bao-cap-nhat(?!-chu)/;

function banMoi(version: string) {
  return { version, downloadAndInstall: vi.fn() } as never;
}

describe('ChiBaPhienBan (D-37)', () => {
  beforeEach(() => {
    kho.trangThai = { banMoi: null, dangTai: false, tienDo: null };
  });

  it('bình thường chỉ ghi phiên bản, không có chấm nhấp nháy và không có nút cập nhật', () => {
    const html = renderToStaticMarkup(<ChiBaPhienBan />);

    expect(html).toContain('Desktop');
    expect(html).not.toContain('animate-pulse');
    expect(html).not.toContain('Có bản cập nhật');
    expect(html).not.toContain('<button');
  });

  it('có bản mới thì thành nút "Có bản cập nhật" kèm số phiên bản mới', () => {
    kho.trangThai = { banMoi: banMoi('0.1.3'), dangTai: false, tienDo: null };

    const html = renderToStaticMarkup(<ChiBaPhienBan />);

    expect(html).toContain('<button');
    expect(html).toContain('Có bản cập nhật');
    expect(html).toContain('v0.1.3');
    expect(html).toMatch(VET_SANG);
  });

  it('đang tải thì hiện phần trăm, tắt vệt sáng và khóa nút', () => {
    kho.trangThai = { banMoi: banMoi('0.1.3'), dangTai: true, tienDo: 45 };

    const html = renderToStaticMarkup(<ChiBaPhienBan />);

    expect(html).toContain('Đang cập nhật 45%');
    expect(html).toContain('disabled');
    expect(html).not.toMatch(VET_SANG);
    expect(html).toContain('width:45%');
  });

  it('đang tải nhưng chưa biết dung lượng thì hiện dấu ba chấm thay cho phần trăm', () => {
    kho.trangThai = { banMoi: banMoi('0.1.3'), dangTai: true, tienDo: null };

    const html = renderToStaticMarkup(<ChiBaPhienBan />);

    expect(html).toContain('Đang cập nhật...');
  });
});
