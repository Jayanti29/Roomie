import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { generateAiReply } from './api/_shared/aiService'

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
  if (!path || path === '/') {
    // Treat each key in value as a subpath!
    for (const key in value) {
      setValue(obj, key, value[key]);
    }
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

            try {
              const reply = await generateAiReply(messages, process.env);
              res.end(JSON.stringify({
                choices: [{ message: { role: 'assistant', content: reply.content } }],
                provider: reply.provider
              }));
            } catch (err: any) {
              const message = err instanceof Error ? err.message : 'AI request failed.';
              console.error('[API Proxy Error]', message);
              res.statusCode = message.startsWith('Please send') ? 400 : 503;
              res.end(JSON.stringify({ error: message }));
            }
            return;
          }
          next();
        });
      }
    }
  ]
})
