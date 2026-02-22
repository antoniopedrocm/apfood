import React from 'react';

export const StoreClosedBanner = ({ status, className = '' }) => {
  if (!status || status.isOpen) return null;

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 ${className}`} role="alert">
      <p className="font-semibold">Loja fechada no momento</p>
      <p className="text-sm">{status.message || 'Tente novamente mais tarde.'}</p>
    </div>
  );
};
