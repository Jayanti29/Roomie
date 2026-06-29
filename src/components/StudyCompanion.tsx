import React, { useState } from 'react';
import { BookOpen, Send, Layers, HelpCircle, FileText, Plus, Sparkles, Eye } from 'lucide-react';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category: string;
}

interface StudyCompanionProps {
  userName: string;
  onRewardXp?: (amount: number, reason: string) => void;
}

export const StudyCompanion: React.FC<StudyCompanionProps> = ({ userName, onRewardXp }) => {
  // Tabs: 'chat', 'flashcards', 'summarizer'
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'flashcards' | 'summarizer'>('chat');

  // Study Partner Chat state
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; isAi: boolean }[]>([
    { sender: 'AI Study Partner', text: `Hi ${userName}! I'm your virtual study companion. Paste an assignment topic, query, or text, and let's break it down together!`, isAi: true }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Flashcards state
  const [flashcards, setFlashcards] = useState<Flashcard[]>([
    { id: 'fc_1', front: 'What is the complexity of binary search?', back: 'O(log n) time complexity, requiring a pre-sorted array.', category: 'Computer Science' },
    { id: 'fc_2', front: 'What is the Mitotic Phase in cell division?', back: 'The phase where the cell separates its DNA and cytoplasm to make two cells.', category: 'Biology' }
  ]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [fcFront, setFcFront] = useState('');
  const [fcBack, setFcBack] = useState('');
  const [fcCategory, setFcCategory] = useState('General');

  // Summarizer state
  const [rawText, setRawText] = useState('');
  const [summaryResult, setSummaryResult] = useState<string[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Chat actions
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { sender: userName, text: chatInput, isAi: false };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = '';
      const textLower = userMsg.text.toLowerCase();
      if (textLower.includes('exam') || textLower.includes('test') || textLower.includes('study')) {
        reply = `Study Partner: "Exams require a structured plan! I suggest dividing the curriculum into 3 key concepts, studying each for 45 minutes using the Pomodoro method, followed by writing active-recall summaries."`;
      } else if (textLower.includes('algorithm') || textLower.includes('code') || textLower.includes('programming')) {
        reply = `Study Partner: "When learning algorithms, trace the variables step-by-step on paper. Writing dry runs helps internalize the loops and edge conditions much better than reading code."`;
      } else {
        reply = `Study Partner: "That's a key topic! Let's break it down into core themes: 1) Historical context, 2) Main formula/definition, and 3) Practical examples. What area should we start on?"`;
      }

      setChatMessages(prev => [...prev, { sender: 'AI Study Partner', text: reply, isAi: true }]);
      setIsTyping(false);
      if (onRewardXp) onRewardXp(5, 'Consulted Study Companion');
    }, 1000);
  };

  // Add Flashcard
  const handleAddFlashcard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fcFront.trim() || !fcBack.trim()) return;

    const newCard: Flashcard = {
      id: 'fc_' + Date.now(),
      front: fcFront,
      back: fcBack,
      category: fcCategory
    };

    setFlashcards(prev => [...prev, newCard]);
    setFcFront('');
    setFcBack('');
    if (onRewardXp) onRewardXp(10, 'Created Flashcard');
  };

  // Auto Generate AI revision flashcards
  const handleAiGenerateFlashcards = () => {
    const aiCards: Flashcard[] = [
      { id: 'ai_1', front: 'What is MVC architecture?', back: 'Model-View-Controller: A software pattern separating data (Model), UI (View), and logic (Controller).', category: 'Web Dev' },
      { id: 'ai_2', front: 'Explain the concept of Inflation.', back: 'The general increase in prices and fall in the purchasing value of money.', category: 'Economics' },
      { id: 'ai_3', front: 'What are the main functions of mitochondria?', back: 'Commonly known as the powerhouse of the cell, generating chemical energy (ATP).', category: 'Biology' },
      { id: 'ai_4', front: 'Define photosynthesis.', back: 'Process used by plants to convert light energy into chemical energy stored in glucose.', category: 'Chemistry' },
      { id: 'ai_5', front: 'What is the primary key in a database?', back: 'A unique identifier for each record in a relational database table.', category: 'Databases' }
    ];

    setFlashcards(prev => [...prev, ...aiCards]);
    if (onRewardXp) onRewardXp(25, 'Generated Flashcard Deck using AI');
  };

  // Handle Summarizer
  const handleSummarize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setIsSummarizing(true);
    setTimeout(() => {
      // Create mockup summarized bullet points from text
      const bullets = [
        `💡 Core Concept: "${rawText.substring(0, 45)}..."`,
        `🔑 Key Insight: Concentrates on maximizing comprehension through structured modular summaries.`,
        `📈 Recommendation: Break this topic down into weekly active-recall challenges.`,
        `🧠 Mnemonics: Use structural mapping to associate formulas with visual cards.`
      ];
      setSummaryResult(bullets);
      setIsSummarizing(false);
      if (onRewardXp) onRewardXp(15, 'Generated Text Summary');
    }, 1200);
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
      
      {/* Banner */}
      <div className="card-flat" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #ede9fe 100%)', border: '3px solid #0f172a', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={24} style={{ color: 'var(--accent-primary)' }} /> AI Study Companion & Flashcards
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '750px', fontWeight: 600 }}>
          Accelerate your revision. Chat with the AI academic partner, study interactive flipping flashcards, or generate quick summaries of dense lecture notes.
        </p>
      </div>

      {/* Sub tabs selector */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #0f172a', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveSubTab('chat')}
          style={{
            padding: '0.5rem 1rem',
            border: '2px solid #0f172a',
            borderRadius: '6px',
            fontWeight: 900,
            fontSize: '0.8rem',
            cursor: 'pointer',
            background: activeSubTab === 'chat' ? 'var(--accent-primary-light)' : '#fff',
            boxShadow: activeSubTab === 'chat' ? '3px 3px 0px #0f172a' : 'none'
          }}
        >
          Study Partner Chat
        </button>
        <button
          onClick={() => setActiveSubTab('flashcards')}
          style={{
            padding: '0.5rem 1rem',
            border: '2px solid #0f172a',
            borderRadius: '6px',
            fontWeight: 900,
            fontSize: '0.8rem',
            cursor: 'pointer',
            background: activeSubTab === 'flashcards' ? 'var(--accent-secondary-light)' : '#fff',
            boxShadow: activeSubTab === 'flashcards' ? '3px 3px 0px #0f172a' : 'none'
          }}
        >
          Revision Flashcards
        </button>
        <button
          onClick={() => setActiveSubTab('summarizer')}
          style={{
            padding: '0.5rem 1rem',
            border: '2px solid #0f172a',
            borderRadius: '6px',
            fontWeight: 900,
            fontSize: '0.8rem',
            cursor: 'pointer',
            background: activeSubTab === 'summarizer' ? 'var(--accent-pink-light)' : '#fff',
            boxShadow: activeSubTab === 'summarizer' ? '3px 3px 0px #0f172a' : 'none'
          }}
        >
          AI Summarizer
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
        
        {/* SUBTAB 1: STUDY CHAT */}
        {activeSubTab === 'chat' && (
          <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '480px', background: '#fff' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <HelpCircle size={18} /> Ask Study Companion
            </h3>
            
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingRight: '4px', marginBottom: '0.8rem' }}>
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: msg.isAi ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    background: msg.isAi ? '#f1f5f9' : 'var(--accent-primary-light)',
                    color: '#0f172a',
                    border: '2px solid #0f172a',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem',
                    boxShadow: '2px 2px 0px #0f172a',
                    fontSize: '0.8rem',
                    lineHeight: '1.4'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                    {msg.sender}
                  </div>
                  <div style={{ fontWeight: 600 }}>{msg.text}</div>
                </div>
              ))}
              {isTyping && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                  Companion is answering...
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about equations, coding concepts, or essay outlines..."
                style={{
                  flex: 1,
                  padding: '0.6rem 0.8rem',
                  border: '2px solid #0f172a',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Send size={14} /> Send
              </button>
            </form>
          </div>
        )}

        {/* SUBTAB 2: FLASHCARDS */}
        {activeSubTab === 'flashcards' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Revision Card Carousel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              
              {/* Flashcard Component */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                style={{
                  width: '100%',
                  height: '240px',
                  perspective: '1000px',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  textAlign: 'center',
                  transition: 'transform 0.6s',
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'none',
                  border: '3px solid #0f172a',
                  borderRadius: '12px',
                  boxShadow: '4px 4px 0px #0f172a',
                  background: isFlipped ? 'var(--accent-secondary-light)' : '#fff'
                }}>
                  
                  {/* Front Side */}
                  <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '1.5rem'
                  }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, background: '#0f172a', color: '#fff', padding: '2px 8px', borderRadius: '4px', position: 'absolute', top: '10px' }}>
                      {flashcards[currentCardIndex]?.category || 'General'}
                    </span>
                    <p style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                      {flashcards[currentCardIndex]?.front || 'Add a flashcard to start!'}
                    </p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, position: 'absolute', bottom: '10px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Eye size={12} /> Click to flip
                    </span>
                  </div>

                  {/* Back Side */}
                  <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '1.5rem'
                  }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, background: '#0f172a', color: '#fff', padding: '2px 8px', borderRadius: '4px', position: 'absolute', top: '10px' }}>
                      Answer
                    </span>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', lineHeight: '1.4' }}>
                      {flashcards[currentCardIndex]?.back || ''}
                    </p>
                  </div>

                </div>
              </div>

              {/* Navigation controls */}
              {flashcards.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentCardIndex(prev => (prev === 0 ? flashcards.length - 1 : prev - 1));
                    }}
                    className="btn-primary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>
                    {currentCardIndex + 1} / {flashcards.length}
                  </span>
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentCardIndex(prev => (prev === flashcards.length - 1 ? 0 : prev + 1));
                    }}
                    className="btn-primary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                  >
                    Next
                  </button>

                  <button
                    onClick={handleAiGenerateFlashcards}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      background: 'linear-gradient(90deg, #ede9fe 0%, #fee2e2 100%)',
                      border: '2px solid #0f172a',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      marginLeft: '1rem'
                    }}
                  >
                    <Sparkles size={12} /> AI Revision Deck
                  </button>
                </div>
              )}

            </div>

            {/* Create Custom Flashcard Form */}
            <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Plus size={18} /> Add Revision Card
              </h3>
              <form onSubmit={handleAddFlashcard} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Front / Question</label>
                  <input
                    type="text"
                    value={fcFront}
                    onChange={e => setFcFront(e.target.value)}
                    placeholder="e.g. What is cellular respiration?"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '2px solid #0f172a',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Back / Answer</label>
                  <textarea
                    value={fcBack}
                    onChange={e => setFcBack(e.target.value)}
                    placeholder="Provide the core answer/definition..."
                    required
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '2px solid #0f172a',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      resize: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Category</label>
                  <input
                    type="text"
                    value={fcCategory}
                    onChange={e => setFcCategory(e.target.value)}
                    placeholder="e.g. Science or Languages"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '2px solid #0f172a',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '0.55rem', fontWeight: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Layers size={14} /> Add Flashcard
                </button>
              </form>
            </div>

          </div>
        )}

        {/* SUBTAB 3: AI SUMMARIZER */}
        {activeSubTab === 'summarizer' && (
          <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={18} /> Revision Text Summarizer & Mindmap helper
            </h3>
            
            <form onSubmit={handleSummarize} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Paste Study Notes / Article Text</label>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder="Paste up to 5000 characters of lecture content, books, or online articles to summarize..."
                  rows={6}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '2px solid #0f172a',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    resize: 'none'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isSummarizing}
                style={{
                  padding: '0.6rem 1.2rem',
                  alignSelf: 'flex-start',
                  fontWeight: 900,
                  fontSize: '0.8rem',
                  border: '2px solid #0f172a',
                  borderRadius: '6px',
                  cursor: isSummarizing ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(90deg, #ede9fe 0%, #dbeafe 100%)',
                  boxShadow: '3px 3px 0px #0f172a'
                }}
              >
                {isSummarizing ? 'Analyzing text...' : 'Generate Structural Summary'}
              </button>
            </form>

            {summaryResult.length > 0 && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: '#f8fafc',
                border: '2px solid #0f172a',
                borderRadius: '8px',
                boxShadow: '3px 3px 0px #0f172a'
              }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 900, marginBottom: '0.6rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} /> AI Summary Blueprint
                </h4>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.25rem', listStyleType: 'disc', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {summaryResult.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};
