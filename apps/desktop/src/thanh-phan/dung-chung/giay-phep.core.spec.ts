import { describe, expect, it } from 'vitest';
import { rutGonGiayPhep } from './giay-phep.core';

describe('rút gọn tên giấy phép', () => {
  it.each([
    ['GNU AFFERO GENERAL PUBLIC LICENSE V3.0', 'AGPL-3.0'],
    ['GNU GENERAL PUBLIC LICENSE V3.0', 'GPL-3.0'],
    ['GNU GENERAL PUBLIC LICENSE V2.0', 'GPL-2.0'],
    ['GNU LESSER GENERAL PUBLIC LICENSE V2.1', 'LGPL-2.1'],
    ['APACHE LICENSE 2.0', 'Apache-2.0'],
    ['THE UNLICENSE', 'Unlicense'],
    ['MIT LICENSE', 'MIT'],
    ['BSD 3-Clause License', 'BSD-3-Clause'],
    ['BSD 2-Clause License', 'BSD-2-Clause'],
    ['Mozilla Public License 2.0', 'MPL-2.0'],
  ])('đổi %s thành %s', (input, expected) => {
    expect(rutGonGiayPhep(input)).toBe(expected);
  });

  it('giữ tên giấy phép lạ để giao diện rút gọn bằng truncate', () => {
    expect(rutGonGiayPhep('Custom Community License')).toBe('Custom Community License');
  });
});
