import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, push, onChildAdded, onChildChanged, onChildRemoved, set, update, onValue, uploadFile, get } from '../firebase';

interface GroupNote {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  pdfAttachment?: {
    name: string;
    size: string;
    url: string;
  };
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
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [noteUploadError, setNoteUploadError] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const noteFileInputRef = useRef<HTMLInputElement>(null);

  // Group Chat File Attachment State
  const [chatAttachedFile, setChatAttachedFile] = useState<File | null>(null);
  const [chatUploadError, setChatUploadError] = useState('');
  const [chatUploading, setChatUploading] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Preview / Download Modal State
  const [previewAttachment, setPreviewAttachment] = useState<{ name: string; url: string; size?: string } | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  // Task inputs
  const [taskTitle, setTaskTitle] = useState('');

  // Announcement inputs
  const [announcementText, setAnnouncementText] = useState('');

  // Roadmap inputs
  const [roadmapTitle, setRoadmapTitle] = useState('');
  const [roadmapDate, setRoadmapDate] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const myEmailSlug = userEmail.replace(/\./g, '_');

  // Load groups list (metadata & members only)
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
          messages: {},
          notes: {},
          tasks: {},
          announcements: {},
          roadmap: {}
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
        setGroups(prev => prev.map(g => g.id === val.metadata.id ? {
          ...g,
          name: val.metadata.name,
          description: val.metadata.description || '',
          createdBy: val.metadata.createdBy || '',
          members: val.members || {}
        } : g));
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

