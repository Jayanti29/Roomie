import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function generateSimulatedResponse(messages: any[]): string {
  const lastMsg = messages[messages.length - 1]?.content || '';
  const q = lastMsg.toLowerCase();

  // Dynamically address specific prompt questions:
  if (q.includes('teach me java') || q.includes('explain java') || q.includes('java help')) {
    return `Hi there! I would love to teach you **Java**. 

Java is a compiled, class-based, object-oriented programming language designed to have as few implementation dependencies as possible ("Write Once, Run Anywhere").

To get started with Java, let's look at the basic class structure:
\`\`\`java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Welcome to Roomie!");
    }
}
\`\`\`

Key concepts you should study:
1. **JVM, JRE, and JDK**: The compile and runtime lifecycle.
2. **Object-Oriented Programming (OOP)**: Designing objects with methods and variables.
3. **Control Flow**: \`if\` statements, loops (\`for\`, \`while\`), and switch-cases.

Would you like to write a simple Java class or build a console application?`;
  }

  if (q.includes('explain dbms') || q.includes('database help') || q.includes('dbms help') || q.includes('explain sql')) {
    return `Let's discuss **Database Management Systems (DBMS)**!

A DBMS is system software for creating and managing databases. It provides users and programmers with a systematic way to create, retrieve, update and manage data.

Here is a quick comparison:
* **Relational DBMS (RDBMS)**: Uses structured tables with rows/columns (e.g. MySQL, PostgreSQL). Enforces schemas and strict ACID compliance.
* **Non-Relational (NoSQL)**: High throughput and flexible schema structures (e.g. Document, Key-Value, Graph). Great for high-scale, dynamic structures.

To model databases cleanly:
- Focus on **Normalization** (1NF, 2NF, 3NF) to eliminate redundancy.
- Use **Indexes** to speed up queries.

What database systems are you currently using for your project? SQL or NoSQL?`;
  }

  if (q.includes('create resume') || q.includes('resume help') || q.includes('resume plan')) {
    return `Designing a software engineering **Resume** is all about showcasing impact and technical execution. Here is a solid template structure:

1. **Header**: Name, Email, GitHub, LinkedIn, and Portfolio link.
2. **Skills Directory**: Group by languages (e.g. Java, Python, TypeScript) and technologies (e.g. React, Node, SQL).
3. **Projects (Key Focus)**: Detail 2-3 complex projects. Use the action verb + task + results formula:
   - *"Built a real-time collaborative workspace web-app using React and WebRTC, decreasing peer synchronization latency by 40%."*
4. **Professional Experience**: Internships or volunteer work.
5. **Education**: Degree, major, graduation year.

Would you like to draft a project description together or list your core technical stack?`;
  }

  if (q.includes('help with interview') || q.includes('interview help') || q.includes('mock interview')) {
    return `Preparing for technical and behavioral **Interviews** requires a structured strategy:

- **Technical Prep (DSA)**: Review data structures (arrays, hash maps, heaps, trees) and practice solving problems out loud. Focus on time and space complexity ($O(N)$ analysis).
- **System Design**: Practice explaining how web servers, databases, caching layers, and load balancers interact.
- **Behavioral (STAR Method)**: Prepare stories detailing a **S**ituation, **T**ask, **A**ction, and **R**esult from your projects.

Would you like to run a mock interview query on DSA or go over a behavioral scenario?`;
  }

  if (q.includes('explain oop') || q.includes('oop help') || q.includes('object oriented')) {
    return `**Object-Oriented Programming (OOP)** is a paradigm centered around 'objects' containing data and methods. 

Here are the four pillars of OOP explained simply:
1. **Encapsulation**: Restricting direct access to object fields. Expose state changes through safe getters and setters.
2. **Inheritance**: Subclasses inheriting fields/methods of a superclass using \`extends\`, maximizing code reusability.
3. **Polymorphism**: The ability of an object to take multiple forms (Method Overloading for compile-time, Method Overriding for run-time).
4. **Abstraction**: Hiding complex implementation details and showing only functional contracts using abstract classes and interfaces.

Would you like to look at a code sample of Polymorphism or Abstraction in Java?`;
  }

  if (q.includes('create study plan') || q.includes('study plan') || q.includes('study checklist') || q.includes('roadmap')) {
    return `Here is a custom **Study Plan** designed to keep you consistent:

* **Phase 1: Foundation (Weeks 1-2)**: Select a core language (like Java or JavaScript) and master data variables, flow control, arrays, and basic functions.
* **Phase 2: Data Structures (Weeks 3-4)**: Study linked lists, stacks, queues, hash maps, and recursion. Focus on analyzing Big O time complexity.
* **Phase 3: Relational Modeling (Weeks 5-6)**: Learn SQL queries, database normalization (3NF), and backend connections.
* **Phase 4: Full-Stack Integration (Weeks 7-8)**: Build a React web-app with real-time sync endpoints.

To optimize learning:
- Dedicate 45 minutes daily.
- Build projects instead of only reading docs.

What is your primary study objective for this week?`;
  }

  if (q.includes('generate notes') || q.includes('notes help') || q.includes('create notes')) {
    return `I can help you **Generate Notes** for any topic! Here is a structured summary note template:

### Title: [Insert Topic Name]
- **Definition**: Core definition of the topic or framework.
- **Key Syntax / Implementation**:
  \`\`\`javascript
  // Insert core code sample here
  \`\`\`
- **Important Gotchas**: Common errors, security rules boundaries, or performance bottlenecks.
- **Related Resources**: Reference links or related concepts.

What topic would you like me to generate summary notes for? Let's start with a specific subject!`;
  }

  // Dynamic responder for generic queries
  return `I am your **Roomie AI Mentor**. I remember our conversation history and am ready to assist you!

I noticed your request regarding **"${lastMsg}"**. 

How would you like to proceed? You can ask me to:
- "Teach me Java" (basic syntax, JVM, classes)
- "Explain DBMS" (relational tables, indexing, SQL)
- "Create resume" (software engineer template, formatting)
- "Help with interview" (DSA preparation, STAR method)
- "Explain OOP" (the four pillars with code examples)
- "Create study plan" (curriculum planning, checklists)
- "Generate notes" (summaries and code blocks)

What topic should we tackle next?`;
}

