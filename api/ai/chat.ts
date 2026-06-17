declare const process: any;

async function callGemini(messages: any[], apiKey: string): Promise<string> {
  const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const body: any = { contents };
  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new Error(`RATE_LIMIT: Gemini rate limit hit`);
      }
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('Gemini returned empty response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(messages: any[], apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages || [],
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new Error(`RATE_LIMIT: OpenAI rate limit hit`);
      }
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('OpenAI returned empty response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { messages } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      choices: [{ message: { role: 'assistant', content: 'Please send a message to get started.' } }]
    });
    return;
  }

  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
  const openaiApiKey = (process.env.OPENAI_API_KEY || '').trim();

  if (geminiApiKey) {
    console.log('[AI] Attempting Gemini 1.5 Flash...');
  }
  if (!geminiApiKey && !openaiApiKey) {
    console.warn('[AI] Warning: No API keys configured.');
  }

  let lastError = '';

  // 1. Try Gemini (primary)
  if (geminiApiKey) {
    try {
      const reply = await callGemini(messages, geminiApiKey);
      console.log('[AI] Gemini responded successfully.');
      res.status(200).json({
        choices: [{ message: { role: 'assistant', content: reply } }],
        provider: 'gemini'
      });
      return;
    } catch (err: any) {
      lastError = err.message || 'Unknown error';
      console.error('[AI] Gemini call failed:', lastError);

      // If rate limited, wait briefly and try once more
      if (lastError.startsWith('RATE_LIMIT') && geminiApiKey) {
        await new Promise(r => setTimeout(r, 1500));
        try {
          const reply = await callGemini(messages, geminiApiKey);
          console.log('[AI] Gemini retry succeeded.');
          res.status(200).json({
            choices: [{ message: { role: 'assistant', content: reply } }],
            provider: 'gemini-retry'
          });
          return;
        } catch (retryErr: any) {
          lastError = retryErr.message || 'Gemini retry failed';
          console.error('[AI] Gemini retry also failed:', lastError);
        }
      }
    }
  }

  // 2. Try OpenAI (fallback)
  if (openaiApiKey) {
    try {
      console.log('[AI] Falling back to OpenAI gpt-4o-mini...');
      const reply = await callOpenAI(messages, openaiApiKey);
      console.log('[AI] OpenAI responded successfully.');
      res.status(200).json({
        choices: [{ message: { role: 'assistant', content: reply } }],
        provider: 'openai'
      });
      return;
    } catch (err: any) {
      lastError = err.message || 'Unknown error';
      console.error('[AI] OpenAI fallback also failed:', lastError);
    }
  }

  // 3. Graceful user-facing message (never expose raw errors or API keys)
  console.warn('[AI] All providers failed. Last error:', lastError);
  res.status(200).json({
    choices: [{
      message: {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment — the AI service may be temporarily busy."
      }
    }],
    provider: 'none'
  });
}
