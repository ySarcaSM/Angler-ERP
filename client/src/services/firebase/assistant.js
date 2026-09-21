import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where,
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
