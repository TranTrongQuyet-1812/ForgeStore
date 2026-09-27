import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AppsService } from '../src/modules/apps/apps.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { CacheService } from '../src/modules/redis/cache.service';
import { GithubService } from '../src/modules/github/github.service';

const FEATURED_REPOS = new Set([
  'rustdesk/rustdesk',
  'videolan/vlc',
  'localsend/localsend',
  'microsoft/PowerToys',
  'TeamNewPipe/NewPipe',
]);

const RESYNC_REPOS = [
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
  console.info('🔄 ĐỒNG BỘ LẠI 22 ỨNG DỤNG CSDL (N1, N2, V1, V2, V3, L1, AI1)');
  console.info('===========================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const appsService = app.get(AppsService);
  const prisma = app.get(PrismaService);
  const cacheService = app.get(CacheService);
  const githubService = app.get(GithubService);

  let thanhCong = 0;
  let thatBai = 0;

  for (let i = 0; i < RESYNC_REPOS.length; i++) {
    const slug = RESYNC_REPOS[i];
    if (!slug) continue;

    try {
      console.info(`\n⏳ [${i + 1}/${RESYNC_REPOS.length}] Đang đồng bộ: [${slug}]...`);
      const parts = slug.split('/');
      const owner = parts[0] || '';
      const repo = parts[1] || '';
      const appRecord = await appsService.dongBoRepo(owner, repo);
      const repoData = await githubService.layRepo(owner, repo);

      // Cập nhật trạng thái xác minh (L-09, R-07: kiểm tra tiêu chí OSI thật và repo.archived) & nổi bật
      const OSI_LICENSES = [
        'MIT',
        'GPL',
        'GENERAL PUBLIC',
        'AGPL',
        'AFFERO',
        'LGPL',
        'LESSER GENERAL',
        'APACHE',
        'BSD',
        'MPL',
        'MOZILLA PUBLIC',
        'EPL',
        'ECLIPSE PUBLIC',
        'ISC',
        'ZLIB',
        'UNLICENSE',
        'CC0',
      ];
      const hasOsiLicense = appRecord.loaiGiayPhep
        ? OSI_LICENSES.some((lic) => appRecord.loaiGiayPhep!.toUpperCase().includes(lic))
        : false;
      const isVerified = hasOsiLicense && !repoData.archived;

      await prisma.ungDung.update({
        where: { maUngDung: appRecord.maUngDung },
        data: {
          daXacMinh: isVerified,
          duocNoiBat: FEATURED_REPOS.has(slug),
        },
      });

      console.info(
        `  ✓ Cập nhật thành công: [${slug}] -> Nền tảng: ${appRecord.nenTangHoTro} | Danh mục: ${appRecord.danhMucChinh} | Trạng thái: ${appRecord.trangThai}`,
      );

      // Đảm bảo có phân tích AI
      try {
        await appsService.phanTichUngDung(appRecord.maUngDung);
      } catch (aiErr: unknown) {
        console.warn(`  ⚠️ AI phân tích [${slug}]: ${(aiErr as Error).message}`);
      }

      thanhCong++;

      // Giãn cách 2.5s để tuân thủ Token Bucket và GitHub API
      if (i < RESYNC_REPOS.length - 1) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    } catch (err: unknown) {
      thatBai++;
      console.error(`  ❌ Lỗi khi đồng bộ [${slug}]: ${(err as Error).message}`);
    }
  }

  // Xóa toàn bộ Cache Redis của apps và categories
  await cacheService.xoaTheoPrefix('fs:apps:');
  await cacheService.xoaTheoPrefix('fs:categories:');
  await cacheService.xoaTheoPrefix('fs:search:');

  console.info('\n===========================================================');
  console.info(
    `✅ [Đồng Bộ Hoàn Tất] Thành công: ${thanhCong}/${RESYNC_REPOS.length} | Lỗi: ${thatBai}`,
  );
  console.info('===========================================================');

  await app.close();
}

main().catch((e) => {
  console.error('❌ Lỗi nghiêm trọng:', e);
  process.exit(1);
});
