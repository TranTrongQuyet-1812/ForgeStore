import { describe, expect, it } from 'vitest';
import { HeDieuHanhCli, NhomCachCai } from '@forgestore/types';
import { layNhanHeDieuHanh, layNhanNhomCachCai, layTenCachCai } from './hien-thi-cach-cai.core';

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

  it('đổi tên cách cài mặc định của backend sang chữ dễ đọc', () => {
    expect(layTenCachCai('Cài đặt qua NGUON', NhomCachCai.NGUON)).toBe('Cài từ mã nguồn');
    expect(layTenCachCai('Cài đặt qua NPM', NhomCachCai.NPM)).toBe('Cài đặt qua npm');
    expect(layTenCachCai('Cài đặt qua WINGET', NhomCachCai.WINGET)).toBe('Cài đặt qua WinGet');
    expect(layTenCachCai('Cài bản portable', NhomCachCai.NGUON)).toBe('Cài bản portable');
  });

  it('làm sạch giá trị mới chưa có trong bảng nhãn', () => {
    expect(layNhanNhomCachCai('MOBILE_STORE')).toBe('Mobile store');
    expect(layNhanHeDieuHanh('UNKNOWN_PLATFORM')).toBe('Unknown platform');
  });
});
