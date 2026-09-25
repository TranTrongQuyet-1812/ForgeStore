/**
 * Tiện ích PKCE (Proof Key for Code Exchange - RFC 7636) cho ForgeStore Client.
 *
 * Tiêu chuẩn:
 * 1. Code Verifier: Chuỗi ngẫu nhiên 43 - 128 ký tự gồm [A-Z, a-z, 0-9, -, ., _, ~]
 * 2. Code Challenge: SHA-256 của Code Verifier, mã hóa Base64URL (bỏ padding '=', thay '+' bằng '-', '/' bằng '_').
 */

const PKCE_VERIFIER_STORAGE_KEY = 'forgestore_pkce_verifier';

let inMemoryVerifier: string | null = null;

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
   * Lưu Code Verifier tạm thời trong lúc chờ trình duyệt xác thực GitHub
   */
  saveVerifier(verifier: string): void {
    inMemoryVerifier = verifier;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
      } catch {
        // Fallback in-memory
      }
    }
  },

  /**
   * Lấy Code Verifier đã lưu và xóa sạch khỏi bộ nhớ tạm
   */
  getAndClearVerifier(): string | null {
    let verifier = inMemoryVerifier;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = window.sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY);
        if (stored) {
          verifier = stored;
          window.sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
        }
      } catch {
        // Ignore
      }
    }
    inMemoryVerifier = null;
    return verifier;
  },
};
