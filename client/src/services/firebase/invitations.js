import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export async function getCompanyInvitation(invitationId) {
  const snapshot = await getDoc(doc(db, 'companyInvitations', invitationId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}
