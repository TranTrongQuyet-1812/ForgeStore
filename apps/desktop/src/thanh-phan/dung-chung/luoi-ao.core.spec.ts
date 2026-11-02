import { describe, expect, it } from 'vitest';
import { chiaThanhHang, laySoCot } from './luoi-ao.core';

describe('lưới ảo: số cột theo độ rộng cửa sổ', () => {
  it.each([
    [1920, 3],
    [1024, 3],
    [1023, 2],
    [768, 2],
    [767, 1],
    [400, 1],
  ])('độ rộng %i px có %i cột', (doRong, soCot) => {
    expect(laySoCot(doRong)).toBe(soCot);
  });
});

describe('lưới ảo: chia hàng', () => {
  it('chia đều và để hàng cuối còn dư', () => {
    expect(chiaThanhHang([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it('danh sách rỗng không có hàng nào', () => {
    expect(chiaThanhHang([], 3)).toEqual([]);
  });

  it('số cột không hợp lệ thì coi như một cột', () => {
    expect(chiaThanhHang([1, 2], 0)).toEqual([[1], [2]]);
  });
});
