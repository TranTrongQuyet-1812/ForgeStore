import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BoCucUngDung } from './thanh-phan/bo-cuc/BoCucUngDung';
import { xacThucService } from './dich-vu/xac-thuc/xac-thuc.service';
import { queryClient } from './dich-vu/api/query-client';
import { khoiDongTuCapNhat } from './dich-vu/tu-cap-nhat/tu-cap-nhat.service';

export const App: React.FC = () => {
  useEffect(() => {
    xacThucService.init();
    const tatLichCapNhat = khoiDongTuCapNhat();
    return () => {
      xacThucService.destroy();
      tatLichCapNhat();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BoCucUngDung />
    </QueryClientProvider>
  );
};

export default App;
