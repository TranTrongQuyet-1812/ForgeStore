import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { GithubService } from '../../../github/github.service';
import { CacheService } from '../../../redis/cache.service';
import { TranslationRotationService } from './translation-rotation.service';
import { sanitizeLogMessage } from '../utils/log-sanitizer.util';
import { MarkdownMasker } from '../utils/markdown-masker.util';
import { ChiTietReadmeResponseDto, TrangThaiDichReadme } from '@forgestore/types';

@Injectable()
export class ReadmeTranslationService {
  private readonly logger = new Logger(ReadmeTranslationService.name);
  private readonly dangDichSet = new Set<string>();

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
        // Redis SET NX 60s: mỗi app chỉ được ép dịch lại tối đa 1 lần / phút
        const daKhoaCooldown = await this.cacheService.lay<boolean>(forceCooldownKey);
        if (!daKhoaCooldown) {
          await this.cacheService.luu(forceCooldownKey, true, 60);
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

  /**
   * Tác vụ dịch README chạy nền non-blocking (P3B-05.3, P3B-05.4).
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
      const cacDoan = this.phanDoanReadme(banGoc);
      const cacDoanDich: string[] = [];
      const cacModelDung = new Set<string>();
      let lastModelUsed = 'gemini-3.1-flash-lite';

      for (const doan of cacDoan) {
        const maBamDoan = this.tinhMaBam(doan);

        // 1. Kiểm tra Bảng 13: bo_nho_dich_chung (P3B-05.3)
        const cacheDoan = await this.prisma.boNhoDichChung.findUnique({
          where: { maBam_ngonNgu: { maBam: maBamDoan, ngonNgu: 'vi' } },
        });

        if (cacheDoan && cacheDoan.doanDich) {
          cacDoanDich.push(cacheDoan.doanDich);
          if (cacheDoan.moHinhDich) cacModelDung.add(cacheDoan.moHinhDich);
          continue;
        }

        // 2. Chưa có trong cache -> Dịch qua chuỗi xoay tua 4 nhà
        const ketQua = await this.translationRotationService.dichVanBan(doan);

        if (!ketQua.thanhCong || ketQua.banDich === null) {
          this.logger.warn(`Dịch đoạn README thất bại cho repo [${owner}/${repo}]`);
          await this.prisma.banDichReadme.update({
            where: { maUngDung_ngonNgu: { maUngDung, ngonNgu: 'vi' } },
            data: { trangThai: TrangThaiDichReadme.THAT_BAI, thoiGianDich: new Date() },
          });
          return false;
        }

        const modelUsed = ketQua.model || ketQua.provider || lastModelUsed;
        cacModelDung.add(modelUsed);
        lastModelUsed = modelUsed;
        cacDoanDich.push(ketQua.banDich);

        // 3. Lưu đoạn vừa dịch vào bo_nho_dich_chung (Bảng 13)
        await this.prisma.boNhoDichChung.upsert({
          where: { maBam_ngonNgu: { maBam: maBamDoan, ngonNgu: 'vi' } },
          create: {
            maBam: maBamDoan,
            ngonNgu: 'vi',
            doanGoc: doan.trim(),
            doanDich: ketQua.banDich,
            moHinhDich: modelUsed,
          },
          update: {
            doanDich: ketQua.banDich,
            moHinhDich: modelUsed,
          },
        });
      }

      // 4. Ghép toàn bộ các đoạn và lưu vào Bảng 12: ban_dich_readme
      const noiDungDich = cacDoanDich.join('\n\n');
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
}
