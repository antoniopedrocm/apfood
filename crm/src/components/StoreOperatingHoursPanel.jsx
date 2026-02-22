import React, { useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getDefaultOperacao } from '../utils/storeAvailability';

const DAYS = [
  ['mon', 'Segunda'],
  ['tue', 'Terça'],
  ['wed', 'Quarta'],
  ['thu', 'Quinta'],
  ['fri', 'Sexta'],
  ['sat', 'Sábado'],
  ['sun', 'Domingo'],
];

export const StoreOperatingHoursPanel = ({ storeId, currentUser, initialOperacao, canManage }) => {
  const [operacao, setOperacao] = useState(() => ({ ...getDefaultOperacao(), ...(initialOperacao || {}) }));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const weekly = useMemo(() => ({ ...getDefaultOperacao().schedule.weekly, ...(operacao.schedule?.weekly || {}) }), [operacao]);

  if (!canManage) return <div className="text-sm text-slate-500">Sem permissão para editar operação.</div>;

  const updateInterval = (day, index, field, value) => {
    const dayIntervals = [...(weekly[day] || [])];
    dayIntervals[index] = { ...(dayIntervals[index] || { start: '08:00', end: '18:00' }), [field]: value };
    setOperacao((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        weekly: { ...weekly, [day]: dayIntervals },
      },
    }));
  };

  const addInterval = (day) => {
    setOperacao((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        weekly: {
          ...weekly,
          [day]: [...(weekly[day] || []), { start: '08:00', end: '18:00' }],
        },
      },
    }));
  };

  const removeInterval = (day, index) => {
    setOperacao((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        weekly: {
          ...weekly,
          [day]: (weekly[day] || []).filter((_, i) => i !== index),
        },
      },
    }));
  };

  const save = async () => {
    if (!storeId) return;
    setSaving(true);
    setFeedback('');
    try {
      await setDoc(doc(db, 'stores', storeId), {
        operacao: {
          ...operacao,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.uid || null,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setFeedback('Horários salvos com sucesso.');
    } catch (error) {
      setFeedback(error.message || 'Falha ao salvar horários.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Disponibilidade da Loja</h3>
        <label className="inline-flex items-center gap-3 cursor-pointer">
          <span className="text-sm font-medium">Ativo</span>
          <button
            type="button"
            aria-label="Toggle ativo"
            onClick={() => setOperacao((prev) => ({ ...prev, manualOpen: !prev.manualOpen }))}
            className={`relative h-7 w-12 rounded-full transition ${operacao.manualOpen ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${operacao.manualOpen ? 'left-6' : 'left-1'}`} />
          </button>
        </label>
      </div>

      <div>
        <label className="text-sm font-medium">Timezone</label>
        <input
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          value={operacao.schedule?.timezone || 'America/Sao_Paulo'}
          onChange={(e) => setOperacao((prev) => ({ ...prev, schedule: { ...prev.schedule, timezone: e.target.value } }))}
        />
      </div>

      {DAYS.map(([day, label]) => (
        <div key={day} className="rounded border border-slate-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">{label}</p>
            <button type="button" className="text-xs text-indigo-600" onClick={() => addInterval(day)}>+ Faixa</button>
          </div>
          {(weekly[day] || []).length === 0 ? <p className="text-xs text-slate-500">Fechado</p> : null}
          {(weekly[day] || []).map((interval, index) => (
            <div key={`${day}-${index}`} className="flex items-center gap-2">
              <input type="time" className="rounded border px-2 py-1 text-sm" value={interval.start} onChange={(e) => updateInterval(day, index, 'start', e.target.value)} />
              <span>até</span>
              <input type="time" className="rounded border px-2 py-1 text-sm" value={interval.end} onChange={(e) => updateInterval(day, index, 'end', e.target.value)} />
              <button type="button" className="text-xs text-red-500" onClick={() => removeInterval(day, index)}>Remover</button>
            </div>
          ))}
        </div>
      ))}

      <div className="rounded border border-slate-200 p-3 space-y-2">
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={Boolean(operacao.override?.enabled)}
            onChange={(e) => setOperacao((prev) => ({ ...prev, override: { ...prev.override, enabled: e.target.checked } }))}
          />
          Override ativo
        </label>
        <select
          className="w-full rounded border px-2 py-2 text-sm"
          value={operacao.override?.mode || 'CLOSED'}
          onChange={(e) => setOperacao((prev) => ({ ...prev, override: { ...prev.override, mode: e.target.value } }))}
        >
          <option value="CLOSED">Forçar fechado</option>
          <option value="OPEN">Forçar aberto</option>
        </select>
        <input
          className="w-full rounded border px-2 py-2 text-sm"
          placeholder="Motivo (opcional)"
          value={operacao.override?.reason || ''}
          onChange={(e) => setOperacao((prev) => ({ ...prev, override: { ...prev.override, reason: e.target.value } }))}
        />
      </div>

      <button type="button" onClick={save} disabled={saving} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? 'Salvando...' : 'Salvar operação'}
      </button>
      {feedback ? <p className="text-xs text-slate-600">{feedback}</p> : null}
    </div>
  );
};
