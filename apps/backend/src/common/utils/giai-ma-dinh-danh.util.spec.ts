import { describe, expect, it } from 'vitest';
import { giaiMaDinhDanh } from './giai-ma-dinh-danh.util';

describe('giaiMaDinhDanh', () => {
  it('giải mã slug đã mã hóa và cắt khoảng trắng', () => {
    expect(giaiMaDinhDanh(' rustdesk%2Frustdesk ')).toBe('rustdesk/rustdesk');
  });

  it('chuỗi có % lẻ không ném lỗi, giữ nguyên chuỗi gốc', () => {
    expect(giaiMaDinhDanh('%zz')).toBe('%zz');
  });
});
