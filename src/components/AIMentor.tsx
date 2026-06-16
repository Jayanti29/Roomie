import React, { useState, useRef, useEffect } from 'react';

interface Message {
  sender: 'user' | 'mentor';
  text: string;
  timestamp: string;
}

interface AIMentorProps {
  userName: string;
  userLevel: number;
}

export const AIMentor: React.FC<AIMentorProps> = ({ userName, userLevel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  // Initialize greeting on mount
  useEffect(() => {
    setMessages([
      {
        sender: 'mentor',
        text: `Hi ${userName}! I am your Roomie AI Companion. I monitor your study consistency and learning progress. How can I help you with your Java, OOP, DSA, React, or DBMS topics today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [userName]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isTyping]);

  const fetchAIResponse = async (history: Message[]): Promise<string> => {
    const formattedMessages = [
      {
        role: 'system',
        content: `You are Roomie AI, a helpful, friendly, and highly intelligent academic mentor and study companion for students. Help the user with computer science topics (like Java, OOP, DSA, React, and DBMS), study strategies, academic planning, and motivation. Maintain a supportive, professional, and engaging tone. Avoid gaming or RPG references.`
      },
      ...history.map(msg => ({
        role: msg.sender === 'mentor' ? 'assistant' : 'user',
        content: msg.text
      }))
    ];

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: formattedMessages
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "I couldn't generate a response.";
    } catch (err) {
      console.error("AI fetch failed:", err);
      throw err;
    }
  };

  const getSimulatedResponse = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes('java') || q.includes('oop')) {
      return `**Java & Object-Oriented Programming (OOP) Insights:**
1. **Four Core Principles**:
   - **Encapsulation**: Keeping fields private, exposing getter/setter methods.
   - **Inheritance**: Subclasses inheriting fields/methods of a superclass using \`extends\`.
   - **Polymorphism**: Method Overloading (compile-time) and Method Overriding (run-time).
   - **Abstraction**: Using abstract classes and interfaces to hide implementation details.
2. **Key Concepts**: Java is platform-independent because of JVM (bytecode execution). Always remember to handle references carefully and implement robust exception handling!`;
    }

    if (q.includes('dsa') || q.includes('algorithm') || q.includes('data structure')) {
      return `**Data Structures & Algorithms (DSA) Roadmap:**
- **Linear Structures**: Arrays, Linked Lists, Stacks, and Queues. Focus on understanding pointers and queue structures.
- **Non-Linear Structures**: Trees (Binary Search Trees, AVL Trees) and Graphs (DFS, BFS traversals).
- **Algorithms**: Sorting (QuickSort, MergeSort) and Search (Binary Search). Focus on Time and Space Complexity (Big O notation) to write optimized code.`;
    }

    if (q.includes('react') || q.includes('frontend')) {
      return `**React Frontend Guidelines:**
- **State Management**: Use hooks like \`useState\`, \`useReducer\`, or context APIs for cross-component state.
- **Component Lifecycle**: Leverage \`useEffect\` for side effects (syncing with database, event listeners). Ensure you return cleanup functions to prevent memory leaks!
- **Renders**: Keep components pure and use functional props to trigger state updates efficiently.`;
    }

    if (q.includes('dbms') || q.includes('sql') || q.includes('database')) {
      return `**Database Management Systems (DBMS) Highlights:**
- **Relational vs. Non-Relational**: SQL databases (PostgreSQL, MySQL) enforce schemas and ACID properties. NoSQL databases (Firebase RTDB, MongoDB) provide unstructured document formats.
- **Key DBMS concepts**: Normalization (1NF, 2NF, 3NF to prevent redundancy), indexing for fast query execution, and transactions (Atomic, Consistent, Isolated, Durable).`;
    }

    if (q.includes('career') || q.includes('interview') || q.includes('resume') || q.includes('job') || q.includes('guidance')) {
      return `**Career Guidance & Technical Interview Prep:**
- **DSA practice**: Focus on arrays, maps, list recursion, and complexity evaluation.
- **Portfolio building**: Create robust full-stack/frontend projects showing integrations like auth and real-time syncing.
- **Mock Interviews**: Explain design decisions out loud step-by-step.`;
    }

    if (q.includes('roadmap') || q.includes('study') || q.includes('learn') || q.includes('plan')) {
      return `**Roomie Recommended Study Roadmap:**
1. **Foundations**: Programming language syntax, modular variables & Git setups.
2. **Intermediate**: DBMS schemas, basic linear data structures, simple REST calls.
3. **Advanced**: Frontend components state, real-time sync, WebSockets/WebRTC, security boundaries.
*Connect in Study Rooms and share templates/notes with peers to stay on track!*`;
    }

    if (q.includes('motivation') || q.includes('burnout') || q.includes('tired') || q.includes('lazy')) {
      return `**Academic Assistant Motivation Channel:**
"Hi ${userName}, consistency is the real key to academic excellence. 
Remember: studying 30 minutes every single day is far more productive than trying to study 10 hours straight on the weekend. 

Break down your tasks into tiny milestones, jump into a Study Room with your peers, and take it one single line of code at a time. You've got this!"`;
    }

    return `I am your Roomie AI Companion. I remember our conversation history and am ready to support your study consistency and roadmap.
Ask me about 'Java', 'OOP', 'DSA', 'React', 'DBMS', 'career guidance', or request a personalized study plan!`;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isTyping) return;

    const userMsg: Message = {
      sender: 'user',
      text: inputVal,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputVal('');
    setIsTyping(true);

    try {
      const reply = await fetchAIResponse(updatedMessages);
      const aiMsg: Message = {
        sender: 'mentor',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    } catch (err) {
      console.warn("AI API failed, falling back to local simulator:", err);
      // Fallback simulation with 1s delay
      setTimeout(() => {
        const aiMsg: Message = {
          sender: 'mentor',
          text: getSimulatedResponse(userMsg.text),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiMsg]);
        setIsTyping(false);
      }, 1000);
    }
  };

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear the chat history?")) {
      setMessages([
        {
          sender: 'mentor',
          text: `Chat history cleared. I am ready to help you with your Java, OOP, DSA, React, or DBMS topics!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  return (
    <>
      {/* Floating Action Button - Drone Companion */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="anim-float"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          border: '3.5px solid #000',
          background: 'var(--accent-gold)',
          backgroundImage: 'url(/assets/ai_companion.png)',
          backgroundSize: '85%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          cursor: 'pointer',
          boxShadow: '4px 4px 0px #000',
          zIndex: 999
        }}
        aria-label="Open AI Mentor"
      />

      {/* Floating Chat Drawer Console */}
      {isOpen && (
        <div 
          className="glass-panel anim-pop" 
          style={{
            position: 'fixed',
            bottom: '7.5rem',
            right: '2rem',
            width: 'calc(100% - 4rem)',
            maxWidth: '380px',
            height: '520px',
            zIndex: 998,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '3px solid #000',
            boxShadow: '8px 8px 0px #000',
            padding: '1rem',
            transition: 'height 0.3s ease, width 0.3s ease'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundImage: 'url(/assets/ai_companion.png)', backgroundSize: 'contain' }} />
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', fontWeight: 800, color: '#000' }}>ROOMIE AI</h3>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-green)', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>● ACTIVE (LEVEL {userLevel})</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button
                onClick={handleClearHistory}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 800,
                  textDecoration: 'underline'
                }}
              >
                Clear
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingRight: '0.2rem' }}>
            {messages.map((msg, idx) => {
              const isMentor = msg.sender === 'mentor';
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMentor ? 'flex-start' : 'flex-end',
                    gap: '0.2rem',
                    maxWidth: '85%',
                    alignSelf: isMentor ? 'flex-start' : 'flex-end'
                  }}
                >
                  <div
                    style={{
                      background: isMentor ? '#f5f5f5' : 'var(--accent-gold)',
                      border: '2px solid #000',
                      borderRadius: isMentor ? '0 12px 12px 12px' : '12px 0 12px 12px',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#000',
                      lineHeight: '1.35',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-line',
                      boxShadow: '2px 2px 0px #000'
                    }}
                  >
                    {msg.text}
                  </div>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}
            
            {isTyping && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', width: 'fit-content' }}>
                <div style={{ 
                  display: 'flex', 
                  gap: '0.35rem', 
                  padding: '0.6rem 1rem', 
                  background: '#f5f5f5', 
                  border: '2px solid #000', 
                  borderRadius: '0 12px 12px 12px', 
                  boxShadow: '2px 2px 0px #000',
                  alignItems: 'center'
                }}>
                  <div style={{ width: '6px', height: '6px', background: '#000', borderRadius: '50%', animation: 'float-bouncy 1.2s infinite' }} />
                  <div style={{ width: '6px', height: '6px', background: '#000', borderRadius: '50%', animation: 'float-bouncy 1.2s infinite 0.2s' }} />
                  <div style={{ width: '6px', height: '6px', background: '#000', borderRadius: '50%', animation: 'float-bouncy 1.2s infinite 0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Input Footer */}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.4rem', borderTop: '2.5px solid #000', paddingTop: '0.5rem' }}>
            <input
              type="text"
              className="cyber-input"
              placeholder="Ask me about Java, React, OOP..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isTyping}
              style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
            />
            <button
              type="submit"
              className="cyber-btn pink-fill"
              disabled={isTyping}
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.8rem',
                padding: '0.5rem 0.8rem',
                border: '2px solid #000',
                boxShadow: '2px 2px 0px #000'
              }}
            >
              SEND
            </button>
          </form>
        </div>
      )}
    </>
  );
};
