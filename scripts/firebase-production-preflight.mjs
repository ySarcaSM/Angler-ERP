// Inspecao exclusivamente de leitura do Firebase original.
// Executar somente em maquina administrativa confiavel. Nao altera Auth ou Firestore.
// NUNCA armazene credenciais de servico no repositorio.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { cert, applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getSecurityRules } from 'firebase-admin/security-rules';

if (process.argv.includes('--help')) {
  console.log('Configure EXPECTED_FIREBASE_PROJECT_ID e FIREBASE_SERVICE_ACCOUNT_JSON ou GOOGLE_APPLICATION_CREDENTIALS. Execute: node scripts/firebase-production-preflight.mjs');
  process.exit(0);
}
if (process.argv.length > 2) {
  throw new Error('Este comando suporta somente --help. Nao existem modos de escrita.');
}
const projectId = String(process.env.EXPECTED_FIREBASE_PROJECT_ID || '').trim();
if (!/^[a-z][a-z0-9-]{4,29}$/.test(projectId)) {
  throw new Error('Defina EXPECTED_FIREBASE_PROJECT_ID com o ID exato do projeto Firebase original.');
}
const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const serviceAccount = rawServiceAccount ? JSON.parse(rawServiceAccount) : null;
if (serviceAccount && serviceAccount.project_id !== projectId) {
  throw new Error('BLOQUEADO: a credencial pertence a um projeto diferente do esperado.');
}
if (!serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('Faltou uma credencial administrativa. Configure-a apenas na maquina confiavel.');
}
const app = initializeApp({
  projectId,
  credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
});
const ruleset = await getSecurityRules(app).getFirestoreRuleset();
if (!ruleset?.name || !ruleset.source?.length) {
  throw new Error('Nao foi possivel obter a versao ativa das regras. Nada foi alterado.');
}
const backupDir = resolve('backups/firebase-rules');
await mkdir(backupDir, { recursive: true, mode: 0o700 });
const file = join(backupDir, projectId + '-' + Date.now() + '.json');
await writeFile(file, JSON.stringify({
  projectId, rulesetName: ruleset.name, savedAt: new Date().toISOString(),
  source: ruleset.source,
}, null, 2), { mode: 0o600, flag: 'wx' });
console.log('Backup local das regras atuais:', file);
console.log('Versao de regras publicada:', ruleset.name);

const db = getFirestore(app);
// Limite de leitura para evitar varredura cara e inesperada em producao.
// A amostragem NUNCA comprova 100% de compatibilidade quando truncada.
const users = await db.collection('users')
  .select('uid', 'companyId', 'personalCompanyId', 'memberships')
  .limit(501).get();
const sampled = users.docs.slice(0, 500);
const checks = {
  examined: sampled.length,
  incompleteSample: users.size > 500,
  missingOrInactiveCompanyMembership: 0,
  missingPersonalMembership: 0,
  mismatchProfileUid: 0,
};
for (const item of sampled) {
  const data = item.data();
  const companyId = typeof data.companyId === 'string' ? data.companyId : '';
  const personalId = typeof data.personalCompanyId === 'string'
    ? data.personalCompanyId : item.id;
  const memberships = data.memberships && typeof data.memberships === 'object'
    ? data.memberships : {};
  if (!companyId || memberships[companyId]?.active !== true) {
    checks.missingOrInactiveCompanyMembership++;
  }
  if (!personalId || memberships[personalId]?.personal !== true
    || memberships[personalId]?.active !== true) {
    checks.missingPersonalMembership++;
  }
  if (data.uid !== item.id) checks.mismatchProfileUid++;
}
let adminAccountCheck = 'not_configured';
if (process.env.SUPERADMIN_UID) {
  const user = await getAuth(app).getUser(process.env.SUPERADMIN_UID).catch(err => {
    if (err.code === 'auth/user-not-found') return null;
    throw err;
  });
  adminAccountCheck = !user ? 'missing_auth_account'
    : user.customClaims?.superadmin === true ? 'claim_present' : 'claim_absent';
}
console.log('Preflight (contagens, sem dados pessoais):', JSON.stringify({
  ...checks,
  superadmin: adminAccountCheck,
}, null, 2));
if (checks.incompleteSample || checks.missingOrInactiveCompanyMembership
  || checks.missingPersonalMembership || checks.mismatchProfileUid
  || adminAccountCheck === 'missing_auth_account') {
  console.error('NAO PUBLICAR REGRAS: ha incompatibilidade ou amostra incompleta. Migrar e validar antes.');
  process.exitCode = 2;
} else {
  console.log('Nenhuma incompatibilidade encontrada NA AMOSTRA. Ainda faltam testes de fluxo real.');
}
