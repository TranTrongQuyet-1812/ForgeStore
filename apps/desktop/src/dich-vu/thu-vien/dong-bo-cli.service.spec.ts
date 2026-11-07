import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UngDungDaCaiDto } from '@forgestore/types';

const { invoke, thuVien, isTauri } = vi.hoisted(() => ({
  invoke: vi.fn(),
  thuVien: { xacNhanCaiDatCli: vi.fn(), capNhatPhienBanCli: vi.fn() },
  isTauri: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('./thu-vien.service', () => ({ thuVienService: thuVien }));
vi.mock('../xac-thuc/luu-tru-token', () => ({ isTauri }));

import {
  dongBoCacUngDungCli,
  dongBoUngDungCli,
  xoaLichSuDongBoChoTest,
} from './dong-bo-cli.service';

function ban(phan: Partial<UngDungDaCaiDto>): UngDungDaCaiDto {
  return {
    maBanGhi: 'b1',
    maNguoiDung: 'u1',
    maUngDung: 'app-1',
    maThietBi: 'tb-1',
    phienBanHienTai: '1.0.0',
    trinhQuanLyGoi: 'npm',
    tenGoiCli: 'ten-goi',
    trangThaiXacNhan: 'CHO_XAC_NHAN',
    ngayCaiDat: '2026-11-08',
    ...phan,
  } as UngDungDaCaiDto;
}

/** Giả lập hai lệnh Rust: kiểm đã cài và đọc phiên bản. */
function giaLapMay(daCai: boolean | null, phienBan: string | null) {
  invoke.mockImplementation(async (lenh: string) =>
    lenh === 'kiem_tra_goi_da_cai' ? daCai : phienBan,
  );
}

describe('dongBoUngDungCli (P3B-30)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    xoaLichSuDongBoChoTest();
    isTauri.mockReturnValue(true);
    thuVien.xacNhanCaiDatCli.mockResolvedValue({ thanhCong: true });
    thuVien.capNhatPhienBanCli.mockResolvedValue(true);
  });

  it('gói npm chỉ gọi một lệnh đọc phiên bản, đọc được thì coi là đã cài và tự xác nhận', async () => {
    giaLapMay(null, '1.0.0');

    const doi = await dongBoUngDungCli('tb-1', ban({ trinhQuanLyGoi: 'npm' }));

    expect(doi).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('doc_phien_ban_goi_da_cai', {
      trinhQuanLy: 'npm',
      tenGoi: 'ten-goi',
    });
    expect(thuVien.xacNhanCaiDatCli).toHaveBeenCalledWith('tb-1', 'app-1');
    expect(thuVien.capNhatPhienBanCli).not.toHaveBeenCalled();
  });

  it('gói winget vẫn gọi kiểm tra đã cài như cũ', async () => {
    giaLapMay(true, null);

    const doi = await dongBoUngDungCli('tb-1', ban({ trinhQuanLyGoi: 'winget' }));

    expect(doi).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('kiem_tra_goi_da_cai', {
      trinhQuanLy: 'winget',
      tenGoi: 'ten-goi',
    });
    expect(thuVien.xacNhanCaiDatCli).toHaveBeenCalledWith('tb-1', 'app-1');
  });

  it('gói pip đọc được phiên bản thật thì tự xác nhận (Việc 1)', async () => {
    giaLapMay(null, '1.0.0');

    const doi = await dongBoUngDungCli('tb-1', ban({ trinhQuanLyGoi: 'pip' }));

    expect(doi).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('doc_phien_ban_goi_da_cai', {
      trinhQuanLy: 'pip',
      tenGoi: 'ten-goi',
    });
    expect(thuVien.xacNhanCaiDatCli).toHaveBeenCalledWith('tb-1', 'app-1');
  });

  it('bản ghi CHO_XAC_NHAN khi lần 1 máy chưa có gói thì lần 2 phải hỏi lại và tự xác nhận khi người dùng đã cài (P3B-30 vòng 2)', async () => {
    // Lần 1: máy chưa có gói (npm trả null)
    giaLapMay(null, null);
    const doiLan1 = await dongBoUngDungCli('tb-1', ban({ trangThaiXacNhan: 'CHO_XAC_NHAN' }));
    expect(doiLan1).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(thuVien.xacNhanCaiDatCli).not.toHaveBeenCalled();

    // Người dùng vừa chạy lệnh cài xong, lần 2 mở Thư viện: máy đã có gói
    giaLapMay(null, '1.0.0');
    const doiLan2 = await dongBoUngDungCli('tb-1', ban({ trangThaiXacNhan: 'CHO_XAC_NHAN' }));
    expect(doiLan2).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(2); // Đã hỏi lại máy, không bị vướng khoảng nghỉ 10 phút!
    expect(thuVien.xacNhanCaiDatCli).toHaveBeenCalledWith('tb-1', 'app-1');
  });

  it('bản ghi DA_XAC_NHAN gọi hai lần liên tiếp thì lần 2 vẫn không hỏi máy (giữ khoảng nghỉ 10 phút)', async () => {
    giaLapMay(null, null);

    const doiLan1 = await dongBoUngDungCli('tb-1', ban({ trangThaiXacNhan: 'DA_XAC_NHAN' }));
    expect(doiLan1).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);

    // Lần 2 ngay sau đó: phải bỏ qua, không gọi thêm lệnh nào
    const doiLan2 = await dongBoUngDungCli('tb-1', ban({ trangThaiXacNhan: 'DA_XAC_NHAN' }));
    expect(doiLan2).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('bản ghi CHO_XAC_NHAN khi đã thấy gói thì giữ khoảng nghỉ 10 phút không hỏi lại máy', async () => {
    giaLapMay(null, '1.0.0');

    const doiLan1 = await dongBoUngDungCli('tb-1', ban({ trangThaiXacNhan: 'CHO_XAC_NHAN' }));
    expect(doiLan1).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);

    // Lần 2 ngay sau đó: đã thấy gói nên giữ khoảng nghỉ, không gọi thêm lệnh nào
    const doiLan2 = await dongBoUngDungCli('tb-1', ban({ trangThaiXacNhan: 'CHO_XAC_NHAN' }));
    expect(doiLan2).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('đọc được phiên bản khác thì ghi lên máy chủ', async () => {
    giaLapMay(true, '2.1.0');

    await dongBoUngDungCli('tb-1', ban({ trangThaiXacNhan: 'DA_XAC_NHAN' }));

    expect(thuVien.xacNhanCaiDatCli).not.toHaveBeenCalled();
    expect(thuVien.capNhatPhienBanCli).toHaveBeenCalledWith('tb-1', 'app-1', '2.1.0');
  });

  it('không kiểm được thì không làm gì và không báo đổi', async () => {
    giaLapMay(null, null);

    const doi = await dongBoUngDungCli('tb-1', ban({}));

    expect(doi).toBe(false);
    expect(thuVien.xacNhanCaiDatCli).not.toHaveBeenCalled();
    expect(thuVien.capNhatPhienBanCli).not.toHaveBeenCalled();
  });

  it('lệnh Rust lỗi thì coi như không biết, không ném lỗi', async () => {
    invoke.mockRejectedValue(new Error('npm không chạy được'));

    await expect(dongBoUngDungCli('tb-1', ban({}))).resolves.toBe(false);
    expect(thuVien.xacNhanCaiDatCli).not.toHaveBeenCalled();
  });

  it('trình quản lý chưa hỗ trợ (docker, scoop) thì không hỏi máy', async () => {
    giaLapMay(true, '1.0.0');

    const doi = await dongBoUngDungCli('tb-1', ban({ trinhQuanLyGoi: 'docker' }));

    expect(doi).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('pip chỉ đọc phiên bản, không hỏi "đã cài chưa" (chưa hỗ trợ)', async () => {
    giaLapMay(true, '2.0.0');

    await dongBoUngDungCli('tb-1', ban({ trinhQuanLyGoi: 'pip', trangThaiXacNhan: 'DA_XAC_NHAN' }));

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('doc_phien_ban_goi_da_cai', expect.any(Object));
  });

  it('chạy ngoài Tauri hoặc bản ghi không phải cài bằng lệnh thì bỏ qua', async () => {
    isTauri.mockReturnValue(false);
    expect(await dongBoUngDungCli('tb-1', ban({}))).toBe(false);

    isTauri.mockReturnValue(true);
    expect(await dongBoUngDungCli('tb-1', ban({ trinhQuanLyGoi: null }))).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('dongBoCacUngDungCli đếm số ứng dụng có thay đổi', async () => {
    giaLapMay(null, '1.0.0');

    const so = await dongBoCacUngDungCli('tb-1', [
      ban({ maUngDung: 'a' }),
      ban({ maUngDung: 'b', trangThaiXacNhan: 'DA_XAC_NHAN' }),
    ]);

    expect(so).toBe(1);
  });
});
