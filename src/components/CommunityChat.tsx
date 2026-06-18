import React, { useState, useRef, useEffect } from 'react';
import { db, isFirebaseConfigured, ref, push, onChildAdded, get, set, onValue } from '../firebase';

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
  isGuest?: boolean;
}

export const CommunityChat: React.FC<CommunityChatProps> = ({
  userName,
  userEmail,
  isAdmin,
  isGuest
}) => {
  const [communities, setCommunities] = useState<{ id: string; name: string; description: string; createdBy?: string; moderators?: string[] }[]>([
    { id: 'global', name: '🌍 Global Roomie', description: 'The main Roomie student forum.' }
  ]);
  const [activeCommunityId, setActiveCommunityId] = useState('global');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState('chan_general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateCommunityModal, setShowCreateCommunityModal] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDesc, setNewCommunityDesc] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  const defaultChannels = [
    { id: 'chan_general', name: 'general' },
    { id: 'chan_announcements', name: 'announcements' },
    { id: 'chan_help', name: 'help-me' },
    { id: 'chan_college', name: 'college-life' },
    { id: 'chan_placement', name: 'placement-prep' },
    { id: 'chan_doubts', name: 'academic-doubts' },
    { id: 'chan_career', name: 'career-guidance' },
    { id: 'chan_engineering', name: 'engineering-btech' },
    { id: 'chan_bca_mca', name: 'bca-mca-it' },
    { id: 'chan_medical', name: 'medical-mbbs' },
    { id: 'chan_commerce', name: 'commerce-bcom-ca' },
    { id: 'chan_law', name: 'law-llb' },
    { id: 'chan_arts', name: 'arts-humanities' },
    { id: 'chan_design', name: 'design-nift-nid' },
    { id: 'chan_upsc', name: 'upsc-govt-exams' },
    { id: 'chan_coding', name: 'coding-dsa-projects' },
    { id: 'chan_offtopic', name: 'off-topic' }
  ];

  // Subscribe to Communities List
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const commsRef = ref(db, 'custom_communities');
    const unsub = onValue(commsRef, (snap) => {
      const val = snap.val() || {};
      const list = Object.values(val).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        createdBy: c.createdBy,
        moderators: c.moderators || []
      }));
      setCommunities([
        { id: 'global', name: '🌍 Global Roomie', description: 'The main Roomie student forum.' },
        ...list
      ]);
    });
    return () => unsub();
  }, [isFirebaseConfigured]);

  // Subscribe to Channels List based on active community
  useEffect(() => {
    setChannels([]);
    if (!isFirebaseConfigured || !db) return;

    if (activeCommunityId === 'global') {
      const channelsRef = ref(db, 'community_channels');
      
      // Ensure default channels exist
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
          setChannels((prev: Channel[]) => {
            if (prev.some((c: Channel) => c.id === val.id)) return prev;
            return [...prev, val];
          });
        }
      });
      return () => unsub();
    } else {
      const channelsRef = ref(db, `custom_communities/${activeCommunityId}/channels`);
      const unsub = onValue(channelsRef, (snap) => {
        const val = snap.val() || {};
        const list = Object.values(val).map((c: any) => ({
          id: c.id,
          name: c.name
        }));
        setChannels(list);
        if (list.length > 0) {
          setActiveChannelId(list[0].id);
        }
      });
      return () => unsub();
    }
  }, [activeCommunityId, isFirebaseConfigured]);

  // Subscribe to messages in the active channel
  useEffect(() => {
    setMessages([]); // Clear old messages
    if (!isFirebaseConfigured || !db || !activeChannelId) return;

    const msgsRef = activeCommunityId === 'global'
      ? ref(db, `community_channels/${activeChannelId}/messages`)
      : ref(db, `custom_communities/${activeCommunityId}/channels/${activeChannelId}/messages`);
    
    const unsub = onChildAdded(msgsRef, (snap) => {
      const val = snap.val();
      if (val) {
        setMessages((prev: ChatMessage[]) => {
          if (prev.some((m: ChatMessage) => m.id === val.id)) return prev;
          return [...prev, val];
        });
      }
    });

    return () => {
      unsub();
    };
  }, [activeCommunityId, activeChannelId]);

  // Auto Scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Announcements restriction: Only admin can post in announcements
    if (activeCommunityId === 'global' && activeChannelId === 'chan_announcements' && !isAdmin) {
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
      const msgsPath = activeCommunityId === 'global'
        ? `community_channels/${activeChannelId}/messages`
        : `custom_communities/${activeCommunityId}/channels/${activeChannelId}/messages`;
      await push(ref(db, msgsPath), newMsg);
    }

    setInputText('');
  };

  // Create Channel
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const activeComm = communities.find((c: any) => c.id === activeCommunityId);
    const isMod = activeCommunityId === 'global' ? isAdmin : (activeComm?.createdBy === userEmail || activeComm?.moderators?.includes(userEmail));
    if (!isMod) {
      alert("Only community moderators can create channels.");
      return;
    }

    const channelSlug = newChannelName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const newId = `chan_${Date.now()}`;
    const newChan = {
      id: newId,
      name: channelSlug
    };

    if (isFirebaseConfigured && db) {
      if (activeCommunityId === 'global') {
        await set(ref(db, 'community_channels/' + newId), newChan);
        const sysMsg = {
          id: `sys_${Date.now()}`,
          sender: 'System',
          senderEmail: 'system@roomie.io',
          text: `Channel #${channelSlug} was created.`,
          timestamp: Date.now()
        };
        await push(ref(db, `community_channels/${newId}/messages`), sysMsg);
      } else {
        await set(ref(db, `custom_communities/${activeCommunityId}/channels/${newId}`), newChan);
        const sysMsg = {
          id: `sys_${Date.now()}`,
          sender: 'System',
          senderEmail: 'system@roomie.io',
          text: `Channel #${channelSlug} was created.`,
          timestamp: Date.now()
        };
        await push(ref(db, `custom_communities/${activeCommunityId}/channels/${newId}/messages`), sysMsg);
      }
    }

    setNewChannelName('');
    setShowCreateModal(false);
    setActiveChannelId(newId);
  };

  // Create Custom Community Space
  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot create community spaces.");
      return;
    }
    if (!newCommunityName.trim()) return;

    const commId = `community_${Date.now()}`;
    const myEmailSlug = userEmail.replace(/\./g, '_');

    const newComm = {
      id: commId,
      name: newCommunityName,
      description: newCommunityDesc,
      createdBy: userEmail,
      moderators: [userEmail],
      members: {
        [myEmailSlug]: true
      },
      channels: {
        chan_general: { id: 'chan_general', name: 'general' },
        chan_help: { id: 'chan_help', name: 'help-me' }
      }
    };

    if (isFirebaseConfigured && db) {
      try {
        await set(ref(db, `custom_communities/${commId}`), newComm);
        const sysMsg = {
          id: `sys_${Date.now()}`,
          sender: 'System',
          senderEmail: 'system@roomie.io',
          text: `Community Space "${newCommunityName}" was formed. Welcome!`,
          timestamp: Date.now()
        };
        await push(ref(db, `custom_communities/${commId}/channels/chan_general/messages`), sysMsg);
      } catch (err) {
        console.error('Error creating custom community:', err);
      }
    }

    setNewCommunityName('');
    setNewCommunityDesc('');
    setShowCreateCommunityModal(false);
    setActiveCommunityId(commId);
  };

  const currentChannel = channels.find((c: Channel) => c.id === activeChannelId);

  return (
    <div className="notes-board-grid" style={{ paddingBottom: '2rem', height: 'calc(100vh - 180px)', minHeight: '500px' }}>
      
      {/* SIDEBAR: Channels Directory */}
      <div className="glass-panel" style={{ background: '#fff', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        
        {/* Community Space Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '2.5px solid #000', paddingBottom: '0.8rem' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 800 }}>COMMUNITY SPACE</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <select
              className="cyber-input"
              style={{ flex: 1, appearance: 'auto', cursor: 'pointer', padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
              value={activeCommunityId}
              onChange={(e) => {
                setActiveCommunityId(e.target.value);
                if (e.target.value === 'global') {
                  setActiveChannelId('chan_general');
                }
              }}
            >
              {communities.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateCommunityModal(true)}
              className="cyber-btn"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', minHeight: 'auto', background: 'var(--accent-cyan)' }}
              title="Create Community"
            >
              + SPACE
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900 }}>
            💬 CHAT CHANNELS
          </h3>
          {(activeCommunityId === 'global' ? isAdmin : (communities.find((c: any) => c.id === activeCommunityId)?.createdBy === userEmail || communities.find((c: any) => c.id === activeCommunityId)?.moderators?.includes(userEmail))) && (
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
          {channels.map((chan: Channel) => (
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
            messages.map((msg: ChatMessage) => {
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
      {/* CREATE COMMUNITY MODAL */}
      {showCreateCommunityModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setShowCreateCommunityModal(false)}>
          <div className="glass-panel anim-pop" style={{
            maxWidth: '400px', width: '100%', background: '#fff',
            border: '3.5px solid #000', borderRadius: '16px', padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.4rem' }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>Create New Community Space</strong>
              <button onClick={() => setShowCreateCommunityModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 900 }}>✕</button>
            </div>
            <form onSubmit={handleCreateCommunity} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>COMMUNITY SPACE NAME</label>
                <input
                  type="text"
                  className="cyber-input"
                  placeholder="e.g. Java Developers, BCA Students"
                  value={newCommunityName}
                  onChange={(e) => setNewCommunityName(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>DESCRIPTION</label>
                <input
                  type="text"
                  className="cyber-input"
                  placeholder="e.g. A space for learning Java and DSA together"
                  value={newCommunityDesc}
                  onChange={(e) => setNewCommunityDesc(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="cyber-btn cyan-fill"
                style={{ width: '100%', border: '2.5px solid #000', boxShadow: '3px 3px 0px #000', marginTop: '0.5rem' }}
              >
                CREATE SPACE
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
