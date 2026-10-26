import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './useSettingsStore';

describe('P3B-18 & D-27: useSettingsStore - Terminal & Portable Settings', () => {
  beforeEach(() => {
    // Reset state before each test
    useSettingsStore.setState({
      thuMucPortable: '',
      trinhTerminal: 'windows-terminal',
      thuMucLamViecTerminal: '',
    });
  });

  it('khởi tạo với giá trị mặc định chính xác (D-27)', () => {
    const state = useSettingsStore.getState();
    expect(state.trinhTerminal).toBe('windows-terminal');
    expect(state.thuMucLamViecTerminal).toBe('');
    expect(state.thuMucPortable).toBe('');
  });

  it('setTrinhTerminal cho phép chuyển đổi giữa windows-terminal, powershell và cmd', () => {
    const { setTrinhTerminal } = useSettingsStore.getState();

    setTrinhTerminal('powershell');
    expect(useSettingsStore.getState().trinhTerminal).toBe('powershell');

    setTrinhTerminal('cmd');
    expect(useSettingsStore.getState().trinhTerminal).toBe('cmd');

    setTrinhTerminal('windows-terminal');
    expect(useSettingsStore.getState().trinhTerminal).toBe('windows-terminal');
  });

  it('setThuMucLamViecTerminal lưu đường dẫn đã trim', () => {
    const { setThuMucLamViecTerminal } = useSettingsStore.getState();

    setThuMucLamViecTerminal('  D:\\Projects\\ForgeApps  ');
    expect(useSettingsStore.getState().thuMucLamViecTerminal).toBe('D:\\Projects\\ForgeApps');
  });

  it('datLaiMacDinhTerminal khôi phục về chuỗi rỗng (%USERPROFILE%)', () => {
    const { setThuMucLamViecTerminal, datLaiMacDinhTerminal } = useSettingsStore.getState();

    setThuMucLamViecTerminal('D:\\CustomDir');
    expect(useSettingsStore.getState().thuMucLamViecTerminal).toBe('D:\\CustomDir');

    datLaiMacDinhTerminal();
    expect(useSettingsStore.getState().thuMucLamViecTerminal).toBe('');
  });

  it('quản lý thư mục Portable .zip hoạt động độc lập', () => {
    const { setThuMucPortable, datLaiMacDinh } = useSettingsStore.getState();

    setThuMucPortable('E:\\PortableApps');
    expect(useSettingsStore.getState().thuMucPortable).toBe('E:\\PortableApps');

    datLaiMacDinh();
    expect(useSettingsStore.getState().thuMucPortable).toBe('');
  });
});
