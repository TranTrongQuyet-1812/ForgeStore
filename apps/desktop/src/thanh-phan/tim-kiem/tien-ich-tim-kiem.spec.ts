import { describe, it, expect } from 'vitest';
import type { TimKiemResponseDto, UngDungTomTatDto } from '@forgestore/types';
import {
  layDuongDanKiemDinhRepo,
  layMaMoTrangTuLink,
  locUngDungTrongKho,
  nenHienPhanGithub,
  quyetDinhKhiNhanEnter,
  taoDongPhuKetQuaTimKiem,
  thongTinNutXemTatCa,
} from './tien-ich-tim-kiem';

function taoApp(ghiDe: Partial<UngDungTomTatDto> = {}): UngDungTomTatDto {
  return {
    maUngDung: 'app-1',
    daLuuTru: false,
    tenRepoDayDu: 'sharkdp/bat',
    chuSoHuu: 'sharkdp',
    tenKhoChua: 'bat',
    duongDanGithub: 'https://github.com/sharkdp/bat',
    soSaoGithub: 50000,
    danhMucChinh: 'Tiện ích hệ thống',
    nenTangHoTro: 'WINDOWS',
    duocNoiBat: false,
    daXacMinh: true,
    ...ghiDe,
  };
}

function taoKetQua(ghiDe: Partial<TimKiemResponseDto> = {}): TimKiemResponseDto {
  return {
    duLieu: [taoApp()],
    tongSo: 12,
    trangHienTai: 1,
    kichThuocTrang: 20,
    tongSoTrang: 1,
    loaiTruyVan: 'TEN_APP',
    nguonKetQua: 'CSDL',
    ...ghiDe,
  };
}

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

describe('thongTinNutXemTatCa & taoDongPhuKetQuaTimKiem (P3B-41)', () => {
  it('luồng tên app từ CSDL: hiện nút kèm tổng số thật', () => {
    const kq = taoKetQua({ loaiTruyVan: 'TEN_APP', nguonKetQua: 'CSDL', tongSo: 63 });
    expect(thongTinNutXemTatCa(kq)).toEqual({ hienThi: true, nhan: 'Xem tất cả 63 kết quả' });
    expect(taoDongPhuKetQuaTimKiem(kq)).toBe('Tìm thấy 63 ứng dụng');
  });

  it('luồng ý định hoặc nguồn kết hợp: hiện nút không kèm số giả', () => {
    const kq = taoKetQua({ loaiTruyVan: 'Y_DINH', nguonKetQua: 'KET_HOP', tongSo: 20 });
    expect(thongTinNutXemTatCa(kq)).toEqual({ hienThi: true, nhan: 'Xem tất cả kết quả' });
    expect(taoDongPhuKetQuaTimKiem(kq)).toBe('Các kết quả phù hợp nhất');
  });

  it('chỉ có kết quả GitHub chưa thẩm định vẫn hiện nút Xem tất cả (không gắn số), vì trang kết quả hiện cả hai nguồn', () => {
    const kqGithub = taoKetQua({
      loaiTruyVan: 'TEN_APP',
      nguonKetQua: 'GITHUB',
      tongSo: 640,
      duLieu: [taoApp({ maUngDung: 'other/tool', tenRepoDayDu: 'other/tool', chuaThamDinh: true })],
    });
    expect(thongTinNutXemTatCa(kqGithub)).toEqual({ hienThi: true, nhan: 'Xem tất cả kết quả' });

    const kqKetHopToanGithub = taoKetQua({
      loaiTruyVan: 'Y_DINH',
      nguonKetQua: 'KET_HOP',
      duLieu: [taoApp({ chuaThamDinh: true })],
    });
    expect(thongTinNutXemTatCa(kqKetHopToanGithub)).toEqual({
      hienThi: true,
      nhan: 'Xem tất cả kết quả',
    });
  });

  it('kết quả dán link GitHub (URL) không có trang riêng nên không hiện nút Xem tất cả', () => {
    const kqUrl = taoKetQua({
      loaiTruyVan: 'URL',
      nguonKetQua: 'URL',
      duLieu: [taoApp({ chuaThamDinh: true })],
    });
    expect(thongTinNutXemTatCa(kqUrl)).toEqual({ hienThi: false, nhan: '' });
  });

  it('không có kết quả hoặc null: ẩn nút Xem tất cả', () => {
    expect(thongTinNutXemTatCa(null)).toEqual({ hienThi: false, nhan: '' });
    expect(thongTinNutXemTatCa(taoKetQua({ duLieu: [], tongSo: 0 }))).toEqual({
      hienThi: false,
      nhan: '',
    });
  });
});

