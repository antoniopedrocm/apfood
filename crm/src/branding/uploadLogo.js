import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';

const MAX_LOGO_BYTES = 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const extensionFromFile = (file) => {
  const fromName = file.name?.split('.').pop()?.toLowerCase();
  if (fromName && ['png', 'jpg', 'jpeg', 'webp'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }

  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/jpeg') return 'jpg';
  return 'webp';
};

export const validateLogoFile = (file) => {
  if (!file) throw new Error('Selecione um arquivo de logo.');
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Formato inválido. Use png, jpg ou webp.');
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error('Arquivo acima de 1MB.');
  }
};

/**
 * Upload logo into stores/{storeId}/branding/logo_{timestamp}.{ext}
 * and updates stores/{storeId}.branding metadata.
 */
export const uploadLogo = async ({ storeId, file, updatedBy, colors = {} }) => {
  if (!storeId) throw new Error('storeId é obrigatório.');

  validateLogoFile(file);

  const timestamp = Date.now();
  const ext = extensionFromFile(file);
  const logoPath = `stores/${storeId}/branding/logo_${timestamp}.${ext}`;
  const logoRef = ref(storage, logoPath);

  await uploadBytes(logoRef, file, { contentType: file.type });
  const logoUrl = await getDownloadURL(logoRef);

  const storeRef = doc(db, 'stores', storeId);
  await updateDoc(storeRef, {
    branding: {
      logoUrl,
      logoPath,
      colors: {
        brandPrimary: colors.brandPrimary || '#E11D48',
        brandSecondary: colors.brandSecondary || '#0F172A',
        brandAccent: colors.brandAccent || '#F59E0B',
      },
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy || null,
    },
  });

  return { logoPath, logoUrl };
};
