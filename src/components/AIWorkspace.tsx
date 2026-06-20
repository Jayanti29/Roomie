// src/components/AIWorkspace.tsx
import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, onChildAdded, onChildChanged, onChildRemoved, set, update } from '../firebase';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  assistantType: string;
  messages: ChatMessage[];
  timestamp: number;
}

interface AIWorkspaceProps {
  userEmail: string;
  userName: string;
}

// System prompts for the 8 modules
const assistantPrompts: Record<string, string> = {
  tutor: "You are Roomie AI Tutor. Explain complex topics simply, teach programming logic, solve math formulas step-by-step, and clarify concepts.",
  planner: "You are Roomie AI Planner. Design study schedules, break down long-term academic projects, prioritize tasks, and structure check-lists.",
  coding: "You are Roomie Coding Assistant. Write correct code, resolve compiler bugs, explain data structures and algorithms, and optimize complexity.",
  research: "You are Roomie Research Assistant. Summarize academic drafts, prepare study guides, outline reports, and help construct references.",
  coach: "You are Roomie Interview Coach. Run technical mock interviews and behavioral sessions. Provide critical feedback and apply the STAR method.",
  resume: "You are Roomie Resume Reviewer. Review tech profiles, suggest formatting fixes, rewrite accomplishments with action verbs, and analyze impact.",
  advisor: "You are Roomie Career Advisor. Outline industry trends in India, help align degrees with career opportunities, and suggest skills to master.",
  mentor: "You are Roomie Study Mentor. Keep the student motivated, share focus strategies (like Pomodoro), combat burnout, and optimize concentration."
};

const assistantNames: Record<string, string> = {
  tutor: "AI Tutor",
  planner: "AI Planner",
  coding: "Coding Assistant",
  research: "Research Assistant",
  coach: "Interview Coach",
  resume: "Resume Reviewer",
  advisor: "Career Advisor",
  mentor: "Study Mentor"
};

