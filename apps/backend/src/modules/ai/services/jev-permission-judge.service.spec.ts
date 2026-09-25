import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JevPermissionJudgeService } from './jev-permission-judge.service';
import { JevClientService } from './jev-client.service';
import { RulePermissionJudgeService } from './rule-permission-judge.service';

describe('JevPermissionJudgeService (P2-32 & Ngữ Cảnh Tính Năng Tóm Tắt)', () => {
  let service: JevPermissionJudgeService;
  let mockJevClient: {
    isEnabled: boolean;
    hoiNoulBatch: ReturnType<typeof vi.fn>;
  };
  let mockFallback: {
    phanDoan: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockJevClient = {
      isEnabled: true,
      hoiNoulBatch: vi.fn(),
    };
    mockFallback = {
      phanDoan: vi.fn(),
    };

    service = new JevPermissionJudgeService(
      mockJevClient as unknown as JevClientService,
      mockFallback as unknown as RulePermissionJudgeService,
    );
  });

  it('Trả về mảng rỗng khi app không có quyền nhạy cảm nào', async () => {
    const res = await service.phanDoan({
      tenApp: 'SimpleCalculator',
      moTaApp: 'Just a calculator',
      topics: ['calculator'],
      quyenCanKiemTra: ['android.permission.INTERNET', 'android.permission.VIBRATE'],
    });

    expect(res).toEqual([]);
    expect(mockJevClient.hoiNoulBatch).not.toHaveBeenCalled();
  });

  it('Gửi tinhNangTomTat vào state gửi tới Jev Noul batch khi có dữ liệu', async () => {
    mockJevClient.hoiNoulBatch.mockResolvedValue({
      SYSTEM_ALERT_WINDOW: 0.92,
    });

    const res = await service.phanDoan({
      tenApp: 'NewPipe',
      moTaApp: 'A libre lightweight streaming frontend for Android.',
      topics: ['youtube', 'video', 'player'],
      quyenCanKiemTra: ['android.permission.SYSTEM_ALERT_WINDOW'],
      tinhNangTomTat: [
        'Popup Player: Cho phép xem video thu nhỏ dạng cửa sổ nổi trên màn hình',
        'Background Player: Nghe nhạc khi tắt màn hình',
      ],
    });

    expect(mockJevClient.hoiNoulBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenApp: 'NewPipe',
        moTaApp: 'A libre lightweight streaming frontend for Android.',
        topics: ['youtube', 'video', 'player'],
        tinhNangTomTat: [
          'Popup Player: Cho phép xem video thu nhỏ dạng cửa sổ nổi trên màn hình',
          'Background Player: Nghe nhạc khi tắt màn hình',
        ],
      }),
      expect.objectContaining({
        SYSTEM_ALERT_WINDOW: expect.any(Object),
      }),
    );

    expect(res).toHaveLength(1);
    expect(res[0].quyen).toBe('android.permission.SYSTEM_ALERT_WINDOW');
    expect(res[0].canThiet).toBe(true);
    expect(res[0].xacSuatNoul).toBe(0.92);
    expect(res[0].diemTru).toBe(0);
    expect(res[0].nguon).toBe('JEV');
  });

  it('Chuyển sang Rule Engine dự phòng khi JevClient bị tắt', async () => {
    mockJevClient.isEnabled = false;
    mockFallback.phanDoan.mockResolvedValue([
      {
        quyen: 'android.permission.RECORD_AUDIO',
        tenHienThi: 'Ghi âm',
        canThiet: true,
        xacSuatNoul: 1.0,
        phanVan: false,
        diemTru: 0,
        nguon: 'DU_PHONG',
        lyDo: 'Khớp danh mục âm thanh',
      },
    ]);

    const res = await service.phanDoan({
      tenApp: 'Obsidian',
      moTaApp: 'Note taking app',
      topics: ['markdown', 'notes'],
      quyenCanKiemTra: ['android.permission.RECORD_AUDIO'],
    });

    expect(mockFallback.phanDoan).toHaveBeenCalled();
    expect(mockJevClient.hoiNoulBatch).not.toHaveBeenCalled();
    expect(res[0].nguon).toBe('DU_PHONG');
  });
});
