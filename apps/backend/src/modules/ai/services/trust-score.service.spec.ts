import { beforeEach, describe, expect, it } from 'vitest';
import { MucDoUyTin } from '@prisma/client';
import {
  DauVaoTrustScore,
  TrustScoreService,
  tinhLaiDiemBoQuyenAndroid,
  tinhLaiDiemTheoThoiGian,
  xepMucDoAnToan,
} from './trust-score.service';

describe('TrustScoreService (P2-32: điểm uy tín hoàn toàn bằng luật, P2-70, P3B-44.1)', () => {
  let service: TrustScoreService;

  const defaultInput: DauVaoTrustScore = {
    soSaoGithub: 50000,
    soLuotFork: 5000,
    loaiGiayPhep: 'AGPL-3.0',
    daArchived: false,
    ngayPushCuoi: new Date(), // Mới push hôm nay
    soContributor: 50,
  };

  beforeEach(() => {
    service = new TrustScoreService();
  });

  describe('Phần Luật (Tín hiệu cứng - P2-32.3)', () => {
    it('App hoàn hảo đạt 100 điểm và AN_TOAN_CAO', async () => {
      const res = await service.tinhTrustScore(defaultInput);
      expect(res.diemUyTin).toBe(100);
      expect(res.mucDoAnToan).toBe(MucDoUyTin.AN_TOAN_CAO);
      expect(res.yeuToRuiRo).toHaveLength(0);
    });

    it('Trừ 40 điểm khi repo bị archived', async () => {
      const res = await service.tinhTrustScore({
        ...defaultInput,
        daArchived: true,
      });
      expect(res.diemUyTin).toBe(60);
      expect(res.mucDoAnToan).toBe(MucDoUyTin.CAN_LUU_Y);
      expect(res.yeuToRuiRo).toEqual(
        expect.arrayContaining([expect.objectContaining({ ma: 'REPO_ARCHIVED', diemTru: 40 })]),
      );
    });

    it('Trừ 25 điểm khi repo không push trong hơn 12 tháng', async () => {
      const pastDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // 400 ngày trước
      const res = await service.tinhTrustScore({
        ...defaultInput,
        ngayPushCuoi: pastDate,
      });
      expect(res.diemUyTin).toBe(75);
      expect(res.mucDoAnToan).toBe(MucDoUyTin.CAN_LUU_Y);
      expect(res.yeuToRuiRo[0].ma).toBe('NO_PUSH_OVER_12_MONTHS');
    });

    it('Trừ điểm kết hợp: không license (-15), dưới 2 contributor (-10), dưới 50 sao (-10)', async () => {
      const res = await service.tinhTrustScore({
        ...defaultInput,
        loaiGiayPhep: null,
        soContributor: 1,
        soSaoGithub: 20,
      });
      // 100 - 15 - 10 - 10 = 65 điểm
      expect(res.diemUyTin).toBe(65);
      expect(res.mucDoAnToan).toBe(MucDoUyTin.CAN_LUU_Y);
      expect(res.yeuToRuiRo).toHaveLength(3);
    });

    it('Kẹp điểm âm về đúng 0', async () => {
      const pastDate = new Date(Date.now() - 500 * 24 * 60 * 60 * 1000);
      const res = await service.tinhTrustScore({
        ...defaultInput,
        daArchived: true, // -40
        ngayPushCuoi: pastDate, // -25
        loaiGiayPhep: null, // -15
        soContributor: 1, // -10
        soSaoGithub: 5, // -10
        // Tổng trừ: 100
      });
      expect(res.diemUyTin).toBe(0);
      expect(res.mucDoAnToan).toBe(MucDoUyTin.CANH_BAO_RUI_RO);
    });
  });

  describe('Bỏ luật trừ điểm theo quyền Android (P3B-44.1)', () => {
    it('DauVaoTrustScore không nhận quyền Android; app trước đây chỉ bị trừ quyền (như LocalSend) nay đạt 100 điểm và AN_TOAN_CAO', async () => {
      const res = await service.tinhTrustScore(defaultInput);
      expect(res.diemUyTin).toBe(100);
      expect(res.mucDoAnToan).toBe(MucDoUyTin.AN_TOAN_CAO);
      expect(res.yeuToRuiRo).toEqual([]);
    });

    it('tinhLaiDiemBoQuyenAndroid: gỡ hết phần tử QUYEN_* và trả về 100 khi không còn yếu tố rủi ro khác', () => {
      const kq = tinhLaiDiemBoQuyenAndroid([
        {
          ma: 'QUYEN_REQUEST_INSTALL_PACKAGES',
          moTa: 'Cài đặt gói ứng dụng ngoài: Quyền cho phép ứng dụng tải và cài tệp APK khác. Trừ 10 điểm.',
          diemTru: 10,
          nguon: 'LUAT',
        },
      ]);

      expect(kq.diemUyTin).toBe(100);
      expect(kq.mucDoAnToan).toBe(MucDoUyTin.AN_TOAN_CAO);
      expect(kq.yeuToRuiRo).toEqual([]);
    });

    it('tinhLaiDiemBoQuyenAndroid: giữ nguyên các yếu tố không phải QUYEN_* và tính lại mức an toàn đúng ngưỡng', () => {
      const kq = tinhLaiDiemBoQuyenAndroid([
        {
          ma: 'SINGLE_CONTRIBUTOR',
          moTa: 'Dự án chỉ có 1 người đóng góp, nguy cơ bỏ rơi cao hơn.',
          diemTru: 10,
          nguon: 'LUAT',
        },
        {
          ma: 'NO_PUSH_OVER_6_MONTHS',
          moTa: 'Dự án không có cập nhật mới trong hơn 6 tháng qua.',
          diemTru: 10,
          nguon: 'LUAT',
        },
        {
          ma: 'QUYEN_CAMERA',
          moTa: 'Sử dụng máy ảnh (Camera). Trừ 10 điểm.',
          diemTru: 10,
          nguon: 'LUAT',
        },
        {
          ma: 'QUYEN_RECORD_AUDIO',
          moTa: 'Ghi âm (Microphone). Trừ 10 điểm.',
          diemTru: 10,
          nguon: 'LUAT',
        },
      ]);

      // Trước đây: 100 - 40 = 60 (CAN_LUU_Y); sau khi bỏ 2 quyền Android: 100 - 20 = 80 (AN_TOAN_CAO)
      expect(kq.diemUyTin).toBe(80);
      expect(kq.mucDoAnToan).toBe(MucDoUyTin.AN_TOAN_CAO);
      expect(kq.yeuToRuiRo.map((y) => y.ma)).toEqual([
        'SINGLE_CONTRIBUTOR',
        'NO_PUSH_OVER_6_MONTHS',
      ]);
    });
  });

  describe('xepMucDoAnToan (ngưỡng 80/60, P2-32.6)', () => {
    it('Đúng ở các mốc biên', () => {
      expect(xepMucDoAnToan(100)).toBe(MucDoUyTin.AN_TOAN_CAO);
      expect(xepMucDoAnToan(80)).toBe(MucDoUyTin.AN_TOAN_CAO);
      expect(xepMucDoAnToan(79)).toBe(MucDoUyTin.CAN_LUU_Y);
      expect(xepMucDoAnToan(60)).toBe(MucDoUyTin.CAN_LUU_Y);
      expect(xepMucDoAnToan(59)).toBe(MucDoUyTin.CANH_BAO_RUI_RO);
      expect(xepMucDoAnToan(0)).toBe(MucDoUyTin.CANH_BAO_RUI_RO);
    });
  });

  describe('tinhLaiDiemTheoThoiGian (job đêm, không gọi GitHub)', () => {
    const NGAY = 24 * 60 * 60 * 1000;
    const now = Date.UTC(2026, 10, 6);
    const motNguoi = { ma: 'SINGLE_CONTRIBUTOR', moTa: 'x', diemTru: 10, nguon: 'LUAT' as const };

    it('repo bị lưu trữ sau lần phân tích: trừ thêm 40 và giữ yếu tố khác', () => {
      const kq = tinhLaiDiemTheoThoiGian([motNguoi], true, null, now);
      expect(kq.diemUyTin).toBe(50);
      expect(kq.mucDoAnToan).toBe(MucDoUyTin.CANH_BAO_RUI_RO);
      expect(kq.yeuToRuiRo.map((y) => y.ma).sort()).toEqual([
        'REPO_ARCHIVED',
        'SINGLE_CONTRIBUTOR',
      ]);
    });

    it('hết lưu trữ và mới push lại: gỡ yếu tố cũ, điểm hồi về', () => {
      const cu = [
        motNguoi,
        { ma: 'REPO_ARCHIVED', moTa: 'x', diemTru: 40, nguon: 'LUAT' as const },
        { ma: 'NO_PUSH_OVER_12_MONTHS', moTa: 'x', diemTru: 25, nguon: 'LUAT' as const },
      ];
      const kq = tinhLaiDiemTheoThoiGian(cu, false, new Date(now - 10 * NGAY), now);
      expect(kq.diemUyTin).toBe(90);
      expect(kq.yeuToRuiRo.map((y) => y.ma)).toEqual(['SINGLE_CONTRIBUTOR']);
    });

    it('chưa biết ngày push thì giữ yếu tố push cũ', () => {
      const cu = [{ ma: 'NO_PUSH_OVER_6_MONTHS', moTa: 'x', diemTru: 10, nguon: 'LUAT' as const }];
      expect(tinhLaiDiemTheoThoiGian(cu, false, null, now).diemUyTin).toBe(90);
    });

    it('lâu không push sau lần phân tích: trừ 25', () => {
      const kq = tinhLaiDiemTheoThoiGian([], false, new Date(now - 400 * NGAY), now);
      expect(kq.diemUyTin).toBe(75);
    });
  });
});
