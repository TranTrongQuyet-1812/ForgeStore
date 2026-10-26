import React from 'react';
import { Compass, LayoutGrid, Library, Heart, Settings } from 'lucide-react';
import { useNavStore, NavTab } from '../../kho-trang-thai/useDieuHuongStore';
import { useUpdaterStore } from '../../kho-trang-thai/useCapNhatStore';

interface NavGroup {
  groupName: string;
  items: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: 'KHÁM PHÁ',
    items: [
      { id: 'explore', label: 'Khám phá Store', icon: Compass },
      { id: 'categories', label: 'Danh mục', icon: LayoutGrid },
    ],
  },
  {
    groupName: 'BỘ SƯU TẬP',
    items: [
      { id: 'library', label: 'Thư viện máy', icon: Library },
      { id: 'favorites', label: 'Kho yêu thích', icon: Heart },
    ],
  },
  {
    groupName: 'HỆ THỐNG',
    items: [{ id: 'settings', label: 'Cài đặt', icon: Settings }],
  },
];

export const Sidebar: React.FC = () => {
  const { currentTab, navigateTo } = useNavStore();
  const { soLuongBanCapNhat } = useUpdaterStore();

  return (
    <aside className="w-[260px] min-w-[260px] h-full bg-surface border-r border-border flex flex-col justify-between select-none transition-colors duration-200 shadow-sm z-30">
      {/* 1. Đỉnh Sidebar: Khối Thương Hiệu Hero Brand to bản & bề thế */}
      <div
        data-tauri-drag-region
        className="h-16 px-4 flex items-center border-b border-border shrink-0 cursor-default"
      >
        <button
          onClick={() => navigateTo('explore')}
          title="Về trang Khám phá"
          className="flex items-center gap-3.5 text-left group focus:outline-none"
        >
          <div className="w-11 h-11 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center p-2 shadow-md shadow-black/5 dark:shadow-black/40 group-hover:border-accent-forge/40 group-hover:shadow-[0_0_14px_rgba(249,115,22,0.2)] transition-all duration-200 shrink-0">
            <img
              src="/logo.png"
              alt="ForgeStore Logo"
              className="w-full h-full object-contain drop-shadow"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-display font-black text-lg text-primary tracking-tight leading-none group-hover:text-accent-forge transition-colors">
              ForgeStore
            </span>
            <span className="text-[10px] font-mono tracking-wider text-muted uppercase font-semibold flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-forge shrink-0 shadow-[0_0_6px_rgba(249,115,22,0.7)]" />
              <span>Kho Mã Nguồn Mở</span>
            </span>
          </div>
        </button>
      </div>

      {/* 2. Vùng menu điều hướng phân lớp chuyên nghiệp */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupName} className="flex flex-col gap-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted font-mono mb-1">
              {group.groupName}
            </div>
            <nav className="flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                const hasUpdateBadge = item.id === 'library' && soLuongBanCapNhat > 0;

                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    className={`group relative overflow-hidden w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 outline-none ${
                      isActive
                        ? 'bg-surface-elevated text-primary font-bold shadow-xs border border-border'
                        : 'text-secondary hover:text-primary hover:bg-surface-hover'
                    }`}
                  >
                    {/* Vạch chỉ thị màu cam mảnh 3px bo tròn mép trái kèm ánh glow */}
                    {isActive && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 bg-accent-forge rounded-r shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                    )}

                    <div className={`flex items-center gap-2.5 ${isActive ? 'pl-1.5' : ''}`}>
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-accent-forge' : 'text-muted'}`}
                        strokeWidth={isActive ? 2.25 : 1.75}
                      />
                      <span>{item.label}</span>
                    </div>

                    {hasUpdateBadge && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-accent-forge/20 text-accent-forge border border-accent-forge/30 font-mono font-bold shadow-xs animate-pulse">
                        {soLuongBanCapNhat}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* 3. Chân Sidebar: Widget trạng thái hệ thống mini */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="p-2.5 rounded-xl bg-surface-elevated border border-border flex items-center justify-between text-[11px] font-mono text-muted">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-secondary font-medium">v0.1.0 • FOSS</span>
          </div>
          <span className="text-[10px] text-muted font-medium">Desktop</span>
        </div>
      </div>
    </aside>
  );
};
