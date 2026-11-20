import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Info, PackageOpen, RefreshCw, Search } from 'lucide-react';
import type { TimKiemResponseDto, UngDungTomTatDto } from '@forgestore/types';
import { TheUngDung } from '../thanh-phan/dung-chung/TheUngDung';
import { ThanhPhanTrang } from '../thanh-phan/dung-chung/ThanhPhanTrang';
import { AsciiReveal, KhungXuongCard } from '../thanh-phan/dung-chung/KhungXuongAscii';
import { TheRepoGithub } from '../thanh-phan/tim-kiem/TheRepoGithub';
import { useDieuHuongStore } from '../kho-trang-thai/useDieuHuongStore';
import { khoUngDungService } from '../dich-vu/kho-ung-dung/kho-ung-dung.service';
import { useKiemDinhRepo } from '../hooks/useKiemDinhRepo';
import {
  laKetQuaTrongKho,
  layDuongDanKiemDinhRepo,
  nenHienPhanGithub,
  SO_KET_QUA_MOI_TRANG_GITHUB,
  SO_KET_QUA_MOI_TRANG_TIM_KIEM,
  THOI_GIAN_CACHE_GITHUB_MS,
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

const KhungLoiKetNoi: React.FC<{ tieuDe?: string; onThuLai: () => void }> = ({
  tieuDe = 'Không thể tải kết quả tìm kiếm',
  onThuLai,
}) => (
  <div className="p-8 rounded-2xl bg-surface border border-danger/20 flex flex-col items-center justify-center text-center gap-3">
    <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center text-danger">
      <AlertCircle className="w-5 h-5" />
    </div>
    <h2 className="text-sm font-bold text-primary">{tieuDe}</h2>
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

interface PhanKetQuaTrongKhoProps {
  tuKhoa: string;
  ketQua: TimKiemResponseDto;
  trangHienTai: number;
  isPlaceholderData: boolean;
  isError: boolean;
  onChuyenTrang: (trangMoi: number) => void;
  onThuLai: () => void;
}

const PhanKetQuaTrongKho: React.FC<PhanKetQuaTrongKhoProps> = ({
  tuKhoa,
  ketQua,
  trangHienTai,
  isPlaceholderData,
  isError,
  onChuyenTrang,
  onThuLai,
}) => {
  const tongSoTrang = ketQua.tongSoTrang ?? 0;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold font-display text-primary">Trong ForgeStore</h2>
      </div>

      {ketQua.duLieu.length === 0 ? (
        <p className="text-xs text-muted py-2">
          Chưa có ứng dụng nào trong ForgeStore khớp với “{tuKhoa}”.
        </p>
      ) : (
        <>
          <div
            className={`transition-opacity duration-150 ${isPlaceholderData ? 'opacity-60' : ''}`}
          >
            <AsciiReveal
              preset="dither"
              duration="fast"
              origin="top-left"
              key={`csdl-${tuKhoa}-${ketQua.trangHienTai ?? trangHienTai}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ketQua.duLieu.map((dto, index) => (
                  <TheUngDung
                    key={dto.maUngDung}
                    app={khoUngDungService.anhXaDtoSangTheUngDung(dto)}
                    staggerIndex={index}
                  />
                ))}
              </div>
            </AsciiReveal>
          </div>

          {tongSoTrang > 1 && (
            <ThanhPhanTrang
              trangHienTai={ketQua.trangHienTai ?? trangHienTai}
              tongSoTrang={tongSoTrang}
              tongSo={ketQua.tongSo ?? ketQua.duLieu.length}
              kichThuocTrang={ketQua.kichThuocTrang ?? SO_KET_QUA_MOI_TRANG_TIM_KIEM}
              dangTai={isPlaceholderData}
              onChuyenTrang={onChuyenTrang}
            />
          )}

          {isError && (
            <p className="text-center text-xs text-danger">
              Không tải được trang này.{' '}
              <button type="button" onClick={onThuLai} className="underline">
                Thử lại
              </button>
            </p>
          )}
        </>
      )}
    </section>
  );
};

interface TrangThaiKiemDinhThe {
  repoDangChonUrl: string | null;
  dangKiemDinh: boolean;
  daThanhCong: boolean;
  loiKiemDinh: string | null;
  onKiemDinh: (duongDan: string) => void;
}

function renderTheRepoGithub(dto: UngDungTomTatDto, index: number, kiemDinh: TrangThaiKiemDinhThe) {
  const duongDanMuc = layDuongDanKiemDinhRepo(dto);
  const laMucDangChon = kiemDinh.repoDangChonUrl === duongDanMuc;
  return (
    <TheRepoGithub
      key={dto.maUngDung || dto.tenRepoDayDu}
      repo={dto}
      staggerIndex={index}
      dangKiemDinh={kiemDinh.dangKiemDinh && laMucDangChon}
      voHieuHoa={kiemDinh.dangKiemDinh || kiemDinh.daThanhCong}
      thanhCong={laMucDangChon && kiemDinh.daThanhCong}
      loiKiemDinh={laMucDangChon ? kiemDinh.loiKiemDinh : null}
      onKiemDinh={kiemDinh.onKiemDinh}
    />
  );
}

interface PhanKetQuaGithubProps {
  tuKhoa: string;
  ketQua: TimKiemResponseDto | undefined;
  trangHienTai: number;
  isLoading: boolean;
  isError: boolean;
  isPlaceholderData: boolean;
  trangThaiKiemDinh: TrangThaiKiemDinhThe;
  dauPhanRef: React.RefObject<HTMLDivElement | null>;
  onChuyenTrang: (trangMoi: number) => void;
  onThuLai: () => void;
}

const PhanKetQuaGithub: React.FC<PhanKetQuaGithubProps> = ({
  tuKhoa,
  ketQua,
  trangHienTai,
  isLoading,
  isError,
  isPlaceholderData,
  trangThaiKiemDinh,
  dauPhanRef,
  onChuyenTrang,
  onThuLai,
}) => {
  const tongSoTrang = ketQua?.tongSoTrang ?? 0;

  return (
    <section
      ref={dauPhanRef}
      className="scroll-mt-4 flex flex-col gap-4 pt-6 border-t border-border/60"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold font-display text-primary">
          Từ GitHub, chưa có trong ForgeStore
        </h2>
        <p className="text-xs text-muted">
          Bấm vào để ForgeStore kiểm tra và thêm vào kho. Cần đăng nhập.
        </p>
      </div>

      {ketQua?.thongDiep && (
        <div className="p-3 rounded-xl bg-surface border border-border text-xs text-secondary flex items-center gap-2">
          <Info className="w-4 h-4 text-accent-forge-text shrink-0" />
          <span>{ketQua.thongDiep}</span>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <KhungXuongCard key={i} index={i} variant="dither" />
          ))}
        </div>
      ) : isError && !ketQua ? (
        <KhungLoiKetNoi tieuDe="Không thể tải kết quả từ GitHub" onThuLai={onThuLai} />
      ) : ketQua && ketQua.duLieu.length === 0 ? (
        !ketQua.thongDiep && (
          <p className="text-xs text-muted py-2">Không có thêm kho mã nguồn phù hợp trên GitHub.</p>
        )
      ) : ketQua ? (
        <>
          <div
            className={`transition-opacity duration-150 ${isPlaceholderData ? 'opacity-60' : ''}`}
          >
            <AsciiReveal
              preset="dither"
              duration="fast"
              origin="top-left"
              key={`github-${tuKhoa}-${ketQua.trangHienTai ?? trangHienTai}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ketQua.duLieu.map((dto, index) =>
                  renderTheRepoGithub(dto, index, trangThaiKiemDinh),
                )}
              </div>
            </AsciiReveal>
          </div>

          {tongSoTrang > 1 && (
            <ThanhPhanTrang
              trangHienTai={ketQua.trangHienTai ?? trangHienTai}
              tongSoTrang={tongSoTrang}
              tongSo={ketQua.tongSo ?? ketQua.duLieu.length}
              kichThuocTrang={ketQua.kichThuocTrang ?? SO_KET_QUA_MOI_TRANG_GITHUB}
              dangTai={isPlaceholderData}
              onChuyenTrang={onChuyenTrang}
            />
          )}

          {isError && (
            <p className="text-center text-xs text-danger">
              Không tải được trang GitHub này.{' '}
              <button type="button" onClick={onThuLai} className="underline">
                Thử lại
              </button>
            </p>
          )}
        </>
      ) : null}
    </section>
  );
};

const DanhSachKetQuaYDinh: React.FC<{
  tuKhoa: string;
  ketQua: TimKiemResponseDto;
  trangThaiKiemDinh: TrangThaiKiemDinhThe;
  onQuayLai: () => void;
}> = ({ tuKhoa, ketQua, trangThaiKiemDinh, onQuayLai }) => {
  if (ketQua.duLieu.length === 0) {
    return <KhungKhongCoKetQua tuKhoa={tuKhoa} onQuayLai={onQuayLai} />;
  }

  return (
    <AsciiReveal preset="dither" duration="fast" origin="top-left" key={`ydinh-${tuKhoa}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {ketQua.duLieu.map((dto, index) =>
          laKetQuaTrongKho(dto, ketQua.nguonKetQua) ? (
            <TheUngDung
              key={dto.maUngDung}
              app={khoUngDungService.anhXaDtoSangTheUngDung(dto)}
              staggerIndex={index}
            />
          ) : (
            renderTheRepoGithub(dto, index, trangThaiKiemDinh)
          ),
        )}
      </div>
    </AsciiReveal>
  );
};

export const TrangKetQuaTimKiem: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    searchQuery,
    trangTimKiem,
    trangTimKiemGithub,
    setTrangTimKiem,
    setTrangTimKiemGithub,
    navigateTo,
    openAppDetail,
  } = useDieuHuongStore();

  const dauDanhSachRef = useRef<HTMLDivElement>(null);
  const dauPhanGithubRef = useRef<HTMLDivElement>(null);
  const tuKhoa = searchQuery.trim();
  const tuKhoaTruocRef = useRef(tuKhoa);
  const trangGithubTruocRef = useRef(trangTimKiemGithub);
  const hopLe = tuKhoa.length >= 2;
  const [repoDangChonUrl, setRepoDangChonUrl] = useState<string | null>(null);

  const { dangKiemDinh, loiKiemDinh, ketQuaThanhCong, kiemDinh, xoaTrangThai } = useKiemDinhRepo({
    khiThanhCong: (ungDung) => openAppDetail(ungDung.tenRepoDayDu || ungDung.maUngDung),
  });

  // Đổi từ khóa hoặc sang trang GitHub mới thì cuộn/xóa trạng thái kiểm định thẻ cũ.
  useEffect(() => {
    const doiTuKhoa = tuKhoaTruocRef.current !== tuKhoa;
    const doiTrangGithub = trangGithubTruocRef.current !== trangTimKiemGithub;
    if (doiTuKhoa || doiTrangGithub) {
      tuKhoaTruocRef.current = tuKhoa;
      trangGithubTruocRef.current = trangTimKiemGithub;
      setRepoDangChonUrl(null);
      xoaTrangThai();
      if (doiTuKhoa) {
        dauDanhSachRef.current?.scrollIntoView({ block: 'start' });
      }
    }
  }, [tuKhoa, trangTimKiemGithub, xoaTrangThai]);

  const taoTruyVanKho = useCallback(
    (trangSo: number) => ({
      queryKey: ['tim-kiem-trang', tuKhoa, trangSo, 'CSDL'] as const,
      queryFn: () =>
        khoUngDungService.timKiem(
          tuKhoa,
          'WINDOWS',
          trangSo,
          SO_KET_QUA_MOI_TRANG_TIM_KIEM,
          'CSDL',
        ),
      staleTime: 1000 * 60 * 3,
    }),
    [tuKhoa],
  );

  const {
    data: ketQuaKho,
    isLoading: isLoadingKho,
    isError: isErrorKho,
    refetch: refetchKho,
    isPlaceholderData: isPlaceholderKho,
  } = useQuery<TimKiemResponseDto>({
    ...taoTruyVanKho(trangTimKiem),
    enabled: hopLe,
    placeholderData: (previousData) => previousData,
  });

  const tongSoTrangKho = ketQuaKho?.tongSoTrang ?? 0;
  const laLuongTen = ketQuaKho?.loaiTruyVan === 'TEN_APP';

  // Chỉ tải sẵn trang kế cho Phần 1 (CSDL); Phần 2 (GitHub) tuyệt đối không prefetch để tiết kiệm hạn mức.
  useEffect(() => {
    if (!hopLe || !laLuongTen || isPlaceholderKho || trangTimKiem >= tongSoTrangKho) return;
    void queryClient.prefetchQuery(taoTruyVanKho(trangTimKiem + 1));
  }, [
    hopLe,
    laLuongTen,
    isPlaceholderKho,
    trangTimKiem,
    tongSoTrangKho,
    queryClient,
    taoTruyVanKho,
  ]);

  const hienPhanGithub = nenHienPhanGithub(hopLe, ketQuaKho);

  const {
    data: ketQuaGithub,
    isLoading: isLoadingGithub,
    isError: isErrorGithub,
    refetch: refetchGithub,
    isPlaceholderData: isPlaceholderGithub,
  } = useQuery<TimKiemResponseDto>({
    queryKey: ['tim-kiem-trang-github', tuKhoa, trangTimKiemGithub] as const,
    queryFn: () =>
      khoUngDungService.timKiem(
        tuKhoa,
        'WINDOWS',
        trangTimKiemGithub,
        SO_KET_QUA_MOI_TRANG_GITHUB,
        'GITHUB',
      ),
    enabled: hienPhanGithub,
    staleTime: THOI_GIAN_CACHE_GITHUB_MS,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  const chuyenTrangKho = useCallback(
    (trangMoi: number) => {
      setTrangTimKiem(trangMoi);
      dauDanhSachRef.current?.scrollIntoView({ block: 'start' });
    },
    [setTrangTimKiem],
  );

  const chuyenTrangGithub = useCallback(
    (trangMoi: number) => {
      setTrangTimKiemGithub(trangMoi);
      dauPhanGithubRef.current?.scrollIntoView({ block: 'start' });
    },
    [setTrangTimKiemGithub],
  );

  const quayVeKhamPha = useCallback(() => {
    navigateTo('explore');
  }, [navigateTo]);

  const batDauKiemDinhThe = useCallback(
    (duongDan: string) => {
      setRepoDangChonUrl(duongDan);
      void kiemDinh(duongDan);
    },
    [kiemDinh],
  );

  const trangThaiKiemDinh: TrangThaiKiemDinhThe = {
    repoDangChonUrl,
    dangKiemDinh,
    daThanhCong: ketQuaThanhCong !== null,
    loiKiemDinh,
    onKiemDinh: batDauKiemDinhThe,
  };

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
          {!isLoadingKho && ketQuaKho && (
            <>
              {laLuongTen ? (
                ketQuaKho.tongSo > 0 && (
                  <p className="text-xs text-muted">
                    Tìm thấy {ketQuaKho.tongSo} ứng dụng trong ForgeStore
                  </p>
                )
              ) : (
                <p className="text-xs text-muted">Các kết quả phù hợp nhất</p>
              )}
            </>
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

      {isLoadingKho ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <KhungXuongCard key={i} index={i} variant="dither" />
          ))}
        </div>
      ) : isErrorKho && !ketQuaKho ? (
        <KhungLoiKetNoi onThuLai={() => void refetchKho()} />
      ) : ketQuaKho ? (
        laLuongTen ? (
          <>
            <PhanKetQuaTrongKho
              tuKhoa={tuKhoa}
              ketQua={ketQuaKho}
              trangHienTai={trangTimKiem}
              isPlaceholderData={isPlaceholderKho}
              isError={isErrorKho}
              onChuyenTrang={chuyenTrangKho}
              onThuLai={() => void refetchKho()}
            />

            {hienPhanGithub && (
              <PhanKetQuaGithub
                tuKhoa={tuKhoa}
                ketQua={ketQuaGithub}
                trangHienTai={trangTimKiemGithub}
                isLoading={isLoadingGithub}
                isError={isErrorGithub}
                isPlaceholderData={isPlaceholderGithub}
                trangThaiKiemDinh={trangThaiKiemDinh}
                dauPhanRef={dauPhanGithubRef}
                onChuyenTrang={chuyenTrangGithub}
                onThuLai={() => void refetchGithub()}
              />
            )}
          </>
        ) : (
          <DanhSachKetQuaYDinh
            tuKhoa={tuKhoa}
            ketQua={ketQuaKho}
            trangThaiKiemDinh={trangThaiKiemDinh}
            onQuayLai={quayVeKhamPha}
          />
        )
      ) : null}
    </div>
  );
};
