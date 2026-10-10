import { describe, expect, it } from 'vitest';
import { canhBaoDong } from './data-repo.canh-bao';
import type { DongDaKiem } from './data-repo.types';

function dong(p: Partial<DongDaKiem> = {}): DongDaKiem {
  return {
    repo: 'o/app',
    lo: 'thu',
    moTaEn: 'A fast tool',
    moTaVi: 'Công cụ nhanh',
    readmeSha: null,
    etagRepo: null,
    etagReleases: null,
    etagReadme: null,
    doan: [],
    readmeVi: 'Cài đặt rồi tải về bản phát hành mới.',
    nguon: 'x',
    ...p,
  };
}

const loai = (d: DongDaKiem) => canhBaoDong(d).map((c) => c.loai);

describe('canhBaoDong', () => {
  it('bản dịch sạch không có cảnh báo', () => {
    expect(loai(dong())).toEqual([]);
  });

  it('mô tả có tính từ khen, quá dài, nhiều câu', () => {
    expect(loai(dong({ moTaVi: 'Công cụ mạnh mẽ và nhanh chóng' }))).toContain(
      'mo_ta_tinh_tu_khen',
    );
    expect(loai(dong({ moTaVi: 'x'.repeat(161) }))).toContain('mo_ta_dai');
    expect(loai(dong({ moTaVi: 'Biến web thành app. Đóng gói rất đơn giản.' }))).toContain(
      'mo_ta_nhieu_cau',
    );
  });

  it('mô tả dài hơn gốc quá nhiều (dấu hiệu thêm ý)', () => {
    const d = dong({ moTaEn: 'Pear is extension', moTaVi: 'Tiện ích mở rộng '.repeat(5) });
    expect(loai(d)).toContain('mo_ta_dai_hon_goc_nhieu');
  });

  it('thuật ngữ sai bảng bị cảnh báo', () => {
    const d = dong({
      readmeVi: 'Gửi yêu cầu kéo. Tải xuống bản mới. Cộng tác viên. Kho lưu trữ này.',
    });
    expect(loai(d)).toEqual(
      expect.arrayContaining([
        'thuat_ngu_pull_request',
        'thuat_ngu_tai_ve',
        'thuat_ngu_nguoi_dong_gop',
        'thuat_ngu_kho',
      ]),
    );
  });

  it('không cảnh báo thuật ngữ nằm trong khối mã, mã nội dòng hoặc URL', () => {
    const d = dong({
      readmeVi:
        'Dùng `tải xuống` và\n```\nkho lưu trữ yêu cầu kéo\n```\n[Link](https://x/tải-xuống)',
    });
    expect(loai(d)).toEqual([]);
  });

  it('repository còn nhiều lần bị cảnh báo', () => {
    const d = dong({ readmeVi: 'repository repository repository repository' });
    expect(loai(d)).toContain('thuat_ngu_repository_con_nhieu');
  });
});
