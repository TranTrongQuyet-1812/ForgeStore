import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  danhGiaRepoDoLai,
  docNhatKyDoLai,
  inKeHoachDoLai,
  lapKeHoachDoLai,
  layUngVienDoLai,
  type BanGhiBiLoai,
} from './do-lai-bi-loai.core';

const khongCoDaNhan = new Set<string>();

describe('layUngVienDoLai (gộp trùng và chọn lý do đáng dò lại)', () => {
  it('gộp trùng theo repo không phân biệt hoa thường, lấy sao cao nhất và gộp lý do', () => {
    const kq = layUngVienDoLai(
      [
        { repo: 'A/b', lyDo: 'KHONG_CO_FILE_CAI', sao: 100 },
        { repo: 'a/B', lyDo: 'KHONG_CO_BAN_PHAT_HANH', sao: 120 },
        { repo: 'a/b', lyDo: 'KHONG_CO_FILE_CAI', sao: 90 },
      ],
      khongCoDaNhan,
    );
    expect(kq).toHaveLength(1);
    expect(kq[0]?.sao).toBe(120);
    expect(kq[0]?.cacLyDo.sort()).toEqual(['KHONG_CO_BAN_PHAT_HANH', 'KHONG_CO_FILE_CAI']);
  });

  it('chỉ lấy ba lý do kỹ thuật và giấy phép cần duyệt khác "không có"', () => {
    const cac: BanGhiBiLoai[] = [
      { repo: 'x/ky-thuat', lyDo: 'KHONG_CO_TEP_CAI_VA_LENH_CAI', sao: 5 },
      { repo: 'x/gp-khac', lyDo: 'GIAY_PHEP_CAN_DUYET', sao: 4, chiTiet: 'NOASSERTION' },
      { repo: 'x/gp-khong-co', lyDo: 'GIAY_PHEP_CAN_DUYET', sao: 3, chiTiet: 'không có' },
      { repo: 'x/khong-gp', lyDo: 'KHONG_CO_GIAY_PHEP', sao: 2 },
      { repo: 'x/cu', lyDo: 'KHONG_CON_CAP_NHAT', sao: 1 },
      { repo: 'x/trung', lyDo: 'TRUNG_ID_GITHUB', sao: 1 },
    ];
    const ten = layUngVienDoLai(cac, khongCoDaNhan).map((u) => u.repo);
    expect(ten).toEqual(['x/ky-thuat', 'x/gp-khac']);
  });

  it('bỏ repo đã nhận, repo bị chặn có chủ ý và repo giấy phép "không có" ở nhật ký khác', () => {
    const cac: BanGhiBiLoai[] = [
      { repo: 'x/da-nhan', lyDo: 'KHONG_CO_FILE_CAI', sao: 9 },
      { repo: 'x/bi-chan', lyDo: 'GIAY_PHEP_CAN_DUYET', sao: 8, chiTiet: 'NOASSERTION' },
      { repo: 'x/bi-chan', lyDo: 'TRONG_DANH_SACH_CHAN', sao: 8, chiTiet: 'awesome-*' },
      { repo: 'x/khong-gp', lyDo: 'KHONG_CO_FILE_CAI', sao: 7 },
      { repo: 'x/khong-gp', lyDo: 'GIAY_PHEP_CAN_DUYET', sao: 7, chiTiet: 'không có' },
      { repo: 'x/duoc', lyDo: 'KHONG_CO_FILE_CAI', sao: 6 },
    ];
    const daNhan = new Set(['x/da-nhan']);
    expect(layUngVienDoLai(cac, daNhan).map((u) => u.repo)).toEqual(['x/duoc']);
    // Số đo thô (không loại trừ) vẫn giữ repo bị chặn và repo không giấy phép để đối chiếu
    expect(layUngVienDoLai(cac, daNhan, false)).toHaveLength(3);
  });

  it('sắp theo sao giảm dần', () => {
    const kq = layUngVienDoLai(
      [
        { repo: 'a/thap', lyDo: 'KHONG_CO_FILE_CAI', sao: 1 },
        { repo: 'a/cao', lyDo: 'KHONG_CO_FILE_CAI', sao: 5000 },
        { repo: 'a/giua', lyDo: 'KHONG_CO_FILE_CAI', sao: 50 },
      ],
      khongCoDaNhan,
    );
    expect(kq.map((u) => u.repo)).toEqual(['a/cao', 'a/giua', 'a/thap']);
  });
});

describe('lapKeHoachDoLai và inKeHoachDoLai', () => {
  const ungVien = layUngVienDoLai(
    [
      { repo: 'a/r1', lyDo: 'KHONG_CO_FILE_CAI', sao: 150000 },
      { repo: 'a/r2', lyDo: 'KHONG_CO_BAN_PHAT_HANH', sao: 25000 },
      { repo: 'a/r3', lyDo: 'KHONG_CO_TEP_CAI_VA_LENH_CAI', sao: 6000 },
      { repo: 'a/r4', lyDo: 'GIAY_PHEP_CAN_DUYET', sao: 1500, chiTiet: 'NOASSERTION' },
    ],
    khongCoDaNhan,
  );

  it('đếm theo lý do, theo mốc sao cộng dồn và ước lượt gọi GitHub', () => {
    const kh = lapKeHoachDoLai(ungVien);
    expect(kh.tongRepo).toBe(4);
    expect(kh.tuMocSao[100000]).toBe(1);
    expect(kh.tuMocSao[20000]).toBe(2);
    expect(kh.tuMocSao[5000]).toBe(3);
    expect(kh.tuMocSao[1000]).toBe(4);
    // Release chỉ cần cho nhóm thiếu tệp cài (r1) và giấy phép cần duyệt (r4)
    expect(kh.soLuotReleaseToiDa).toBe(2);
    expect(kh.soLuotGithubUocToiDa).toBe(6);
  });

  it('dòng in ra nêu rõ chưa gọi mạng', () => {
    const chu = inKeHoachDoLai(lapKeHoachDoLai(ungVien)).join('\n');
    expect(chu).toContain('4 repo riêng');
    expect(chu).toContain('Chưa gọi mạng');
  });
});

