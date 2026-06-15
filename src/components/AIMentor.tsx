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
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'mentor',
      text: `Greetings, ${userName}. I am your Sentinel AI Companion. I monitor your skill pathways and consistency metrics. What roadmap, career formulation, or motivation boost do you require today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const getAIResponse = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes('roadmap') || q.includes('study') || q.includes('learn')) {
      return `**RECOMMENDED ROADMAP (DATA SCIENCE & AI):**
1. **FOUNDATIONS**: Python, NumPy vectors, Pandas cleaning. (SP required: 3)
2. **MODELING**: SciKit-Learn regressions, random forests, hyper-tuning. (SP: 2)
3. **NEURAL ARCHITECTURES**: PyTorch neural nets, backpropagation, CNNs. (SP: 2)
4. **AGENTS & DEPLOYMENT**: HuggingFace transformers, Vector databases (Pinecone/Chroma), LangChain agents, cloud container deployment. (SP: 3)
*Complete daily coding missions to gather XP and allocate Skill Points.*`;
    }

    if (q.includes('motivation') || q.includes('burnout') || q.includes('tired') || q.includes('lazy')) {
      return `**SYSTEM ENGAGEMENT INITIATED:**
"Operator, your productivity metrics are displaying variance. Remember: motivation is a transient electrical spike; *Discipline* is a hardwired circuit. 

You are the Main Character of your development timeline. Overfit Code Monster is waiting in the Boss chamber. Stand up, complete a single daily gym or coding quest, and recharge your XP banks. Build your legacy."`;
    }

    if (q.includes('career') || q.includes('portfolio') || q.includes('job') || q.includes('resume')) {
      return `**CAREER CORE METRICS:**
To evolve from an Apprentice to an AI Architect:
1. **GitHub Agency**: Commit code weekly. Avoid empty portfolios; document repos with full architectural specs.
2. **Kaggle Challenges**: Participate in tabular/image competitions. Scoring top 10% unlocks the 'ML Master' tier.
3. **Showcase UI**: Build working web demonstrations. An investor or hiring lead wants to click button outputs, not just look at notebook files.`;
    }

    if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
      return `Hello ${userName}. My diagnostic sensors are fully active. Ask me about your 'roadmap', request a 'motivation' boost, or query 'career' insights.`;
    }

    return `Processed query: "${query}". My neural networks suggest targeting your active Daily Missions first. Completing quests raises your stats, allowing you to bypass level checks. Ask me for a 'roadmap', 'motivation', or 'career' advice for specialized feedback.`;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userMsg: Message = {
      sender: 'user',
      text: inputVal,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');

    setTimeout(() => {
      const aiMsg: Message = {
        sender: 'mentor',
        text: getAIResponse(userMsg.text),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 800);
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
            width: '360px',
            height: '450px',
            zIndex: 998,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            background: '#ffffff',
            border: '3px solid #000',
            boxShadow: '6px 6px 0px #000',
            padding: '1rem'
          }}
        >
          {/* Header - No double slashes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundImage: 'url(/assets/ai_companion.png)', backgroundSize: 'contain' }} />
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', fontWeight: 800, color: '#000' }}>AI COMPANION</h3>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-green)', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>● ONLINE (LVL {userLevel})</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 800 }}
            >
              ✕
            </button>
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
                      lineHeight: '1.3',
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
            <div ref={messagesEndRef} />
          </div>

          {/* Form Input Footer */}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.4rem', borderTop: '2.5px solid #000', paddingTop: '0.5rem' }}>
            <input
              type="text"
              className="cyber-input"
              placeholder="Ask for 'roadmap' or 'motivation'..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
            />
            <button
              type="submit"
              className="cyber-btn pink-fill"
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
