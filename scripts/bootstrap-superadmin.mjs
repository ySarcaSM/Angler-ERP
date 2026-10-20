// Execute somente em um ambiente administrativo confiável; NUNCA no browser.
import admin from 'firebase-admin';

const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const uid = process.env.SUPERADMIN_UID;
if (!json || !uid) {
  throw new Error('Defina FIREBASE_SERVICE_ACCOUNT_JSON e SUPERADMIN_UID em ambiente seguro.');
}
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
}
const user = await admin.auth().getUser(uid);
const claims = user.customClaims || {};
await admin.auth().setCustomUserClaims(uid, { ...claims, superadmin: true });
await admin.auth().revokeRefreshTokens(uid);
console.log('Claim superadmin concedida. Faça novo login em /admin/login.');
