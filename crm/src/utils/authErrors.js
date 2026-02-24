const getHttpStatusFromError = (error) => {
  if (typeof error?.customData?._tokenResponse?.httpStatus === 'number') {
    return error.customData._tokenResponse.httpStatus;
  }

  if (typeof error?.status === 'number') {
    return error.status;
  }

  if (typeof error?.customData?.httpStatus === 'number') {
    return error.customData.httpStatus;
  }

  const message = String(error?.message || '');
  const match = message.match(/\b(4\d\d|5\d\d)\b/);
  return match ? Number(match[1]) : null;
};

export const normalizeAuthError = (error) => ({
  code: error?.code || 'auth/unknown',
  message: error?.message || 'Erro desconhecido de autenticação.',
  httpStatus: getHttpStatusFromError(error),
});

export const isRefererBlockedError = (code = '') => (
  code?.startsWith('auth/requests-from-referer-') && code?.endsWith('-are-blocked')
);

export const mapAuthErrorToUserMessage = (error) => {
  const { code } = normalizeAuthError(error);

  if (isRefererBlockedError(code)) {
    return 'Este domínio não está autorizado no Firebase/Google Cloud. Contate o suporte.';
  }

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email ou senha inválidos. Verifique os dados e tente novamente.';
  }

  if (code === 'auth/popup-closed-by-user') {
    return 'Você fechou a janela de login antes de concluir a autenticação.';
  }

  if (code === 'auth/popup-blocked') {
    return 'Seu navegador bloqueou a janela de login do Google. Permita popups e tente novamente.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Falha de conexão com o servidor de autenticação. Verifique sua internet e tente novamente.';
  }

  if (code === 'auth/cancelled-popup-request') {
    return 'Já existe uma tentativa de login em andamento. Aguarde alguns segundos e tente novamente.';
  }

  return 'Não foi possível concluir o login agora. Tente novamente em instantes.';
};
