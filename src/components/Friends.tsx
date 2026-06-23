import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, push, set, update, onValue, uploadFile, get, auth } from '../firebase';
import { downloadFileHelper } from '../utils/downloadHelper';
import { 
  Paperclip, 
  FileText, 
  Mic, 
  Map, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Users
} from 'lucide-react';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  profilePhoto: string | null;
  state?: string;
  city?: string;
  college?: string;
  university?: string;
  degree?: string;
  specialization?: string;
  semester?: string;
  careerGoal?: string;
  interests?: string;
  onboardingCompleted?: boolean;
}

interface FriendRequest {
  id: string;
  senderUid: string;
  senderName: string;
  senderPhoto: string | null;
  receiverUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

interface DirectMessage {
  id: string;
  senderUid: string;
  senderName: string;
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
  roadmapReference?: {
    id: string;
    name: string;
    goal: string;
    targetDate: string;
    progress: number;
    type: 'ai' | 'manual';
    checkpoints: {
      id: string;
      title: string;
      completed: boolean;
      tasks?: string[];
      milestone?: string;
      week?: number;
    }[];
  };
  inviteType?: 'room' | 'group';
  inviteId?: string;
  inviteName?: string;
}

interface FriendsProps {
  userName: string;
  userEmail: string;
  onRewardXp: (amount: number, reason: string) => void;
  isGuest?: boolean;
}

const DocxPreview: React.FC<{ fileName: string }> = ({ fileName }) => {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #cbd5e1',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
      padding: '1.5rem',
      borderRadius: '4px',
      maxHeight: '200px',
      overflowY: 'auto',
      fontFamily: 'Georgia, serif',
      color: '#334155',
      lineHeight: '1.6'
    }}>
      <h4 style={{ textAlign: 'center', marginBottom: '0.75rem', borderBottom: '2px solid #334155', paddingBottom: '0.25rem', fontSize: '1rem', color: '#1e293b' }}>
        {fileName.replace(/\.docx$/i, '')}
      </h4>
      <p style={{ textIndent: '1.5em', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
        Simulated document reader preview for <strong>{fileName}</strong>. To view or edit the full formatted content, please download the original DOCX file.
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0.5rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 800 }}>{fileName.replace(/\.pptx$/i, '')}</span>
          <span style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.25rem' }}>Lecture Presentation Notes</span>
        </div>
      )
    },
    {
      bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#f8fafc',
      content: (
        <div style={{ padding: '0.5rem', fontSize: '0.7rem' }}>
          <h5 style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '2px', marginBottom: '0.25rem' }}>Key Concepts</h5>
          <ul style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <li>Detailed diagrams and structural mappings.</li>
            <li>Interactive equations with step-by-step resolution.</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{
        height: '140px',
        borderRadius: '8px',
        background: slides[currentSlide].bg,
        color: slides[currentSlide].color,
        border: '1.5px solid #000',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {slides[currentSlide].content}
        <div style={{ position: 'absolute', bottom: '0.25rem', right: '0.25rem', background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: '8px', fontSize: '0.55rem' }}>
          Slide {currentSlide + 1} of {slides.length}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
          disabled={currentSlide === 0}
          className="cyber-btn"
          style={{ padding: '0.15rem 0.3rem', fontSize: '0.6rem', minHeight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={10} />
        </button>
        <button
          type="button"
          onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
          disabled={currentSlide === slides.length - 1}
          className="cyber-btn"
          style={{ padding: '0.15rem 0.3rem', fontSize: '0.6rem', minHeight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronRight size={10} />
        </button>
      </div>
    </div>
  );
};

export const Friends: React.FC<FriendsProps> = ({
  userName,
  userEmail,
  onRewardXp,
  isGuest
}) => {
  const currentUid = auth?.currentUser?.uid || 'guest';
  const [activeTab, setActiveTab] = useState<'discover' | 'requests' | 'my-friends' | 'suggested' | 'blocked'>('discover');
  
  // Profiles directory state
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  
  // Realtime relationship states
  const [myFriends, setMyFriends] = useState<string[]>([]);
  const [myBlocked, setMyBlocked] = useState<string[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [degreeFilter, setDegreeFilter] = useState('');

  // Direct Messaging State
  const [activeDmUid, setActiveDmUid] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmInput, setDmInput] = useState('');
  const [chatUploading, setChatUploading] = useState(false);
  const [chatAttachedFile, setChatAttachedFile] = useState<File | null>(null);
  const [chatUploadError, setChatUploadError] = useState('');
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // Note Attachment State for DMs
  const [attachedNote, setAttachedNote] = useState<any | null>(null);
  const [myNotes, setMyNotes] = useState<any[]>([]);
  const [showNoteSelector, setShowNoteSelector] = useState(false);

  // Roadmap sharing states
  const [showRoadmapSelector, setShowRoadmapSelector] = useState(false);
  const [myRoadmaps, setMyRoadmaps] = useState<any[]>([]);
  const [previewRoadmap, setPreviewRoadmap] = useState<any | null>(null);

  // Invite triggers
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [showRoomInviteModal, setShowRoomInviteModal] = useState(false);
  const [showGroupInviteModal, setShowGroupInviteModal] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Preview State
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const dmEndRef = useRef<HTMLDivElement>(null);

  // Load user profiles list
  const loadProfiles = async () => {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await get(ref(db, 'users'));
        if (snap.exists()) {
          const val = snap.val() || {};
          const list = Object.keys(val).map(uid => {
            const prof = val[uid].profile || {};
            let interestsStr = '';
            if (prof.academicInterests) {
              interestsStr = prof.academicInterests;
            } else if (Array.isArray(prof.interests)) {
              interestsStr = prof.interests.join(', ');
            } else if (typeof prof.interests === 'string') {
              interestsStr = prof.interests;
            }
            return {
              uid,
              ...prof,
              email: prof.email || val[uid].email || '',
              name: prof.fullName || prof.name || val[uid].name || 'Classmate',
              interests: interestsStr
            };
          });
          setProfiles(list.filter(p => p.uid !== currentUid));
        }
      } catch (err) {
        console.error('Error loading profiles:', err);
      }
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [activeTab]);

  // Subscribe to relationships list
  useEffect(() => {
    if (!isFirebaseConfigured || !db || currentUid === 'guest') return;

    // Friends listener
    const friendsRef = ref(db, `users/${currentUid}/friends`);
    const unsubFriends = onValue(friendsRef, (snap) => {
      const val = snap.val() || {};
      setMyFriends(Object.keys(val));
    });

    // Blocked listener
    const blockedRef = ref(db, `users/${currentUid}/blocked`);
    const unsubBlocked = onValue(blockedRef, (snap) => {
      const val = snap.val() || {};
      setMyBlocked(Object.keys(val));
    });

    // Friend Requests listener
    const reqRef = ref(db, 'friend_requests');
    const unsubRequests = onValue(reqRef, (snap) => {
      const val = snap.val() || {};
      const list = Object.keys(val).map(id => ({
        id,
        ...val[id]
      })).filter((r: any) => r.senderUid === currentUid || r.receiverUid === currentUid);
      setRequests(list);
    });

    return () => {
      unsubFriends();
      unsubBlocked();
      unsubRequests();
    };
  }, [currentUid]);

  // Subscribe to Direct Messages
  useEffect(() => {
    setDmMessages([]);
    if (!activeDmUid || !isFirebaseConfigured || !db || currentUid === 'guest') return;

    const chatId = currentUid < activeDmUid ? `${currentUid}_${activeDmUid}` : `${activeDmUid}_${currentUid}`;
    const dmRef = ref(db, `private_chats/${chatId}/messages`);

    const unsubDm = onValue(dmRef, (snap) => {
      const val = snap.val() || {};
      const sorted = Object.keys(val).map(id => ({
        id,
        ...val[id]
      })).sort((a, b) => a.timestamp - b.timestamp);
      setDmMessages(sorted);
    });

    return () => unsubDm();
  }, [activeDmUid, currentUid]);

  // Resolve preview data URL for mock files in previews
  useEffect(() => {
    if (previewAttachment) {
      const url = previewAttachment.url;
      if (url && url.startsWith('mock-file-url:')) {
        const mockId = url.split(':')[1];
        if (isFirebaseConfigured && db) {
          get(ref(db, 'pdf_contents/' + mockId)).then(snap => {
            if (snap.exists()) {
              setPreviewDataUrl(snap.val());
            }
          });
        }
      } else {
        setPreviewDataUrl(url || null);
      }
    } else {
      setPreviewDataUrl(null);
    }
  }, [previewAttachment]);

  // Auto scroll chat
  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages]);

  // Actions
  const handleSendFriendRequest = async (targetUid: string) => {
    if (isGuest || currentUid === 'guest') {
      alert("Guest accounts cannot send friend requests.");
      return;
    }
    const reqId = `req_${currentUid}_${targetUid}`;
    const newRequest: FriendRequest = {
      id: reqId,
      senderUid: currentUid,
      senderName: userName,
      senderPhoto: auth?.currentUser?.photoURL || null,
      receiverUid: targetUid,
      status: 'pending',
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `friend_requests/${reqId}`), newRequest);
      // Trigger notification
      await push(ref(db, `notifications/${targetUid}`), {
        title: 'New Friend Request',
        message: `${userName} wants to connect.`,
        type: 'friend_request',
        timestamp: Date.now()
      });
      onRewardXp(10, `Sent connection request to classmate!`);
    }
  };

  const handleResolveRequest = async (reqId: string, status: 'accepted' | 'rejected') => {
    if (!isFirebaseConfigured || !db) return;
    const reqSnap = await get(ref(db, `friend_requests/${reqId}`));
    if (!reqSnap.exists()) return;
    const requestData = reqSnap.val();

    if (status === 'accepted') {
      // Add friend pointers
      await update(ref(db, `users/${currentUid}/friends`), { [requestData.senderUid]: true });
      await update(ref(db, `users/${requestData.senderUid}/friends`), { [currentUid]: true });
      // Notify sender
      await push(ref(db, `notifications/${requestData.senderUid}`), {
        title: 'Friend Request Accepted',
        message: `${userName} accepted your request.`,
        type: 'info',
        timestamp: Date.now()
      });
      onRewardXp(20, `Accepted friend request! Network size increased.`);
    }

    // Delete or update request node
    await set(ref(db, `friend_requests/${reqId}`), null);
  };

  const handleRemoveFriend = async (friendUid: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    if (isFirebaseConfigured && db) {
      await set(ref(db, `users/${currentUid}/friends/${friendUid}`), null);
      await set(ref(db, `users/${friendUid}/friends/${currentUid}`), null);
    }
  };

  const handleToggleBlock = async (targetUid: string, isCurrentlyBlocked: boolean) => {
    if (isFirebaseConfigured && db) {
      if (isCurrentlyBlocked) {
        await set(ref(db, `users/${currentUid}/blocked/${targetUid}`), null);
      } else {
        await set(ref(db, `users/${currentUid}/blocked/${targetUid}`), true);
        // Also remove from friends if blocked
        await set(ref(db, `users/${currentUid}/friends/${targetUid}`), null);
        await set(ref(db, `users/${targetUid}/friends/${currentUid}`), null);
      }
    }
  };

  const handleChatFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 100 * 1024 * 1024) {
        setChatUploadError('File size exceeds the 100MB limit.');
        return;
      }
      setChatAttachedFile(file);
      setChatUploadError('');
    }
  };

  // Chat message sending
  const handleSendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmInput.trim() && !chatAttachedFile && !attachedNote && !activeDmUid) return;

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
        console.error('DM file upload failed:', err);
        setChatUploadError('Failed to upload file.');
        setChatUploading(false);
        return;
      }
    }

    const chatId = currentUid < activeDmUid! ? `${currentUid}_${activeDmUid}` : `${activeDmUid}_${currentUid}`;
    
    const newMsg: DirectMessage = {
      id: `msg_${Date.now()}`,
      senderUid: currentUid,
      senderName: userName,
      text: dmInput,
      timestamp: Date.now(),
      attachment: attachmentObj || undefined,
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
      await push(ref(db, `private_chats/${chatId}/messages`), newMsg);
      // Trigger instant notifications for online presence
      await push(ref(db, `notifications/${activeDmUid}`), {
        title: `Message from ${userName}`,
        message: dmInput || 'Sent an attachment',
        type: 'chat',
        timestamp: Date.now()
      });
    }

    setDmInput('');
    setChatAttachedFile(null);
    setAttachedNote(null);
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';
    setChatUploading(false);
  };

  // Room Invites
  const handleOpenRoomInvite = async () => {
    if (isFirebaseConfigured && db) {
      const snap = await get(ref(db, 'study_rooms'));
      if (snap.exists()) {
        setAvailableRooms(Object.values(snap.val() || {}));
      }
    }
    setShowRoomInviteModal(true);
  };

  const handleSendRoomInvite = async (roomId: string, roomTitle: string) => {
    if (!activeDmUid || !isFirebaseConfigured || !db) return;
    const chatId = currentUid < activeDmUid ? `${currentUid}_${activeDmUid}` : `${activeDmUid}_${currentUid}`;
    
    const newMsg: DirectMessage = {
      id: `msg_${Date.now()}`,
      senderUid: currentUid,
      senderName: userName,
      text: `Invited you to join study room: "${roomTitle}"`,
      timestamp: Date.now(),
      inviteType: 'room',
      inviteId: roomId,
      inviteName: roomTitle
    };

    await push(ref(db, `private_chats/${chatId}/messages`), newMsg);
    setShowRoomInviteModal(false);
  };

  // Group Invites
  const handleOpenGroupInvite = async () => {
    if (isFirebaseConfigured && db) {
      const snap = await get(ref(db, 'community_groups'));
      if (snap.exists()) {
        const allGroups = Object.values(snap.val() || {}).map((g: any) => g.metadata);
        setAvailableGroups(allGroups);
      }
    }
    setShowGroupInviteModal(true);
  };

  const handleSendGroupInvite = async (groupId: string, groupName: string) => {
    if (!activeDmUid || !isFirebaseConfigured || !db) return;
    const chatId = currentUid < activeDmUid ? `${currentUid}_${activeDmUid}` : `${activeDmUid}_${currentUid}`;
    
    const newMsg: DirectMessage = {
      id: `msg_${Date.now()}`,
      senderUid: currentUid,
      senderName: userName,
      text: `Invited you to study group: "${groupName}"`,
      timestamp: Date.now(),
      inviteType: 'group',
      inviteId: groupId,
      inviteName: groupName
    };

    await push(ref(db, `private_chats/${chatId}/messages`), newMsg);
    setShowGroupInviteModal(false);
  };

  // Voice note handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());

        if (!activeDmUid) return;
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

          const chatId = currentUid < activeDmUid ? `${currentUid}_${activeDmUid}` : `${activeDmUid}_${currentUid}`;
          const newMsg: DirectMessage = {
            id: `msg_${Date.now()}`,
            senderUid: currentUid,
            senderName: userName,
            text: 'Sent a voice note',
            timestamp: Date.now(),
            attachment: voiceAttachment
          };

          await push(ref(db, `private_chats/${chatId}/messages`), newMsg);
        } catch (e) {
          console.error(e);
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

  // Shared Notes attachments loading
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
        console.error('Error loading notes:', err);
      }
    }
  };

  const handleOpenNoteSelector = () => {
    loadMyNotes();
    setShowNoteSelector(true);
  };

  const loadMyRoadmaps = async () => {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await get(ref(db, `users/${currentUid}/roadmaps`));
        if (snap.exists()) {
          const val = snap.val();
          const list = Object.entries(val).map(([id, r]: [string, any]) => ({
            id,
            ...r,
            checkpoints: r.checkpoints ? (Array.isArray(r.checkpoints) ? r.checkpoints : Object.values(r.checkpoints)) : []
          }));
          setMyRoadmaps(list);
        } else {
          setMyRoadmaps([]);
        }
      } catch (err) {
        console.error('Error loading roadmaps:', err);
      }
    } else {
      try {
        const list = JSON.parse(localStorage.getItem('roomie_mock_roadmaps') || '[]');
        setMyRoadmaps(list);
      } catch (e) {
        setMyRoadmaps([]);
      }
    }
  };

  const handleOpenRoadmapSelector = () => {
    loadMyRoadmaps();
    setShowRoadmapSelector(true);
  };

  const handleShareRoadmap = async (roadmap: any) => {
    if (!activeDmUid) return;
    const chatId = currentUid < activeDmUid ? `${currentUid}_${activeDmUid}` : `${activeDmUid}_${currentUid}`;
    
    const newMsg: DirectMessage = {
      id: `msg_${Date.now()}`,
      senderUid: currentUid,
      senderName: userName,
      text: `Shared a learning roadmap: "${roadmap.name}"`,
      timestamp: Date.now(),
      roadmapReference: {
        id: roadmap.id,
        name: roadmap.name,
        goal: roadmap.goal,
        targetDate: roadmap.targetDate,
        progress: roadmap.progress,
        type: roadmap.type,
        checkpoints: roadmap.checkpoints || []
      }
    };

    if (isFirebaseConfigured && db) {
      await push(ref(db, `private_chats/${chatId}/messages`), newMsg);
      await push(ref(db, `notifications/${activeDmUid}`), {
        title: `Shared a roadmap from ${userName}`,
        message: `Shared roadmap: ${roadmap.name}`,
        type: 'chat',
        timestamp: Date.now()
      });
    } else {
      const localKey = `roomie_mock_private_chats_${chatId}`;
      const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
      existing.push(newMsg);
      localStorage.setItem(localKey, JSON.stringify(existing));
      setDmMessages(existing);
    }
  };

  const handleImportRoadmap = async (roadmap: any) => {
    if (isGuest) {
      alert("Guest accounts cannot save roadmaps.");
      return;
    }
    const newRoadmapId = `roadmap_${Date.now()}`;
    const importedRoadmap = {
      ...roadmap,
      id: newRoadmapId,
      progress: 0,
      checkpoints: roadmap.checkpoints.map((cp: any, idx: number) => ({
        ...cp,
        id: `cp_imported_${idx}_${Date.now()}`,
        completed: false
      })),
      createdAt: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `users/${currentUid}/roadmaps/${newRoadmapId}`), importedRoadmap);
    } else {
      const list = JSON.parse(localStorage.getItem('roomie_mock_roadmaps') || '[]');
      list.unshift(importedRoadmap);
      localStorage.setItem('roomie_mock_roadmaps', JSON.stringify(list));
    }
    alert(`Success! Imported roadmap "${roadmap.name}" into your curriculum.`);
  };

  // Suggest connections recommendation algorithm
  // Collates points based on profile overlaps: college (3pt), degree (2pt), spec (1pt), interest match (1pt)
  const getSuggestions = () => {
    const activeProfile = profiles.find(p => p.uid === currentUid) || {
      college: '', degree: '', specialization: '', interests: ''
    };
    
    const candidates = profiles.filter(p => p.uid !== currentUid && !myFriends.includes(p.uid) && !myBlocked.includes(p.uid));
    
    const scored = candidates.map(c => {
      let score = 0;
      if (activeProfile.college && c.college === activeProfile.college) score += 3;
      if (activeProfile.degree && c.degree === activeProfile.degree) score += 2;
      if (activeProfile.specialization && c.specialization === activeProfile.specialization) score += 1;
      
      const myInterests = (activeProfile.interests || '').toLowerCase().split(/[\s,]+/);
      const targetInterests = (c.interests || '').toLowerCase().split(/[\s,]+/);
      const intersection = myInterests.filter(i => i && targetInterests.includes(i));
      score += intersection.length;
      
      return { profile: c, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

    return scored.map(item => item.profile);
  };

  // File Download handler
  const handleDownloadFile = async (attachment: any) => {
    if (!attachment) return;
    if (attachment.isNoteRef) {
      const text = `${attachment.noteDetails.title}\n\nSubject: ${attachment.noteDetails.course}\nAuthor: ${attachment.noteDetails.author}\n\n${attachment.noteDetails.content}`;
      const blob = new Blob([text], { type: 'text/plain' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${attachment.noteDetails.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      link.click();
      return;
    }
    await downloadFileHelper(attachment.url, attachment.name);
  };

  // File checkers
  const isImageFile = (name: string) => {
    const ext = name.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');
  };

  const isPdfFile = (name: string) => name.toLowerCase().endsWith('.pdf');
  const isDocxFile = (name: string) => name.toLowerCase().endsWith('.docx');
  const isPptxFile = (name: string) => name.toLowerCase().endsWith('.pptx');

  const filteredDiscover = profiles.filter(p => {
    if (myFriends.includes(p.uid) || myBlocked.includes(p.uid)) return false;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCollege = !collegeFilter || (p.college && p.college.toLowerCase().includes(collegeFilter.toLowerCase()));
    const matchesDegree = !degreeFilter || (p.degree && p.degree.toLowerCase().includes(degreeFilter.toLowerCase()));
    return matchesSearch && matchesCollege && matchesDegree;
  });

  const friendsList = profiles.filter(p => myFriends.includes(p.uid));
  const blockedList = profiles.filter(p => myBlocked.includes(p.uid));
  const pendingRequests = requests.filter(r => r.receiverUid === currentUid && r.status === 'pending');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: activeDmUid ? '320px 1fr' : '1fr', gap: '1.25rem', height: 'calc(100vh - 180px)', minHeight: '500px' }}>
      
      {/* LEFT COLUMN: List & Directory Tabs */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
        
        {/* Navigation Tabs Header */}
        <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.5rem' }}>
          {(['discover', 'requests', 'my-friends', 'suggested', 'blocked'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setActiveDmUid(null); }}
              className="cyber-btn"
              style={{
                fontSize: '0.65rem',
                padding: '0.3rem 0.5rem',
                background: activeTab === tab && !activeDmUid ? 'var(--accent-purple)' : 'none',
                color: activeTab === tab && !activeDmUid ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '8px'
              }}
            >
              {tab === 'discover' ? 'DISCOVER' : tab === 'requests' ? `REQUESTS (${pendingRequests.length})` : tab === 'my-friends' ? 'FRIENDS' : tab === 'suggested' ? 'SUGGESTED' : 'BLOCKED'}
            </button>
          ))}
        </div>

        {/* Tab Content Directory */}
        {!activeDmUid && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
            
            {/* Discover Tab Search Filters */}
            {activeTab === 'discover' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1.5px solid #000', paddingBottom: '0.8rem' }}>
                <input
                  type="text"
                  className="cyber-input"
                  placeholder="Search students directory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <input
                    type="text"
                    className="cyber-input"
                    placeholder="Filter College..."
                    value={collegeFilter}
                    onChange={(e) => setCollegeFilter(e.target.value)}
                  />
                  <input
                    type="text"
                    className="cyber-input"
                    placeholder="Filter Degree..."
                    value={degreeFilter}
                    onChange={(e) => setDegreeFilter(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* List items mapping */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
              {activeTab === 'discover' && filteredDiscover.map(p => {
                const reqSent = requests.some(r => r.senderUid === currentUid && r.receiverUid === p.uid && r.status === 'pending');
                return (
                  <div key={p.uid} style={{ border: '1px solid var(--outline-thick)', borderRadius: '10px', padding: '0.6rem', background: '#fff', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-purple)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      {p.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <strong style={{ fontSize: '0.8rem', display: 'block' }}>{p.name}</strong>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{p.college || 'No college'} | {p.degree || 'No major'}</span>
                    </div>
                    <button
                      onClick={() => handleSendFriendRequest(p.uid)}
                      disabled={reqSent}
                      className="cyber-btn cyan-fill"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}
                    >
                      {reqSent ? 'Pending' : 'Connect'}
                    </button>
                  </div>
                );
              })}

              {activeTab === 'my-friends' && friendsList.map(p => (
                <div key={p.uid} style={{ border: '1px solid var(--outline-thick)', borderRadius: '10px', padding: '0.6rem', background: '#fff', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary-light)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                    {p.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block' }}>{p.name}</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Online & Active</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.2rem' }}>
                    <button
                      onClick={() => setActiveDmUid(p.uid)}
                      className="cyber-btn cyan-fill"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}
                    >
                      DM
                    </button>
                    <button
                      onClick={() => handleRemoveFriend(p.uid)}
                      className="cyber-btn"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', background: '#fee2e2', color: '#dc2626' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {activeTab === 'requests' && pendingRequests.map(r => (
                <div key={r.id} style={{ border: '1px solid var(--outline-thick)', borderRadius: '10px', padding: '0.6rem', background: '#fff', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block' }}>{r.senderName}</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Connection invite</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.2rem' }}>
                    <button onClick={() => handleResolveRequest(r.id, 'accepted')} className="cyber-btn cyan-fill" style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}>Accept</button>
                    <button onClick={() => handleResolveRequest(r.id, 'rejected')} className="cyber-btn" style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', background: '#fee2e2' }}>Decline</button>
                  </div>
                </div>
              ))}

              {activeTab === 'suggested' && getSuggestions().map(p => (
                <div key={p.uid} style={{ border: '1px solid var(--outline-thick)', borderRadius: '10px', padding: '0.6rem', background: '#fffcf0', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block' }}>{p.name} (Suggested)</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Matching Major / Campus overlaps</span>
                  </div>
                  <button onClick={() => handleSendFriendRequest(p.uid)} className="cyber-btn cyan-fill" style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}>Connect</button>
                </div>
              ))}

              {activeTab === 'blocked' && blockedList.map(p => (
                <div key={p.uid} style={{ border: '1px solid var(--outline-thick)', borderRadius: '10px', padding: '0.6rem', background: '#fff', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block' }}>{p.name}</strong>
                  </div>
                  <button onClick={() => handleToggleBlock(p.uid, true)} className="cyber-btn cyan-fill" style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}>Unblock</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DM Conversations Sidebar (When activeDmUid is present) */}
        {activeDmUid && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
            <div style={{ borderBottom: '1.5px solid #000', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.85rem' }}>Conversations</strong>
              <button onClick={() => setActiveDmUid(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}><ChevronLeft size={14} /> Back</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {friendsList.map(p => (
                <div
                  key={p.uid}
                  onClick={() => setActiveDmUid(p.uid)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: activeDmUid === p.uid ? 'var(--accent-primary-light)' : 'transparent',
                    border: activeDmUid === p.uid ? '1.5px solid var(--accent-purple)' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: DM Panel Workspace */}
      {activeDmUid ? (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
          
          {/* DM Chat Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-green)' }} />
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem' }}>
                {profiles.find(p => p.uid === activeDmUid)?.name}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button onClick={handleOpenRoomInvite} className="cyber-btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Room Invite</button>
              <button onClick={handleOpenGroupInvite} className="cyber-btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Group Invite</button>
              <button onClick={() => handleToggleBlock(activeDmUid, false)} className="cyber-btn pink-fill" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: '#dc2626' }}>Block</button>
            </div>
          </div>

          {/* DM Message Feed */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: '#f8fafc', border: '1px solid var(--outline-medium)', borderRadius: '16px' }}>
            {dmMessages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No messages here yet. Say hello to your classmate!
              </div>
            ) : (
              dmMessages.map(msg => {
                const isMe = msg.senderUid === currentUid;
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%', gap: '1px', textAlign: 'left' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                      {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div style={{
                      background: isMe ? 'var(--accent-primary)' : '#ffffff',
                      color: isMe ? '#ffffff' : 'var(--text-primary)',
                      border: isMe ? 'none' : '1px solid var(--outline-thick)',
                      borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.85rem',
                      boxShadow: 'var(--shadow-flat-sm)',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem'
                    }}>
                      {msg.text && <div>{msg.text}</div>}
                      
                      {/* Note Attachment Render */}
                      {msg.noteReference && (
                        <div 
                          onClick={() => {
                            setPreviewAttachment({
                              name: msg.noteReference!.title + " (Shared Note)",
                              url: msg.noteReference!.pdfAttachment?.url || '',
                              isNoteRef: true,
                              noteDetails: msg.noteReference
                            });
                          }}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '6px',
                            background: isMe ? 'rgba(255,255,255,0.15)' : '#fffcf0',
                            border: isMe ? '1px solid rgba(255,255,255,0.3)' : '1.5px solid #000',
                            cursor: 'pointer',
                            marginTop: '0.2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 800 }}>
                            <FileText size={14} />
                            <span style={{ fontSize: '0.78rem' }}>{msg.noteReference.title}</span>
                          </div>
                          <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Subject: {msg.noteReference.course}</span>
                        </div>
                      )}

                      {/* Roadmap Reference Render */}
                      {msg.roadmapReference && (
                        <div 
                          style={{
                            padding: '0.6rem',
                            borderRadius: '12px',
                            background: isMe ? 'rgba(255,255,255,0.15)' : '#fef3c7',
                            border: isMe ? '1px solid rgba(255,255,255,0.3)' : '2px solid #0f172a',
                            marginTop: '0.2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            color: isMe ? '#ffffff' : '#0f172a',
                            boxShadow: isMe ? 'none' : '3px 3px 0px #0f172a'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 800 }}>
                            <Map size={14} />
                            <span style={{ fontSize: '0.78rem' }}>{msg.roadmapReference.name}</span>
                          </div>
                          <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>Goal: {msg.roadmapReference.goal}</span>
                          <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Checkpoints: {msg.roadmapReference.checkpoints?.length || 0}</span>
                          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                            <button
                              onClick={() => setPreviewRoadmap(msg.roadmapReference)}
                              className="cyber-btn"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', flex: 1, color: '#000', background: '#fff' }}
                            >
                              Preview
                            </button>
                            {!isMe && (
                              <button
                                onClick={() => handleImportRoadmap(msg.roadmapReference)}
                                className="cyber-btn pink-fill"
                                style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', flex: 1 }}
                              >
                                Import
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Room/Group Invite triggers */}
                      {msg.inviteType === 'room' && (
                        <div style={{ padding: '0.6rem', background: '#e0f2fe', border: '1.5px solid #0284c7', borderRadius: '8px', marginTop: '0.2rem', color: '#0c4a6e' }}>
                          <strong style={{ display: 'block', fontSize: '0.78rem' }}>Study Room Invite</strong>
                          <span style={{ fontSize: '0.7rem' }}>Join live: {msg.inviteName}</span>
                          <button
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('join-study-room', { detail: { roomId: msg.inviteId, title: msg.inviteName } }));
                              alert(`Navigating to study room: ${msg.inviteName}`);
                            }}
                            className="cyber-btn cyan-fill"
                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', width: '100%', marginTop: '0.35rem' }}
                          >
                            Join Study Room
                          </button>
                        </div>
                      )}

                      {msg.inviteType === 'group' && (
                        <div style={{ padding: '0.6rem', background: '#f0fdf4', border: '1.5px solid #16a34a', borderRadius: '8px', marginTop: '0.2rem', color: '#14532d' }}>
                          <strong style={{ display: 'block', fontSize: '0.78rem' }}>Study Group Invite</strong>
                          <span style={{ fontSize: '0.7rem' }}>Join group workspace: {msg.inviteName}</span>
                          <button
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('join-study-group', { detail: { groupId: msg.inviteId } }));
                              alert(`Navigating to study group workspace: ${msg.inviteName}`);
                            }}
                            className="cyber-btn purple-fill"
                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', width: '100%', marginTop: '0.35rem' }}
                          >
                            Enter Group Workspace
                          </button>
                        </div>
                      )}

                      {/* File attachment rendering */}
                      {msg.attachment && (
                        <div 
                          onClick={() => !msg.attachment?.isVoice && setPreviewAttachment(msg.attachment)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
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
                              <Mic size={14} style={{ color: isMe ? '#fff' : 'var(--text-secondary)' }} />
                              <audio src={msg.attachment.url} controls style={{ height: '30px', width: '170px' }} />
                            </div>
                          ) : (
                            <>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {msg.attachment.name}
                              </span>
                              <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>({msg.attachment.size})</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={dmEndRef} />
          </div>

          {/* DM Chat Controls Toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {chatAttachedFile && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--accent-primary-light)', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--outline-thick)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                  File attachment: {chatAttachedFile.name} ({(chatAttachedFile.size / 1024).toFixed(1)} KB)
                </span>
                <button onClick={() => { setChatAttachedFile(null); if (chatFileInputRef.current) chatFileInputRef.current.value = ''; }} style={{ background: 'none', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Remove</button>
              </div>
            )}
            
            {attachedNote && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-green)' }}>
                  Note Card attachment: {attachedNote.title}
                </span>
                <button onClick={() => setAttachedNote(null)} style={{ background: 'none', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Remove</button>
              </div>
            )}
            
            {chatUploadError && <span style={{ fontSize: '0.7rem', color: 'var(--accent-pink)', fontWeight: 600 }}>{chatUploadError}</span>}

            <form onSubmit={handleSendDm} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                className="cyber-btn"
                style={{ padding: '0.5rem', minHeight: '38px', minWidth: '38px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                disabled={isRecording || chatUploading}
              >
                <Paperclip size={16} />
              </button>
              <input
                type="file"
                ref={chatFileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleChatFileSelection}
              />
              <button
                type="button"
                onClick={handleOpenNoteSelector}
                className="cyber-btn"
                style={{ padding: '0.5rem', minHeight: '38px', minWidth: '38px', borderRadius: '10px', background: '#f0fdf4', color: 'var(--accent-green)', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                disabled={isRecording || chatUploading}
              >
                <FileText size={16} />
              </button>

              <button
                type="button"
                onClick={handleOpenRoadmapSelector}
                className="cyber-btn"
                style={{ padding: '0.5rem', minHeight: '38px', minWidth: '38px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                disabled={isRecording || chatUploading}
              >
                <Map size={16} />
              </button>

              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="cyber-btn"
                  style={{ padding: '0.5rem', minHeight: '38px', minWidth: '38px', borderRadius: '10px', background: '#ffe4e6', color: 'var(--accent-pink)', border: '1px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  disabled={chatUploading}
                >
                  <Mic size={16} />
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', background: '#ffe4e6', border: '1px solid #fecdd3', borderRadius: '10px', padding: '0.2rem 0.5rem', height: '38px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-pink)', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-pink)' }}>{formatDuration(recordingDuration)}</span>
                  <button type="button" onClick={stopRecording} style={{ background: 'var(--accent-green)', color: '#fff', border: 'none', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 700 }}>Send</button>
                  <button type="button" onClick={() => setIsRecording(false)} style={{ background: 'var(--accent-pink)', color: '#fff', border: 'none', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                </div>
              )}

              {!isRecording && (
                <>
                  <input
                    type="text"
                    className="cyber-input"
                    placeholder="Type private message..."
                    value={dmInput}
                    onChange={(e) => setDmInput(e.target.value)}
                    disabled={chatUploading}
                  />
                  <button type="submit" disabled={chatUploading} className="cyber-btn purple-fill" style={{ minHeight: '38px', padding: '0.4rem 1rem' }}>
                    {chatUploading ? '...' : 'Send'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
          <Users size={48} style={{ color: 'var(--text-muted)' }} />
          <span>Select a friend to begin private direct messaging (DMs) or search classmates in the Discover tab.</span>
        </div>
      )}

      {/* ROOM INVITE MODAL */}
      {showRoomInviteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowRoomInviteModal(false)}>
          <div className="glass-panel anim-pop" style={{ maxWidth: '400px', width: '100%', background: '#fff', border: '2px solid #000', borderRadius: '16px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <strong style={{ display: 'block', borderBottom: '1.5px solid #000', paddingBottom: '0.5rem', marginBottom: '0.8rem' }}>Invite to Study Room</strong>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {availableRooms.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No active study rooms. Go to Study Rooms tab to start one!</span>
              ) : (
                availableRooms.map(r => (
                  <div key={r.id} onClick={() => handleSendRoomInvite(r.id, r.title)} style={{ padding: '0.5rem', background: '#f8fafc', border: '1px solid var(--outline-medium)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                    {r.title} ({r.topic})
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* GROUP INVITE MODAL */}
      {showGroupInviteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowGroupInviteModal(false)}>
          <div className="glass-panel anim-pop" style={{ maxWidth: '400px', width: '100%', background: '#fff', border: '2px solid #000', borderRadius: '16px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <strong style={{ display: 'block', borderBottom: '1.5px solid #000', paddingBottom: '0.5rem', marginBottom: '0.8rem' }}>Invite to Study Group</strong>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {availableGroups.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No study groups joined. Go to Groups tab to create one!</span>
              ) : (
                availableGroups.map(g => (
                  <div key={g.id} onClick={() => handleSendGroupInvite(g.id, g.name)} style={{ padding: '0.5rem', background: '#f8fafc', border: '1px solid var(--outline-medium)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                    {g.name}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* NOTE SELECTOR MODAL FOR DMs */}
      {showNoteSelector && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowNoteSelector(false)}>
          <div className="glass-panel anim-pop" style={{ maxWidth: '400px', width: '100%', background: '#fff', border: '2px solid #000', borderRadius: '16px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <strong style={{ display: 'block', borderBottom: '1.5px solid #000', paddingBottom: '0.5rem', marginBottom: '0.8rem' }}>Attach Note Card to DM</strong>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {myNotes.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>You haven't uploaded any shared notes yet.</span>
              ) : (
                myNotes.map(n => (
                  <div key={n.id} onClick={() => { setAttachedNote(n); setShowNoteSelector(false); }} style={{ padding: '0.5rem', background: '#f8fafc', border: '1px solid var(--outline-medium)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                    {n.title} ({n.course})
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* INLINE ATTACHMENT PREVIEW MODAL */}
      {previewAttachment && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.4)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setPreviewAttachment(null)}>
          <div className="glass-panel anim-pop" style={{ maxWidth: '550px', width: '100%', background: '#fff', border: '2px solid #000', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-medium)', paddingBottom: '0.5rem' }}>
              <strong style={{ fontSize: '1rem' }}>Attachment Details</strong>
              <button onClick={() => setPreviewAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 800 }}>Close</button>
            </div>
            
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--outline-medium)', textAlign: 'left' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>{previewAttachment.name}</span>
              {previewAttachment.size && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Size: {previewAttachment.size}</span>}
            </div>

            <div style={{ width: '100%', height: '240px', background: '#f1f5f9', borderRadius: '8px', border: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {previewAttachment.isNoteRef ? (
                <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#fff', padding: '1rem', fontSize: '0.8rem', textAlign: 'left', color: '#000' }}>
                  <h4 style={{ borderBottom: '2px solid #000', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontWeight: 800 }}>{previewAttachment.noteDetails.title}</h4>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{previewAttachment.noteDetails.content}</p>
                </div>
              ) : isImageFile(previewAttachment.name) ? (
                <img src={previewDataUrl || ''} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : isPdfFile(previewAttachment.name) ? (
                <iframe src={previewDataUrl || ''} title="PDF Frame" style={{ width: '100%', height: '100%', border: 'none' }} />
              ) : isDocxFile(previewAttachment.name) ? (
                <DocxPreview fileName={previewAttachment.name} />
              ) : isPptxFile(previewAttachment.name) ? (
                <PptxPreview fileName={previewAttachment.name} />
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem' }}>
                  No preview available. Click Download to open.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {previewAttachment.isNoteRef && previewAttachment.noteDetails.pdfAttachment && (
                <button onClick={() => handleDownloadFile(previewAttachment.noteDetails.pdfAttachment)} className="cyber-btn purple-fill" style={{ padding: '0.4rem 1rem' }}>Download Attached File</button>
              )}
              <button onClick={() => handleDownloadFile(previewAttachment)} className="cyber-btn cyan-fill" style={{ padding: '0.4rem 1rem' }}>
                {previewAttachment.isNoteRef ? 'Download Note Text' : 'Download File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROADMAP SELECTOR MODAL FOR DMs */}
      {showRoadmapSelector && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowRoadmapSelector(false)}>
          <div className="glass-panel anim-pop" style={{ maxWidth: '400px', width: '100%', background: '#fff', border: '2px solid #000', borderRadius: '16px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000', paddingBottom: '0.5rem', marginBottom: '0.8rem' }}>
              <strong style={{ fontSize: '1rem' }}>Share Roadmap to DM</strong>
              <button onClick={() => setShowRoadmapSelector(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><X size={16} /></button>
            </div>
            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {myRoadmaps.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>You don't have any active roadmaps yet. Go to Learning Roadmaps tab to create one!</span>
              ) : (
                myRoadmaps.map(r => (
                  <div 
                    key={r.id} 
                    onClick={() => { handleShareRoadmap(r); setShowRoadmapSelector(false); }} 
                    style={{ padding: '0.6rem', background: '#fef3c7', border: '2px solid #0f172a', borderRadius: '12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 800, display: 'flex', flexDirection: 'column', gap: '2px', boxShadow: '2px 2px 0px #0f172a' }}
                  >
                    <span>{r.name}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Goal: {r.goal}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ROADMAP PREVIEW MODAL */}
      {previewRoadmap && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setPreviewRoadmap(null)}>
          <div className="glass-panel anim-pop" style={{ maxWidth: '500px', width: '100%', background: '#fff', border: '2px solid #000', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000', paddingBottom: '0.5rem' }}>
              <strong style={{ fontSize: '1.1rem' }}>Roadmap Curriculum: {previewRoadmap.name}</strong>
              <button onClick={() => setPreviewRoadmap(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><X size={18} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Goal: {previewRoadmap.goal}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Target Date: {previewRoadmap.targetDate}</span>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.2rem' }}>
              {(!previewRoadmap.checkpoints || previewRoadmap.checkpoints.length === 0) ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No checkpoints defined.</span>
              ) : (
                previewRoadmap.checkpoints.map((cp: any, idx: number) => (
                  <div key={idx} style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', border: '1.5px solid #0f172a', borderRadius: '10px', textAlign: 'left' }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block' }}>{cp.title}</strong>
                    {cp.milestone && <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 800 }}>Objective: {cp.milestone}</span>}
                    {cp.tasks && cp.tasks.length > 0 && (
                      <ul style={{ margin: '0.2rem 0 0 0', paddingLeft: '1rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {cp.tasks.map((task: string, tIdx: number) => <li key={tIdx}>{task}</li>)}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setPreviewRoadmap(null)} className="cyber-btn" style={{ padding: '0.4rem 1rem' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Utilities for formatting recording timers
const formatDuration = (sec: number) => {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};
