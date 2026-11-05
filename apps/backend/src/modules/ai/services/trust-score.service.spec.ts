import { beforeEach, describe, expect, it } from 'vitest';
import { MucDoUyTin } from '@prisma/client';
import { DauVaoTrustScore, TrustScoreService, xepMucDoAnToan } from './trust-score.service';
import { RulePermissionJudgeService } from './rule-permission-judge.service';

describe('TrustScoreService (P2-32: điểm uy tín hoàn toàn bằng luật, P2-70)', () => {
  let service: TrustScoreService;

  const defaultInput: DauVaoTrustScore = {
    soSaoGithub: 50000,
    soLuotFork: 5000,
    loaiGiayPhep: 'AGPL-3.0',
    daArchived: false,
    ngayPushCuoi: new Date(), // Mới push hôm nay
    soContributor: 50,
    danhSachQuyenAndroid: [],
  };

  beforeEach(() => {
    service = new TrustScoreService(new RulePermissionJudgeService());
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

  describe('Phần quyền Android theo bảng điểm cố định (P2-32.4, P2-70)', () => {
    it('Trừ điểm quyền nhạy cảm theo bảng, nguồn LUAT, lý do đọc được', async () => {
      const res = await service.tinhTrustScore({
        ...defaultInput,
        danhSachQuyenAndroid: ['android.permission.CAMERA'],
      });

      expect(res.diemUyTin).toBe(90);
      expect(res.yeuToRuiRo).toEqual([
        {
          ma: 'QUYEN_CAMERA',
          moTa: 'Sử dụng máy ảnh (Camera): Quyền chụp ảnh và quay video. Trừ 10 điểm.',
          diemTru: 10,
          nguon: 'LUAT',
        },
      ]);
    });

    it('Không trừ điểm quyền không có trong bảng nhạy cảm', async () => {
      const res = await service.tinhTrustScore({
        ...defaultInput,
        danhSachQuyenAndroid: ['android.permission.INTERNET', 'android.permission.WAKE_LOCK'],
      });

      expect(res.diemUyTin).toBe(100);
      expect(res.yeuToRuiRo).toHaveLength(0);
    });

    it('Mức an toàn chỉ suy từ điểm: READ_SMS + RECORD_AUDIO + CAMERA còn 65 điểm là CAN_LUU_Y', async () => {
      const res = await service.tinhTrustScore({
        ...defaultInput,
        danhSachQuyenAndroid: [
          'android.permission.READ_SMS',
          'android.permission.RECORD_AUDIO',
          'android.permission.CAMERA',
        ],
      });

      // 100 - 15 - 10 - 10 = 65
      expect(res.diemUyTin).toBe(65);
      expect(res.mucDoAnToan).toBe(MucDoUyTin.CAN_LUU_Y);
      expect(res.yeuToRuiRo.every((r) => r.nguon === 'LUAT')).toBe(true);
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
});
