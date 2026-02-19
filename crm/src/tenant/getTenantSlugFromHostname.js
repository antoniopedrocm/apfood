const ROOT_DOMAIN = 'apfood.com.br';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const sanitizeSlug = (value) => {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9-]{2,50}$/.test(normalized) ? normalized : null;
};

export const getTenantSlugFromHostname = ({
  hostname,
  search,
  fallbackQueryParam = 'loja',
  rootDomain = ROOT_DOMAIN,
} = {}) => {
  const runtimeHostname =
    hostname || (typeof window !== 'undefined' ? window.location.hostname : '');
  const runtimeSearch =
    typeof search === 'string'
      ? search
      : typeof window !== 'undefined'
      ? window.location.search
      : '';

  const lowerHost = (runtimeHostname || '').toLowerCase();

  if (LOCAL_HOSTS.has(lowerHost)) {
    const params = new URLSearchParams(runtimeSearch || '');
    return sanitizeSlug(params.get(fallbackQueryParam));
  }

  const suffix = `.${rootDomain}`;
  if (!lowerHost.endsWith(suffix)) return null;

  const subdomain = lowerHost.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes('.')) return null;

  return sanitizeSlug(subdomain);
};

export const getHostnameFromRequestHeaders = (headers = {}) => {
  if (!headers || typeof headers !== 'object') return '';

  const forwardedHost =
    headers['x-forwarded-host'] ||
    headers['X-Forwarded-Host'] ||
    headers['host'] ||
    headers['Host'] ||
    '';

  return String(forwardedHost).split(',')[0].trim().toLowerCase();
};
