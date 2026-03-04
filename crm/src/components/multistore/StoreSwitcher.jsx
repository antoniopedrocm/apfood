import React from 'react';
import { useStoreContext } from '../../contexts/StoreContext';

export function StoreSwitcher() {
  const { allowedStores, activeStoreId, setActiveStoreId } = useStoreContext();

  if (!allowedStores?.length || allowedStores.length === 1) {
    return null;
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm">
      <span className="font-medium text-slate-700">Loja ativa</span>
      <select
        aria-label="Alternar loja ativa"
        className="rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={activeStoreId || ''}
        onChange={(event) => setActiveStoreId(event.target.value)}
      >
        {allowedStores.map((storeId) => (
          <option key={storeId} value={storeId}>{storeId}</option>
        ))}
      </select>
    </label>
  );
}
