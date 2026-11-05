import { describe, expect, it } from 'vitest';
import {
  chuyenLyDoLoc,
  docKetQuaSangLoc,
  docTenRepoTrending,
  taoTruyVanSangLoc,
} from './sang-loc-graphql.util';

describe('sang-loc-graphql.util (P3B-06.2, 06.5)', () => {
  it('dựng một truy vấn có bí danh r0..rN, từ chối tên có ký tự lạ để không chèn được vào truy vấn', () => {
    const q = taoTruyVanSangLoc(['a/b', 'c-d/e.f']);
    expect(q).toContain('r0: repository(owner: "a", name: "b")');
    expect(q).toContain('r1: repository(owner: "c-d", name: "e.f")');
    expect(() => taoTruyVanSangLoc(['a/b") { x } y: repository(owner: "z'])).toThrow();
  });

  it('đọc kết quả theo tên đã hỏi; repo không còn trả null; bản phát hành về đúng dạng bộ lọc', () => {
    const kq = docKetQuaSangLoc(
      {
        r0: {
          nameWithOwner: 'Moi/Ten',
          name: 'Ten',
          description: null,
          stargazerCount: 1500,
          isFork: false,
          isArchived: false,
          pushedAt: '2026-10-01T00:00:00Z',
          licenseInfo: null,
          repositoryTopics: { nodes: [{ topic: { name: 'gui' } }] },
          latestRelease: {
            tagName: 'v2',
            publishedAt: '2026-10-02T00:00:00Z',
            isPrerelease: false,
            isDraft: false,
            releaseAssets: { nodes: [{ name: 'a.msi' }] },
          },
        },
        r1: null,
      },
      ['Cu/Ten', 'x/y'],
    );
    expect(kq.get('cu/ten')).toEqual({
      repo: expect.objectContaining({ full_name: 'Moi/Ten', license: null, topics: ['gui'] }),
      releases: [expect.objectContaining({ tag_name: 'v2', assets: [{ name: 'a.msi' }] })],
    });
    expect(kq.get('x/y')).toBeNull();
  });

  it('chuyển mã lý do lọc sang mã DB', () => {
    expect(chuyenLyDoLoc('KHONG_CO_GIAY_PHEP')).toBe('GIAY_PHEP_KHONG_MO');
    expect(chuyenLyDoLoc('IT_SAO')).toBe('IT_SAO');
    expect(chuyenLyDoLoc(undefined)).toBe('LOI_KHI_SANG_LOC');
  });

  it('đọc tên repo trên trang Trending, trang đổi giao diện thì trả rỗng', () => {
    const html = `<article><h2 class="h3 lh-condensed">
      <a data-view-component="true" href="/owner-1/repo.one" class="Link">x</a></h2></article>
      <h2 class="h3"><a href="/owner2/repo_2">y</a></h2><a href="/sponsors/abc">z</a>`;
    expect(docTenRepoTrending(html)).toEqual(['owner-1/repo.one', 'owner2/repo_2']);
    expect(docTenRepoTrending('<div>giao diện mới</div>')).toEqual([]);
  });
});
