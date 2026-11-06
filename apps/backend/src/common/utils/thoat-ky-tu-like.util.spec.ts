import { describe, expect, it } from 'vitest';
import { thoatKyTuLike } from './thoat-ky-tu-like.util';

describe('thoatKyTuLike', () => {
  it('thoát %, _ và dấu gạch chéo ngược để ILIKE không coi là ký tự đại diện', () => {
    expect(thoatKyTuLike('%zz')).toBe('\\%zz');
    expect(thoatKyTuLike('foo/bar_baz')).toBe('foo/bar\\_baz');
    expect(thoatKyTuLike('a\\b')).toBe('a\\\\b');
  });

  it('giữ nguyên slug bình thường', () => {
    expect(thoatKyTuLike('microsoft/PowerToys')).toBe('microsoft/PowerToys');
  });
});
