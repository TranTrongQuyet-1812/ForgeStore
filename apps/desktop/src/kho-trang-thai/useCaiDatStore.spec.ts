import { describe, it, expect, beforeEach } from 'vitest';
import { useCaiDatStore } from './useCaiDatStore';

describe('P3B-18 & D-27: useCaiDatStore - Terminal & Portable Settings', () => {
  beforeEach(() => {
    // Reset state before each test
    useCaiDatStore.setState({
      thuMucPortable: '',
      trinhTerminal: 'windows-terminal',
      thuMucLamViecTerminal: '',
    });
  });

  it('khởi tạo với giá trị mặc định chính xác (D-27)', () => {
    const state = useCaiDatStore.getState();
    expect(state.trinhTerminal).toBe('windows-terminal');
    expect(state.thuMucLamViecTerminal).toBe('');
    expect(state.thuMucPortable).toBe('');
  });

  it('setTrinhTerminal cho phép chuyển đổi giữa windows-terminal, powershell và cmd', () => {
    const { setTrinhTerminal } = useCaiDatStore.getState();

    setTrinhTerminal('powershell');
    expect(useCaiDatStore.getState().trinhTerminal).toBe('powershell');

    setTrinhTerminal('cmd');
    expect(useCaiDatStore.getState().trinhTerminal).toBe('cmd');

    setTrinhTerminal('windows-terminal');
    expect(useCaiDatStore.getState().trinhTerminal).toBe('windows-terminal');
  });

  it('setThuMucLamViecTerminal lưu đường dẫn đã trim', () => {
    const { setThuMucLamViecTerminal } = useCaiDatStore.getState();

    setThuMucLamViecTerminal('  D:\\Projects\\ForgeApps  ');
    expect(useCaiDatStore.getState().thuMucLamViecTerminal).toBe('D:\\Projects\\ForgeApps');
  });

  it('datLaiMacDinhTerminal khôi phục về chuỗi rỗng (%USERPROFILE%)', () => {
    const { setThuMucLamViecTerminal, datLaiMacDinhTerminal } = useCaiDatStore.getState();

    setThuMucLamViecTerminal('D:\\CustomDir');
    expect(useCaiDatStore.getState().thuMucLamViecTerminal).toBe('D:\\CustomDir');

    datLaiMacDinhTerminal();
    expect(useCaiDatStore.getState().thuMucLamViecTerminal).toBe('');
  });

  it('quản lý thư mục Portable .zip hoạt động độc lập', () => {
    const { setThuMucPortable, datLaiMacDinh } = useCaiDatStore.getState();

    setThuMucPortable('E:\\PortableApps');
    expect(useCaiDatStore.getState().thuMucPortable).toBe('E:\\PortableApps');

    datLaiMacDinh();
    expect(useCaiDatStore.getState().thuMucPortable).toBe('');
  });
});
