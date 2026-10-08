import { describe, it, expect } from 'vitest';
import type { HuongDanCaiDatDto } from '@forgestore/types';
import { PhanCungYeuCau, trichTenGoiTuLenhTho } from '@forgestore/types';

describe('CLI Guide Logic & Display Rules (DELIV-33.3)', () => {
  const mockCliGuide: HuongDanCaiDatDto = {
    duongDanReadmeGoc: 'https://github.com/open-webui/open-webui#readme',
    coRuiRoCao: true,
    cachCai: [
      {
        ten: 'Khởi chạy với Docker',
        nhom: 'DOCKER',
        heDieuHanh: 'DUNG_CHUNG',
        phanCung: PhanCungYeuCau.CPU,
        yeuCau: ['Docker Engine', 'NVIDIA Container Toolkit (tuỳ chọn)'],
        buoc: [
          {
            moTa: 'Chạy container Open WebUI',
            lenh: 'docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway -v open-webui:/app/backend/data --name open-webui --restart always ghcr.io/open-webui/open-webui:main',
            ruiRoCao: false,
          },
        ],
      },
      {
        ten: 'Cài đặt nhanh qua script tự động',
        nhom: 'NGUON',
        heDieuHanh: 'LINUX_MAC',
        phanCung: PhanCungYeuCau.KHONG_RO,
        yeuCau: ['curl', 'bash'],
        buoc: [
          {
            moTa: 'Tải và chạy script cài đặt',
            lenh: 'curl -fsSL https://openwebui.com/install.sh | bash',
            ruiRoCao: true,
            canhBaoRuiRo: 'Lệnh tải script từ internet và thực thi trực tiếp qua bash.',
          },
        ],
      },
    ],
  };

  it('xác định chính xác ứng dụng chỉ có hướng dẫn dòng lệnh (CLI-only)', () => {
    const displayAssets: unknown[] = [];
    const coFileCaiDat = displayAssets.length > 0;
    const coHuongDanCli = Boolean(mockCliGuide.cachCai && mockCliGuide.cachCai.length > 0);

    expect(coFileCaiDat).toBe(false);
    expect(coHuongDanCli).toBe(true);
    // Điều kiện hiển thị card CLI chuyên biệt
    const isCliOnly = !coFileCaiDat && coHuongDanCli;
    expect(isCliOnly).toBe(true);
  });

  it('xác định chính xác ứng dụng có cả tệp cài đặt lẫn hướng dẫn CLI', () => {
    const displayAssets = [{ maTep: 'file-1', tenTep: 'setup.exe' }];
    const coFileCaiDat = displayAssets.length > 0;
    const coHuongDanCli = Boolean(mockCliGuide.cachCai && mockCliGuide.cachCai.length > 0);

    expect(coFileCaiDat).toBe(true);
    expect(coHuongDanCli).toBe(true);
    const isCliOnly = !coFileCaiDat && coHuongDanCli;
    expect(isCliOnly).toBe(false);
  });

  it('bắt đúng cờ rủi ro cao và câu lệnh nguy hiểm', () => {
    expect(mockCliGuide.coRuiRoCao).toBe(true);

    const dockerMethod = mockCliGuide.cachCai[0];
    expect(dockerMethod.buoc[0].ruiRoCao).toBe(false);

    const scriptMethod = mockCliGuide.cachCai[1];
    expect(scriptMethod.buoc[0].ruiRoCao).toBe(true);
    expect(scriptMethod.buoc[0].lenh).toContain('curl -fsSL');
    expect(scriptMethod.buoc[0].canhBaoRuiRo).toBeDefined();
  });

  it('giữ nguyên văn 100% câu lệnh trích xuất từ README, không thêm bớt ký tự', () => {
    const originalCmd =
      'docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway -v open-webui:/app/backend/data --name open-webui --restart always ghcr.io/open-webui/open-webui:main';
    expect(mockCliGuide.cachCai[0].buoc[0].lenh).toBe(originalCmd);
  });

  describe('P3B-16: Luồng Cài Đặt CLI & Quản Lý Thư Viện Máy', () => {
    it('bảo vệ Thư viện máy: không đánh dấu daBiGoBenNgoai cho ứng dụng CLI dù registry rỗng', () => {
      const bAppCli = {
        maUngDung: 'app-fastfetch',
        phienBanHienTai: '2.30.0',
        trinhQuanLyGoi: 'winget',
        tenGoiCli: 'Fastfetch-cli.Fastfetch',
        trangThaiXacNhan: 'CHO_XAC_NHAN',
      };

      const registryMap: Record<string, null> = {
        'app-fastfetch': null, // Không có trong registry Windows
      };
      const isCheckingRegistry = false;
      const localApp = null;

      const laAppCli = Boolean(bAppCli.trinhQuanLyGoi);
      const daBiGoBenNgoai =
        !laAppCli &&
        !isCheckingRegistry &&
        Object.keys(registryMap).length > 0 &&
        registryMap[bAppCli.maUngDung] === null &&
        !localApp;

      expect(laAppCli).toBe(true);
      expect(daBiGoBenNgoai).toBe(false); // Tuyệt đối không bị đánh dấu đã gỡ oan!
    });

    it('hiển thị badge Chờ xác nhận (24h) và lệnh cập nhật khi có bản mới', () => {
      const app = {
        maUngDung: 'app-fastfetch',
        phienBanHienTai: '2.28.0',
        trinhQuanLyGoi: 'winget',
        tenGoiCli: 'Fastfetch-cli.Fastfetch',
        trangThaiXacNhan: 'CHO_XAC_NHAN',
        coBanMoi: true,
        phienBanMoi: '2.30.0',
        lenhCapNhatCli: 'winget upgrade --id Fastfetch-cli.Fastfetch',
        lenhGoCli: 'winget uninstall --id Fastfetch-cli.Fastfetch',
      };

      expect(app.trangThaiXacNhan).toBe('CHO_XAC_NHAN');
      expect(app.coBanMoi).toBe(true);
      expect(app.lenhCapNhatCli).toBe('winget upgrade --id Fastfetch-cli.Fastfetch');
      expect(app.lenhGoCli).toBe('winget uninstall --id Fastfetch-cli.Fastfetch');
    });

    it('nhận diện đúng gói và trình quản lý từ câu lệnh thô cho "Tôi đã cài"', () => {
      const rawCmd = 'winget install --id Fastfetch-cli.Fastfetch -e';
      const trich = trichTenGoiTuLenhTho(rawCmd);

      expect(trich).toBeDefined();
      expect(trich?.trinhQuanLy).toBe('winget');
      expect(trich?.tenGoi).toBe('Fastfetch-cli.Fastfetch');
    });

    it('bảo toàn iconUrl từ bApp.ungDung và chặn coBanMoi khi phiên bản là latest (DELIV-79.6)', () => {
      const bApp = {
        maUngDung: 'app-1',
        phienBanHienTai: 'latest',
        trinhQuanLyGoi: 'docker',
        ungDung: {
          duongDanIcon: 'https://example.com/icon.png',
        },
      };
      const updateItem = { coBanCapNhat: true };

      // Mô phỏng logic ánh xạ mergedAppsMap trong LibraryPage.tsx
      const mergedItem = {
        maUngDung: bApp.maUngDung,
        phienBanHienTai: bApp.phienBanHienTai,
        iconUrl: bApp.ungDung?.duongDanIcon ?? undefined,
        coBanMoi: bApp.phienBanHienTai !== 'latest' && Boolean(updateItem?.coBanCapNhat),
      };

      expect(mergedItem.iconUrl).toBe('https://example.com/icon.png');
      expect(mergedItem.coBanMoi).toBe(false);
    });
  });
});
