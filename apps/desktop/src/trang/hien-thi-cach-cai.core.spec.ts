import { describe, expect, it } from 'vitest';
import { HeDieuHanhCli, NhomCachCai } from '@forgestore/types';
import { layNhanHeDieuHanh, layNhanNhomCachCai } from './hien-thi-cach-cai.core';

describe('nhãn hiển thị cách cài đặt', () => {
  it.each([
    [NhomCachCai.WINGET, 'WinGet'],
    [NhomCachCai.SCOOP, 'Scoop'],
    [NhomCachCai.PIP, 'pip'],
    [NhomCachCai.CONDA, 'Conda'],
    [NhomCachCai.NPM, 'npm'],
    [NhomCachCai.CARGO, 'Cargo'],
    [NhomCachCai.GO, 'Go'],
    [NhomCachCai.DOCKER, 'Docker'],
    [NhomCachCai.NGUON, 'Từ mã nguồn'],
  ])('dịch nhóm %s thành %s', (value, expected) => {
    expect(layNhanNhomCachCai(value)).toBe(expected);
  });

  it.each([
    [HeDieuHanhCli.WINDOWS, 'Windows'],
    [HeDieuHanhCli.LINUX_MAC, 'Linux và macOS'],
    [HeDieuHanhCli.DUNG_CHUNG, 'Mọi hệ điều hành'],
  ])('dịch hệ điều hành %s thành %s', (value, expected) => {
    expect(layNhanHeDieuHanh(value)).toBe(expected);
  });

  it('làm sạch giá trị mới chưa có trong bảng nhãn', () => {
    expect(layNhanNhomCachCai('MOBILE_STORE')).toBe('Mobile store');
    expect(layNhanHeDieuHanh('UNKNOWN_PLATFORM')).toBe('Unknown platform');
  });
});
