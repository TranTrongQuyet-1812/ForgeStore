import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GiaiThichGiayPhep } from './GiaiThichGiayPhep';

describe('GiaiThichGiayPhep (P3B-40)', () => {
  it('mặc định đóng và có nút aria-expanded="false"', () => {
    const html = renderToStaticMarkup(<GiaiThichGiayPhep loaiGiayPhep="MIT License" />);

    expect(html).toContain('Giấy phép này nghĩa là gì?');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Khi bạn dùng ứng dụng');
    expect(html).not.toContain('Giải thích chỉ để tham khảo, không phải tư vấn pháp lý.');
  });

  it('khi mở hiện tên hiển thị, hai khối giải thích và dòng lưu ý cố định', () => {
    const html = renderToStaticMarkup(
      <GiaiThichGiayPhep loaiGiayPhep="GNU General Public License v3.0" moMacDinh />,
    );

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Giấy phép GPL 3.0');
    expect(html).toContain('Khi bạn dùng ứng dụng');
    expect(html).toContain('Nếu bạn sửa hoặc chia sẻ lại');
    expect(html).toContain('Được dùng miễn phí, kể cả cho công việc.');
    expect(html).toContain('Giải thích chỉ để tham khảo, không phải tư vấn pháp lý.');
  });

  it('hiện câu chung khi mở với giấy phép Other hoặc chưa rõ', () => {
    const html = renderToStaticMarkup(<GiaiThichGiayPhep loaiGiayPhep="Other" moMacDinh />);

    expect(html).toContain('Giấy phép riêng hoặc chưa phân loại');
    expect(html).toContain(
      'Dự án này dùng giấy phép riêng, hoặc ForgeStore chưa có phần giải thích cho giấy phép này.',
    );
    expect(html).toContain('Giải thích chỉ để tham khảo, không phải tư vấn pháp lý.');
  });
});
