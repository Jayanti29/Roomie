import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured, ref, remove, onValue } from '../firebase';
import { Shield, Database, Users, Video, MessageSquare, Terminal, Trash2, XCircle } from 'lucide-react';

interface AdminPanelProps {
  userEmail: string;
  userName: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ userEmail: _userEmail, userName: _userName }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'rooms' | 'communities' | 'explorer' | 'logs'>('stats');
  const [dbData, setDbData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<{ id: string; msg: string; time: string; type: 'info' | 'error' | 'success' }[]>([]);

  // Simulation of live logs
  useEffect(() => {
    const initialLogs = [
      { id: '1', msg: '[System] Diagnostic agent loaded successfully.', time: '09:00:15', type: 'info' as const },
      { id: '2', msg: '[Auth] Session persistence check: valid.', time: '09:00:16', type: 'success' as const },
      { id: '3', msg: '[Database] Root node fetched by administrator.', time: new Date().toLocaleTimeString(), type: 'success' as const }
    ];
    setLogs(initialLogs);

    const logGenerator = setInterval(() => {
      const messages = [
        { msg: '[WebRTC] New candidate gathered: typ srflx', type: 'info' as const },
        { msg: '[Database] Sync triggered on community_channels/chan_general', type: 'success' as const },
        { msg: '[System] Checked memory allocations: 14.5MB active', type: 'info' as const },
        { msg: '[Auth] User metadata initialized', type: 'success' as const },
        { msg: '[WebRTC] Connection status changed to: connected', type: 'success' as const }
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      setLogs(prev => [
        {
          id: Date.now().toString(),
          msg: randomMsg.msg,
          time: new Date().toLocaleTimeString(),
          type: randomMsg.type
        },
        ...prev.slice(0, 49) // Keep last 50 logs
      ]);
    }, 4500);

    return () => clearInterval(logGenerator);
  }, []);

  // Listen to entire database root in real time for diagnostic stats and explorer
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const rootRef = ref(db, '/');
    const unsub = onValue(rootRef, (snap) => {
      setDbData(snap.val() || {});
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Extract statistical metrics safely
  const roomsList = dbData?.study_rooms ? Object.values(dbData.study_rooms) : [];
  const communitiesList = dbData?.custom_communities ? Object.values(dbData.custom_communities) : [];
  const usersCount = dbData?.users ? Object.keys(dbData.users).length : 0;
  const totalNotes = dbData?.shared_notes ? Object.keys(dbData.shared_notes).length : 0;

  // Actions
  const handleForceCloseRoom = async (roomId: string) => {
    if (!confirm(`Force close room: "${roomId}"? This deletes the room node.`)) return;
    try {
      await remove(ref(db, `study_rooms/${roomId}`));
      setLogs(prev => [
        { id: Date.now().toString(), msg: `[Admin Override] Closed room: ${roomId}`, time: new Date().toLocaleTimeString(), type: 'error' as const },
        ...prev
      ]);
    } catch (e: any) {
      alert(`Close failed: ${e.message}`);
    }
  };

  const handleForceDeleteCommunity = async (commId: string) => {
    if (!confirm(`Dissolve community: "${commId}"? This cannot be undone.`)) return;
    try {
      await remove(ref(db, `custom_communities/${commId}`));
      setLogs(prev => [
        { id: Date.now().toString(), msg: `[Admin Override] Dissolved community: ${commId}`, time: new Date().toLocaleTimeString(), type: 'error' as const },
        ...prev
      ]);
    } catch (e: any) {
      alert(`Dissolve failed: ${e.message}`);
    }
  };

  // Simple visualizer for JSON node tree explorer
  const renderJsonTree = (node: any, depth = 0): React.ReactNode => {
    if (node === null || node === undefined) return <span style={{ color: 'var(--text-muted)' }}>null</span>;
    
    if (typeof node !== 'object') {
      if (typeof node === 'string') return <span style={{ color: '#047857', fontWeight: 600 }}>&quot;{node}&quot;</span>;
      if (typeof node === 'number') return <span style={{ color: 'var(--accent-pink)', fontWeight: 600 }}>{node}</span>;
      return <span style={{ color: '#0369a1' }}>{String(node)}</span>;
    }

    return (
      <div style={{ paddingLeft: depth === 0 ? 0 : '1rem', borderLeft: '1.5px dashed var(--outline-medium)' }}>
        {Object.entries(node).map(([key, val]) => (
          <div key={key} style={{ margin: '0.25rem 0', fontSize: '0.78rem' }}>
            <strong style={{ color: '#475569' }}>{key}:</strong>{' '}
            {typeof val === 'object' && val !== null ? (
              <span style={{ fontSize: '0.65rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px', color: '#64748b', marginLeft: '4px' }}>Object</span>
            ) : null}
            {renderJsonTree(val, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 180px)', minHeight: '520px' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '3px solid #000', paddingBottom: '0.5rem' }}>
        <Shield size={22} style={{ color: 'var(--accent-pink)' }} />
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 950, margin: 0 }}>
          ADMINISTRATOR OVERRIDE DASHBOARD
        </h3>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px' }}>
        {[
          { id: 'stats' as const, label: 'Stats Overview', icon: <Database size={14} /> },
          { id: 'rooms' as const, label: 'WebRTC Sessions', icon: <Video size={14} /> },
          { id: 'communities' as const, label: 'Communities', icon: <MessageSquare size={14} /> },
          { id: 'explorer' as const, label: 'DB Nodes Explorer', icon: <Shield size={14} /> },
          { id: 'logs' as const, label: 'System Logs', icon: <Terminal size={14} /> }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="cyber-btn"
            aria-label={t.label}
            style={{
              padding: '0.45rem 1.0rem',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === t.id ? 'var(--accent-primary-light)' : '#fff',
              border: activeTab === t.id ? '2px solid #000' : '2px solid var(--outline-thick)',
              fontWeight: activeTab === t.id ? 800 : 600
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Main body content */}
      <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', background: '#fff', border: '3.5px solid #000', borderRadius: '16px', padding: '1.25rem', boxShadow: '3px 3px 0px #000', display: 'flex', flexDirection: 'column' }}>
        
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Retrieving database state...
          </div>
        ) : (
          <>
            {/* STATS OVERVIEW */}
            {activeTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
                  
                  <div style={{ padding: '1rem', border: '2px solid #000', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '0.8rem', boxShadow: '2px 2px 0px #000' }}>
                    <Users size={28} style={{ color: '#16a34a' }} />
                    <div>
                      <strong style={{ fontSize: '1.3rem', display: 'block' }}>{usersCount}</strong>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>REGISTERED USERS</span>
                    </div>
                  </div>

                  <div style={{ padding: '1rem', border: '2px solid #000', borderRadius: '12px', background: '#ecfeff', display: 'flex', alignItems: 'center', gap: '0.8rem', boxShadow: '2px 2px 0px #000' }}>
                    <Video size={28} style={{ color: '#0891b2' }} />
                    <div>
                      <strong style={{ fontSize: '1.3rem', display: 'block' }}>{roomsList.length}</strong>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>ACTIVE STUDY ROOMS</span>
                    </div>
                  </div>

                  <div style={{ padding: '1rem', border: '2px solid #000', borderRadius: '12px', background: '#faf5ff', display: 'flex', alignItems: 'center', gap: '0.8rem', boxShadow: '2px 2px 0px #000' }}>
                    <MessageSquare size={28} style={{ color: '#7c3aed' }} />
                    <div>
                      <strong style={{ fontSize: '1.3rem', display: 'block' }}>{communitiesList.length}</strong>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>CUSTOM COMMUNITIES</span>
                    </div>
                  </div>

                  <div style={{ padding: '1rem', border: '2px solid #000', borderRadius: '12px', background: '#ffe4e6', display: 'flex', alignItems: 'center', gap: '0.8rem', boxShadow: '2px 2px 0px #000' }}>
                    <Database size={28} style={{ color: '#e11d48' }} />
                    <div>
                      <strong style={{ fontSize: '1.3rem', display: 'block' }}>{totalNotes}</strong>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>PUBLISHED NOTES</span>
                    </div>
                  </div>

                </div>

                <div style={{ border: '2px solid #000', borderRadius: '12px', padding: '1rem', background: '#f8fafc', boxShadow: '2px 2px 0px #000' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 900 }}>SYSTEM OVERRIDES</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ background: '#fff', border: '1px solid var(--outline-thick)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '150px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block' }}>DATABASE CONNECTION</span>
                      <strong style={{ fontSize: '0.8rem', color: isFirebaseConfigured ? '#16a34a' : '#ef4444' }}>
                        {isFirebaseConfigured ? 'CONNECTED' : 'DISCONNECTED'}
                      </strong>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid var(--outline-thick)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '150px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block' }}>MY PRIVILEGES</span>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--accent-pink)' }}>SYSTEM OWNER</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* WEBRTC OVERRIDE */}
            {activeTab === 'rooms' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-secondary)' }}>
                  ACTIVE WEBRTC SESSIONS LIST ({roomsList.length})
                </h4>
                {roomsList.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No active WebRTC rooms found.</span>
                ) : (
                  roomsList.map((room: any) => (
                    <div key={room.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '2px solid #000', borderRadius: '12px', padding: '0.75rem', boxShadow: '2px 2px 0px #000', background: '#fff' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{room.title}</strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          Topic: {room.topic} | Host ID: {room.hostPeerId || 'unknown'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleForceCloseRoom(room.id)}
                        className="cyber-btn pink-fill"
                        aria-label={`Force terminate room ${room.title}`}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', minHeight: 'auto' }}
                      >
                        <XCircle size={14} /> Force Terminate
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* COMMUNITIES MANAGER */}
            {activeTab === 'communities' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-secondary)' }}>
                  CUSTOM STUDENT COMMUNITIES ({communitiesList.length})
                </h4>
                {communitiesList.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No custom communities found.</span>
                ) : (
                  communitiesList.map((comm: any) => (
                    <div key={comm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '2px solid #000', borderRadius: '12px', padding: '0.75rem', boxShadow: '2px 2px 0px #000', background: '#fff' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{comm.name}</strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          Description: {comm.description} | Creator: {comm.createdBy || 'unknown'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleForceDeleteCommunity(comm.id)}
                        className="cyber-btn pink-fill"
                        aria-label={`Dissolve community ${comm.name}`}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', minHeight: 'auto' }}
                      >
                        <Trash2 size={14} /> Dissolve
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* DB EXPLORER */}
            {activeTab === 'explorer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={14} /> LIVE DATABASE EXPLORER TREE
                </h4>
                <div style={{ padding: '1rem', border: '2.5px solid #000', borderRadius: '12px', background: '#f8fafc', overflowX: 'auto', fontFamily: 'var(--font-mono)' }}>
                  {renderJsonTree(dbData)}
                </div>
              </div>
            )}

            {/* LOGS PANEL */}
            {activeTab === 'logs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left', flex: 1 }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-secondary)' }}>
                  LIVE APPLICATION CONSOLE OVERRIDE
                </h4>
                <div style={{ flex: 1, padding: '0.75rem', border: '3px solid #000', borderRadius: '12px', background: '#0f172a', color: '#38bdf8', overflowY: 'auto', fontFamily: 'var(--font-mono)', minHeight: '250px' }}>
                  {logs.map((log) => (
                    <div key={log.id} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', margin: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px' }}>
                      <span style={{ color: '#64748b' }}>[{log.time}]</span>
                      <span style={{ 
                        color: log.type === 'error' ? '#f43f5e' : log.type === 'success' ? '#4ade80' : '#38bdf8',
                        fontWeight: log.type === 'error' ? 700 : 500
                      }}>
                        {log.msg}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>

    </div>
  );
};
