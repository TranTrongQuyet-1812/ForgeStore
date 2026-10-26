/**
 * Bộ giải mã tệp Android Binary XML (AXML Parser) thuần TypeScript (P2-35.4).
 * Giải mã AndroidManifest.xml nhị phân trong APK để bóc tách:
 * - Package Name (phục vụ D-13)
 * - uses-permission (danh sách quyền Android)
 * - Cờ nhận diện BIND_ACCESSIBILITY_SERVICE
 */

export interface KetQuaAxml {
  packageName?: string;
  permissions: string[];
  coAccessibilityService: boolean;
}

export function parseAxml(buffer: Buffer): KetQuaAxml {
  const result: KetQuaAxml = {
    permissions: [],
    coAccessibilityService: false,
  };

  if (!buffer || buffer.length < 8) {
    return result;
  }

  // 1. Kiểm tra Header AXML: chunk type 0x00080003
  const fileType = buffer.readUInt32LE(0);
  if (fileType !== 0x00080003) {
    // Không phải AXML hợp lệ
    return result;
  }

  let offset = 8;
  const stringPool: string[] = [];

  // 2. Đọc các chunks
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.readUInt16LE(offset);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkSize <= 0 || offset + chunkSize > buffer.length) {
      break;
    }

    if (chunkType === 0x0001) {
      // Khối danh sách chuỗi (STRING POOL CHUNK)
      docStringPool(buffer, offset, stringPool);
    } else if (chunkType === 0x0102) {
      // Khối thẻ mở START_TAG (XML_ELEMENT)
      docStartElement(buffer, offset, stringPool, result);
    }

    offset += chunkSize;
  }

  return result;
}

function docStringPool(buffer: Buffer, offset: number, stringPool: string[]): void {
  const stringCount = buffer.readUInt32LE(offset + 8);
  const flags = buffer.readUInt32LE(offset + 16);
  const isUtf8 = (flags & (1 << 8)) !== 0;
  const stringsStart = offset + buffer.readUInt32LE(offset + 20);

  const stringOffsets: number[] = [];
  for (let i = 0; i < stringCount; i++) {
    stringOffsets.push(buffer.readUInt32LE(offset + 28 + i * 4));
  }

  for (let i = 0; i < stringCount; i++) {
    const offsetVal = stringOffsets[i] ?? 0;
    const strOffset = stringsStart + offsetVal;
    if (strOffset >= buffer.length) {
      stringPool.push('');
      continue;
    }

    if (isUtf8) {
      // Chuỗi UTF-8: 1 byte độ dài, theo sau là các byte dữ liệu và byte null
      let cur = strOffset;
      const b0 = buffer[cur] ?? 0;
      if (b0 & 0x80) cur += 2;
      else cur += 1;
      const b1 = buffer[cur] ?? 0;
      const b2 = buffer[cur + 1] ?? 0;
      const len = b1 & 0x80 ? ((b1 & 0x7f) << 8) | b2 : b1;
      cur += b1 & 0x80 ? 2 : 1;

      const strBytes = buffer.subarray(cur, cur + len);
      stringPool.push(strBytes.toString('utf8'));
    } else {
      // Chuỗi UTF-16LE: 2 byte độ dài, theo sau là các ký tự 2 byte, kết thúc bởi 0x0000
      let cur = strOffset;
      const charCount = buffer.readUInt16LE(cur);
      cur += 2;
      const byteLen = charCount * 2;
      const strBytes = buffer.subarray(cur, cur + byteLen);
      stringPool.push(strBytes.toString('utf16le'));
    }
  }
}

function docStartElement(
  buffer: Buffer,
  offset: number,
  stringPool: string[],
  result: KetQuaAxml,
): void {
  if (offset + 36 > buffer.length) return;

  const nameIdx = buffer.readUInt32LE(offset + 20);
  const attrStart = buffer.readUInt16LE(offset + 24);
  const attrSize = buffer.readUInt16LE(offset + 26);
  const attrCount = buffer.readUInt16LE(offset + 28);

  const tagName = stringPool[nameIdx] || '';

  // attrStart được tính từ sau 16 bytes header của chunk RES_XML_START_ELEMENT_TYPE
  let attrOffset = offset + 16 + attrStart;
  for (let i = 0; i < attrCount; i++) {
    if (attrOffset + 20 > buffer.length) break;

    const attrNameIdx = buffer.readUInt32LE(attrOffset + 4);
    const attrRawValueIdx = buffer.readInt32LE(attrOffset + 8);
    const attrName = stringPool[attrNameIdx] || '';
    let attrVal = attrRawValueIdx >= 0 ? stringPool[attrRawValueIdx] || '' : '';

    // Nếu attrRawValueIdx không có, đọc từ typed_value
    if (!attrVal) {
      const dataType = buffer.readUInt8(attrOffset + 15);
      const data = buffer.readUInt32LE(attrOffset + 16);
      if (dataType === 0x03) {
        // Kiểu dữ liệu chuỗi (TYPE_STRING)
        attrVal = stringPool[data] || '';
      }
    }

    if (tagName === 'manifest' && attrName === 'package' && attrVal) {
      result.packageName = attrVal;
    }

    if (tagName === 'uses-permission' && (attrName === 'name' || attrName.endsWith(':name'))) {
      if (attrVal && !result.permissions.includes(attrVal)) {
        result.permissions.push(attrVal);
      }
    }

    if (attrVal === 'android.permission.BIND_ACCESSIBILITY_SERVICE') {
      result.coAccessibilityService = true;
    }

    attrOffset += attrSize;
  }
}
