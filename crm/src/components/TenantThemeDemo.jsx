import React from 'react';
import { useBranding } from '../providers/BrandingProvider';
import { useThemePreferences } from '../providers/ThemeProvider';

export const TenantThemeDemo = () => {
  const { branding } = useBranding();
  const { themeMode, uiAccentColor } = useThemePreferences();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-3">
        <img src={branding.logoUrl} alt="Logo da loja" className="h-10 w-10 rounded-md object-cover" />
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Branding runtime por loja</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Modo: <strong>{themeMode}</strong> · Accent UI: <span style={{ color: uiAccentColor }}>{uiAccentColor}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button className="rounded-md px-3 py-2 text-white bg-[color:var(--brand-primary)]">Botão principal (brandPrimary)</button>
        <button className="rounded-md px-3 py-2 text-white bg-[color:var(--brand-secondary)]">Botão secundário (brandSecondary)</button>
        <button className="rounded-md px-3 py-2 text-white bg-[color:var(--ui-accent)]">Botão UI pessoal (uiAccent)</button>
      </div>
    </section>
  );
};
