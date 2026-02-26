import React, { useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DEFAULT_OPERACAO } from '../utils/storeAvailability';

const DAYS = [
  ['mon', 'Segunda'],
  ['tue', 'Terça'],
  ['wed', 'Quarta'],
  ['thu', 'Quinta'],
  ['fri', 'Sexta'],
  ['sat', 'Sábado'],
  ['sun', 'Domingo'],
];

const normalizeConfig = (storeConfig) => {
  const source = storeConfig?.storeAvailability || storeConfig?.operacao || storeConfig || {};
  return {
    ...DEFAULT_OPERACAO,
    ...source,
    schedule: {
      ...DEFAULT_OPERACAO.schedule,
      ...(source.schedule || {}),
    },
    manualOverride: {
      ...DEFAULT_OPERACAO.manualOverride,
      ...(source.manualOverride || {}),
    },
  };
};

export const StoreOperatingHoursPanel = ({ storeId, currentStoreConfig, user }) => {
  const canEdit = useMemo(() => ['ADMIN', 'MANAGER', 'dono', 'gerente', 'owner', 'manager'].includes(user?.role), [user]);
  const [form, setForm] = useState(() => normalizeConfig(currentStoreConfig));
  const [saving, setSaving] = useState(false);

  const updateDay = (day, key, value) => {
    setForm((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...(prev.schedule?.[day] || {}),
          [key]: value,
        },
      },
    }));
  };

  const setOverrideMode = (mode) => {
    setForm((prev) => ({
      ...prev,
      manualOverride: {
        ...prev.manualOverride,
        mode,
      },
    }));
  };

  const save = async () => {
    if (!canEdit || !storeId) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        manualOverride: {
          ...form.manualOverride,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || user?.auth?.uid || null,
        },
      };

      await setDoc(
        doc(db, 'lojas', storeId),
        {
          storeAvailability: payload,
          operacao: payload,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || user?.auth?.uid || null,
        },
        { merge: true }
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Horário de funcionamento</h3>
      </div>

      <div className="mb-3">
        <label className="text-sm font-medium">Fuso horário</label>
        <input
          className="mt-1 w-full rounded border p-2"
          value={form.timezone || 'America/Sao_Paulo'}
          onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
        />
      </div>

      <div className="mb-4 rounded border p-3">
        <p className="mb-2 text-sm font-medium text-slate-700">Status da loja (override manual)</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOverrideMode('auto')} className={`rounded px-3 py-2 text-sm ${form.manualOverride.mode === 'auto' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Automático</button>
          <button type="button" onClick={() => setOverrideMode('force_open')} className={`rounded px-3 py-2 text-sm ${form.manualOverride.mode === 'force_open' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'}`}>Abrir agora</button>
          <button type="button" onClick={() => setOverrideMode('force_closed')} className={`rounded px-3 py-2 text-sm ${form.manualOverride.mode === 'force_closed' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800'}`}>Fechar agora</button>
        </div>
      </div>

      <div className="space-y-3">
        {DAYS.map(([key, label]) => {
          const day = form.schedule?.[key] || { enabled: false, open: '08:00', close: '18:00' };
          return (
            <div key={key} className="rounded border p-3">
              <div className="mb-2 flex items-center justify-between">
                <strong>{label}</strong>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(day.enabled)} onChange={(e) => updateDay(key, 'enabled', e.target.checked)} />
                  Aberto neste dia
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input type="time" value={day.open || '08:00'} onChange={(e) => updateDay(key, 'open', e.target.value)} className="rounded border p-1" disabled={!day.enabled} />
                <span>até</span>
                <input type="time" value={day.close || '18:00'} onChange={(e) => updateDay(key, 'close', e.target.value)} className="rounded border p-1" disabled={!day.enabled} />
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" disabled={!canEdit || saving} onClick={save} className="mt-4 rounded bg-pink-600 px-4 py-2 text-white disabled:opacity-60">
        {saving ? 'Salvando...' : 'Salvar horário'}
      </button>
    </section>
  );
};
