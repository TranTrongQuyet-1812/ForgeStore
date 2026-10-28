import { describe, expect, it } from 'vitest';
import { kiemChatLuongLo, type LyDoChatLuong } from './chat-luong.core';
import type { DoanChoDich, DongDich } from './data-repo.types';

function taoDong(repo: string, doan: DoanChoDich[]): DongDich {
  return {
    repo,
    lo: 'dich-g01-l001',
    moTaEn: null,
    moTaVi: null,
    doan,
  };
}

function taoDoan(stt: number, goc: string, mucQuanTrong: 1 | 2 = 1): DoanChoDich {
  return {
    stt,
    maBam: `hash-${stt}`,
    mucQuanTrong,
    vanBanDaChe: goc,
    canDich: true,
    vi: null,
  };
}

function lyDo(goc: string, vi: string, mucQuanTrong: 1 | 2 = 1): LyDoChatLuong[] {
  const nguon = taoDong('owner/repo', [taoDoan(1, goc, mucQuanTrong)]);
  const banDich = taoDong('owner/repo', [{ ...taoDoan(1, goc, mucQuanTrong), vi }]);
  return kiemChatLuongLo([nguon], [banDich])[0]?.lyDo ?? [];
}

describe('kiemChatLuongLo', () => {
  it('bắt độ dài bất thường theo mức quan trọng, gồm ngưỡng nặng', () => {
    expect(lyDo('A'.repeat(100), 'B'.repeat(45))).toContain('ngan_bat_thuong_nang');
    expect(lyDo('A'.repeat(100), 'B'.repeat(55))).toContain('ngan_bat_thuong');
    expect(lyDo('A'.repeat(100), 'B'.repeat(35), 2)).toContain('ngan_bat_thuong_muc_2');
  });

  it('bỏ qua văn bản gốc có chữ Hán và không tính placeholder vào tỉ lệ', () => {
    expect(lyDo('说明'.repeat(30), 'Ngắn')).toEqual([]);
    expect(lyDo(`A${'x'.repeat(40)}⟦C1⟧`, 'B'.repeat(20))).toContain('ngan_bat_thuong_nang');
  });

  it('bắt bản dịch mất hơn nửa số câu của nguồn', () => {
    expect(
      lyDo(
        'First sentence explains the setup. Second sentence explains the options. Third sentence describes the result. Fourth sentence gives a warning.',
        'Câu đầu đã dịch.',
      ),
    ).toContain('mat_cau');
  });

  it('nghi bản dịch lệch đoạn khi từ khóa bị mất nhưng nằm ở đoạn nguồn lân cận', () => {
    const nguon = taoDong('owner/repo', [
      taoDoan(
        10,
        'Accounts include GitHub Copilot, ChatGPT, xAI Grok, Claude Code, Claude Desktop and OpenAI Official for routing providers.',
      ),
      taoDoan(
        11,
        'Claude Desktop supports direct providers and offers settings for model routing.',
      ),
    ]);
    const banDich = taoDong('owner/repo', [
      { ...nguon.doan[0]!, vi: 'Thiết lập tài khoản đã hoàn tất.' },
      { ...nguon.doan[1]!, vi: 'Claude Desktop hỗ trợ nhà cung cấp trực tiếp.' },
    ]);

    expect(kiemChatLuongLo([nguon], [banDich]).find((item) => item.stt === 10)?.lyDo).toContain(
      'nghi_dich_lech_doan',
    );
    expect(lyDo('The Config File', 'Tệp cấu hình')).not.toContain('nghi_dich_lech_doan');
  });

  it('bắt đoạn tiếng Anh giữ nguyên nhưng bỏ phần URL, hash và địa chỉ ví trước khi so', () => {
    const english = 'Read this installation guide carefully before changing system settings.';
    expect(lyDo(english, english)).toContain('bo_nguyen_tieng_anh');
    expect(
      lyDo(`https://example.com/${'a'.repeat(45)}`, `https://example.com/${'a'.repeat(45)}`),
    ).not.toContain('bo_nguyen_tieng_anh');
    expect(lyDo('a'.repeat(64), 'a'.repeat(64))).not.toContain('bo_nguyen_tieng_anh');
  });

  it('bắt đoạn dài gấp đôi khi nguồn đủ dài, bỏ qua tiêu đề ngắn và bắt dòng lặp', () => {
    expect(
      lyDo(
        'This guide explains the complete setup process for the application.',
        'Giải thích rất dài về cách thực hiện đầy đủ mọi bước cần thiết để hoàn tất công việc.'.repeat(
          3,
        ),
      ),
    ).toContain('dich_qua_dai');
    expect(lyDo('Why Archon', 'Tại sao nên chọn Archon')).not.toContain('dich_qua_dai');
    expect(lyDo('One line only.', 'Repeated line\nRepeated line')).toContain('dong_lap_bat_thuong');
  });
});
