import React, { createContext, useContext, useMemo, useState } from 'react';

const SessionContext = createContext(null);
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://us-central1-ana-guimaraes.cloudfunctions.net/api';

export function SessionProvider({ children }) {
  const [actor, setActor] = useState(null);
  const [subject, setSubject] = useState(null);
  const [impersonationToken, setImpersonationToken] = useState(null);

  const fetchSession = async (idToken, currentImpersonationToken = impersonationToken) => {
    if (!idToken) return null;

    const response = await fetch(`${API_BASE_URL}/auth/session`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(currentImpersonationToken ? { 'X-Impersonation-Token': currentImpersonationToken } : {}),
      },
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar sessão multi-loja.');
    }

    const session = await response.json();
    setActor(session.actor || null);
    setSubject(session.subject || null);
    return session;
  };

  const startImpersonation = async ({ idToken, subjectUserId, reason }) => {
    const response = await fetch(`${API_BASE_URL}/admin/impersonate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ subjectUserId, reason }),
    });

    if (!response.ok) {
      throw new Error('Não foi possível iniciar a emulação.');
    }

    const payload = await response.json();
    setImpersonationToken(payload.impersonationToken);
    return payload;
  };

  const stopImpersonation = () => {
    setImpersonationToken(null);
    setSubject(null);
  };

  const value = useMemo(() => ({
    actor,
    subject,
    effectiveUser: subject || actor,
    impersonationToken,
    fetchSession,
    startImpersonation,
    stopImpersonation,
  }), [actor, subject, impersonationToken]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession deve ser usado dentro do SessionProvider.');
  }

  return context;
}
