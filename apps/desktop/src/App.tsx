import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BoCucUngDung } from './thanh-phan/bo-cuc/BoCucUngDung';
import { xacThucService } from './dich-vu/xac-thuc/xac-thuc.service';
import { queryClient } from './dich-vu/api/query-client';

export const App: React.FC = () => {
  useEffect(() => {
    xacThucService.init();
    return () => {
      xacThucService.destroy();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BoCucUngDung />
    </QueryClientProvider>
  );
};

export default App;
