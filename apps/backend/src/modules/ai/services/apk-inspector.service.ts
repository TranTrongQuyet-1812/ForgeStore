import { Injectable, Logger } from '@nestjs/common';
import * as zlib from 'zlib';
import { parseAxml } from '../utils/axml-parser.util';

export interface KetQuaDocApk {
  thanhCong: boolean;
  packageName?: string;
  permissions: string[];
  coAccessibilityService: boolean;
  soByteDaTai: number;
  lyDoThatBai?: string;
}

@Injectable()
export class ApkInspectorService {
  private readonly logger = new Logger(ApkInspectorService.name);

  // Giới hạn an toàn: tải tối đa 500KB cho mỗi lần đọc APK (P2-35.5)
  private readonly GIOI_HAN_BYTE_TOI_DA = 512 * 1024;
  private readonly TIMEOUT_MS = 10000;

  private readonly ALLOWED_HOSTS = [
    'github.com',
    'objects.githubusercontent.com',
    'github-releases.githubusercontent.com',
    'raw.githubusercontent.com',
  ];

  /**
   * Kiểm tra URL tải APK có thuộc hostname GitHub hợp lệ không (SEC-V3-02: Chống SSRF)
   */
  private kiemTraUrlHopLe(urlStr: string): boolean {
    try {
      const u = new URL(urlStr);
      if (u.protocol !== 'https:') return false;
      const host = u.hostname.toLowerCase();
      return this.ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    } catch {
      return false;
    }
  }

  /**
   * Đọc danh sách quyền và Package Name từ APK qua HTTP Range Request (P2-35).
   * Chỉ tải phần EOCD, Central Directory và AndroidManifest.xml (thường < 200KB).
   */
  async docQuyenApkTuUrl(apkDownloadUrl: string): Promise<KetQuaDocApk> {
    let soByteDaTai = 0;

    // SEC-V3-02: Chống SSRF - Kiểm tra URL tải có thuộc máy chủ GitHub được phép không
    if (!this.kiemTraUrlHopLe(apkDownloadUrl)) {
      return {
        thanhCong: false,
        permissions: [],
        coAccessibilityService: false,
        soByteDaTai: 0,
        lyDoThatBai: 'Đường dẫn tải APK không thuộc máy chủ GitHub hợp lệ (SSRF Protection).',
      };
    }

    try {
      // 1. Gửi HEAD request lấy Content-Length và xác nhận Accept-Ranges (P2-35.1)
      // SEC-R6-05: Dùng redirect: 'manual' để kiểm tra Location header trước khi gửi request tiếp theo chống Blind SSRF
      let targetUrl = apkDownloadUrl;
      let headRes = await fetch(targetUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });

      // Nếu gặp chuyển hướng (301, 302, 307, 308), thẩm định whitelist trước khi gửi hop tiếp theo
      if ([301, 302, 307, 308].includes(headRes.status)) {
        const location = headRes.headers.get('location');
        if (!location) {
          return {
            thanhCong: false,
            permissions: [],
            coAccessibilityService: false,
            soByteDaTai: 0,
            lyDoThatBai: 'Redirect không có Location header hợp lệ.',
          };
        }
        let resolvedLocation: string;
        try {
          resolvedLocation = new URL(location, targetUrl).toString();
        } catch {
          return {
            thanhCong: false,
            permissions: [],
            coAccessibilityService: false,
            soByteDaTai: 0,
            lyDoThatBai: 'Redirect Location header có định dạng URL không hợp lệ.',
          };
        }

        if (!this.kiemTraUrlHopLe(resolvedLocation)) {
          return {
            thanhCong: false,
            permissions: [],
            coAccessibilityService: false,
            soByteDaTai: 0,
            lyDoThatBai:
              'Redirect URL tải APK không thuộc máy chủ GitHub hợp lệ (SSRF Protection).',
          };
        }

        targetUrl = resolvedLocation;
        headRes = await fetch(targetUrl, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(this.TIMEOUT_MS),
        });
      }

      if (!headRes.ok) {
        return {
          thanhCong: false,
          permissions: [],
          coAccessibilityService: false,
          soByteDaTai: 0,
          lyDoThatBai: `HTTP HEAD trả mã lỗi ${headRes.status}`,
        };
      }

