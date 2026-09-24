export const REDIS_CLIENT = 'REDIS_CLIENT';

export const CACHE_PREFIX = {
  APP_LIST: 'fs:apps:list:',
  APP_DETAIL: 'fs:apps:detail:',
  APP_UPDATES: 'fs:apps:updates:',
  GH_API: 'fs:gh:',
  AUTH_STATE: 'fs:auth:state:',
  AUTH_EXCHANGE: 'fs:auth:exchange:',
  AI_ANALYSIS: 'fs:ai:',
  LOCK: 'fs:lock:',
} as const;

export const DEFAULT_TTL = {
  SEARCH_RESULTS: 3600, // 1 giờ (bảo vệ hạn ngạch 30 req/phút của GitHub)
  APP_DETAIL: 7200, // 2 giờ
  EXCHANGE_CODE: 60, // 60 giây (OAuth 1-time exchange code per D-09)
  OAUTH_STATE: 600, // 10 phút (OAuth state login flow)
  RATE_LIMIT: 60, // 1 phút
} as const;
