import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { authService } from './services/auth/auth-service';
import { queryClient } from './services/api/query-client';

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
