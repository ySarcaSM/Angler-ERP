// ═══════════════════════════════════════════
// Firebase Auth Service
// ═══════════════════════════════════════════

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

// ─── Register ───
export async function register({ email, password, name, lastName, companyName }) {
  // Create Firebase Auth user
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // Update display name
  await updateProfile(user, { displayName: `${name} ${lastName || ''}`.trim() });

  // Firebase sends the verification link once during account creation.
  await sendEmailVerification(user);

  // Create company document
  const companyRef = doc(db, 'companies', user.uid);
  await setDoc(companyRef, {
    name: companyName,
    createdAt: serverTimestamp(),
    plan: 'trial',
    ownerUid: user.uid,
    settings: {
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
      taxRegime: 'simples',
      lowStockThreshold: 10,
    },
  });

  // Create user document
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    email,
    name,
    lastName: lastName || '',
    role: 'owner',
    companyId: user.uid, // Owner's company = their uid
    active: true,
    createdAt: serverTimestamp(),
  });

  await signOut(auth);

  return { user, companyId: user.uid };
}

// ─── Login ───
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  if (!cred.user.emailVerified) {
    await signOut(auth);
    const error = new Error('Verifique seu email antes de entrar.');
    error.code = 'auth/email-not-verified';
    throw error;
  }

  return cred.user;
}

// ─── Logout ───
export async function logout() {
  await signOut(auth);
}

// ─── Reset Password ───
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ─── Get current user data from Firestore ───
export async function getUserData(uid) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;
  return { id: userDoc.id, ...userDoc.data() };
}

// ─── Get company data ───
export async function getCompanyData(companyId) {
  const companyDoc = await getDoc(doc(db, 'companies', companyId));
  if (!companyDoc.exists()) return null;
  return { id: companyDoc.id, ...companyDoc.data() };
}

// ─── Auth state listener ───
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
