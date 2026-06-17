// src/components/CommunityChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, push, onChildAdded, get, set } from '../firebase';

interface ChatMessage {
  id: string;
  sender: string;
  senderEmail: string;
  text: string;
  timestamp: number;
}

interface Channel {
  id: string;
  name: string;
}

interface CommunityChatProps {
  userName: string;
  userEmail: string;
  isAdmin?: boolean;
}

export const CommunityChat: React.FC<CommunityChatProps> = ({
  userName,
  userEmail,
  isAdmin
}) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState('chan_general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const defaultChannels = [
    { id: 'chan_general', name: '💬 general' },
    { id: 'chan_announcements', name: '📢 announcements' },
    { id: 'chan_help', name: '🙋 help-me' },
    { id: 'chan_college', name: '🏫 college-life' },
    { id: 'chan_placement', name: '💼 placement-prep' },
    { id: 'chan_doubts', name: '🤔 academic-doubts' },
    { id: 'chan_career', name: '🎯 career-guidance' },
    { id: 'chan_engineering', name: '⚙️ engineering-btech' },
    { id: 'chan_bca_mca', name: '💻 bca-mca-it' },
    { id: 'chan_medical', name: '🏥 medical-mbbs' },
    { id: 'chan_commerce', name: '📊 commerce-bcom-ca' },
    { id: 'chan_law', name: '⚖️ law-llb' },
    { id: 'chan_arts', name: '📚 arts-humanities' },
    { id: 'chan_design', name: '🎨 design-nift-nid' },
    { id: 'chan_upsc', name: '🏛️ upsc-govt-exams' },
    { id: 'chan_coding', name: '🖥️ coding-dsa-projects' },
    { id: 'chan_offtopic', name: '🎮 off-topic' }
  ];

  // Initialize and load channels list
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    const channelsRef = ref(db, 'community_channels');
    
    // Check if channels are empty, if so, write default ones
    get(channelsRef).then(async (snap) => {
      if (!snap.exists() || !snap.val()) {
        for (const chan of defaultChannels) {
          await set(ref(db, 'community_channels/' + chan.id), chan);
        }
      }
    });

    const unsub = onChildAdded(channelsRef, (snap) => {
      const val = snap.val();
      if (val) {
        setChannels(prev => {
          if (prev.some(c => c.id === val.id)) return prev;
          return [...prev, val];
        });
      }
    });

    return () => {
      unsub();
    };
  }, [isFirebaseConfigured]);

  // Subscribe to messages in the active channel
  useEffect(() => {
    setMessages([]); // Clear old messages
    if (!isFirebaseConfigured || !db || !activeChannelId) return;

    const msgsRef = ref(db, `community_channels/${activeChannelId}/messages`);
    
    const unsub = onChildAdded(msgsRef, (snap) => {
      const val = snap.val();
      if (val) {
        setMessages(prev => {
          if (prev.some(m => m.id === val.id)) return prev;
          return [...prev, val];
        });
      }
    });

    return () => {
      unsub();
    };
  }, [activeChannelId]);

  // Auto Scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Announcements restriction: Only admin can post in announcements
    if (activeChannelId === 'chan_announcements' && !isAdmin) {
      alert("Only administrators can post announcements.");
      return;
    }

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sender: userName,
      senderEmail: userEmail,
      text: inputText,
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await push(ref(db, `community_channels/${activeChannelId}/messages`), newMsg);
    }

    setInputText('');
  };

  // Create Channel (Admin Only)
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newChannelName.trim()) return;

    const channelSlug = newChannelName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const newId = `chan_${Date.now()}`;
    const newChan = {
      id: newId,
      name: channelSlug
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, 'community_channels/' + newId), newChan);
      // Join system message
      const sysMsg = {
        id: `sys_${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@roomie.io',
        text: `Channel #${channelSlug} was created.`,
        timestamp: Date.now()
      };
      await push(ref(db, `community_channels/${newId}/messages`), sysMsg);
    }

    setNewChannelName('');
    setShowCreateModal(false);
    setActiveChannelId(newId);
  };

  const currentChannel = channels.find(c => c.id === activeChannelId);

  return (
    <div className="notes-board-grid" style={{ paddingBottom: '2rem', height: 'calc(100vh - 180px)', minHeight: '500px' }}>
      
      {/* SIDEBAR: Channels Directory */}
      <div className="glass-panel" style={{ background: '#fff', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900 }}>
            💬 CHAT CHANNELS
          </h3>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="cyber-btn"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', minHeight: 'auto', background: 'var(--accent-gold)' }}
            >
              + NEW
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto', flex: 1 }}>
          {channels.map(chan => (
            <button
              key={chan.id}
              onClick={() => setActiveChannelId(chan.id)}
              style={{
                textAlign: 'left',
                padding: '0.6rem 0.8rem',
                border: '2px solid #000',
                borderRadius: '10px',
                fontFamily: 'var(--font-body)',
                fontWeight: 800,
                fontSize: '0.85rem',
                background: activeChannelId === chan.id ? 'var(--accent-purple)' : '#f8f9fa',
                cursor: 'pointer',
                boxShadow: activeChannelId === chan.id ? '2px 2px 0px #000' : 'none',
                transform: activeChannelId === chan.id ? 'translate(-1px, -1px)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              # {chan.name}
            </button>
          ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="glass-panel" style={{ background: '#fff', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        
        {/* Chat Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 900 }}>
            # {currentChannel ? currentChannel.name : 'select-channel'}
          </h3>
          {activeChannelId === 'chan_announcements' && (
            <span style={{ fontSize: '0.6rem', background: 'var(--accent-pink)', border: '1.5px solid #000', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 800, color: '#fff' }}>
              ANNOUNCEMENTS (ADMIN ONLY)
            </span>
          )}
        </div>

        {/* Message Feed */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem',
          padding: '0.5rem',
          background: '#fafafa',
          border: '2.5px solid #000',
          borderRadius: '12px'
        }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
              No messages here yet. Say hello!
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.senderEmail === userEmail;
              const isSystem = msg.sender === 'System';

              if (isSystem) {
                return (
                  <div key={msg.id} style={{ textAlign: 'center', margin: '0.4rem 0' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: '#eaeaea', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #ddd', fontWeight: 700 }}>
                      📢 {msg.text}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    gap: '2px',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, marginLeft: isMe ? '0' : '8px', marginRight: isMe ? '8px' : '0', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                    {msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div
                    style={{
                      background: isMe ? 'var(--accent-cyan)' : '#ffffff',
                      border: '2px solid #000',
                      borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: '0.6rem 0.8rem',
                      boxShadow: '2px 2px 0px #000',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#000',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        {(activeChannelId !== 'chan_announcements' || isAdmin) ? (
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="cyber-input"
              style={{ flex: 1 }}
              placeholder={activeChannelId === 'chan_announcements' ? "Post official announcement..." : `Message #${currentChannel?.name || 'channel'}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              required
            />
            <button
              type="submit"
              className="cyber-btn purple-fill"
              style={{ padding: '0.6rem 1.2rem', minHeight: '42px', border: '2.5px solid #000', boxShadow: '2px 2px 0px #000' }}
            >
              SEND
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', padding: '0.5rem', background: '#fcf8e3', border: '2px dashed #faebcc', borderRadius: '8px' }}>
            🔒 This channel is read-only. Only administrators can send messages.
          </div>
        )}
      </div>

      {/* CREATE CHANNEL MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setShowCreateModal(false)}>
          <div className="glass-panel anim-pop" style={{
            maxWidth: '400px', width: '100%', background: '#fff',
            border: '3.5px solid #000', borderRadius: '16px', padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.4rem' }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>Create New Channel</strong>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 900 }}>✕</button>
            </div>
            <form onSubmit={handleCreateChannel} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>CHANNEL NAME</label>
                <input
                  type="text"
                  className="cyber-input"
                  placeholder="e.g. upsc-aspirants, mathematics-i"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="cyber-btn pink-fill"
                style={{ width: '100%', border: '2.5px solid #000', boxShadow: '3px 3px 0px #000', marginTop: '0.5rem' }}
              >
                CREATE CHANNEL
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
