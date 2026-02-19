import React from 'react';
import { BrandingProvider } from '../providers/BrandingProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import { useTenantStore } from '../tenant/useTenantStore';

export const TenantAppShell = ({ user, children }) => {
  const { loading, storeId, notFound, error } = useTenantStore();

  if (loading) {
    return <div className="p-6 text-slate-600">Carregando loja...</div>;
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-700">
        <div>
          <h1 className="mb-2 text-xl font-semibold">Loja não encontrada</h1>
          <p className="text-sm text-slate-500">Verifique o subdomínio da URL.</p>
          {error ? <p className="mt-2 text-xs text-red-500">{error.message}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <BrandingProvider storeId={storeId}>
      <ThemeProvider user={user}>{children}</ThemeProvider>
    </BrandingProvider>
  );
};
