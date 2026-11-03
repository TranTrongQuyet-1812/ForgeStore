import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../../../redis/cache.service';
import { TranslationRotationService } from './translation-rotation.service';

export interface ThongKeDichMoTa {
  tongSoQuet: number;
  soAppCanDich: number;
  dichThanhCong: number;
  dichThatBai: number;
  soAppChoNgayMai: number;
  thieuIds: string[];
}

@Injectable()
export class AppDescriptionTranslationService {
  private readonly logger = new Logger(AppDescriptionTranslationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly translationRotationService: TranslationRotationService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Tính hash SHA-256 chữ thường của chuỗi mô tả để phát hiện thay đổi (D-17).
   */
  public tinhMaBamMoTa(moTa: string): string {
    return createHash('sha256').update(moTa.trim()).digest('hex');
  }

  /**
   * Quét và dịch gom lô mô tả toàn bộ ứng dụng trong kho (P3B-04.3, P3B-04.4).
   * @param forceAll Nếu true, ép dịch lại toàn bộ kể cả khi đã có moTaVi
   */
  public async dichMoTaCacApp(forceAll = false): Promise<ThongKeDichMoTa> {
    this.logger.log(`Bắt đầu quy trình quét và dịch mô tả ứng dụng (forceAll = ${forceAll})...`);

    const danhSachApps = await this.prisma.ungDung.findMany({
      where: {
        trangThai: 'HOAT_DONG',
        moTaGocTiengAnh: { not: null },
      },
      select: {
        maUngDung: true,
        tenRepoDayDu: true,
        moTaGocTiengAnh: true,
        moTaVi: true,
        maBamMoTa: true,
      },
    });

    const appsCanDichBanDau = danhSachApps.filter((app) => {
      const text = app.moTaGocTiengAnh?.trim();
      if (!text) return false;
      if (forceAll) return true;
      if (!app.moTaVi) return true;
      const hashHienTai = this.tinhMaBamMoTa(text);
      return app.maBamMoTa !== hashHienTai;
    });

    const appsCanDich = await this.locAppDangCho(appsCanDichBanDau);
    const soAppChoNgayMai = appsCanDichBanDau.length - appsCanDich.length;

    if (appsCanDich.length === 0) {
      const thongBao = soAppChoNgayMai
        ? `Còn ${soAppChoNgayMai} mô tả đang chờ sang ngày mai.`
        : 'Tất cả mô tả ứng dụng đều đã được dịch mới nhất. Không cần dịch thêm.';
      this.logger.log(thongBao);
      return {
        tongSoQuet: danhSachApps.length,
        soAppCanDich: 0,
        dichThanhCong: 0,
        dichThatBai: 0,
        soAppChoNgayMai,
        thieuIds: [],
      };
    }

    this.logger.log(
      `Tìm thấy ${appsCanDich.length}/${danhSachApps.length} ứng dụng cần dịch mô tả.`,
    );

    const items = appsCanDich.map((app) => ({
      id: app.maUngDung,
      text: app.moTaGocTiengAnh!.trim(),
    }));

    const ketQuaBatch = await this.translationRotationService.dichGomLoJson(items, {
      batchSize: 25,
      loai: 'mo_ta',
    });

    let dichThanhCong = 0;
    const danhSachCapNhat: Promise<unknown>[] = [];

    for (const app of appsCanDich) {
      const banDich = ketQuaBatch.ketQua[app.maUngDung];
      if (banDich && banDich.trim()) {
        dichThanhCong++;
        const maBam = this.tinhMaBamMoTa(app.moTaGocTiengAnh!);
        danhSachCapNhat.push(
          this.prisma.ungDung.update({
            where: { maUngDung: app.maUngDung },
            data: {
              moTaVi: banDich.trim(),
              maBamMoTa: maBam,
            },
          }),
        );
      }
    }

    await Promise.all(danhSachCapNhat);

    const idsChoNgayMai = ketQuaBatch.choNgayMai ? ketQuaBatch.thieuIds : [];
    if (idsChoNgayMai.length > 0) {
      // Giữ mô tả cũ để giao diện không mất nội dung trong lúc chờ bản dịch mới.
      const idsHangCho = appsCanDich
        .filter((app) => idsChoNgayMai.includes(app.maUngDung))
        .map((app) => `${app.maUngDung}:mo_ta`);
      await this.ghiNhanMoTaChoNgayMai(appsCanDich, idsChoNgayMai, ketQuaBatch.retryAfterSec ?? 0);
      await this.translationRotationService.ghiNhanMucChoNgayMai(idsHangCho);
    }

    // Xóa cache danh sách và cache chi tiết của các app vừa dịch
    await this.cacheService.xoaTheoPrefix('fs:apps:list:');
    for (const app of appsCanDich) {
      if (ketQuaBatch.ketQua[app.maUngDung] || idsChoNgayMai.includes(app.maUngDung)) {
        await this.cacheService.xoaTheoPrefix(`fs:apps:detail:${app.maUngDung}`);
        await this.cacheService.xoaTheoPrefix(`fs:apps:detail:${app.tenRepoDayDu.toLowerCase()}`);
      }
    }

    this.logger.log(
      `Hoàn thành dịch mô tả kho ứng dụng: ${dichThanhCong}/${appsCanDich.length} thành công, ${idsChoNgayMai.length} đang chờ sang ngày mai, ${ketQuaBatch.thieuIds.length - idsChoNgayMai.length} thất bại.`,
    );

    return {
      tongSoQuet: danhSachApps.length,
      soAppCanDich: appsCanDich.length,
      dichThanhCong,
      dichThatBai: ketQuaBatch.thieuIds.length - idsChoNgayMai.length,
      soAppChoNgayMai: soAppChoNgayMai + idsChoNgayMai.length,
      thieuIds: ketQuaBatch.thieuIds.filter((id) => !idsChoNgayMai.includes(id)),
    };
  }

  private async locAppDangCho<
    T extends {
      maUngDung: string;
      moTaGocTiengAnh: string | null;
    },
  >(apps: T[]): Promise<T[]> {
    const ketQua = await Promise.all(
      apps.map(async (app) => ({ app, cho: await this.dangChoMoTa(app) })),
    );
    return ketQua.filter(({ cho }) => !cho).map(({ app }) => app);
  }

  private async dangChoMoTa(app: { maUngDung: string; moTaGocTiengAnh: string | null }) {
    const khoa = `fs:ai:translation:deferred:mo_ta:${app.maUngDung}`;
    const mucCho = await this.cacheService.lay<{ maBam: string; retryAt: number }>(khoa);
    if (!mucCho) return false;
    const maBamHienTai = this.tinhMaBamMoTa(app.moTaGocTiengAnh?.trim() ?? '');
    if (mucCho.maBam === maBamHienTai && mucCho.retryAt > Date.now()) return true;
    await this.cacheService.xoa(khoa);
    return false;
  }

  private async ghiNhanMoTaChoNgayMai(
    apps: Array<{ maUngDung: string; moTaGocTiengAnh: string | null }>,
    idsChoNgayMai: string[],
    retryAfterSec: number,
  ): Promise<void> {
    const ttl = Math.max(60, retryAfterSec + 300);
    const appTheoId = new Map(apps.map((app) => [app.maUngDung, app]));
    await Promise.all(
      idsChoNgayMai.map(async (id) => {
        const app = appTheoId.get(id);
        if (!app?.moTaGocTiengAnh) return;
        await this.cacheService.luu(
          `fs:ai:translation:deferred:mo_ta:${id}`,
          {
            maBam: this.tinhMaBamMoTa(app.moTaGocTiengAnh.trim()),
            retryAt: Date.now() + ttl * 1000,
          },
          ttl,
        );
      }),
    );
  }
}
