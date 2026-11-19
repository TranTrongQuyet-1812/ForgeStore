import { describe, expect, it } from 'vitest';
import {
  BANG_GIAI_THICH_GIAY_PHEP,
  giaiThichGiayPhep,
  LUU_Y_GIAY_PHEP,
  type NhomGiayPhep,
} from './giai-thich-giay-phep.core';

describe('giaiThichGiayPhep (P3B-40)', () => {
  it.each<[string, string, NhomGiayPhep, string]>([
    ['MIT License', 'Giấy phép MIT', 'RAT_THOANG', 'bản quyền và nội dung giấy phép'],
    ['Apache License 2.0', 'Giấy phép Apache 2.0', 'RAT_THOANG', 'bằng sáng chế'],
    [
      'BSD 3-Clause "New" or "Revised" License',
      'Giấy phép BSD 3 điều khoản',
      'RAT_THOANG',
      'quảng bá',
    ],
    [
      'BSD 2-Clause "Simplified" License',
      'Giấy phép BSD 2 điều khoản',
      'RAT_THOANG',
      'thông báo bản quyền',
    ],
    ['ISC License', 'Giấy phép ISC', 'RAT_THOANG', 'thông báo bản quyền'],
    ['zlib License', 'Giấy phép zlib', 'RAT_THOANG', 'viết ra bản gốc'],
    ['The Unlicense', 'Giấy phép Unlicense', 'RAT_THOANG', 'phạm vi công cộng'],
    [
      'Creative Commons Zero v1.0 Universal',
      'Creative Commons Zero (CC0)',
      'RAT_THOANG',
      'từ bỏ quyền tác giả',
    ],
    [
      'Mozilla Public License 2.0',
      'Giấy phép Mozilla 2.0 (MPL)',
      'MO_MA_THEO_PHAN',
      'tệp của dự án',
    ],
    [
      'GNU Lesser General Public License v3.0',
      'Giấy phép LGPL (bản 3.0)',
      'MO_MA_THEO_PHAN',
      'liên kết, không sửa thư viện',
    ],
    [
      'GNU Lesser General Public License v2.1',
      'Giấy phép LGPL (bản 2.1)',
      'MO_MA_THEO_PHAN',
      'liên kết, không sửa thư viện',
    ],
    [
      'GNU Lesser General Public License v2.0',
      'Giấy phép LGPL (bản 2.0)',
      'MO_MA_THEO_PHAN',
      'liên kết, không sửa thư viện',
    ],
    [
      'GNU General Public License v3.0',
      'Giấy phép GPL 3.0',
      'BUOC_MO_MA',
      'Chỉ dùng riêng cho mình',
    ],
    ['GNU General Public License v2.0', 'Giấy phép GPL 2.0', 'BUOC_MO_MA', 'phiên bản cũ hơn'],
    [
      'GNU Affero General Public License v3.0',
      'Giấy phép AGPL 3.0',
      'BUOC_MO_MA',
      'dịch vụ cho người khác dùng qua mạng',
    ],
  ])('tra đúng theo tên GitHub đầy đủ trong DB: %s', (tenGithub, tenHienThi, nhom, tuKhoa) => {
    const kq = giaiThichGiayPhep(tenGithub);
    expect(kq.tenHienThi).toBe(tenHienThi);
    expect(kq.nhom).toBe(nhom);
    expect(kq.nguoiDung.length).toBeGreaterThan(0);
    expect(kq.neuSuaHoacChiaSe.length).toBeGreaterThan(0);
    expect(`${kq.nguoiDung} ${kq.neuSuaHoacChiaSe}`).toContain(tuKhoa);
  });

  it.each<[string, string]>([
    ['MIT', 'Giấy phép MIT'],
    ['Apache-2.0', 'Giấy phép Apache 2.0'],
    ['BSD-3-Clause', 'Giấy phép BSD 3 điều khoản'],
    ['BSD-2-Clause', 'Giấy phép BSD 2 điều khoản'],
    ['ISC', 'Giấy phép ISC'],
    ['Zlib', 'Giấy phép zlib'],
    ['Unlicense', 'Giấy phép Unlicense'],
    ['CC0-1.0', 'Creative Commons Zero (CC0)'],
    ['MPL-2.0', 'Giấy phép Mozilla 2.0 (MPL)'],
    ['LGPL-3.0', 'Giấy phép LGPL (bản 3.0)'],
    ['LGPL-2.1', 'Giấy phép LGPL (bản 2.1)'],
    ['LGPL-2.0', 'Giấy phép LGPL (bản 2.0)'],
    ['GPL-3.0', 'Giấy phép GPL 3.0'],
    ['GPL-2.0', 'Giấy phép GPL 2.0'],
    ['AGPL-3.0', 'Giấy phép AGPL 3.0'],
  ])('nhận đúng cả mã SPDX cho repo mới nạp: %s', (spdx, tenHienThi) => {
    const kq = giaiThichGiayPhep(spdx);
    expect(kq.tenHienThi).toBe(tenHienThi);
    expect(kq.nhom).not.toBe('CHUA_RO');
  });

  it('trả CHUA_RO với câu chung cho Other, null, undefined, rỗng, Giấy phép riêng, NOASSERTION', () => {
    for (const giaTri of ['Other', 'other', null, undefined, '', '   ', 'NOASSERTION']) {
      const kq = giaiThichGiayPhep(giaTri);
      expect(kq.nhom).toBe('CHUA_RO');
      expect(kq.tenHienThi).toBe('Giấy phép riêng hoặc chưa phân loại');
      expect(kq.nguoiDung).toBe(
        'Dự án này dùng giấy phép riêng, hoặc ForgeStore chưa có phần giải thích cho giấy phép này.',
      );
      expect(kq.neuSuaHoacChiaSe).toBe(
        'Hãy đọc tệp giấy phép trên trang GitHub của dự án trước khi sửa, chia sẻ lại hay dùng cho mục đích đặc biệt.',
      );
    }

    const rieng = giaiThichGiayPhep('Giấy phép riêng');
    expect(rieng.nhom).toBe('CHUA_RO');
    expect(rieng.tenHienThi).toBe('Giấy phép riêng');
  });

  it('không nhận nhầm các giấy phép gần tên (MIT No Attribution, BSD Zero Clause, GFDL)', () => {
    for (const tenLa of [
      'MIT No Attribution',
      'BSD Zero Clause License',
      'GNU Free Documentation License v1.3',
      'Creative Commons Attribution 4.0 International',
      'Eclipse Public License 2.0',
    ]) {
      const kq = giaiThichGiayPhep(tenLa);
      expect(kq.nhom, tenLa).toBe('CHUA_RO');
      expect(kq.tenHienThi, tenLa).toBe(tenLa);
    }
  });

  it('mọi mục trong bảng đều có đủ hai đoạn chữ không rỗng và có dòng lưu ý cố định', () => {
    const mucs = Object.values(BANG_GIAI_THICH_GIAY_PHEP);
    expect(mucs.length).toBeGreaterThanOrEqual(14);
    for (const muc of mucs) {
      expect(muc.tenHienThi.trim().length).toBeGreaterThan(0);
      expect(muc.nguoiDung.trim().length).toBeGreaterThan(0);
      expect(muc.neuSuaHoacChiaSe.trim().length).toBeGreaterThan(0);
    }
    expect(LUU_Y_GIAY_PHEP).toBe('Giải thích chỉ để tham khảo, không phải tư vấn pháp lý.');
  });
});
