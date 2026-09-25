import React from 'react';
import { Compass, LayoutGrid, Library, Heart, Settings, Server, ShieldCheck } from 'lucide-react';
import { useNavStore, NavTab } from '../../stores/useNavStore';

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { id: 'explore', label: 'Khám phá', icon: Compass },
  { id: 'categories', label: 'Danh mục', icon: LayoutGrid },
  { id: 'library', label: 'Thư viện máy', icon: Library },
  { id: 'favorites', label: 'Kho yêu thích', icon: Heart },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { currentTab, navigateTo } = useNavStore();

  return (
    <aside className="w-[240px] min-w-[240px] h-full bg-surface border-r border-border flex flex-col justify-between p-3 select-none transition-colors duration-200">
      {/* Vùng trên: Danh sách các mục điều hướng */}
      <div className="flex flex-col gap-1">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted font-display">
          Menu chính
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-surface-elevated text-accent-forge font-semibold shadow-sm'
                    : 'text-secondary hover:text-primary hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${isActive ? 'text-accent-forge' : 'text-muted'}`}
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-accent-forge/15 text-accent-forge font-mono font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Vùng dưới: Thẻ thông tin trạng thái Backend & Dual-AI */}
      <div className="flex flex-col gap-2 pt-3 border-t border-border">
        <div className="p-2.5 rounded-lg bg-surface-elevated/70 border border-border/60 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-secondary">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>Backend API</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-secondary">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-ai" />
              <span>Dual-AI Jev + Gemini</span>
            </div>
            <span className="text-[10px] font-mono text-accent-ai font-medium">Sẵn sàng</span>
          </div>
        </div>

        <div className="px-2 text-[10px] text-muted flex items-center justify-between">
          <span>ForgeStore Desktop</span>
          <span className="font-mono">v0.1.0-alpha</span>
        </div>
      </div>
    </aside>
  );
};
