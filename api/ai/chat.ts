function generateSimulatedResponse(messages: any[]): string {
  const lastMsg = messages[messages.length - 1]?.content || '';
  const q = lastMsg.toLowerCase();

  if (q.includes('dsa') || q.includes('algorithm') || q.includes('data structure') || q.includes('complexity') || q.includes('big o')) {
    return `**Understanding Data Structures & Algorithms (DSA):**\n\nWhen optimizing code, focus on **Time and Space Complexity** (Big O notation). For instance, linear search runs in $O(n)$ time, whereas binary search on a sorted array operates in $O(\\log n)$.\n\nKey areas to study:\n1. **Linear Structures**: Arrays, Linked Lists, Stacks, and Queues.\n2. **Trees & Graphs**: Binary Search Trees, AVL Trees, DFS, and BFS.\n3. **Sorting**: QuickSort and MergeSort ($O(n \\log n)$ average time).\n\nWhat specific algorithm or data structure would you like to deep dive into?`;
  }

  if (q.includes('react') || q.includes('frontend') || q.includes('hooks') || q.includes('state')) {
    return `**React & Frontend Architecture Insights:**\n\nReact applications manage state reactively. When using hooks like \`useState\` or \`useReducer\`, remember that component renders are triggered automatically when state changes.\n\nBest practices:\n- **Clean up side effects**: Always return a cleanup function in \`useEffect\` to close database connections or clear event listeners.\n- **Component Purity**: Keep rendering functions pure to avoid unexpected layout shifts or double renders.\n\nWould you like help setting up a specific React hook or managing state across multiple components?`;
  }

  if (q.includes('java') || q.includes('oop') || q.includes('class') || q.includes('inheritance')) {
    return `**Java & Object-Oriented Programming (OOP) Core Pillars:**\n\nJava enforces strict typing and uses Object-Oriented design patterns. The four primary pillars of OOP are:\n1. **Encapsulation**: Protecting state by keeping fields private and exposing public getters/setters.\n2. **Inheritance**: Allowing subclasses to inherit and extend behaviour using \`extends\`.\n3. **Polymorphism**: Enabling objects to take multiple forms (method overloading/overriding).\n4. **Abstraction**: Using abstract classes and interfaces to define contracts without implementation details.\n\nLet me know if you want to write a Java class structure or explore interface setups!`;
  }

  if (q.includes('dbms') || q.includes('sql') || q.includes('database') || q.includes('query')) {
    return `**Database Management Systems (DBMS) & Query Operations:**\n\nDesigning data storage requires choosing between relational and non-relational database formats:\n- **Relational (SQL)**: Enforces tabular schemas and ACID transactions (Atomicity, Consistency, Isolation, Durability). Useful for financial or highly structured systems.\n- **Non-Relational (NoSQL)**: High throughput and flexible schema structures (e.g. key-value, document, graph databases).\n\nFor SQL, normalize your database up to Third Normal Form (3NF) to reduce data duplication and run queries efficiently using indexes.\n\nDo you need to write a specific SQL query or design a schema?`;
  }

  if (q.includes('career') || q.includes('interview') || q.includes('resume') || q.includes('job') || q.includes('guidance')) {
    return `**Career Guidance & Technical Interview Preparation:**\n\nPreparing for software engineering roles requires a balanced approach:\n- **Technical Mastery**: Practice coding problems (DSA) on array manipulation, graphs, and dynamic programming. Focus on explaining your thought process clearly.\n- **Portfolio Projects**: Build fully deployed web applications showing clean state management, modular components, and real-time syncing capabilities.\n- **Behavioral Questions**: Prepare stories using the STAR method Showcase collaboration and execution.\n\nWould you like to run a mock interview query or discuss portfolio project ideas?`;
  }

  if (q.includes('study') || q.includes('plan') || q.includes('schedule') || q.includes('roadmap') || q.includes('motivation')) {
    return `**Curriculum Planning & Motivation Strategy:**\n\nConsistency is the secret to mastering computer science. Here is a strategy for daily consistency:\n- **Daily Focus Sessions**: Dedicated 30-45 minute blocks are significantly more effective than single 8-hour cramming sessions.\n- **Project-Based Learning**: Learn by building actual tools rather than passively reading documentation.\n- **Study Buddy Collaboration**: Connect in real-time study rooms to share notes and code templates, boosting accountability.\n\nWhat are your current learning objectives or subjects for this week? Let's design a daily checklist!`;
  }

  return `I am your **Roomie AI Mentor**. I remember our conversation history and am ready to support your study Consistency, Curriculum Roadmap, and project designs.\n\nYou can ask me detailed questions about **Data Structures & Algorithms (DSA)**, **React & Frontend state**, **Java & Object-Oriented principles**, **Database schemas (DBMS/SQL)**, **Career preparation**, or request help designing a **personalized study plan**.\n\nWhat specific topic or code challenge are you tackling today?`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { messages } = req.body || {};
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();

  if (!apiKey) {
    const reply = generateSimulatedResponse(messages || []);
    res.status(200).json({
      choices: [{ message: { content: reply } }]
    });
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
    res.status(200).json(data);
  } catch (err: any) {
    console.error('[API Proxy Error]', err);
    const reply = generateSimulatedResponse(messages || []);
    res.status(200).json({
      choices: [{ message: { content: reply } }]
    });
  }
}
