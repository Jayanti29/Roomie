import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Simple in-memory mock database state for local dev and E2E tests
const dbState: Record<string, any> = {};

function getValue(obj: any, path: string) {
  if (!path || path === '/') return obj;
  const parts = path.split('/').filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null;
    current = current[part];
  }
  return current === undefined ? null : current;
}

function setValue(obj: any, path: string, value: any) {
  if (!path || path === '/') {
    for (const key in obj) delete obj[key];
    Object.assign(obj, value);
    return;
  }
  const parts = path.split('/').filter(Boolean);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  const lastPart = parts[parts.length - 1];
  if (value === null) {
    delete current[lastPart];
  } else {
    current[lastPart] = value;
  }
}

function updateValue(obj: any, path: string, value: any) {
  if (value == null) return;
  const parts = path.split('/').filter(Boolean);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  const lastPart = parts[parts.length - 1];
  if (current[lastPart] == null || typeof current[lastPart] !== 'object') {
    current[lastPart] = {};
  }
  Object.assign(current[lastPart], value);
}

function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
  });
}

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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
      model: 'gpt-3.5-turbo',
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mock-database-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/db')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const pathname = urlObj.pathname;
            res.setHeader('Content-Type', 'application/json');
            
            if (pathname === '/api/db/get') {
              const path = urlObj.searchParams.get('path') || '';
              const val = getValue(dbState, path);
              console.log(`[MockDB GET] path: ${path} -> exists: ${val !== null}`);
              res.end(JSON.stringify({ data: val }));
              return;
            }
            
            if (pathname === '/api/db/set') {
              const { path, value } = await readBody(req);
              console.log(`[MockDB SET] path: ${path}`);
              setValue(dbState, path, value);
              res.end(JSON.stringify({ success: true }));
              return;
            }
            
            if (pathname === '/api/db/update') {
              const { path, value } = await readBody(req);
              console.log(`[MockDB UPDATE] path: ${path}`);
              updateValue(dbState, path, value);
              res.end(JSON.stringify({ success: true }));
              return;
            }
            
            if (pathname === '/api/db/push') {
              const { path, value } = await readBody(req);
              const pushId = 'push_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
              const fullPath = path ? `${path}/${pushId}` : pushId;
              console.log(`[MockDB PUSH] path: ${path} -> ${fullPath}`);
              setValue(dbState, fullPath, value);
              res.end(JSON.stringify({ success: true, key: pushId }));
              return;
            }
            
            if (pathname === '/api/db/remove') {
              const { path } = await readBody(req);
              console.log(`[MockDB REMOVE] path: ${path}`);
              setValue(dbState, path, null);
              res.end(JSON.stringify({ success: true }));
              return;
            }
          }
          
          if (req.url && req.url.startsWith('/api/ai/chat')) {
            res.setHeader('Content-Type', 'application/json');
            const { messages } = await readBody(req);
            const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
            const openaiApiKey = (process.env.OPENAI_API_KEY || '').trim();

            if (!geminiApiKey && !openaiApiKey) {
              res.statusCode = 500;
              res.end(JSON.stringify({
                error: "Configuration Error: Both GEMINI_API_KEY and OPENAI_API_KEY environment variables are missing."
              }));
              return;
            }

            try {
              if (geminiApiKey) {
                const reply = await callGemini(messages || [], geminiApiKey);
                res.end(JSON.stringify({
                  choices: [{ message: { role: 'assistant', content: reply } }]
                }));
              } else {
                const reply = await callOpenAI(messages || [], openaiApiKey);
                res.end(JSON.stringify({
                  choices: [{ message: { role: 'assistant', content: reply } }]
                }));
              }
            } catch (err: any) {
              console.error('[API Proxy Error]', err);
              res.statusCode = 502;
              res.end(JSON.stringify({
                error: `Bad Gateway: Upstream AI failed: ${err.message}`
              }));
            }
            return;
          }
          next();
        });
      }
    }
  ]
})
