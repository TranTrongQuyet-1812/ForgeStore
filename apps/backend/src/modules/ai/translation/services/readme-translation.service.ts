import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { GithubService } from '../../../github/github.service';
import { CacheService } from '../../../redis/cache.service';
import { TranslationRotationService } from './translation-rotation.service';
import { sanitizeLogMessage } from '../tien-ich/log-sanitizer.util';
import { MarkdownMasker } from '../tien-ich/markdown-masker.util';
import { StructureValidator } from '../tien-ich/structure-validator.util';
import {
  goKhungGiuNguyen,
  kiemBatBienReadme,
  layLoiBatBienReadme,
  phanTichReadme,
  rapLaiReadme,
} from '../tien-ich/readme-markdown-processor.util';
import { ChiTietReadmeResponseDto, TrangThaiDichReadme } from '@forgestore/types';

@Injectable()
export class ReadmeTranslationService {
  private readonly logger = new Logger(ReadmeTranslationService.name);
  private readonly dangDichSet = new Set<string>();
  // Giới hạn fallback để một README lỗi gom lô không tiêu thụ quá nhiều yêu cầu dịch lẻ.
  private readonly SO_LAN_DICH_LE_TOI_DA_MOI_README = 5;
  // README chạm trần nhiều lần trong ngày thường có đoạn không bao giờ qua kiểm cấu trúc; hoãn sang hôm sau để không đốt hũ Gemini.
  private readonly SO_LAN_CHAM_TRAN_TOI_DA_MOI_NGAY = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly translationRotationService: TranslationRotationService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Tính mã băm SHA-256 cho chuỗi văn bản.
   */
  public tinhMaBam(text: string): string {
    return createHash('sha256')
      .update(String(text ?? '').trim())
      .digest('hex');
  }

  /**
   * Bóc tách nội dung README thành các phân đoạn theo heading ## (P3B-05.1).
   * Giữ nguyên cấu trúc Markdown, mỗi đoạn chứa tiêu đề phân đoạn và nội dung đi kèm.
   * LƯU Ý (Lỗi 1): Theo dõi cờ inCodeBlock để không bao giờ cắt dòng ## hoặc ### nằm bên trong khối code.
   * Đồng thời chia nhỏ các đoạn > maxChunkLength (mặc định 2500, tối đa 5000 ký tự) theo ### hoặc \n\n ngoài khối code.
   */
  public phanDoanReadme(markdown: string, maxChunkLength = 2500): string[] {
    if (!markdown || !markdown.trim()) return [];

    const lines = markdown.split('\n');
    const doanList: string[] = [];
    let buffer: string[] = [];
    let inCodeBlock = false;

    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        inCodeBlock = !inCodeBlock;
      }

