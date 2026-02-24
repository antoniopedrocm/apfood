const AUTH_ALLOWED_HOSTS = ['apfood.com.br', 'www.apfood.com.br', 'localhost', '127.0.0.1'];
const AUTH_ALLOWED_HOST_SUFFIXES = ['.apfood.com.br'];

const getRuntimeEnv = () =>
  (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) ||
  import.meta.env?.MODE ||
  '';

const readDebugFlag = () => {
  if (typeof window === 'undefined') return false;

  const fromQuery = new URLSearchParams(window.location.search).get('authDebug') === '1';
  const fromStorage = window.localStorage?.getItem('authDebug') === '1';

  return fromQuery || fromStorage;
};

export const isAuthDebugEnabled = () => getRuntimeEnv() !== 'production' || readDebugFlag();

export const isHostAllowedForAuthDiagnostics = (host = '') => {
  if (!host) return false;

  const normalizedHost = host.toLowerCase();
  if (AUTH_ALLOWED_HOSTS.includes(normalizedHost)) {
    return true;
  }

  return AUTH_ALLOWED_HOST_SUFFIXES.some((suffix) => normalizedHost.endsWith(suffix));
};

const normalizeHttpStatusFromError = (error) => {
  const customDataStatus = error?.customData?._tokenResponse?.httpStatus;
  if (customDataStatus) return customDataStatus;

  const message = String(error?.message || '');
  const statusMatch = message.match(/\b(4\d\d|5\d\d)\b/);
  return statusMatch ? Number(statusMatch[1]) : null;
};

export const normalizeAuthError = (error) => ({
  code: error?.code || 'auth/unknown',
  message: error?.message || 'Erro desconhecido de autenticação.',
  httpStatus: normalizeHttpStatusFromError(error),
});

export const mapAuthErrorToUserMessage = (error) => {
  const { code, message } = normalizeAuthError(error);
  const messageLower = String(message).toLowerCase();

  if (code.startsWith('auth/requests-from-referer-') && code.endsWith('-are-blocked')) {
    return 'Este domínio não está autorizado no Firebase/Google Cloud. Contate o suporte.';
  }

  if (
    messageLower.includes('requests from referer') &&
    messageLower.includes('are blocked')
  ) {
    return 'Este domínio não está autorizado no Firebase/Google Cloud. Contate o suporte.';
  }

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email ou senha inválidos.';
  }

  if (code === 'auth/popup-closed-by-user') {
    return 'Você fechou a janela de login antes de concluir a autenticação.';
  }

  if (code === 'auth/popup-blocked') {
    return 'O navegador bloqueou o popup de login. Libere popups e tente novamente.';
  }

  if (code === 'auth/cancelled-popup-request') {
    return 'Já existe uma tentativa de login em andamento. Aguarde alguns segundos e tente novamente.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Falha de conexão. Verifique sua internet e tente novamente.';
  }

  return 'Não foi possível fazer login agora. Tente novamente em instantes.';
};

export const logAuthRuntimeDiagnostics = ({ method, firebasePublicConfig, error }) => {
  if (!isAuthDebugEnabled()) return;

  const payload = {
    method,
    host: window.location.host,
    origin: window.location.origin,
    projectId: firebasePublicConfig?.projectId || 'N/A',
    authDomain: firebasePublicConfig?.authDomain || 'N/A',
    apiKeySuffix: firebasePublicConfig?.apiKeySuffix || 'N/A',
  };

  if (error) {
    payload.error = normalizeAuthError(error);
    console.error('[AUTH][DIAGNOSTICS]', payload);
    return;
  }

  console.info('[AUTH][DIAGNOSTICS]', payload);
};

export const warnIfHostOutsideAllowlist = () => {
  if (typeof window === 'undefined') return;

  const currentHost = window.location.hostname.toLowerCase();
  if (isHostAllowedForAuthDiagnostics(currentHost)) {
    return;
  }

  console.warn(
    '[AUTH][DOMAIN_CHECK] Host fora da allowlist local de diagnóstico. Ajuste a configuração do Firebase Authorized domains/APIs se necessário.',
    {
      host: currentHost,
      allowedHosts: AUTH_ALLOWED_HOSTS,
      allowedSuffixes: AUTH_ALLOWED_HOST_SUFFIXES,
    }
  );
};

export const isPopupFallbackError = (code = '') => (
  code === 'auth/popup-blocked' ||
  code === 'auth/popup-closed-by-user' ||
  code === 'auth/cancelled-popup-request'
);
