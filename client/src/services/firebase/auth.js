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
  doc, setDoc, getDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

const REGISTRATION_SESSION_KEY = 'angler_registration_in_progress';

function isFirestoreUnavailable(error) {
  return error?.code === 'unavailable' || /client is offline/i.test(error?.message || '');
}

function firestoreUnavailableError() {
  const error = new Error('Não foi possível conectar ao Firestore. Verifique sua internet e confirme que o Cloud Firestore está criado e habilitado no projeto Firebase.');
  error.code = 'auth/firestore-unavailable';
  return error;
}

export function isRegistrationInProgress() {
  return sessionStorage.getItem(REGISTRATION_SESSION_KEY) === 'true';
}

// ─── Register ───
async function registerInternal({
  // Account
  email, password, name, lastName,
  // Company
  companyName, razaoSocial, cnpj, sector, address, companyEmail, companyPhone,
  // Modules
  enabledModules,
}) {
  // Reaproveita uma conta Auth sem perfil apenas quando o documento foi
  // removido pelo administrador. Isso permite recadastrar sem serviço pago.
  let cred;
  let existingAuthAccount = false;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (error.code !== 'auth/email-already-in-use') throw error;

    try {
      cred = await signInWithEmailAndPassword(auth, email, password);
      existingAuthAccount = true;
    } catch {
      await sendPasswordResetEmail(auth, email);
      const recoveryError = new Error(
        'Este email já possui uma conta. Enviamos um link para redefinir a senha; depois, entre usando a nova senha.'
      );
      recoveryError.code = 'auth/account-recovery-required';
      throw recoveryError;
    }

    let existingUser = null;
    try {
      existingUser = await getDoc(doc(db, 'users', cred.user.uid));
    } catch (firestoreError) {
      if (firestoreError.code === 'permission-denied') {
        // A autenticação já confirmou a posse da conta. Continua para recriar
        // o perfil removido, mesmo se a regra antiga bloquear este get.
        console.warn('[Register] Perfil não pôde ser consultado; tentando recriá-lo.');
      } else if (isFirestoreUnavailable(firestoreError)) {
        await signOut(auth);
        throw firestoreUnavailableError();
      } else {
        await signOut(auth);
        throw firestoreError;
      }
    }
    if (existingUser?.exists()) {
      await signOut(auth);
      throw error;
    }
  }

  const user = cred.user;

  // Update display name
  await updateProfile(user, { displayName: `${name} ${lastName || ''}`.trim() });

  if (!user.emailVerified && !existingAuthAccount) {
    await sendEmailVerification(user);
  }

  // Create company document
  const companyRef = doc(db, 'companies', user.uid);
  try {
    await setDoc(companyRef, {
      name: companyName,
      razaoSocial: razaoSocial || '',
      cnpj: cnpj || '',
      sector: sector || '',
      address: address || '',
      companyEmail: companyEmail || '',
      companyPhone: companyPhone || '',
      createdAt: serverTimestamp(),
      plan: 'trial',
      ownerUid: user.uid,
      settings: {
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        taxRegime: 'simples',
        lowStockThreshold: 10,
      },
      modules: {
        enabled: enabledModules || [
          'clients', 'products', 'sales', 'purchases', 'suppliers', 'locations', 'financial', 'stock', 'reports',
          'assistant', 'measurement', 'formulas', 'budgets',
        ],
      },
    });
  } catch (error) {
    await signOut(auth);
    if (error.code === 'permission-denied') {
      const companyError = new Error('Permissão negada ao criar a empresa. Publique as regras do Firestore no projeto correto.');
      companyError.code = 'auth/company-write-denied';
      throw companyError;
    }
    if (isFirestoreUnavailable(error)) throw firestoreUnavailableError();
    throw error;
  }

  // Create user document
  const userRef = doc(db, 'users', user.uid);
  try {
    await setDoc(userRef, {
      uid: user.uid,
      email,
      name,
      lastName: lastName || '',
      role: 'owner',
      companyId: user.uid, // Owner's company = their uid
      active: true,
      requiresEmailVerification: !existingAuthAccount,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    await signOut(auth);
    if (error.code === 'permission-denied') {
      const userError = new Error('Permissão negada ao criar o perfil. Publique as regras do Firestore no projeto correto.');
      userError.code = 'auth/profile-write-denied';
      throw userError;
    }
    if (isFirestoreUnavailable(error)) throw firestoreUnavailableError();
    throw error;
  }

  await signOut(auth);

  return { user, companyId: user.uid, requiresEmailVerification: !existingAuthAccount };
}

export async function register(data) {
  sessionStorage.setItem(REGISTRATION_SESSION_KEY, 'true');
  try {
    return await registerInternal(data);
  } finally {
    sessionStorage.removeItem(REGISTRATION_SESSION_KEY);
  }
}

// ─── Login ───
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
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
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return null;
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    if (isFirestoreUnavailable(error)) throw firestoreUnavailableError();
    throw error;
  }
}

export async function joinCompany({ invitation, name, lastName, password }) {
  sessionStorage.setItem(REGISTRATION_SESSION_KEY, 'true');
  try {
    const email = invitation.email.trim().toLowerCase();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = credential.user;

    await updateProfile(newUser, { displayName: `${name} ${lastName || ''}`.trim() });
    if (!newUser.emailVerified) await sendEmailVerification(newUser);

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', newUser.uid), {
      uid: newUser.uid,
      email,
      name,
      lastName: lastName || '',
      role: invitation.role,
      companyId: invitation.companyId,
      invitationId: invitation.id,
      active: true,
      requiresEmailVerification: true,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'companyInvitations', invitation.id), {
      status: 'accepted',
      acceptedBy: newUser.uid,
      acceptedAt: serverTimestamp(),
    });
    await batch.commit();
    await signOut(auth);
    return { email };
  } catch (error) {
    if (auth.currentUser) await signOut(auth);
    throw error;
  } finally {
    sessionStorage.removeItem(REGISTRATION_SESSION_KEY);
  }
}

// ─── Get company data ───
export async function getCompanyData(companyId) {
  try {
    const companyDoc = await getDoc(doc(db, 'companies', companyId));
    if (!companyDoc.exists()) return null;
    return { id: companyDoc.id, ...companyDoc.data() };
  } catch (error) {
    if (isFirestoreUnavailable(error)) throw firestoreUnavailableError();
    throw error;
  }
}

// ─── Auth state listener ───
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
