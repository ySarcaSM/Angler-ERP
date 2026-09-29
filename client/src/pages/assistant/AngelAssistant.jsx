import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Edit2, KeyRound, MessageCircle, Mic, MicOff, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';
import PageHeader from '../../components/ui/PageHeader';
import {
  addAssistantMessage, createAssistantChat, subscribeAssistantChats,
  subscribeAssistantMessages, updateAssistantChat, deleteAssistantChat, deleteEmptyAssistantChats,
} from '../../services/firebase/assistant';
import { askAngel, getGeminiApiKeyStatus, saveGeminiApiKey } from '../../services/gemini';
import { getReadOnlyListAnswer, loadAngelReadContext } from '../../services/angelContext';
import { addSystemNotification } from '../../utils/notifications';
import { askProvider, getAiProviders, getStoredApiKey, getStoredModel, listProviderModels, saveStoredApiKey, saveStoredModel } from '../../services/ai/audioAi';

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
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [changingChatId, setChangingChatId] = useState(null);
  const [clearingEmptyChats, setClearingEmptyChats] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [providerKey, setProviderKey] = useState('');
  const [providerModel, setProviderModel] = useState('');
  const [listening, setListening] = useState(false);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingValidModel, setLoadingValidModel] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [apiTested, setApiTested] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    if (!company?.id || !user?.uid) return undefined;
    setApiKey('');
    getGeminiApiKeyStatus(company.id)
      .then(setApiKeyConfigured)
      .catch(() => toast.error('Não foi possível verificar a chave da Gemini.'));
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
  const isAnglerPro = String(company?.plan || '').toLowerCase() === 'anglerpro';
  const aiProviders = getAiProviders();
  const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

  useEffect(() => {
    if (!isAnglerPro) return;
    setProviderKey(getStoredApiKey(provider));
    setProviderModel(getStoredModel(provider) || aiProviders[provider]?.model || '');
    setModels([]);
    setApiTested(false);
  }, [provider, isAnglerPro]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Informe a chave da API Gemini.');
      return;
    }
    try {
      await saveGeminiApiKey(company.id, apiKey.trim());
      const isSaved = await getGeminiApiKeyStatus();
      if (!isSaved) throw new Error('A chave não pôde ser mantida nesta sessão do navegador.');
      setApiKey('');
      setApiKeyConfigured(true);
      setKeyVisible(true);
      toast.success('Chave da Gemini salva com segurança.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível salvar a chave da Gemini.');
    }
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

  const startEditingChat = (chat) => {
    setEditingChatId(chat.id);
    setEditingTitle(chat.title || 'Nova conversa');
  };

  const saveChatTitle = async (chatId) => {
    const title = editingTitle.trim();
    if (!title) {
      toast.error('Informe um título para a conversa.');
      return;
    }
    const currentTitle = chats.find((chat) => chat.id === chatId)?.title || '';
    if (title === currentTitle) {
      setEditingChatId(null);
      return;
    }
    setChangingChatId(chatId);
    try {
      await updateAssistantChat(chatId, { title: title.slice(0, 80) });
      setEditingChatId(null);
      toast.success('Conversa renomeada.');
    } catch (error) {
      toast.error('Não foi possível editar a conversa.');
    } finally {
      setChangingChatId(null);
    }
  };

  const removeChat = async (chat) => {
    if (!confirm(`Excluir a conversa "${chat.title}"? Esta ação não pode ser desfeita.`)) return;
    setChangingChatId(chat.id);
    try {
      await deleteAssistantChat(chat.id);
      if (activeChatId === chat.id) setActiveChatId(null);
      if (editingChatId === chat.id) setEditingChatId(null);
      toast.success('Conversa excluída.');
    } catch (error) {
      toast.error('Não foi possível excluir a conversa.');
    } finally {
      setChangingChatId(null);
    }
  };

  const removeEmptyChats = async () => {
    if (!chats.length) {
      toast.error('Não há conversas para excluir.');
      return;
    }
    if (!confirm('Excluir todas as conversas vazias? Esta ação não pode ser desfeita.')) return;
    setClearingEmptyChats(true);
    try {
      const deletedChatIds = await deleteEmptyAssistantChats(chats);
      if (deletedChatIds.includes(activeChatId)) setActiveChatId(null);
      if (deletedChatIds.includes(editingChatId)) setEditingChatId(null);
      toast.success(deletedChatIds.length ? `${deletedChatIds.length} conversa(s) vazia(s) excluída(s).` : 'Não há conversas vazias.');
    } catch (error) {
      toast.error('Não foi possível excluir as conversas vazias.');
    } finally {
      setClearingEmptyChats(false);
    }
  };

  const sendMessage = async (event, voiceContent = '') => {
    if (event) event.preventDefault();
    const content = (voiceContent || message).trim();
    if (!content || sending) return;
    if (!isAnglerPro && !apiKeyConfigured) {
      toast.error('Informe sua chave da API Gemini antes de conversar com a Angel.');
      setKeyVisible(true);
      return;
    }
    if (isAnglerPro && provider !== 'gemini' && !providerKey.trim()) {
      toast.error('Informe a API do ' + aiProviders[provider].label + ' antes de conversar.');
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
      const readOnlyAnswer = getReadOnlyListAnswer(content, readContext);
      const answer = readOnlyAnswer || (isAnglerPro
        ? await askProvider(
            provider,
            provider === 'gemini' ? (getStoredApiKey('gemini') || providerKey) : providerKey,
            'Você é a Angel, assistente do Angler ERP. Responda em português, de forma clara e prática. Contexto do ERP: ' + JSON.stringify(readContext) + '\n\nHistórico recente: ' + JSON.stringify(messages.slice(-10).map((item) => ({ role: item.role, content: item.content }))) + '\n\nPedido do usuário: ' + content,
            providerModel
          )
        : await askAngel({
            companyId: company.id,
            history: messages,
            message: content,
            plan: company.plan,
            readContext,
          }));
      await addAssistantMessage(chatId, { role: 'assistant', content: answer });
      await updateAssistantChat(chatId, {});
    } catch (error) {
      if (error?.status === 503) {
        addSystemNotification(company.id, {
          title: 'Angel temporariamente indisponível',
          message: 'Não foi possível concluir sua última solicitação. Tente novamente em alguns instantes.',
        });
      }
      toast.error(error.message || 'Não foi possível concluir a solicitação. Verifique a configuração da IA e tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const loadModels = async () => {
    if (!providerKey.trim()) {
      toast.error('Informe a API key antes de carregar os modelos.');
      return;
    }
    setLoadingModels(true);
    try {
      const items = await listProviderModels(provider, providerKey.trim());
      setModels(items);
      const selected = items.some((item) => item.id === providerModel) ? providerModel : (items[0]?.id || providerModel);
      setProviderModel(selected);
      saveStoredApiKey(provider, providerKey);
      if (selected) saveStoredModel(provider, selected);
      toast.success(items.length + ' modelo(s) carregado(s).');
    } catch (error) {
      toast.error(error.message || 'Não foi possível carregar os modelos.');
    } finally {
      setLoadingModels(false);
    }
  };

  const loadValidModel = async () => {
    if (!providerKey.trim()) {
      toast.error('Informe a API key antes de procurar um modelo válido.');
      return;
    }
    setLoadingValidModel(true);
    setApiTested(false);
    try {
      const items = await listProviderModels(provider, providerKey.trim());
      if (!items.length) throw new Error('O provedor não disponibilizou nenhum modelo para esta API key.');

      let validModel = null;
      for (const item of items) {
        try {
          await askProvider(provider, providerKey.trim(), 'Responda apenas: OK', item.id);
          validModel = item;
          break;
        } catch {
          // Tenta o próximo modelo disponível.
        }
      }

      if (!validModel) {
        throw new Error('Nenhum dos modelos disponíveis respondeu corretamente. Verifique a API key, a cota e as permissões do provedor.');
      }

      setModels(items);
      setProviderModel(validModel.id);
      saveStoredApiKey(provider, providerKey);
      saveStoredModel(provider, validModel.id);
      setApiTested(true);
      toast.success(`Modelo válido carregado: ${validModel.name || validModel.id}`);
    } catch (error) {
      toast.error(error.message || 'Não foi possível encontrar um modelo válido.');
    } finally {
      setLoadingValidModel(false);
    }
  };

  const testProviderApi = async () => {
    if (!providerKey.trim()) {
      toast.error('Informe a API key antes de testar.');
      return;
    }
    setTestingApi(true);
    try {
      await askProvider(provider, providerKey.trim(), 'Responda apenas: OK', providerModel);
      setApiTested(true);
      toast.success('API do ' + aiProviders[provider].label + ' funcionando.');
    } catch (error) {
      setApiTested(false);
      toast.error(error.message || 'A API não respondeu corretamente.');
    } finally {
      setTestingApi(false);
    }
  };

  const saveProviderSettings = () => {
    if (!isAnglerPro) return;
    saveStoredApiKey(provider, providerKey);
    saveStoredModel(provider, providerModel);
    toast.success('Configuração do ' + aiProviders[provider].label + ' salva neste dispositivo.');
  };

  const toggleListening = () => {
    if (!isAnglerPro || sending) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    if (!SpeechRecognition) {
      toast.error('Seu navegador não oferece reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    transcriptRef.current = '';
    recognition.onresult = (event) => {
      let finalText = transcriptRef.current;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript + ' ';
      }
      transcriptRef.current = finalText;
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error !== 'aborted') toast.error('Não foi possível acessar o microfone ou reconhecer a fala.');
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = transcriptRef.current.trim();
      if (text) sendMessage(null, text);
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
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
          <button type="button" onClick={() => setKeyVisible((value) => !value)} className="btn-secondary"><KeyRound size={16} /> {isAnglerPro ? 'Provedor de IA' : 'Chave Gemini'}</button>
        </div>

        {keyVisible && (
          <div className="p-4 border-b border-dark-700/50 bg-dark-900/40">
            {isAnglerPro ? <>
              <label className="text-sm font-medium text-dark-200">Provedor de IA</label>
              <select className="input mt-2" value={provider} onChange={(event) => setProvider(event.target.value)}>
                {Object.entries(aiProviders).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
              </select>
              <label className="text-sm font-medium text-dark-200 block mt-3">API key do {aiProviders[provider].label}</label>
              <div className="flex gap-2 mt-2">
                <input type="password" value={providerKey} onChange={(event) => setProviderKey(event.target.value)} placeholder="Cole sua API key aqui" className="input flex-1" autoComplete="off" />
                <button type="button" className="btn-secondary" onClick={saveProviderSettings}>Salvar</button>
              </div>
              <label className="text-sm font-medium text-dark-200 block mt-3">Modelo</label>
              {models.length ? <select value={providerModel} onChange={(event) => { setProviderModel(event.target.value); saveStoredModel(provider, event.target.value); setApiTested(false); }} className="input mt-2">{models.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select> : <input value={providerModel} onChange={(event) => { setProviderModel(event.target.value); setApiTested(false); }} className="input mt-2" placeholder={aiProviders[provider].model} />}
              <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <button type="button" className="btn-secondary !border-violet-400/30 !text-violet-200 hover:!bg-violet-500/10" onClick={loadModels} disabled={loadingModels || loadingValidModel || testingApi}>{loadingModels ? 'Carregando...' : 'Carregar modelos'}</button>
                  <button type="button" className="btn-secondary !border-violet-400/40 !text-violet-200 hover:!bg-violet-500/10" onClick={loadValidModel} disabled={loadingValidModel || loadingModels || testingApi}>{loadingValidModel ? 'Procurando modelo válido...' : 'Carregar modelo válido'}</button>
                  <button type="button" className="btn-secondary !border-violet-400/30 !text-violet-200 hover:!bg-violet-500/10" onClick={testProviderApi} disabled={testingApi || loadingModels || loadingValidModel}>{testingApi ? 'Testando...' : 'Testar API'}</button>
                  {apiTested && <span className="inline-flex items-center text-xs text-violet-200 rounded-lg bg-violet-400/10 border border-violet-400/20 px-2.5 py-1">✓ IA pronta</span>}
                </div>
              </div>
              <p className="text-xs text-violet-300/70 mt-2">Recursos de IA do AnglerPro • OpenAI, Gemini, Claude, Grok e DeepSeek.</p>
            </> : <>
              <label className="text-sm font-medium text-dark-200" htmlFor="gemini-key">Chave da API Gemini</label>
              <div className="flex gap-2 mt-2">
                <input id="gemini-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={apiKeyConfigured ? 'Chave configurada — informe outra para substituí-la' : 'AIza...'} className="input flex-1" autoComplete="off" />
                <button type="button" className="btn-secondary" onClick={saveApiKey}>Salvar</button>
              </div>
              <p className="text-xs text-dark-500 mt-2">A chave fica somente neste navegador durante a sessão e é removida ao sair da conta.</p>
            </>}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] min-h-[560px]">
          <aside className="border-b lg:border-b-0 lg:border-r border-dark-700/50 p-3 flex flex-col">
            <button type="button" onClick={createChat} className="btn-primary w-full justify-center"><Plus size={17} /> Nova conversa</button>
            <div className="mt-4 space-y-1 max-h-[412px] overflow-y-auto flex-1">
              {chats.map((chat) => (
                <div key={chat.id} className={`group flex items-center gap-1 rounded-xl text-sm transition-colors ${chat.id === activeChatId ? 'bg-primary-400/10 text-primary-200' : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'}`}>
                  {editingChatId === chat.id ? (
                    <form className="flex flex-1 gap-1 p-1" onSubmit={(event) => { event.preventDefault(); saveChatTitle(chat.id); }}>
                      <input autoFocus value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setEditingChatId(null); }} className="input min-w-0 flex-1 !px-2 !py-1 text-sm" maxLength={80} aria-label="Título da conversa" disabled={changingChatId === chat.id} />
                      <button type="submit" className="btn-ghost btn-sm text-primary-300" disabled={changingChatId === chat.id}>Salvar</button>
                    </form>
                  ) : <>
                    <button type="button" onClick={() => setActiveChatId(chat.id)} className="min-w-0 flex-1 text-left flex items-center gap-2 p-3">
                      <MessageCircle size={16} className="flex-shrink-0" /><span className="truncate">{chat.title}</span>
                    </button>
                    <div className="flex pr-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button type="button" className="btn-ghost btn-sm" title="Editar conversa" aria-label="Editar conversa" onClick={() => startEditingChat(chat)} disabled={changingChatId === chat.id}><Edit2 size={14} /></button>
                      <button type="button" className="btn-ghost btn-sm text-red-400" title="Excluir conversa" aria-label="Excluir conversa" onClick={() => removeChat(chat)} disabled={changingChatId === chat.id}><Trash2 size={14} /></button>
                    </div>
                  </>}
                </div>
              ))}
              {chats.length === 0 && <p className="text-xs text-dark-500 text-center py-8">Suas conversas aparecerão aqui.</p>}
            </div>
            <div className="pt-3 mt-3 border-t border-dark-700/50">
              <button type="button" onClick={removeEmptyChats} className="btn-ghost btn-sm w-full justify-center text-red-400" disabled={clearingEmptyChats}>
                <Trash2 size={14} /> {clearingEmptyChats ? 'Excluindo...' : 'Excluir conversas vazias'}
              </button>
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
              {isAnglerPro && <button type="button" onClick={toggleListening} disabled={sending} className={listening ? 'btn-secondary text-red-400 border-red-400/30' : 'btn-secondary'} aria-label={listening ? 'Parar gravação' : 'Falar com a Angel'} title={listening ? 'Parar gravação' : 'Falar com a Angel'}>{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>}
              <button type="submit" className="btn-primary" disabled={sending || !message.trim()} aria-label="Enviar mensagem"><Send size={18} /></button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
