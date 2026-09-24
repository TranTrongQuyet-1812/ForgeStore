import { describe, expect, it } from 'vitest';
import { parseAxml } from './axml-parser.util';

describe('axml-parser.util (Android Binary XML Parser - P2-35.4)', () => {
  it('Trả về kết quả rỗng khi buffer rỗng hoặc quá ngắn', () => {
    const res = parseAxml(Buffer.alloc(4));
    expect(res.permissions).toEqual([]);
    expect(res.packageName).toBeUndefined();
    expect(res.coAccessibilityService).toBe(false);
  });

  it('Từ chối buffer không có magic header AXML 0x00080003', () => {
    const buf = Buffer.alloc(32);
    buf.writeUInt32LE(0x12345678, 0); // Sai magic
    const res = parseAxml(buf);
    expect(res.packageName).toBeUndefined();
    expect(res.permissions).toEqual([]);
  });

  it('Giải mã chính xác cấu trúc AXML chứa package và permissions', () => {
    // Xây dựng buffer AXML tối giản hợp lệ:
    // Header (8 bytes): type 0x00080003, size
    // StringPool chunk (type 0x0001)
    // Start Element manifest (type 0x0102) với attr package
    // Start Element uses-permission với attr name

    const strings = [
      'manifest',
      'package',
      'org.forgestore.testapp',
      'uses-permission',
      'name',
      'android.permission.INTERNET',
      'android.permission.READ_SMS',
      'android.permission.BIND_ACCESSIBILITY_SERVICE',
    ];

    // Tạo StringPool buffer (UTF-16LE)
    let strOffset = 0;
    const offsets: number[] = [];
    const strDataParts: Buffer[] = [];

    for (const s of strings) {
      offsets.push(strOffset);
      const strBuf = Buffer.alloc(2 + s.length * 2 + 2);
      strBuf.writeUInt16LE(s.length, 0);
      strBuf.write(s, 2, 'utf16le');
      strBuf.writeUInt16LE(0, 2 + s.length * 2);
      strDataParts.push(strBuf);
      strOffset += strBuf.length;
    }

    const allStrData = Buffer.concat(strDataParts);
    const poolHeaderSize = 28 + strings.length * 4;
    const poolChunkSize = poolHeaderSize + allStrData.length;
    const poolBuf = Buffer.alloc(poolHeaderSize);
    poolBuf.writeUInt16LE(0x0001, 0); // RES_STRING_POOL_TYPE
    poolBuf.writeUInt16LE(0x001c, 2); // header size
    poolBuf.writeUInt32LE(poolChunkSize, 4);
    poolBuf.writeUInt32LE(strings.length, 8); // string count
    poolBuf.writeUInt32LE(0, 12); // style count
    poolBuf.writeUInt32LE(0, 16); // flags (UTF-16LE)
    poolBuf.writeUInt32LE(poolHeaderSize, 20); // stringsStart

    for (let i = 0; i < strings.length; i++) {
      poolBuf.writeUInt32LE(offsets[i], 28 + i * 4);
    }
    const fullPoolChunk = Buffer.concat([poolBuf, allStrData]);

    // Tạo Element 1: manifest (package="org.forgestore.testapp")
    // chunk type 0x0102, headerSize 16, attrStart 20, attrSize 20, attrCount 1
    const elemManifest = Buffer.alloc(36 + 20);
    elemManifest.writeUInt16LE(0x0102, 0);
    elemManifest.writeUInt16LE(16, 2);
    elemManifest.writeUInt32LE(elemManifest.length, 4);
    elemManifest.writeUInt32LE(0, 20); // nameIdx: 0 ('manifest')
    elemManifest.writeUInt16LE(20, 24); // attrStart (offset tính từ sau 16 bytes header = 20)
    elemManifest.writeUInt16LE(20, 26); // attrSize
    elemManifest.writeUInt16LE(1, 28); // attrCount: 1

    // Attr package="org.forgestore.testapp"
    elemManifest.writeUInt32LE(1, 36 + 4); // attrNameIdx: 1 ('package')
    elemManifest.writeUInt32LE(2, 36 + 8); // attrRawValueIdx: 2 ('org.forgestore.testapp')

    // Tạo Element 2: uses-permission (name="android.permission.INTERNET")
    const elemPerm1 = Buffer.alloc(36 + 20);
    elemPerm1.writeUInt16LE(0x0102, 0);
    elemPerm1.writeUInt16LE(16, 2);
    elemPerm1.writeUInt32LE(elemPerm1.length, 4);
    elemPerm1.writeUInt32LE(3, 20); // nameIdx: 3 ('uses-permission')
    elemPerm1.writeUInt16LE(20, 24);
    elemPerm1.writeUInt16LE(20, 26);
    elemPerm1.writeUInt16LE(1, 28);
    elemPerm1.writeUInt32LE(4, 36 + 4); // attrNameIdx: 4 ('name')
    elemPerm1.writeUInt32LE(5, 36 + 8); // attrRawValueIdx: 5 ('android.permission.INTERNET')

    // Tạo Element 3: uses-permission (name="android.permission.READ_SMS")
    const elemPerm2 = Buffer.alloc(36 + 20);
    elemPerm2.writeUInt16LE(0x0102, 0);
    elemPerm2.writeUInt16LE(16, 2);
    elemPerm2.writeUInt32LE(elemPerm2.length, 4);
    elemPerm2.writeUInt32LE(3, 20);
    elemPerm2.writeUInt16LE(20, 24);
    elemPerm2.writeUInt16LE(20, 26);
    elemPerm2.writeUInt16LE(1, 28);
    elemPerm2.writeUInt32LE(4, 36 + 4);
    elemPerm2.writeUInt32LE(6, 36 + 8); // 'android.permission.READ_SMS'

    // Tạo Element 4: service với BIND_ACCESSIBILITY_SERVICE
    const elemService = Buffer.alloc(36 + 20);
    elemService.writeUInt16LE(0x0102, 0);
    elemService.writeUInt16LE(16, 2);
    elemService.writeUInt32LE(elemService.length, 4);
    elemService.writeUInt32LE(4, 20);
    elemService.writeUInt16LE(20, 24);
    elemService.writeUInt16LE(20, 26);
    elemService.writeUInt16LE(1, 28);
    elemService.writeUInt32LE(4, 36 + 4);
    elemService.writeUInt32LE(7, 36 + 8); // 'android.permission.BIND_ACCESSIBILITY_SERVICE'

    const totalPayload = Buffer.concat([
      fullPoolChunk,
      elemManifest,
      elemPerm1,
      elemPerm2,
      elemService,
    ]);

    const header = Buffer.alloc(8);
    header.writeUInt32LE(0x00080003, 0);
    header.writeUInt32LE(8 + totalPayload.length, 4);

    const fullAxmlBuffer = Buffer.concat([header, totalPayload]);

    const res = parseAxml(fullAxmlBuffer);

    expect(res.packageName).toBe('org.forgestore.testapp');
    expect(res.permissions).toContain('android.permission.INTERNET');
    expect(res.permissions).toContain('android.permission.READ_SMS');
    expect(res.coAccessibilityService).toBe(true);
  });
});
