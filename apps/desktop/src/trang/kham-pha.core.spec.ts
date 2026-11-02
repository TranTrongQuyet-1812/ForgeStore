import { describe, expect, it, vi } from 'vitest';
import { gopTrangUngDung, haiTrangGiongNhau, rutVeTrangDau, taoAnhXaCoNho } from './kham-pha.core';

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

describe('taoAnhXaCoNho', () => {
  it('trả lại đúng đối tượng cũ và chỉ ánh xạ một lần cho cùng dữ liệu nguồn', () => {
    const anhXa = vi.fn((nguon: { id: string }) => ({ ten: nguon.id }));
    const anhXaCoNho = taoAnhXaCoNho(anhXa);
    const nguon = { id: 'a' };

    expect(anhXaCoNho(nguon)).toBe(anhXaCoNho(nguon));
    expect(anhXa).toHaveBeenCalledTimes(1);
    expect(anhXaCoNho({ id: 'a' })).not.toBe(anhXaCoNho(nguon));
  });
});

describe('haiTrangGiongNhau', () => {
  it('chỉ giống khi cùng độ dài và từng phần tử cùng tham chiếu', () => {
    const a = { id: 1 };
    const b = { id: 2 };

    expect(haiTrangGiongNhau([a, b], [a, b])).toBe(true);
    expect(haiTrangGiongNhau([a], [a, b])).toBe(false);
    expect(haiTrangGiongNhau([a, b], [a, { id: 2 }])).toBe(false);
  });
});
