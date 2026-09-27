import React from 'react';
import { Compass, LayoutGrid, Library, Heart, Settings } from 'lucide-react';
import { useNavStore, NavTab } from '../../stores/useNavStore';
import { useUpdaterStore } from '../../stores/useUpdaterStore';

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
    <aside className="w-[240px] min-w-[240px] h-full bg-surface border-r border-border/80 flex flex-col justify-between p-3 select-none transition-colors duration-200 shadow-sm">
      {/* Vùng trên: Các nhóm điều hướng phân lớp rõ ràng */}
      <div className="flex flex-col gap-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupName} className="flex flex-col gap-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
              {group.groupName}
            </div>
            <nav className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                const hasUpdateBadge = item.id === 'library' && soLuongBanCapNhat > 0;

                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-accent-forge outline-none ${
                      isActive
                        ? 'bg-surface-elevated text-accent-forge font-semibold shadow-xs border border-border/60'
                        : 'text-secondary hover:text-primary hover:bg-surface-elevated/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-accent-forge' : 'text-muted'}`}
                        strokeWidth={isActive ? 2 : 1.75}
                      />
                      <span>{item.label}</span>
                    </div>

                    {hasUpdateBadge && (
                      <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-accent-forge text-white font-mono font-bold shadow-xs animate-pulse">
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
    </aside>
  );
};
