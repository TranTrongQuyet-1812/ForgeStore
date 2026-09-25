import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MucDoUyTin } from '@prisma/client';
import { DauVaoTrustScore, TrustScoreService } from './trust-score.service';
import { JevPermissionJudgeService } from './jev-permission-judge.service';

describe('TrustScoreService (P2-32: Trust Score Lai TypeScript + Jev API)', () => {
  let service: TrustScoreService;
  let mockJudge: { phanDoan: ReturnType<typeof vi.fn> };

  const defaultInput: DauVaoTrustScore = {
    tenApp: 'RustDesk',
    moTaApp: 'An open source remote desktop client',
    topics: ['remote-desktop', 'rust'],
    soSaoGithub: 50000,
    soLuotFork: 5000,
    loaiGiayPhep: 'AGPL-3.0',
    daArchived: false,
    ngayPushCuoi: new Date(), // Mới push hôm nay
    soContributor: 50,
    danhSachQuyenAndroid: [],
  };

  beforeEach(() => {
    mockJudge = {
      phanDoan: vi.fn().mockResolvedValue([]),
    };
    service = new TrustScoreService(mockJudge as unknown as JevPermissionJudgeService);
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

  describe('Phần Jev Noul & Luật Vi Phạm Nghiêm Trọng (P2-32.4 & P2-32.7)', () => {
    it('Không trừ điểm khi Jev xác nhận quyền cần thiết (noul >= 0.8)', async () => {
      mockJudge.phanDoan.mockResolvedValue([
        {
          quyen: 'android.permission.INTERNET',
          tenHienThi: 'Internet',
          canThiet: true,
          xacSuatNoul: 0.95,
          phanVan: false,
          diemTru: 0,
          nguon: 'JEV',
          lyDo: 'Cần thiết để truyền dữ liệu.',
        },
      ]);

      const res = await service.tinhTrustScore({
        ...defaultInput,
        danhSachQuyenAndroid: ['android.permission.INTERNET'],
        tinhNangTomTat: ['Truyền dữ liệu: Kết nối máy tính từ xa'],
      });

      expect(res.diemUyTin).toBe(100);
      expect(res.daThamDinhJev).toBe(true);
      expect(res.trangThaiThamDinhJev).toBe('DA_THAM_DINH');
      expect(mockJudge.phanDoan).toHaveBeenCalledWith(
        expect.objectContaining({
          tinhNangTomTat: ['Truyền dữ liệu: Kết nối máy tính từ xa'],
        }),
      );
    });

    it('Trừ 5 điểm và gắn cờ phanVan khi Jev phân vân (0.2 < noul < 0.8)', async () => {
      mockJudge.phanDoan.mockResolvedValue([
        {
          quyen: 'android.permission.CAMERA',
          tenHienThi: 'Camera',
          canThiet: false,
          xacSuatNoul: 0.55,
          phanVan: true,
          diemTru: 5,
          nguon: 'JEV',
          lyDo: 'Jev chưa chắc chắn.',
        },
      ]);

      const res = await service.tinhTrustScore({
        ...defaultInput,
        danhSachQuyenAndroid: ['android.permission.CAMERA'],
      });

      expect(res.diemUyTin).toBe(95);
      expect(res.yeuToRuiRo[0].phanVan).toBe(true);
      expect(res.yeuToRuiRo[0].xacSuat).toBe(0.55);
      expect(res.trangThaiThamDinhJev).toBe('DA_THAM_DINH');
    });

    it('LUẬT VI PHẠM NGHIÊM TRỌNG: App đèn pin xin READ_SMS (noul <= 0.2) bị ép thẳng xuống CANH_BAO_RUI_RO (P2-32.7)', async () => {
      mockJudge.phanDoan.mockResolvedValue([
        {
          quyen: 'android.permission.READ_SMS',
          tenHienThi: 'Đọc SMS',
          canThiet: false,
          xacSuatNoul: 0.05,
          phanVan: false,
          diemTru: 15,
          nguon: 'JEV',
          lyDo: 'Quyền SMS không phù hợp với app đèn pin.',
        },
      ]);

      const res = await service.tinhTrustScore({
        ...defaultInput,
        tenApp: 'Torch',
        moTaApp: 'A flashlight app',
        danhSachQuyenAndroid: ['android.permission.READ_SMS'],
      });

      // Điểm: 100 - 15 = 85 (lẽ ra là AN_TOAN_CAO nếu chỉ xét điểm)
      expect(res.diemUyTin).toBe(85);
      // Nhưng vi phạm nghiêm trọng ép thẳng xuống CANH_BAO_RUI_RO!
      expect(res.mucDoAnToan).toBe(MucDoUyTin.CANH_BAO_RUI_RO);
      expect(res.trangThaiThamDinhJev).toBe('DA_THAM_DINH');
    });

    it('Dự phòng: Khi Jev offline, hệ thống vẫn tính điểm với nguồn DU_PHONG và trangThaiThamDinhJev: CHUA_THAM_DINH', async () => {
      mockJudge.phanDoan.mockResolvedValue([
        {
          quyen: 'android.permission.CAMERA',
          tenHienThi: 'Camera',
          canThiet: false,
          xacSuatNoul: 0.5,
          phanVan: false,
          diemTru: 10,
          nguon: 'DU_PHONG',
          lyDo: '[Dự phòng] Trừ 10 điểm.',
        },
      ]);

      const res = await service.tinhTrustScore({
        ...defaultInput,
        danhSachQuyenAndroid: ['android.permission.CAMERA'],
      });

      expect(res.diemUyTin).toBe(90);
      expect(res.daThamDinhJev).toBe(false);
      expect(res.trangThaiThamDinhJev).toBe('CHUA_THAM_DINH');
      expect(res.yeuToRuiRo[0].nguon).toBe('DU_PHONG');
    });

    it('Tách bạch trạng thái Jev: App không có quyền (VD: 14 app Windows) có trangThaiThamDinhJev: KHONG_CAN_THIET', async () => {
      const res = await service.tinhTrustScore({
        ...defaultInput,
        danhSachQuyenAndroid: [],
      });

      expect(res.daThamDinhJev).toBe(false);
      expect(res.trangThaiThamDinhJev).toBe('KHONG_CAN_THIET');
    });

    it('Tách bạch trạng thái Jev: App Android không có quyền nhạy cảm có trangThaiThamDinhJev: KHONG_CAN_THIET', async () => {
      mockJudge.phanDoan.mockResolvedValue([]); // Không có quyền nhạy cảm cần hỏi Jev

      const res = await service.tinhTrustScore({
        ...defaultInput,
        danhSachQuyenAndroid: ['android.permission.ACCESS_NETWORK_STATE'],
      });

      expect(res.daThamDinhJev).toBe(false);
      expect(res.trangThaiThamDinhJev).toBe('KHONG_CAN_THIET');
    });
  });
});
