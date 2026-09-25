import { describe, it, expect } from 'vitest';
import { pkce } from './pkce';

describe('PKCE Utility (P3-04.3 - RFC 7636)', () => {
  it('sinh Code Verifier đúng độ dài và ký tự cho phép', () => {
    const verifier = pkce.generateCodeVerifier(64);
    expect(verifier).toHaveLength(64);
    // Ký tự cho phép theo RFC 7636: [A-Z, a-z, 0-9, -, ., _, ~]
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
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

  it('lưu và lấy Code Verifier an toàn (lấy xong tự xóa)', () => {
    const verifier = 'test-verifier-string-12345';
    pkce.saveVerifier(verifier);

    const retrieved = pkce.getAndClearVerifier();
    expect(retrieved).toBe(verifier);

    // Lần gọi thứ 2 phải trả về null vì đã bị xóa để chống replay
    expect(pkce.getAndClearVerifier()).toBeNull();
  });
});
