import { describe, expect, it } from 'vitest';
import { thuNhoAnhDaiDien } from './anh-dai-dien.core';

describe('thu nhỏ ảnh đại diện GitHub', () => {
  it('thêm tham số kích thước cho ảnh avatars.githubusercontent.com', () => {
    expect(thuNhoAnhDaiDien('https://avatars.githubusercontent.com/u/44939412?v=4', 96)).toBe(
      'https://avatars.githubusercontent.com/u/44939412?v=4&s=96',
    );
  });

  it('giữ nguyên khi đã có kích thước', () => {
    const url = 'https://avatars.githubusercontent.com/u/1?v=4&s=40';
    expect(thuNhoAnhDaiDien(url, 96)).toBe(url);
  });

  it('giữ nguyên địa chỉ ảnh của máy chủ khác', () => {
    const url = 'https://example.com/logo.png';
    expect(thuNhoAnhDaiDien(url, 96)).toBe(url);
  });

  it('giữ nguyên khi địa chỉ không hợp lệ', () => {
    expect(thuNhoAnhDaiDien('khong-phai-url', 96)).toBe('khong-phai-url');
  });
});
