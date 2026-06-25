import { getAiHealth } from '../_shared/aiService';

declare const process: {
  env: {
    GEMINI_API_KEY?: string;
    OPENAI_API_KEY?: string;
  };
};

interface ApiRequest {
  method?: string;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    end: (body?: string) => void;
    json: (body: unknown) => void;
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return;
  }

  res.status(200).json(getAiHealth(process.env));
}
