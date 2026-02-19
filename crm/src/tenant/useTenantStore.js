import { useEffect, useMemo, useState } from 'react';
import { getTenantSlugFromHostname } from './getTenantSlugFromHostname';
import { resolveStoreBySlug } from './resolveStoreBySlug';

export const useTenantStore = () => {
  const [state, setState] = useState({
    loading: true,
    storeId: null,
    store: null,
    slug: null,
    notFound: false,
    error: null,
  });

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const slug = getTenantSlugFromHostname();

        if (!slug) {
          if (!active) return;
          setState({
            loading: false,
            storeId: null,
            store: null,
            slug: null,
            notFound: true,
            error: new Error('Loja não encontrada'),
          });
          return;
        }

        const resolved = await resolveStoreBySlug(slug);

        if (!active) return;

        if (!resolved) {
          setState({
            loading: false,
            storeId: null,
            store: null,
            slug,
            notFound: true,
            error: new Error('Loja não encontrada'),
          });
          return;
        }

        setState({
          loading: false,
          storeId: resolved.storeId,
          store: resolved.store,
          slug,
          notFound: false,
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setState((prev) => ({ ...prev, loading: false, error }));
      }
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => state, [state]);
};
