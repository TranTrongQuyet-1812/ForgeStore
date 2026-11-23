import { Injectable } from '@nestjs/common';
import { MucDoUyTin } from '@prisma/client';
import { YeuToRuiRoItem } from '@forgestore/types';

export interface DauVaoTrustScore {
  soSaoGithub: number;
  soLuotFork: number;
  loaiGiayPhep: string | null;
  daArchived: boolean;
  ngayPushCuoi: Date | null;
  soContributor: number;
}

export interface KetQuaTrustScore {
  diemUyTin: number;
  mucDoAnToan: MucDoUyTin;
  yeuToRuiRo: YeuToRuiRoItem[];
}

@Injectable()
export class TrustScoreService {
  /**
   * Tính điểm uy tín hoàn toàn bằng luật (P2-32, D-01 đổi 27/10/2026, P2-70, P3B-44.1).
   * Mức an toàn chỉ suy từ điểm, nên mỗi nhãn đều truy ngược được về các điểm trừ.
   */
  async tinhTrustScore(dauVao: DauVaoTrustScore): Promise<KetQuaTrustScore> {
    let diem = 100;
    const yeuToRuiRo: YeuToRuiRoItem[] = [];

    // ============================================================
    // BỘ LUẬT TÍN HIỆU CỨNG (HÀM THUẦN TYPESCRIPT - P2-32.3, P3B-44.1)
    // ============================================================

    // 1 và 2. Kho bị lưu trữ (-40), lâu không push (-10 hoặc -25)
    for (const yt of yeuToTheoThoiGian(dauVao.daArchived, dauVao.ngayPushCuoi)) {
      diem -= yt.diemTru;
      yeuToRuiRo.push(yt);
    }

    // 3. Không có giấy phép mã nguồn mở (License): -15 điểm
    if (!dauVao.loaiGiayPhep || dauVao.loaiGiayPhep.trim() === '') {
      diem -= 15;
      yeuToRuiRo.push({
        ma: 'NO_LICENSE',
        moTa: 'Kho lưu trữ không khai báo giấy phép mã nguồn mở hợp lệ.',
        diemTru: 15,
        nguon: 'LUAT',
      });
    }

    // 4. Dưới 2 contributor (dự án chỉ có 1 người duy trì): -10 điểm
    if (dauVao.soContributor < 2) {
      diem -= 10;
      yeuToRuiRo.push({
        ma: 'SINGLE_CONTRIBUTOR',
        moTa: 'Dự án chỉ có 1 người đóng góp, nguy cơ bỏ rơi cao hơn.',
        diemTru: 10,
        nguon: 'LUAT',
      });
    }

    // 5. Dưới 50 sao GitHub: -10 điểm
    if (dauVao.soSaoGithub < 50) {
      diem -= 10;
      yeuToRuiRo.push({
        ma: 'LOW_GITHUB_STARS',
        moTa: 'Dự án có dưới 50 sao trên GitHub (độ tín nhiệm cộng đồng chưa cao).',
        diemTru: 10,
        nguon: 'LUAT',
      });
    }

    // Kẹp điểm trong khoảng [0, 100] (P2-32.6)
    const diemFinal = Math.max(0, Math.min(100, diem));

    return {
      diemUyTin: diemFinal,
      mucDoAnToan: xepMucDoAnToan(diemFinal),
      yeuToRuiRo,
    };
  }
}

/** Ngưỡng mức an toàn theo điểm (P2-32.6), dùng chung cho tính mới và tính lại dữ liệu cũ. */
export function xepMucDoAnToan(diem: number): MucDoUyTin {
  if (diem >= 80) return MucDoUyTin.AN_TOAN_CAO;
  if (diem >= 60) return MucDoUyTin.CAN_LUU_Y;
  return MucDoUyTin.CANH_BAO_RUI_RO;
}

const MA_THEO_THOI_GIAN = ['REPO_ARCHIVED', 'NO_PUSH_OVER_12_MONTHS', 'NO_PUSH_OVER_6_MONTHS'];

/** Hai luật đổi theo thời gian: kho bị lưu trữ, và bao lâu chưa push. */
export function yeuToTheoThoiGian(
  daArchived: boolean,
  ngayPushCuoi: Date | null,
  now = Date.now(),
): YeuToRuiRoItem[] {
  const ketQua: YeuToRuiRoItem[] = [];
  if (daArchived) {
    ketQua.push({
      ma: 'REPO_ARCHIVED',
      moTa: 'Kho lưu trữ đã bị lưu trữ (archived), không còn được phát triển.',
      diemTru: 40,
      nguon: 'LUAT',
    });
  }
  if (ngayPushCuoi) {
    const soThangKhongPush = (now - ngayPushCuoi.getTime()) / (30 * 24 * 60 * 60 * 1000);
    if (soThangKhongPush > 12) {
      ketQua.push({
        ma: 'NO_PUSH_OVER_12_MONTHS',
        moTa: 'Dự án không có cập nhật mới trong hơn 12 tháng qua.',
        diemTru: 25,
        nguon: 'LUAT',
      });
    } else if (soThangKhongPush > 6) {
      ketQua.push({
        ma: 'NO_PUSH_OVER_6_MONTHS',
        moTa: 'Dự án không có cập nhật mới trong hơn 6 tháng qua.',
        diemTru: 10,
        nguon: 'LUAT',
      });
    }
  }
  return ketQua;
}

/**
 * Tính lại điểm khi trạng thái lưu trữ hoặc ngày push đổi sau lần phân tích đầu, chỉ từ CSDL (không gọi GitHub).
 * Điểm luôn là 100 trừ tổng điểm trừ của các yếu tố, nên thay các yếu tố theo thời gian rồi cộng lại là đúng.
 * Chưa biết ngày push (null) thì giữ nguyên yếu tố push cũ.
 */
export function tinhLaiDiemTheoThoiGian(
  yeuToCu: YeuToRuiRoItem[],
  daArchived: boolean,
  ngayPushCuoi: Date | null,
  now = Date.now(),
): KetQuaTrustScore {
  const giuLai = yeuToCu.filter(
    (yt) =>
      yt.ma !== 'REPO_ARCHIVED' && (ngayPushCuoi === null || !MA_THEO_THOI_GIAN.includes(yt.ma)),
  );
  const yeuToRuiRo = [...yeuToTheoThoiGian(daArchived, ngayPushCuoi, now), ...giuLai];
  const tongTru = yeuToRuiRo.reduce((tong, yt) => tong + yt.diemTru, 0);
  const diemUyTin = Math.max(0, Math.min(100, 100 - tongTru));
  return { diemUyTin, mucDoAnToan: xepMucDoAnToan(diemUyTin), yeuToRuiRo };
}

/**
 * Bỏ các yếu tố rủi ro quyền Android (mã bắt đầu bằng QUYEN_) và tính lại điểm uy tín,
 * mức an toàn chỉ từ dữ liệu đã có trong CSDL, không gọi GitHub hay AI (P3B-44.1).
 */
export function tinhLaiDiemBoQuyenAndroid(yeuToCu: YeuToRuiRoItem[]): KetQuaTrustScore {
  const yeuToRuiRo = yeuToCu.filter((yt) => !yt.ma.startsWith('QUYEN_'));
  const tongTru = yeuToRuiRo.reduce((tong, yt) => tong + yt.diemTru, 0);
  const diemUyTin = Math.max(0, Math.min(100, 100 - tongTru));
  return { diemUyTin, mucDoAnToan: xepMucDoAnToan(diemUyTin), yeuToRuiRo };
}
