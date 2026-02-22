import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useBranding } from '../providers/BrandingProvider';
import { useThemePreferences } from '../providers/ThemeProvider';
import { functions } from '../firebaseConfig';
import { StoreClosedBanner } from './StoreClosedBanner';
import { StoreOperatingHoursPanel } from './StoreOperatingHoursPanel';

export const TenantThemeDemo = ({ user }) => {
  const { branding, storeId, operacao, availabilityStatus } = useBranding();
  const { themeMode, uiAccentColor } = useThemePreferences();
  const [checkoutMessage, setCheckoutMessage] = useState('');

  const validateStoreOpen = () => {
    if (!availabilityStatus?.isOpen) {
      const msg = `Loja fechada no momento. ${availabilityStatus?.message || ''}`.trim();
      setCheckoutMessage(msg);
      return false;
    }
    return true;
  };

  const handleFinalizeOrder = async () => {
    if (!validateStoreOpen()) return;
    setCheckoutMessage('Loja aberta: pode seguir para confirmar pedido.');
  };

  const handleConfirmOrder = async () => {
    if (!validateStoreOpen()) return;

    try {
      const createOrder = httpsCallable(functions, 'createOrder');
      await createOrder({
        storeId,
        order: {
          origem: 'Plataforma',
          status: 'Pendente',
          itens: [{ nome: 'Pedido de teste', quantidade: 1, valor: 1 }],
          total: 1,
        },
      });
      setCheckoutMessage('Pedido criado com sucesso.');
    } catch (error) {
      setCheckoutMessage(error?.message || 'Falha ao criar pedido.');
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-3">
        <img src={branding.logoUrl} alt="Logo da loja" className="h-10 w-10 rounded-md object-cover" />
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Branding runtime por loja</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Modo: <strong>{themeMode}</strong> · Accent UI: <span style={{ color: uiAccentColor }}>{uiAccentColor}</span>
          </p>
        </div>
      </div>

      <StoreClosedBanner status={availabilityStatus} />

      <div className="grid gap-2 sm:grid-cols-3">
        <button className="rounded-md px-3 py-2 text-white bg-[color:var(--brand-primary)]">Botão principal</button>
        <button className="rounded-md px-3 py-2 text-white bg-[color:var(--brand-secondary)]" onClick={handleFinalizeOrder}>Finalizar Pedido</button>
        <button className="rounded-md px-3 py-2 text-white bg-[color:var(--ui-accent)]" onClick={handleConfirmOrder}>Confirmar Pedido</button>
      </div>

      {checkoutMessage ? <p className="text-sm text-slate-600">{checkoutMessage}</p> : null}

      <StoreOperatingHoursPanel storeId={storeId} currentOperacao={operacao} user={user} />
    </section>
  );
};