      const finalUrl = targetUrl;
      const contentLengthHeader = headRes.headers.get('content-length');
      if (!contentLengthHeader) {
        return {
          thanhCong: false,
          permissions: [],
          coAccessibilityService: false,
          soByteDaTai: 0,
          lyDoThatBai: 'Server không trả Content-Length',
        };
      }

      const totalSize = parseInt(contentLengthHeader, 10);
      if (isNaN(totalSize) || totalSize <= 0) {
        return {
          thanhCong: false,
          permissions: [],
          coAccessibilityService: false,
          soByteDaTai: 0,
          lyDoThatBai: 'Content-Length không hợp lệ',
        };
      }

      // 2. Tải 64KB cuối file để tìm EOCD (End of Central Directory) (P2-35.2)
      const tailSize = Math.min(65536, totalSize);
      const tailStart = totalSize - tailSize;

      // SEC-R7-02: Bổ sung redirect: 'manual' chặn Blind SSRF chaining trên Range GET
      const tailRes = await fetch(finalUrl, {
        headers: { Range: `bytes=${tailStart}-${totalSize - 1}` },
        redirect: 'manual',
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });

      if (tailRes.status !== 206) {
        return {
          thanhCong: false,
          permissions: [],
          coAccessibilityService: false,
          soByteDaTai: 0,
          lyDoThatBai: `Server không hỗ trợ HTTP Range Request (mã ${tailRes.status}, yêu cầu 206)`,
        };
      }

      const tailBuf = Buffer.from(await tailRes.arrayBuffer());
      soByteDaTai += tailBuf.length;

      // 3. Tìm EOCD signature: 0x06054b50
      const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
      let eocdIdx = -1;
      for (let i = tailBuf.length - 22; i >= 0; i--) {
        if (
          tailBuf[i] === eocdSig[0] &&
          tailBuf[i + 1] === eocdSig[1] &&
          tailBuf[i + 2] === eocdSig[2] &&
          tailBuf[i + 3] === eocdSig[3]
        ) {
          eocdIdx = i;
          break;
        }
      }

      if (eocdIdx === -1) {
        return {
          thanhCong: false,
          permissions: [],
          coAccessibilityService: false,
          soByteDaTai,
          lyDoThatBai: 'Không tìm thấy EOCD trong 64KB đuôi APK',
        };
      }

      const cdSize = tailBuf.readUInt32LE(eocdIdx + 12);
      const cdOffset = tailBuf.readUInt32LE(eocdIdx + 16);

      // 4. Lấy dữ liệu Central Directory
      let cdBuf: Buffer;
      if (cdOffset >= tailStart) {
        const cdStartInTail = cdOffset - tailStart;
        cdBuf = tailBuf.subarray(cdStartInTail, cdStartInTail + cdSize);
      } else {
        // Tải thêm Central Directory nếu bắt đầu trước đoạn 64KB đuôi
        if (cdSize > this.GIOI_HAN_BYTE_TOI_DA) {
          return {
            thanhCong: false,
            permissions: [],
            coAccessibilityService: false,
            soByteDaTai,
            lyDoThatBai: 'Central Directory vượt quá giới hạn an toàn',
          };
        }

        // SEC-R7-02: Bổ sung redirect: 'manual' chặn Blind SSRF chaining
        const cdRes = await fetch(finalUrl, {
          headers: { Range: `bytes=${cdOffset}-${cdOffset + cdSize - 1}` },
          redirect: 'manual',
          signal: AbortSignal.timeout(this.TIMEOUT_MS),
        });
        if (cdRes.status !== 206) {
          return {
            thanhCong: false,
            permissions: [],
            coAccessibilityService: false,
            soByteDaTai,
            lyDoThatBai: `Server không hỗ trợ HTTP Range Request cho Central Directory (mã ${cdRes.status})`,
          };
        }
        cdBuf = Buffer.from(await cdRes.arrayBuffer());
        soByteDaTai += cdBuf.length;
      }

      // 5. Tìm AndroidManifest.xml trong Central Directory (P2-35.3)
      let cdCursor = 0;
      let manifestEntry: {
        compressionMethod: number;
        compressedSize: number;
        localHeaderOffset: number;
      } | null = null;

