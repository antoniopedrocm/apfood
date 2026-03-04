import React, { useState } from 'react';
import { useSession } from '../../contexts/SessionProvider';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://us-central1-ana-guimaraes.cloudfunctions.net/api';

export function AdminImpersonationPanel() {
  const { effectiveUser, startImpersonation } = useSession();
  const [users, setUsers] = useState([]);
  const [subjectUserId, setSubjectUserId] = useState('');
  const [reason, setReason] = useState('Suporte operacional');

  if (!effectiveUser || effectiveUser.role !== 'admin') {
    return null;
  }

  const loadUsers = async () => {
    const idToken = window.localStorage.getItem('apfood_id_token');
    if (!idToken) return;
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) return;
    const payload = await response.json();
    setUsers(payload.users || []);
  };

  const handleImpersonate = async () => {
    const idToken = window.localStorage.getItem('apfood_id_token');
    if (!idToken || !subjectUserId) return;
    await startImpersonation({ idToken, subjectUserId, reason });
  };

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Emulação (admin)</h2>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={loadUsers} className="rounded bg-slate-800 px-3 py-1 text-xs text-white" aria-label="Carregar usuários para emulação">Carregar usuários</button>
        <select
          aria-label="Selecionar usuário para emular"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          value={subjectUserId}
          onChange={(event) => setSubjectUserId(event.target.value)}
        >
          <option value="">Selecione um usuário</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.name || user.email} ({user.role})</option>
          ))}
        </select>
        <input
          aria-label="Motivo da emulação"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Motivo"
        />
        <button type="button" onClick={handleImpersonate} className="rounded bg-indigo-600 px-3 py-1 text-xs text-white" aria-label="Iniciar emulação">Iniciar</button>
      </div>
    </div>
  );
}
