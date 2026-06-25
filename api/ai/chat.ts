import { generateAiReply } from '../_shared/aiService.js';

declare const process: {
  env: {
    GEMINI_API_KEY?: string;
    OPENAI_API_KEY?: string;
  };
};

interface ApiRequest {
  method?: string;
  body?: {
    messages?: unknown;
  };
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    end: (body?: string) => void;
    json: (body: unknown) => void;
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'AI request failed.';
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const reply = await generateAiReply(req.body?.messages, process.env);
    res.status(200).json({
      choices: [{ message: { role: 'assistant', content: reply.content } }],
      provider: reply.provider
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const status = message.startsWith('Please send') ? 400 : 503;
    console.error('[AI] Request failed:', message);
    res.status(status).json({ error: message });
  }
}
