const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    model: 'gpt-5.4-mini',
    storageKey: 'angler-ai-api-openai',
  },
  gemini: {
    label: 'Gemini',
    model: 'gemini-3.6-flash',
    storageKey: 'angler-ai-api-gemini',
  },
  claude: {
    label: 'Claude',
    model: 'claude-sonnet-5',
    storageKey: 'angler-ai-api-claude',
  },
  grok: {
    label: 'Grok',
    model: 'grok-4.6',
    storageKey: 'angler-ai-api-grok',
  },
  deepseek: {
    label: 'DeepSeek',
    model: 'deepseek-flash',
    storageKey: 'angler-ai-api-deepseek',
  },
};

export function getAiProviders() {
  return PROVIDERS;
}

export function getStoredApiKey(provider) {
  if (!provider || typeof window === 'undefined') return '';
  return localStorage.getItem(PROVIDERS[provider]?.storageKey || '') || '';
}

export function saveStoredApiKey(provider, apiKey) {
  if (!provider || typeof window === 'undefined') return;
  const storageKey = PROVIDERS[provider]?.storageKey;
  if (!storageKey) return;
  if (apiKey?.trim()) localStorage.setItem(storageKey, apiKey.trim());
  else localStorage.removeItem(storageKey);
}

function extractOpenAiText(data) {
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  const output = data?.output || [];
  return output
    .flatMap((item) => item?.content || [])
    .map((part) => part?.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

async function parseError(response) {
  let message = '';
  try {
    const data = await response.json();
    message = data?.error?.message || data?.message || data?.error || '';
  } catch {
    message = await response.text().catch(() => '');
  }
  return message || `A API respondeu com erro HTTP ${response.status}.`;
}

export async function askProvider(provider, apiKey, prompt) {
  if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido.');
  if (!apiKey?.trim()) throw new Error(`Informe a API key do ${PROVIDERS[provider].label}.`);
  if (!prompt?.trim()) throw new Error('Nenhuma fala foi reconhecida.');

  const key = apiKey.trim();

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PROVIDERS.openai.model,
        input: prompt,
        text: { verbosity: 'medium' },
      }),
    });
    if (!response.ok) throw new Error(await parseError(response));
    return extractOpenAiText(await response.json());
  }

  if (provider === 'gemini') {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${PROVIDERS.gemini.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    if (!response.ok) throw new Error(await parseError(response));
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').filter(Boolean).join('\n').trim() || '';
  }

  if (provider === 'claude') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: PROVIDERS.claude.model,
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(await parseError(response));
    const data = await response.json();
    return data?.content?.map((part) => part.text || '').filter(Boolean).join('\n').trim() || '';
  }

  if (provider === 'grok') {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PROVIDERS.grok.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(await parseError(response));
    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PROVIDERS.deepseek.model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}
