const allowedVariants = new Set(['orange', 'red']);

const rawVariant = (process.env.REACT_APP_CTA_VARIANT || 'orange').toLowerCase();

export const CTA_VARIANT = allowedVariants.has(rawVariant) ? rawVariant : 'orange';
