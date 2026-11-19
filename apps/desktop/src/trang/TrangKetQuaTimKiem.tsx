import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, PackageOpen, RefreshCw, Search } from 'lucide-react';
import type { TimKiemResponseDto } from '@forgestore/types';
import { TheUngDung, type AppCardData } from '../thanh-phan/dung-chung/TheUngDung';
import { ThanhPhanTrang } from '../thanh-phan/dung-chung/ThanhPhanTrang';
import { AsciiReveal, KhungXuongCard } from '../thanh-phan/dung-chung/KhungXuongAscii';
import { useDieuHuongStore } from '../kho-trang-thai/useDieuHuongStore';
import { khoUngDungService } from '../dich-vu/kho-ung-dung/kho-ung-dung.service';
import {
  locUngDungTrongKho,
  SO_KET_QUA_MOI_TRANG_TIM_KIEM,
  taoDongPhuKetQuaTimKiem,
} from '../thanh-phan/tim-kiem/tien-ich-tim-kiem';

const KhungTuKhoaTrong: React.FC<{ onQuayLai: () => void }> = ({ onQuayLai }) => (
  <div className="p-12 rounded-2xl bg-surface border border-border flex flex-col items-center justify-center text-center gap-3">
    <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center text-muted">
      <Search className="w-6 h-6" />
    </div>
    <h2 className="text-sm font-bold text-primary">Nhập từ khóa để tìm ứng dụng</h2>
    <p className="text-xs text-muted max-w-md">
      Gõ tên ứng dụng, mô tả nhu cầu bằng tiếng Việt (ít nhất 2 ký tự), hoặc dán link GitHub vào ô
      tìm kiếm phía trên.
    </p>
    <button
      type="button"
      onClick={onQuayLai}
      className="btn-tactile mt-2 px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary text-xs font-semibold border border-border"
    >
      Quay lại Khám phá
    </button>
  </div>
);

const KhungLoiKetNoi: React.FC<{ onThuLai: () => void }> = ({ onThuLai }) => (
  <div className="p-8 rounded-2xl bg-surface border border-danger/20 flex flex-col items-center justify-center text-center gap-3">
    <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center text-danger">
      <AlertCircle className="w-5 h-5" />
    </div>
    <h2 className="text-sm font-bold text-primary">Không thể tải kết quả tìm kiếm</h2>
    <p className="text-xs text-muted max-w-md">Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.</p>
    <button
      type="button"
      onClick={onThuLai}
      className="btn-tactile mt-2 px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary text-xs font-semibold flex items-center gap-2 border border-border"
    >
      <RefreshCw className="w-3.5 h-3.5 text-accent-forge-text" />
      <span>Thử lại</span>
    </button>
  </div>
);

const KhungKhongCoKetQua: React.FC<{ tuKhoa: string; onQuayLai: () => void }> = ({
  tuKhoa,
  onQuayLai,
}) => (
  <div className="p-12 rounded-2xl bg-surface border border-border flex flex-col items-center justify-center text-center gap-3">
    <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center text-muted">
      <PackageOpen className="w-6 h-6" />
    </div>
    <h2 className="text-sm font-bold text-primary">
      Không tìm thấy ứng dụng nào khớp với “{tuKhoa}”
    </h2>
    <p className="text-xs text-muted max-w-md">
      Bạn có thể dán đường dẫn GitHub (vd: <code>user/repo</code>) vào ô tìm kiếm phía trên để cài
      đặt ngay.
    </p>
    <button
      type="button"
      onClick={onQuayLai}
      className="btn-tactile mt-2 px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-primary text-xs font-semibold border border-border"
    >
      Quay lại Khám phá
    </button>
  </div>
);

