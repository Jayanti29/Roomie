declare const process: any;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
  const openaiApiKey = (process.env.OPENAI_API_KEY || '').trim();

  let provider = 'None';
  let status = 'unconfigured';
  let model = 'none';

  if (geminiApiKey) {
    provider = 'Gemini';
    status = 'healthy';
    model = 'gemini-2.0-flash';
  } else if (openaiApiKey) {
    provider = 'OpenAI';
    status = 'healthy';
    model = 'gpt-4o-mini';
  }

  res.status(200).json({
    provider,
    status,
    model
  });
}
