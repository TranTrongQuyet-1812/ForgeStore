import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { pkce, VERIFIER_TTL_MS } from './pkce';

describe('PKCE Utility (P3-04.3 & Mục 68 - Multi-Session Map RFC 7636)', () => {
  beforeEach(() => {
    pkce.clearAllVerifiers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sinh Code Verifier đúng độ dài và ký tự cho phép', () => {
    const verifier = pkce.generateCodeVerifier(64);
    expect(verifier).toHaveLength(64);
    // Ký tự cho phép theo RFC 7636: [A-Z, a-z, 0-9, -, ., _, ~]
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
  });

  it('sinh Session ID ngẫu nhiên đúng độ dài mặc định', () => {
    const sessionId = pkce.generateSessionId();
    expect(sessionId).toHaveLength(8);
    expect(sessionId).toMatch(/^[a-z0-9]+$/i);
  });

  it('sinh Code Challenge chuẩn S256 (Base64URL, không chứa +, /, =)', async () => {
    const testVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await pkce.generateCodeChallenge(testVerifier);

    expect(challenge).toBeDefined();
    expect(challenge.length).toBeGreaterThan(0);
    // Không chứa padding '=' hoặc ký tự base64 thông thường '+', '/'
    expect(challenge).not.toContain('=');
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('lưu và lấy Code Verifier theo sessionId độc lập không bị đè (Multi-Session Isolation)', () => {
    const sessionA = 'sess-tab-a';
    const verifierA = 'verifier-content-a-1111';

    const sessionB = 'sess-tab-b';
    const verifierB = 'verifier-content-b-2222';

    // Người dùng mở Tab A trước, sau đó bấm Thử lại mở tiếp Tab B
    pkce.saveVerifier(verifierA, sessionA);
    pkce.saveVerifier(verifierB, sessionB);

    // Lấy verifier của Tab A trước: Tab A phải trả về đúng verifierA
    const retrievedA = pkce.getAndClearVerifier(sessionA);
    expect(retrievedA).toBe(verifierA);

    // Tab A lấy xong thì bị xóa, gọi lại phải null
    expect(pkce.getAndClearVerifier(sessionA)).toBeNull();

    // Verifier của Tab B vẫn còn nguyên vẹn, không bị xóa hay đè
    const retrievedB = pkce.getAndClearVerifier(sessionB);
    expect(retrievedB).toBe(verifierB);

    // Tab B lấy xong cũng bị xóa
    expect(pkce.getAndClearVerifier(sessionB)).toBeNull();
  });

  it('tự động dọn dẹp verifier đã quá thời hạn 10 phút (TTL Pruning)', () => {
    vi.useFakeTimers();

    const sessionOld = 'sess-expired';
    const verifierOld = 'old-verifier-data';
    pkce.saveVerifier(verifierOld, sessionOld);

    // Tua thời gian tới 10 phút 1 giây sau
    vi.advanceTimersByTime(VERIFIER_TTL_MS + 1000);

    // Verifier đã quá hạn 10 phút phải bị dọn dẹp và trả về null
    const retrieved = pkce.getAndClearVerifier(sessionOld);
    expect(retrieved).toBeNull();
  });

  it('lưu và lấy không truyền sessionId (tương thích ngược)', () => {
    const verifier = 'test-verifier-string-12345';
    pkce.saveVerifier(verifier);

    const retrieved = pkce.getAndClearVerifier();
    expect(retrieved).toBe(verifier);

    // Lần gọi thứ 2 phải trả về null vì đã bị xóa để chống replay
    expect(pkce.getAndClearVerifier()).toBeNull();
  });
});
