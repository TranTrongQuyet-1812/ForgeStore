import { describe, expect, it } from 'vitest';
import { khoaCuonVungChinh, type PhanTuCoCuon } from './KhungHopThoai';

describe('khoaCuonVungChinh (KhungHopThoai)', () => {
  it('khóa overflowY thành hidden trên vùng cuộn chính và khôi phục đúng giá trị cũ khi đóng', () => {
    const mainGia: PhanTuCoCuon = { style: { overflowY: 'auto' } };
    const bodyGia: PhanTuCoCuon = { style: { overflowY: '' } };

    const khoiPhuc = khoaCuonVungChinh([mainGia, bodyGia, null, undefined]);

    expect(mainGia.style.overflowY).toBe('hidden');
    expect(bodyGia.style.overflowY).toBe('hidden');

    khoiPhuc();

    expect(mainGia.style.overflowY).toBe('auto');
    expect(bodyGia.style.overflowY).toBe('');
  });
});