describe('docNhatKyDoLai (chỉ đọc tệp cục bộ, không mở kết nối mạng)', () => {
  let thuMuc = '';
  afterEach(() => {
    vi.restoreAllMocks();
    if (thuMuc) fs.rmSync(thuMuc, { recursive: true, force: true });
    thuMuc = '';
  });

  it('đọc *.boqua.jsonl và danh sách đã nhận *.txt, bỏ qua tệp do-lai-* và không gọi fetch', () => {
    const fetchGia = vi.fn();
    vi.stubGlobal('fetch', fetchGia);
    thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), 'do-lai-'));
    fs.writeFileSync(
      path.join(thuMuc, 'dot-01.boqua.jsonl'),
      JSON.stringify({ repo: 'a/b', lyDo: 'KHONG_CO_FILE_CAI', sao: 10 }) + '\n',
    );
    fs.writeFileSync(
      path.join(thuMuc, 'do-lai-x.boqua.jsonl'),
      JSON.stringify({ repo: 'c/d', lyDo: 'KHONG_CO_FILE_CAI', sao: 10 }) + '\n',
    );
    fs.writeFileSync(path.join(thuMuc, 'dot-01.txt'), '# Đợt dot-01\nE/F  # P2 100★ MIT\n');

    const { cacBanGhi, daNhan } = docNhatKyDoLai(thuMuc);
    expect(cacBanGhi.map((b) => b.repo)).toEqual(['a/b']);
    expect([...daNhan]).toEqual(['e/f']);
    expect(fetchGia).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('thư mục không tồn tại thì trả rỗng', () => {
    const { cacBanGhi, daNhan } = docNhatKyDoLai(path.join(os.tmpdir(), 'khong-ton-tai-xyz'));
    expect(cacBanGhi).toEqual([]);
    expect(daNhan.size).toBe(0);
  });
});

describe('danhGiaRepoDoLai (bộ lọc đã sửa trên dữ liệu giả, không gọi mạng)', () => {
  const rel = (tenTep: string[]) => ({
    draft: false,
    prerelease: false,
    published_at: new Date().toISOString(),
    assets: tenTep.map((name) => ({ name })),
  });

  it('README skill AI cài bằng npx được vớt, gắn NPX_SKILL', () => {
    const md = '## Installation\n```bash\nnpx skills add mattpocock/skills\n```\n';
    const kq = danhGiaRepoDoLai('mattpocock/skills', md, null);
    expect(kq.vot).toBe(true);
    expect(kq.nhom).toContain('NPX_SKILL');
  });

  it('README pip có [extras] được vớt, gắn PIP_GHIM', () => {
    const md = '## Installation\n```bash\npip install "pr-agent[github]"\n```\n';
    const kq = danhGiaRepoDoLai('The-PR-Agent/pr-agent', md, null);
    expect(kq.vot).toBe(true);
    expect(kq.nhom).toContain('PIP_GHIM');
  });

  it('README docker run nhiều dòng được vớt, gắn DOCKER_NHIEU_DONG', () => {
    const md =
      '## Installation\n```bash\ndocker run -d \\\n  -p 3000:3000 \\\n  significantgravitas/autogpt:latest\n```\n';
    const kq = danhGiaRepoDoLai('Significant-Gravitas/AutoGPT', md, null);
    expect(kq.vot).toBe(true);
    expect(kq.nhom).toContain('DOCKER_NHIEU_DONG');
  });

  it('Ghidra: một ZIP duy nhất không ghi hệ điều hành được vớt, gắn ZIP_DUY_NHAT', () => {
    const kq = danhGiaRepoDoLai('NationalSecurityAgency/ghidra', '# Ghidra\nA reverse tool.', [
      rel(['ghidra_12.2_PUBLIC_20261016.zip']),
    ]);
    expect(kq.vot).toBe(true);
    expect(kq.nhom).toContain('ZIP_DUY_NHAT');
  });

  it('có tệp .exe thì được vớt nhưng không gắn ZIP_DUY_NHAT', () => {
    const kq = danhGiaRepoDoLai('a/b', null, [rel(['app-setup-win-x64.exe'])]);
    expect(kq.vot).toBe(true);
    expect(kq.nhom).not.toContain('ZIP_DUY_NHAT');
  });

  it('README chỉ chạy từ mã nguồn kiểu OpenManus và npx dev vẫn bị loại', () => {
    const openManus =
      '## Installation\n```bash\ngit clone https://github.com/FoundationAgents/OpenManus.git\ncd OpenManus\npip install -r requirements.txt\n```\n';
    expect(danhGiaRepoDoLai('FoundationAgents/OpenManus', openManus, []).vot).toBe(false);
    const dev = '## Usage\n```bash\nnpx vite\nnpx create-react-app my-app\n```\n';
    expect(danhGiaRepoDoLai('a/app', dev, []).vot).toBe(false);
  });
});
