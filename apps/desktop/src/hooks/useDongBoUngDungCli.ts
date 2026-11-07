import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UngDungDaCaiDto } from '@forgestore/types';
import { dongBoCacUngDungCli } from '../dich-vu/thu-vien/dong-bo-cli.service';
import { useCapNhatStore } from '../kho-trang-thai/useCapNhatStore';

/** Số lần đối chiếu tối đa mỗi lần mở trang, chặn vòng lặp nếu máy chủ trả dữ liệu không đổi theo. */
export const SO_LAN_TOI_DA = 3;

/** Lọc ra các bản ghi được cài đặt qua dòng lệnh CLI. */
export function layDanhSachBanGhiCli(danhSach: UngDungDaCaiDto[]): UngDungDaCaiDto[] {
  return danhSach.filter((b) => Boolean(b.trinhQuanLyGoi && b.tenGoiCli));
}

/** Khóa đại diện cho trạng thái và phiên bản của danh sách ứng dụng CLI (đổi thì cần đối chiếu lại). */
export function taoKhoaDongBoCli(banCli: UngDungDaCaiDto[]): string {
  return banCli.map((b) => `${b.maUngDung}:${b.trangThaiXacNhan}:${b.phienBanHienTai}`).join('|');
}

export interface KetQuaQuyetDinhDongBoCli {
  canChay: boolean;
  khoaMoi: string;
  banCli: UngDungDaCaiDto[];
}

/**
 * Hàm thuần quyết định có cần kích hoạt đối chiếu CLI với máy hay không (P3B-30).
 * Dừng khi không có thiết bị, không có gói CLI, nội dung không đổi, hoặc đã chạy đủ 3 lần.
 */
export function quyetDinhChayDongBoCli(
  maThietBi: string | null | undefined,
  danhSach: UngDungDaCaiDto[],
  khoaDaChay: string,
  soLanDaChay: number,
): KetQuaQuyetDinhDongBoCli {
  if (!maThietBi) return { canChay: false, khoaMoi: khoaDaChay, banCli: [] };
  const banCli = layDanhSachBanGhiCli(danhSach);
  if (banCli.length === 0) return { canChay: false, khoaMoi: khoaDaChay, banCli: [] };

  const khoaMoi = taoKhoaDongBoCli(banCli);
  if (khoaMoi === khoaDaChay) return { canChay: false, khoaMoi: khoaDaChay, banCli };
  if (soLanDaChay >= SO_LAN_TOI_DA) return { canChay: false, khoaMoi: khoaDaChay, banCli };

  return { canChay: true, khoaMoi, banCli };
}

/**
 * Xử lý sau khi hoàn thành đồng bộ CLI:
 * Có thay đổi thì nạp lại danh sách app đã cài và gọi lại kiểm tra cập nhật để tắt ngay nhãn "Có bản mới".
 */
export async function xuLySauDongBoCli(
  maThietBi: string,
  soDoi: number,
  queryClient: { invalidateQueries: (opt: { queryKey: string[] }) => Promise<void> | void },
  capNhatStore?: { kiemTraCapNhat: (id: string) => Promise<unknown> | unknown },
): Promise<void> {
  if (soDoi > 0) {
    void queryClient.invalidateQueries({ queryKey: ['device-installed-apps'] });
    if (capNhatStore) {
      void capNhatStore.kiemTraCapNhat(maThietBi);
    }
  }
}

/**
 * P3B-30: khi mở Thư viện hoặc trang chi tiết, đối chiếu ứng dụng cài bằng dòng lệnh với máy này
 * (tự xác nhận khi gói có thật, đọc phiên bản thật). Có thay đổi thì nạp lại danh sách ứng dụng đã cài
 * và kiểm tra lại cập nhật để làm mới nhãn "Có bản mới".
 */
export function useDongBoUngDungCli(
  maThietBi: string | null | undefined,
  danhSach: UngDungDaCaiDto[],
): void {
  const queryClient = useQueryClient();
  const khoaDaChay = useRef<string>('');
  const soLan = useRef(0);

  const banCli = layDanhSachBanGhiCli(danhSach);
  const khoa = taoKhoaDongBoCli(banCli);

  useEffect(() => {
    const qd = quyetDinhChayDongBoCli(maThietBi, danhSach, khoaDaChay.current, soLan.current);
    if (!qd.canChay || !maThietBi) return;

    khoaDaChay.current = qd.khoaMoi;
    soLan.current += 1;

    void dongBoCacUngDungCli(maThietBi, qd.banCli).then((soDoi) => {
      void xuLySauDongBoCli(maThietBi, soDoi, queryClient, useCapNhatStore.getState());
    });
  }, [maThietBi, khoa, queryClient]);
}
