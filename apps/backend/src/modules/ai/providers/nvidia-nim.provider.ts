import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  KetQuaChangelog,
  KetQuaChangelogSchema,
  KetQuaTomTat,
  KetQuaTomTatSchema,
} from '../dto/ai-summary.dto';
import { HuongDanCaiDatAiSchema } from '../dto/cli-guide.dto';
import { INhaCungCapTomTat, TenNhaCungCap } from '../interfaces/llm-provider.interface';
import { taoPromptTomTatReadme } from '../prompts/readme-summary.prompt';
import { taoPromptTomTatChangelog } from '../prompts/changelog-summary.prompt';
import { taoPromptHuongDanCaiDat } from '../prompts/cli-guide.prompt';
import { kiemTraTrichDanHopLe, lamSachReadme } from '../utils/readme-cleaner.util';
import { locVaChuanHoaHuongDanCaiDat } from '../utils/cli-guide-extractor.util';
import type { HuongDanCaiDatDto } from '@forgestore/types';

@Injectable()
export class NvidiaNimProvider implements INhaCungCapTomTat {
  private readonly logger = new Logger(NvidiaNimProvider.name);
  public readonly ten: TenNhaCungCap = 'NVIDIA_NIM';
  public readonly tenModel: string;
  private readonly client: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('NVIDIA_API_KEY');
    this.tenModel =
      this.configService.get<string>('NVIDIA_NIM_MODEL') || 'meta/llama-3.1-70b-instruct';

    if (apiKey && apiKey.trim() && !apiKey.startsWith('your_')) {
      try {
        this.client = new OpenAI({
          apiKey: apiKey.trim(),
          baseURL: 'https://integrate.api.nvidia.com/v1',
        });
        this.logger.log(`NvidiaNimProvider khởi tạo thành công với model [${this.tenModel}]`);
      } catch (err) {
        this.logger.error('Lỗi khởi tạo OpenAI client cho NVIDIA NIM:', err);
      }
    } else {
      this.logger.warn(
        'NVIDIA_API_KEY chưa được cấu hình. NvidiaNimProvider sẽ báo lỗi khi được gọi.',
      );
    }
  }

  /**
   * Tóm tắt README bằng NVIDIA NIM (D-15 Fallback).
   */
  async tomTatReadme(readme: string, repoName: string): Promise<KetQuaTomTat> {
    if (!this.client) {
      throw new Error('NVIDIA_API_KEY không khả dụng.');
    }

    const cleanedReadme = lamSachReadme(readme);
    const prompt = taoPromptTomTatReadme(repoName, cleanedReadme);

    let lastError: Error | null = null;
    for (let lanThu = 1; lanThu <= 2; lanThu++) {
      try {
        const rawJson = await this.goiNim(prompt);
        const parsed = JSON.parse(rawJson);
        const validated = KetQuaTomTatSchema.parse(parsed);

        // Code-check không dùng AI: kiểm tra trích dẫn nguyên văn (P2-30.8)
        const tinhNangHopLe = kiemTraTrichDanHopLe(validated.tinhNang, readme);

        if (tinhNangHopLe.length === 0) {
          throw new Error(
            `Không có tính năng nào có trích dẫn khớp với README cho repo [${repoName}]`,
          );
        }

        return {
          khauHieu: validated.khauHieu,
          tinhNang: tinhNangHopLe,
        };
      } catch (err: unknown) {
        lastError = err as Error;
        this.logger.warn(
          `Lần thử ${lanThu} NVIDIA NIM tóm tắt README [${repoName}] thất bại: ${lastError.message}`,
        );
        if (this.laLoiRateLimit(lastError)) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error(`NVIDIA NIM tóm tắt README thất bại cho repo [${repoName}]`);
  }

  /**
   * Tóm tắt Changelog bản phát hành bằng NVIDIA NIM.
   */
  async tomTatChangelog(changelog: string, repoName: string): Promise<KetQuaChangelog> {
    if (!this.client) {
      throw new Error('NVIDIA_API_KEY không khả dụng.');
    }

    const prompt = taoPromptTomTatChangelog(repoName, changelog);
    const rawJson = await this.goiNim(prompt);
    const parsed = JSON.parse(rawJson);
    return KetQuaChangelogSchema.parse(parsed);
  }

  /**
   * Trích xuất hướng dẫn cài đặt qua dòng lệnh (CLI) bằng NVIDIA NIM (D-15 Fallback).
   */
  async trichXuatHuongDanCaiDat(
    installSection: string,
    repoName: string,
    rawReadme: string,
    duongDanReadmeGoc?: string,
  ): Promise<HuongDanCaiDatDto | null> {
    if (!this.client) {
      throw new Error('NVIDIA_API_KEY không khả dụng.');
    }

    const prompt = taoPromptHuongDanCaiDat(repoName, installSection);

    try {
      const rawJson = await this.goiNim(prompt);
      const parsed = JSON.parse(rawJson);
      const validated = HuongDanCaiDatAiSchema.parse(parsed);

      return locVaChuanHoaHuongDanCaiDat(validated, rawReadme, duongDanReadmeGoc);
    } catch (err: unknown) {
      if (this.laLoiRateLimit(err)) {
        throw err;
      }
      this.logger.warn(
        `Lỗi NVIDIA NIM bóc tách hướng dẫn CLI [${repoName}]: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Gọi OpenAI API trỏ tới endpoint NVIDIA NIM.
   */
  private async goiNim(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('Client NVIDIA NIM chưa được cấu hình.');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.tenModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content || !content.trim()) {
        throw new Error('NVIDIA NIM trả về nội dung rỗng.');
      }

      return content.trim();
    } catch (err: unknown) {
      const msg = (err as Error).message || '';
      if (msg.includes('429')) {
        const error = new Error(`NVIDIA NIM chạm giới hạn 429: ${msg}`);
        (error as unknown as { status: number }).status = 429;
        throw error;
      }
      throw err;
    }
  }

  private laLoiRateLimit(err: unknown): boolean {
    const error = err as { status?: number; message?: string };
    return error.status === 429 || Boolean(error.message?.includes('429'));
  }
}
