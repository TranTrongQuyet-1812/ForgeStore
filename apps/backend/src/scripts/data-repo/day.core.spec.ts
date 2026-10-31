import { describe, expect, it } from 'vitest';
import { layCapNhatLuuTru, taoMapTrangThaiLuuTru } from './day.core';

describe('day.core', () => {
  it('đặt true cho repo archived và false cho repo được báo đang hoạt động', () => {
    const trangThai = taoMapTrangThaiLuuTru([
      { repo: 'owner/archived', loai: 'luu_tru', archived: true },
      { repo: 'owner/active', loai: 'khong_doi', archived: false },
    ]);

    expect(layCapNhatLuuTru('OWNER/ARCHIVED', trangThai)).toEqual({ daLuuTru: true });
    expect(layCapNhatLuuTru('owner/active', trangThai)).toEqual({ daLuuTru: false });
  });

  it('không thay đổi cờ nếu không truyền báo cáo hoặc repo không có trong báo cáo', () => {
    expect(layCapNhatLuuTru('owner/repo')).toEqual({});
    expect(layCapNhatLuuTru('owner/repo', new Map())).toEqual({});
  });
});
