import React, { useEffect, useRef } from 'react';
import { driver, type DriveStep, type Driver, type PopoverDOM } from 'driver.js';
import {
  CAC_BUOC_HUONG_DAN_CHI_TIET,
  CAC_BUOC_HUONG_DAN_KHAM_PHA,
  REPO_MAU_HUONG_DAN,
  danhDauDaXemHuongDanLanDau,
  daXemHuongDanLanDau,
  type BuocHuongDanNhanh,
} from '../../dich-vu/huong-dan/huong-dan.core';
import { useDieuHuongStore } from '../../kho-trang-thai/useDieuHuongStore';
import { useHuongDanStore } from '../../kho-trang-thai/useHuongDanStore';

const CHU_KY_DO_DOM_MS = 150;
const SO_LAN_DO_DOM_TOI_DA = 30; // ~4,5 giây chờ Trang Chi tiết tải xong

/**
 * Tiêm nút "Bỏ qua" vào chân popover để người dùng luôn chỉ thấy 2 nút gọn: Bỏ qua + Tiếp tục/Hoàn tất.
 */
function chenNutBoQua(popover: PopoverDOM, boDieuKhien: Driver) {
  if (popover.footerButtons.querySelector('.forgestore-tour-skip-btn')) return;
  const nutBoQua = document.createElement('button');
  nutBoQua.type = 'button';
  nutBoQua.className = 'driver-popover-footer-btn forgestore-tour-skip-btn';
  nutBoQua.textContent = 'Bỏ qua';
  nutBoQua.addEventListener('click', () => {
    danhDauDaXemHuongDanLanDau();
    boDieuKhien.destroy();
  });
  popover.footerButtons.insertBefore(nutBoQua, popover.nextButton);
}

/**
 * Chuyển danh sách bước cấu hình sang định dạng `DriveStep` của `driver.js` kèm tiến độ xuyên suốt 2 chặng.
 */
function taoDanhSachBuocDriver(
  cacBuoc: readonly BuocHuongDanNhanh[],
  chiSoBatDau: number,
  tongSoBuoc: number,
  khiBamTiepBuocCuoi?: () => void,
): DriveStep[] {
  return cacBuoc.map((buoc, idx) => {
    const laBuocCuoi = idx === cacBuoc.length - 1;
    return {
      element: buoc.element,
      popover: {
        title: buoc.tieuDe,
        description: buoc.moTa,
        side: buoc.phia,
        progressText: `${chiSoBatDau + idx + 1} / ${tongSoBuoc}`,
        ...(laBuocCuoi && khiBamTiepBuocCuoi
          ? {
              onNextClick: () => khiBamTiepBuocCuoi(),
            }
          : {}),
      },
    };
  });
}

/**
 * Điều phối tour hướng dẫn nhanh 2 chặng (9 bước) trên toàn ứng dụng Desktop (P3B-46).
 * Mount một lần trong `BoCucUngDung`: tự chạy 1 lần đầu trên Khám phá và hỗ trợ xem lại bất cứ lúc nào.
 */
