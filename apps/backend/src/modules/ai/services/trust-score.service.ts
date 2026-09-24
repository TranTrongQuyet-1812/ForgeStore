import { Injectable, Logger } from '@nestjs/common';
import { MucDoUyTin } from '@prisma/client';
import { YeuToRuiRoItem } from '@forgestore/types';
import { JevPermissionJudgeService } from './jev-permission-judge.service';

export interface DauVaoTrustScore {
  tenApp: string;
  moTaApp: string;
  topics: string[];
  soSaoGithub: number;
  soLuotFork: number;
  loaiGiayPhep: string | null;
  daArchived: boolean;
  ngayPushCuoi: Date | null;
  soContributor: number;
  danhSachQuyenAndroid: string[];
  coAccessibilityService?: boolean;
}

export interface KetQuaTrustScore {
  diemUyTin: number;
  mucDoAnToan: MucDoUyTin;
  yeuToRuiRo: YeuToRuiRoItem[];
  daThamDinhJev: boolean;
}

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(private readonly permissionJudge: JevPermissionJudgeService) {}

  /**
   * Tính toán điểm uy tín lai (Rule Engine + Jev Noul) (P2-32 & D-01).
   */
  async tinhTrustScore(dauVao: DauVaoTrustScore): Promise<KetQuaTrustScore> {
    let diem = 100;
    const yeuToRuiRo: YeuToRuiRoItem[] = [];

    // ============================================================
    // PHẦN 1: BỘ LUẬT TÍN HIỆU CỨNG (HÀM THUẦN TYPESCRIPT - P2-32.3)
    // ============================================================

    // 1. Kho lưu trữ bị Archived: -40 điểm
    if (dauVao.daArchived) {
      diem -= 40;
      yeuToRuiRo.push({
        ma: 'REPO_ARCHIVED',
        moTa: 'Kho lưu trữ đã bị lưu trữ (archived), không còn được phát triển.',
        diemTru: 40,
        nguon: 'LUAT',
      });
    }

    // 2. Thời gian kể từ lần push cuối cùng
    if (dauVao.ngayPushCuoi) {
      const msMoiThang = 30 * 24 * 60 * 60 * 1000;
      const soThangKhongPush = (Date.now() - dauVao.ngayPushCuoi.getTime()) / msMoiThang;

      if (soThangKhongPush > 12) {
        diem -= 25;
        yeuToRuiRo.push({
          ma: 'NO_PUSH_OVER_12_MONTHS',
          moTa: 'Dự án không có cập nhật mới trong hơn 12 tháng qua.',
          diemTru: 25,
          nguon: 'LUAT',
        });
      } else if (soThangKhongPush > 6) {
        diem -= 10;
        yeuToRuiRo.push({
          ma: 'NO_PUSH_OVER_6_MONTHS',
          moTa: 'Dự án không có cập nhật mới trong hơn 6 tháng qua.',
          diemTru: 10,
          nguon: 'LUAT',
        });
      }
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

    // ============================================================
    // PHẦN 2: THẨM ĐỊNH QUYỀN ANDROID BẰNG JEV NOUL (P2-32.4)
    // ============================================================
    let daThamDinhJev = false;
    let coViPhamNghiemTrong = false;

    if (dauVao.danhSachQuyenAndroid && dauVao.danhSachQuyenAndroid.length > 0) {
      const ketQuaPhanDoan = await this.permissionJudge.phanDoan({
        tenApp: dauVao.tenApp,
        moTaApp: dauVao.moTaApp,
        topics: dauVao.topics,
        quyenCanKiemTra: dauVao.danhSachQuyenAndroid,
      });

      for (const pd of ketQuaPhanDoan) {
        if (pd.nguon === 'JEV') {
          daThamDinhJev = true;
        }

        if (pd.diemTru > 0) {
          diem -= pd.diemTru;
          yeuToRuiRo.push({
            ma: `QUYEN_${pd.quyen.replace('android.permission.', '')}`,
            moTa: pd.lyDo,
            diemTru: pd.diemTru,
            nguon: pd.nguon,
            xacSuat: pd.xacSuatNoul,
            phanVan: pd.phanVan,
          });
        }

        // P2-32.7: LUẬT VI PHẠM NGHIÊM TRỌNG
        // Quyền nguy hiểm cao (BIND_ACCESSIBILITY_SERVICE, READ_SMS, BIND_DEVICE_ADMIN)
        // mà bị Jev đánh giá không cần thiết (noul <= 0.2) -> ép xuống CANH_BAO_RUI_RO
        if (
          !pd.canThiet &&
          pd.xacSuatNoul <= 0.2 &&
          (pd.quyen === 'android.permission.BIND_ACCESSIBILITY_SERVICE' ||
            pd.quyen === 'android.permission.READ_SMS' ||
            pd.quyen === 'android.permission.BIND_DEVICE_ADMIN')
        ) {
          coViPhamNghiemTrong = true;
          this.logger.warn(
            `🚨 [Vi phạm nghiêm trọng] App [${dauVao.tenApp}] xin quyền nguy hiểm [${pd.quyen}] không hợp lý! Ép xuống CANH_BAO_RUI_RO.`,
          );
        }
      }
    }

    // Kẹp điểm trong khoảng [0, 100] (P2-32.6)
    const diemFinal = Math.max(0, Math.min(100, diem));

    // Xếp mức uy tín (P2-32.6 & P2-32.7)
    let mucDoAnToan: MucDoUyTin;
    if (coViPhamNghiemTrong) {
      mucDoAnToan = MucDoUyTin.CANH_BAO_RUI_RO;
    } else if (diemFinal >= 80) {
      mucDoAnToan = MucDoUyTin.AN_TOAN_CAO;
    } else if (diemFinal >= 60) {
      mucDoAnToan = MucDoUyTin.CAN_LUU_Y;
    } else {
      mucDoAnToan = MucDoUyTin.CANH_BAO_RUI_RO;
    }

    return {
      diemUyTin: diemFinal,
      mucDoAnToan,
      yeuToRuiRo,
      daThamDinhJev,
    };
  }
}