      while (cdCursor + 46 <= cdBuf.length) {
        const sig = cdBuf.readUInt32LE(cdCursor);
        if (sig !== 0x02014b50) break; // End of entries

        const compressionMethod = cdBuf.readUInt16LE(cdCursor + 10);
        const compressedSize = cdBuf.readUInt32LE(cdCursor + 20);
        const fileNameLen = cdBuf.readUInt16LE(cdCursor + 28);
        const extraLen = cdBuf.readUInt16LE(cdCursor + 30);
        const commentLen = cdBuf.readUInt16LE(cdCursor + 32);
        const localHeaderOffset = cdBuf.readUInt32LE(cdCursor + 42);

        const fileName = cdBuf
          .subarray(cdCursor + 46, cdCursor + 46 + fileNameLen)
          .toString('utf8');

        if (fileName === 'AndroidManifest.xml') {
          manifestEntry = {
            compressionMethod,
            compressedSize,
            localHeaderOffset,
          };
          break;
        }

        cdCursor += 46 + fileNameLen + extraLen + commentLen;
      }

      if (!manifestEntry) {
        return {
          thanhCong: false,
          permissions: [],
          coAccessibilityService: false,
          soByteDaTai,
          lyDoThatBai: 'Không tìm thấy AndroidManifest.xml trong APK',
        };
      }

      // 6. Tải Local Header và Compressed Data của AndroidManifest.xml
      const manifestFetchSize = 30 + 1024 + manifestEntry.compressedSize; // 30 bytes header + buffer extra field
      // SEC-R7-02: Bổ sung redirect: 'manual' chặn Blind SSRF chaining
      const manifestRes = await fetch(finalUrl, {
        headers: {
          Range: `bytes=${manifestEntry.localHeaderOffset}-${manifestEntry.localHeaderOffset + manifestFetchSize - 1}`,
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });

      if (manifestRes.status !== 206) {
        return {
          thanhCong: false,
          permissions: [],
          coAccessibilityService: false,
          soByteDaTai,
          lyDoThatBai: `Server không hỗ trợ HTTP Range Request cho AndroidManifest (mã ${manifestRes.status})`,
        };
      }

      const manifestLocalBuf = Buffer.from(await manifestRes.arrayBuffer());
      soByteDaTai += manifestLocalBuf.length;

      if (manifestLocalBuf.readUInt32LE(0) !== 0x04034b50) {
        return {
          thanhCong: false,
          permissions: [],
          coAccessibilityService: false,
          soByteDaTai,
          lyDoThatBai: 'Local Header của AndroidManifest.xml không đúng chữ ký ZIP',
        };
      }

      const localFileNameLen = manifestLocalBuf.readUInt16LE(26);
      const localExtraLen = manifestLocalBuf.readUInt16LE(28);
      const dataStart = 30 + localFileNameLen + localExtraLen;
      const compressedData = manifestLocalBuf.subarray(
        dataStart,
        dataStart + manifestEntry.compressedSize,
      );

      // 7. Giải nén (Inflate) nếu là Deflate (P2-35.3)
      let decompressedAxml: Buffer;
      if (manifestEntry.compressionMethod === 8) {
        decompressedAxml = zlib.inflateRawSync(compressedData);
      } else {
        decompressedAxml = compressedData;
      }

      // 8. Giải mã nhị phân AXML để lấy permissions và package name (P2-35.4)
      const axmlResult = parseAxml(decompressedAxml);

      if (!axmlResult.packageName && axmlResult.permissions.length === 0) {
        this.logger.warn(
          'Giải mã AXML thất bại: Không trích xuất được package name và không có quyền nào.',
        );
        return {
          thanhCong: false,
          permissions: [],
          coAccessibilityService: false,
          soByteDaTai,
          lyDoThatBai: 'Không trích xuất được package name hoặc quyền từ AndroidManifest.xml',
        };
      }

      this.logger.log(
        `✓ Đọc APK thành công [Package: ${axmlResult.packageName || 'N/A'}, Quyền: ${axmlResult.permissions.length}, Bytes tải: ${(soByteDaTai / 1024).toFixed(1)} KB]`,
      );

      return {
        thanhCong: true,
        packageName: axmlResult.packageName,
        permissions: axmlResult.permissions,
        coAccessibilityService: axmlResult.coAccessibilityService,
        soByteDaTai,
      };
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Lỗi không xác định khi đọc APK';
      this.logger.warn(`Đọc APK qua Range Request thất bại: ${msg}`);
      return {
        thanhCong: false,
        permissions: [],
        coAccessibilityService: false,
        soByteDaTai,
        lyDoThatBai: msg,
      };
    }
  }
}