export const HuongDanLanDau: React.FC = () => {
  const currentTab = useDieuHuongStore((s) => s.currentTab);
  const yeuCauChayLai = useHuongDanStore((s) => s.yeuCauChayLai);

  const driverHienTaiRef = useRef<Driver | null>(null);
  const boDemChoChiTietRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const daUnmountRef = useRef(false);
  const daTuChayLanDauRef = useRef(false);
  const yeuCauDaXuLyRef = useRef(0);

  const dungChoChiTiet = () => {
    if (boDemChoChiTietRef.current) {
      clearInterval(boDemChoChiTietRef.current);
      boDemChoChiTietRef.current = null;
    }
  };

  const huyTourHienTai = () => {
    dungChoChiTiet();
    if (driverHienTaiRef.current) {
      try {
        driverHienTaiRef.current.destroy();
      } catch {
        // Bỏ qua nếu popover đã được dọn trước đó
      }
      driverHienTaiRef.current = null;
    }
  };

  const khoiChayChangHai = (cacBuocHopLe: readonly BuocHuongDanNhanh[]) => {
    if (daUnmountRef.current || cacBuocHopLe.length === 0) {
      danhDauDaXemHuongDanLanDau();
      return;
    }

    const soBuocChangMot = CAC_BUOC_HUONG_DAN_KHAM_PHA.length;
    const tongBuoc = soBuocChangMot + cacBuocHopLe.length;
    const steps = taoDanhSachBuocDriver(cacBuocHopLe, soBuocChangMot, tongBuoc);

    const d = driver({
      steps,
      smoothScroll: true,
      allowClose: true,
      showProgress: true,
      showButtons: ['next', 'close'],
      nextBtnText: 'Tiếp tục',
      doneBtnText: 'Hoàn tất',
      popoverClass: 'forgestore-tour-popover',
      onPopoverRender: (popover, opts) => chenNutBoQua(popover, opts.driver),
      onDestroyed: () => {
        if (driverHienTaiRef.current === d) {
          driverHienTaiRef.current = null;
        }
        danhDauDaXemHuongDanLanDau();
      },
    });

    driverHienTaiRef.current = d;
    d.drive();
  };

  const chuyenSangChangHai = () => {
    dungChoChiTiet();
    useDieuHuongStore.getState().openAppDetail(REPO_MAU_HUONG_DAN);

    let soLanDo = 0;
    boDemChoChiTietRef.current = setInterval(() => {
      if (daUnmountRef.current) {
        dungChoChiTiet();
        return;
      }

      // Người dùng chủ động chuyển sang tab khác trong lúc chờ tải trang mẫu: dừng sạch và đánh dấu đã xem
      if (useDieuHuongStore.getState().currentTab !== 'detail') {
        dungChoChiTiet();
        danhDauDaXemHuongDanLanDau();
        return;
      }

      soLanDo += 1;
      const coReadme = Boolean(document.querySelector('[data-tour="chi-tiet-readme"]'));
      const coCli = Boolean(document.querySelector('[data-tour="chi-tiet-cli"]'));

      if (coReadme && coCli) {
        dungChoChiTiet();
        const buocTonTai = CAC_BUOC_HUONG_DAN_CHI_TIET.filter((b) =>
          Boolean(document.querySelector(b.element)),
        );
        khoiChayChangHai(buocTonTai);
        return;
      }

      // Dự phòng khi mất mạng hoặc API chậm quá 4,5 giây: chỉ chạy Bước 5 trên nút Trợ giúp (?) để không kẹt
      if (soLanDo >= SO_LAN_DO_DOM_TOI_DA) {
        dungChoChiTiet();
        const buocTroGiup = CAC_BUOC_HUONG_DAN_CHI_TIET[0];
        const coNutTroGiup = buocTroGiup && Boolean(document.querySelector(buocTroGiup.element));
        khoiChayChangHai(coNutTroGiup ? [buocTroGiup] : []);
      }
    }, CHU_KY_DO_DOM_MS);
  };

  const khoiChayChangMot = () => {
    if (daUnmountRef.current) return;
    huyTourHienTai();

    const buocKhamPha = CAC_BUOC_HUONG_DAN_KHAM_PHA.filter((b) =>
      Boolean(document.querySelector(b.element)),
    );
    if (buocKhamPha.length === 0) return;

    const tongBuoc = CAC_BUOC_HUONG_DAN_KHAM_PHA.length + CAC_BUOC_HUONG_DAN_CHI_TIET.length;
    let dangChuyenChang = false;

    const steps = taoDanhSachBuocDriver(buocKhamPha, 0, tongBuoc, () => {
      dangChuyenChang = true;
      d.destroy();
      chuyenSangChangHai();
    });

    const d = driver({
      steps,
      smoothScroll: true,
      allowClose: true,
      showProgress: true,
      showButtons: ['next', 'close'],
      nextBtnText: 'Tiếp tục',
      // Bước 4 là bước cuối Chặng 1 nhưng nút vẫn là "Tiếp tục" để mở Chặng 2 trên Trang Chi tiết
      doneBtnText: 'Tiếp tục',
      popoverClass: 'forgestore-tour-popover',
      onPopoverRender: (popover, opts) => chenNutBoQua(popover, opts.driver),
      onDestroyed: () => {
        if (driverHienTaiRef.current === d) {
          driverHienTaiRef.current = null;
        }
        if (!dangChuyenChang) {
          danhDauDaXemHuongDanLanDau();
        }
      },
    });

    driverHienTaiRef.current = d;
    d.drive();
  };

  // Dọn dẹp duy nhất khi BoCucUngDung unmount để việc đổi tab từ explore -> detail không cắt ngang Chặng 2
  useEffect(() => {
    daUnmountRef.current = false;
    return () => {
      daUnmountRef.current = true;
      huyTourHienTai();
    };
  }, []);

  // Tự chạy đúng 1 lần khi mở ứng dụng lần đầu ở màn hình Khám phá
  useEffect(() => {
    if (daTuChayLanDauRef.current || currentTab !== 'explore' || daXemHuongDanLanDau()) {
      return;
    }

    const henGio = setTimeout(() => {
      if (daUnmountRef.current || daTuChayLanDauRef.current || daXemHuongDanLanDau()) return;
      daTuChayLanDauRef.current = true;
      khoiChayChangMot();
    }, 400);

    return () => clearTimeout(henGio);
  }, [currentTab]);

  // Chạy lại theo yêu cầu từ nút Trợ giúp (?) hoặc Trang Cài đặt
  useEffect(() => {
    if (yeuCauChayLai === 0 || yeuCauChayLai === yeuCauDaXuLyRef.current) return;
    if (currentTab !== 'explore') return;

    const henGio = setTimeout(() => {
      if (daUnmountRef.current) return;
      yeuCauDaXuLyRef.current = yeuCauChayLai;
      daTuChayLanDauRef.current = true;
      khoiChayChangMot();
    }, 250);

    return () => clearTimeout(henGio);
  }, [yeuCauChayLai, currentTab]);

  return null;
};
