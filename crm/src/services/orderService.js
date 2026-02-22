import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { isStoreOpenNow } from '../utils/storeAvailability';

export const canCheckoutStore = (operacao) => isStoreOpenNow(operacao || {}, new Date(), operacao?.schedule?.timezone);

export const createOrderWithValidation = async ({ storeId, orderPayload }) => {
  const createOrderFn = httpsCallable(functions, 'createOrder');
  try {
    const result = await createOrderFn({ storeId, ...orderPayload });
    return result.data;
  } catch (error) {
    const message = error?.message || 'Não foi possível finalizar o pedido.';
    if (String(message).includes('STORE_CLOSED') || error?.details?.code === 'STORE_CLOSED') {
      const storeClosed = new Error('Loja fechada no momento');
      storeClosed.code = 'STORE_CLOSED';
      storeClosed.details = error?.details || null;
      throw storeClosed;
    }
    throw error;
  }
};
