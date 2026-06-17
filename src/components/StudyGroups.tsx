import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, push, onChildAdded, onChildChanged, onChildRemoved, set, update } from '../firebase';

interface GroupNote {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
}

interface GroupTask {
  id: string;
  title: string;
  status: 'Pending' | 'Completed';
}

interface GroupAnnouncement {
  id: string;
  text: string;
  timestamp: number;
}

interface GroupRoadmap {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
}

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: Record<string, boolean>; // userEmailSlug -> true
  messages?: Record<string, any>;
  notes?: Record<string, GroupNote>;
  tasks?: Record<string, GroupTask>;
  announcements?: Record<string, GroupAnnouncement>;
  roadmap?: Record<string, GroupRoadmap>;
}

interface StudyGroupsProps {
  userName: string;
  userEmail: string;
  onRewardXp: (amount: number, reason: string) => void;
  isGuest?: boolean;
}

export const StudyGroups: React.FC<StudyGroupsProps> = ({
  userName,
  userEmail,
  onRewardXp,
  isGuest
}) => {
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'chat' | 'notes' | 'tasks' | 'announcements' | 'roadmap' | 'members'>('chat');

  // Input states
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  // Note inputs
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);

  // Task inputs
  const [taskTitle, setTaskTitle] = useState('');

  // Announcement inputs
  const [announcementText, setAnnouncementText] = useState('');

  // Roadmap inputs
  const [roadmapTitle, setRoadmapTitle] = useState('');
  const [roadmapDate, setRoadmapDate] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const myEmailSlug = userEmail.replace(/\./g, '_');

  // Load groups list
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    const groupsRef = ref(db, 'community_groups');
    
    // Subscribe to group updates
    const onGpAdded = onChildAdded(groupsRef, (snap) => {
      const val = snap.val();
      if (val && val.metadata) {
        const gp: StudyGroup = {
          id: val.metadata.id,
          name: val.metadata.name,
          description: val.metadata.description || '',
          createdBy: val.metadata.createdBy || '',
          members: val.members || {},
          messages: val.messages || {},
          notes: val.notes || {},
          tasks: val.tasks || {},
          announcements: val.announcements || {},
          roadmap: val.roadmap || {}
        };
        setGroups(prev => {
          if (prev.some(g => g.id === gp.id)) return prev;
          return [...prev, gp];
        });
      }
    });

    const onGpChanged = onChildChanged(groupsRef, (snap) => {
      const val = snap.val();
      if (val && val.metadata) {
        const gp: StudyGroup = {
          id: val.metadata.id,
          name: val.metadata.name,
          description: val.metadata.description || '',
          createdBy: val.metadata.createdBy || '',
          members: val.members || {},
          messages: val.messages || {},
          notes: val.notes || {},
          tasks: val.tasks || {},
          announcements: val.announcements || {},
          roadmap: val.roadmap || {}
        };
        setGroups(prev => prev.map(g => g.id === gp.id ? gp : g));
      }
    });

    const onGpRemoved = onChildRemoved(groupsRef, (snap) => {
      const val = snap.val();
      const id = val?.metadata?.id || snap.key;
      if (id) {
        setGroups(prev => prev.filter(g => g.id !== id));
        setActiveGroupId(current => current === id ? null : current);
      }
    });

    return () => {
      onGpAdded();
      onGpChanged();
      onGpRemoved();
    };
  }, [isFirebaseConfigured]);

  // Auto-scroll chat inside group
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeGroupId, subTab, groups]);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const isMember = activeGroup ? !!activeGroup.members[myEmailSlug] : false;

  // Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot create study groups.");
      return;
    }
    if (!newGroupName.trim()) return;

    const groupId = `group_${Date.now()}`;
    const initialMessage = {
      id: `sys_create_${Date.now()}`,
      sender: 'System',
      senderEmail: 'system@roomie.io',
      text: `Study group "${newGroupName}" was formed by ${userName}.`,
      timestamp: Date.now()
    };

    const newGp = {
      metadata: {
        id: groupId,
        name: newGroupName,
        description: newGroupDesc,
        createdBy: userEmail
      },
      members: {
        [myEmailSlug]: true
      },
      messages: {
        join_msg: initialMessage
      }
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${groupId}`), newGp);
      onRewardXp(40, `Formed new study group: "${newGroupName}" (+40 Study Points)`);
    }

    setNewGroupName('');
    setNewGroupDesc('');
    setShowCreateModal(false);
    setActiveGroupId(groupId);
    setSubTab('chat');
  };

  // Toggle Join/Leave Group
  const handleToggleJoin = async (groupId: string) => {
    const gp = groups.find(g => g.id === groupId);
    if (!gp) return;
    const isCurrentlyMember = !!gp.members[myEmailSlug];

    const sysMsg = {
      id: `sys_join_${Date.now()}`,
      sender: 'System',
      senderEmail: 'system@roomie.io',
      text: `${userName} has ${isCurrentlyMember ? 'left' : 'joined'} the group.`,
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${groupId}/members/${myEmailSlug}`), isCurrentlyMember ? null : true);
      await push(ref(db, `community_groups/${groupId}/messages`), sysMsg);
    }
  };

  // Delete Group (Creator or Admin Only)
  const handleDeleteGroup = async (groupId: string) => {
    const gp = groups.find(g => g.id === groupId);
    if (!gp) return;

    if (gp.createdBy !== userEmail && !isGuest) {
      // unless admin
      alert("Only the group creator can delete this study group.");
      return;
    }

    if (!confirm(`Are you sure you want to dissolve the group "${gp.name}"?`)) return;

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${groupId}`), null);
      setActiveGroupId(null);
    }
  };

  // Group Messaging
  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeGroupId) return;

    const newMsg = {
      id: `msg_${Date.now()}`,
      sender: userName,
      senderEmail: userEmail,
      text: chatInput,
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await push(ref(db, `community_groups/${activeGroupId}/messages`), newMsg);
    }
    setChatInput('');
  };

  // Group Note Add
  const handleAddGroupNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim() || !activeGroupId) return;

    const noteId = `note_${Date.now()}`;
    const newNote: GroupNote = {
      id: noteId,
      title: noteTitle,
      content: noteContent,
      author: userName,
      date: new Date().toISOString().split('T')[0]
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${activeGroupId}/notes/${noteId}`), newNote);
      // system message
      const sysMsg = {
        id: `sys_note_${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@roomie.io',
        text: `${userName} published a group note: "${noteTitle}".`,
        timestamp: Date.now()
      };
      await push(ref(db, `community_groups/${activeGroupId}/messages`), sysMsg);
    }

    setNoteTitle('');
    setNoteContent('');
    setShowAddNote(false);
  };

  // Group Task Add
  const handleAddGroupTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !activeGroupId) return;

    const taskId = `task_${Date.now()}`;
    const newTask: GroupTask = {
      id: taskId,
      title: taskTitle,
      status: 'Pending'
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${activeGroupId}/tasks/${taskId}`), newTask);
    }
    setTaskTitle('');
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!activeGroupId) return;
    const nextStatus = currentStatus === 'Pending' ? 'Completed' : 'Pending';
    if (isFirebaseConfigured && db) {
      await update(ref(db, `community_groups/${activeGroupId}/tasks/${taskId}`), {
        status: nextStatus
      });
    }
  };

  // Group Announcement Add
  const handleAddGroupAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim() || !activeGroupId) return;

    const announceId = `announce_${Date.now()}`;
    const newAnn: GroupAnnouncement = {
      id: announceId,
      text: announcementText,
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${activeGroupId}/announcements/${announceId}`), newAnn);
    }
    setAnnouncementText('');
  };

  // Group Roadmap Milestones
  const handleAddRoadmapMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roadmapTitle.trim() || !activeGroupId) return;

    const mileId = `mile_${Date.now()}`;
    const newMilestone: GroupRoadmap = {
      id: mileId,
      title: roadmapTitle,
      targetDate: roadmapDate || 'No Date',
      completed: false
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${activeGroupId}/roadmap/${mileId}`), newMilestone);
    }
    setRoadmapTitle('');
    setRoadmapDate('');
  };

  const handleToggleRoadmapCompleted = async (mileId: string, currentVal: boolean) => {
    if (!activeGroupId) return;
    if (isFirebaseConfigured && db) {
      await update(ref(db, `community_groups/${activeGroupId}/roadmap/${mileId}`), {
        completed: !currentVal
      });
    }
  };

  // Parsing values safely
  const activeMessages = activeGroup?.messages ? Object.values(activeGroup.messages).sort((a,b) => a.timestamp - b.timestamp) : [];
  const activeNotes = activeGroup?.notes ? Object.values(activeGroup.notes) : [];
  const activeTasks = activeGroup?.tasks ? Object.values(activeGroup.tasks) : [];
  const activeAnnouncements = activeGroup?.announcements ? Object.values(activeGroup.announcements).sort((a,b) => b.timestamp - a.timestamp) : [];
  const activeRoadmaps = activeGroup?.roadmap ? Object.values(activeGroup.roadmap) : [];
  const activeMembersKeys = activeGroup?.members ? Object.keys(activeGroup.members) : [];

  return (
    <div className="notes-board-grid" style={{ paddingBottom: '2rem', height: 'calc(100vh - 180px)', minHeight: '500px' }}>
      
      {/* LEFT PANEL: Joined Groups & Directory */}
      <div className="glass-panel" style={{ background: '#fff', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900 }}>
            👥 STUDY GROUPS
          </h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="cyber-btn"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', minHeight: 'auto', background: 'var(--accent-gold)' }}
          >
            + NEW
          </button>
        </div>

        {/* Groups List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {groups.map(gp => {
            const isUserIn = !!gp.members[myEmailSlug];
            return (
              <div
                key={gp.id}
                style={{
                  border: '2px solid #000',
                  borderRadius: '12px',
                  padding: '0.6rem',
                  background: activeGroupId === gp.id ? 'var(--accent-purple)' : '#f8f9fa',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  cursor: 'pointer',
                  boxShadow: activeGroupId === gp.id ? '2px 2px 0px #000' : 'none',
                  transform: activeGroupId === gp.id ? 'translate(-1px, -1px)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => {
                  setActiveGroupId(gp.id);
                  setSubTab('chat');
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#000' }}>{gp.name}</strong>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleJoin(gp.id);
                    }}
                    className="cyber-btn"
                    style={{
                      padding: '0.15rem 0.4rem',
                      fontSize: '0.6rem',
                      minHeight: 'auto',
                      background: isUserIn ? 'var(--accent-pink)' : 'var(--accent-cyan)'
                    }}
                  >
                    {isUserIn ? 'LEAVE' : 'JOIN'}
                  </button>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{gp.description}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, alignSelf: 'flex-start', background: '#fff', border: '1px solid #000', padding: '1px 4px', borderRadius: '4px' }}>
                  👥 {Object.keys(gp.members).length} members
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL: Group Workspace */}
      <div className="glass-panel" style={{ background: '#fff', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        {!activeGroupId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>
            <span style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🧑‍💻</span>
            Select or create a study group to collaborate privately.
          </div>
        ) : !isMember ? (
          // USER IS NOT A MEMBER OF THE SELECTED GROUP
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem' }}>🔒</span>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 900 }}>
              Private Collaboration Workspace
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '320px', fontWeight: 700 }}>
              You must join the group &quot;{activeGroup?.name}&quot; to view its chats, tasks, roadmaps, and announcements.
            </p>
            <button
              onClick={() => handleToggleJoin(activeGroupId)}
              className="cyber-btn cyan-fill"
              style={{ padding: '0.6rem 1.5rem', border: '3px solid #000', boxShadow: '4px 4px 0px #000' }}
            >
              JOIN STUDY GROUP NOW
            </button>
          </div>
        ) : (
          // USER IS A MEMBER - RENDER WORKSPACE
          <>
            {/* Header / Subtab navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: '#000' }}>{activeGroup?.name}</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{activeGroup?.description}</span>
              </div>
              {(activeGroup?.createdBy === userEmail || isGuest) && (
                <button
                  onClick={() => handleDeleteGroup(activeGroupId)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-pink)', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}
                >
                  DISSOLVE GROUP
                </button>
              )}
            </div>

            {/* Sub-tabs list */}
            <div style={{ display: 'flex', borderBottom: '2px solid #000', paddingBottom: '2px', gap: '0.2rem', flexWrap: 'wrap' }}>
              {(['chat', 'notes', 'tasks', 'announcements', 'roadmap', 'members'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSubTab(tab)}
                  style={{
                    background: subTab === tab ? 'var(--accent-purple)' : 'none',
                    border: '2px solid transparent',
                    borderBottom: 'none',
                    borderRadius: '8px 8px 0 0',
                    color: '#000',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '0.4rem 0.8rem',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: subTab === tab ? '0 -2px 0px #000' : 'none'
                  }}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Sub-tab view container */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: '1rem', minHeight: 0 }}>
              
              {/* 1. GROUP CHAT */}
              {subTab === 'chat' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.4rem', background: '#fafafa', border: '2px solid #000', borderRadius: '10px' }}>
                    {activeMessages.map(msg => {
                      const isMe = msg.senderEmail === userEmail;
                      const isSystem = msg.sender === 'System';
                      if (isSystem) {
                        return (
                          <div key={msg.id} style={{ textAlign: 'center', margin: '0.2rem 0' }}>
                            <span style={{ fontSize: '0.65rem', background: '#eee', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #ccc', color: 'var(--text-muted)', fontWeight: 700 }}>
                              📢 {msg.text}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%', gap: '1px' }}>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                            {msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div style={{ background: isMe ? 'var(--accent-cyan)' : '#fff', border: '1.5px solid #000', padding: '0.5rem 0.75rem', borderRadius: '10px', boxShadow: '1.5px 1.5px 0px #000', fontSize: '0.8rem', fontWeight: 700 }}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={handleSendGroupMessage} style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      className="cyber-input"
                      placeholder="Type private message to group..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      required
                    />
                    <button type="submit" className="cyber-btn purple-fill" style={{ minHeight: '40px', padding: '0.4rem 1rem' }}>SEND</button>
                  </form>
                </div>
              )}

              {/* 2. GROUP NOTES */}
              {subTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 900 }}>Group Study Notes ({activeNotes.length})</h4>
                    <button
                      onClick={() => setShowAddNote(!showAddNote)}
                      className="cyber-btn"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', minHeight: 'auto', background: 'var(--accent-gold)' }}
                    >
                      {showAddNote ? 'CANCEL' : 'ADD NOTE'}
                    </button>
                  </div>

                  {showAddNote && (
                    <form onSubmit={handleAddGroupNote} style={{ border: '2px dashed #000', padding: '0.8rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.6rem', background: '#fffcf0' }}>
                      <input
                        type="text"
                        className="cyber-input"
                        placeholder="Note Title"
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        required
                      />
                      <textarea
                        className="cyber-input"
                        style={{ minHeight: '80px', resize: 'vertical' }}
                        placeholder="Note Content details..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        required
                      />
                      <button type="submit" className="cyber-btn pink-fill" style={{ alignSelf: 'flex-end', padding: '0.3rem 0.8rem', fontSize: '0.75rem', minHeight: 'auto' }}>SAVE TO GROUP</button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {activeNotes.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No notes shared in this group yet.</span>
                    ) : (
                      activeNotes.map(n => (
                        <div key={n.id} style={{ border: '2px solid #000', padding: '0.8rem', borderRadius: '12px', background: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '3px', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '0.85rem' }}>{n.title}</strong>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>By {n.author} • {n.date}</span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 3. GROUP TASKS */}
              {subTab === 'tasks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <form onSubmit={handleAddGroupTask} style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      className="cyber-input"
                      placeholder="Add shared group task (e.g. Finish PPT slides)"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      required
                    />
                    <button type="submit" className="cyber-btn cyan-fill" style={{ padding: '0.4rem 0.8rem', minHeight: '40px' }}>ADD</button>
                  </form>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeTasks.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No tasks assigned to this group yet.</span>
                    ) : (
                      activeTasks.map(t => (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between',
                            border: '1.5px solid #000', padding: '0.5rem 0.8rem', borderRadius: '10px',
                            background: t.status === 'Completed' ? '#dff0d8' : '#fff'
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', textDecoration: t.status === 'Completed' ? 'line-through' : 'none', fontWeight: 700 }}>
                            {t.title}
                          </span>
                          <button
                            onClick={() => handleToggleTaskStatus(t.id, t.status)}
                            className="cyber-btn"
                            style={{
                              padding: '0.15rem 0.4rem', fontSize: '0.65rem', minHeight: 'auto',
                              background: t.status === 'Completed' ? '#fff' : 'var(--accent-gold)'
                            }}
                          >
                            {t.status === 'Completed' ? 'UNDO' : 'DONE'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 4. GROUP ANNOUNCEMENTS */}
              {subTab === 'announcements' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <form onSubmit={handleAddGroupAnnouncement} style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      className="cyber-input"
                      placeholder="Post official notice/announcement to members"
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      required
                    />
                    <button type="submit" className="cyber-btn gold-fill" style={{ padding: '0.4rem 0.8rem', minHeight: '40px' }}>POST</button>
                  </form>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeAnnouncements.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No announcements posted.</span>
                    ) : (
                      activeAnnouncements.map(a => (
                        <div key={a.id} style={{ border: '2px solid #000', background: '#fcf8e3', padding: '0.6rem 0.8rem', borderRadius: '10px', textAlign: 'left' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--accent-pink)', fontWeight: 800, marginBottom: '2px' }}>
                            📢 ANNOUNCEMENT • {new Date(a.timestamp).toLocaleDateString()}
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#000' }}>{a.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 5. GROUP SHARED ROADMAP */}
              {subTab === 'roadmap' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <form onSubmit={handleAddRoadmapMilestone} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="cyber-input"
                      style={{ flex: 2, minWidth: '150px' }}
                      placeholder="Milestone goal (e.g. Finish Unit 1 syllabus)"
                      value={roadmapTitle}
                      onChange={(e) => setRoadmapTitle(e.target.value)}
                      required
                    />
                    <input
                      type="date"
                      className="cyber-input"
                      style={{ flex: 1, minWidth: '100px' }}
                      value={roadmapDate}
                      onChange={(e) => setRoadmapDate(e.target.value)}
                    />
                    <button type="submit" className="cyber-btn purple-fill" style={{ padding: '0.4rem 0.8rem', minHeight: '40px' }}>ADD GOAL</button>
                  </form>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeRoadmaps.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No roadmap goals registered yet.</span>
                    ) : (
                      activeRoadmaps.map(mile => (
                        <div
                          key={mile.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            border: '2px solid #000', padding: '0.6rem 0.8rem', borderRadius: '12px',
                            background: mile.completed ? '#dff0d8' : '#fff'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>{mile.completed ? '✅' : '📌'}</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ fontSize: '0.8rem', textDecoration: mile.completed ? 'line-through' : 'none' }}>{mile.title}</strong>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Target: {mile.targetDate}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleRoadmapCompleted(mile.id, mile.completed)}
                            className="cyber-btn"
                            style={{
                              padding: '0.15rem 0.4rem', fontSize: '0.65rem', minHeight: 'auto',
                              background: mile.completed ? '#fff' : 'var(--accent-cyan)'
                            }}
                          >
                            {mile.completed ? 'REOPEN' : 'COMPLETE'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 6. MEMBERS LIST */}
              {subTab === 'members' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 900, borderBottom: '1.5px solid #eee', paddingBottom: '4px', marginBottom: '4px' }}>
                    Group Members ({activeMembersKeys.length})
                  </h4>
                  {activeMembersKeys.map(memberSlug => (
                    <div key={memberSlug} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8f9fa', border: '1.5px solid #000', padding: '0.4rem 0.6rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '1rem' }}>👤</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{memberSlug.replace(/_/g, '.')}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </>
        )}
      </div>

      {/* CREATE GROUP MODAL */}
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
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>Form New Study Group</strong>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 900 }}>✕</button>
            </div>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>GROUP NAME</label>
                <input
                  type="text"
                  className="cyber-input"
                  placeholder="e.g. UPSC CSE Study Circle"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>DESCRIPTION / MOTTO</label>
                <input
                  type="text"
                  className="cyber-input"
                  placeholder="e.g. Preparing for mains together daily at 8PM"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="cyber-btn pink-fill"
                style={{ width: '100%', border: '2.5px solid #000', boxShadow: '3px 3px 0px #000', marginTop: '0.5rem' }}
              >
                CREATE GROUP
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