export const AIWorkspace: React.FC<AIWorkspaceProps> = ({ userEmail, userName }) => {
  const [activeAssistant, setActiveAssistant] = useState('tutor');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  // Input text and searching
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const userKey = userEmail.replace(/\./g, '_');

  // Load chat history from Firebase
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    const historyRef = ref(db, `users/${userKey}/ai_history`);
    
    const onChatAdded = onChildAdded(historyRef, (snap) => {
      const val = snap.val();
      if (val) {
        setConversations(prev => {
          if (prev.some(c => c.id === val.id)) return prev;
          return [val, ...prev].sort((a,b) => b.timestamp - a.timestamp);
        });
      }
    });

    const onChatChanged = onChildChanged(historyRef, (snap) => {
      const val = snap.val();
      if (val) {
        setConversations(prev => prev.map(c => c.id === val.id ? val : c));
      }
    });

    const onChatRemoved = onChildRemoved(historyRef, (snap) => {
      const val = snap.val();
      if (val) {
        setConversations(prev => prev.filter(c => c.id !== val.id));
        setActiveChatId(current => current === val.id ? null : current);
      }
    });

    return () => {
      onChatAdded();
      onChatChanged();
      onChatRemoved();
    };
  }, [isFirebaseConfigured, userKey]);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeChatId, isTyping]);

  const activeChat = conversations.find(c => c.id === activeChatId);

  // Start a new chat
  const handleStartNewChat = async (assistantType: string) => {
    const chatId = `chat_${Date.now()}`;
    const newChat: Conversation = {
      id: chatId,
      title: `Chat with ${assistantNames[assistantType]}`,
      assistantType,
      messages: [
        {
          role: 'system',
          content: assistantPrompts[assistantType] || 'You are Roomie AI.'
        },
        {
          role: 'assistant',
          content: `Hello ${userName}! I am your ${assistantNames[assistantType]}. How can I assist you with your studies today?`
        }
      ],
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `users/${userKey}/ai_history/${chatId}`), newChat);
    } else {
      setConversations(prev => [newChat, ...prev]);
    }
    setActiveChatId(chatId);
    setActiveAssistant(assistantType);
  };

  // Send message to AI Proxy
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatId || isTyping) return;

    const chat = conversations.find(c => c.id === activeChatId);
    if (!chat) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput
    };

    const updatedMessages = [...chat.messages, userMessage];
    
    // Save user message to DB
    if (isFirebaseConfigured && db) {
      await update(ref(db, `users/${userKey}/ai_history/${activeChatId}`), {
        messages: updatedMessages,
        timestamp: Date.now()
      });
    }

    setChatInput('');
    setIsTyping(true);

    try {
      // API request to Vercel Serverless proxy `/api/ai/chat`
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: updatedMessages
        })
      });

      if (!response.ok) {
        throw new Error("Gemini/OpenAI Proxy Error");
      }

      const data = await response.json();
      const aiReply = data.choices?.[0]?.message?.content || 'Sorry, I encountered an issue generating a response. Please try again.';

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiReply
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      
      // Update with AI reply
      if (isFirebaseConfigured && db) {
        await update(ref(db, `users/${userKey}/ai_history/${activeChatId}`), {
          messages: finalMessages,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error(err);
      const errMessage: ChatMessage = {
        role: 'assistant',
        content: 'Error: Failed to reach the Roomie AI service proxy. Please check your internet connection or verify your Vercel environmental API keys.'
      };
      if (isFirebaseConfigured && db) {
        await update(ref(db, `users/${userKey}/ai_history/${activeChatId}`), {
          messages: [...updatedMessages, errMessage],
          timestamp: Date.now()
        });
      }
    } finally {
      setIsTyping(false);
    }
  };

  // Rename Conversation
  const handleRenameChat = async (chatId: string) => {
    if (!editTitleText.trim()) return;
    if (isFirebaseConfigured && db) {
      await update(ref(db, `users/${userKey}/ai_history/${chatId}`), {
        title: editTitleText
      });
    }
    setEditingChatId(null);
    setEditTitleText('');
  };

  // Delete Conversation
  const handleDeleteChat = async (chatId: string) => {
    if (!confirm("Are you sure you want to delete this chat session?")) return;
    if (isFirebaseConfigured && db) {
      await set(ref(db, `users/${userKey}/ai_history/${chatId}`), null);
    }
  };

  // Export Chat to Markdown File
  const handleExportChat = (chat: Conversation) => {
    const mdContent = chat.messages
      .filter(m => m.role !== 'system')
      .map(m => `### ${m.role === 'user' ? userName : 'Roomie AI'}\n\n${m.content}\n\n---`)
      .join('\n\n');

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chat.title.replace(/\s+/g, '_')}_transcript.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Autocomplete code block copying helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Code copied to clipboard!');
  };

  // Custom parser to split paragraphs & code blocks
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const codeLines = lines.slice(1, lines.length - 1).join('\n');
        const language = lines[0].replace('```', '').trim() || 'javascript';
        return (
          <div key={index} style={{ border: '1px solid var(--outline-thick)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden', margin: '0.75rem 0', boxShadow: 'var(--shadow-flat-sm)', background: '#1e293b' }}>
            <div style={{ background: '#0f172a', color: '#cbd5e1', padding: '0.5rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', borderBottom: '1px solid #334155', fontWeight: 600 }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{language}</span>
              <button
                onClick={() => copyToClipboard(codeLines)}
                className="cyber-btn"
                style={{ background: '#334155', border: '1px solid #475569', color: '#f1f5f9', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', minHeight: 'auto' }}
              >
                Copy Code
              </button>
            </div>
            <pre style={{ padding: '1rem', color: '#e2e8f0', fontSize: '0.8rem', overflowX: 'auto', fontFamily: 'var(--font-mono)', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
              <code>{codeLines}</code>
            </pre>
          </div>
        );
      }
      
      // Simple inline code highlighting
      const inlineParts = part.split(/(`[^`]+`)/g);
      const parsedText = inlineParts.map((subPart, subIdx) => {
        if (subPart.startsWith('`')) {
          return (
            <code key={subIdx} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 5px', borderRadius: '4px', color: 'var(--accent-pink)', fontFamily: 'var(--font-mono)', fontSize: '0.85em', fontWeight: 600 }}>
              {subPart.replace(/`/g, '')}
            </code>
          );
        }
        return subPart;
      });

      return <span key={index} style={{ display: 'inline', whiteSpace: 'pre-wrap' }}>{parsedText}</span>;
    });
  };

  // Filter conversations
  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="notes-board-grid" style={{ paddingBottom: '2rem', height: 'calc(100vh - 180px)', minHeight: '520px' }}>
      
      {/* LEFT PANEL: AI Assistants Selector & History */}
      <div className="glass-panel" style={{ background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '0.8rem', height: '100%', overflowY: 'auto', border: '1px solid var(--outline-thick)' }}>
        
        {/* Modules Directory */}
        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '4px' }}>
          Select AI Assistant
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
          {Object.keys(assistantNames).map(key => (
            <button
              key={key}
              onClick={() => handleStartNewChat(key)}
              style={{
                padding: '0.5rem 0.4rem',
                fontSize: '0.75rem',
                minHeight: 'auto',
                border: activeAssistant === key && !activeChatId ? '1px solid var(--accent-purple)' : '1px solid var(--outline-thick)',
                borderRadius: 'var(--border-radius-sm)',
                background: activeAssistant === key && !activeChatId ? 'var(--accent-primary-light)' : '#ffffff',
                color: activeAssistant === key && !activeChatId ? 'var(--accent-purple)' : 'var(--text-secondary)',
                fontWeight: activeAssistant === key && !activeChatId ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              {assistantNames[key]}
            </button>
          ))}
        </div>

        {/* Search bar history */}
        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '4px', marginTop: '0.75rem' }}>
          Conversations History
        </h4>
        <input
          type="text"
          className="cyber-input"
          style={{ fontSize: '0.75rem', padding: '0.4rem' }}
          placeholder="Search chat sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* History List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length === 0 ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No past chats found.</span>
          ) : (
            filteredConversations.map(chat => (
              <div
                key={chat.id}
                style={{
                  border: activeChatId === chat.id ? '1px solid var(--accent-cyan)' : '1px solid var(--outline-thick)',
                  borderRadius: 'var(--border-radius-sm)',
                  padding: '0.4rem 0.6rem',
                  background: activeChatId === chat.id ? 'var(--accent-primary-light)' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setActiveAssistant(chat.assistantType);
                }}
              >
                {editingChatId === chat.id ? (
                  <input
                    type="text"
                    className="cyber-input"
                    style={{ fontSize: '0.75rem', padding: '2px 4px', minHeight: 'auto' }}
                    value={editTitleText}
                    onChange={(e) => setEditTitleText(e.target.value)}
                    onBlur={() => handleRenameChat(chat.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameChat(chat.id)}
                    autoFocus
                  />
                ) : (
                  <span style={{ fontSize: '0.75rem', fontWeight: activeChatId === chat.id ? 700 : 500, color: activeChatId === chat.id ? 'var(--accent-cyan)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>
                    {chat.title}
                  </span>
                )}

                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingChatId(chat.id);
                      setEditTitleText(chat.title);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem' }}
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(chat.id);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem' }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* RIGHT PANEL: Chat Workspace */}
      <div className="glass-panel" style={{ background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', border: '1px solid var(--outline-thick)' }}>
        {!activeChatId ? (
          // NO ACTIVE CHAT
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>
            Choose an AI Assistant from the left panel to launch a new tutoring session.
          </div>
        ) : (
          // ACTIVE CHAT
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.5rem' }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--text-primary)' }}>
                {activeChat?.title}
              </strong>
              <button
                onClick={() => activeChat && handleExportChat(activeChat)}
                className="cyber-btn"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', minHeight: 'auto', background: '#f1f5f9' }}
              >
                Export Chat
              </button>
            </div>

            {/* Message Feed */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.8rem',
              padding: '1rem',
              background: '#f8fafc',
              border: '1px solid var(--outline-medium)',
              borderRadius: 'var(--border-radius-md)'
            }}>
              {activeChat?.messages.filter(m => m.role !== 'system').map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, alignSelf: isUser ? 'flex-end' : 'flex-start', marginBottom: '2px' }}>
                      {isUser ? userName : assistantNames[activeChat.assistantType]}
                    </span>
                    <div style={{
                      background: isUser ? 'var(--accent-primary)' : '#fff',
                      color: isUser ? '#ffffff' : 'var(--text-primary)',
                      border: isUser ? 'none' : '1px solid var(--outline-thick)',
                      borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: '0.6rem 0.8rem',
                      boxShadow: 'var(--shadow-flat-sm)',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      lineHeight: '1.4'
                    }}>
                      {renderMessageContent(msg.content)}
                    </div>
                  </div>
                );
              })}
              {isTyping && (
                <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', maxWidth: '85%', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>AI is typing...</span>
                  <div style={{ background: '#fff', border: '1px solid var(--outline-thick)', borderRadius: '12px 12px 12px 2px', padding: '0.6rem 0.8rem', boxShadow: 'var(--shadow-flat-sm)', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Generating dynamic response...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                className="cyber-input"
                style={{ flex: 1 }}
                placeholder={`Ask ${assistantNames[activeChat?.assistantType || '']} anything...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isTyping}
                required
              />
              <button
                type="submit"
                disabled={isTyping}
                className="cyber-btn pink-fill"
                style={{ padding: '0.6rem 1.2rem', minHeight: '42px' }}
              >
                Ask
              </button>
            </form>
          </>
        )}
      </div>

    </div>
  );
};
