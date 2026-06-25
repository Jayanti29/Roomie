export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiEnvironment {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

export interface AiResponse {
  content: string;
  provider: 'gemini' | 'gemini-retry' | 'openai';
}

export interface AiHealth {
  provider: 'Gemini' | 'OpenAI' | 'None';
  status: 'healthy' | 'unconfigured';
  model: string;
}

const REQUEST_TIMEOUT_MS = 12_000;
const RETRY_DELAY_MS = 1_500;
const GEMINI_MODEL = 'gemini-2.5-flash';
const OPENAI_MODEL = 'gpt-4o-mini';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function normalizeMessages(messages: unknown): AiMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message): message is Partial<AiMessage> => Boolean(message) && typeof message === 'object')
    .map((message): AiMessage => {
      let role: AiMessage['role'] = 'user';
      if (message.role === 'system') {
        role = 'system';
      } else if (message.role === 'assistant') {
        role = 'assistant';
      }
      return {
        role,
        content: typeof message.content === 'string' ? message.content : ''
      };
    })
    .filter((message) => message.content.trim().length > 0);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(messages: AiMessage[], apiKey: string): Promise<string> {
  const systemPrompt = messages.find((message) => message.role === 'system')?.content || '';
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }));

  const body: {
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    systemInstruction?: { parts: Array<{ text: string }> };
  } = { contents };

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error('RATE_LIMIT: Gemini rate limit hit');
    }
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) {
    throw new Error('Gemini returned empty response');
  }
  return text;
}

async function callOpenAI(messages: AiMessage[], apiKey: string): Promise<string> {
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error('RATE_LIMIT: OpenAI rate limit hit');
    }
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) {
    throw new Error('OpenAI returned empty response');
  }
  return text;
}

export function getAiHealth(env: AiEnvironment): AiHealth {
  if (env.GEMINI_API_KEY?.trim()) {
    return { provider: 'Gemini', status: 'healthy', model: GEMINI_MODEL };
  }

  if (env.OPENAI_API_KEY?.trim()) {
    return { provider: 'OpenAI', status: 'healthy', model: OPENAI_MODEL };
  }

  return { provider: 'None', status: 'unconfigured', model: 'none' };
}

export async function generateAiReply(rawMessages: unknown, env: AiEnvironment): Promise<AiResponse> {
  const messages = normalizeMessages(rawMessages);
  if (messages.length === 0) {
    throw new Error('Please send a message to get started.');
  }

  const geminiApiKey = env.GEMINI_API_KEY?.trim();
  const openaiApiKey = env.OPENAI_API_KEY?.trim();
  let lastError = '';

  if (geminiApiKey) {
    try {
      return { content: await callGemini(messages, geminiApiKey), provider: 'gemini' };
    } catch (error) {
      lastError = getErrorMessage(error);
      console.error('[AI] Gemini call failed:', lastError);

      if (lastError.startsWith('RATE_LIMIT')) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        try {
          return { content: await callGemini(messages, geminiApiKey), provider: 'gemini-retry' };
        } catch (retryError) {
          lastError = getErrorMessage(retryError);
          console.error('[AI] Gemini retry failed:', lastError);
        }
      }
    }
  }

  if (openaiApiKey) {
    try {
      return { content: await callOpenAI(messages, openaiApiKey), provider: 'openai' };
    } catch (error) {
      lastError = getErrorMessage(error);
      console.error('[AI] OpenAI fallback failed:', lastError);
    }
  }

  if (!geminiApiKey && !openaiApiKey) {
    throw new Error('AI service is not configured. Set GEMINI_API_KEY or OPENAI_API_KEY.');
  }

  throw new Error(lastError || 'AI service failed.');
}
