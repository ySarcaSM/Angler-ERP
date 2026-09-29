import React, { useEffect, useRef, useState } from 'react';
import { Bot, Check, KeyRound, Loader2, Mic, MicOff, Save, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { askProvider, getAiProviders, getStoredApiKey, saveStoredApiKey } from '../../services/ai/audioAi';

const PROVIDERS = getAiProviders();

export default function AudioAiPage() {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    const stored = getStoredApiKey(provider);
    setApiKey(stored);
    setSaved(Boolean(stored));
  }, [provider]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
  }, []);

  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  const handleSaveKey = () => {
    saveStoredApiKey(provider, apiKey);
    setSaved(Boolean(apiKey.trim()));
    toast.success(apiKey.trim() ? `API do ${PROVIDERS[provider].label} salva neste dispositivo.` : 'API removida.');
  };

  const handleClearKey = () => {
    saveStoredApiKey(provider, '');
    setApiKey('');
    setSaved(false);
    toast.success('API removida deste dispositivo.');
  };

  const sendToAi = async (text) => {
    if (!text.trim()) {
      toast.error('Não consegui reconhecer sua fala.');
      return;
    }
    const key = getStoredApiKey(provider) || apiKey;
    if (!key?.trim()) {
      toast.error(`Cadastre a API do ${PROVIDERS[provider].label} antes de usar a IA.`);
      return;
    }

    setProcessing(true);
    setAnswer('');
    try {
      const result = await askProvider(provider, key, `Você é o assistente de IA do Angler ERP. Responda em português, de forma clara e prática. O usuário falou por áudio e sua fala transcrita foi:

"${text}"

Responda diretamente ao pedido do usuário.`);
      setAnswer(result || 'A IA não retornou uma resposta.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível consultar a IA.');
    } finally {
      setProcessing(false);
    }
  };

  const startListening = () => {
    if (!SpeechRecognition) {
      toast.error('Seu navegador não oferece reconhecimento de voz. Use Chrome ou Edge em um dispositivo compatível.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    transcriptRef.current = '';
    setTranscript('');
    setAnswer('');
    recognition.onresult = (event) => {
      let finalText = transcriptRef.current;
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += `${piece} `;
        else interimText += piece;
      }
      transcriptRef.current = finalText;
      setTranscript(`${finalText}${interimText}`.trim());
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error !== 'aborted') toast.error('Não foi possível acessar o microfone ou reconhecer a fala.');
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const finalText = transcriptRef.current.trim();
      if (finalText) sendToAi(finalText);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const toggleListening = () => {
    if (processing) return;
    if (listening) stopListening();
    else startListening();
  };

  return (
    <div className="min-h-full space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles size={22} className="text-primary-400" />
          <h1 className="text-2xl font-bold text-dark-100">IA por áudio</h1>
        </div>
        <p className="text-dark-500 text-sm mt-1">Fale naturalmente e envie sua solicitação para o provedor de IA escolhido.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-stretch">
        <div className="card min-h-[560px] flex flex-col items-center justify-center p-8">
          <div className="text-center max-w-xl mb-8">
            <div className="text-sm font-medium text-dark-300">Provedor atual</div>
            <div className="mt-1 text-xl font-bold text-primary-300">{PROVIDERS[provider].label}</div>
            <div className="text-xs text-dark-500 mt-1">Modelo: {PROVIDERS[provider].model}</div>
          </div>

          <button
            type="button"
            onClick={toggleListening}
            disabled={processing}
            aria-label={listening ? 'Parar de ouvir' : 'Começar a ouvir'}
            className={`relative w-48 h-48 rounded-full flex items-center justify-center border-4 transition-all duration-300 shadow-2xl ${listening ? 'border-red-400 bg-red-500/15 text-red-300 scale-105' : 'border-primary-400/60 bg-primary-400/10 text-primary-300 hover:bg-primary-400/20 hover:scale-105'} ${processing ? 'opacity-70 cursor-wait' : ''}`}
          >
            {listening && <span className="absolute inset-0 rounded-full border border-red-400/40 animate-ping" />}
            {processing ? <Loader2 size={68} className="animate-spin" /> : listening ? <MicOff size={68} /> : <Mic size={68} />}
          </button>

          <div className="mt-8 text-center">
            <div className="text-lg font-semibold text-dark-100">
              {processing ? 'Consultando a IA...' : listening ? 'Estou ouvindo...' : 'Clique para falar'}
            </div>
            <p className="text-sm text-dark-500 mt-2">
              {listening ? 'Clique novamente quando terminar.' : 'Sua fala será transcrita e enviada ao provedor selecionado.'}
            </p>
          </div>

          {transcript && (
            <div className="w-full max-w-2xl mt-8 rounded-2xl border border-dark-700 bg-dark-800/50 p-5">
              <div className="text-xs uppercase tracking-wider font-semibold text-primary-400 mb-2">Transcrição</div>
              <p className="text-sm text-dark-200 whitespace-pre-wrap">{transcript}</p>
            </div>
          )}

          {answer && (
            <div className="w-full max-w-2xl mt-4 rounded-2xl border border-primary-400/20 bg-primary-400/5 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-primary-400 mb-2">
                <Bot size={15} /> Resposta da IA
              </div>
              <p className="text-sm text-dark-100 whitespace-pre-wrap leading-relaxed">{answer}</p>
            </div>
          )}
        </div>

        <div className="card h-fit">
          <div className="card-header flex items-center gap-2">
            <KeyRound size={18} className="text-primary-400" />
            <h2 className="text-sm font-semibold text-dark-200">Provedor e API</h2>
          </div>
          <div className="card-body space-y-5">
            <div>
              <label className="label">Escolha o provedor</label>
              <div className="space-y-2">
                {Object.entries(PROVIDERS).map(([key, item]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProvider(key)}
                    className={`w-full flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${provider === key ? 'border-primary-400/50 bg-primary-400/10' : 'border-dark-700 bg-dark-800/40 hover:border-dark-600'}`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-dark-100">{item.label}</div>
                      <div className="text-[11px] text-dark-500">{item.model}</div>
                    </div>
                    {provider === key && <Check size={18} className="text-primary-300" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">API key do {PROVIDERS[provider].label}</label>
              <input
                type="password"
                className="input"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setSaved(false);
                }}
                placeholder="Cole sua API key aqui"
                autoComplete="off"
              />
              <p className="text-[11px] text-dark-500 mt-2">
                A chave fica salva apenas no armazenamento local deste navegador.
              </p>
            </div>

            <div className="flex gap-2">
              <button type="button" className="btn-primary flex-1" onClick={handleSaveKey}>
                <Save size={17} /> {saved ? 'Atualizada' : 'Salvar API'}
              </button>
              {saved && (
                <button type="button" className="btn-secondary" onClick={handleClearKey} title="Remover API">
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
