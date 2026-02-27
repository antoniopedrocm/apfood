import { CTA_VARIANT } from '../config/featureFlags';

export const getCtaVariantColor = () => (CTA_VARIANT === 'red' ? 'danger' : 'primary');

export const trackCtaClick = () => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('cta_click', {
      detail: { variant: CTA_VARIANT },
    })
  );
};