describe('locUngDungTrongKho (P3B-41)', () => {
  it('lọc bỏ mọi repo GitHub chưa thẩm định khỏi trang kết quả', () => {
    const trongKho = taoApp({ maUngDung: 'app-1', chuaThamDinh: false });
    const tuGithub = taoApp({
      maUngDung: 'gh/new',
      tenRepoDayDu: 'gh/new',
      chuaThamDinh: true,
    });

    expect(locUngDungTrongKho([trongKho, tuGithub], 'KET_HOP')).toEqual([trongKho]);
    expect(locUngDungTrongKho([trongKho], 'GITHUB')).toEqual([]);
    expect(locUngDungTrongKho(undefined, 'CSDL')).toEqual([]);
  });
});

describe('quyetDinhKhiNhanEnter (P3B-41)', () => {
  it('nhánh 1: từ khóa dưới 2 ký tự không làm gì', () => {
    expect(
      quyetDinhKhiNhanEnter({
        tuKhoa: 'a',
        laDuongDanGithub: false,
        ketQua: taoKetQua(),
        chiSoDangChon: -1,
      }),
    ).toEqual({ loai: 'KHONG_LAM_GI' });
  });

  it('nhánh 2: dán link GitHub đã có trong kho thì mở chi tiết, chưa có thì kiểm định repo', () => {
    const daCo = taoKetQua({
      loaiTruyVan: 'URL',
      nguonKetQua: 'URL',
      duLieu: [],
      duongDanUrl: {
        owner: 'sharkdp',
        repo: 'bat',
        urlGoc: 'https://github.com/sharkdp/bat',
        daCoTrongStore: true,
      },
    });
    expect(
      quyetDinhKhiNhanEnter({
        tuKhoa: 'https://github.com/sharkdp/bat',
        laDuongDanGithub: true,
        ketQua: daCo,
        chiSoDangChon: -1,
      }),
    ).toEqual({ loai: 'MO_CHI_TIET', maMoTrang: 'sharkdp/bat' });

    expect(
      quyetDinhKhiNhanEnter({
        tuKhoa: 'sharkdp/bat',
        laDuongDanGithub: true,
        ketQua: null,
        chiSoDangChon: -1,
      }),
    ).toEqual({ loai: 'KIEM_DINH_REPO', duongDan: 'sharkdp/bat' });
  });

  it('nhánh 3: đang chọn dòng kết quả bằng mũi tên thì mở chi tiết hoặc kiểm định repo', () => {
    const trongKho = taoApp({ tenRepoDayDu: 'obsidianmd/obsidian-releases' });
    const tuGithub = taoApp({
      tenRepoDayDu: 'new/repo',
      duongDanGithub: 'https://github.com/new/repo',
      chuaThamDinh: true,
    });
    const kq = taoKetQua({ duLieu: [trongKho, tuGithub], nguonKetQua: 'KET_HOP' });

    expect(
      quyetDinhKhiNhanEnter({
        tuKhoa: 'obsidian',
        laDuongDanGithub: false,
        ketQua: kq,
        chiSoDangChon: 0,
      }),
    ).toEqual({ loai: 'MO_CHI_TIET', maMoTrang: 'obsidianmd/obsidian-releases' });

    expect(
      quyetDinhKhiNhanEnter({
        tuKhoa: 'obsidian',
        laDuongDanGithub: false,
        ketQua: kq,
        chiSoDangChon: 1,
      }),
    ).toEqual({ loai: 'KIEM_DINH_REPO', duongDan: 'https://github.com/new/repo' });

    // Đang chọn dòng "Xem tất cả" ở cuối danh sách (với tối đa 8 dòng -> index = 2)
    expect(
      quyetDinhKhiNhanEnter({
        tuKhoa: 'obsidian',
        laDuongDanGithub: false,
        ketQua: kq,
        chiSoDangChon: 2,
      }),
    ).toEqual({ loai: 'MO_TRANG_KET_QUA', tuKhoa: 'obsidian' });
  });

  it('nhánh 4: không chọn dòng nào và có ít nhất một app trong kho thì mở trang kết quả', () => {
    expect(
      quyetDinhKhiNhanEnter({
        tuKhoa: '  ghi chú  ',
        laDuongDanGithub: false,
        ketQua: taoKetQua({ loaiTruyVan: 'Y_DINH', nguonKetQua: 'KET_HOP' }),
        chiSoDangChon: -1,
      }),
    ).toEqual({ loai: 'MO_TRANG_KET_QUA', tuKhoa: 'ghi chú' });
  });

  it('nhánh 5: không chọn dòng nào mà chỉ có kết quả từ GitHub, kết quả rỗng hoặc chưa về thì vẫn mở trang kết quả (trang tự tìm cả hai nguồn)', () => {
    const kqChiGithub = taoKetQua({
      loaiTruyVan: 'TEN_APP',
      nguonKetQua: 'GITHUB',
      duLieu: [taoApp({ chuaThamDinh: true })],
    });
    expect(
      quyetDinhKhiNhanEnter({
        tuKhoa: 'free-programming-books',
        laDuongDanGithub: false,
        ketQua: kqChiGithub,
        chiSoDangChon: -1,
      }),
    ).toEqual({ loai: 'MO_TRANG_KET_QUA', tuKhoa: 'free-programming-books' });

    expect(
      quyetDinhKhiNhanEnter({
        tuKhoa: 'không có gì',
        laDuongDanGithub: false,
        ketQua: taoKetQua({ duLieu: [], tongSo: 0 }),
        chiSoDangChon: -1,
      }),
    ).toEqual({ loai: 'MO_TRANG_KET_QUA', tuKhoa: 'không có gì' });

    // Gõ nhanh rồi Enter khi dropdown chưa kịp có kết quả.
    expect(
      quyetDinhKhiNhanEnter({
        tuKhoa: 'redis',
        laDuongDanGithub: false,
        ketQua: null,
        chiSoDangChon: -1,
      }),
    ).toEqual({ loai: 'MO_TRANG_KET_QUA', tuKhoa: 'redis' });
  });
});

