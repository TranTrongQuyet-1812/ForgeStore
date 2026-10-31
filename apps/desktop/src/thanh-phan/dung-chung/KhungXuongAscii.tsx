import React from 'react';
import { AsciiSkeleton } from 'ascii-reveal';

interface KhungXuongCardProps {
  index?: number;
  variant?: 'scan' | 'dither' | 'terminal' | 'braille';
}

/**
 * Skeleton thẻ ứng dụng dạng ma trận ký tự ASCII (dựa trên quanhoangindex/ascii-reveal)
 * Giữ nguyên cấu trúc kích thước chuẩn của TheUngDung (CLS = 0)
 */
export const KhungXuongCard: React.FC<KhungXuongCardProps> = ({
  index = 0,
  variant = 'dither',
}) => {
  return (
    <div
      className="tactile-card flex flex-col justify-between p-4 rounded-xl min-h-[170px] select-none text-muted font-mono"
      aria-hidden="true"
    >
      <div className="flex items-start gap-3.5">
        {/* Khối icon ứng dụng */}
        <div className="w-12 h-12 rounded-xl border border-border/50 bg-surface flex items-center justify-center overflow-hidden shrink-0">
          <AsciiSkeleton
            rows={3}
            width="100%"
            height="100%"
            variant={variant}
            seed={index * 13 + 1}
          />
        </div>

        {/* Tên ứng dụng + thông số repo */}
        <div className="flex-1 flex flex-col gap-2 pt-0.5 min-w-0">
          <AsciiSkeleton lines={1} widths={['65%']} variant={variant} seed={index * 13 + 2} />
          <AsciiSkeleton lines={1} widths={['90%']} variant={variant} seed={index * 13 + 3} />
        </div>
      </div>

      {/* Dòng khẩu hiệu / mô tả tóm tắt */}
      <div className="mt-4">
        <AsciiSkeleton lines={1} widths={['100%']} variant={variant} seed={index * 13 + 4} />
      </div>

      {/* Thanh footer: Tags & Nút cài đặt giả lập */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40">
        <AsciiSkeleton lines={1} widths={['55px']} variant={variant} seed={index * 13 + 5} />
        <AsciiSkeleton lines={1} widths={['75px']} variant={variant} seed={index * 13 + 6} />
      </div>
    </div>
  );
};

/**
 * Skeleton cho Banner Spotlight tương tác trên Trang Khám Phá
 */
export const KhungXuongSpotlight: React.FC<{
  variant?: 'scan' | 'dither' | 'terminal' | 'braille';
}> = ({ variant = 'dither' }) => {
  return (
    <section
      className="surface-card rounded-2xl p-6 md:p-8 border border-border min-h-[220px] flex flex-col justify-between select-none text-muted font-mono"
      aria-hidden="true"
    >
      {/* Hàng tabs chế độ */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <AsciiSkeleton lines={1} widths={['260px']} variant={variant} seed={101} />
        <AsciiSkeleton lines={1} widths={['140px']} variant={variant} seed={102} />
      </div>

      {/* Nội dung spotlight: Icon lớn + Tiêu đề + Trích dẫn */}
      <div className="flex items-start gap-5 my-3">
        <div className="w-16 h-16 rounded-2xl border border-border/50 bg-surface flex items-center justify-center overflow-hidden shrink-0">
          <AsciiSkeleton rows={4} width="100%" height="100%" variant={variant} seed={103} />
        </div>
        <div className="flex-1 flex flex-col gap-2.5">
          <AsciiSkeleton lines={1} widths={['35%']} variant={variant} seed={104} />
          <AsciiSkeleton lines={2} widths={['85%', '60%']} variant={variant} seed={105} />
        </div>
      </div>

      {/* Hàng nút hành động dưới cùng */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <AsciiSkeleton lines={1} widths={['180px']} variant={variant} seed={106} />
        <AsciiSkeleton lines={1} widths={['120px']} variant={variant} seed={107} />
      </div>
    </section>
  );
};

export { AsciiSkeleton };
