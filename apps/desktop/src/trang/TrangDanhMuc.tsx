import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutGrid,
  Code,
  Film,
  Shield,
  Wrench,
  FileText,
  Gamepad2,
  Radio,
  GraduationCap,
  Sparkles,
  ArrowRight,
  PackageOpen,
} from 'lucide-react';
import { useDieuHuongStore } from '../kho-trang-thai/useDieuHuongStore';
import { khoUngDungService } from '../dich-vu/kho-ung-dung/kho-ung-dung.service';
import { AsciiSkeleton, AsciiReveal } from '../thanh-phan/dung-chung/KhungXuongAscii';

// Mọi danh mục dùng chung một màu nhấn để giao diện gọn, không rực rỡ nhiều màu.
const MAU_DANH_MUC = 'text-accent-forge-text bg-accent-forge/10 border-accent-forge/20';

const CATEGORY_META: Record<
  string,
  {
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  AI: {
    desc: 'Trợ lý AI, mô hình chạy trên máy và công cụ hỗ trợ lập trình',
    icon: Sparkles,
    color: MAU_DANH_MUC,
  },
  'Lập trình & Phát triển': {
    desc: 'IDE, Text Editor, Git Tools, Terminal, Dev Environments',
    icon: Code,
    color: MAU_DANH_MUC,
  },
  'Tiện ích hệ thống': {
    desc: 'Điều khiển từ xa, tối ưu hệ điều hành, giải nén, clipboard',
    icon: Wrench,
    color: MAU_DANH_MUC,
  },
  'Đa phương tiện': {
    desc: 'Trình phát video, nghe nhạc, ghi hình màn hình, biên tập',
    icon: Film,
    color: MAU_DANH_MUC,
  },
  'Bảo mật & Quyền riêng tư': {
    desc: 'Quản lý mật khẩu, VPN mã hóa, 2FA authenticator, che chắn',
    icon: Shield,
    color: MAU_DANH_MUC,
  },
  'Năng suất & Văn phòng': {
    desc: 'Ghi chú Second Brain, Markdown, PDF reader, bảng tính',
    icon: FileText,
    color: MAU_DANH_MUC,
  },
  'Mạng & Giao tiếp': {
    desc: 'Trình duyệt bảo mật, chat P2P, truyền tệp LAN, torrent',
    icon: Radio,
    color: MAU_DANH_MUC,
  },
  'Học tập & Giáo dục': {
    desc: 'Phần mềm toán học, học ngoại ngữ, tra cứu mã nguồn, flashcard',
    icon: GraduationCap,
    color: MAU_DANH_MUC,
  },
  'Trò chơi & Giải trí': {
    desc: 'Game indie, game engine FOSS, retro emulator, minigames',
    icon: Gamepad2,
    color: MAU_DANH_MUC,
  },
};

export const TrangDanhMuc: React.FC = () => {
  const { openCategory } = useDieuHuongStore();

  // Nạp danh mục động từ Backend có app khả dụng trên Windows (K3)
  const { data: serverCategories = [], isLoading } = useQuery({
    queryKey: ['store-categories', 'windows'],
    queryFn: () => khoUngDungService.layDanhSachDanhMuc('windows'),
    staleTime: 1000 * 60 * 5,
  });

  const displayedCategories = useMemo(() => {
    return serverCategories.map((c) => {
      const meta = CATEGORY_META[c.ten] || {
        desc: 'Kho ứng dụng mã nguồn mở chất lượng cao',
        icon: LayoutGrid,
        color: 'text-primary bg-surface-elevated border-border',
      };
      return {
        name: c.ten,
        desc: meta.desc,
        count: `${c.soLuong} ứng dụng`,
        icon: meta.icon,
        color: meta.color,
      };
    });
  }, [serverCategories]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full select-none">
      {/* Tiêu đề trang */}
      <div className="border-b border-border/60 pb-4">
        <h1 className="text-xl font-bold font-display text-primary flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-accent-ai" />
          <span>Danh Mục Ứng Dụng Chuyên Sâu</span>
        </h1>
        <p className="text-xs text-muted mt-1">
          Duyệt kho ứng dụng mã nguồn mở được tuyển chọn và thẩm định an toàn theo lĩnh vực
        </p>
      </div>

      {/* Lưới danh mục CSDL sống động theo nền tảng (K3) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="tactile-card p-5 rounded-2xl flex flex-col justify-between min-h-[160px] select-none text-muted font-mono"
            >
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl border border-border/50 bg-surface flex items-center justify-center overflow-hidden">
                  <AsciiSkeleton
                    rows={3}
                    width="100%"
                    height="100%"
                    variant="dither"
                    seed={i * 7 + 1}
                  />
                </div>
                <AsciiSkeleton lines={1} widths={['48px']} variant="dither" seed={i * 7 + 2} />
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <AsciiSkeleton lines={1} widths={['75%']} variant="dither" seed={i * 7 + 3} />
                <AsciiSkeleton lines={1} widths={['95%']} variant="dither" seed={i * 7 + 4} />
              </div>
            </div>
          ))}
        </div>
      ) : displayedCategories.length > 0 ? (
        <AsciiReveal preset="dither" duration="fast" origin="top-left">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.name}
                  onClick={() => openCategory(cat.name)}
                  tabIndex={0}
                  data-ascii="surface"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openCategory(cat.name);
                    }
                  }}
                  className="tactile-card p-5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[160px] group focus-visible:ring-2 focus-visible:ring-accent-forge outline-none"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center border ${cat.color} group-hover:scale-105 transition-transform duration-200 shadow-sm`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-elevated text-muted text-[11px] font-mono font-medium border border-border/50">
                      {cat.count}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold font-display text-primary group-hover:text-accent-forge-text transition-colors line-clamp-1">
                        {cat.name}
                      </h3>
                      <ArrowRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-[11px] text-secondary mt-1 line-clamp-2 leading-relaxed font-normal">
                      {cat.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </AsciiReveal>
      ) : (
        <div className="tactile-card p-12 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
          <PackageOpen className="w-10 h-10 text-muted" />
          <h3 className="text-base font-bold font-display text-primary">
            Chưa có danh mục nào trên nền tảng này
          </h3>
          <p className="text-xs text-muted max-w-md">
            Hiện tại các ứng dụng đang được kiểm định và đồng bộ, vui lòng quay lại sau.
          </p>
        </div>
      )}
    </div>
  );
};
