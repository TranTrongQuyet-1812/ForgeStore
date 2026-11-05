import { Injectable } from '@nestjs/common';
import {
  DauVaoPhanDoan,
  IBoPhanDoanQuyen,
  PhanDoanQuyen,
} from '../interfaces/permission-judge.interface';

/**
 * Bảng trừ điểm cố định cho các quyền Android nhạy cảm (P2-32.1, P2-32.5).
 * Từ P2-70 đây là cách thẩm định quyền duy nhất: mỗi điểm trừ có lý do đọc được và kiểm chứng được.
 */
@Injectable()
export class RulePermissionJudgeService implements IBoPhanDoanQuyen {
  private readonly BANG_DIEM_QUYEN_NHAY_CAM: Record<
    string,
    { tenHienThi: string; diemTru: number; moTa: string }
  > = {
    'android.permission.BIND_ACCESSIBILITY_SERVICE': {
      tenHienThi: 'Dịch vụ trợ năng (Accessibility)',
      diemTru: 15,
      moTa: 'Quyền có thể theo dõi màn hình và thao tác thay người dùng.',
    },
    'android.permission.READ_SMS': {
      tenHienThi: 'Đọc tin nhắn SMS',
      diemTru: 15,
      moTa: 'Quyền có thể đọc mã xác thực OTP và tin nhắn riêng tư.',
    },
    'android.permission.RECEIVE_SMS': {
      tenHienThi: 'Nhận tin nhắn SMS',
      diemTru: 15,
      moTa: 'Quyền có thể chặn hoặc nhận tin nhắn đến.',
    },
    'android.permission.BIND_DEVICE_ADMIN': {
      tenHienThi: 'Quản trị viên thiết bị',
      diemTru: 15,
      moTa: 'Quyền cấp cao có thể khóa máy hoặc xóa dữ liệu.',
    },
    'android.permission.REQUEST_INSTALL_PACKAGES': {
      tenHienThi: 'Cài đặt gói ứng dụng ngoài',
      diemTru: 10,
      moTa: 'Quyền cho phép ứng dụng tự tải và cài file APK khác.',
    },
    'android.permission.SYSTEM_ALERT_WINDOW': {
      tenHienThi: 'Hiển thị đè lên ứng dụng khác',
      diemTru: 10,
      moTa: 'Quyền có thể tạo cửa sổ giả mạo để lừa đảo (overlay attack).',
    },
    'android.permission.READ_CONTACTS': {
      tenHienThi: 'Đọc danh bạ người dùng',
      diemTru: 10,
      moTa: 'Quyền truy cập toàn bộ thông tin liên hệ cá nhân.',
    },
    'android.permission.RECORD_AUDIO': {
      tenHienThi: 'Ghi âm từ microphone',
      diemTru: 10,
      moTa: 'Quyền có thể thu âm âm thanh xung quanh thiết bị.',
    },
    'android.permission.CAMERA': {
      tenHienThi: 'Sử dụng máy ảnh (Camera)',
      diemTru: 10,
      moTa: 'Quyền chụp ảnh và quay video.',
    },
    'android.permission.ACCESS_FINE_LOCATION': {
      tenHienThi: 'Định vị GPS chính xác',
      diemTru: 10,
      moTa: 'Quyền theo dõi tọa độ địa lý chính xác của người dùng.',
    },
  };

  phanDoan(dauVao: DauVaoPhanDoan): PhanDoanQuyen[] {
    const ketQua: PhanDoanQuyen[] = [];

    for (const quyen of dauVao.quyenCanKiemTra) {
      const config = this.BANG_DIEM_QUYEN_NHAY_CAM[quyen];
      if (config) {
        ketQua.push({
          quyen,
          tenHienThi: config.tenHienThi,
          diemTru: config.diemTru,
          nguon: 'LUAT',
          lyDo: `${config.tenHienThi}: ${config.moTa} Trừ ${config.diemTru} điểm.`,
        });
      }
    }

    return ketQua;
  }
}
