import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UngDungDaCaiDto } from '@forgestore/types';
import { dongBoCacUngDungCli } from '../dich-vu/thu-vien/dong-bo-cli.service';

/** Số lần đối chiếu tối đa mỗi lần mở trang, chặn vòng lặp nếu máy chủ trả dữ liệu không đổi theo. */
const SO_LAN_TOI_DA = 3;

/**
 * P3B-30: khi mở Thư viện hoặc trang chi tiết, đối chiếu ứng dụng cài bằng dòng lệnh với máy này
 * (tự xác nhận khi gói có thật, đọc phiên bản thật). Có thay đổi thì nạp lại danh sách ứng dụng đã cài.
 */
export function useDongBoUngDungCli(
  maThietBi: string | null | undefined,
  danhSach: UngDungDaCaiDto[],
): void {
  const queryClient = useQueryClient();
  const khoaDaChay = useRef<string>('');
  const soLan = useRef(0);

  const banCli = danhSach.filter((b) => b.trinhQuanLyGoi && b.tenGoiCli);
  // Khóa theo nội dung có thể đổi (trạng thái, phiên bản): đổi thì chạy lại, giữ nguyên thì thôi
  const khoa = banCli
    .map((b) => `${b.maUngDung}:${b.trangThaiXacNhan}:${b.phienBanHienTai}`)
    .join('|');

  useEffect(() => {
    if (!maThietBi || banCli.length === 0 || khoa === khoaDaChay.current) return;
    if (soLan.current >= SO_LAN_TOI_DA) return;
    khoaDaChay.current = khoa;
    soLan.current += 1;

    void dongBoCacUngDungCli(maThietBi, banCli).then((soDoi) => {
      if (soDoi > 0) void queryClient.invalidateQueries({ queryKey: ['device-installed-apps'] });
    });
    // banCli suy ra từ danhSach và đã nằm trong khóa; không đưa vào deps để khỏi chạy lại mỗi lần render
  }, [maThietBi, khoa, queryClient]);
}
