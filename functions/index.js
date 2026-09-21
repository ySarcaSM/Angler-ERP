const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

const db = getFirestore();
const auth = getAuth();

function isSuperadmin(context, adminSnapshot) {
  return Boolean(
    context.auth &&
    (
      context.auth.token?.email === 'admin@angler-erp.local' ||
      adminSnapshot?.data()?.role === 'superadmin'
    )
  );
}

async function deleteQueryDocuments(querySnapshot) {
  for (const snapshot of querySnapshot.docs) {
    await db.recursiveDelete(snapshot.ref);
  }
}

async function deleteCompanyData(companyId, deletedUid) {
  // Remove the external membership from every remaining user first.
  const usersSnapshot = await db.collection('users').get();
  for (const userDoc of usersSnapshot.docs) {
    if (userDoc.id === deletedUid) continue;
    const memberships = userDoc.data().memberships || {};
    if (Object.prototype.hasOwnProperty.call(memberships, companyId)) {
      await userDoc.ref.update({
        [`memberships.${companyId}`]: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  // Remove legacy/root membership and access-request indexes.
  await deleteQueryDocuments(
    await db.collection('companyMembers').where('companyId', '==', companyId).get()
  );
  await deleteQueryDocuments(
    await db.collection('companyAccessRequests').where('companyId', '==', companyId).get()
  );
  await deleteQueryDocuments(
    await db.collection('deletionRequests').where('companyId', '==', companyId).get()
  );

  // Delete every root document belonging to this company, including nested
  // subcollections. This keeps future company-scoped collections from being
  // accidentally left behind.
  const protectedCollections = new Set([
    'users',
    'companies',
    'companyMembers',
    'companyAccessRequests',
    'deletionRequests',
  ]);
  const rootCollections = await db.listCollections();
  for (const collection of rootCollections) {
    if (protectedCollections.has(collection.id)) continue;
    const snapshot = await collection.where('companyId', '==', companyId).get();
    await deleteQueryDocuments(snapshot);
  }

  // This also removes companies/{companyId}/members and any other nested
  // documents that do not expose companyId at the root.
  await db.recursiveDelete(db.collection('companies').doc(companyId));
}

exports.deleteUserAccount = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'Administrador não autenticado.');
    }

    const adminSnapshot = await db.collection('users').doc(context.auth.uid).get();
    if (!isSuperadmin(context, adminSnapshot)) {
      throw new functions.https.HttpsError('permission-denied', 'Somente o superadmin pode excluir contas.');
    }

    const userId = String(data?.userId || '').trim();
    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'Informe o UID da conta.');
    }
    if (userId === context.auth.uid) {
      throw new functions.https.HttpsError('failed-precondition', 'A conta do superadmin não pode ser excluída por este fluxo.');
    }

    const userRef = db.collection('users').doc(userId);
    const userSnapshot = await userRef.get();
    if (!userSnapshot.exists) {
      // Still remove a possible orphan Firebase Auth account.
      try {
        await auth.deleteUser(userId);
      } catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
      }
      return { deleted: true, firestore: false, auth: true, ownedCompanies: [] };
    }

    const ownedCompaniesSnapshot = await db.collection('companies')
      .where('ownerUid', '==', userId)
      .get();
    const ownedCompanies = ownedCompaniesSnapshot.docs.map((item) => item.id);

    // Delete all companies owned by this account. External companies that the
    // account only joined are preserved.
    for (const companyId of ownedCompanies) {
      await deleteCompanyData(companyId, userId);
    }

    // Remove all remaining access/request indexes belonging to the deleted user.
    await deleteQueryDocuments(
      await db.collection('companyMembers').where('userId', '==', userId).get()
    );
    await deleteQueryDocuments(
      await db.collection('companyAccessRequests').where('requesterUid', '==', userId).get()
    );

    // Remove the account document and any future subcollections.
    await db.recursiveDelete(userRef);

    // Finally remove the Firebase Authentication account so the email/UID is
    // actually deleted and cannot remain as a stale login identity.
    try {
      await auth.deleteUser(userId);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }

    return {
      deleted: true,
      firestore: true,
      auth: true,
      ownedCompanies,
    };
  });
