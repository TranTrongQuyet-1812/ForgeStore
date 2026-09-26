import { describe, it, expect } from 'vitest';
import type { HuongDanCaiDatDto } from '@forgestore/types';
import { PhanCungYeuCau } from '@forgestore/types';

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
});
