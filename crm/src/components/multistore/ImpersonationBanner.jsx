import React from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { useStoreContext } from '../../contexts/StoreContext';

export function ImpersonationBanner() {
  const { actor, subject, stopImpersonation } = useSession();
  const { activeStoreId } = useStoreContext();

  if (!actor || !subject) {
    return null;
  }

  return (
    <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 shadow-sm" role="status" aria-live="polite">
      <p className="text-sm">
        <strong>Emulando:</strong> {subject.name || subject.email} ({subject.role}) — loja atual: {activeStoreId || 'nenhuma'}
      </p>
      <button
        type="button"
        onClick={stopImpersonation}
        className="rounded bg-amber-600 px-3 py-1 text-sm font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-600"
        aria-label="Voltar para minha conta"
      >
        Voltar para minha conta
      </button>
    </div>
  );
}
