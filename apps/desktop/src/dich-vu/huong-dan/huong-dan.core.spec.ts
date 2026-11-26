import { describe, expect, it, vi } from 'vitest';
import {
  CAC_BUOC_HUONG_DAN_CHI_TIET,
  CAC_BUOC_HUONG_DAN_KHAM_PHA,
  KHOA_DA_XEM_HUONG_DAN_LAN_DAU,
  REPO_MAU_HUONG_DAN,
  URL_HUONG_DAN_CLI_GOC,
  URL_HUONG_DAN_GITHUB,
  danhDauDaXemHuongDanLanDau,
  daXemHuongDanLanDau,
  layLienKetHuongDanCli,
} from './huong-dan.core';

const TU_CAM = ['android', 'apk', 'mobile', 'gemini'] as const;

describe('huong-dan.core (P3B-46)', () => {
  it('dùng đúng repo mẫu microsoft/terminal và URL GitHub kết thúc bằng #github-la-gi', () => {
    expect(REPO_MAU_HUONG_DAN).toBe('microsoft/terminal');
    expect(URL_HUONG_DAN_CLI_GOC).toBe('https://forgestore.lhutech.click/huong-dan-cli');
    expect(URL_HUONG_DAN_GITHUB.endsWith('#github-la-gi')).toBe(true);
  });

  describe('layLienKetHuongDanCli', () => {
    it('ánh xạ đúng 9 mã công cụ sang neo trên trang /huong-dan-cli (kể cả viết hoa/khoảng trắng)', () => {
      const cacMa = ['docker', 'npm', 'npx', 'pip', 'winget', 'scoop', 'cargo', 'conda', 'go'];
      for (const ma of cacMa) {
        expect(layLienKetHuongDanCli(ma)).toBe(`${URL_HUONG_DAN_CLI_GOC}#${ma}`);
      }
      expect(layLienKetHuongDanCli('  DOCKER  ')).toBe(`${URL_HUONG_DAN_CLI_GOC}#docker`);
      expect(layLienKetHuongDanCli('  Scoop ')).toBe(`${URL_HUONG_DAN_CLI_GOC}#scoop`);
    });

    it('trả về trang hướng dẫn gốc cho undefined, null, rỗng hoặc mã không thuộc danh sách', () => {
      expect(layLienKetHuongDanCli(undefined)).toBe(URL_HUONG_DAN_CLI_GOC);
      expect(layLienKetHuongDanCli(null)).toBe(URL_HUONG_DAN_CLI_GOC);
      expect(layLienKetHuongDanCli('')).toBe(URL_HUONG_DAN_CLI_GOC);
      expect(layLienKetHuongDanCli('khac')).toBe(URL_HUONG_DAN_CLI_GOC);
    });
  });

  describe('daXemHuongDanLanDau & danhDauDaXemHuongDanLanDau', () => {
    it('đọc và ghi cờ bằng đúng khóa KHOA_DA_XEM_HUONG_DAN_LAN_DAU', () => {
      const duLieu = new Map<string, string>();
      const boNhoGia = {
        getItem: (k: string) => duLieu.get(k) ?? null,
        setItem: (k: string, v: string) => {
          duLieu.set(k, v);
        },
      };

      expect(daXemHuongDanLanDau(boNhoGia)).toBe(false);
      danhDauDaXemHuongDanLanDau(boNhoGia);
      expect(duLieu.get(KHOA_DA_XEM_HUONG_DAN_LAN_DAU)).toBe('1');
      expect(daXemHuongDanLanDau(boNhoGia)).toBe(true);
    });

    it('xử lý an toàn không ném lỗi khi Storage bị chặn hoặc null', () => {
      const boNhoLoi = {
        getItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
        setItem: vi.fn(() => {
          throw new Error('SecurityError');
        }),
      };

      expect(daXemHuongDanLanDau(null)).toBe(false);
      expect(daXemHuongDanLanDau(boNhoLoi)).toBe(false);
      expect(() => danhDauDaXemHuongDanLanDau(null)).not.toThrow();
      expect(() => danhDauDaXemHuongDanLanDau(boNhoLoi)).not.toThrow();
    });
  });

  describe('bộ 9 bước hướng dẫn 2 chặng', () => {
    it('Chặng 1 có đủ 4 bước và Bước 1 nhắc cả tìm kiếm tiếng Việt lẫn dán link GitHub', () => {
      expect(CAC_BUOC_HUONG_DAN_KHAM_PHA).toHaveLength(4);
      expect(CAC_BUOC_HUONG_DAN_KHAM_PHA.map((b) => b.element)).toEqual([
        '[data-tour="tim-kiem"]',
        '[data-tour="kham-pha"]',
        '[data-tour="bo-suu-tap"]',
        '[data-tour="cai-dat"]',
      ]);

      const buocMot = CAC_BUOC_HUONG_DAN_KHAM_PHA[0];
      expect(buocMot?.moTa.toLowerCase()).toContain('tiếng việt');
      expect(buocMot?.moTa.toLowerCase()).toContain('github');
      expect(buocMot?.moTa).toContain('https://github.com/localsend/localsend');
    });

    it('Chặng 2 có đủ 5 bước phủ tro-giup, chi-tiet-readme, chi-tiet-phat-hanh, chi-tiet-cli và chi-tiet-cai-dat', () => {
      expect(CAC_BUOC_HUONG_DAN_CHI_TIET).toHaveLength(5);
      expect(CAC_BUOC_HUONG_DAN_CHI_TIET.map((b) => b.element)).toEqual([
        '[data-tour="tro-giup"]',
        '[data-tour="chi-tiet-readme"]',
        '[data-tour="chi-tiet-phat-hanh"]',
        '[data-tour="chi-tiet-cli"]',
        '[data-tour="chi-tiet-cai-dat"]',
      ]);
    });

    it('mọi tiêu đề và mô tả đều khác rỗng và không chứa từ cấm', () => {
      const tatCa = [...CAC_BUOC_HUONG_DAN_KHAM_PHA, ...CAC_BUOC_HUONG_DAN_CHI_TIET];
      for (const buoc of tatCa) {
        expect(buoc.tieuDe.trim().length).toBeGreaterThan(0);
        expect(buoc.moTa.trim().length).toBeGreaterThan(0);
        const vanBan = `${buoc.tieuDe} ${buoc.moTa}`.toLowerCase();
        for (const tu of TU_CAM) {
          expect(vanBan, `Không được chứa từ cấm "${tu}"`).not.toContain(tu);
        }
      }
    });
  });
});
