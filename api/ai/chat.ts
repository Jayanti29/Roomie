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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(messages: any[], apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages || [],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API returned status ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content || '';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { messages } = req.body || {};
  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
  const openaiApiKey = (process.env.OPENAI_API_KEY || '').trim();

  // Validate and log provider state on requests
  if (geminiApiKey) {
    console.log('[AI] Gemini initialized');
  }
  if (openaiApiKey && !geminiApiKey) {
    console.log('[AI] OpenAI fallback initialized');
  }
  if (!geminiApiKey && !openaiApiKey) {
    console.warn('[AI] Warning: No API keys configured for Gemini or OpenAI.');
  }

  let errorDetails = '';

  // 1. Try Gemini
  if (geminiApiKey) {
    try {
      const reply = await callGemini(messages || [], geminiApiKey);
      res.status(200).json({
        choices: [{ message: { role: 'assistant', content: reply } }]
      });
      return;
    } catch (err: any) {
      console.error('[AI] Gemini call failed:', err.message);
      errorDetails += `Gemini failed: ${err.message}. `;
    }
  }

  // 2. Try OpenAI (Fallback)
  if (openaiApiKey) {
    try {
      const reply = await callOpenAI(messages || [], openaiApiKey);
      res.status(200).json({
        choices: [{ message: { role: 'assistant', content: reply } }]
      });
      return;
    } catch (err: any) {
      console.error('[AI] OpenAI call failed:', err.message);
      errorDetails += `OpenAI failed: ${err.message}. `;
    }
  }

  // 3. Graceful error handling for end user
  console.warn('[AI] All AI providers failed or are missing. Error details:', errorDetails);
  res.status(200).json({
    choices: [{
      message: {
        role: 'assistant',
        content: "AI service is temporarily unavailable. Please try again later."
      }
    }]
  });
}
