import { describe, expect, it } from 'vitest';
import { gopTrangUngDung, rutVeTrangDau } from './kham-pha.core';

describe('gộp các trang ứng dụng', () => {
  it('loại ứng dụng trùng ID mà vẫn giữ thứ tự và ranh giới từng lượt tải', () => {
    const trang = gopTrangUngDung([
      { duLieu: [{ maUngDung: 'a' }, { maUngDung: 'b' }, { maUngDung: 'a' }] },
      { duLieu: [{ maUngDung: 'b' }, { maUngDung: 'c' }] },
    ]);

    expect(trang).toEqual([[{ maUngDung: 'a' }, { maUngDung: 'b' }], [{ maUngDung: 'c' }]]);
  });

  it('trả về danh sách rỗng khi chưa có trang', () => {
    expect(gopTrangUngDung([])).toEqual([]);
  });

  it('rút cache về trang đầu và giữ đúng tham số phân trang đi kèm', () => {
    const cache = {
      pages: [{ trang: 1 }, { trang: 2 }],
      pageParams: [1, 2],
      boSung: 'được giữ lại',
    };

    expect(rutVeTrangDau(cache)).toEqual({
      pages: [{ trang: 1 }],
      pageParams: [1],
      boSung: 'được giữ lại',
    });
    expect(cache.pages).toHaveLength(2);
  });

  it('không đổi cache chưa có trang hoặc chỉ có một trang', () => {
    const cache = { pages: [{ trang: 1 }], pageParams: [1] };
    expect(rutVeTrangDau(undefined)).toBeUndefined();
    expect(rutVeTrangDau(cache)).toBe(cache);
  });
});
