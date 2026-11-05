import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { isTauri } from '../../dich-vu/xac-thuc/luu-tru-token';

/** Trình quản lý gói Desktop tự kiểm được (P3B-16.8): phổ biến nhất trên Windows và có lệnh liệt kê rõ ràng. */
const TRINH_KIEM_DUOC = ['winget', 'npm'];

interface NhanDaCaiTrenMayProps {
  trinhQuanLy?: string;
  tenGoi?: string;
}

/**
 * Nhãn "Đã cài trên máy này" cho cách cài dòng lệnh (P3B-16.8): hỏi chính winget hoặc npm trên máy.
 * Không kiểm được (trình khác, máy chưa có winget/Node.js, chạy ngoài Tauri) thì không hiện gì.
 */
export const NhanDaCaiTrenMay: React.FC<NhanDaCaiTrenMayProps> = ({ trinhQuanLy, tenGoi }) => {
  const coTheKiem = Boolean(
    trinhQuanLy && tenGoi && TRINH_KIEM_DUOC.includes(trinhQuanLy) && isTauri(),
  );
  const { data: daCai } = useQuery({
    queryKey: ['goi-da-cai', trinhQuanLy, tenGoi],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<boolean | null>('kiem_tra_goi_da_cai', { trinhQuanLy, tenGoi });
    },
    enabled: coTheKiem,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  if (daCai !== true) return null;
  return (
    <span
      role="status"
      className="text-[10px] font-medium px-2 py-0.5 rounded bg-success/10 border border-success/30 text-success"
    >
      Đã cài trên máy này
    </span>
  );
};
