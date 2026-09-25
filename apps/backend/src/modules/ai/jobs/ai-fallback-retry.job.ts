import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { LlmRotationService } from '../services/llm-rotation.service';

@Injectable()
export class AiFallbackRetryJob {
  private readonly logger = new Logger(AiFallbackRetryJob.name);
  private dangChay = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly llmRotationService: LlmRotationService,
  ) {}

  /**
   * Tác vụ định kỳ mỗi giờ: Quét các app đang mang trạng thái tóm tắt dự phòng (DU_PHONG)
   * và tóm tắt lại khi nhà cung cấp LLM đã mở khóa (P2-39.6).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async chayJobTomTatLai(): Promise<void> {
    if (this.dangChay) {
      this.logger.debug('Job tóm tắt lại đang chạy, bỏ qua lần kích hoạt này.');
      return;
    }

    this.dangChay = true;
    try {
      // 1. Kiểm tra xem có nhà cung cấp nào đã mở khóa chưa
      const geminiKhoa = await this.llmRotationService.kiemTraKhoa('GEMINI');
      const nimKhoa = await this.llmRotationService.kiemTraKhoa('NVIDIA_NIM');

      if (geminiKhoa && nimKhoa) {
        this.logger.debug(
          'Tất cả các nhà cung cấp LLM vẫn đang bị khóa. Tạm hoãn job tóm tắt lại.',
        );
        return;
      }

      // 2. Tìm tối đa 10 ứng dụng đang dùng nội dung dự phòng và chưa vượt quá 3 lần thử
      const danhSachApp = await this.prisma.phanTichAI.findMany({
        where: {
          moHinhTomTat: 'DU_PHONG',
          soLanThuLai: { lt: 3 },
        },
        include: {
          ungDung: true,
        },
        take: 10,
      });

      if (danhSachApp.length === 0) {
        return;
      }

      this.logger.log(
        `Phát hiện ${danhSachApp.length} ứng dụng đang dùng nội dung DU_PHONG (chưa quá 3 lần thử). Bắt đầu tóm tắt lại...`,
      );

      for (const record of danhSachApp) {
        const app = record.ungDung;
        try {
          const [owner, repo] = app.tenRepoDayDu.split('/');
          if (!owner || !repo) continue;

          const rawReadme = await this.githubService.layReadme(owner, repo);
          if (!rawReadme) continue;

          const { ketQua, moHinhTomTat } = await this.llmRotationService.tomTatReadme(
            rawReadme,
            app.tenRepoDayDu,
            app.moTaGocTiengAnh || undefined,
          );

          if (moHinhTomTat !== 'DU_PHONG') {
            await this.prisma.phanTichAI.update({
              where: { maPhanTich: record.maPhanTich },
              data: {
                khauHieuTiengViet: ketQua.khauHieu,
                tomTatTinhNangVi: ketQua.tinhNang.map((t) => `• ${t.tieuDe}: ${t.moTa}`).join('\n'),
                moHinhTomTat,
                soLanThuLai: 0,
                ngayCapNhat: new Date(),
              },
            });

            this.logger.log(
              `✓ Đã nâng cấp tóm tắt cho [${app.tenRepoDayDu}] bằng model [${moHinhTomTat}]`,
            );
          } else {
            // Tăng số lần thử lại nếu vẫn ra DU_PHONG (ví dụ không vượt qua kiểm tra trích dẫn)
            const soLanHienTai = record.soLanThuLai + 1;
            await this.prisma.phanTichAI.update({
              where: { maPhanTich: record.maPhanTich },
              data: {
                soLanThuLai: { increment: 1 },
                ngayCapNhat: new Date(),
              },
            });
            this.logger.warn(
              `⚠️ Tóm tắt lại cho [${app.tenRepoDayDu}] vẫn là DU_PHONG (lần thử ${soLanHienTai}/3).${soLanHienTai >= 3 ? ' Đã đạt giới hạn tối đa, dừng retry.' : ''}`,
            );
          }

          // Giãn cách 2 giây để tránh bão request
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (err: unknown) {
          const soLanHienTai = record.soLanThuLai + 1;
          await this.prisma.phanTichAI
            .update({
              where: { maPhanTich: record.maPhanTich },
              data: {
                soLanThuLai: { increment: 1 },
                ngayCapNhat: new Date(),
              },
            })
            .catch(() => null);

          this.logger.warn(
            `Không thể tóm tắt lại cho [${app.tenRepoDayDu}] (lần thử ${soLanHienTai}/3): ${(err as Error).message}`,
          );
        }
      }
    } finally {
      this.dangChay = false;
    }
  }
}