// Simple in-memory mock database state for E2E tests
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
              // Only log non-empty queries or non-polling queries if too verbose, but let's log everything first
              console.log(`[MockDB GET] path: ${path} -> exists: ${val !== null}`);
              res.end(JSON.stringify({ data: val }));
              return;
            }
            
            if (pathname === '/api/db/set') {
              const { path, value } = await readBody(req);
              console.log(`[MockDB SET] path: ${path}, value keys: ${value ? Object.keys(value) : 'null'}`);
              setValue(dbState, path, value);
              res.end(JSON.stringify({ success: true }));
              return;
            }
            
            if (pathname === '/api/db/update') {
              const { path, value } = await readBody(req);
              console.log(`[MockDB UPDATE] path: ${path}, value keys: ${value ? Object.keys(value) : 'null'}`);
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
            const apiKey = (process.env.OPENAI_API_KEY || '').trim();

            if (!apiKey) {
              const reply = generateSimulatedResponse(messages || []);
              res.end(JSON.stringify({
                choices: [{ message: { content: reply } }]
              }));
              return;
            }

            try {
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
                throw new Error(`OpenAI API returned status ${response.status}`);
              }

              const data = await response.json();
              res.end(JSON.stringify(data));
            } catch (err) {
              console.error('[API Proxy Error]', err);
              const reply = generateSimulatedResponse(messages || []);
              res.end(JSON.stringify({
                choices: [{ message: { content: reply } }]
              }));
            }
            return;
          }
          next();
        });
      }
    }
  ],
  define: {
    // OpenAI API key is handled securely on the backend /api/ai/chat.
  }
})
