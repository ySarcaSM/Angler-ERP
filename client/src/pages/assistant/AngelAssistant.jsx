import React, { useEffect, useMemo, useState } from 'react';
import { Bot, KeyRound, MessageCircle, Plus, Send, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';
import PageHeader from '../../components/ui/PageHeader';
import {
  addAssistantMessage, createAssistantChat, subscribeAssistantChats,
  subscribeAssistantMessages, updateAssistantChat,
} from '../../services/firebase/assistant';
import { askAngel } from '../../services/gemini';
import { getReadOnlyListAnswer, loadAngelReadContext } from '../../services/angelContext';

const apiKeyStorageKey = (companyId, userId) => `angler-gemini-key-${companyId}-${userId}`;

function renderMessageText(text) {
  return String(text || '').split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g).map((part, index) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export default function AngelAssistant() {
  const { company, user } = useAuth();
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!company?.id || !user?.uid) return undefined;
    setApiKey(localStorage.getItem(apiKeyStorageKey(company.id, user.uid)) || '');
    return subscribeAssistantChats(company.id, user.uid, setChats, () => toast.error('Não foi possível carregar suas conversas.'));
  }, [company?.id, user?.uid]);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return undefined;
    }
    return subscribeAssistantMessages(activeChatId, setMessages, () => toast.error('Não foi possível carregar as mensagens.'));
  }, [activeChatId]);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId), [chats, activeChatId]);
  const isFreePlan = ['free', 'trial'].includes(String(company?.plan || 'free').toLowerCase());

  const saveApiKey = (value) => {
    setApiKey(value);
    if (company?.id && user?.uid) localStorage.setItem(apiKeyStorageKey(company.id, user.uid), value.trim());
  };

  const createChat = async () => {
    if (!company?.id || !user?.uid) return;
    try {
      const id = await createAssistantChat({ companyId: company.id, userId: user.uid });
      setActiveChatId(id);
    } catch (error) {
      toast.error('Não foi possível criar a conversa.');
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const content = message.trim();
    if (!content || sending) return;
    if (!apiKey.trim()) {
      toast.error('Informe sua chave da API Gemini antes de conversar com a Angel.');
      setKeyVisible(true);
      return;
    }

    setSending(true);
    setMessage('');
    let chatId = activeChatId;
    try {
      if (!chatId) {
        chatId = await createAssistantChat({ companyId: company.id, userId: user.uid });
        setActiveChatId(chatId);
      }

      await addAssistantMessage(chatId, { role: 'user', content });
      if (activeChat?.title === 'Nova conversa' || !activeChat) {
        await updateAssistantChat(chatId, { title: content.slice(0, 46) });
      } else {
        await updateAssistantChat(chatId, {});
      }

      const readContext = await loadAngelReadContext(company);
      const answer = getReadOnlyListAnswer(content, readContext) || await askAngel({
        apiKey: apiKey.trim(),
        history: messages,
        message: content,
        plan: company.plan,
        readContext,
      });
      await addAssistantMessage(chatId, { role: 'assistant', content: answer });
      await updateAssistantChat(chatId, {});
    } catch (error) {
      toast.error(error.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Angel Personal Assistant" subtitle="Sua assistente especializada no Angler ERP" />

      <div className="card overflow-hidden">
        <div className="border-b border-dark-700/50 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-400/10 flex items-center justify-center"><Sparkles size={20} className="text-primary-300" /></div>
            <div><div className="text-sm font-semibold text-dark-100">Angel está pronta para ajudar</div><div className="text-xs text-dark-500">{isFreePlan ? 'Plano Free: consulta de dados somente para leitura' : 'Respostas limitadas ao contexto do Angler ERP'}</div></div>
          </div>
          <button type="button" onClick={() => setKeyVisible((value) => !value)} className="btn-secondary"><KeyRound size={16} /> Chave Gemini</button>
        </div>

        {keyVisible && (
          <div className="p-4 border-b border-dark-700/50 bg-dark-900/40">
            <label className="text-sm font-medium text-dark-200" htmlFor="gemini-key">Chave da API Gemini</label>
            <div className="flex gap-2 mt-2">
              <input id="gemini-key" type="password" value={apiKey} onChange={(event) => saveApiKey(event.target.value)} placeholder="AIza..." className="input flex-1" autoComplete="off" />
              <button type="button" className="btn-secondary" onClick={() => setKeyVisible(false)}>Concluir</button>
            </div>
            <p className="text-xs text-dark-500 mt-2">A chave fica somente neste navegador e é usada apenas para chamadas à API Gemini.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] min-h-[560px]">
          <aside className="border-b lg:border-b-0 lg:border-r border-dark-700/50 p-3">
            <button type="button" onClick={createChat} className="btn-primary w-full justify-center"><Plus size={17} /> Nova conversa</button>
            <div className="mt-4 space-y-1 max-h-[465px] overflow-y-auto">
              {chats.map((chat) => (
                <button key={chat.id} type="button" onClick={() => setActiveChatId(chat.id)} className={`w-full text-left flex items-center gap-2 p-3 rounded-xl text-sm transition-colors ${chat.id === activeChatId ? 'bg-primary-400/10 text-primary-200' : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'}`}>
                  <MessageCircle size={16} className="flex-shrink-0" /><span className="truncate">{chat.title}</span>
                </button>
              ))}
              {chats.length === 0 && <p className="text-xs text-dark-500 text-center py-8">Suas conversas aparecerão aqui.</p>}
            </div>
          </aside>

          <section className="flex flex-col min-w-0">
            <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[510px]">
              {!activeChatId && (
                <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary-400/10 flex items-center justify-center mb-4"><Bot size={28} className="text-primary-300" /></div>
                  <h2 className="text-lg font-semibold text-dark-100">Olá, eu sou a Angel</h2>
                  <p className="text-sm text-dark-500 mt-2 max-w-md">Pergunte como usar qualquer área do Angler ERP. Crie uma conversa ou escreva sua primeira pergunta abaixo.</p>
                </div>
              )}
              {messages.map((item) => (
                <div key={item.id} className={`flex gap-3 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {item.role === 'assistant' && <div className="w-8 h-8 rounded-lg bg-primary-400/10 flex items-center justify-center flex-shrink-0"><Bot size={16} className="text-primary-300" /></div>}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${item.role === 'user' ? 'bg-primary-500 text-white rounded-br-md' : 'bg-dark-800 text-dark-200 rounded-bl-md'}`}>{renderMessageText(item.content)}</div>
                </div>
              ))}
              {sending && <div className="flex gap-3"><div className="w-8 h-8 rounded-lg bg-primary-400/10 flex items-center justify-center"><Bot size={16} className="text-primary-300" /></div><div className="bg-dark-800 text-dark-400 rounded-2xl rounded-bl-md px-4 py-3 text-sm">Angel está pensando...</div></div>}
            </div>
            <form onSubmit={sendMessage} className="border-t border-dark-700/50 p-4 flex gap-3">
              <input value={message} onChange={(event) => setMessage(event.target.value)} className="input flex-1" placeholder="Pergunte algo sobre o Angler ERP..." disabled={sending} />
              <button type="submit" className="btn-primary" disabled={sending || !message.trim()} aria-label="Enviar mensagem"><Send size={18} /></button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
