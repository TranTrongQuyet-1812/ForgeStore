import type { ThongTinUrlGithub } from '@forgestore/types';

/**
 * Mã để mở trang chi tiết từ kết quả dán link GitHub.
 * Backend trả `owner` và `repo` tách riêng (ví dụ "sharkdp" và "bat"), trong khi API chi tiết
 * chỉ nhận "owner/repo" hoặc mã UUID. Truyền riêng "bat" sẽ bị 404.
 */
export function layMaMoTrangTuLink(thongTin: Pick<ThongTinUrlGithub, 'owner' | 'repo'>): string {
  const owner = (thongTin.owner || '').trim();
  const repo = (thongTin.repo || '').trim();
  return owner ? `${owner}/${repo}` : repo;
}
