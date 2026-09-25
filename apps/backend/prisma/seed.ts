import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AppsService } from '../src/modules/apps/apps.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Danh sách repo nổi bật trên Hero Carousel (P2-07.3).
 */
const FEATURED_REPOS = new Set([
  'rustdesk/rustdesk',
  'videolan/vlc',
  'localsend/localsend',
  'microsoft/PowerToys',
  'TeamNewPipe/NewPipe',
]);

/**
 * Danh sách 22 ứng dụng nguồn mở tiêu biểu phủ đa nền tảng và 8 danh mục (P2-07.1).
 * Đồng bộ trực tiếp từ GitHub qua AppsService.dongBoRepo() - KHÔNG NHẬP TAY (P2-07.2).
 */
const SEED_REPOS = [
  'rustdesk/rustdesk',
  'videolan/vlc',
  'localsend/localsend',
  'keepassxreboot/keepassxc',
  'obsidianmd/obsidian-releases',
  'TeamNewPipe/NewPipe',
  'libretro/RetroArch',
  'microsoft/PowerToys',
  'notepad-plus-plus/notepad-plus-plus',
  'termux/termux-app',
  'flameshot-org/flameshot',
  'ShareX/ShareX',
  'koreader/koreader',
  'cryptomator/cryptomator',
  'syncthing/syncthing-android',
  'bleachbit/bleachbit',
  'dbeaver/dbeaver',
  'audacity/audacity',
  'transmission/transmission',
  'ankidroid/Anki-Android',
  'qbittorrent/qBittorrent',
  'jellyfin/jellyfin-android',
];

async function main() {
  console.info('===========================================================');
  console.info('🚀 KHỞI ĐỘNG SEED DỮ LIỆU SỐNG FORGESTORE (P2-07)');
  console.info('===========================================================');

  // Khởi tạo Standalone ApplicationContext từ NestJS
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const appsService = app.get(AppsService);
  const prisma = app.get(PrismaService);

  // 1. Dọn dẹp các phân tích AI giả cũ không có moHinhTomTat
  const xoaAiGia = await prisma.phanTichAI.deleteMany({
    where: {
      OR: [{ moHinhTomTat: null }, { moHinhTomTat: '' }],
    },
  });
  if (xoaAiGia.count > 0) {
    console.info(`🧹 Đã dọn dẹp ${xoaAiGia.count} bản ghi phân tích AI giả cũ.`);
  }

  let thanhCong = 0;
  let thatBai = 0;

  for (const slug of SEED_REPOS) {
    try {
      console.info(
        `\n⏳ [${thanhCong + thatBai + 1}/${SEED_REPOS.length}] Đang đồng bộ repo sống: [${slug}]...`,
      );
      const [owner, repo] = slug.split('/');
      const appRecord = await appsService.dongBoRepo(owner!, repo!);

      // Cập nhật trạng thái xác minh & nổi bật
      await prisma.ungDung.update({
        where: { maUngDung: appRecord.maUngDung },
        data: {
          daXacMinh: true,
          duocNoiBat: FEATURED_REPOS.has(slug),
        },
      });

      console.info(
        `  ✓ Đồng bộ thành công: [${slug}] (${appRecord.nenTangHoTro} | ${appRecord.danhMucChinh})`,
      );

      // Chạy phân tích AI sống (README Gemini, Trust Score sống, pgvector)
      try {
        console.info(`  🤖 Đang phân tích AI sống cho [${slug}]...`);
        await appsService.phanTichUngDung(appRecord.maUngDung);
        console.info(`  ✓ Phân tích AI sống hoàn tất.`);
      } catch (aiErr: unknown) {
        console.warn(`  ⚠️ Cảnh báo AI cho [${slug}]: ${(aiErr as Error).message}`);
      }

      thanhCong++;
    } catch (err: unknown) {
      thatBai++;
      console.error(`  ❌ Thất bại khi đồng bộ [${slug}]: ${(err as Error).message}`);
    }
  }

  console.info('\n===========================================================');
  console.info(
    `✅ [ForgeStore Seed Hoàn Tất] Thành công: ${thanhCong}/${SEED_REPOS.length} | Lỗi: ${thatBai}`,
  );
  console.info('===========================================================');

  await app.close();
}

main().catch((e) => {
  console.error('❌ Lỗi nghiêm trọng khi chạy seed:', e);
  process.exit(1);
});
