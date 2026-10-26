/**
 * Tiện ích PKCE (Proof Key for Code Exchange - RFC 7636) cho ForgeStore Client.
 *
 * Tiêu chuẩn:
 * 1. Code Verifier: Chuỗi ngẫu nhiên 43 - 128 ký tự gồm [A-Z, a-z, 0-9, -, ., _, ~]
 * 2. Code Challenge: SHA-256 của Code Verifier, mã hóa Base64URL (bỏ padding '=', thay '+' bằng '-', '/' bằng '_').
 * 3. Hỗ trợ lưu trữ đa phiên (Multi-Session Map): Tránh ghi đè verifier khi người dùng mở nhiều tab hoặc bấm "Thử lại".
 *    Tự động dọn dẹp các mục quá 10 phút (khớp TTL 600s của Redis backend).
 */

const PKCE_MAP_STORAGE_KEY = 'forgestore_pkce_verifiers_map';
const PKCE_LEGACY_STORAGE_KEY = 'forgestore_pkce_verifier';
export const VERIFIER_TTL_MS = 10 * 60 * 1000; // 10 phút (600.000 ms)

interface StoredVerifier {
  verifier: string;
  createdAt: number;
}

let inMemoryMap = new Map<string, StoredVerifier>();

function pruneExpired(map: Map<string, StoredVerifier>, now = Date.now()): void {
  for (const [key, value] of map.entries()) {
    if (now - value.createdAt > VERIFIER_TTL_MS) {
      map.delete(key);
    }
  }
}

function loadMap(): Map<string, StoredVerifier> {
  const map = new Map<string, StoredVerifier>(inMemoryMap);

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      // 1. Đọc dữ liệu từ key map mới
      const rawMap = window.sessionStorage.getItem(PKCE_MAP_STORAGE_KEY);
      if (rawMap) {
        const parsed = JSON.parse(rawMap) as Record<string, StoredVerifier>;
        for (const [key, val] of Object.entries(parsed)) {
          if (val && typeof val.verifier === 'string' && typeof val.createdAt === 'number') {
            map.set(key, val);
          }
        }
      }

      // 2. Tương thích ngược với key legacy đơn lẻ nếu có
      const legacyVerifier = window.sessionStorage.getItem(PKCE_LEGACY_STORAGE_KEY);
      if (legacyVerifier && !map.has('default')) {
        map.set('default', { verifier: legacyVerifier, createdAt: Date.now() });
      }
    } catch {
      // Bỏ qua lỗi parse
    }
  }

  pruneExpired(map);
  return map;
}

function saveMap(map: Map<string, StoredVerifier>): void {
  pruneExpired(map);
  inMemoryMap = map;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (map.size === 0) {
        window.sessionStorage.removeItem(PKCE_MAP_STORAGE_KEY);
        window.sessionStorage.removeItem(PKCE_LEGACY_STORAGE_KEY);
      } else {
        const obj: Record<string, StoredVerifier> = {};
        for (const [key, val] of map.entries()) {
          obj[key] = val;
        }
        window.sessionStorage.setItem(PKCE_MAP_STORAGE_KEY, JSON.stringify(obj));
        window.sessionStorage.removeItem(PKCE_LEGACY_STORAGE_KEY);
      }
    } catch {
      // Fallback in-memory
    }
  }
}

export const pkce = {
  /**
   * Sinh Code Verifier ngẫu nhiên bảo mật cao (RFC 7636)
   */
  generateCodeVerifier(length = 64): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[randomBytes[i] % charset.length];
    }
    return result;
  },

  /**
   * Sinh Session ID ngẫu nhiên cho mỗi lần bấm đăng nhập
   */
  generateSessionId(length = 8): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '').slice(0, length);
    }
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let res = '';
    for (let i = 0; i < length; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  },

  /**
   * Tính toán Code Challenge từ Code Verifier qua thuật toán S256 (SHA-256 Base64URL)
   */
  async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const base64 = btoa(String.fromCharCode(...hashArray));
    // Base64URL
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  /**
   * Lưu Code Verifier theo sessionId để hỗ trợ đa phiên đồng thời (chống đè verifier khi bấm thử lại)
   */
  saveVerifier(verifier: string, sessionId: string = 'default'): void {
    const map = loadMap();
    map.set(sessionId, { verifier, createdAt: Date.now() });
    saveMap(map);
  },

  /**
   * Lấy Code Verifier theo sessionId và xóa khỏi bộ nhớ tạm
   * Nếu không truyền sessionId:
   * 1. Tìm key 'default'
   * 2. Hoặc lấy entry duy nhất nếu map chỉ có 1 phần tử
   */
  getAndClearVerifier(sessionId?: string): string | null {
    const map = loadMap();

    if (sessionId) {
      const entry = map.get(sessionId);
      if (entry) {
        map.delete(sessionId);
        saveMap(map);
        return entry.verifier;
      }
      return null;
    }

    // Nếu không truyền sessionId
    if (map.has('default')) {
      const entry = map.get('default')!;
      map.delete('default');
      saveMap(map);
      return entry.verifier;
    }

    if (map.size === 1) {
      const [singleKey, entry] = Array.from(map.entries())[0];
      map.delete(singleKey);
      saveMap(map);
      return entry.verifier;
    }

    return null;
  },

  /**
   * Xóa toàn bộ verifiers (dùng cho test hoặc dọn dẹp)
   */
  clearAllVerifiers(): void {
    inMemoryMap.clear();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(PKCE_MAP_STORAGE_KEY);
        window.sessionStorage.removeItem(PKCE_LEGACY_STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  },
};
