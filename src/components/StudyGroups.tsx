import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, push, onChildAdded, onChildChanged, onChildRemoved, set, onValue, uploadFile, get, auth } from '../firebase';
import { downloadFileHelper } from '../utils/downloadHelper';
import { ArrowLeft, ArrowRight, Paperclip, Mic } from 'lucide-react';

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
  members: Record<string, boolean>; // userEmailSlug -> true / userUid -> true
  messages?: Record<string, any>;
  notes?: Record<string, GroupNote>;
  tasks?: Record<string, GroupTask>;
  announcements?: Record<string, GroupAnnouncement>;
  roadmap?: Record<string, GroupRoadmap>;
  resources?: Record<string, any>;
  files?: Record<string, any>;
}

const DocxPreview: React.FC<{ fileName: string }> = ({ fileName }) => {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #cbd5e1',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
      padding: '1.5rem',
      borderRadius: '4px',
      maxHeight: '240px',
      overflowY: 'auto',
      fontFamily: 'var(--font-body)',
      color: '#334155',
      lineHeight: '1.6'
    }}>
      <h4 style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid #334155', paddingBottom: '0.25rem', fontSize: '1.1rem', color: '#1e293b' }}>
        {fileName.replace(/\.docx$/i, '')}
      </h4>
      <p style={{ textIndent: '1.5em', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
        This is a simulated document reader preview for <strong>{fileName}</strong>. To view or edit the full formatted content, please download the original DOCX file.
      </p>
      <p style={{ textIndent: '1.5em', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
        <strong>Executive Summary:</strong> The study notes contained herein outline the primary research findings and curriculum modules. Detailed sections include methodology, structural analysis, core definitions, and sample quiz questions to solidify learning targets.
      </p>
    </div>
  );
};

const PptxPreview: React.FC<{ fileName: string }> = ({ fileName }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      bg: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
      color: '#fff',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '1rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{fileName.replace(/\.pptx$/i, '')}</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>Lecture Presentation Notes</span>
          <span style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '1rem' }}>Created by Roomie Student Registry</span>
        </div>
      )
    },
    {
      bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#f8fafc',
      content: (
        <div style={{ padding: '1rem', fontSize: '0.75rem' }}>
          <h5 style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>Key Academic Concepts</h5>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <li>Detailed diagrams and structural mappings.</li>
            <li>Interactive equations with step-by-step resolution.</li>
            <li>Summary sheets covering mid-semester assignments.</li>
          </ul>
        </div>
      )
    },
    {
      bg: 'linear-gradient(135deg, #111827 0%, #312e81 100%)',
      color: '#f8fafc',
      content: (
        <div style={{ padding: '1rem', fontSize: '0.75rem' }}>
          <h5 style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>Conclusion & Next Steps</h5>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <li>Complete the practice quiz on the AI Workspace tab.</li>
            <li>Join the next scheduled video study room for live discussion.</li>
            <li>Bookmark this resource on your Academic Study Shelf.</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{
        height: '180px',
        borderRadius: '8px',
        background: slides[currentSlide].bg,
        color: slides[currentSlide].color,
        border: '2px solid #000',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {slides[currentSlide].content}
        <div style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.6rem' }}>
          Slide {currentSlide + 1} of {slides.length}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
          disabled={currentSlide === 0}
          className="cyber-btn"
          style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', minHeight: 'auto' }}
        >
          <ArrowLeft size={10} style={{ display: 'inline-block', marginRight: '2px', verticalAlign: 'middle' }} /> Prev
        </button>

        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {slides.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: currentSlide === idx ? 'var(--accent-primary)' : '#cbd5e1',
                cursor: 'pointer',
                border: '1px solid #000'
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
          disabled={currentSlide === slides.length - 1}
          className="cyber-btn"
          style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', minHeight: 'auto' }}
        >
          Next <ArrowRight size={10} style={{ display: 'inline-block', marginLeft: '2px', verticalAlign: 'middle' }} />
        </button>
      </div>
    </div>
  );
};

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
  const [subTab, setSubTab] = useState<'chat' | 'notes' | 'resources' | 'files' | 'members'>('chat');

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

  // Files Tab states
  const [groupFile, setGroupFile] = useState<File | null>(null);
  const [groupFileUploadProgress, setGroupFileUploadProgress] = useState(0);
  const [groupFileUploadError, setGroupFileUploadError] = useState('');
  const [groupFileUploading, setGroupFileUploading] = useState(false);
  const groupFileInputRef = useRef<HTMLInputElement>(null);

  // Resources Tab states
  const [bookmarkedNotesList, setBookmarkedNotesList] = useState<any[]>([]);

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
  // const [taskTitle, setTaskTitle] = useState('');

  // Announcement inputs
  // const [announcementText, setAnnouncementText] = useState('');

  // Roadmap inputs
  // const [roadmapTitle, setRoadmapTitle] = useState('');
  // const [roadmapDate, setRoadmapDate] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const myEmailSlug = userEmail.replace(/\./g, '_');

  // Listen to join-study-group event from private DMs
  useEffect(() => {
    const handleJoinGroupEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { groupId } = customEvent.detail || {};
      if (groupId) {
        setActiveGroupId(groupId);
        setSubTab('chat');
      }
    };
    window.addEventListener('join-study-group', handleJoinGroupEvent);
    return () => window.removeEventListener('join-study-group', handleJoinGroupEvent);
  }, []);

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

    // Listen to resources
    const resourcesRef = ref(db, `community_groups/${activeGroupId}/resources`);
    unsubs.push(onValue(resourcesRef, (snap: any) => {
      const val = snap.val() || {};
      setGroups(prev => prev.map(g => g.id === activeGroupId ? {
        ...g,
        resources: val
      } : g));
    }));

    // Listen to files
    const filesRef = ref(db, `community_groups/${activeGroupId}/files`);
    unsubs.push(onValue(filesRef, (snap: any) => {
      const val = snap.val() || {};
      setGroups(prev => prev.map(g => g.id === activeGroupId ? {
        ...g,
        files: val
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

  const isDocxFile = (name: string) => {
    return name.toLowerCase().endsWith('.docx');
  };

  const isPptxFile = (name: string) => {
    return name.toLowerCase().endsWith('.pptx');
  };

  // Secure file download
  const handleDownloadFile = async (attachment: { name: string; url: string }) => {
    if (!attachment) return;
    
    // @ts-ignore
    if (attachment.isNoteRef) {
      // @ts-ignore
      const text = `${attachment.noteDetails.title}\n\nSubject: ${attachment.noteDetails.course}\nAuthor: ${attachment.noteDetails.author}\n\n${attachment.noteDetails.content}`;
      const blob = new Blob([text], { type: 'text/plain' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      // @ts-ignore
      link.download = `${attachment.noteDetails.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      link.click();
      return;
    }

    await downloadFileHelper(attachment.url, attachment.name);
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

    const currentUid = auth?.currentUser?.uid || 'guest';

    const newGp = {
      metadata: {
        id: groupId,
        name: newGroupName,
        description: newGroupDesc,
        createdBy: userEmail
      },
      members: {
        [myEmailSlug]: true,
        [currentUid]: true
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
    const currentUid = auth?.currentUser?.uid || 'guest';
    const isCurrentlyMember = !!gp.members[myEmailSlug] || !!gp.members[currentUid];

    const sysMsg = {
      id: `sys_join_${Date.now()}`,
      sender: 'System',
      senderEmail: 'system@roomie.io',
      text: `${userName} has ${isCurrentlyMember ? 'left' : 'joined'} the group.`,
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${groupId}/members/${myEmailSlug}`), isCurrentlyMember ? null : true);
      await set(ref(db, `community_groups/${groupId}/members/${currentUid}`), isCurrentlyMember ? null : true);
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

  const handlePinResource = async (note: any) => {
    if (!activeGroupId) return;
    const resourceId = `resource_${Date.now()}`;
    const newResource = {
      id: resourceId,
      noteId: note.id,
      title: note.title,
      content: note.content,
      course: note.course,
      author: note.author,
      authorEmail: note.authorEmail,
      pdfAttachment: note.pdfAttachment || null,
      pinnedBy: userName,
      pinnedAt: Date.now()
    };
    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${activeGroupId}/resources/${resourceId}`), newResource);
      
      const sysMsg = {
        id: `sys_res_${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@roomie.io',
        text: `${userName} pinned a note to resources: "${note.title}".`,
        timestamp: Date.now()
      };
      await push(ref(db, `community_groups/${activeGroupId}/messages`), sysMsg);
    }
  };

  const handleUploadGroupFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupFile || !activeGroupId) return;

    setGroupFileUploading(true);
    setGroupFileUploadProgress(0);
    setGroupFileUploadError('');

    const progressInterval = setInterval(() => {
      setGroupFileUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 150);

    const fileId = `file_${Date.now()}`;
    let fileUrl = '';

    try {
      fileUrl = await uploadFile(groupFile, groupFile.name, userEmail);
    } catch (err) {
      console.error('Group file upload failed:', err);
      setGroupFileUploadError('Upload failed. Please try again.');
      clearInterval(progressInterval);
      setGroupFileUploading(false);
      return;
    }

    clearInterval(progressInterval);
    setGroupFileUploadProgress(100);

    const newFile = {
      id: fileId,
      name: groupFile.name,
      size: groupFile.size > 1024 * 1024 
        ? (groupFile.size / (1024 * 1024)).toFixed(1) + ' MB' 
        : (groupFile.size / 1024).toFixed(1) + ' KB',
      url: fileUrl,
      uploadedBy: userName,
      uploadedEmail: userEmail,
      uploadedAt: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${activeGroupId}/files/${fileId}`), newFile);
      
      const sysMsg = {
        id: `sys_file_${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@roomie.io',
        text: `${userName} uploaded group file: "${groupFile.name}".`,
        timestamp: Date.now()
      };
      await push(ref(db, `community_groups/${activeGroupId}/messages`), sysMsg);
    }

    setTimeout(() => {
      setGroupFile(null);
      if (groupFileInputRef.current) groupFileInputRef.current.value = '';
      setGroupFileUploading(false);
      setGroupFileUploadProgress(0);
    }, 500);
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !userEmail) return;
    const userKey = userEmail.replace(/\./g, '_');
    // Fetch bookmarks first
    get(ref(db, 'bookmarks/' + userKey)).then((bookmarkSnap) => {
      if (bookmarkSnap.exists()) {
        const bookmarkIds = bookmarkSnap.val() || [];
        // Fetch all shared notes and filter
        get(ref(db, 'shared_notes')).then((notesSnap) => {
          if (notesSnap.exists()) {
            const allNotes = Object.values(notesSnap.val() || {});
            const filtered = allNotes.filter((n: any) => bookmarkIds.includes(n.id));
            setBookmarkedNotesList(filtered);
          }
        });
      }
    });
  }, [userEmail, activeGroupId, subTab]);

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

  /*
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
  */

  // Parsing values safely
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const currentUid = auth?.currentUser?.uid || 'guest';
  const isMember = activeGroup ? (!!activeGroup.members[myEmailSlug] || !!activeGroup.members[currentUid] || activeGroup.createdBy === userEmail) : false;
  const activeMessages = activeGroup?.messages ? Object.values(activeGroup.messages).sort((a,b) => a.timestamp - b.timestamp) : [];
  const activeNotes = activeGroup?.notes ? Object.values(activeGroup.notes) : [];
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
            <div style={{ display: 'flex', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '1px', gap: '0.25rem', flexWrap: 'wrap' }}>
              {(['chat', 'notes', 'resources', 'files', 'members'] as const).map(tab => (
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
                  {tab === 'chat' ? 'CHAT' : tab === 'notes' ? 'NOTES' : tab === 'resources' ? 'RESOURCES' : tab === 'files' ? 'FILES' : 'MEMBERS'}
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
                                      <Mic size={14} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
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
                        <Paperclip size={18} />
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
                          <Mic size={18} />
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

              {/* 3. GROUP SHARED RESOURCES */}
              {subTab === 'resources' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ borderBottom: '1.5px solid var(--outline-thick)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>Pinned Study Resources ({activeGroup?.resources ? Object.keys(activeGroup.resources).length : 0})</h4>
                  </div>

                  {/* Add Resource Selector */}
                  <div style={{ border: '1px dashed var(--outline-thick)', padding: '1rem', borderRadius: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Pin Pinned/Bookmarked Note to Group Shelf</label>
                    {bookmarkedNotesList.length === 0 ? (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>You don't have any bookmarked notes to pin. Share or save notes in the Shared Notes tab first!</span>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <select
                          className="cyber-input"
                          style={{ flex: 1, minWidth: '200px', appearance: 'auto', cursor: 'pointer' }}
                          id="pin-note-select"
                        >
                          {bookmarkedNotesList.map(n => (
                            <option key={n.id} value={n.id}>{n.title} (by {n.author})</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const selectEl = document.getElementById('pin-note-select') as HTMLSelectElement;
                            const noteId = selectEl?.value;
                            const note = bookmarkedNotesList.find(n => n.id === noteId);
                            if (note) handlePinResource(note);
                          }}
                          className="cyber-btn cyan-fill"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minHeight: '38px' }}
                        >
                          Pin Resource
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Resources List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {(!activeGroup?.resources || Object.keys(activeGroup.resources).length === 0) ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No resources pinned in this group yet.</span>
                    ) : (
                      Object.values(activeGroup.resources).map((r: any) => (
                        <div key={r.id} style={{ border: '1px solid var(--outline-thick)', padding: '1rem', borderRadius: '12px', background: '#fff', boxShadow: 'var(--shadow-flat-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{r.title}</strong>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Pinned by {r.pinnedBy}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Subject: {r.course} | Original Author: {r.author}</span>
                          
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              onClick={() => {
                                setPreviewAttachment({
                                  name: r.title + " (Pinned Resource)",
                                  url: r.pdfAttachment?.url || '',
                                  // @ts-ignore
                                  isNoteRef: true,
                                  noteDetails: r
                                });
                              }}
                              className="cyber-btn"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto', background: '#eae8e8' }}
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => handleDownloadFile({
                                name: r.title,
                                url: r.pdfAttachment?.url || '',
                                // @ts-ignore
                                isNoteRef: true,
                                noteDetails: r
                              })}
                              className="cyber-btn"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto', background: '#eae8e8' }}
                            >
                              Download Note
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 4. GROUP FILES */}
              {subTab === 'files' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ borderBottom: '1.5px solid var(--outline-thick)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>Shared Files Shelf ({activeGroup?.files ? Object.keys(activeGroup.files).length : 0})</h4>
                  </div>

                  {/* Upload Form */}
                  <form onSubmit={handleUploadGroupFile} style={{ border: '1px dashed var(--outline-thick)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.6rem', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Upload File (PDF/DOCX/PPTX/Images up to 100MB)</label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => groupFileInputRef.current?.click()}
                          className="cyber-btn"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', minHeight: '34px', background: '#e2e8f0' }}
                          disabled={groupFileUploading}
                        >
                          Select File
                        </button>
                        <input
                          type="file"
                          ref={groupFileInputRef}
                          style={{ display: 'none' }}
                          accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            setGroupFileUploadError('');
                            if (!file) return;
                            if (file.size > 100 * 1024 * 1024) {
                              setGroupFileUploadError('File exceeds 100MB limit.');
                              setGroupFile(null);
                              return;
                            }
                            setGroupFile(file);
                          }}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {groupFile ? groupFile.name : 'No file chosen'}
                        </span>
                      </div>
                      {groupFileUploadError && <span style={{ fontSize: '0.7rem', color: 'var(--accent-pink)', fontWeight: 600 }}>{groupFileUploadError}</span>}
                    </div>

                    {groupFileUploading && (
                      <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '0.25rem' }}>
                        <div style={{ width: `${groupFileUploadProgress}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 0.2s ease-in-out' }} />
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={groupFileUploading || !groupFile}
                      className="cyber-btn pink-fill" 
                      style={{ alignSelf: 'flex-end', marginTop: '0.5rem' }}
                    >
                      {groupFileUploading ? `Uploading (${groupFileUploadProgress}%)` : 'Upload File'}
                    </button>
                  </form>

                  {/* Files List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {(!activeGroup?.files || Object.keys(activeGroup.files).length === 0) ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No files uploaded to this group yet.</span>
                    ) : (
                      Object.values(activeGroup.files).map((f: any) => (
                        <div key={f.id} style={{ border: '1px solid var(--outline-thick)', padding: '1rem', borderRadius: '12px', background: '#fff', boxShadow: 'var(--shadow-flat-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{f.name}</strong>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Uploaded by {f.uploadedBy}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Size: {f.size}</span>
                          
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              onClick={() => {
                                setPreviewAttachment(f);
                              }}
                              className="cyber-btn"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto', background: '#eae8e8' }}
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => handleDownloadFile(f)}
                              className="cyber-btn"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto', background: '#eae8e8' }}
                            >
                              Download
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(f.url);
                                alert('File download link copied to clipboard!');
                              }}
                              className="cyber-btn"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto', background: '#eae8e8' }}
                            >
                              Copy Link
                            </button>
                          </div>
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
              {/* @ts-ignore */}
              {previewAttachment.isNoteRef ? (
                <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#fff', padding: '1rem', color: '#000', fontSize: '0.8rem' }}>
                  {/* @ts-ignore */}
                  <h4 style={{ borderBottom: '2px solid #000', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontWeight: 800 }}>{previewAttachment.noteDetails.title}</h4>
                  {/* @ts-ignore */}
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{previewAttachment.noteDetails.content}</p>
                </div>
              ) : isImageFile(previewAttachment.name) ? (
                <img src={previewDataUrl || ''} alt="Attachment Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : isPdfFile(previewAttachment.name) ? (
                <iframe src={previewDataUrl || ''} title="Attachment Frame" style={{ width: '100%', height: '100%', border: 'none' }} />
              ) : isDocxFile(previewAttachment.name) ? (
                <DocxPreview fileName={previewAttachment.name} />
              ) : isPptxFile(previewAttachment.name) ? (
                <PptxPreview fileName={previewAttachment.name} />
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>
                  No inline preview available. Click Download to fetch the file.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {/* @ts-ignore */}
              {previewAttachment.isNoteRef && previewAttachment.noteDetails.pdfAttachment && (
                <button 
                  // @ts-ignore
                  onClick={() => handleDownloadFile(previewAttachment.noteDetails.pdfAttachment)}
                  className="cyber-btn purple-fill"
                  style={{ padding: '0.4rem 1rem' }}
                >
                  Download Note File Attachment
                </button>
              )}
              <button 
                onClick={() => handleDownloadFile(previewAttachment)}
                className="cyber-btn cyan-fill"
                style={{ padding: '0.4rem 1rem' }}
              >
                {/* @ts-ignore */}
                {previewAttachment.isNoteRef ? 'Download Note Text' : 'Download File'}
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
