import React, { createContext, useContext, useMemo, useState } from 'react';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [allowedStores, setAllowedStores] = useState([]);
  const [activeStoreId, setActiveStoreId] = useState(null);
  const [viewMode, setViewMode] = useState('store');

  const syncFromSession = (session) => {
    const stores = session?.allowedStores || [];
    setAllowedStores(stores);
    setViewMode(session?.viewMode || 'store');
    setActiveStoreId((current) => (current && stores.includes(current) ? current : (stores[0] || null)));
  };

  const value = useMemo(() => ({
    allowedStores,
    activeStoreId,
    setActiveStoreId,
    viewMode,
    setViewMode,
    syncFromSession,
  }), [allowedStores, activeStoreId, viewMode]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStoreContext() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStoreContext deve ser usado dentro de StoreProvider.');
  }
  return context;
}
