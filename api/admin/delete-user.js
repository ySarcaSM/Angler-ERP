// Endpoint privilegiado: NUNCA expor FIREBASE_SERVICE_ACCOUNT_JSON no frontend.
// Firebase Admin SDK ignora regras Firestore; a autorização depende de verifyIdToken.
import admin from 'firebase-admin';

export const config = { maxDuration: 60 };

function firebaseAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('Credencial de serviço não configurada.');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return { auth: admin.auth(), db: admin.firestore() };
}

const TENANT_COLLECTIONS = [
  'clients','products','sales','purchases','suppliers','locations',
  'financialTransactions','stockMovements','budgets','formulas','auditLogs',
  'deletionRequests','companyAccessRequests','companyMembers',
  'companyInvitations','assistantChats','weeklyReports',
];

async function deleteMatchingDocuments(db, collectionName, filter, value) {
  const collectionRef = db.collection(collectionName);
  let deleted = 0;
  // Leitura paginada: o resultado muda durante as exclusões, então não há offset.
  for (;;) {
    const snapshot = await collectionRef.where(filter, '==', value).limit(100).get();
    if (snapshot.empty) break;
    for (const item of snapshot.docs) {
      await db.recursiveDelete(item.ref);
      deleted++;
    }
  }
  return deleted;
}

async function deleteOwnedCompany(db, companyId) {
  let deleted = 0;
  for (const collectionName of TENANT_COLLECTIONS) {
    deleted += await deleteMatchingDocuments(db, collectionName, 'companyId', companyId);
  }
  await db.recursiveDelete(db.doc(`counters/${companyId}`));
  await db.recursiveDelete(db.doc(`companies/${companyId}`));

  // Remover membros órfãos de perfis pessoais externos.
  const users = await db.collection('users').get();
  for (const user of users.docs) {
    if (user.data().memberships?.[companyId]) {
      await user.ref.update(
        new admin.firestore.FieldPath('memberships', companyId),
        admin.firestore.FieldValue.delete(),
        'updatedAt',
        admin.firestore.FieldValue.serverTimestamp(),
      );
    }
  }
  return deleted;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const header = String(req.headers.authorization || '');
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Autenticação obrigatória.' });
    const { auth, db } = firebaseAdmin();
    const actor = await auth.verifyIdToken(header.slice(7), true);
    if (actor.superadmin !== true) return res.status(403).json({ error: 'Permissão superadmin obrigatória.' });

    const userId = String(req.body?.userId || '').trim();
    if (!userId || userId.length > 128 || userId.includes('/')) {
      return res.status(400).json({ error: 'UID inválido.' });
    }
    if (actor.uid === userId) return res.status(403).json({ error: 'Não é permitido excluir a própria conta superadmin.' });

    const targetAuth = await auth.getUser(userId).catch((error) => {
      if (error.code === 'auth/user-not-found') return null;
      throw error;
    });
    if (targetAuth?.customClaims?.superadmin === true) {
      return res.status(403).json({ error: 'Outra conta superadmin não pode ser excluída por esta operação.' });
    }

    const userRef = db.doc(`users/${userId}`);
    const profile = await userRef.get();
    if (!profile.exists()) {
      return res.status(404).json({ error: 'Perfil Firestore ausente. Necessária reconciliação manual antes de excluir a identidade Auth.' });
    }
    const data = profile.data();
    const owned = await db.collection('companies').where('ownerUid', '==', userId).get();
    const ownedCompanyIds = new Set(owned.docs.map((item) => item.id));
    if (data.personalCompanyId === userId) ownedCompanyIds.add(userId);

    let deletedRecords = 0;
    for (const companyId of ownedCompanyIds) {
      deletedRecords += await deleteOwnedCompany(db, companyId);
    }

    // Revogar associações de empresa externa e solicitações enviadas.
    deletedRecords += await deleteMatchingDocuments(db, 'companyMembers', 'userId', userId);
    deletedRecords += await deleteMatchingDocuments(db, 'companyAccessRequests', 'requesterUid', userId);
    // Histórico de auditoria de empresas externas é preservado para conformidade.
    await db.recursiveDelete(userRef);
    if (targetAuth) await auth.deleteUser(userId);

    return res.status(200).json({
      deleted: true, firestore: true, auth: Boolean(targetAuth),
      authDetail: targetAuth ? 'deleted' : 'already_missing',
      ownedCompanies: [...ownedCompanyIds], deletedRecords,
    });
  } catch (error) {
    console.error('[delete-user]', error);
    return res.status(500).json({ error: 'Não foi possível concluir a exclusão. Verifique logs e tente novamente; parte dos dados pode ter sido excluída.' });
  }
}
