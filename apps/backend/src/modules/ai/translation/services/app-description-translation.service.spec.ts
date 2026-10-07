import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppDescriptionTranslationService } from './app-description-translation.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TranslationRotationService } from './translation-rotation.service';
import { CacheService } from '../../../redis/cache.service';

describe('AppDescriptionTranslationService', () => {
  let service: AppDescriptionTranslationService;
  let mockPrisma: PrismaService;
  let mockRotationService: TranslationRotationService;
  let mockCacheService: CacheService;

  beforeEach(() => {
    mockPrisma = {
      ungDung: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaService;

    mockRotationService = {
      dichGomLoJson: vi.fn(),
    } as unknown as TranslationRotationService;

    mockCacheService = {
      xoaTheoPrefix: vi.fn().mockResolvedValue(1),
    } as unknown as CacheService;

    service = new AppDescriptionTranslationService(
      mockPrisma,
      mockRotationService,
      mockCacheService,
    );
  });

  it('tinhMaBamMoTa tạo chuỗi SHA-256 nhất quán', () => {
    const hash1 = service.tinhMaBamMoTa('Open source software');
    const hash2 = service.tinhMaBamMoTa('Open source software');
    const hash3 = service.tinhMaBamMoTa('Different software');

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('trả về 0 khi toàn bộ ứng dụng đều đã có bản dịch moTaVi mới nhất', async () => {
    const text = 'Remote desktop client';
    const hash = service.tinhMaBamMoTa(text);

    vi.mocked(mockPrisma.ungDung.findMany).mockResolvedValue([
      {
        maUngDung: 'app-1',
        tenRepoDayDu: 'rustdesk/rustdesk',
        moTaGocTiengAnh: text,
        moTaVi: 'Ứng dụng điều khiển máy tính từ xa',
        maBamMoTa: hash,
      },
    ] as unknown as ReturnType<typeof mockPrisma.ungDung.findMany>);

    const res = await service.dichMoTaCacApp(false);

    expect(res.tongSoQuet).toBe(1);
    expect(res.soAppCanDich).toBe(0);
    expect(res.dichThanhCong).toBe(0);
    expect(mockRotationService.dichGomLoJson).not.toHaveBeenCalled();
  });

  it('quét và dịch gom lô các app chưa có moTaVi, cập nhật DB và dọn dẹp cache', async () => {
    const apps = [
      {
        maUngDung: 'app-1',
        tenRepoDayDu: 'rustdesk/rustdesk',
        moTaGocTiengAnh: 'Remote desktop client',
        moTaVi: null,
        maBamMoTa: null,
      },
      {
        maUngDung: 'app-2',
        tenRepoDayDu: 'bitwarden/clients',
        moTaGocTiengAnh: 'Password manager',
        moTaVi: null,
        maBamMoTa: null,
      },
    ];

    vi.mocked(mockPrisma.ungDung.findMany).mockResolvedValue(
      apps as unknown as ReturnType<typeof mockPrisma.ungDung.findMany>,
    );

    vi.mocked(mockRotationService.dichGomLoJson).mockResolvedValue({
      thanhCong: true,
      ketQua: {
        'app-1': 'Ứng dụng điều khiển máy tính từ xa',
        'app-2': 'Trình quản lý mật khẩu an toàn',
      },
      thieuIds: [],
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      chiTietLoi: [],
    });

    vi.mocked(mockPrisma.ungDung.update).mockResolvedValue(
      {} as unknown as ReturnType<typeof mockPrisma.ungDung.update>,
    );

    const res = await service.dichMoTaCacApp(false);

    expect(res.tongSoQuet).toBe(2);
    expect(res.soAppCanDich).toBe(2);
    expect(res.dichThanhCong).toBe(2);
    expect(res.dichThatBai).toBe(0);

    expect(mockRotationService.dichGomLoJson).toHaveBeenCalledWith(
      [
        { id: 'app-1', text: 'Remote desktop client' },
        { id: 'app-2', text: 'Password manager' },
      ],
      { batchSize: 25 },
    );

    expect(mockPrisma.ungDung.update).toHaveBeenCalledTimes(2);
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:list:');
  });

  it('quét và dịch lại khi mô tả tiếng Anh thay đổi làm sai lệch hash (maBamMoTa lệch)', async () => {
    const apps = [
      {
        maUngDung: 'app-1',
        tenRepoDayDu: 'rustdesk/rustdesk',
        moTaGocTiengAnh: 'New remote desktop client with web client',
        moTaVi: 'Ứng dụng cũ',
        maBamMoTa: 'hash_cu_khong_khop',
      },
    ];

    vi.mocked(mockPrisma.ungDung.findMany).mockResolvedValue(
      apps as unknown as ReturnType<typeof mockPrisma.ungDung.findMany>,
    );

    vi.mocked(mockRotationService.dichGomLoJson).mockResolvedValue({
      thanhCong: true,
      ketQua: {
        'app-1': 'Ứng dụng điều khiển máy tính từ xa mới',
      },
      thieuIds: [],
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      chiTietLoi: [],
    });

    const res = await service.dichMoTaCacApp(false);

    expect(res.soAppCanDich).toBe(1);
    expect(res.dichThanhCong).toBe(1);
    expect(mockPrisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-1' },
      data: {
        moTaVi: 'Ứng dụng điều khiển máy tính từ xa mới',
        maBamMoTa: service.tinhMaBamMoTa('New remote desktop client with web client'),
      },
    });
  });

  it('khi forceAll = true, ép dịch lại toàn bộ bất kể trạng thái hash hiện tại', async () => {
    const text = 'Remote desktop client';
    const hash = service.tinhMaBamMoTa(text);

    vi.mocked(mockPrisma.ungDung.findMany).mockResolvedValue([
      {
        maUngDung: 'app-1',
        tenRepoDayDu: 'rustdesk/rustdesk',
        moTaGocTiengAnh: text,
        moTaVi: 'Bản dịch cũ',
        maBamMoTa: hash,
      },
    ] as unknown as ReturnType<typeof mockPrisma.ungDung.findMany>);

    vi.mocked(mockRotationService.dichGomLoJson).mockResolvedValue({
      thanhCong: true,
      ketQua: {
        'app-1': 'Bản dịch mới nhất từ Gemini',
      },
      thieuIds: [],
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      chiTietLoi: [],
    });

    const res = await service.dichMoTaCacApp(true);

    expect(res.soAppCanDich).toBe(1);
    expect(res.dichThanhCong).toBe(1);
  });
});
