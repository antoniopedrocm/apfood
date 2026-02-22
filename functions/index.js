/**
 * Import function triggers from their respective sub-packages:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest, onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const {isStoreOpenNow} = require('./storeAvailability');

// Inicializa o Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const STORE_INFO_DOC_ID = 'dados';
const CONFIG_DOC_ID = 'config';
const ROLE_OWNER = 'dono';
const STORE_ALL_KEY = '__all__';
const ROLE_MANAGER = 'gerente';
const ROLE_ATTENDANT = 'atendente';
const MENU_PERMISSION_KEYS = [
  'pagina-inicial',
  'dashboard',
  'clientes',
  'pedidos',
  'produtos',
  'agenda',
  'fornecedores',
  'relatorios',
  'meu-espaco',
  'financeiro',
  'configuracoes',
];

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return ROLE_ATTENDANT;
  const value = role.toLowerCase();
  if ([ROLE_OWNER, ROLE_MANAGER, ROLE_ATTENDANT].includes(value)) {
    return value;
  }
  if (value === 'admin') return ROLE_OWNER;
  return ROLE_ATTENDANT;
};

const getDefaultPermissionsForRole = (role) => {
  const basePermissions = MENU_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});

  const normalizedRole = normalizeRole(role);

  if (normalizedRole === ROLE_OWNER) {
    return MENU_PERMISSION_KEYS.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
  }

  if (normalizedRole === ROLE_MANAGER) {
    return {
      ...basePermissions,
      'pagina-inicial': true,
      dashboard: true,
      clientes: true,
      pedidos: true,
      produtos: true,
      agenda: true,
      fornecedores: true,
      relatorios: true,
      'meu-espaco': true,
      financeiro: true,
      configuracoes: true,
    };
  }

  return {
    ...basePermissions,
    'pagina-inicial': true,
    clientes: true,
    pedidos: true,
    agenda: true,
    'meu-espaco': true,
  };
};

const sanitizePermissions = (permissions, role) => {
  const defaults = getDefaultPermissionsForRole(role);
  if (!permissions || typeof permissions !== 'object') {
    return defaults;
  }

  return MENU_PERMISSION_KEYS.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(permissions, key)) {
      acc[key] = Boolean(permissions[key]);
    } else {
      acc[key] = defaults[key];
    }
    return acc;
  }, {});
};

const ensureCustomProfile = async (uid, role, permissionsInput = null) => {
  const permissions = sanitizePermissions(permissionsInput, role);
  await db.collection('customProfiles').doc(uid).set({
    uid,
    permissions,
    role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  return permissions;
};

const getUserPermissions = async (uid, role) => {
  const snap = await db.collection('customProfiles').doc(uid).get();
  if (snap.exists) {
    const data = snap.data() || {};
    const sanitized = sanitizePermissions(data.permissions, role);
    await ensureCustomProfile(uid, role, sanitized);
    return sanitized;
  }

  return ensureCustomProfile(uid, role);
};

const extractStoreIds = (profile) => {
  if (!profile) return [];
  if (Array.isArray(profile.lojaIds) && profile.lojaIds.length) return profile.lojaIds;
  if (Array.isArray(profile.lojas) && profile.lojas.length) return profile.lojas;
  if (Array.isArray(profile.lojaId) && profile.lojaId.length) return profile.lojaId;
  if (typeof profile.lojaId === 'string' && profile.lojaId.trim().length) return [profile.lojaId.trim()];
  return [];
};

const userHasAccessToStores = (requesterStores, targetStores) => {
  if (!targetStores || targetStores.length === 0) {
    return true;
  }
  if (!requesterStores || requesterStores.length === 0) {
    return false;
  }
  return targetStores.every((storeId) => requesterStores.includes(storeId));
};

const getUserProfile = async (uid) => {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : {};
};

const verifyManagementAccess = async (uid) => {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
  }
  const profile = await getUserProfile(uid);
  const role = normalizeRole(profile.role);
  const stores = extractStoreIds(profile);

  if (role === ROLE_OWNER) {
    return { role, stores, allStores: stores.length === 0 };
  }

  if (role === ROLE_MANAGER) {
    if (!stores.length) {
      throw new HttpsError('permission-denied', 'Gerentes precisam estar associados a pelo menos uma loja.');
    }
    return { role, stores, allStores: false };
  }

  throw new HttpsError('permission-denied', 'Você não tem permissão para realizar esta ação.');
};

const requireStoreId = (req, res) => {
  const lojaId = req.params.lojaId || req.query.lojaId || req.body?.lojaId;
  if (!lojaId) {
    res.status(400).json({ message: 'Parâmetro lojaId é obrigatório.' });
    return null;
  }
  return lojaId;
};

const generateStoreId = (value) => {
  if (!value) return '';

  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || `loja-${Date.now()}`;
};

const getStoreRef = (storeId) => db.collection('lojas').doc(storeId);

const getStoreConfigDoc = (storeId) => getStoreRef(storeId).collection('configuracoes').doc(CONFIG_DOC_ID);
const getStoreConfigCollection = (storeId, collectionName) => getStoreConfigDoc(storeId).collection(collectionName);
const getLegacyConfigDoc = (storeId, configId) => getStoreRef(storeId).collection('configuracoes').doc(configId);

const getLegacyInfoDoc = (storeId) => getStoreRef(storeId).collection('info').doc(STORE_INFO_DOC_ID);


const validateStoreOpenOrThrow = async (storeId) => {
  const storeSnap = await db.collection('stores').doc(storeId).get();
  const legacyStoreSnap = storeSnap.exists ? null : await db.collection('lojas').doc(storeId).get();
  const storeData = storeSnap.exists ? storeSnap.data() : (legacyStoreSnap?.data() || {});
  const operacao = storeData?.operacao || {};
  const status = isStoreOpenNow(operacao, new Date(), operacao?.schedule?.timezone);

  if (!status.isOpen) {
    const error = new HttpsError('failed-precondition', status.message || 'Loja fechada no momento');
    error.details = { code: 'STORE_CLOSED', status };
    throw error;
  }

  return {status, operacao};
};

// API Express para o Cardápio Online
const app = express();
app.use(cors({origin: true})); // Habilita CORS para a API do cardápio
app.use(express.json());

const CLIENTS_COLLECTION = 'clientes';
const getClientsCollection = () => db.collection(CLIENTS_COLLECTION);

const sanitizeClientPayload = (input = {}) => {
  const {
    comprasIncrement,
    incrementarCompras,
    totalComprasIncrement,
    totalCompras,
    compras,
    numeroDeComprasIncrement,
    valorEmComprasIncrement,
    numeroDeCompras,
    valorEmCompras,
    lojasVisitadas,
    criadoEm,
    criadoEmOriginal,
    updatedAt,
    atualizadoEm,
    createdAt,
    ...rest
  } = input || {};

  delete rest.numeroDeComprasIncrement;
  delete rest.valorEmComprasIncrement;

  const purchaseCountIncrement = Number(
    numeroDeComprasIncrement ?? incrementarCompras ?? compras ?? 0,
  );

  const purchaseValueIncrement = Number(
    valorEmComprasIncrement ?? totalComprasIncrement ?? totalCompras ?? valorEmCompras ?? 0,
  );

  return {
    data: rest,
    purchaseCountIncrement: Number.isFinite(purchaseCountIncrement) ? purchaseCountIncrement : 0,
    purchaseValueIncrement: Number.isFinite(purchaseValueIncrement) ? purchaseValueIncrement : 0,
    createdAt: criadoEm || createdAt || criadoEmOriginal || null,
  };
};

const findClientByPhone = async (telefone) => {
  if (!telefone) return null;
  const snapshot = await getClientsCollection().where('telefone', '==', telefone).limit(1).get();
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return {id: docSnap.id, data: docSnap.data()};
};

const upsertClientDocument = async ({
  targetRef,
  data,
  lojaId,
  setCreatedIfMissing = false,
  purchaseCountIncrement = 0,
  purchaseValueIncrement = 0,
  createdAt = null,
}) => {
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(targetRef);
    const payload = {
      ...data,
      lojaId: data.lojaId || lojaId || data.lojaId,
      atualizadoEm: timestamp,
    };

    if (lojaId) {
      payload.lojasVisitadas = admin.firestore.FieldValue.arrayUnion(lojaId);
    }

    if (Number.isFinite(purchaseCountIncrement) && purchaseCountIncrement !== 0) {
      payload.numeroDeCompras = admin.firestore.FieldValue.increment(purchaseCountIncrement);
    }

    if (Number.isFinite(purchaseValueIncrement) && purchaseValueIncrement !== 0) {
      payload.valorEmCompras = admin.firestore.FieldValue.increment(purchaseValueIncrement);
    }

    if (!snap.exists && setCreatedIfMissing) {
      payload.criadoEm = createdAt || timestamp;
      payload.numeroDeCompras = payload.numeroDeCompras ?? 0;
      payload.valorEmCompras = payload.valorEmCompras ?? 0;
      payload.lojasVisitadas = lojaId ? admin.firestore.FieldValue.arrayUnion(lojaId) : payload.lojasVisitadas;
    }

    transaction.set(targetRef, payload, {merge: true});
    return {id: targetRef.id};
  });
};

// Rota para buscar todos os produtos ativos
app.get("/produtos", async (req, res) => {
  const lojaId = requireStoreId(req, res);
  if (!lojaId) return;
  try {
    const snapshot = await db.collection("lojas").doc(lojaId).collection("produtos").where("status", "==", "Ativo").get();
    const products = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(products);
  } catch (error) {
    logger.error("Erro ao buscar produtos:", error);
    res.status(500).send("Erro ao buscar produtos.");
  }
});

// Rota para buscar cliente por telefone
app.get("/clientes/buscar", async (req, res) => {
  const lojaId = requireStoreId(req, res);
  if (!lojaId) return;

  const telefone = typeof req.query?.telefone === 'string' ? req.query.telefone.trim() : '';
  if (!telefone) {
    return res.status(400).json({message: 'Parâmetro telefone é obrigatório.'});
  }

  try {
    const existing = await findClientByPhone(telefone);
    if (!existing) {
      return res.status(404).json({message: 'Cliente não encontrado.'});
    }

    await upsertClientDocument({
      targetRef: getClientsCollection().doc(existing.id),
      data: existing.data,
      lojaId,
      setCreatedIfMissing: true,
    });

    const refreshed = await getClientsCollection().doc(existing.id).get();
    return res.status(200).json({id: refreshed.id, ...refreshed.data()});
  } catch (error) {
    logger.error("Erro ao buscar cliente por telefone:", error);
    res.status(500).send("Erro ao buscar cliente.");
  }
});

// Rota para buscar todos os clientes
app.get("/clientes", async (req, res) => {
  const lojaId = requireStoreId(req, res);
  if (!lojaId) return;
  try {
    const snapshot = await getClientsCollection().where('lojasVisitadas', 'array-contains', lojaId).get();
    const clients = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(clients);
  } catch (error) {
    logger.error("Erro ao buscar clientes:", error);
    res.status(500).send("Erro ao buscar clientes.");
  }
});

// Rota para criar um novo cliente
app.post("/clientes", async (req, res) => {
  const lojaId = requireStoreId(req, res);
  if (!lojaId) return;

  try {
    const {data: newClient, purchaseCountIncrement, purchaseValueIncrement} = sanitizeClientPayload(req.body || {});
    const telefone = typeof newClient.telefone === 'string' ? newClient.telefone.trim() : '';

    const existing = await findClientByPhone(telefone);
    const targetRef = existing ? getClientsCollection().doc(existing.id) : getClientsCollection().doc();

    await upsertClientDocument({
      targetRef,
      data: newClient,
      lojaId,
      setCreatedIfMissing: !existing,
      purchaseCountIncrement,
      purchaseValueIncrement,
    });

    const savedSnap = await targetRef.get();
    const responseStatus = existing ? 200 : 201;
    res.status(responseStatus).json({id: targetRef.id, ...savedSnap.data()});
  } catch (error) {
    logger.error("Erro ao criar cliente:", error);
    res.status(500).send("Erro ao criar cliente.");
  }
});

// Rota para atualizar um cliente (adicionar endereço ou registrar compra)
app.put("/clientes/:id", async (req, res) => {
  const lojaId = requireStoreId(req, res);
  if (!lojaId) return;

  try {
    const {id} = req.params;
    const {newAddress, ...rawData} = req.body || {};
    const {data: clientData, purchaseCountIncrement, purchaseValueIncrement} = sanitizeClientPayload(rawData);
    const clientRef = getClientsCollection().doc(id);
    const updates = {...clientData};

    if (newAddress) {
      updates.enderecos = admin.firestore.FieldValue.arrayUnion(newAddress);
    }

    await upsertClientDocument({
      targetRef: clientRef,
      data: updates,
      lojaId,
      setCreatedIfMissing: true,
      purchaseCountIncrement,
      purchaseValueIncrement,
    });

    const updatedSnap = await clientRef.get();
    res.status(200).json({id, ...updatedSnap.data()});
  } catch (error) {
    logger.error("Erro ao atualizar cliente:", error);
    res.status(500).send("Erro ao atualizar cliente.");
  }
});


// Rota para criar um novo pedido
app.post("/pedidos", async (req, res) => {
  const lojaId = requireStoreId(req, res);
  if (!lojaId) return;
  try {
    const {status} = await validateStoreOpenOrThrow(lojaId);
    const newOrder = {
      ...req.body,
      lojaId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      storeStatusAtCheckout: status,
    };
    const docRef = await db.collection("lojas").doc(lojaId).collection("pedidos").add(newOrder);
    res.status(201).json({id: docRef.id});
  } catch (error) {
    if (error?.details?.code === 'STORE_CLOSED') {
      return res.status(412).json({ code: 'STORE_CLOSED', message: error.message, status: error.details.status });
    }
    logger.error("Erro ao criar pedido:", error);
    res.status(500).send("Erro ao criar pedido.");
  }
});

// Rota para calcular frete
app.post("/frete/calcular", async (req, res) => {
	const lojaId = requireStoreId(req, res);
    if (!lojaId) return;
    try {
        const { clienteLat, clienteLng } = req.body;

        const configDoc = await getStoreConfigDoc(lojaId).get();
        let freteConfig = configDoc.exists ? (configDoc.data()?.frete || configDoc.data()) : null;

        if (!freteConfig || Object.keys(freteConfig).length === 0) {
            const legacyFreteDoc = await getLegacyConfigDoc(lojaId, 'frete').get();
            if (legacyFreteDoc.exists) {
                freteConfig = legacyFreteDoc.data();
                await getStoreConfigDoc(lojaId).set({ frete: freteConfig }, { merge: true });
            }
        }

        if (!freteConfig || Object.keys(freteConfig).length === 0) {
            const legacyDoc = await getLegacyInfoDoc(lojaId).get();
            freteConfig = legacyDoc.data()?.frete || null;

            if (freteConfig) {
                await getStoreConfigDoc(lojaId).set({ frete: freteConfig }, { merge: true });
            }
        }

        if (!freteConfig) {
            return res.status(404).json({ message: "Configuração de frete não encontrada." });
        }

        const lojaLat = freteConfig.lat;
        const lojaLng = freteConfig.lng;
        const valorPorKm = freteConfig.valorPorKm;

        if (typeof lojaLat !== 'number' || typeof lojaLng !== 'number' || typeof valorPorKm !== 'number') {
            return res.status(400).json({ message: "Configuração de frete inválida." });
        }

        function getDistance(lat1, lon1, lat2, lon2) {
            const R = 6371; // Raio da Terra em km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        }

        const distanciaKm = getDistance(lojaLat, lojaLng, clienteLat, clienteLng);
        const valorFrete = distanciaKm * valorPorKm;

        res.status(200).json({
            valorFrete: parseFloat(valorFrete.toFixed(2)),
            distanciaKm: distanciaKm.toFixed(2)
        });

    } catch (error) {
        logger.error("Erro ao calcular frete:", error);
        res.status(500).send("Erro ao calcular frete.");
    }
});


// Rota para verificar cupom
app.post("/cupons/verificar", async (req, res) => {
    const { codigo, totalCarrinho, telefone } = req.body;
    const lojaId = requireStoreId(req, res);
    if (!lojaId) return;
    try {
        const cupomCodigo = codigo.toUpperCase();
        const cuponsCollection = getStoreConfigCollection(lojaId, 'cupons');
        let cupom = null;
        let legacyCupomFound = false;

        const newPathSnapshot = await cuponsCollection.where('codigo', '==', cupomCodigo).limit(1).get();
        if (!newPathSnapshot.empty) {
            const docSnap = newPathSnapshot.docs[0];
            cupom = { id: docSnap.id, ...docSnap.data() };
        }

        if (!cupom) {
            const legacyConfigDoc = await getLegacyConfigDoc(lojaId, 'cupons').get();
            if (legacyConfigDoc.exists) {
                const data = legacyConfigDoc.data() || {};
                const possibleLists = [data.lista, data.cupons, data.items];

                for (const list of possibleLists) {
                    if (Array.isArray(list)) {
                        cupom = list.find((item) => item?.codigo?.toUpperCase && item.codigo.toUpperCase() === cupomCodigo);
                    }
                    if (cupom) break;
                }

                if (!cupom && typeof data === 'object' && data !== null) {
                    const directCupom = data[cupomCodigo] || data[cupomCodigo.toLowerCase()];
                    if (directCupom && typeof directCupom === 'object') {
                        cupom = { codigo: cupomCodigo, ...directCupom };
                    }
                }

                legacyCupomFound = Boolean(cupom);
            }
        }

        if (!cupom) {
            const legacyDoc = await getLegacyInfoDoc(lojaId).get();
            const legacyCupons = legacyDoc.data()?.cupons;
            if (Array.isArray(legacyCupons)) {
                cupom = legacyCupons.find((item) => item?.codigo?.toUpperCase && item.codigo.toUpperCase() === cupomCodigo) || null;
                legacyCupomFound = Boolean(cupom);
            }
        }

        if (!cupom) {
            return res.status(404).json({ valido: false, mensagem: "Cupom não encontrado." });
        }

        if (legacyCupomFound) {
            const targetId = cupom.id || cupomCodigo.toLowerCase();
            const { id, ...cupomData } = cupom;
            await cuponsCollection.doc(targetId).set({ ...cupomData, codigo: cupomCodigo }, { merge: true });
            cupom = { ...cupomData, codigo: cupomCodigo, id: targetId };
        }

        if (cupom.status !== "Ativo") {
            return res.status(400).json({ valido: false, mensagem: "Este cupom não está ativo." });
        }
        const usosAtuais = typeof cupom.usos === 'number' ? cupom.usos : 0;
        if (cupom.limiteUso && usosAtuais >= cupom.limiteUso) {
            return res.status(400).json({ valido: false, mensagem: "Este cupom atingiu o limite de usos." });
        }
        if (cupom.valorMinimo && totalCarrinho < cupom.valorMinimo) {
            return res.status(400).json({ valido: false, mensagem: `O pedido mínimo para este cupom é de R$ ${cupom.valorMinimo.toFixed(2)}.` });
        }
        
        let valorDesconto = 0;
        if (cupom.tipoDesconto === 'percentual') {
            valorDesconto = (totalCarrinho * cupom.valor) / 100;
        } else {
            valorDesconto = cupom.valor;
        }
        
        cupom.valorDesconto = parseFloat(valorDesconto.toFixed(2));

        res.status(200).json({ valido: true, cupom });

    } catch (error) {
        logger.error("Erro ao verificar cupom:", error);
        res.status(500).send("Erro ao verificar cupom.");
    }
});

// Exporta o app Express como uma Cloud Function HTTP
exports.api = onRequest(app);


exports.createOrder = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário precisa estar autenticado para finalizar pedido.');
  }

  const payload = request.data || {};
  const storeId = payload.storeId || payload.lojaId;
  if (!storeId) {
    throw new HttpsError('invalid-argument', 'storeId é obrigatório.');
  }

  const {status} = await validateStoreOpenOrThrow(storeId);

  const orderData = {
    ...payload,
    lojaId: storeId,
    status: payload.status || 'Pendente',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
    storeStatusAtCheckout: status,
  };

  delete orderData.storeId;

  const docRef = await db.collection('lojas').doc(storeId).collection('pedidos').add(orderData);

  return { id: docRef.id, status: 'Pendente' };
});

// Cria uma nova loja e garante que os dados fiquem isolados por loja
exports.createStore = onCall(async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
        throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
    }

    const requester = await verifyManagementAccess(uid);

    if (![ROLE_OWNER, ROLE_MANAGER].includes(requester.role)) {
        throw new HttpsError('permission-denied', 'Apenas donos ou gerentes podem criar novas lojas.');
    }

    const rawName = typeof request.data?.nome === 'string' ? request.data.nome.trim() : '';
    const rawId = typeof request.data?.storeId === 'string' ? request.data.storeId.trim() : '';

    if (!rawName) {
        throw new HttpsError('invalid-argument', 'Informe o nome da loja.');
    }

    const normalizedId = generateStoreId(rawId || rawName);

    if (!normalizedId || normalizedId === STORE_ALL_KEY) {
        throw new HttpsError('invalid-argument', 'Identificador inválido para a loja.');
    }

    const storeDocRef = db.collection('lojas').doc(normalizedId);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
        const existingDoc = await transaction.get(storeDocRef);

        if (existingDoc.exists) {
            throw new HttpsError('already-exists', 'Já existe uma loja com esse identificador.');
        }

        const storePayload = {
            nome: rawName,
            criadoEm: timestamp,
            criadoPor: uid,
        };

        transaction.set(storeDocRef, storePayload, {merge: true});

        transaction.set(storeDocRef.collection('info').doc(STORE_INFO_DOC_ID), {
            nome: rawName,
            criadoEm: timestamp,
            criadoPor: uid,
        }, {merge: true});

        transaction.set(storeDocRef.collection('meuEspaco').doc('empresa'), {
            nomeFantasia: rawName,
            documento: '',
            contato: { telefone: '', email: '' },
            endereco: {},
            atualizadoEm: timestamp,
            criadoPor: uid,
        }, {merge: true});

        transaction.set(storeDocRef.collection('meuEspaco').doc('ponto'), {
            nome: rawName,
            endereco: {},
            horarioFuncionamento: [],
            atualizadoEm: timestamp,
            criadoPor: uid,
        }, {merge: true});

        const configuracoesDoc = storeDocRef.collection('configuracoes').doc(CONFIG_DOC_ID);

        transaction.set(configuracoesDoc, {
            frete: {
                ativo: false,
                tipo: 'fixo',
                valor: 0,
                valorMinimo: 0,
                atualizadoEm: timestamp,
                criadoPor: uid,
            },
            iniciadoEm: timestamp,
            criadoPor: uid,
        }, {merge: true});
    });

    const profile = await getUserProfile(uid);
    let assignedStoreIds = null;
    let primaryStoreId = profile.lojaId || null;

    if (!requester.allStores) {
        const existingIds = extractStoreIds(profile);
        const updatedStoreIds = Array.from(new Set([...existingIds, normalizedId]));
        const userUpdate = {
            lojaIds: updatedStoreIds,
        };

        if (!profile.lojaId) {
            userUpdate.lojaId = normalizedId;
            primaryStoreId = normalizedId;
        }

        await db.collection('users').doc(uid).set(userUpdate, {merge: true});
        assignedStoreIds = updatedStoreIds;

        if (!primaryStoreId) {
            primaryStoreId = updatedStoreIds[0] || null;
        }
    }

    return {
        storeId: normalizedId,
        storeData: {
            nome: rawName,
        },
        assignedStoreIds,
        primaryStoreId,
        canAccessAllStores: requester.allStores,
    };
});

// --- FUNÇÕES CHAMÁVEIS (CALLABLE FUNCTIONS) PARA GERENCIAMENTO DE USUÁRIOS ---

// Lista todos os usuários
exports.listAllUsers = onCall(async (request) => {
    const requester = await verifyManagementAccess(request.auth?.uid);
    try {
        const listUsersResult = await auth.listUsers(1000);
        const usersFromAuth = listUsersResult.users;
        const usersFromFirestoreSnap = await db.collection("users").get();
        const usersDataFromFirestore = {};
        usersFromFirestoreSnap.forEach((doc) => {
            usersDataFromFirestore[doc.id] = doc.data();
        });

        const customProfilesSnap = await db.collection('customProfiles').get();
        const customProfiles = {};
        customProfilesSnap.forEach((doc) => {
            customProfiles[doc.id] = doc.data();
        });

        const combinedUsers = await Promise.all(usersFromAuth.map(async (userRecord) => {
            const firestoreData = usersDataFromFirestore[userRecord.uid] || {};
            const role = normalizeRole(firestoreData.role);
            const lojaIds = extractStoreIds(firestoreData);
            const lojaId = lojaIds[0] || null;
            const storedProfile = customProfiles[userRecord.uid];
            const permissions = storedProfile
                ? sanitizePermissions(storedProfile.permissions, role)
                : await ensureCustomProfile(userRecord.uid, role);

            if (!storedProfile) {
                customProfiles[userRecord.uid] = {permissions};
            }

            return {
                uid: userRecord.uid,
                email: userRecord.email,
                nome: firestoreData.nome || userRecord.displayName || "Sem nome",
                role,
                lojaId,
                lojaIds,
                permissions,
            };
        }));

        const filteredUsers = combinedUsers.filter((userData) => {
            const targetStores = extractStoreIds(userData);
            if (requester.role === ROLE_OWNER) {
                if (requester.allStores || !requester.stores.length) {
                    return true;
                }
                return userHasAccessToStores(requester.stores, targetStores);
            }
            if (requester.role === ROLE_MANAGER) {
                return userHasAccessToStores(requester.stores, targetStores);
            }
            return false;
        });

        return {users: filteredUsers};
    } catch (error) {
        logger.error("Erro ao listar usuários:", error);
        throw new HttpsError("internal", "Não foi possível listar os usuários.");
    }
});

// Cria um novo usuário
exports.createUser = onCall(async (request) => {
    const requester = await verifyManagementAccess(request.auth?.uid);
    const {email, senha, nome, role, lojaId, lojaIds = [], permissions: requestedPermissions = null} = request.data;
    try {
		if (!email || !senha || !nome) {
            throw new HttpsError("invalid-argument", "Email, senha e nome são obrigatórios.");
        }

        const normalizedRole = normalizeRole(role);

        if (normalizedRole === ROLE_OWNER && requester.role !== ROLE_OWNER) {
            throw new HttpsError("permission-denied", "Somente donos podem criar outros donos.");
        }

        let targetStores = [];
        if (normalizedRole === ROLE_OWNER) {
            targetStores = Array.isArray(lojaIds) ? lojaIds : [];
            if (requester.role === ROLE_OWNER && !requester.allStores && requester.stores.length) {
                if (!userHasAccessToStores(requester.stores, targetStores)) {
                    throw new HttpsError("permission-denied", "Você não pode atribuir lojas fora do seu escopo.");
                }
            }
        } else {
            const primaryStore = lojaId || (Array.isArray(lojaIds) && lojaIds.length ? lojaIds[0] : null);
            if (!primaryStore) {
                throw new HttpsError("invalid-argument", "lojaId é obrigatório para este tipo de usuário.");
            }
            targetStores = Array.isArray(lojaIds) && lojaIds.length ? lojaIds : [primaryStore];
            const requesterStores = requester.role === ROLE_OWNER && requester.allStores ? targetStores : requester.stores;
            if (!userHasAccessToStores(requesterStores, targetStores)) {
                throw new HttpsError("permission-denied", "Você não pode criar usuários para outras lojas.");
            }
        }
        const userRecord = await auth.createUser({
            email,
            password: senha,
            displayName: nome,
        });
        const permissions = await ensureCustomProfile(userRecord.uid, normalizedRole, requestedPermissions);

        await db.collection("users").doc(userRecord.uid).set({
            email,
            nome,
            role: normalizedRole,
            lojaId: targetStores[0] || null,
            lojaIds: targetStores,
            permissions,
        });
        return {uid: userRecord.uid, message: "Usuário criado com sucesso!"};
    } catch (error) {
        logger.error("Erro ao criar usuário:", error);
        throw new HttpsError("internal", `Erro ao criar usuário: ${error.message}`);
    }
});

// Atualiza um usuário
exports.updateUser = onCall(async (request) => {

    const requester = await verifyManagementAccess(request.auth?.uid);
    const { uid, nome, role, email, lojaId, lojaIds = [], permissions: requestedPermissions = null } = request.data;

    if (!uid || !nome || !role || !email) {
        throw new HttpsError("invalid-argument", "Dados incompletos. UID, nome, role e email são obrigatórios.");
    }

    try {

		const normalizedRole = normalizeRole(role);
        if (normalizedRole === ROLE_OWNER && requester.role !== ROLE_OWNER) {
            throw new HttpsError("permission-denied", "Somente donos podem atualizar dados de um dono.");
        }

        const existingProfile = await getUserProfile(uid);
        const existingStores = extractStoreIds(existingProfile);
        const existingRole = normalizeRole(existingProfile.role);

        let targetStores = [];
        if (normalizedRole === ROLE_OWNER) {
            targetStores = Array.isArray(lojaIds) ? lojaIds : existingStores;
        } else {
            const primaryStore = lojaId || (Array.isArray(lojaIds) && lojaIds.length ? lojaIds[0] : existingStores[0]);
            if (!primaryStore) {
                throw new HttpsError("invalid-argument", "lojaId é obrigatório para este tipo de usuário.");
            }
            targetStores = Array.isArray(lojaIds) && lojaIds.length ? lojaIds : [primaryStore];
        }

        const requesterStores = requester.role === ROLE_OWNER && requester.allStores ? targetStores : requester.stores;
        const storesToCheck = targetStores.length ? targetStores : existingStores;

        if (requester.role === ROLE_MANAGER) {
            if (existingRole === ROLE_OWNER || normalizedRole === ROLE_OWNER) {
                throw new HttpsError("permission-denied", "Gerentes não podem atualizar dados de donos.");
            }
            if (!userHasAccessToStores(requesterStores, storesToCheck)) {
                throw new HttpsError("permission-denied", "Você não pode atualizar usuários de outra loja.");
            }
        } else if (requester.role === ROLE_OWNER && !requester.allStores && requester.stores.length) {
            if (!userHasAccessToStores(requester.stores, storesToCheck)) {
                throw new HttpsError("permission-denied", "Você não pode atualizar usuários de outra loja.");
            }
        }

        const authUpdatePayload = {
            displayName: nome,
        };

        const currentUser = await auth.getUser(uid);
        if (currentUser.email !== email) {
            authUpdatePayload.email = email;
        }

        await auth.updateUser(uid, authUpdatePayload);

        const existingPermissions = await getUserPermissions(uid, existingRole);
        const permissions = await ensureCustomProfile(uid, normalizedRole, requestedPermissions || existingPermissions);

        // **CORREÇÃO APLICADA AQUI**
        // Troca `update` por `set` com `merge: true` para evitar erros
        // caso o documento do usuário não exista no Firestore.
        await db.collection("users").doc(uid).set({
            nome: nome,
            role: normalizedRole,
            email: email,
                        lojaId: targetStores[0] || null,
            lojaIds: targetStores,
            permissions,
        }, { merge: true });

        return { message: "Usuário atualizado com sucesso!" };
    } catch (error) {
        logger.error("Erro detalhado ao atualizar usuário:", {
            code: error.code,
            message: error.message,
            uid: uid,
        });
        
        const detailedMessage = `Não foi possível atualizar o usuário. Motivo: ${error.message || 'Erro interno no servidor.'}`;

        if (error.code === "auth/email-already-exists") {
            throw new HttpsError("already-exists", "O email fornecido já está em uso por outro usuário.");
        }
        
        throw new HttpsError("internal", detailedMessage, { originalCode: error.code });
    }
});

// Deleta um usuário
exports.deleteUser = onCall(async (request) => {
    const requester = await verifyManagementAccess(request.auth?.uid);
    const {uid} = request.data;
    try {
		const targetProfile = await getUserProfile(uid);
        const targetStores = extractStoreIds(targetProfile);
        const targetRole = normalizeRole(targetProfile.role);

        if (targetRole === ROLE_OWNER && requester.role !== ROLE_OWNER) {
            throw new HttpsError("permission-denied", "Somente donos podem remover outros donos.");
        }

        const requesterStores = requester.role === ROLE_OWNER && requester.allStores ? targetStores : requester.stores;
        if (requester.role === ROLE_MANAGER && !userHasAccessToStores(requesterStores, targetStores)) {
            throw new HttpsError("permission-denied", "Você não pode remover usuários de outra loja.");
        }

        await auth.deleteUser(uid);
        await db.collection("users").doc(uid).delete();
        await db.collection('customProfiles').doc(uid).delete();
        return {message: "Usuário deletado com sucesso!"};
    } catch (error) {
        logger.error("Erro ao deletar usuário:", error);
        throw new HttpsError("internal", "Não foi possível deletar o usuário.");
    }
});

// Atualiza a senha de um usuário
exports.updateUserPassword = onCall(async (request) => {
    const requester = await verifyManagementAccess(request.auth?.uid);
    const {uid, newPassword} = request.data;
    try {
		const targetProfile = await getUserProfile(uid);
        const targetRole = normalizeRole(targetProfile.role);
        if (targetRole === ROLE_OWNER && requester.role !== ROLE_OWNER) {
            throw new HttpsError("permission-denied", "Somente donos podem alterar a senha de outro dono.");
        }
        if (requester.role === ROLE_MANAGER) {
            const targetStores = extractStoreIds(targetProfile);
            if (!userHasAccessToStores(requester.stores, targetStores)) {
                throw new HttpsError("permission-denied", "Você não pode alterar usuários de outra loja.");
            }
        }
        await auth.updateUser(uid, {password: newPassword});
        return {message: "Senha alterada com sucesso!"};
    } catch (error) {
        logger.error("Erro ao alterar senha:", error);
        throw new HttpsError("internal", "Não foi possível alterar a senha.");
    }
});


exports.notifyNewOrder = onDocumentCreated({
    document: "pedidos/{pedidoId}",
    region: "southamerica-east1",
}, async (event) => {
    const orderData = event.data?.data();

    if (!orderData) {
        logger.warn("Novo pedido criado sem dados. Notificação não enviada.");
        return;
    }

    try {
        const tokensSnapshot = await db.collection("notificationTokens").get();

        if (tokensSnapshot.empty) {
            logger.info("Nenhum token de notificação cadastrado. Ignorando envio de push.");
            return;
        }

        const tokens = tokensSnapshot.docs.map((doc) => doc.id);
        const orderId = String(event.params?.pedidoId || "");
        const status = orderData.status ? String(orderData.status) : "Pendente";
        const customerName = orderData.clienteNome || orderData.nomeCliente || orderData.nome || orderData.cliente?.nome || "";
        const orderCode = orderData.numeroPedido || orderData.codigo || orderData.numero || "";

        const title = "Novo pedido recebido";
        let body = customerName ? `Pedido de ${customerName}` : "Um novo pedido foi recebido.";
        if (orderCode) {
            body = `${body} (#${orderCode})`;
        }

        const message = {
            tokens,
            notification: {
                title,
                body,
            },
            data: {
                orderId,
                status,
                url: "/",
                source: "new-order",
            },
            android: {
                priority: "high",
                notification: {
                    title,
                    body,
                    channelId: "new-orders",
                    sound: "default",
                    clickAction: "FLUTTER_NOTIFICATION_CLICK",
                },
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title,
                            body,
                        },
                        sound: "default",
                        category: "NEW_ORDER",
                    },
                },
            },
            webpush: {
                headers: {
                    Urgency: "high",
                },
                notification: {
                    title,
                    body,
                    icon: "/logo192.png",
                    badge: "/logo192.png",
                    tag: "new-order",
                    renotify: true,
                    vibrate: [200, 100, 200],
                    data: {
                        orderId,
                        url: "/",
                    },
                },
                fcmOptions: {
                    link: "/",
                },
            },
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        const tokensToDelete = [];

        response.responses.forEach((res, index) => {
            if (!res.success) {
                const errorCode = res.error?.code;
                logger.error("Falha ao enviar notificação push:", res.error);

                if (errorCode === "messaging/registration-token-not-registered" || errorCode === "messaging/invalid-registration-token") {
                    tokensToDelete.push(tokens[index]);
                }
            }
        });

        if (tokensToDelete.length > 0) {
            await Promise.all(tokensToDelete.map((token) => db.collection("notificationTokens").doc(token).delete().catch((error) => {
                logger.error("Erro ao remover token inválido:", error);
            })));
        }
    } catch (error) {
        logger.error("Erro ao enviar notificações de novo pedido:", error);
    }
});