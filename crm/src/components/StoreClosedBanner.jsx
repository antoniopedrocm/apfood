import React from 'react';

export const StoreClosedBanner = ({ message }) => (
  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    <strong className="font-semibold">Loja fechada no momento.</strong>
    {message ? <span className="ml-1">{message}</span> : null}
  </div>
);
