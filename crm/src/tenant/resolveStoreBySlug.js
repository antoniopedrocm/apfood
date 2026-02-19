import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Resolve tenant store by slug from `stores` collection.
 * Returns `{ storeId, store }` or `null` when not found.
 */
export const resolveStoreBySlug = async (slug) => {
  if (!slug) return null;

  const storesRef = collection(db, 'stores');
  const q = query(storesRef, where('slug', '==', slug), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const storeDoc = snapshot.docs[0];

  return {
    storeId: storeDoc.id,
    store: storeDoc.data(),
  };
};
