import { describe, it, expect } from 'vitest';
import { layMaMoTrangTuLink } from './search-utils';

describe('layMaMoTrangTuLink', () => {
  it('ghép owner/repo để API chi tiết tìm được (không truyền riêng tên repo)', () => {
    expect(layMaMoTrangTuLink({ owner: 'sharkdp', repo: 'bat' })).toBe('sharkdp/bat');
  });

  it('thiếu owner thì dùng tên repo', () => {
    expect(layMaMoTrangTuLink({ owner: '', repo: 'bat' })).toBe('bat');
  });

  it('cắt khoảng trắng thừa', () => {
    expect(layMaMoTrangTuLink({ owner: ' sharkdp ', repo: ' bat ' })).toBe('sharkdp/bat');
  });
});