      // Chỉ cắt theo heading ## (cấp 2) khi KHÔNG nằm trong khối code
      if (!inCodeBlock && /^##\s+/.test(line)) {
        if (buffer.length > 0) {
          const doan = buffer.join('\n').trim();
          if (doan) doanList.push(doan);
          buffer = [];
        }
      }
      buffer.push(line);
    }

    if (buffer.length > 0) {
      const doan = buffer.join('\n').trim();
      if (doan) doanList.push(doan);
    }

    // 2. Với các phân đoạn có độ dài sau khi che > maxChunkLength, chia tiếp theo ### hoặc ngắt đoạn kép \n\n
    const ketQua: string[] = [];
    for (const doan of doanList) {
      // Claude Lỗi Đỏ 2: Đo độ dài sau khi che code block (khối code dài > 5k ký tự sau khi che chỉ còn 6 ký tự)
      if (this.tinhDoDaiSauChe(doan) <= maxChunkLength) {
        ketQua.push(doan);
      } else {
        const subLines = doan.split('\n');
        let subBuffer: string[] = [];
        let subInCodeBlock = false;
        const subDoanList: string[] = [];

        for (const sLine of subLines) {
          if (/^\s*```/.test(sLine)) {
            subInCodeBlock = !subInCodeBlock;
          }
          // Chỉ cắt theo heading ### khi KHÔNG nằm trong khối code
          if (!subInCodeBlock && /^###\s+/.test(sLine) && subBuffer.length > 0) {
            const sub = subBuffer.join('\n').trim();
            if (sub) subDoanList.push(sub);
            subBuffer = [];
          }
          subBuffer.push(sLine);
        }
        if (subBuffer.length > 0) {
          const sub = subBuffer.join('\n').trim();
          if (sub) subDoanList.push(sub);
        }

        // Kiểm tra tiếp: nếu vẫn có đoạn sau khi che > 4500 ký tự, chia tiếp theo \n\n ngoài khối code
        for (const subDoan of subDoanList) {
          if (this.tinhDoDaiSauChe(subDoan) <= 4500) {
            ketQua.push(subDoan);
          } else {
            const pLines = subDoan.split('\n');
            let pBuffer: string[] = [];
            let pInCodeBlock = false;
            let currentLen = 0;

            for (const pLine of pLines) {
              if (/^\s*```/.test(pLine)) {
                pInCodeBlock = !pInCodeBlock;
              }
              // Ngắt theo dòng trống khi vượt ngưỡng 2500 và ngoài code block
              if (!pInCodeBlock && pLine.trim() === '' && currentLen >= 2500) {
                const chunk = pBuffer.join('\n').trim();
                if (chunk) {
                  ketQua.push(...this.chiaNhoDoanAnToanCodeBlock(chunk, 4500));
                }
                pBuffer = [];
                currentLen = 0;
              } else {
                pBuffer.push(pLine);
                currentLen += pLine.length + 1;
              }
            }

            if (pBuffer.length > 0) {
              const chunk = pBuffer.join('\n').trim();
              if (chunk) {
                ketQua.push(...this.chiaNhoDoanAnToanCodeBlock(chunk, 4500));
              }
            }
          }
        }
      }
    }

    // 3. Bảo hiểm lần cuối: đảm bảo không phân đoạn nào có độ dài sau khi che vượt quá 4500 ký tự
    const ketQuaCuoi: string[] = [];
    for (const d of ketQua) {
      const trimmed = d.trim();
      if (!trimmed) continue;
      if (this.tinhDoDaiSauChe(trimmed) > 4500) {
        ketQuaCuoi.push(...this.chiaNhoDoanAnToanCodeBlock(trimmed, 4500));
      } else {
        ketQuaCuoi.push(trimmed);
      }
    }

    return ketQuaCuoi.filter((d) => d.trim().length > 0);
  }

  /**
   * Tính độ dài của văn bản sau khi đã che khối code và các thành phần kỹ thuật (Lỗi 2 Claude).
   */
  public tinhDoDaiSauChe(text: string): number {
    return MarkdownMasker.mask(text).maskedText.length;
  }

  /**
   * Chia nhỏ phân đoạn văn bản mà TUYỆT ĐỐI không cắt bên trong khối code fence ``` (Fix Lỗi 2 Claude).
   * Khối code dù dài > 5.000 ký tự vẫn được giữ nguyên vẹn vì sau khi che chỉ còn 6 ký tự (⟦C1⟧).
   */
  public chiaNhoDoanAnToanCodeBlock(doan: string, maxLen = 4500): string[] {
    const trimmed = doan.trim();
    if (!trimmed) return [];

    // Nếu sau khi che độ dài <= maxLen, giữ nguyên vẹn 100%
    if (this.tinhDoDaiSauChe(trimmed) <= maxLen) {
      return [trimmed];
    }

    // Nếu không chứa khối code, chia nhỏ văn xuôi an toàn
    if (!/```/.test(trimmed)) {
      return this.chiaNhoVanXuoiDai(trimmed, maxLen);
    }

    // Tách văn xuôi và khối code theo dòng để bảo toàn trọn vẹn khối code
    const lines = trimmed.split('\n');
    const result: string[] = [];
    let currentLines: string[] = [];
    let inCode = false;

    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        inCode = !inCode;
        currentLines.push(line);
        // Khi vừa đóng khối code
        if (!inCode) {
          const blockText = currentLines.join('\n').trim();
          if (this.tinhDoDaiSauChe(blockText) >= 2500) {
            result.push(blockText);
            currentLines = [];
          }
        }
        continue;
      }

      if (inCode) {
        // Đang trong khối code: gom nguyên vẹn, không cắt
        currentLines.push(line);
      } else {
        // Ngoài khối code: ngắt theo dòng trống nếu buffer đã lớn
        if (line.trim() === '' && currentLines.length > 0) {
          const currentText = currentLines.join('\n').trim();
          if (this.tinhDoDaiSauChe(currentText) >= 2000) {
            result.push(currentText);
            currentLines = [];
            continue;
          }
        }
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      const rest = currentLines.join('\n').trim();
      if (rest) result.push(rest);
    }

    // Lọc lại: phần nào không chứa code mà dài > maxLen thì chia tiếp bằng chiaNhoVanXuoiDai
    const finalResult: string[] = [];
    for (const r of result) {
      if (!/```/.test(r) && r.length > maxLen) {
        finalResult.push(...this.chiaNhoVanXuoiDai(r, maxLen));
      } else {
        finalResult.push(r);
      }
    }

    return finalResult;
  }

  /**
   * Chia nhỏ đoạn văn xuôi dài không có dòng trống đảm bảo không bao giờ vượt quá maxLen (4500 ký tự).
   * Ưu tiên ngắt theo câu (. ! ?), ngắt dòng đơn (\n), hoặc khoảng trắng từ (Fix Lỗi 2).
   */
  public chiaNhoVanXuoiDai(text: string, maxLen = 4500): string[] {
    if (!text || text.length <= maxLen) return text ? [text] : [];
    const chunks: string[] = [];
    let conLai = text;

    while (conLai.length > maxLen) {
      const vungCat = conLai.slice(0, maxLen);
      let diemCat = -1;

      // 1. Thử tìm ngắt câu (dấu chấm câu . ! ? theo sau là khoảng trắng hoặc xuống dòng)
      const regexCau = /.*[.!?](\s+|\n)/s;
      const matchCau = vungCat.match(regexCau);
      if (matchCau && matchCau[0].length >= 1000) {
        diemCat = matchCau[0].length;
      } else {
        // 2. Thử tìm ngắt dòng đơn \n
        const matchXuongDong = vungCat.lastIndexOf('\n');
        if (matchXuongDong >= 1000) {
          diemCat = matchXuongDong + 1;
        } else {
          // 3. Thử tìm dấu phẩy / chấm phẩy
          const matchDauPhay = vungCat.lastIndexOf(', ');
          if (matchDauPhay >= 1000) {
            diemCat = matchDauPhay + 2;
          } else {
            // 4. Thử tìm khoảng trắng (ngắt từ)
            const matchKhoangTrang = vungCat.lastIndexOf(' ');
            if (matchKhoangTrang >= 500) {
              diemCat = matchKhoangTrang + 1;
            } else {
              // 5. Chuỗi liền hoàn toàn (không khoảng trắng), cắt cứng tại maxLen
              diemCat = maxLen;
            }
          }
        }
      }

      // Bảo vệ chống cắt đứt UTF-16 surrogate pair (emoji / astral characters) (SEC-03)
      if (diemCat > 0 && diemCat < conLai.length) {
        const charCode = conLai.charCodeAt(diemCat - 1);
        if (charCode >= 0xd800 && charCode <= 0xdbff) {
          diemCat--;
        }
      }

      const phanCat = conLai.slice(0, diemCat).trim();
      if (phanCat) chunks.push(phanCat);
      conLai = conLai.slice(diemCat).trim();
    }

    if (conLai.length > 0) {
      chunks.push(conLai);
    }
    return chunks;
  }

  /**
   * Yêu cầu dịch lại README khi gặp lỗi thất bại (nút "Dịch lại" - P3B-05.7).
   * Chạy qua endpoint POST chuyên biệt với rate-limit riêng (Fix Claude DELIV-77.7).
   */
  public async yeuCauDichLaiReadme(idOrSlug: string): Promise<ChiTietReadmeResponseDto> {
    return this.layHoacKichHoatDichReadme(idOrSlug, true);
  }

  /**
   * Lấy chi tiết README của một ứng dụng (bản gốc + bản dịch nếu có).
   * Nếu chưa dịch: Kích hoạt tác vụ dịch nền (non-blocking) và trả về bản gốc ngay lập tức (P3B-05.7).
   * Hỗ trợ cờ force = true cho nút "Dịch lại" vượt qua cooldown 15 phút (Fix Lỗi 1).
   */
  public async layHoacKichHoatDichReadme(
    idOrSlug: string,
    force = false,
  ): Promise<ChiTietReadmeResponseDto> {
    // Lỗi 8: Bọc decodeURIComponent chống ném lỗi 500 khi gặp URL malformed
    let cleanId = idOrSlug.trim();
    try {
      cleanId = decodeURIComponent(cleanId);
    } catch {
      // Giữ nguyên chuỗi cleanId gốc nếu decodeURIComponent thất bại
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    const app = await this.prisma.ungDung.findFirst({
      where: isUuid
        ? { maUngDung: cleanId }
        : { tenRepoDayDu: { equals: cleanId, mode: 'insensitive' } },
      select: {
        maUngDung: true,
        tenRepoDayDu: true,
        chuSoHuu: true,
        tenKhoChua: true,
        readmeSha: true,
      },
    });

    if (!app) {
      throw new NotFoundException(`Không tìm thấy ứng dụng với định danh: ${cleanId}`);
    }

    // 1. Lấy nội dung README gốc từ Cache hoặc GitHub Facade (Lỗi 4: chống spam 60 req/h GitHub)
    const cacheKey = `fs:github:readme:${app.chuSoHuu.toLowerCase()}:${app.tenKhoChua.toLowerCase()}`;
    let banGoc = await this.cacheService.lay<string>(cacheKey);
    if (banGoc === null) {
      banGoc = (await this.githubService.layReadme(app.chuSoHuu, app.tenKhoChua)) || '';
      await this.cacheService.luu(cacheKey, banGoc, 1800); // Cache 30 phút
    }
    const hashGoc = this.tinhMaBam(banGoc);

    // 2. Tìm bản dịch trong bảng ban_dich_readme (Bảng 12)
    const banDichDb = await this.prisma.banDichReadme.findUnique({
      where: {
        maUngDung_ngonNgu: {
          maUngDung: app.maUngDung,
          ngonNgu: 'vi',
        },
      },
    });

    const khoaChoNgayMai = `fs:ai:translation:deferred:${app.maUngDung}`;
    const mucCho = await this.cacheService.lay<{ readmeSha: string; retryAt: number }>(
      khoaChoNgayMai,
    );
    if (mucCho?.readmeSha === hashGoc && mucCho.retryAt > Date.now()) {
      return {
        maUngDung: app.maUngDung,
        tenRepoDayDu: app.tenRepoDayDu,
        banGoc,
        banDich: null,
        trangThai: TrangThaiDichReadme.DANG_DICH,
        moHinhDich: banDichDb?.moHinhDich || null,
        readmeSha: hashGoc,
        choNgayMai: true,
      };
    }
    if (mucCho && mucCho.retryAt <= Date.now()) await this.cacheService.xoa(khoaChoNgayMai);

    // 1. Nếu đã dịch xong và hash khớp với nội dung gốc (bỏ qua cờ force vì bản dịch đã hoàn tất và mới nhất)
    if (
      banDichDb &&
      banDichDb.trangThai === TrangThaiDichReadme.HOAN_TAT &&
      banDichDb.readmeSha === hashGoc
    ) {
      return {
        maUngDung: app.maUngDung,
        tenRepoDayDu: app.tenRepoDayDu,
        banGoc,
        banDich: banDichDb.noiDungDich,
        trangThai: TrangThaiDichReadme.HOAN_TAT,
        moHinhDich: banDichDb.moHinhDich,
        readmeSha: banDichDb.readmeSha,
      };
    }

    // 2. FS-SEC-02 & Lỗi 4: Kiểm tra trạng thái DANG_DICH (bỏ qua cờ force để giữ chốt chặn chạy trùng in-flight)
    const isDangDichInMemory = this.dangDichSet.has(app.maUngDung);
    const isDangDichInDb =
      banDichDb?.trangThai === TrangThaiDichReadme.DANG_DICH && banDichDb.readmeSha === hashGoc;

    if (isDangDichInMemory) {
      return {
        maUngDung: app.maUngDung,
        tenRepoDayDu: app.tenRepoDayDu,
        banGoc,
        banDich: banDichDb?.noiDungDich || null,
        trangThai: TrangThaiDichReadme.DANG_DICH,
        moHinhDich: banDichDb?.moHinhDich || null,
        readmeSha: hashGoc,
      };
    }

    if (isDangDichInDb) {
      const msDangDich = banDichDb?.thoiGianDich
        ? Date.now() - new Date(banDichDb.thoiGianDich).getTime()
        : 0;
      const STALE_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 phút

      if (msDangDich <= STALE_LOCK_TIMEOUT_MS) {
        return {
          maUngDung: app.maUngDung,
          tenRepoDayDu: app.tenRepoDayDu,
          banGoc,
          banDich: banDichDb?.noiDungDich || null,
          trangThai: TrangThaiDichReadme.DANG_DICH,
          moHinhDich: banDichDb?.moHinhDich || null,
          readmeSha: hashGoc,
        };
      }

      this.logger.warn(
        sanitizeLogMessage(
          `Trạng thái DANG_DICH cho app [${app.tenRepoDayDu}] đã quá 10 phút (stale lock). Kích hoạt dịch lại.`,
        ),
      );
    }

    // 3. FS-SEC-02 & Lỗi Đỏ 1 Claude: Nếu vừa thất bại trong vòng 15 phút, áp dụng cooldown chống spam DoS.
    // Cờ force=true CHỈ có hiệu lực khi trạng thái hiện tại là THAT_BAI, và phải tuân thủ khóa Redis 60s cooldown.
    if (
      banDichDb &&
      banDichDb.trangThai === TrangThaiDichReadme.THAT_BAI &&
      banDichDb.readmeSha === hashGoc
    ) {
      const msSinceLastFail = Date.now() - new Date(banDichDb.thoiGianDich).getTime();
      const COOLDOWN_THAT_BAI_MS = 15 * 60 * 1000;

      let choPhepForce = false;
      if (force) {
        const forceCooldownKey = `fs:ai:translation:force_cooldown:${app.maUngDung}`;
        // Redis SET NX 60s nguyên tử: mỗi app chỉ được ép dịch lại tối đa 1 lần / phút (Fix Claude DELIV-77.7)
        const daLayKhoa = await this.cacheService.setNx(forceCooldownKey, 60);
        if (daLayKhoa) {
          choPhepForce = true;
        } else {
          this.logger.warn(
            sanitizeLogMessage(
              `Yêu cầu force dịch lại cho app [${app.tenRepoDayDu}] bị từ chối do đang trong 60s cooldown`,
            ),
          );
        }
      }

      if (!choPhepForce && msSinceLastFail < COOLDOWN_THAT_BAI_MS) {
        return {
          maUngDung: app.maUngDung,
          tenRepoDayDu: app.tenRepoDayDu,
          banGoc,
          banDich: banDichDb.noiDungDich || null,
          trangThai: TrangThaiDichReadme.THAT_BAI,
          moHinhDich: banDichDb.moHinhDich,
          readmeSha: hashGoc,
        };
      }
    }

    // 4. Nếu README gốc đã thay đổi (hash khác), trạng thái hiển thị là DA_CU kèm bản dịch cũ (P3B-05.8)
    const isReadmeThayDoi = Boolean(
      banDichDb && banDichDb.readmeSha !== hashGoc && banDichDb.noiDungDich,
    );

    // 5. Kích hoạt dịch chạy nền non-blocking cho bản mới
    // Tuyệt đối không xóa dangDichSet để bảo toàn chốt chặn chạy trùng in-flight (Lỗi Đỏ 1 Claude)
    this.kichHoatDichReadmeNen(app.maUngDung, app.chuSoHuu, app.tenKhoChua, banGoc, hashGoc).catch(
      (err: unknown) => {
        this.logger.error(
          sanitizeLogMessage(
            `Lỗi chạy nền dịch README cho [${app.tenRepoDayDu}]: ${(err as Error).message}`,
          ),
        );
      },
    );

    // Trả về bản dịch cũ kèm trạng thái DA_CU hoặc DANG_DICH cho client
    return {
      maUngDung: app.maUngDung,
      tenRepoDayDu: app.tenRepoDayDu,
      banGoc,
      banDich: banDichDb?.noiDungDich || null,
      trangThai: isReadmeThayDoi
        ? TrangThaiDichReadme.DA_CU
        : banDichDb
          ? TrangThaiDichReadme.DANG_DICH
          : 'CHUA_DICH',
      moHinhDich: banDichDb?.moHinhDich || null,
      readmeSha: hashGoc,
    };
  }

  /** Báo để job nền bỏ qua README đang được hoãn, tránh tốn ngân sách trước giờ hẹn. */
  public async dangChoDenNgayMai(
    maUngDung: string,
    owner: string,
    repo: string,
    choPhepGoiGitHub = true,
  ): Promise<{ dangCho: boolean; daGoiGitHub: boolean }> {
    const khoa = `fs:ai:translation:deferred:${maUngDung}`;
    const mucCho = await this.cacheService.lay<{ readmeSha: string; retryAt: number }>(khoa);
    if (!mucCho) return { dangCho: false, daGoiGitHub: false };
    if (mucCho.retryAt <= Date.now()) {
      await this.cacheService.xoa(khoa);
      return { dangCho: false, daGoiGitHub: false };
    }
    if (!choPhepGoiGitHub) return { dangCho: true, daGoiGitHub: false };
    const vanKhop = await this.readmeDangChoVanKhop(mucCho, owner, repo);
    if (vanKhop.dangCho) return { dangCho: true, daGoiGitHub: vanKhop.daGoiGitHub };
    await this.cacheService.xoa(khoa);
    return { dangCho: false, daGoiGitHub: vanKhop.daGoiGitHub };
  }

  private async readmeDangChoVanKhop(
    mucCho: { readmeSha: string; retryAt: number },
    owner: string,
    repo: string,
  ): Promise<{ dangCho: boolean; daGoiGitHub: boolean }> {
    const cacheKey = `fs:github:readme:${owner.toLowerCase()}:${repo.toLowerCase()}`;
    try {
      // Đọc lại qua GithubService để ETag vẫn phát hiện được README đã đổi khi cache Redis còn trống.
      const banGoc = (await this.githubService.layReadme(owner, repo)) || '';
      await this.cacheService.luu(cacheKey, banGoc, 1800);
      return { dangCho: this.tinhMaBam(banGoc) === mucCho.readmeSha, daGoiGitHub: true };
    } catch {
      // Giữ lượt hoãn nếu GitHub tạm lỗi, tránh biến lỗi mạng thành lệnh dịch sớm.
      return { dangCho: true, daGoiGitHub: true };
    }
  }

  /**
   * Gom nhiều phân đoạn README vào các lô khoảng 2.500 ký tự (P3B-28.4).
   * Giúp giảm từ ~94 yêu cầu xuống còn ~4 yêu cầu cho README mới, ~1 yêu cầu khi cập nhật.
   */
  public gomLoDoanReadme<T extends { vanBanDaChe: string }>(
    doanList: T[],
    nguongKyTu = 2500,
  ): T[][] {
    if (!doanList || doanList.length === 0) return [];
    const cacLo: T[][] = [];
    let loHienTai: T[] = [];
    let tongDoDaiHienTai = 0;

    for (const doan of doanList) {
      const doDai = doan.vanBanDaChe.length;
      // Nếu lô hiện tại đã có đoạn và việc thêm đoạn này vượt quá 2500 ký tự thì ngắt lô
      if (loHienTai.length > 0 && tongDoDaiHienTai + doDai > nguongKyTu) {
        cacLo.push(loHienTai);
        loHienTai = [doan];
        tongDoDaiHienTai = doDai;
      } else {
        loHienTai.push(doan);
        tongDoDaiHienTai += doDai;
      }
    }

    if (loHienTai.length > 0) {
      cacLo.push(loHienTai);
    }
    return cacLo;
  }

  /**
   * Kiểm tra bảo toàn đầy đủ các ký hiệu giữ chỗ dạng ⟦C\d+⟧ giữa văn bản gốc và bản dịch (P3B-28.4).
   */
  public kiemTraGiuChoKyHieu(goc: string, dich: string): boolean {
    if (!dich || !dich.trim()) return false;
    const regex = /⟦C\d+⟧/g;
    const placeholdersGoc = (goc.match(regex) || []).sort();
    const placeholdersDich = (dich.match(regex) || []).sort();

    if (placeholdersGoc.length !== placeholdersDich.length) return false;
    return placeholdersGoc.every((val, idx) => val === placeholdersDich[idx]);
  }

  private chuanHoaKyHieuGiuCho(text: string): string {
    // Một số model đổi ngoặc ký hiệu; chuẩn hóa trước khi ghép để khôi phục đúng khung gốc.
    return text.replace(/\[C(\d+)\]/g, '⟦C$1⟧');
  }

  private layBanDichGomLoHopLe(
    doan: { stt: number; vanBanDaChe: string },
    banDichTho: string | null,
    owner: string,
    repo: string,
  ): string | null {
    if (!banDichTho) return null;
    let banDich = StructureValidator.cleanOutput(banDichTho, doan.vanBanDaChe);
    banDich = this.chuanHoaKyHieuGiuCho(banDich);
    const loi = StructureValidator.findStructureProblem(doan.vanBanDaChe, banDich);
    if (!loi && this.kiemTraGiuChoKyHieu(doan.vanBanDaChe, banDich)) return banDich;
    this.logger.warn(
      `Đoạn ${doan.stt} trong lô lỗi cấu trúc (${loi || 'placeholders_changed'}). Fallback dịch riêng lẻ cho [${owner}/${repo}].`,
    );
    return null;
  }

  /**
   * Tác vụ dịch README chạy nền non-blocking (P3B-05.3, P3B-05.4 & P3B-28.4).
   */
  public async kichHoatDichReadmeNen(
    maUngDung: string,
    owner: string,
    repo: string,
    banGoc: string,
    readmeSha: string,
  ): Promise<boolean> {
    if (!banGoc || !banGoc.trim()) return false;
    if (this.dangDichSet.has(maUngDung)) return false;

    this.dangDichSet.add(maUngDung);

    // Đánh dấu trạng thái DANG_DICH
    await this.prisma.banDichReadme.upsert({
      where: { maUngDung_ngonNgu: { maUngDung, ngonNgu: 'vi' } },
      create: {
        maUngDung,
        ngonNgu: 'vi',
        readmeSha,
        noiDungDich: '',
        moHinhDich: 'pending',
        trangThai: TrangThaiDichReadme.DANG_DICH,
      },
      update: {
        trangThai: TrangThaiDichReadme.DANG_DICH,
        readmeSha,
        // Mốc bắt đầu lần dịch này: dùng cho kiểm tra khóa DANG_DICH quá hạn (10 phút)
        thoiGianDich: new Date(),
      },
    });

    try {
      const cauTruc = phanTichReadme(banGoc);
      const banDichTheoDoan = new Map<number, string>();
      const cacModelDung = new Set<string>();
      const cacDoanChoLuu: Array<{
        maBam: string;
        doanGoc: string;
        doanDich: string;
        moHinhDich: string;
      }> = [];
      let lastModelUsed = 'gemini-3.1-flash-lite';
      const doanCanDichAI: typeof cauTruc.doan = [];

      for (const doan of cauTruc.doan) {
        if (!doan.canDich) continue;
        const maBamDoan = doan.maBam;

        // 1. Kiểm tra Bảng 13: bo_nho_dich_chung (P3B-05.3, giữ nguyên bản cũ theo maBam kể cả bản của Anti)
        const cacheDoan = await this.prisma.boNhoDichChung.findUnique({
          where: { maBam_ngonNgu: { maBam: maBamDoan, ngonNgu: 'vi' } },
        });

        if (cacheDoan && cacheDoan.doanDich) {
          try {
            const banCacheDaGhep = goKhungGiuNguyen(doan, cacheDoan.doanDich);
            const kiemTraCache = kiemBatBienReadme(doan.vanBanGoc, banCacheDaGhep, {
              doan: [
                {
                  goc: doan.vanBanDaChe.replace(/⟦C\d+⟧/g, ''),
                  dich: cacheDoan.doanDich.replace(/⟦C\d+⟧/g, ''),
                },
              ],
            });
            if (layLoiBatBienReadme(kiemTraCache.canhBao).length === 0) {
              banDichTheoDoan.set(doan.stt, cacheDoan.doanDich);
              if (cacheDoan.moHinhDich) cacModelDung.add(cacheDoan.moHinhDich);
              continue;
            }
          } catch {
            // Cache cũ thiếu hoặc đảo ký hiệu sẽ được bỏ qua và dịch lại; không xóa mục dùng chung.
          }
          this.logger.warn(`Bỏ qua cache README không đạt bất biến cho repo [${owner}/${repo}]`);
        }

        // Đoạn chưa có bản dịch trong cache -> đưa vào danh sách cần AI dịch
        doanCanDichAI.push(doan);
      }

      // 2. Gom lô các đoạn cần AI dịch thành các nhóm khoảng 2.500 ký tự (P3B-28.4)
      if (doanCanDichAI.length > 0) {
        const danhSachLo = this.gomLoDoanReadme(doanCanDichAI, 2500);
        let soLanDichLe = 0;

        for (const lo of danhSachLo) {
          const items = lo.map((d) => ({
            id: String(d.stt),
            text: d.vanBanDaChe,
          }));

          // Gọi dịch gom lô qua JSON (áp dụng cho cả repo mới và repo cập nhật)
          let ketQuaBatch: import('./translation-rotation.service').KetQuaDichGomLoJson | null =
            null;
          try {
            ketQuaBatch = await this.translationRotationService.dichGomLoJson(items, {
              batchSize: items.length,
              loai: 'readme',
            });
          } catch (errBatch) {
            this.logger.warn(
              `Dịch gom lô thất bại cho repo [${owner}/${repo}], chuyển sang xử lý từng đoạn: ${(errBatch as Error).message}`,
            );
          }

          const banDichGomLoHopLe = new Map<number, string>();
          for (const doan of lo) {
            const banDich = this.layBanDichGomLoHopLe(
              doan,
              ketQuaBatch?.ketQua?.[String(doan.stt)] ?? null,
              owner,
              repo,
            );
            if (!banDich) continue;
            banDichGomLoHopLe.set(doan.stt, banDich);
            cacDoanChoLuu.push({
              maBam: doan.maBam,
              doanGoc: doan.vanBanGoc.trim(),
              doanDich: banDich,
              moHinhDich: ketQuaBatch?.model || ketQuaBatch?.provider || lastModelUsed,
            });
          }

          for (const doan of lo) {
            let banDichDoan = banDichGomLoHopLe.get(doan.stt) ?? null;
            const laBanDichGomLo = Boolean(banDichDoan);

            // Nếu lô không trả về bản dịch cho đoạn này hoặc hỏng ký hiệu -> fallback dịch đơn lẻ
            let modelUsed = ketQuaBatch?.model || ketQuaBatch?.provider || lastModelUsed;
            if (ketQuaBatch?.choNgayMai && !banDichDoan) {
              await this.tamDungDichReadme(
                maUngDung,
                readmeSha,
                ketQuaBatch.retryAfterSec ?? 0,
                cacDoanChoLuu,
              );
              return false;
            }
            if (!banDichDoan) {
              if (soLanDichLe >= this.SO_LAN_DICH_LE_TOI_DA_MOI_README) {
                await this.xepLaiKhiChamTran(maUngDung, owner, repo, readmeSha, cacDoanChoLuu);
                return false;
              }
              soLanDichLe++;
              const ketQuaDon = await this.translationRotationService.dichVanBan(doan.vanBanDaChe, {
                context: doan.tieuDeMuc,
              });

              if (ketQuaDon?.choNgayMai) {
                await this.tamDungDichReadme(
                  maUngDung,
                  readmeSha,
                  ketQuaDon.retryAfterSec ?? 0,
                  cacDoanChoLuu,
                );
                return false;
              }

              if (!ketQuaDon || !ketQuaDon.thanhCong || ketQuaDon.banDich === null) {
                this.logger.warn(`Dịch đoạn README thất bại cho repo [${owner}/${repo}]`);
                await this.luuDoanDichThanhCong(cacDoanChoLuu);
                await this.prisma.banDichReadme.update({
                  where: { maUngDung_ngonNgu: { maUngDung, ngonNgu: 'vi' } },
                  data: { trangThai: TrangThaiDichReadme.THAT_BAI, thoiGianDich: new Date() },
                });
                return false;
              }

              banDichDoan = ketQuaDon.banDich;
              modelUsed = ketQuaDon.model || ketQuaDon.provider || lastModelUsed;
            }

            cacModelDung.add(modelUsed);
            lastModelUsed = modelUsed;
            banDichTheoDoan.set(doan.stt, banDichDoan);

            if (!laBanDichGomLo) {
              cacDoanChoLuu.push({
                maBam: doan.maBam,
                doanGoc: doan.vanBanGoc.trim(),
                doanDich: banDichDoan,
                moHinhDich: modelUsed,
              });
            }
          }
        }
      }

      // Ghép bằng offset nguồn để mọi khối không dịch được giữ nguyên byte.
      const noiDungDich = rapLaiReadme(banGoc, cauTruc, banDichTheoDoan);
      const kiemTraChatLuong = kiemBatBienReadme(banGoc, noiDungDich, {
        doan: cauTruc.doan.map((doan) => ({
          goc: doan.vanBanDaChe.replace(/⟦C\d+⟧/g, ''),
          dich: (
            banDichTheoDoan.get(doan.stt) ??
            (doan.vanBanDaChe !== doan.vanBanGoc ? doan.vanBanDaChe : doan.vanBanGoc)
          ).replace(/⟦C\d+⟧/g, ''),
        })),
      });
      const canhBaoReadme = [
        ...kiemTraChatLuong.canhBao,
        ...cauTruc.canhBao.map((warning) => `${warning.lyDo}_dong_${warning.dong}`),
      ];
      if (canhBaoReadme.length > 0) {
        this.logger.warn(`README [${owner}/${repo}] được xếp hạng B: ${canhBaoReadme.join(', ')}`);
      }
      const loiBatBien = layLoiBatBienReadme(kiemTraChatLuong.canhBao);
      if (loiBatBien.length > 0) {
        this.logger.error(
          `README [${owner}/${repo}] không vượt qua bộ kiểm bất biến: ${loiBatBien.join(', ')}`,
        );
        await this.prisma.banDichReadme.update({
          where: { maUngDung_ngonNgu: { maUngDung, ngonNgu: 'vi' } },
          data: { trangThai: TrangThaiDichReadme.THAT_BAI, thoiGianDich: new Date() },
        });
        return false;
      }
      for (const doan of cacDoanChoLuu) {
        await this.prisma.boNhoDichChung.upsert({
          where: { maBam_ngonNgu: { maBam: doan.maBam, ngonNgu: 'vi' } },
          create: {
            maBam: doan.maBam,
            ngonNgu: 'vi',
            doanGoc: doan.doanGoc,
            doanDich: doan.doanDich,
            moHinhDich: doan.moHinhDich,
          },
          update: { doanDich: doan.doanDich, moHinhDich: doan.moHinhDich },
        });
      }
      const moHinhDichTongHop = Array.from(cacModelDung).join(', ') || lastModelUsed;

      await this.prisma.banDichReadme.upsert({
        where: { maUngDung_ngonNgu: { maUngDung, ngonNgu: 'vi' } },
        create: {
          maUngDung,
          ngonNgu: 'vi',
          readmeSha,
          noiDungDich,
          moHinhDich: moHinhDichTongHop,
          trangThai: TrangThaiDichReadme.HOAN_TAT,
        },
        update: {
          readmeSha,
          noiDungDich,
          moHinhDich: moHinhDichTongHop,
          trangThai: TrangThaiDichReadme.HOAN_TAT,
          thoiGianDich: new Date(),
        },
      });

      // Cập nhật readmeSha vào bảng UngDung
      await this.prisma.ungDung.update({
        where: { maUngDung },
        data: { readmeSha },
      });

      this.logger.log(
        `Hoàn thành dịch README cho app [${owner}/${repo}] với model [${moHinhDichTongHop}]`,
      );
      return true;
    } catch (err: unknown) {
      this.logger.error(
        sanitizeLogMessage(
          `Lỗi ngoại lệ khi dịch README cho app [${owner}/${repo}]: ${(err as Error).message}`,
        ),
      );
      await this.prisma.banDichReadme.update({
        where: { maUngDung_ngonNgu: { maUngDung, ngonNgu: 'vi' } },
        data: { trangThai: TrangThaiDichReadme.THAT_BAI, thoiGianDich: new Date() },
      });
      return false;
    } finally {
      this.dangDichSet.delete(maUngDung);
    }
  }

  private async xepHangNgayMai(
    maUngDung: string,
    readmeSha: string,
    retryAfterSec: number,
  ): Promise<void> {
    await this.xepHangThuLai(maUngDung, readmeSha, retryAfterSec);
    await this.translationRotationService.ghiNhanMucChoNgayMai([`${maUngDung}:readme`]);
  }

  private async xepHangThuLai(
    maUngDung: string,
    readmeSha: string,
    retryAfterSec: number,
  ): Promise<void> {
    const ttl = Math.max(60, retryAfterSec + 300);
    await this.cacheService.luu(
      `fs:ai:translation:deferred:${maUngDung}`,
      { readmeSha, retryAt: Date.now() + ttl * 1000 },
      ttl,
    );
  }

  /** Chạm trần dịch lẻ: thử lại sau 5 phút, nhưng quá số lần cho phép trong ngày thì hoãn sang hôm sau. */
  private async xepLaiKhiChamTran(
    maUngDung: string,
    owner: string,
    repo: string,
    readmeSha: string,
    cacDoanChoLuu: Array<{ maBam: string; doanGoc: string; doanDich: string; moHinhDich: string }>,
  ): Promise<void> {
    const soLanChamTran = await this.cacheService.tangSo(
      `fs:ai:translation:cap-hit:${maUngDung}`,
      1,
      86400,
    );
    const hoanSangMai = soLanChamTran >= this.SO_LAN_CHAM_TRAN_TOI_DA_MOI_NGAY;
    this.logger.warn(
      `README [${owner}/${repo}] chạm giới hạn ${this.SO_LAN_DICH_LE_TOI_DA_MOI_README} lượt dịch lẻ (lần ${soLanChamTran} trong ngày), ${hoanSangMai ? 'hoãn sang hôm sau' : 'xếp hàng thử lại'}.`,
    );
    // shortcut: hoãn đúng 24 giờ thay vì đến nửa đêm Thái Bình Dương, đủ để không lặp trong ngày.
    await this.tamDungDichReadme(
      maUngDung,
      readmeSha,
      hoanSangMai ? 86400 : 0,
      cacDoanChoLuu,
      hoanSangMai,
    );
  }

  private async tamDungDichReadme(
    maUngDung: string,
    readmeSha: string,
    retryAfterSec: number,
    cacDoanChoLuu: Array<{
      maBam: string;
      doanGoc: string;
      doanDich: string;
      moHinhDich: string;
    }>,
    ghiThongKeNgayMai = true,
  ): Promise<void> {
    // Lưu phần đã đạt trước khi xếp lại để lần chạy sau chỉ cần xử lý phần còn thiếu.
    if (ghiThongKeNgayMai) {
      await this.xepHangNgayMai(maUngDung, readmeSha, retryAfterSec);
    } else {
      await this.xepHangThuLai(maUngDung, readmeSha, retryAfterSec);
    }
    await this.luuDoanDichThanhCong(cacDoanChoLuu);
    await this.prisma.banDichReadme.update({
      where: { maUngDung_ngonNgu: { maUngDung, ngonNgu: 'vi' } },
      data: { trangThai: TrangThaiDichReadme.DANG_DICH, thoiGianDich: new Date() },
    });
  }

  private async luuDoanDichThanhCong(
    doanList: Array<{ maBam: string; doanGoc: string; doanDich: string; moHinhDich: string }>,
  ): Promise<void> {
    for (const doan of doanList) {
      await this.prisma.boNhoDichChung.upsert({
        where: { maBam_ngonNgu: { maBam: doan.maBam, ngonNgu: 'vi' } },
        create: {
          maBam: doan.maBam,
          ngonNgu: 'vi',
          doanGoc: doan.doanGoc,
          doanDich: doan.doanDich,
          moHinhDich: doan.moHinhDich,
        },
        update: { doanDich: doan.doanDich, moHinhDich: doan.moHinhDich },
      });
    }
  }
}
