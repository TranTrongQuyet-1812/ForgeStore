import { LyDoLoaiUngVien } from '@prisma/client';
import type { LyDoLoc, ReleaseUngVien, RepoUngVien } from './bo-loc-nap-repo.util';

/**
 * Sàng lọc hàng loạt bằng GraphQL (P3B-06.5): một yêu cầu lấy đủ dữ liệu cho bộ lọc dùng chung
 * của 20–25 repo (sao, fork, archive, giấy phép, push, topic, bản phát hành mới nhất và tên tệp).
 * Hàm thuần, không gọi mạng, để test được.
 */

export const SO_REPO_MOI_TRUY_VAN = 20;

/** Tên owner/repo chỉ gồm chữ, số, `_`, `.`, `-` nên đặt thẳng vào truy vấn không sợ chèn. */
const TEN_HOP_LE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function taoTruyVanSangLoc(tenRepos: string[]): string {
  const phan = tenRepos.map((ten, i) => {
    if (!TEN_HOP_LE.test(ten)) throw new Error(`Tên repo không hợp lệ: ${ten}`);
    const [owner, name] = ten.split('/');
    return `r${i}: repository(owner: "${owner}", name: "${name}") {
    nameWithOwner name description stargazerCount isFork isArchived pushedAt
    licenseInfo { spdxId }
    repositoryTopics(first: 20) { nodes { topic { name } } }
    latestRelease { tagName publishedAt isPrerelease isDraft releaseAssets(first: 50) { nodes { name } } }
  }`;
  });
  return `query {\n  ${phan.join('\n  ')}\n}`;
}

interface RepoGraphql {
  nameWithOwner: string;
  name: string;
  description: string | null;
  stargazerCount: number;
  isFork: boolean;
  isArchived: boolean;
  pushedAt: string | null;
  licenseInfo: { spdxId: string | null } | null;
  repositoryTopics?: { nodes: Array<{ topic: { name: string } }> };
  latestRelease: {
    tagName: string;
    publishedAt: string | null;
    isPrerelease: boolean;
    isDraft: boolean;
    releaseAssets: { nodes: Array<{ name: string }> };
  } | null;
}

export interface DuLieuSangLoc {
  repo: RepoUngVien;
  releases: Array<ReleaseUngVien & { tag_name?: string }>;
}

/**
 * Đọc kết quả theo đúng thứ tự tên đã hỏi. Repo không còn tồn tại (đã xóa, chuyển riêng tư) trả `null`.
 * Khóa là tên viết thường như đã hỏi, không theo `nameWithOwner`, để repo đổi tên vẫn khớp ứng viên.
 */
export function docKetQuaSangLoc(
  data: Record<string, RepoGraphql | null | undefined>,
  tenRepos: string[],
): Map<string, DuLieuSangLoc | null> {
  const ketQua = new Map<string, DuLieuSangLoc | null>();
  tenRepos.forEach((ten, i) => {
    const r = data[`r${i}`];
    ketQua.set(ten.toLowerCase(), r ? chuyenRepoGraphql(r) : null);
  });
  return ketQua;
}

function chuyenRepoGraphql(r: RepoGraphql): DuLieuSangLoc {
  const rel = r.latestRelease;
  return {
    repo: {
      full_name: r.nameWithOwner,
      name: r.name,
      description: r.description,
      stargazers_count: r.stargazerCount,
      fork: r.isFork,
      archived: r.isArchived,
      pushed_at: r.pushedAt,
      license: r.licenseInfo ? { spdx_id: r.licenseInfo.spdxId } : null,
      topics: r.repositoryTopics?.nodes.map((n) => n.topic.name) ?? [],
    },
    releases: rel
      ? [
          {
            tag_name: rel.tagName,
            published_at: rel.publishedAt,
            prerelease: rel.isPrerelease,
            draft: rel.isDraft,
            assets: rel.releaseAssets.nodes,
          },
        ]
      : [],
  };
}

/** Mã lý do của bộ lọc dùng chung sang mã lưu trong DB (P3B-06.4). */
export function chuyenLyDoLoc(lyDo: LyDoLoc | undefined): LyDoLoaiUngVien {
  switch (lyDo) {
    case 'KHONG_CO_GIAY_PHEP':
      return LyDoLoaiUngVien.GIAY_PHEP_KHONG_MO;
    case undefined:
      return LyDoLoaiUngVien.LOI_KHI_SANG_LOC;
    default:
      return LyDoLoaiUngVien[lyDo];
  }
}

/**
 * Đọc tên repo trên trang github.com/trending (P3B-06.2). Mỗi repo nằm trong thẻ `<h2>` có liên kết `/owner/repo`.
 * Trang đổi giao diện thì trả mảng rỗng, người gọi bỏ qua nguồn này.
 */
export function docTenRepoTrending(html: string): string[] {
  const ten = new Set<string>();
  for (const m of html.matchAll(
    /<h2[^>]*>\s*<a[^>]*href="\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)"/g,
  )) {
    ten.add(m[1]!);
  }
  return [...ten];
}
