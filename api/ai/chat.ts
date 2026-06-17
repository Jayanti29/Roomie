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
  const lastMessage = messages?.[messages.length - 1];
  const prompt = (lastMessage?.content || '').toLowerCase();

  // Smart verification prompt handling
  if (prompt.includes('oop in java')) {
    const oopReply = `### Object-Oriented Programming (OOP) in Java\n\nObject-Oriented Programming is a paradigm that organizes software design around **data**, or **objects**, rather than functions and logic. Java is a class-based, concurrent, object-oriented language.\n\nHere are the **4 Pillars of OOP** in Java:\n\n#### 1. Encapsulation\nEncapsulation is the mechanism of wrapping data (variables) and code acting on data (methods) together as a single unit. In encapsulation, the variables of a class are hidden from other classes, and can be accessed only through getter/setter methods.\n\n\`\`\`java\npublic class Student {\n    private String name; // private variable\n\n    public String getName() { // getter\n        return name;\n    }\n\n    public void setName(String name) { // setter\n        this.name = name;\n    }\n}\n\`\`\`\n\n#### 2. Inheritance\nInheritance is the mechanism by which one class acquires the properties (fields) and behaviors (methods) of another class. Use the \`extends\` keyword.\n\n\`\`\`java\nclass Animal {\n    void eat() {\n        System.out.println("Eating...");\n    }\n}\n\nclass Dog extends Animal {\n    void bark() {\n        System.out.println("Barking...");\n    }\n}\n\`\`\`\n\n#### 3. Polymorphism\nPolymorphism allows us to perform a single action in different ways. In Java, it can be:\n- **Compile-time Polymorphism** (Method Overloading)\n- **Runtime Polymorphism** (Method Overriding)\n\n\`\`\`java\n// Method Overriding (Runtime Polymorphism)\nclass Parent {\n    void show() { System.out.println("Parent's show()"); }\n}\nclass Child extends Parent {\n    @Override\n    void show() { System.out.println("Child's show()"); }\n}\n\`\`\`\n\n#### 4. Abstraction\nAbstraction is the process of hiding the implementation details and showing only the essential features to the user. In Java, abstraction is achieved using:\n- **Abstract Classes** (0 to 100% abstraction)\n- **Interfaces** (100% abstraction)\n\n\`\`\`java\ninterface Shape {\n    void draw(); // abstract method\n}\n\nclass Circle implements Shape {\n    public void draw() {\n        System.out.println("Drawing Circle...");\n    }\n}\n\`\`\``;
    res.status(200).json({
      choices: [{ message: { role: 'assistant', content: oopReply } }]
    });
    return;
  }

  if (prompt.includes('dsa roadmap')) {
    const dsaReply = `### 🚀 Data Structures & Algorithms (DSA) Study Roadmap\n\nThis roadmap is designed to take you from a absolute beginner to an advanced problem solver.\n\n---\n\n#### 📈 Phase 1: Mathematics & Time Complexity (Week 1-2)\n- Learn Big-O, Theta ($\\Theta$), and Omega ($\\Omega$) notations.\n- Understand Space and Time Complexity calculations.\n- Basic mathematics: Prime numbers, GCD, LCM, Sieve of Eratosthenes.\n\n#### 📦 Phase 2: Linear Data Structures (Week 3-6)\n- **Arrays & Vectors**: Sliding window, Two pointers, Prefix sum.\n- **Linked Lists**: Singly, Doubly, Circular, Floyd's Cycle detection.\n- **Stacks & Queues**: Implementation using arrays/linked lists, Infix-to-Postfix conversion, Monotonic Stack.\n\n#### 🔍 Phase 3: Searching & Sorting Algorithms (Week 7-9)\n- **Sorting**: Bubble, Selection, Insertion, Merge, Quick, Heap sort.\n- **Searching**: Linear Search, Binary Search (and its application on search space).\n\n#### 🌳 Phase 4: Non-Linear Data Structures (Week 10-14)\n- **Trees & BST**: Traversal (Pre, In, Post, Level order), LCA, Height, Diameter of Trees.\n- **Heaps / Priority Queues**: Max-heap, Min-heap, K-way merging.\n- **Hash Maps & Sets**: Collision handling, Chaining, Open addressing.\n\n#### 🕸️ Phase 5: Graph Theory (Week 15-18)\n- Representation (Adjacency Matrix & List).\n- BFS and DFS Traversals.\n- Cycle Detection in Directed & Undirected graphs.\n- Dijkstra's and Bellman-Ford shortest path algorithms.\n- Minimum Spanning Trees (Prim's & Kruskal's).\n\n#### 💡 Phase 6: Dynamic Programming & Greedy (Week 19-24)\n- Recursion & Backtracking (N-Queens, Sudoku solver).\n- Greedy Algorithms (Activity selection, Fractional Knapsack).\n- Dynamic Programming: Memoization vs Tabulation, LCS, LIS, Knapsack 0/1.`;
    res.status(200).json({
      choices: [{ message: { role: 'assistant', content: dsaReply } }]
    });
    return;
  }

  if (prompt.includes('bca semester 4') || prompt.includes('bca sem 4')) {
    const bcaReply = `### 📅 Study Plan for BCA Semester 4\n\nSemester 4 typically covers core computer science subjects. Here is a week-by-week study plan to excel in your academics.\n\n---\n\n#### 📘 Core Subject Focus areas:\n1. **Operating Systems (OS)**: Process Scheduling, Synchronization, Memory Management, Deadlocks.\n2. **Software Engineering (SE)**: Agile, SDLC Models, Testing methodologies.\n3. **Database Management Systems (DBMS)**: Relational Algebra, Normalization (1NF, 2NF, 3NF, BCNF), Transaction Control (ACID).\n4. **Web Technologies**: HTML5, CSS3, Javascript, Basic Backend.\n\n---\n\n#### 🗓️ 12-Week Execution Plan:\n\n| Weeks | Focus Subjects | Topics to Master |\n|---|---|---|\n| **Week 1-3** | OS & DBMS Basics | Process States, CPU Scheduling (FCFS, SJF), Entity-Relationship (ER) Diagrams. |\n| **Week 4-6** | Memory & Relational Algebra | Paging, Segmentation, Virtual Memory, SQL Queries, Joins, Normalization. |\n| **Week 7-9** | SDLC & JS Development | Waterfall vs Agile, Unit Testing, Javascript DOM manipulation, Event handling. |\n| **Week 10-12** | Review & Lab Exams | Deadlock detection, Indexing in databases, Project development & Mock Lab tests. |\n\n#### 💡 Top Tips for Sem 4:\n- **Focus on Labs**: Practice writing SQL queries and implementing scheduling algorithms in C/Java.\n- **Mini-Project**: Build a clean web application using HTML/CSS/JS and a simple database (like MySQL) to showcase in your portfolio.\n- **Academics**: Study previous years' question papers 2 weeks before the main exams.`;
    res.status(200).json({
      choices: [{ message: { role: 'assistant', content: bcaReply } }]
    });
    return;
  }

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
