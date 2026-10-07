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

    const appsCanDich = danhSachApps.filter((app) => {
      const text = app.moTaGocTiengAnh?.trim();
      if (!text) return false;
      if (forceAll) return true;
      if (!app.moTaVi) return true;
      const hashHienTai = this.tinhMaBamMoTa(text);
      return app.maBamMoTa !== hashHienTai;
    });

    if (appsCanDich.length === 0) {
      this.logger.log('Tất cả mô tả ứng dụng đều đã được dịch mới nhất. Không cần dịch thêm.');
      return {
        tongSoQuet: danhSachApps.length,
        soAppCanDich: 0,
        dichThanhCong: 0,
        dichThatBai: 0,
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

    // Xóa cache danh sách và cache chi tiết của các app vừa dịch
    await this.cacheService.xoaTheoPrefix('fs:apps:list:');
    for (const app of appsCanDich) {
      if (ketQuaBatch.ketQua[app.maUngDung]) {
        await this.cacheService.xoaTheoPrefix(`fs:apps:detail:${app.maUngDung}`);
        await this.cacheService.xoaTheoPrefix(`fs:apps:detail:${app.tenRepoDayDu.toLowerCase()}`);
      }
    }

    this.logger.log(
      `Hoàn thành dịch mô tả kho ứng dụng: ${dichThanhCong}/${appsCanDich.length} thành công, ${ketQuaBatch.thieuIds.length} thất bại.`,
    );

    return {
      tongSoQuet: danhSachApps.length,
      soAppCanDich: appsCanDich.length,
      dichThanhCong,
      dichThatBai: ketQuaBatch.thieuIds.length,
      thieuIds: ketQuaBatch.thieuIds,
    };
  }
}
