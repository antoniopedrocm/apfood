const DEBUG_FLAG_KEY = 'REACT_APP_AUTH_DEBUG';
const ALLOWED_LOGIN_HOSTS = [
  'apfood.com.br',
  'www.apfood.com.br',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
];

const getRuntimeMode = () => process.env.NODE_ENV || import.meta.env?.MODE || '';

const isAuthDebugEnabled = () => {
  const mode = getRuntimeMode();
  const debugFlag = process.env[DEBUG_FLAG_KEY] || import.meta.env?.VITE_AUTH_DEBUG;
  return mode !== 'production' || debugFlag === 'true';
};

const getApiKeySuffix = (apiKey = '') => {
  if (!apiKey) return 'N/A';
  return apiKey.slice(-6);
};

const hostMatchesAllowedList = (host = '') => {
  const normalizedHost = String(host).toLowerCase();
  if (!normalizedHost) return false;

  if (ALLOWED_LOGIN_HOSTS.includes(normalizedHost)) {
    return true;
  }

  return normalizedHost.endsWith('.apfood.com.br');
};

export const logAuthDiagnostics = ({ loginMethod, firebaseConfigSnapshot, normalizedError }) => {
  if (!isAuthDebugEnabled() || typeof window === 'undefined') return;

  const safeConfig = {
    projectId: firebaseConfigSnapshot?.projectId || 'N/A',
    authDomain: firebaseConfigSnapshot?.authDomain || 'N/A',
    apiKeySuffix: getApiKeySuffix(firebaseConfigSnapshot?.apiKey),
  };

  const payload = {
    host: window.location.host,
    origin: window.location.origin,
    loginMethod,
    ...safeConfig,
    error: normalizedError || null,
  };

  if (normalizedError) {
    console.error('[AUTH_DIAGNOSTICS] Falha de autenticação:', payload);
    return;
  }

  console.info('[AUTH_DIAGNOSTICS] Tentativa de autenticação:', payload);
};

export const warnIfHostNotMapped = () => {
  if (!isAuthDebugEnabled() || typeof window === 'undefined') return;

  const host = window.location.hostname;
  if (!hostMatchesAllowedList(host)) {
    console.warn(
      `[AUTH_DIAGNOSTICS] Host "${host}" fora da allowlist local (${ALLOWED_LOGIN_HOSTS.join(', ')} + *.apfood.com.br). Verifique Authorized domains no Firebase Auth e restrições de referer no Google Cloud.`
    );
  }
};

export const ALLOWED_LOGIN_HOSTS_DIAGNOSTIC = ALLOWED_LOGIN_HOSTS;
