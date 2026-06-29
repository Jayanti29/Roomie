import React, { useState, useRef, useEffect } from 'react';
import { db, isFirebaseConfigured, ref, push, onChildAdded, onChildChanged, get, set, onValue, uploadFile, auth } from '../firebase';
import { downloadFileHelper } from '../utils/downloadHelper';
import { Paperclip, FileText, Mic, X } from 'lucide-react';

const VoiceAudio: React.FC<{ url: string }> = ({ url }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');

  useEffect(() => {
    if (url && url.startsWith('mock-file-url:')) {
      const mockId = url.split(':')[1];
      if (isFirebaseConfigured && db) {
        get(ref(db, 'pdf_contents/' + mockId)).then(snap => {
          if (snap.exists()) {
            setResolvedUrl(snap.val());
          }
        }).catch(err => {
          console.error('Failed to load mock audio content:', err);
        });
      }
    } else {
      setResolvedUrl(url);
    }
  }, [url]);

  if (!resolvedUrl) {
    return <span style={{ fontSize: '0.7rem', opacity: 0.8, color: 'inherit' }}>Loading audio...</span>;
  }

  return <audio src={resolvedUrl} controls style={{ height: '32px', width: '200px' }} />;
};

interface ChatMessage {
  id: string;
  sender: string;
  senderEmail: string;
  text: string;
  timestamp: number;
  attachment?: {
    name: string;
    size: string;
    url: string;
    isVoice?: boolean;
  };
  noteReference?: {
    id: string;
    title: string;
    author: string;
    content: string;
    course: string;
    pdfAttachment?: any;
  };
  readBy?: Record<string, boolean>;
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
  const [communities, setCommunities] = useState<{ id: string; name: string; description: string; createdBy?: string; moderators?: string[]; type?: string; members?: Record<string, boolean> }[]>([
    { id: 'global', name: 'Global Roomie', description: 'The main Roomie student forum.', type: 'global' }
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
  const [newCommunityType, setNewCommunityType] = useState<'custom' | 'private' | 'college' | 'degree' | 'specialization'>('custom');
  
  // Note attachment state
  const [attachedNote, setAttachedNote] = useState<any | null>(null);
  const [myNotes, setMyNotes] = useState<any[]>([]);
  const [showNoteSelector, setShowNoteSelector] = useState(false);

  // File Upload State
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Preview / Download Modal State
  const [previewAttachment, setPreviewAttachment] = useState<{ name: string; url: string; size?: string } | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const myEmailSlug = userEmail.replace(/\./g, '_');
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateTypingStatus = (isTyping: boolean) => {
    if (!isFirebaseConfigured || !db || !activeChannelId) return;
    const typingRef = activeCommunityId === 'global'
      ? ref(db, `community_channels/${activeChannelId}/typing/${myEmailSlug}`)
      : ref(db, `custom_communities/${activeCommunityId}/channels/${activeChannelId}/typing/${myEmailSlug}`);

    if (isTyping) {
      set(typingRef, userName).catch(console.error);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        set(typingRef, null).catch(console.error);
      }, 3000);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      set(typingRef, null).catch(console.error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    updateTypingStatus(e.target.value.trim().length > 0);
  };

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
      const currentUid = auth?.currentUser?.uid || '';
      const list = Object.values(val)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          createdBy: c.createdBy,
          moderators: c.moderators || [],
          type: c.type || 'custom',
          members: c.members || {}
        }))
        .filter((c: any) => {
          if (c.type === 'private') {
            const emailSlug = userEmail.replace(/\./g, '_');
            return c.members?.[currentUid] === true || c.members?.[emailSlug] === true || c.createdBy === userEmail;
          }
          return true;
        });
      setCommunities([
        { id: 'global', name: 'Global Roomie', description: 'The main Roomie student forum.', type: 'global' },
        ...list
      ]);
    });
    return () => unsub();
  }, [isFirebaseConfigured, userEmail]);

  // Subscribe to Channels List based on active community
  useEffect(() => {
    setChannels([]);
    if (!isFirebaseConfigured || !db) return;

    if (activeCommunityId === 'global') {
      setActiveChannelId('chan_general');
      const channelsRef = ref(db, 'community_channels');
      
      // Ensure default channels exist
      get(channelsRef).then(async (snap) => {
        if (!snap.exists() || !snap.val()) {
          for (const chan of defaultChannels) {
            await set(ref(db, 'community_channels/' + chan.id), chan);
          }
        }
      }).catch(err => {
        console.warn('Failed to ensure default channels exist:', err);
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
    setVisibleLimit(30); // Reset pagination limit on channel switch
    if (!isFirebaseConfigured || !db || !activeChannelId) return;

    const msgsRef = activeCommunityId === 'global'
      ? ref(db, `community_channels/${activeChannelId}/messages`)
      : ref(db, `custom_communities/${activeCommunityId}/channels/${activeChannelId}/messages`);
    
    const unsubAdded = onChildAdded(msgsRef, (snap) => {
      const val = snap.val();
      if (val) {
        setMessages((prev: ChatMessage[]) => {
          if (prev.some((m: ChatMessage) => m.id === val.id)) return prev;
          return [...prev, val];
        });
      }
    });

    const unsubChanged = onChildChanged(msgsRef, (snap) => {
      const val = snap.val();
      if (val) {
        setMessages((prev: ChatMessage[]) => 
          prev.map((m: ChatMessage) => m.id === val.id ? val : m)
        );
      }
    });

    return () => {
      unsubAdded();
      unsubChanged();
    };
  }, [activeCommunityId, activeChannelId]);

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
          }).catch(err => {
            console.error('Failed to load mock file content:', err);
          });
        }
      } else {
        setPreviewDataUrl(url);
      }
    } else {
      setPreviewDataUrl(null);
    }
  }, [previewAttachment]);

  // Auto Scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Read Receipts Sync
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !activeChannelId || messages.length === 0) return;
    
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.senderEmail !== userEmail) {
      const alreadyRead = lastMsg.readBy && lastMsg.readBy[myEmailSlug];
      if (!alreadyRead) {
        const msgRef = activeCommunityId === 'global'
          ? ref(db, `community_channels/${activeChannelId}/messages/${lastMsg.id}/readBy/${myEmailSlug}`)
          : ref(db, `custom_communities/${activeCommunityId}/channels/${activeChannelId}/messages/${lastMsg.id}/readBy/${myEmailSlug}`);
        
        set(msgRef, true).catch(console.error);
      }
    }
  }, [messages, activeChannelId, activeCommunityId, userEmail, myEmailSlug]);

  // Listen to typing status
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !activeChannelId) return;

    const typingRef = activeCommunityId === 'global'
      ? ref(db, `community_channels/${activeChannelId}/typing`)
      : ref(db, `custom_communities/${activeCommunityId}/channels/${activeChannelId}/typing`);

    const unsub = onValue(typingRef, (snap) => {
      setTypingUsers(snap.val() || {});
    });

    return () => {
      unsub();
    };
  }, [activeCommunityId, activeChannelId]);

  const isImageFile = (name: string) => {
    const ext = name.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');
  };

  const isPdfFile = (name: string) => {
    return name.toLowerCase().endsWith('.pdf');
  };

  // Secure file download logic
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

  // Handle standard file selection
  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError('');
    if (!file) return;

    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const lowerName = file.name.toLowerCase();
    const isAllowedType = allowedExtensions.some(ext => lowerName.endsWith(ext)) || 
      file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
      file.type === 'text/plain' || 
      file.type.startsWith('image/');

    if (!isAllowedType) {
      setUploadError('Unsupported format. Supported: PDF, DOCX, PPTX, TXT, Images.');
      setAttachedFile(null);
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setUploadError('File exceeds the 100MB limit.');
      setAttachedFile(null);
      return;
    }

    setAttachedFile(file);
  };

  // Voice Recording Handlers
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

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
          setIsUploading(true);
          const fileId = `voice_${Date.now()}.webm`;
          const url = await uploadFile(audioBlob, fileId, userEmail);
          const voiceAttachment = {
            name: 'Voice Note',
            size: `${(audioBlob.size / 1024).toFixed(1)} KB`,
            url,
            isVoice: true
          };

          const newMsg: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            sender: userName,
            senderEmail: userEmail,
            text: 'Sent a voice note',
            timestamp: Date.now(),
            attachment: voiceAttachment
          };

          if (isFirebaseConfigured && db) {
            const msgsPath = activeCommunityId === 'global'
              ? `community_channels/${activeChannelId}/messages`
              : `custom_communities/${activeCommunityId}/channels/${activeChannelId}/messages`;
            await push(ref(db, msgsPath), newMsg);
          }
        } catch (err) {
          console.error('Failed to upload voice note:', err);
          alert('Failed to send voice note.');
        } finally {
          setIsUploading(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
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

  // Send Message (Text & File attachments)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedFile && !attachedNote) return;

    if (activeCommunityId === 'global' && activeChannelId === 'chan_announcements' && !isAdmin) {
      alert("Only administrators can post announcements.");
      return;
    }

    setIsUploading(true);
    try {
      let attachmentObj = undefined;

      if (attachedFile) {
        try {
          const url = await uploadFile(attachedFile, attachedFile.name, userEmail);
          attachmentObj = {
            name: attachedFile.name,
            size: attachedFile.size > 1024 * 1024 
              ? (attachedFile.size / (1024 * 1024)).toFixed(1) + ' MB' 
              : (attachedFile.size / 1024).toFixed(1) + ' KB',
            url
          };
        } catch (err) {
          console.error('File upload failed:', err);
          setUploadError('Failed to upload attachment.');
          setIsUploading(false);
          return;
        }
      }

      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        sender: userName,
        senderEmail: userEmail,
        text: inputText,
        timestamp: Date.now(),
        attachment: attachmentObj,
        // @ts-ignore
        noteReference: attachedNote ? {
          id: attachedNote.id,
          title: attachedNote.title,
          author: attachedNote.author,
          content: attachedNote.content,
          course: attachedNote.course,
          pdfAttachment: attachedNote.pdfAttachment || null
        } : undefined
      };

      if (isFirebaseConfigured && db) {
        const msgsPath = activeCommunityId === 'global'
          ? `community_channels/${activeChannelId}/messages`
          : `custom_communities/${activeCommunityId}/channels/${activeChannelId}/messages`;
        await push(ref(db, msgsPath), newMsg);
      }

      setInputText('');
      setAttachedFile(null);
      setAttachedNote(null);
      updateTypingStatus(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please check your network or credentials.');
    } finally {
      setIsUploading(false);
    }
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
      const sysMsg = {
        id: `sys_${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@roomie.io',
        text: `Channel #${channelSlug} was created.`,
        timestamp: Date.now()
      };

      if (activeCommunityId === 'global') {
        await set(ref(db, 'community_channels/' + newId), newChan);
        await push(ref(db, `community_channels/${newId}/messages`), sysMsg);
      } else {
        await set(ref(db, `custom_communities/${activeCommunityId}/channels/${newId}`), newChan);
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
      type: newCommunityType,
      createdBy: userEmail,
      moderators: [userEmail],
      members: {
        [myEmailSlug]: true,
        [auth?.currentUser?.uid || '']: true
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
          text: `Community Space "${newCommunityName}" (Type: ${newCommunityType}) was formed. Welcome!`,
          timestamp: Date.now()
        };
        await push(ref(db, `custom_communities/${commId}/channels/chan_general/messages`), sysMsg);
      } catch (err) {
        console.error('Error creating custom community:', err);
      }
    }

    setNewCommunityName('');
    setNewCommunityDesc('');
    setNewCommunityType('custom');
    setShowCreateCommunityModal(false);
    setActiveCommunityId(commId);
  };

  const loadMyNotes = async () => {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await get(ref(db, 'shared_notes'));
        if (snap.exists()) {
          const val = snap.val();
          const list = Object.values(val).filter((n: any) => n.authorEmail === userEmail);
          setMyNotes(list);
        }
      } catch (err) {
        console.error('Error loading my notes:', err);
      }
    }
  };

  const handleOpenNoteSelector = () => {
    loadMyNotes();
    setShowNoteSelector(true);
  };

  const currentChannel = channels.find((c: Channel) => c.id === activeChannelId);

  return (
    <div className="notes-board-grid" style={{ paddingBottom: '2rem', height: 'calc(100vh - 180px)', minHeight: '500px' }}>
      
      {/* SIDEBAR: Channels Directory */}
      <div className="glass-panel" style={{ background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', border: '1px solid var(--outline-thick)' }}>
        
        {/* Community Space Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.8rem' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>COMMUNITY SPACE</label>
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
              className="cyber-btn cyan-fill"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', minHeight: 'auto' }}
              title="Create Community"
            >
              + Space
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Chat Channels
          </h3>
          {(activeCommunityId === 'global' ? isAdmin : (communities.find((c: any) => c.id === activeCommunityId)?.createdBy === userEmail || communities.find((c: any) => c.id === activeCommunityId)?.moderators?.includes(userEmail))) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="cyber-btn gold-fill"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', minHeight: 'auto' }}
            >
              + New
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', overflowY: 'auto', flex: 1 }}>
          {channels.map((chan: Channel) => (
            <button
              key={chan.id}
              onClick={() => setActiveChannelId(chan.id)}
              style={{
                textAlign: 'left',
                padding: '0.5rem 0.75rem',
                border: activeChannelId === chan.id ? '1px solid var(--accent-purple)' : '1px solid var(--outline-medium)',
                borderRadius: 'var(--border-radius-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: activeChannelId === chan.id ? 700 : 500,
                fontSize: '0.85rem',
                background: activeChannelId === chan.id ? 'var(--accent-primary-light)' : '#ffffff',
                color: activeChannelId === chan.id ? 'var(--accent-purple)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              # {chan.name}
            </button>
          ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="glass-panel" style={{ background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', border: '1px solid var(--outline-thick)' }}>
        
        {/* Chat Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            # {currentChannel ? currentChannel.name : 'select-channel'}
          </h3>
          {activeChannelId === 'chan_announcements' && (
            <span style={{ fontSize: '0.65rem', background: 'var(--accent-pink)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, color: '#fff' }}>
              Announcements Only
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
          padding: '1rem',
          background: '#f8fafc',
          border: '1px solid var(--outline-medium)',
          borderRadius: 'var(--border-radius-md)'
        }}>
          {messages.length > visibleLimit && (
            <button 
              type="button"
              onClick={() => setVisibleLimit(prev => prev + 30)}
              className="cyber-btn"
              style={{ margin: '0.5rem auto', padding: '0.35rem 0.8rem', display: 'block', fontSize: '0.7rem', minHeight: 'auto', background: '#fff' }}
            >
              LOAD PREVIOUS MESSAGES ({messages.length - visibleLimit} REMAINING)
            </button>
          )}
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>
              No messages here yet. Say hello!
            </div>
          ) : (
            messages.slice(-visibleLimit).map((msg: ChatMessage) => {
              const isMe = msg.senderEmail === userEmail;
              const isSystem = msg.sender === 'System';

              if (isSystem) {
                return (
                  <div key={msg.id} style={{ textAlign: 'center', margin: '0.4rem 0' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid var(--outline-medium)', fontWeight: 600 }}>
                      System Announcement: {msg.text}
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
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginLeft: isMe ? '0' : '6px', marginRight: isMe ? '6px' : '0', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                    {msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div
                    style={{
                      background: isMe ? 'var(--accent-primary)' : '#ffffff',
                      color: isMe ? '#ffffff' : 'var(--text-primary)',
                      border: isMe ? 'none' : '1px solid var(--outline-thick)',
                      borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: '0.6rem 0.8rem',
                      boxShadow: 'var(--shadow-flat-sm)',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}
                  >
                    {msg.text && <div>{msg.text}</div>}
                    
                    {/* Render Note Reference Card */}
                    {msg.noteReference && (() => {
                      const noteRef = msg.noteReference;
                      return (
                        <div 
                          onClick={() => {
                            setPreviewAttachment({
                              name: noteRef.title + " (Note Reference)",
                              url: noteRef.pdfAttachment?.url || '',
                              // @ts-ignore
                              isNoteRef: true,
                              noteDetails: noteRef
                            });
                          }}
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            gap: '0.25rem',
                            border: isMe ? '1.5px solid rgba(255,255,255,0.4)' : '2px solid #000', 
                            background: isMe ? 'rgba(255,255,255,0.15)' : '#fffcf0', 
                            padding: '0.6rem', 
                            borderRadius: '8px', 
                            cursor: 'pointer',
                            marginTop: '0.4rem',
                            boxShadow: isMe ? 'none' : '2px 2px 0px #000',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <FileText size={16} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isMe ? '#fff' : '#0f172a' }}>
                              Shared Note: {noteRef.title}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                            Subject: {noteRef.course} | By: {noteRef.author}
                          </span>
                        </div>
                      );
                    })()}
                    
                    {/* Render attachment inside message bubble */}
                    {msg.attachment && (
                      <div 
                        onClick={() => setPreviewAttachment(msg.attachment!)}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          border: isMe ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--outline-thick)', 
                          background: isMe ? 'rgba(255,255,255,0.1)' : '#f8fafc', 
                          padding: '0.4rem 0.6rem', 
                          borderRadius: '6px', 
                          cursor: 'pointer',
                          marginTop: '0.2rem'
                        }}
                      >
                        {msg.attachment.isVoice ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }} onClick={e => e.stopPropagation()}>
                            <Mic size={14} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                            <VoiceAudio url={msg.attachment.url} />
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
                    {/* Read Receipts indicator */}
                    {isMe && msg.readBy && Object.keys(msg.readBy).length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.62rem', color: '#0f766e', fontWeight: 800 }}>
                          ✓✓ Read by {Object.keys(msg.readBy).map(k => k.replace(/_/g, '.')).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {/* Typing Indicator */}
          {Object.keys(typingUsers).filter(k => k !== myEmailSlug).length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', alignSelf: 'flex-start', padding: '0.25rem 0.6rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--outline-thick)', boxShadow: 'var(--shadow-flat-sm)' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {Object.values(typingUsers).filter((_, i) => Object.keys(typingUsers)[i] !== myEmailSlug).join(', ')} is typing...
              </span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        {(activeChannelId !== 'chan_announcements' || isAdmin) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            
            {/* Attachment Preview Bar */}
            {attachedFile && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--accent-primary-light)', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--outline-thick)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Paperclip: {attachedFile.name} ({(attachedFile.size / 1024).toFixed(1)} KB)
                </span>
                <button 
                  onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  Remove
                </button>
              </div>
            )}
            
            {attachedNote && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-green)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Note Reference: {attachedNote.title}
                </span>
                <button 
                  onClick={() => setAttachedNote(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  Remove
                </button>
              </div>
            )}
            {uploadError && <span style={{ fontSize: '0.7rem', color: 'var(--accent-pink)', fontWeight: 600 }}>{uploadError}</span>}

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              
              {/* Attachment selector */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="cyber-btn"
                style={{ padding: '0.5rem', minHeight: '38px', minWidth: '38px', borderRadius: 'var(--border-radius-sm)', background: '#f1f5f9' }}
                title="Attach Document/Image"
                disabled={isRecording || isUploading}
              >
                <Paperclip size={18} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleFileSelection}
              />

              {/* Attach Note Reference Button */}
              <button
                type="button"
                onClick={handleOpenNoteSelector}
                className="cyber-btn"
                style={{ padding: '0.5rem', minHeight: '38px', minWidth: '38px', borderRadius: 'var(--border-radius-sm)', background: '#f0fdf4', color: 'var(--accent-green)', border: '1px solid #bbf7d0' }}
                title="Attach Shared Note Card"
                disabled={isRecording || isUploading}
              >
                <FileText size={18} />
              </button>

              {/* Voice Notes Button */}
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="cyber-btn"
                  style={{ padding: '0.5rem', minHeight: '38px', minWidth: '38px', borderRadius: 'var(--border-radius-sm)', background: '#ffe4e6', color: 'var(--accent-pink)', border: '1px solid #fecdd3' }}
                  title="Record Voice Note"
                  disabled={isUploading}
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

              {/* Text input */}
              {!isRecording && (
                <>
                  <input
                     type="text"
                     className="cyber-input"
                     style={{ flex: 1, minHeight: '38px' }}
                     placeholder={activeChannelId === 'chan_announcements' ? "Post official announcement..." : `Message #${currentChannel?.name || 'channel'}...`}
                     value={inputText}
                     onChange={handleInputChange}
                     disabled={isUploading}
                   />
                   <button
                     type="submit"
                     disabled={isUploading}
                     className="cyber-btn purple-fill"
                     style={{ padding: '0.5rem 1rem', minHeight: '38px' }}
                  >
                    {isUploading ? 'Sending...' : 'Send'}
                  </button>
                </>
              )}
            </form>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.5rem', background: '#fef3c7', border: '1px dashed #f59e0b', borderRadius: '8px' }}>
            This channel is read-only. Only administrators can send messages.
          </div>
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
                <img src={previewDataUrl || ''} alt="Attachment File" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : isPdfFile(previewAttachment.name) ? (
                <iframe src={previewDataUrl || ''} title="PDF Attachment" style={{ width: '100%', height: '100%', border: 'none' }} />
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>
                  No inline preview available for this file type. Click Download to retrieve the file.
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

      {/* CREATE CHANNEL MODAL */}
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
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>Create New Channel</strong>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 800 }}>Close</button>
            </div>
            <form onSubmit={handleCreateChannel} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>CHANNEL NAME</label>
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
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                Create Channel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE COMMUNITY MODAL */}
      {showCreateCommunityModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 999999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setShowCreateCommunityModal(false)}>
          <div className="glass-panel anim-pop" style={{
            maxWidth: '400px', width: '100%', background: '#fff',
            border: '1px solid var(--outline-thick)', borderRadius: '16px', padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left',
            boxShadow: 'var(--shadow-flat-lg)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.4rem' }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>Create New Community Space</strong>
              <button onClick={() => setShowCreateCommunityModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 800 }}>Close</button>
            </div>
            <form onSubmit={handleCreateCommunity} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>COMMUNITY SPACE NAME</label>
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
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>DESCRIPTION</label>
                <input
                  type="text"
                  className="cyber-input"
                  placeholder="e.g. A space for learning Java and DSA together"
                  value={newCommunityDesc}
                  onChange={(e) => setNewCommunityDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>SPACE TYPE</label>
                <select
                  className="cyber-input"
                  style={{ appearance: 'auto', cursor: 'pointer' }}
                  value={newCommunityType}
                  onChange={(e: any) => setNewCommunityType(e.target.value)}
                >
                  <option value="custom">Custom (Public)</option>
                  <option value="private">Private (Invite Only)</option>
                  <option value="college">College (My Campus Space)</option>
                  <option value="degree">Degree (Same Major)</option>
                  <option value="specialization">Specialization (Branch Specific)</option>
                </select>
              </div>
              <button
                type="submit"
                className="cyber-btn cyan-fill"
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                Create Space
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NOTE REFERENCE SELECTOR MODAL */}
      {showNoteSelector && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 999999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setShowNoteSelector(false)}>
          <div className="glass-panel anim-pop" style={{
            maxWidth: '450px', width: '100%', background: '#fff',
            border: '1px solid var(--outline-thick)', borderRadius: '16px', padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left',
            boxShadow: 'var(--shadow-flat-lg)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.4rem' }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>Attach Note Card</strong>
              <button onClick={() => setShowNoteSelector(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><X size={16} /></button>
            </div>
            
            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--outline-medium)', borderRadius: '8px', padding: '0.25rem', background: '#f8fafc' }}>
              {myNotes.length === 0 ? (
                <div style={{ padding: '1rem', textShadow: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                  You haven't shared any notes yet. Go to Notes Shelf to upload study material.
                </div>
              ) : (
                myNotes.map(n => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setAttachedNote(n);
                      setShowNoteSelector(false);
                    }}
                    style={{
                      padding: '0.6rem',
                      background: '#fff',
                      border: '1px solid var(--outline-medium)',
                      borderRadius: '6px',
                      marginBottom: '0.35rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{n.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Course: {n.course}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
