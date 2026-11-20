import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UngDungTomTatDto } from '@forgestore/types';
import { TheRepoGithub, kichHoatKiemDinhThe } from './TheRepoGithub';

function taoRepoGithub(ghiDe: Partial<UngDungTomTatDto> = {}): UngDungTomTatDto {
  return {
    maUngDung: 'https://github.com/EbookFoundation/free-programming-books',
    tenRepoDayDu: 'EbookFoundation/free-programming-books',
    chuSoHuu: 'EbookFoundation',
    tenKhoChua: 'free-programming-books',
    duongDanGithub: 'https://github.com/EbookFoundation/free-programming-books',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/14127308?v=4',
    soSaoGithub: 350000,
    danhMucChinh: 'TaiLieu',
    nenTangHoTro: null,
    chuaThamDinh: true,
    duocNoiBat: false,
    daXacMinh: false,
    daLuuTru: false,
    moTaGocTiengAnh: 'Freely available programming books',
    ...ghiDe,
  };
}

describe('TheRepoGithub (P3B-43)', () => {
  it('hiển thị tên repo, owner/repo, sao, mô tả tiếng Anh và nhãn GitHub', () => {
    const html = renderToStaticMarkup(
      <TheRepoGithub repo={taoRepoGithub()} onKiemDinh={vi.fn()} />,
    );

    expect(html).toContain('free-programming-books');
    expect(html).toContain('EbookFoundation/free-programming-books');
    expect(html).toContain('350.0k');
    expect(html).toContain('Freely available programming books');
    expect(html).toContain('GitHub');
    expect(html).toContain('Thêm vào ForgeStore');
  });

  it('hiển thị trạng thái đang kiểm tra và thông báo lỗi ngay trên thẻ', () => {
    const htmlDangKiem = renderToStaticMarkup(
      <TheRepoGithub repo={taoRepoGithub()} dangKiemDinh onKiemDinh={vi.fn()} />,
    );
    expect(htmlDangKiem).toContain('Đang kiểm tra...');

    const htmlLoi = renderToStaticMarkup(
      <TheRepoGithub
        repo={taoRepoGithub()}
        loiKiemDinh="Hãy đăng nhập để thêm ứng dụng mới từ GitHub vào ForgeStore."
        onKiemDinh={vi.fn()}
      />,
    );
    expect(htmlLoi).toContain('Hãy đăng nhập để thêm ứng dụng mới từ GitHub vào ForgeStore.');
  });

  it('gọi onKiemDinh đúng đường dẫn và chặn khi thẻ đang bị khóa/đang kiểm tra', () => {
    const onKiemDinh = vi.fn();
    const repo = taoRepoGithub();

    kichHoatKiemDinhThe(repo, false, onKiemDinh);
    expect(onKiemDinh).toHaveBeenCalledTimes(1);
    expect(onKiemDinh).toHaveBeenCalledWith(
      'https://github.com/EbookFoundation/free-programming-books',
    );

    kichHoatKiemDinhThe(repo, true, onKiemDinh);
    expect(onKiemDinh).toHaveBeenCalledTimes(1);
  });
});
