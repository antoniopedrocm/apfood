import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const DEFAULT_BRANDING = {
  logoUrl: '/logo512.png',
  colors: {
    brandPrimary: '#E11D48',
    brandSecondary: '#0F172A',
    brandAccent: '#F59E0B',
  },
};

const BrandingContext = createContext({
  branding: DEFAULT_BRANDING,
  loading: true,
  storeId: null,
  notFound: false,
  error: null,
});

const applyBrandingCssVariables = (branding) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.style.setProperty('--brand-primary', branding?.colors?.brandPrimary || DEFAULT_BRANDING.colors.brandPrimary);
  root.style.setProperty('--brand-secondary', branding?.colors?.brandSecondary || DEFAULT_BRANDING.colors.brandSecondary);
  root.style.setProperty('--brand-accent', branding?.colors?.brandAccent || DEFAULT_BRANDING.colors.brandAccent);
};

export const BrandingProvider = ({ storeId, children }) => {
  const [state, setState] = useState({
    branding: DEFAULT_BRANDING,
    loading: true,
    notFound: false,
    error: null,
  });

  useEffect(() => {
    if (!storeId) {
      setState({ branding: DEFAULT_BRANDING, loading: false, notFound: true, error: null });
      applyBrandingCssVariables(DEFAULT_BRANDING);
      return undefined;
    }

    const unsub = onSnapshot(
      doc(db, 'stores', storeId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({ branding: DEFAULT_BRANDING, loading: false, notFound: true, error: null });
          applyBrandingCssVariables(DEFAULT_BRANDING);
          return;
        }

        const data = snapshot.data();
        const branding = {
          logoUrl: data?.branding?.logoUrl || DEFAULT_BRANDING.logoUrl,
          logoPath: data?.branding?.logoPath || null,
          colors: {
            ...DEFAULT_BRANDING.colors,
            ...(data?.branding?.colors || {}),
          },
        };

        setState({ branding, loading: false, notFound: false, error: null });
        applyBrandingCssVariables(branding);
      },
      (error) => {
        setState((prev) => ({ ...prev, loading: false, error }));
      }
    );

    return () => unsub();
  }, [storeId]);

  const value = useMemo(
    () => ({
      storeId,
      branding: state.branding,
      loading: state.loading,
      notFound: state.notFound,
      error: state.error,
    }),
    [storeId, state]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => useContext(BrandingContext);
