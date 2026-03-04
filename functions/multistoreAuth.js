const crypto = require('crypto');
const {HttpsError} = require('firebase-functions/v2/https');

const IMPERSONATION_HEADER = 'x-impersonation-token';
const TOKEN_TTL_SECONDS = 15 * 60;

const base64url = (input) => Buffer.from(input).toString('base64url');
const fromBase64url = (input) => Buffer.from(input, 'base64url').toString('utf8');

const getImpersonationSecret = () => process.env.IMPERSONATION_JWT_SECRET || (process.env.FUNCTIONS_EMULATOR ? 'dev-impersonation-secret' : 'change-me');

const normalizeRole = (role) => {
  const value = String(role || '').toLowerCase();
  if (["admin", "franqueador", "gerente", "atendente", "cliente"].includes(value)) return value;
  if (value === 'dono' || value === 'owner') return 'admin';
  return 'cliente';
};

const getUserById = async (db, userId) => {
  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }
  return {id: userId, ...snap.data(), role: normalizeRole(snap.data().role)};
};

const getAllowedStoreIds = async (db, userId) => {
  const user = await getUserById(db, userId);
  if (user.role === 'admin') {
    const storesSnapshot = await db.collection('stores').where('isActive', '==', true).get();
    return storesSnapshot.docs.map((doc) => doc.id);
  }

  if (user.role === 'franqueador') {
    const franchiseIds = await getAllowedFranchiseIds(db, userId);
    if (!franchiseIds.length) return [];
    const storesByFranchise = await Promise.all(franchiseIds.map((franchiseId) => db.collection('stores').where('franchiseId', '==', franchiseId).where('isActive', '==', true).get()));
    return storesByFranchise.flatMap((snapshot) => snapshot.docs.map((doc) => doc.id));
  }

  if (user.role === 'gerente' || user.role === 'atendente') {
    const memberships = await db.collection('user_store_memberships').where('userId', '==', userId).get();
    return memberships.docs.map((doc) => doc.data().storeId).filter(Boolean);
  }

  return [];
};

const getAllowedFranchiseIds = async (db, userId) => {
  const user = await getUserById(db, userId);
  if (user.role === 'admin') {
    const snapshot = await db.collection('franchises').get();
    return snapshot.docs.map((doc) => doc.id);
  }

  if (user.role === 'franqueador') {
    const memberships = await db.collection('user_franchise_memberships').where('userId', '==', userId).where('franchiseRole', '==', 'franqueador').get();
    return memberships.docs.map((doc) => doc.data().franchiseId).filter(Boolean);
  }

  const allowedStores = await getAllowedStoreIds(db, userId);
  if (!allowedStores.length) return [];
  const storeSnaps = await Promise.all(allowedStores.map((storeId) => db.collection('stores').doc(storeId).get()));
  return [...new Set(storeSnaps.filter((snap) => snap.exists).map((snap) => snap.data().franchiseId).filter(Boolean))];
};

const canAccessStore = async (db, user, storeId) => {
  if (!storeId) return false;
  const role = normalizeRole(user.role);
  if (role === 'admin') return true;
  const allowedStoreIds = await getAllowedStoreIds(db, user.id);
  if (role === 'atendente' && allowedStoreIds.length !== 1) return false;
  return allowedStoreIds.includes(storeId);
};

const canAccessFranchise = async (db, user, franchiseId) => {
  if (!franchiseId) return false;
  if (normalizeRole(user.role) === 'admin') return true;
  const allowedFranchiseIds = await getAllowedFranchiseIds(db, user.id);
  return allowedFranchiseIds.includes(franchiseId);
};

const signPayload = (payload) => {
  const header = {alg: 'HS256', typ: 'JWT'};
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac('sha256', getImpersonationSecret()).update(data).digest('base64url');
  return `${data}.${signature}`;
};

