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

const cloneOperacao = (operacao) => ({
  ...DEFAULT_OPERACAO,
  ...(operacao || {}),
  schedule: {
    ...DEFAULT_OPERACAO.schedule,
    ...(operacao?.schedule || {}),
    weekly: {
      ...DEFAULT_OPERACAO.schedule.weekly,
      ...(operacao?.schedule?.weekly || {}),
    },
  },
  override: {
    ...DEFAULT_OPERACAO.override,
    ...(operacao?.override || {}),
  },
});

export const StoreOperatingHoursPanel = ({ storeId, currentOperacao, user }) => {
  const canEdit = useMemo(() => ['ADMIN', 'MANAGER', 'dono', 'gerente'].includes(user?.role), [user]);
  const [form, setForm] = useState(() => cloneOperacao(currentOperacao));
  const [saving, setSaving] = useState(false);

  const updateRange = (day, index, key, value) => {
    setForm((prev) => {
      const weekly = { ...prev.schedule.weekly };
      const ranges = [...(weekly[day] || [])];
      ranges[index] = { ...ranges[index], [key]: value };
      weekly[day] = ranges;
      return { ...prev, schedule: { ...prev.schedule, weekly } };
    });
  };

  const save = async () => {
    if (!canEdit || !storeId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'stores', storeId), {
        operacao: form,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null,
      }, { merge: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Disponibilidade da loja</h3>
        <label className="inline-flex items-center gap-2 text-sm">
          <span>Ativo</span>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setForm((prev) => ({ ...prev, manualOpen: !prev.manualOpen }))}
            className={`relative h-6 w-11 rounded-full transition ${form.manualOpen ? 'bg-green-500' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${form.manualOpen ? 'left-5' : 'left-0.5'}`} />
          </button>
        </label>
      </div>

      <div className="mb-3">
        <label className="text-sm font-medium">Timezone</label>
        <input className="mt-1 w-full rounded border p-2" value={form.schedule.timezone} onChange={(e) => setForm((p) => ({ ...p, schedule: { ...p.schedule, timezone: e.target.value } }))} />
      </div>

      <div className="space-y-3">
        {DAYS.map(([key, label]) => (
          <div key={key} className="rounded border p-3">
            <div className="mb-2 flex items-center justify-between">
              <strong>{label}</strong>
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, schedule: { ...prev.schedule, weekly: { ...prev.schedule.weekly, [key]: [...(prev.schedule.weekly[key] || []), { start: '08:00', end: '18:00' }] } } }))} className="text-sm text-pink-600">+ faixa</button>
            </div>
            {(form.schedule.weekly[key] || []).map((range, index) => (
              <div key={`${key}-${index}`} className="mb-2 flex items-center gap-2">
                <input type="time" value={range.start} onChange={(e) => updateRange(key, index, 'start', e.target.value)} className="rounded border p-1" />
                <span>até</span>
                <input type="time" value={range.end} onChange={(e) => updateRange(key, index, 'end', e.target.value)} className="rounded border p-1" />
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, schedule: { ...prev.schedule, weekly: { ...prev.schedule.weekly, [key]: (prev.schedule.weekly[key] || []).filter((_, i) => i !== index) } } }))} className="text-xs text-red-600">remover</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded border p-3">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={!!form.override.enabled} onChange={(e) => setForm((prev) => ({ ...prev, override: { ...prev.override, enabled: e.target.checked } }))} />
          Override ativo
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <select value={form.override.mode} onChange={(e) => setForm((prev) => ({ ...prev, override: { ...prev.override, mode: e.target.value } }))} className="rounded border p-2">
            <option value="CLOSED">Forçar fechado</option>
            <option value="OPEN">Forçar aberto</option>
          </select>
          <input placeholder="Motivo" value={form.override.reason || ''} onChange={(e) => setForm((prev) => ({ ...prev, override: { ...prev.override, reason: e.target.value } }))} className="rounded border p-2" />
          <input type="datetime-local" onChange={(e) => setForm((prev) => ({ ...prev, override: { ...prev.override, until: e.target.value ? new Date(e.target.value) : null } }))} className="rounded border p-2" />
        </div>
      </div>

      <button type="button" disabled={!canEdit || saving} onClick={save} className="mt-4 rounded bg-pink-600 px-4 py-2 text-white disabled:opacity-60">
        {saving ? 'Salvando...' : 'Salvar operação'}
      </button>
    </section>
  );
};
