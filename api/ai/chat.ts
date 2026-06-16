declare const process: any;

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
