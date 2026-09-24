import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../redis/cache.service';
import {
  GITHUB_CONSTANTS,
  GithubRelease,
  GithubRepo,
  GithubSearchResult,
} from './github.constants';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly token: string;
  private readonly baseUrl = GITHUB_CONSTANTS.API_BASE_URL;

  // Trạng thái theo dõi Rate Limit
  private rateLimitRemaining: number | null = null;
  private rateLimitLimit: number | null = null;
  private rateLimitReset: number | null = null;

  // Hàng đợi tuần tự hóa Search API (Tối đa 30 req/phút => khoảng cách tối thiểu 2.000ms)
  private searchQueueTail: Promise<void> = Promise.resolve();
  private lastSearchTimestamp = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.token = this.config.get<string>('GITHUB_TOKEN', '');
    if (!this.token) {
      this.logger.warn(
        'GITHUB_TOKEN không được cung cấp. Các yêu cầu GitHub API sẽ bị giới hạn ở 60 req/h.',
      );
    }
  }

  /**
   * Trả về thông tin hạn mức GitHub API hiện thời.
   */
  getRateLimitInfo(): {
    remaining: number | null;
    limit: number | null;
    reset: number | null;
  } {
    return {
      remaining: this.rateLimitRemaining,
      limit: this.rateLimitLimit,
      reset: this.rateLimitReset,
    };
  }

  /**
   * Lấy thông tin Repository từ GitHub với bộ đệm ETag điều kiện (If-None-Match).
   * Tiết kiệm 100% quota nếu repository không có thay đổi (HTTP 304).
   */
  async layRepo(owner: string, repo: string): Promise<GithubRepo> {
    const endpoint = `/repos/${owner}/${repo}`;
    return this.yeuCauGithub<GithubRepo>(endpoint);
  }

  /**
   * Lấy nội dung README dạng văn bản Markdown đã giải mã từ GitHub.
   * Trả về null nếu repository không có README.
   */
  async layReadme(owner: string, repo: string): Promise<string | null> {
    const endpoint = `/repos/${owner}/${repo}/readme`;
    try {
      const data = await this.yeuCauGithub<{ content: string; encoding: string }>(endpoint);
      if (data && data.content && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (err: unknown) {
      if (err instanceof NotFoundException) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Lấy danh sách Releases của Repository (mặc định lấy 10 bản phát hành gần nhất).
   */
  async layDanhSachRelease(owner: string, repo: string, perPage = 10): Promise<GithubRelease[]> {
    const endpoint = `/repos/${owner}/${repo}/releases?per_page=${perPage}`;
    return this.yeuCauGithub<GithubRelease[]>(endpoint);
  }

  /**
   * Lấy Release mới nhất (Latest Release).
   * Trả về null nếu repo chưa có release nào.
   */
  async layReleaseMoiNhat(owner: string, repo: string): Promise<GithubRelease | null> {
    const endpoint = `/repos/${owner}/${repo}/releases/latest`;
    try {
      return await this.yeuCauGithub<GithubRelease>(endpoint);
    } catch (err: unknown) {
      if (err instanceof NotFoundException) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Tìm kiếm Repository với hàng đợi chống vi phạm rate limit (30 req/min).
   * Đảm bảo khoảng cách tối thiểu 2.000ms giữa 2 lần gọi liên tiếp.
   */
  async timKiemRepo(query: string, perPage = 20, page = 1): Promise<GithubSearchResult> {
    if (!query || !query.trim()) {
      throw new BadRequestException('Từ khóa tìm kiếm không được để trống.');
    }

    // Đẩy tác vụ vào hàng đợi tuần tự
    const ketQua = await this.enqueueSearch(async () => {
      const endpoint = `/search/repositories?q=${encodeURIComponent(query.trim())}&per_page=${perPage}&page=${page}`;
      return this.yeuCauGithub<GithubSearchResult>(endpoint);
    });

    return ketQua;
  }

  /**
   * Lấy số lượng người đóng góp (Contributors count ước tính).
   */
  async laySoLuongContributor(owner: string, repo: string): Promise<number> {
    const endpoint = `/repos/${owner}/${repo}/contributors?per_page=1&anon=true`;
    try {
      const etagKey = `${GITHUB_CONSTANTS.CACHE_PREFIX_ETAG}${endpoint}`;
      const dataKey = `${GITHUB_CONSTANTS.CACHE_PREFIX_DATA}${endpoint}`;
      const headers = this.taoHeaders();

      const cachedEtag = await this.cacheService.lay<string>(etagKey);
      if (cachedEtag) {
        headers['If-None-Match'] = cachedEtag;
      }

      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      this.capNhatRateLimitHeaders(res.headers);

      if (res.status === HttpStatus.NOT_MODIFIED) {
        const cachedCount = await this.cacheService.lay<number>(dataKey);
        if (cachedCount !== null) return cachedCount;
      }

      if (!res.ok) {
        if (res.status === HttpStatus.NOT_FOUND) return 0;
        return 1;
      }

      // Đọc header 'Link' để lấy số trang cuối cùng
      const linkHeader = res.headers.get('link');
      let count = 1;
      if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>;\s*rel="last"/);
        if (match && match[1]) {
          count = parseInt(match[1], 10);
        }
      } else {
        const list = (await res.json()) as unknown[];
        count = Array.isArray(list) ? list.length : 1;
      }

      const newEtag = res.headers.get('etag');
      if (newEtag) {
        await this.cacheService.luu(etagKey, newEtag, GITHUB_CONSTANTS.CACHE_DEFAULT_TTL);
      }
      await this.cacheService.luu(dataKey, count, GITHUB_CONSTANTS.CACHE_DEFAULT_TTL);
      return count;
    } catch (err: unknown) {
      this.logger.warn(`Lỗi khi lấy contributor cho ${owner}/${repo}: ${String(err)}`);
      return 1; // Fallback an toàn ít nhất 1 contributor
    }
  }

  /**
   * Core request engine với ETag Conditional Requests & Caching.
   */
  private async yeuCauGithub<T>(endpoint: string): Promise<T> {
    const etagKey = `${GITHUB_CONSTANTS.CACHE_PREFIX_ETAG}${endpoint}`;
    const dataKey = `${GITHUB_CONSTANTS.CACHE_PREFIX_DATA}${endpoint}`;

    // Kiểm tra ETag đã lưu trong cache
    const cachedEtag = await this.cacheService.lay<string>(etagKey);
    const headers = this.taoHeaders();

    if (cachedEtag) {
      headers['If-None-Match'] = cachedEtag;
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      // Cập nhật và kiểm toán Rate Limit
      this.capNhatRateLimitHeaders(response.headers);

      // Trường hợp 304 Not Modified: Dữ liệu trên GitHub chưa đổi, đọc từ Cache
      if (response.status === HttpStatus.NOT_MODIFIED) {
        this.logger.debug(`[GitHub ETag Hit 304] Sử dụng dữ liệu cache cho: ${endpoint}`);
        const cachedData = await this.cacheService.lay<T>(dataKey);
        if (cachedData !== null) {
          return cachedData;
        }
        // Trường hợp hy hữu mất cache data nhưng còn ETag, xóa ETag và fetch lại bình thường
        await this.cacheService.xoa(etagKey);
        return this.yeuCauGithub<T>(endpoint);
      }

      // Trường hợp 404 Not Found
      if (response.status === HttpStatus.NOT_FOUND) {
        throw new NotFoundException(`Tài nguyên GitHub không tồn tại: ${endpoint}`);
      }

      // Trường hợp Rate Limit bị vượt ngưỡng (403 hoặc 429)
      if (
        response.status === HttpStatus.FORBIDDEN ||
        response.status === HttpStatus.TOO_MANY_REQUESTS
      ) {
        const errorBody = await response.text();
        this.logger.error(`[GitHub Rate Limit Exceeded] Endpoint: ${endpoint}, Body: ${errorBody}`);
        throw new HttpException(
          'Đã vượt quá hạn mức truy vấn GitHub API (Rate Limit Exceeded). Vui lòng thử lại sau.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `[GitHub API Error ${response.status}] Endpoint: ${endpoint}, Body: ${errorBody}`,
        );
        throw new HttpException(
          `Lỗi khi kết nối tới GitHub API (HTTP ${response.status}): ${errorBody}`,
          response.status,
        );
      }

      // Xử lý dữ liệu thành công (HTTP 200)
      const data = (await response.json()) as T;
      const newEtag = response.headers.get('etag');

      // Lưu trữ đồng thời Data và ETag vào Cache
      if (newEtag) {
        await this.cacheService.luu(etagKey, newEtag, GITHUB_CONSTANTS.CACHE_DEFAULT_TTL);
      }
      await this.cacheService.luu(dataKey, data, GITHUB_CONSTANTS.CACHE_DEFAULT_TTL);

      return data;
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Lỗi kết nối GitHub API tại ${endpoint}: ${String(err)}`);
      throw new HttpException(
        'Không thể kết nối đến GitHub API do sự cố mạng hoặc quá thời gian chờ.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Tạo tiêu đề Headers chuẩn mực cho GitHub REST API.
   */
  private taoHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': GITHUB_CONSTANTS.USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Phân tích và giám sát tiêu đề Rate Limit từ phản hồi của GitHub.
   * Cảnh báo khi hạn mức còn dưới 10%.
   */
  private capNhatRateLimitHeaders(headers: Headers): void {
    const remainingHeader = headers.get('x-ratelimit-remaining');
    const limitHeader = headers.get('x-ratelimit-limit');
    const resetHeader = headers.get('x-ratelimit-reset');

    if (remainingHeader !== null) {
      this.rateLimitRemaining = parseInt(remainingHeader, 10);
    }
    if (limitHeader !== null) {
      this.rateLimitLimit = parseInt(limitHeader, 10);
    }
    if (resetHeader !== null) {
      this.rateLimitReset = parseInt(resetHeader, 10);
    }

    if (
      this.rateLimitRemaining !== null &&
      this.rateLimitLimit !== null &&
      this.rateLimitLimit > 0
    ) {
      const ratio = this.rateLimitRemaining / this.rateLimitLimit;
      if (ratio <= GITHUB_CONSTANTS.LOW_QUOTA_THRESHOLD_PERCENT) {
        const resetDate = this.rateLimitReset
          ? new Date(this.rateLimitReset * 1000).toLocaleTimeString()
          : 'Không rõ';
        this.logger.warn(
          `⚠️ CẢNH BÁO QUOTA GITHUB THẤP: Còn ${this.rateLimitRemaining}/${this.rateLimitLimit} lượt (${(
            ratio * 100
          ).toFixed(1)}%). Hạn mức sẽ được làm mới lúc ${resetDate}.`,
        );
      }
    }
  }

  /**
   * Tuần tự hóa các yêu cầu Search API đảm bảo giãn cách tối thiểu 2 giây.
   */
  private async enqueueSearch<T>(fn: () => Promise<T>): Promise<T> {
    const task = async () => {
      const now = Date.now();
      const elapsed = now - this.lastSearchTimestamp;
      if (elapsed < GITHUB_CONSTANTS.SEARCH_MIN_INTERVAL_MS) {
        const waitMs = GITHUB_CONSTANTS.SEARCH_MIN_INTERVAL_MS - elapsed;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastSearchTimestamp = Date.now();
      return fn();
    };

    const resultPromise = this.searchQueueTail.then(task, task);
    this.searchQueueTail = resultPromise.then(
      () => {},
      () => {},
    );
    return resultPromise;
  }
}
