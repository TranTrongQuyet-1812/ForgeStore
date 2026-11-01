import { describe, expect, it } from 'vitest';
import { gopTrangUngDung } from './kham-pha.core';

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
});