  // Load active group details
  useEffect(() => {
    if (!activeGroupId || !isFirebaseConfigured || !db) return;

    const unsubs: (() => void)[] = [];

    // Listen to messages
    const msgsRef = ref(db, `community_groups/${activeGroupId}/messages`);
    unsubs.push(onValue(msgsRef, (snap: any) => {
      const val = snap.val() || {};
      setGroups(prev => prev.map(g => g.id === activeGroupId ? {
        ...g,
        messages: val
      } : g));
    }));

    // Listen to notes
    const notesRef = ref(db, `community_groups/${activeGroupId}/notes`);
    unsubs.push(onValue(notesRef, (snap: any) => {
      const val = snap.val() || {};
      setGroups(prev => prev.map(g => g.id === activeGroupId ? {
        ...g,
        notes: val
      } : g));
    }));

    // Listen to tasks
    const tasksRef = ref(db, `community_groups/${activeGroupId}/tasks`);
    unsubs.push(onValue(tasksRef, (snap: any) => {
      const val = snap.val() || {};
      setGroups(prev => prev.map(g => g.id === activeGroupId ? {
        ...g,
        tasks: val
      } : g));
    }));

    // Listen to announcements
    const annsRef = ref(db, `community_groups/${activeGroupId}/announcements`);
    unsubs.push(onValue(annsRef, (snap: any) => {
      const val = snap.val() || {};
      setGroups(prev => prev.map(g => g.id === activeGroupId ? {
        ...g,
        announcements: val
      } : g));
    }));

    // Listen to roadmap
    const roadmapRef = ref(db, `community_groups/${activeGroupId}/roadmap`);
    unsubs.push(onValue(roadmapRef, (snap: any) => {
      const val = snap.val() || {};
      setGroups(prev => prev.map(g => g.id === activeGroupId ? {
        ...g,
        roadmap: val
      } : g));
    }));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [activeGroupId, isFirebaseConfigured]);

  // Load preview data URL for mock file storage
  useEffect(() => {
    if (previewAttachment) {
      const url = previewAttachment.url;
      if (url.startsWith('mock-file-url:')) {
        const mockId = url.split(':')[1];
        if (isFirebaseConfigured && db) {
          get(ref(db, 'pdf_contents/' + mockId)).then(snap => {
            if (snap.exists()) {
              setPreviewDataUrl(snap.val());
            }
          });
        }
      } else {
        setPreviewDataUrl(url);
      }
    } else {
      setPreviewDataUrl(null);
    }
  }, [previewAttachment]);

  // Auto-scroll chat inside group
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeGroupId, subTab, groups]);

  const isImageFile = (name: string) => {
    const ext = name.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');
  };

  const isPdfFile = (name: string) => {
    return name.toLowerCase().endsWith('.pdf');
  };

  // Secure file download
  const handleDownloadFile = async (attachment: { name: string; url: string }) => {
    if (!attachment || !attachment.url) return;
    const url = attachment.url;
    const fileName = attachment.name;

    if (url.startsWith('mock-file-url:')) {
      const mockId = url.split(':')[1];
      if (isFirebaseConfigured && db) {
        try {
          const snap = await get(ref(db, 'pdf_contents/' + mockId));
          if (snap.exists()) {
            const dataUrl = snap.val();
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = fileName;
            link.click();
          } else {
            alert("File content not found in mock database.");
          }
        } catch (e) {
          console.error("Error downloading mock file:", e);
        }
      }
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

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
      alert("Only the group creator can delete this study group.");
      return;
    }

    if (!confirm(`Are you sure you want to dissolve the group "${gp.name}"?`)) return;

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${groupId}`), null);
      setActiveGroupId(null);
    }
  };

  // Chat File Selection Handler
  const handleChatFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setChatUploadError('');
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      setChatUploadError('File exceeds 100MB limit.');
      setChatAttachedFile(null);
      return;
    }

    setChatAttachedFile(file);
  };

  // Group Messaging
  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && !chatAttachedFile || !activeGroupId) return;

    setChatUploading(true);
    let attachmentObj = undefined;

    if (chatAttachedFile) {
      try {
        const url = await uploadFile(chatAttachedFile, chatAttachedFile.name, userEmail);
        attachmentObj = {
          name: chatAttachedFile.name,
          size: chatAttachedFile.size > 1024 * 1024 
            ? (chatAttachedFile.size / (1024 * 1024)).toFixed(1) + ' MB' 
            : (chatAttachedFile.size / 1024).toFixed(1) + ' KB',
          url
        };
      } catch (err) {
        console.error('Group chat file upload failed:', err);
        setChatUploadError('Upload failed.');
        setChatUploading(false);
        return;
      }
    }

    const newMsg = {
      id: `msg_${Date.now()}`,
      sender: userName,
      senderEmail: userEmail,
      text: chatInput,
      timestamp: Date.now(),
      attachment: attachmentObj
    };

    if (isFirebaseConfigured && db) {
      await push(ref(db, `community_groups/${activeGroupId}/messages`), newMsg);
    }

    setChatInput('');
    setChatAttachedFile(null);
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';
    setChatUploading(false);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Voice Recording for Group Chat
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm' };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());

        try {
          setChatUploading(true);
          const fileId = `voice_${Date.now()}.webm`;
          const url = await uploadFile(audioBlob, fileId, userEmail);
          const voiceAttachment = {
            name: 'Voice Note',
            size: `${(audioBlob.size / 1024).toFixed(1)} KB`,
            url,
            isVoice: true
          };

          const newMsg = {
            id: `msg_${Date.now()}`,
            sender: userName,
            senderEmail: userEmail,
            text: 'Sent a voice note',
            timestamp: Date.now(),
            attachment: voiceAttachment
          };

          if (isFirebaseConfigured && db) {
            await push(ref(db, `community_groups/${activeGroupId}/messages`), newMsg);
          }
        } catch (err) {
          console.error('Failed to upload group voice note:', err);
          alert('Failed to send voice note.');
        } finally {
          setChatUploading(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Group microphone access denied:', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Group Note Attachment Handling
  const handleNoteFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setNoteUploadError('');
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      setNoteUploadError('File exceeds 100MB limit.');
      setNoteFile(null);
      return;
    }
    setNoteFile(file);
  };

  // Group Note Add
  const handleAddGroupNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim() || !activeGroupId) return;

    setNoteSubmitting(true);
    let attachmentObj = undefined;

    if (noteFile) {
      try {
        const url = await uploadFile(noteFile, noteFile.name, userEmail);
        attachmentObj = {
          name: noteFile.name,
          size: noteFile.size > 1024 * 1024 
            ? (noteFile.size / (1024 * 1024)).toFixed(1) + ' MB' 
            : (noteFile.size / 1024).toFixed(1) + ' KB',
          url
        };
      } catch (err) {
        console.error('Note attachment upload failed:', err);
        setNoteUploadError('Attachment failed to upload.');
        setNoteSubmitting(false);
        return;
      }
    }

    const noteId = `note_${Date.now()}`;
    const newNote: GroupNote = {
      id: noteId,
      title: noteTitle,
      content: noteContent,
      author: userName,
      date: new Date().toISOString().split('T')[0],
      pdfAttachment: attachmentObj
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${activeGroupId}/notes/${noteId}`), newNote);
      
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
    setNoteFile(null);
    if (noteFileInputRef.current) noteFileInputRef.current.value = '';
    setShowAddNote(false);
    setNoteSubmitting(false);
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
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const isMember = activeGroup ? !!activeGroup.members[myEmailSlug] : false;
  const activeMessages = activeGroup?.messages ? Object.values(activeGroup.messages).sort((a,b) => a.timestamp - b.timestamp) : [];
  const activeNotes = activeGroup?.notes ? Object.values(activeGroup.notes) : [];
  const activeTasks = activeGroup?.tasks ? Object.values(activeGroup.tasks) : [];
  const activeAnnouncements = activeGroup?.announcements ? Object.values(activeGroup.announcements).sort((a,b) => b.timestamp - a.timestamp) : [];
  const activeRoadmaps = activeGroup?.roadmap ? Object.values(activeGroup.roadmap) : [];
  const activeMembersKeys = activeGroup?.members ? Object.keys(activeGroup.members) : [];

  return (
    <div className="notes-board-grid" style={{ paddingBottom: '2rem', height: 'calc(100vh - 180px)', minHeight: '500px' }}>
      
      {/* LEFT PANEL: Joined Groups & Directory */}
      <div className="glass-panel" style={{ background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto', border: '1px solid var(--outline-thick)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Study Groups
          </h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="cyber-btn gold-fill"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', minHeight: 'auto' }}
          >
            + New
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
                  border: activeGroupId === gp.id ? '1px solid var(--accent-purple)' : '1px solid var(--outline-thick)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '0.75rem',
                  background: activeGroupId === gp.id ? 'var(--accent-primary-light)' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  cursor: 'pointer',
                  boxShadow: activeGroupId === gp.id ? 'var(--shadow-flat-sm)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => {
                  setActiveGroupId(gp.id);
                  setSubTab('chat');
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{gp.name}</strong>
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
                      background: isUserIn ? 'var(--accent-pink)' : 'var(--accent-cyan)',
                      color: '#fff',
                      border: 'none'
                    }}
                  >
                    {isUserIn ? 'Leave' : 'Join'}
                  </button>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{gp.description}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, alignSelf: 'flex-start', background: '#f1f5f9', border: '1px solid var(--outline-medium)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {Object.keys(gp.members).length} members
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL: Group Workspace */}
      <div className="glass-panel" style={{ background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', border: '1px solid var(--outline-thick)' }}>
        {!activeGroupId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>
            Select or create a study group to collaborate privately.
          </div>
        ) : !isMember ? (
          // USER IS NOT A MEMBER OF THE SELECTED GROUP
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Private Collaboration Workspace
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '320px' }}>
              You must join the group &quot;{activeGroup?.name}&quot; to view its chats, tasks, roadmaps, and announcements.
            </p>
            <button
              onClick={() => handleToggleJoin(activeGroupId)}
              className="cyber-btn cyan-fill"
              style={{ padding: '0.6rem 1.5rem' }}
            >
              Join Study Group Now
            </button>
          </div>
        ) : (
          // USER IS A MEMBER - RENDER WORKSPACE
          <>
            {/* Header / Subtab navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{activeGroup?.name}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{activeGroup?.description}</span>
              </div>
              {(activeGroup?.createdBy === userEmail || isGuest) && (
                <button
                  onClick={() => handleDeleteGroup(activeGroupId)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-pink)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Dissolve Group
                </button>
              )}
            </div>

            {/* Sub-tabs list */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '1px', gap: '0.2rem', flexWrap: 'wrap' }}>
              {(['chat', 'notes', 'tasks', 'announcements', 'roadmap', 'members'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSubTab(tab)}
                  style={{
                    background: subTab === tab ? 'var(--accent-purple)' : 'none',
                    border: 'none',
                    borderRadius: 'var(--border-radius-sm)',
                    color: subTab === tab ? '#ffffff' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.4rem 0.8rem',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.15s ease'
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
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.8rem' }}>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.8rem', background: '#f8fafc', border: '1px solid var(--outline-medium)', borderRadius: 'var(--border-radius-md)' }}>
                    {activeMessages.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        No messages in group yet. Start collaborating!
                      </div>
                    ) : (
                      activeMessages.map(msg => {
                        const isMe = msg.senderEmail === userEmail;
                        const isSystem = msg.sender === 'System';
                        if (isSystem) {
                          return (
                            <div key={msg.id} style={{ textAlign: 'center', margin: '0.2rem 0' }}>
                              <span style={{ fontSize: '0.65rem', background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--outline-medium)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                System: {msg.text}
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%', gap: '1px' }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                              {msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div style={{ 
                              background: isMe ? 'var(--accent-primary)' : '#fff', 
                              color: isMe ? '#fff' : 'var(--text-primary)',
                              border: isMe ? 'none' : '1px solid var(--outline-thick)', 
                              padding: '0.5rem 0.75rem', 
                              borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', 
                              boxShadow: 'var(--shadow-flat-sm)', 
                              fontSize: '0.8rem', 
                              fontWeight: 500,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem'
                            }}>
                              {msg.text && <div>{msg.text}</div>}
                              
                              {/* Message Attachment Rendering */}
                              {msg.attachment && (
                                <div 
                                  onClick={() => !msg.attachment.isVoice && setPreviewAttachment(msg.attachment)}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.5rem', 
                                    border: isMe ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--outline-thick)', 
                                    background: isMe ? 'rgba(255,255,255,0.1)' : '#f8fafc', 
                                    padding: '0.35rem 0.5rem', 
                                    borderRadius: '6px', 
                                    cursor: 'pointer',
                                    marginTop: '0.2rem'
                                  }}
                                >
                                  {msg.attachment.isVoice ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                                      <span style={{ fontSize: '0.8rem' }}>🎙️</span>
                                      <audio src={msg.attachment.url} controls style={{ height: '32px', width: '180px' }} />
                                    </div>
                                  ) : (
                                    <>
                                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isMe ? '#fff' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {msg.attachment.name}
                                      </span>
                                      <span style={{ fontSize: '0.65rem', color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                                        ({msg.attachment.size})
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Group Chat Input controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {chatAttachedFile && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--accent-primary-light)', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--outline-thick)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Attachment: {chatAttachedFile.name} ({(chatAttachedFile.size / 1024).toFixed(1)} KB)
                        </span>
                        <button 
                          onClick={() => { setChatAttachedFile(null); if (chatFileInputRef.current) chatFileInputRef.current.value = ''; }}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {chatUploadError && <span style={{ fontSize: '0.7rem', color: 'var(--accent-pink)', fontWeight: 600 }}>{chatUploadError}</span>}

                    <form onSubmit={handleSendGroupMessage} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      
                      {/* Chat attachment trigger */}
                      <button
                        type="button"
                        onClick={() => chatFileInputRef.current?.click()}
                        className="cyber-btn"
                        style={{ padding: '0.5rem', minHeight: '38px', minWidth: '38px', borderRadius: 'var(--border-radius-sm)', background: '#f1f5f9' }}
                        title="Attach file to chat"
                        disabled={isRecording || chatUploading}
                      >
                        📎
                      </button>
                      <input
                        type="file"
                        ref={chatFileInputRef}
                        style={{ display: 'none' }}
                        accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                        onChange={handleChatFileSelection}
                      />

                      {/* Group voice recording */}
                      {!isRecording ? (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="cyber-btn"
                          style={{ padding: '0.5rem', minHeight: '38px', minWidth: '38px', borderRadius: 'var(--border-radius-sm)', background: '#ffe4e6', color: 'var(--accent-pink)', border: '1px solid #fecdd3' }}
                          title="Record Group Voice Note"
                          disabled={chatUploading}
                        >
                          🎙️
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', background: '#ffe4e6', border: '1px solid #fecdd3', borderRadius: 'var(--border-radius-sm)', padding: '0.2rem 0.5rem', height: '38px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-pink)', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-pink)', minWidth: '35px' }}>{formatDuration(recordingDuration)}</span>
                          <button type="button" onClick={stopRecording} style={{ background: 'var(--accent-green)', color: '#fff', border: 'none', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 700 }}>Send</button>
                          <button type="button" onClick={cancelRecording} style={{ background: 'var(--accent-pink)', color: '#fff', border: 'none', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                        </div>
                      )}

                      {!isRecording && (
                        <>
                          <input
                            type="text"
                            className="cyber-input"
                            style={{ flex: 1, minHeight: '38px' }}
                            placeholder="Type private message to group..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            disabled={chatUploading}
                          />
                          <button type="submit" disabled={chatUploading} className="cyber-btn purple-fill" style={{ minHeight: '38px', padding: '0.4rem 1rem' }}>
                            {chatUploading ? 'Sending...' : 'Send'}
                          </button>
                        </>
                      )}
                    </form>
                  </div>
                </div>
              )}

              {/* 2. GROUP NOTES */}
              {subTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>Group Study Notes ({activeNotes.length})</h4>
                    <button
                      onClick={() => setShowAddNote(!showAddNote)}
                      className="cyber-btn"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', minHeight: 'auto', background: 'var(--accent-gold)', color: '#fff', border: 'none' }}
                    >
                      {showAddNote ? 'Cancel' : 'Add Note'}
                    </button>
                  </div>

                  {showAddNote && (
                    <form onSubmit={handleAddGroupNote} style={{ border: '1px dashed var(--outline-thick)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.6rem', background: '#f8fafc' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Note Title</label>
                        <input
                          type="text"
                          className="cyber-input"
                          placeholder="Note Title"
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          required
                          disabled={noteSubmitting}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Content details</label>
                        <textarea
                          className="cyber-input"
                          style={{ minHeight: '80px', resize: 'vertical' }}
                          placeholder="Note Content details..."
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          required
                          disabled={noteSubmitting}
                        />
                      </div>

                      {/* File attachment inside Group Notes */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Attach Resource (PDF/Images up to 100MB)</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => noteFileInputRef.current?.click()}
                            className="cyber-btn"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', minHeight: '34px', background: '#e2e8f0' }}
                            disabled={noteSubmitting}
                          >
                            Select File
                          </button>
                          <input
                            type="file"
                            ref={noteFileInputRef}
                            style={{ display: 'none' }}
                            accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                            onChange={handleNoteFileSelection}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {noteFile ? noteFile.name : 'No file chosen'}
                          </span>
                        </div>
                        {noteUploadError && <span style={{ fontSize: '0.7rem', color: 'var(--accent-pink)', fontWeight: 600 }}>{noteUploadError}</span>}
                      </div>

                      <button 
                        type="submit" 
                        disabled={noteSubmitting}
                        className="cyber-btn pink-fill" 
                        style={{ alignSelf: 'flex-end', marginTop: '0.5rem' }}
                      >
                        {noteSubmitting ? 'Uploading & Saving...' : 'Save to Group'}
                      </button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {activeNotes.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No notes shared in this group yet.</span>
                    ) : (
                      activeNotes.map(n => (
                        <div key={n.id} style={{ border: '1px solid var(--outline-thick)', padding: '1rem', borderRadius: '12px', background: '#fff', boxShadow: 'var(--shadow-flat-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{n.title}</strong>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>By {n.author} • {n.date}</span>
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{n.content}</p>
                          
                          {/* Inline note attachment trigger */}
                          {n.pdfAttachment && (
                            <div 
                              onClick={() => n.pdfAttachment && setPreviewAttachment(n.pdfAttachment)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--outline-thick)', background: '#f8fafc', padding: '0.35rem 0.5rem', borderRadius: '6px', width: 'fit-content', cursor: 'pointer', marginTop: '0.5rem' }}
                            >
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{n.pdfAttachment.name}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({n.pdfAttachment.size})</span>
                            </div>
                          )}
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
                    <button type="submit" className="cyber-btn cyan-fill" style={{ padding: '0.4rem 0.8rem', minHeight: '40px' }}>Add</button>
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
                            border: '1px solid var(--outline-thick)', padding: '0.5rem 0.8rem', borderRadius: '10px',
                            background: t.status === 'Completed' ? 'var(--accent-primary-light)' : '#fff',
                            boxShadow: 'var(--shadow-flat-sm)'
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', textDecoration: t.status === 'Completed' ? 'line-through' : 'none', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {t.title}
                          </span>
                          <button
                            onClick={() => handleToggleTaskStatus(t.id, t.status)}
                            className="cyber-btn"
                            style={{
                              padding: '0.15rem 0.4rem', fontSize: '0.65rem', minHeight: 'auto',
                              background: t.status === 'Completed' ? '#fff' : 'var(--accent-gold)',
                              color: t.status === 'Completed' ? 'var(--text-primary)' : '#fff',
                              border: t.status === 'Completed' ? '1px solid var(--outline-thick)' : 'none'
                            }}
                          >
                            {t.status === 'Completed' ? 'Undo' : 'Done'}
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
                    <button type="submit" className="cyber-btn gold-fill" style={{ padding: '0.4rem 0.8rem', minHeight: '40px' }}>Post</button>
                  </form>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeAnnouncements.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No announcements posted.</span>
                    ) : (
                      activeAnnouncements.map(a => (
                        <div key={a.id} style={{ border: '1px solid #fcd34d', background: '#fffbeb', padding: '0.75rem 1rem', borderRadius: '10px', textAlign: 'left' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.05em' }}>
                            ANNOUNCEMENT • {new Date(a.timestamp).toLocaleDateString()}
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.text}</span>
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
                      onChange={(e) => roadmapTitle && setRoadmapTitle(e.target.value)}
                      required
                    />
                    <input
                      type="date"
                      className="cyber-input"
                      style={{ flex: 1, minWidth: '100px' }}
                      value={roadmapDate}
                      onChange={(e) => setRoadmapDate(e.target.value)}
                    />
                    <button type="submit" className="cyber-btn purple-fill" style={{ padding: '0.4rem 0.8rem', minHeight: '40px' }}>Add Goal</button>
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
                            border: '1px solid var(--outline-thick)', padding: '0.6rem 0.8rem', borderRadius: '12px',
                            background: mile.completed ? 'var(--accent-primary-light)' : '#fff',
                            boxShadow: 'var(--shadow-flat-sm)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ fontSize: '0.8rem', textDecoration: mile.completed ? 'line-through' : 'none', color: 'var(--text-primary)' }}>{mile.title}</strong>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Target: {mile.targetDate}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleRoadmapCompleted(mile.id, mile.completed)}
                            className="cyber-btn"
                            style={{
                              padding: '0.15rem 0.4rem', fontSize: '0.65rem', minHeight: 'auto',
                              background: mile.completed ? '#fff' : 'var(--accent-cyan)',
                              color: mile.completed ? 'var(--text-primary)' : '#fff',
                              border: mile.completed ? '1px solid var(--outline-thick)' : 'none'
                            }}
                          >
                            {mile.completed ? 'Reopen' : 'Complete'}
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
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '4px', marginBottom: '4px' }}>
                    Group Members ({activeMembersKeys.length})
                  </h4>
                  {activeMembersKeys.map(memberSlug => (
                    <div key={memberSlug} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', border: '1px solid var(--outline-thick)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{memberSlug.replace(/_/g, '.')}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </>
        )}
      </div>

      {/* DETAILED ATTACHMENT PREVIEW MODAL */}
      {previewAttachment && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,23,42,0.4)', zIndex: 999999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setPreviewAttachment(null)}>
          <div className="glass-panel anim-pop" style={{
            maxWidth: '550px', width: '100%', background: '#fff',
            border: '1px solid var(--outline-thick)', borderRadius: '16px', padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left',
            boxShadow: 'var(--shadow-flat-lg)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.5rem' }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--text-primary)' }}>Attachment Details</strong>
              <button onClick={() => setPreviewAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 800 }}>Close</button>
            </div>
            
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--outline-medium)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>{previewAttachment.name}</span>
              {previewAttachment.size && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Size: {previewAttachment.size}</span>}
            </div>

            {/* Inline Attachment Preview */}
            <div style={{ width: '100%', height: '240px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid var(--outline-thick)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {isImageFile(previewAttachment.name) ? (
                <img src={previewDataUrl || ''} alt="Attachment Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : isPdfFile(previewAttachment.name) ? (
                <iframe src={previewDataUrl || ''} title="Attachment Frame" style={{ width: '100%', height: '100%', border: 'none' }} />
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>
                  No inline preview available. Click Download to fetch the file.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button 
                onClick={() => handleDownloadFile(previewAttachment)}
                className="cyber-btn cyan-fill"
                style={{ padding: '0.4rem 1rem' }}
              >
                Download File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 999999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setShowCreateModal(false)}>
          <div className="glass-panel anim-pop" style={{
            maxWidth: '400px', width: '100%', background: '#fff',
            border: '1px solid var(--outline-thick)', borderRadius: '16px', padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left',
            boxShadow: 'var(--shadow-flat-lg)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.4rem' }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>Form New Study Group</strong>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 800 }}>Close</button>
            </div>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>GROUP NAME</label>
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
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>DESCRIPTION / MOTTO</label>
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
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
