export const GITHUB_CONSTANTS = {
  API_BASE_URL: 'https://api.github.com',
  USER_AGENT: 'ForgeStore-Backend/1.0',
  CACHE_PREFIX_ETAG: 'fs:github:etag:',
  CACHE_PREFIX_DATA: 'fs:github:data:',
  CACHE_DEFAULT_TTL: 86400, // 24 giờ
  LOW_QUOTA_THRESHOLD_PERCENT: 0.1, // 10% quota còn lại
  SEARCH_MIN_INTERVAL_MS: 2000, // Tối thiểu 2 giây giữa 2 request Search API (chống vượt 30 req/min)
};

export interface GithubAsset {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
  download_count: number;
  created_at: string;
  updated_at: string;
  // GitHub REST API có thể trả trường digest hoặc sha256 nếu có
  digest?: string;
  sha256?: string;
}

export interface GithubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: GithubAsset[];
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url?: string;
  };
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  license: {
    key: string;
    name: string;
    spdx_id: string;
  } | null;
  language: string | null;
  topics?: string[];
  updated_at: string;
}

export type GithubSearchRepoItem = GithubRepo;

export interface GithubSearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: GithubSearchRepoItem[];
}
