import React, { useEffect } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { useStoreContext } from '../../contexts/StoreContext';
import { StoreSwitcher } from './StoreSwitcher';
import { ImpersonationBanner } from './ImpersonationBanner';
import { AdminImpersonationPanel } from './AdminImpersonationPanel';

export function MultiStoreShell() {
  const { fetchSession, impersonationToken } = useSession();
  const { syncFromSession } = useStoreContext();

  useEffect(() => {
    const hydrate = async () => {
      try {
        const idToken = window.localStorage.getItem('apfood_id_token');
        if (!idToken) return;
        const session = await fetchSession(idToken, impersonationToken);
        syncFromSession(session);
      } catch (error) {
        // sessão multi-loja opcional em ambiente sem backend configurado
      }
    };

    hydrate();
  }, [fetchSession, impersonationToken, syncFromSession]);

  return (
    <div className="sticky top-0 z-40 bg-slate-100/90 px-3 pt-3 backdrop-blur">
      <AdminImpersonationPanel />
      <ImpersonationBanner />
      <StoreSwitcher />
    </div>
  );
}