export const TrangKetQuaTimKiem: React.FC = () => {
  const queryClient = useQueryClient();
  const { searchQuery, trangTimKiem, setTrangTimKiem, navigateTo } = useDieuHuongStore();
  const dauDanhSachRef = useRef<HTMLDivElement>(null);
  const tuKhoa = searchQuery.trim();
  const tuKhoaTruocRef = useRef(tuKhoa);
  const hopLe = tuKhoa.length >= 2;

  // Khi đang ở trang kết quả mà gõ tìm từ khóa mới, cuộn lại đầu danh sách để người dùng thấy từ đầu.
  useEffect(() => {
    if (tuKhoaTruocRef.current !== tuKhoa) {
      tuKhoaTruocRef.current = tuKhoa;
      dauDanhSachRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [tuKhoa]);

  const taoTruyVan = useCallback(
    (trangSo: number) => ({
      queryKey: ['tim-kiem-trang', tuKhoa, trangSo] as const,
      queryFn: () =>
        khoUngDungService.timKiem(tuKhoa, 'WINDOWS', trangSo, SO_KET_QUA_MOI_TRANG_TIM_KIEM),
      staleTime: 1000 * 60 * 3,
    }),
    [tuKhoa],
  );

  const {
    data: ketQua,
    isLoading,
    isError,
    refetch,
    isPlaceholderData,
  } = useQuery<TimKiemResponseDto>({
    ...taoTruyVan(trangTimKiem),
    enabled: hopLe,
    placeholderData: (previousData) => previousData,
  });

  const tongSoTrang = ketQua?.tongSoTrang ?? 0;

  // Tải sẵn trang kế khi đang ở trang hợp lệ để chuyển trang mượt mà.
  useEffect(() => {
    if (!hopLe || isPlaceholderData || trangTimKiem >= tongSoTrang) return;
    void queryClient.prefetchQuery(taoTruyVan(trangTimKiem + 1));
  }, [hopLe, isPlaceholderData, trangTimKiem, tongSoTrang, queryClient, taoTruyVan]);

  const chuyenTrang = useCallback(
    (trangMoi: number) => {
      setTrangTimKiem(trangMoi);
      dauDanhSachRef.current?.scrollIntoView({ block: 'start' });
    },
    [setTrangTimKiem],
  );

  const quayVeKhamPha = useCallback(() => {
    navigateTo('explore');
  }, [navigateTo]);

  const theUngDung: AppCardData[] = useMemo(
    () =>
      locUngDungTrongKho(ketQua?.duLieu, ketQua?.nguonKetQua).map((dto) =>
        khoUngDungService.anhXaDtoSangTheUngDung(dto),
      ),
    [ketQua],
  );

  if (!hopLe) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-8 max-w-7xl mx-auto w-full select-none animate-fade-in">
        <KhungTuKhoaTrong onQuayLai={quayVeKhamPha} />
      </div>
    );
  }

  return (
    <div
      ref={dauDanhSachRef}
      className="scroll-mt-4 flex flex-col gap-6 p-6 md:p-8 max-w-7xl mx-auto w-full select-none animate-fade-in"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold font-display text-primary truncate">
            Kết quả cho “{tuKhoa}”
          </h1>
          {!isLoading && ketQua && (
            <p className="text-xs text-muted">{taoDongPhuKetQuaTimKiem(ketQua)}</p>
          )}
        </div>

        <button
          type="button"
          onClick={quayVeKhamPha}
          className="btn-tactile self-start sm:self-auto px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-secondary hover:text-primary text-xs font-semibold border border-border flex items-center gap-1.5 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại Khám phá</span>
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <KhungXuongCard key={i} index={i} variant="dither" />
          ))}
        </div>
      ) : isError && !ketQua ? (
        <KhungLoiKetNoi onThuLai={() => void refetch()} />
      ) : theUngDung.length === 0 ? (
        <KhungKhongCoKetQua tuKhoa={tuKhoa} onQuayLai={quayVeKhamPha} />
      ) : (
        <>
          <div
            className={`transition-opacity duration-150 ${isPlaceholderData ? 'opacity-60' : ''}`}
          >
            <AsciiReveal
              preset="dither"
              duration="fast"
              origin="top-left"
              key={`${tuKhoa}-${ketQua?.trangHienTai ?? trangTimKiem}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {theUngDung.map((app, index) => (
                  <TheUngDung key={app.id} app={app} staggerIndex={index} />
                ))}
              </div>
            </AsciiReveal>
          </div>

          {tongSoTrang > 1 && (
            <ThanhPhanTrang
              trangHienTai={ketQua?.trangHienTai ?? trangTimKiem}
              tongSoTrang={tongSoTrang}
              tongSo={ketQua?.tongSo ?? theUngDung.length}
              kichThuocTrang={ketQua?.kichThuocTrang ?? SO_KET_QUA_MOI_TRANG_TIM_KIEM}
              dangTai={isPlaceholderData}
              onChuyenTrang={chuyenTrang}
            />
          )}

          {isError && (
            <p className="text-center text-xs text-danger">
              Không tải được trang này.{' '}
              <button type="button" onClick={() => void refetch()} className="underline">
                Thử lại
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
};