const verifyImpersonationToken = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new HttpsError('unauthenticated', 'Token de emulação inválido.');
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  const data = `${headerPart}.${payloadPart}`;
  const expected = crypto.createHmac('sha256', getImpersonationSecret()).update(data).digest('base64url');
  if (expected !== signaturePart) {
    throw new HttpsError('unauthenticated', 'Assinatura de token inválida.');
  }
  const payload = JSON.parse(fromBase64url(payloadPart));
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    throw new HttpsError('unauthenticated', 'Token de emulação expirado.');
  }
  return payload;
};

const createImpersonationToken = ({actorId, subjectId}) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    actorId,
    subjectId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    jti: crypto.randomUUID(),
    nonce: crypto.randomUUID(),
  };

  return {
    token: signPayload(payload),
    expiresInSeconds: TOKEN_TTL_SECONDS,
    jti: payload.jti,
  };
};

const authenticateActor = async (req, auth, db) => {
  const authorization = req.headers.authorization || '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!idToken) {
    throw new HttpsError('unauthenticated', 'Authorization Bearer token é obrigatório.');
  }
  const decoded = await auth.verifyIdToken(idToken);
  const actor = await getUserById(db, decoded.uid);
  return actor;
};

const resolveRequestPrincipal = async (req, auth, db) => {
  const actor = await authenticateActor(req, auth, db);
  const impersonationToken = req.headers[IMPERSONATION_HEADER];

  if (!impersonationToken) {
    return {actor, subject: null, effectiveUser: actor, impersonation: null};
  }

  const payload = verifyImpersonationToken(impersonationToken);
  if (payload.actorId !== actor.id) {
    throw new HttpsError('permission-denied', 'Token de emulação não pertence ao ator autenticado.');
  }
  if (normalizeRole(actor.role) !== 'admin') {
    throw new HttpsError('permission-denied', 'Apenas admin pode emular usuários.');
  }

  const subject = await getUserById(db, payload.subjectId);

  return {
    actor,
    subject,
    effectiveUser: subject,
    impersonation: payload,
  };
};

const auditLog = async (db, req, event) => {
  await db.collection('audit_logs').add({
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    subjectId: event.subjectId || null,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId || null,
    storeId: event.storeId || null,
    franchiseId: event.franchiseId || null,
    ip: req.headers['x-forwarded-for'] || req.ip || null,
    userAgent: req.headers['user-agent'] || null,
    metadata: event.metadata || null,
  });
};

const withAuthorization = ({requireStore = false, requireFranchise = false, allowClientSelf = false} = {}) => async (req, res, next) => {
  try {
    const principal = await resolveRequestPrincipal(req, req.app.locals.auth, req.app.locals.db);
    const requestedStoreId = req.query.storeId || req.body.storeId || req.params.storeId || null;
    const requestedFranchiseId = req.query.franchiseId || req.body.franchiseId || req.params.franchiseId || null;

    if (allowClientSelf && normalizeRole(principal.effectiveUser.role) === 'cliente') {
      req.principal = {...principal, requestedStoreId, requestedFranchiseId};
      return next();
    }

    if (requireStore && !(await canAccessStore(req.app.locals.db, principal.effectiveUser, requestedStoreId))) {
      throw new HttpsError('permission-denied', 'Usuário sem acesso à loja solicitada.');
    }

    if (requireFranchise && !(await canAccessFranchise(req.app.locals.db, principal.effectiveUser, requestedFranchiseId))) {
      throw new HttpsError('permission-denied', 'Usuário sem acesso à franquia solicitada.');
    }

    req.principal = {...principal, requestedStoreId, requestedFranchiseId};
    next();
  } catch (error) {
    const status = error.code === 'permission-denied' ? 403 : (error.code === 'unauthenticated' ? 401 : 400);
    res.status(status).json({message: error.message || 'Falha de autorização.'});
  }
};

module.exports = {
  TOKEN_TTL_SECONDS,
  normalizeRole,
  getUserById,
  getAllowedStoreIds,
  getAllowedFranchiseIds,
  canAccessStore,
  canAccessFranchise,
  createImpersonationToken,
  verifyImpersonationToken,
  resolveRequestPrincipal,
  withAuthorization,
  auditLog,
};