describe('nenHienPhanGithub & layDuongDanKiemDinhRepo (P3B-43)', () => {
  it('bật phần 2 khi phần 1 là TEN_APP, kể cả khi phần 1 trong kho trống', () => {
    expect(nenHienPhanGithub(true, { loaiTruyVan: 'TEN_APP' })).toBe(true);
    expect(nenHienPhanGithub(true, { loaiTruyVan: 'Y_DINH' })).toBe(false);
    expect(nenHienPhanGithub(true, { loaiTruyVan: 'URL' })).toBe(false);
    expect(nenHienPhanGithub(true, null)).toBe(false);
    expect(nenHienPhanGithub(false, { loaiTruyVan: 'TEN_APP' })).toBe(false);
  });

  it('ưu tiên duongDanGithub và lùi về tenRepoDayDu khi kích hoạt kiểm định thẻ GitHub', () => {
    expect(
      layDuongDanKiemDinhRepo({
        duongDanGithub: 'https://github.com/EbookFoundation/free-programming-books',
        tenRepoDayDu: 'EbookFoundation/free-programming-books',
      }),
    ).toBe('https://github.com/EbookFoundation/free-programming-books');

    expect(
      layDuongDanKiemDinhRepo({
        duongDanGithub: '',
        tenRepoDayDu: 'someone/tool',
      }),
    ).toBe('someone/tool');
  });
});
