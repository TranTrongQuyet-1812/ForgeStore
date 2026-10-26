import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './thanh-phan/layout/AppLayout';
import { authService } from './dich-vu/auth/auth-service';
import { queryClient } from './dich-vu/api/query-client';

export const App: React.FC = () => {
  useEffect(() => {
    authService.init();
    return () => {
      authService.destroy();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout />
    </QueryClientProvider>
  );
};

export default App;
