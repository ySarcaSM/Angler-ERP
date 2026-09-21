import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

const CHATS = 'assistantChats';

const toMillis = (value) => (value?.toMillis ? value.toMillis() : 0);

export function subscribeAssistantChats(companyId, userId, callback, onError) {
  const chatsQuery = query(
    collection(db, CHATS),
    where('companyId', '==', companyId),
    where('userId', '==', userId),
  );
  return onSnapshot(chatsQuery, (snapshot) => {
    callback(snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)));
  }, onError);
}

export function subscribeAssistantMessages(chatId, callback, onError) {
  return onSnapshot(collection(db, CHATS, chatId, 'messages'), (snapshot) => {
    callback(snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)));
  }, onError);
}

export async function createAssistantChat({ companyId, userId }) {
  const reference = await addDoc(collection(db, CHATS), {
    companyId,
    userId,
    title: 'Nova conversa',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function addAssistantMessage(chatId, { role, content }) {
  await addDoc(collection(db, CHATS, chatId, 'messages'), {
    role,
    content,
    createdAt: serverTimestamp(),
  });
}

export async function updateAssistantChat(chatId, data) {
  await updateDoc(doc(db, CHATS, chatId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteAssistantChat(chatId) {
  const messagesReference = collection(db, CHATS, chatId, 'messages');
  const snapshot = await getDocs(messagesReference);
  const messages = snapshot.docs;

  // Firestore batches accept at most 500 operations. Delete messages first so
  // the ownership rule on the parent chat remains available throughout.
  for (let index = 0; index < messages.length; index += 500) {
    const batch = writeBatch(db);
    messages.slice(index, index + 500).forEach((message) => batch.delete(message.ref));
    await batch.commit();
  }

  await deleteDoc(doc(db, CHATS, chatId));
}

export async function deleteEmptyAssistantChats(chats) {
  const results = await Promise.all(chats.map(async (chat) => {
    const messages = await getDocs(collection(db, CHATS, chat.id, 'messages'));
    if (!messages.empty) return null;
    await deleteDoc(doc(db, CHATS, chat.id));
    return chat.id;
  }));

  return results.filter(Boolean);
}
