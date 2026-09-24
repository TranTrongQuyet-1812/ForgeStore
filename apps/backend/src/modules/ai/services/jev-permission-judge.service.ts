import { Injectable, Logger } from '@nestjs/common';
import {
  DauVaoPhanDoan,
  IBoPhanDoanQuyen,
  PhanDoanQuyen,
} from '../interfaces/permission-judge.interface';
import { JevClientService } from './jev-client.service';
import { RulePermissionJudgeService } from './rule-permission-judge.service';

@Injectable()
export class JevPermissionJudgeService implements IBoPhanDoanQuyen {
  private readonly logger = new Logger(JevPermissionJudgeService.name);

  // Danh mục quyền nhạy cảm cần phán đoán bằng AI (P2-32.4)
  private readonly DANH_SACH_QUYEN_NHAY_CAM = [
    'android.permission.BIND_ACCESSIBILITY_SERVICE',
    'android.permission.READ_SMS',
    'android.permission.RECEIVE_SMS',
    'android.permission.BIND_DEVICE_ADMIN',
    'android.permission.REQUEST_INSTALL_PACKAGES',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.READ_CONTACTS',
    'android.permission.RECORD_AUDIO',
    'android.permission.CAMERA',
    'android.permission.ACCESS_FINE_LOCATION',
  ];

  constructor(
    private readonly jevClientService: JevClientService,
    private readonly fallbackService: RulePermissionJudgeService,
  ) {}

  async phanDoan(dauVao: DauVaoPhanDoan): Promise<PhanDoanQuyen[]> {
    // 1. Lọc ra những quyền nhạy cảm có mặt trong APK
    const quyenNhayCamCoMat = dauVao.quyenCanKiemTra.filter((q) =>
      this.DANH_SACH_QUYEN_NHAY_CAM.includes(q),
    );

    if (quyenNhayCamCoMat.length === 0) {
      return [];
    }

    // 2. Nếu Jev không khả dụng hoặc bị tắt -> chuyển sang Luật dự phòng (P2-32.5)
    if (!this.jevClientService.isEnabled) {
      return this.fallbackService.phanDoan({
        ...dauVao,
        quyenCanKiemTra: quyenNhayCamCoMat,
      });
    }

    try {
      // 3. Xây dựng batch questions cho Jev Noul
      const state = {
        tenApp: dauVao.tenApp,
        moTaApp: dauVao.moTaApp,
        topics: dauVao.topics,
      };

      const questions: Record<
        string,
        { instruction: string; criteria: { true: string; false: string } }
      > = {};
      for (const quyen of quyenNhayCamCoMat) {
        const shortName = quyen.replace('android.permission.', '');
        questions[shortName] = {
          instruction: `Quyền Android '${quyen}' có thực sự cần thiết và phù hợp với chức năng được mô tả của ứng dụng '${dauVao.tenApp}' hay không?`,
          criteria: {
            true: `Quyền '${shortName}' trực tiếp phục vụ tính năng cốt lõi hoặc đã được giải thích rõ trong mô tả.`,
            false: `Quyền '${shortName}' không liên quan, bất thường hoặc vượt quá phạm vi chức năng của ứng dụng.`,
          },
        };
      }

      const answers = await this.jevClientService.hoiNoulBatch(state, questions);
      const ketQua: PhanDoanQuyen[] = [];

      for (const quyen of quyenNhayCamCoMat) {
        const shortName = quyen.replace('android.permission.', '');
        const noulVal = answers[shortName] ?? 0.5;

        // Xử lý theo ngưỡng (P2-32.4):
        // noul >= 0.8: Cần thiết -> 0 điểm trừ
        // noul <= 0.2: Không cần thiết -> trừ 10 đến 15 điểm
        // Ở giữa: Jev phân vân -> trừ nhẹ 5 điểm, gắn phanVan = true
        let canThiet = false;
        let phanVan = false;
        let diemTru = 0;
        let lyDo = '';

        if (noulVal >= 0.8) {
          canThiet = true;
          diemTru = 0;
          lyDo = `Jev xác nhận quyền '${shortName}' phù hợp với chức năng app (xác suất ${Math.round(noulVal * 100)}%).`;
        } else if (noulVal <= 0.2) {
          canThiet = false;
          diemTru = this.tinhDiemTruNang(quyen);
          lyDo = `Jev cảnh báo quyền '${shortName}' không phù hợp với chức năng app (xác suất ${Math.round(noulVal * 100)}%). Trừ ${diemTru} điểm.`;
        } else {
          canThiet = false;
          phanVan = true;
          diemTru = 5;
          lyDo = `Jev chưa chắc chắn về tính hợp lý của quyền '${shortName}' (xác suất ${Math.round(noulVal * 100)}%). Trừ 5 điểm.`;
        }

        ketQua.push({
          quyen,
          tenHienThi: this.layTenHienThiQuyen(quyen),
          canThiet,
          xacSuatNoul: noulVal,
          phanVan,
          diemTru,
          nguon: 'JEV',
          lyDo,
        });
      }

      return ketQua;
    } catch (err: unknown) {
      this.logger.warn(
        `Gọi Jev phán đoán quyền thất bại (${(err as Error).message}), chuyển sang Luật Dự Phòng.`,
      );
      return this.fallbackService.phanDoan({
        ...dauVao,
        quyenCanKiemTra: quyenNhayCamCoMat,
      });
    }
  }

  private tinhDiemTruNang(quyen: string): number {
    if (
      quyen === 'android.permission.BIND_ACCESSIBILITY_SERVICE' ||
      quyen === 'android.permission.READ_SMS' ||
      quyen === 'android.permission.BIND_DEVICE_ADMIN'
    ) {
      return 15;
    }
    return 10;
  }

  private layTenHienThiQuyen(quyen: string): string {
    const map: Record<string, string> = {
      'android.permission.BIND_ACCESSIBILITY_SERVICE': 'Dịch vụ trợ năng',
      'android.permission.READ_SMS': 'Đọc tin nhắn SMS',
      'android.permission.RECEIVE_SMS': 'Nhận tin nhắn SMS',
      'android.permission.BIND_DEVICE_ADMIN': 'Quản trị thiết bị',
      'android.permission.REQUEST_INSTALL_PACKAGES': 'Cài đặt APK ngoài',
      'android.permission.SYSTEM_ALERT_WINDOW': 'Vẽ đè màn hình',
      'android.permission.READ_CONTACTS': 'Đọc danh bạ',
      'android.permission.RECORD_AUDIO': 'Ghi âm microphone',
      'android.permission.CAMERA': 'Máy ảnh (Camera)',
      'android.permission.ACCESS_FINE_LOCATION': 'Vị trí GPS chính xác',
    };
    return map[quyen] || quyen.replace('android.permission.', '');
  }
}
