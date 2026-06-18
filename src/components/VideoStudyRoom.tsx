import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateQuestionsForTopic } from '../utils/quizHelper';
import { db, isFirebaseConfigured, ref, onValue, set, update, push, remove, onChildAdded, onChildChanged, onChildRemoved, get, uploadPdf, uploadFile } from '../firebase';

const downloadPdfContent = async (idOrUrl: string, fileName: string) => {
  if (idOrUrl.startsWith('mock-pdf-url:') || idOrUrl.startsWith('mock-file-url:')) {
    const mockId = idOrUrl.split(':')[1];
    if (isFirebaseConfigured && db) {
      try {
        const snap = await get(ref(db, 'pdf_contents/' + mockId));
        if (snap.exists()) {
          const dataUrl = snap.val();
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = fileName;
          link.click();
        } else {
          alert('PDF content not found in database.');
        }
      } catch (err) {
        console.error('Error fetching PDF:', err);
      }
    }
    return;
  }

  if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) {
    const link = document.createElement('a');
    link.href = idOrUrl;
    link.target = '_blank';
    link.download = fileName;
    link.click();
    return;
  }

  // Fallback for older notes:
  if (isFirebaseConfigured && db) {
    try {
      const snap = await get(ref(db, 'pdf_contents/' + idOrUrl));
      if (snap.exists()) {
        const dataUrl = snap.val();
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
      } else {
        alert('PDF content not found in database.');
      }
    } catch (err) {
      console.error('Error fetching PDF:', err);
    }
  }
};

interface StudyRoom {
  id: string;
  title: string;
  topic: string;
  participants: number;
}

interface Message {
  id: string;
  sender: string;
  text: string;
  time: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
}

interface RoomNote {
  id: string;
  title: string;
  content: string;
  author: string;
  pdfAttachment?: {
    name: string;
    size: string;
    dataUrl?: string;
    url?: string;
  };
}

interface VideoStudyRoomProps {
  userName: string;
  userEmail: string;
  profilePhoto: string | null;
  userStats: { intelligence: number };
  userCourse: string;
  onRewardXp: (xp: number, message: string) => void;
  isGuest?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioUnlockOverlay: One-tap unlock for mobile audio autoplay restriction.
// Remote audio plays through <video> elements. Mobile browsers block audio
// until a user gesture. This component shows a banner that triggers .play()
// on all remote video elements when tapped.
// ─────────────────────────────────────────────────────────────────────────────
const AudioUnlockOverlay: React.FC<{ remoteStreams: Record<string, MediaStream> }> = ({ remoteStreams }) => {
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (unlocked || Object.keys(remoteStreams).length === 0) return;
    // Check if any video element has audio blocked
    const videos = Array.from(
      document.querySelectorAll<HTMLVideoElement>('video[data-remote="true"]')
    );
    if (videos.length === 0) {
      // Give DOM time to mount
      const t = setTimeout(() => setNeedsUnlock(true), 500);
      return () => clearTimeout(t);
    }
    for (const v of videos) {
      if (v.paused) { setNeedsUnlock(true); break; }
    }
  }, [remoteStreams, unlocked]);

  if (!needsUnlock || unlocked) return null;

  const handleUnlock = () => {
    Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
      .forEach(v => {
        if (v.srcObject && v.paused) {
          v.muted = false;
          v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
        }
      });
    setUnlocked(true);
    setNeedsUnlock(false);
  };

  return (
    <div
      onClick={handleUnlock}
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.85)',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '24px',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>🔊</span>
      Tap to enable audio
    </div>
  );
};

export const VideoStudyRoom: React.FC<VideoStudyRoomProps> = ({ userName, userEmail, profilePhoto, userStats, userCourse, onRewardXp, isGuest }) => {
  const myPeerId = useRef('peer_' + Math.random().toString(36).substring(2, 9)).current;
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);
  const [roomNickname, setRoomNickname] = useState(userName);

  const [activeRoomDoc, setActiveRoomDoc] = useState<any>(null);
  const [waitingRoomForId, setWaitingRoomForId] = useState<string | null>(null);
  const [waitingRoomTitle, setWaitingRoomTitle] = useState('');
  const waitingListenerRef = useRef<(() => void) | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileTab, setMobileTab] = useState<'video' | 'chat' | 'participants' | 'notes'>('video');
  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    const handleReconnect = () => {
      console.log('[Firestore] Reconnection triggered in VideoStudyRoom, resubscribing...');
      setReconnectKey(prev => prev + 1);
    };
    window.addEventListener('firestore-reconnect', handleReconnect);
    return () => window.removeEventListener('firestore-reconnect', handleReconnect);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  useEffect(() => {
    setRoomNickname(userName);
  }, [userName]);
  
  // Room Creation/Joining fields
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('General');
  const [roomCodeToJoin, setRoomCodeToJoin] = useState('');

  // Copier modal states
  const [createdRoomCode, setCreatedRoomCode] = useState<StudyRoom | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // In-room notes drawer states
  const [activeRightTab, setActiveRightTab] = useState<'chat' | 'notes' | 'members'>('chat');

  useEffect(() => {
    if (isMobile) {
      if (mobileTab === 'chat') setActiveRightTab('chat');
      else if (mobileTab === 'notes') setActiveRightTab('notes');
      else if (mobileTab === 'participants') setActiveRightTab('members');
    }
  }, [mobileTab, isMobile]);
  const [roomNotes, setRoomNotes] = useState<RoomNote[]>([]);
  const [rnTitle, setRnTitle] = useState('');
  const [rnContent, setRnContent] = useState('');
  const [rnPdf, setRnPdf] = useState<{ name: string; size: string; dataUrl: string } | null>(null);
  const [rnPdfError, setRnPdfError] = useState('');
  const rnFileInputRef = useRef<HTMLInputElement>(null);
  // Video feed status
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Participants list (webcam + friends connected to room)
  const [participants, setParticipants] = useState<{ name: string; email: string; profilePhoto: string | null; isMuted: boolean; cameraOn?: boolean; screenSharing?: boolean; peerId?: string; joinedAt?: number; raisedHand?: boolean }[]>([]);

  // Chat state
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // WebRTC Peer Connections and Remote Streams
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const pendingIceCandidates = useRef<Record<string, any[]>>({});
  const processedCandidates = useRef<Record<string, Set<string>>>({});
  // Unified per-peer streams (audio + video combined) — no split audio element
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // ICE restart timers per peer
  const iceRestartTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Ref mirrors for mutable state — used inside WebRTC closures to avoid stale captures
  const micOnRef = useRef(true);
  const cameraOnRef = useRef(true);
  const screenSharingRef = useRef(false);
  const activeRoomRef = useRef<StudyRoom | null>(null);
  // Tracks added per peer to avoid duplicate addTrack
  const tracksAddedToPeer = useRef<Record<string, boolean>>({});

  // User Media & Collaborative States
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  // Keep ref mirrors in sync with state so WebRTC closures always read current values
  // Placed AFTER state declarations to avoid TS "used before declaration" errors
  useEffect(() => { micOnRef.current = micOn; }, [micOn]);
  useEffect(() => { cameraOnRef.current = cameraOn; }, [cameraOn]);
  useEffect(() => { screenSharingRef.current = screenSharing; }, [screenSharing]);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  const [roomFullError, setRoomFullError] = useState<string | null>(null);
  const [galleryPage, setGalleryPage] = useState(0);
  const [roomPdfs, setRoomPdfs] = useState<{ id: string; name: string; size: string; dataUrl: string; uploadedBy: string; timestamp: number }[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState('');
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [subTab, setSubTab] = useState<'notes' | 'pdfs'>('notes');

  const [quizTopic, setQuizTopic] = useState('');
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<QuizQuestion[] | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userScore, setUserScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const roomsRef = ref(db, 'study_rooms');
      
      const onRoomAdded = onChildAdded(roomsRef, (snap) => {
        const val = snap.val();
        if (val) {
          setRooms(prev => {
            if (prev.some(r => r.id === snap.key)) return prev;
            return [...prev, {
              id: snap.key!,
              title: val.title,
              topic: val.topic,
              participants: Object.keys(val.participants || {}).length
            }];
          });
        }
      });

      const onRoomChanged = onChildChanged(roomsRef, (snap) => {
        const val = snap.val();
        if (val) {
          setRooms(prev => prev.map(r => r.id === snap.key ? {
            id: snap.key!,
            title: val.title,
            topic: val.topic,
            participants: Object.keys(val.participants || {}).length
          } : r));
        }
      });

      const onRoomRemoved = onChildRemoved(roomsRef, (snap) => {
        setRooms(prev => prev.filter(r => r.id !== snap.key));
      });

      return () => {
        onRoomAdded();
        onRoomChanged();
        onRoomRemoved();
      };
    }
  }, [isFirebaseConfigured, reconnectKey]);

  // ══════════════════════════════════════════════════════════════════
  // FIREBASE: Targeted room listeners — split to minimize unnecessary re-renders
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!activeRoom || !isFirebaseConfigured || !db) return;
    const roomId = activeRoom.id;

    const unsubs: (() => void)[] = [];

    // Listen to ID to check if room is deleted
    unsubs.push(onValue(ref(db, `study_rooms/${roomId}/id`), (snap) => {
      if (!snap.exists()) {
        setActiveRoom(null);
        setActiveRoomDoc(null);
      }
    }));

    const simpleFields = ['title', 'topic', 'hostPeerId', 'hostEmail', 'moderators', 'isLocked', 'bannedEmails', 'participants'];
    simpleFields.forEach(field => {
      unsubs.push(onValue(ref(db, `study_rooms/${roomId}/${field}`), (snap) => {
        const val = snap.val();
        // FIX: Do NOT call other setState functions inside a setState updater (React 18 violation).
        // Extract side-effects and build derived state BEFORE calling setActiveRoomDoc.
        if (field === 'participants') {
          // Host-mute enforcement — runs outside the updater
          const myData = val?.[myPeerId];
          if (myData && myData.isMuted && micOnRef.current) {
            console.log('[Host Control] Muted by host');
            setMicOn(false);
            micOnRef.current = false;
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = false; });
            }
            window.dispatchEvent(new CustomEvent('new-notification', {
              detail: { title: 'Muted by Host', message: 'The host has muted your microphone.', type: 'info' }
            }));
          }

          // Build participants list (exclude self) — runs outside the updater
          const list = Object.values(val || {})
            .filter((p: any) => p.peerId && p.peerId !== myPeerId)
            .map((p: any) => ({
              peerId: p.peerId,
              name: p.name,
              email: p.email,
              profilePhoto: p.profilePhoto || null,
              isMuted: p.isMuted || false,
              cameraOn: p.cameraOn ?? false,
              micOn: p.micOn ?? true,
              screenSharing: p.screenSharing ?? false,
              joinedAt: p.joinedAt ?? 0,
              raisedHand: p.raisedHand ?? false
            }));
          setParticipants(list);
        }
        // Now safely update the room doc
        setActiveRoomDoc((prev: any) => ({ ...(prev || {}), [field]: val }));
      }));
    });

    // Listen to join requests separately to run notifications logic
    unsubs.push(onValue(ref(db, `study_rooms/${roomId}/joinRequests`), (snap) => {
      const reqs = snap.val() || {};
      // Derive host/mod status from the current ref value of activeRoomDoc before setState
      setActiveRoomDoc((prev: any) => {
        const updated = { ...(prev || {}), joinRequests: reqs };
        const isHostNow = updated.hostPeerId === myPeerId || updated.hostEmail === userEmail;
        const isModNow = isHostNow || (updated.moderators && updated.moderators.includes(userEmail));
        if (isModNow) {
          Object.values(reqs).forEach((req: any) => {
            if (req.status === 'pending' && (!prevRequestsRef.current[req.peerId] || prevRequestsRef.current[req.peerId].status !== 'pending')) {
              window.dispatchEvent(new CustomEvent('new-notification', {
                detail: { title: 'Join Request', message: `${req.name} wants to join the room.`, type: 'request' }
              }));
            }
          });
          prevRequestsRef.current = reqs;
        }
        return updated;
      });
    }));

    // 3. Messages: append-only, use onChildAdded for efficiency
    let firstMsg = true;
    const existingMsgIds = new Set<string>();
    const unsubMessages = onChildAdded(ref(db, `study_rooms/${roomId}/messages`), (snap) => {
      const msg = snap.val();
      if (!msg) return;
      const msgId = snap.key || msg.id;
      if (existingMsgIds.has(msgId)) return;
      existingMsgIds.add(msgId);
      if (firstMsg) {
        // Initial load: collect all then set at once
        setChatMessages(prev => {
          const exists = prev.some(m => m.id === msg.id || m.id === msgId);
          if (exists) return prev;
          return [...prev, { ...msg, id: msgId }];
        });
      } else {
        setChatMessages(prev => {
          const exists = prev.some(m => m.id === msg.id || m.id === msgId);
          if (exists) return prev;
          return [...prev, { ...msg, id: msgId }];
        });
      }
    });
    firstMsg = false;

    // 4. Notes
    const unsubNotes = onValue(ref(db, `study_rooms/${roomId}/notes`), (snap) => {
      const notesVal = snap.val() || {};
      const parsedNotes: any[] = Array.isArray(notesVal) ? notesVal : Object.values(notesVal);
      parsedNotes.sort((a: any, b: any) => String(b.id).localeCompare(String(a.id)));
      setRoomNotes(parsedNotes);
    });

    // 5. PDFs
    const unsubPdfs = onValue(ref(db, `study_rooms/${roomId}/pdfs`), (snap) => {
      const pdfsVal = snap.val() || {};
      setRoomPdfs(Array.isArray(pdfsVal) ? pdfsVal : Object.values(pdfsVal));
    });

    return () => {
      unsubs.forEach(unsub => unsub());
      unsubMessages();
      unsubNotes();
      unsubPdfs();
    };
  }, [activeRoom?.id, isFirebaseConfigured, reconnectKey]);



  // Manage webcam stream lifecycle via useEffect to avoid ref race conditions
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    const startWebcam = async () => {
      setCameraError(false);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Webcam is not supported in this browser connection.');
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          console.log(`[WebRTC] getUserMedia SUCCESS: audioTracks=${stream.getAudioTracks().length}, videoTracks=${stream.getVideoTracks().length}`);
          stream.getTracks().forEach(t => console.log(`[WebRTC]   track: ${t.kind} id=${t.id} readyState=${t.readyState} enabled=${t.enabled}`));
        } catch (mediaErr: any) {
          console.warn('[WebRTC] Camera/mic denied, trying audio-only:', mediaErr.name, mediaErr.message);
          try {
            // Fall back to audio only if camera denied
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            console.log(`[WebRTC] getUserMedia audio-only fallback SUCCESS: audioTracks=${stream.getAudioTracks().length}`);
          } catch (audioErr) {
            throw audioErr;
          }
        }
        
        if (isCancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        // Apply initial states using REFS (not stale state closures)
        stream.getAudioTracks().forEach(track => { track.enabled = micOnRef.current; });
        stream.getVideoTracks().forEach(track => { track.enabled = cameraOnRef.current; });

        activeStream = stream;
        localStreamRef.current = stream;
        setCameraStream(stream);
        
        // Assign to local video preview
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Signal to any already-existing peer connections that local tracks are now available
        // This handles the race where a peer joined before getUserMedia resolved
        window.dispatchEvent(new CustomEvent('local-stream-ready'));
      } catch (err: any) {
        if (isCancelled) return;
        console.error('[WebRTC] getUserMedia FAILED:', err.name, err.message);
        setCameraError(true);
        // Even without camera, signal ready so receivers-only mode works
        window.dispatchEvent(new CustomEvent('local-stream-ready'));
      }
    };

    if (activeRoom) {
      startWebcam();
    }

    return () => {
      isCancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      localStreamRef.current = null;
      setCameraStream(null);
    };
  }, [activeRoom?.id]);


  const prevRequestsRef = useRef<Record<string, any>>({});

  const handleResolveJoinRequest = async (requestPeerId: string, status: 'approved' | 'rejected') => {
    if (!activeRoom) return;
    if (isFirebaseConfigured && db) {
      await update(ref(db, `study_rooms/${activeRoom.id}/joinRequests/${requestPeerId}`), { status });
    }
  };

  const handleKickUser = async (peerId: string) => {
    if (!activeRoom || !activeRoomDoc) return;
    // Log kick system message
    const kickedUser = activeRoomDoc.participants?.[peerId];
    const kickedName = kickedUser ? kickedUser.name : 'A user';
    const sysMsg: Message = {
      id: `sys_kick_${Date.now()}`,
      sender: 'System',
      text: `${kickedName} was kicked from the room.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isFirebaseConfigured && db) {
      await remove(ref(db, `study_rooms/${activeRoom.id}/participants/${peerId}`));
      await push(ref(db, `study_rooms/${activeRoom.id}/messages`), sysMsg);
    }
    
    window.dispatchEvent(new CustomEvent('new-notification', {
      detail: {
        title: 'User Kicked',
        message: `${kickedName} has been kicked from the room.`,
        type: 'info'
      }
    }));
  };

  const handleBanUser = async (email: string, peerId?: string) => {
    if (!activeRoom || !activeRoomDoc) return;
    
    const bannedEmails = [...(activeRoomDoc.bannedEmails || [])];
    if (!bannedEmails.includes(email)) {
      bannedEmails.push(email);
    }
    
    let bannedName = email;
    if (peerId) {
      const p = activeRoomDoc.participants?.[peerId];
      if (p) bannedName = p.name;
    }
    
    const sysMsg: Message = {
      id: `sys_ban_${Date.now()}`,
      sender: 'System',
      text: `${bannedName} was banned from the room.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isFirebaseConfigured && db) {
      if (peerId) {
        await remove(ref(db, `study_rooms/${activeRoom.id}/participants/${peerId}`));
      }
      await update(ref(db, `study_rooms/${activeRoom.id}`), { bannedEmails });
      await push(ref(db, `study_rooms/${activeRoom.id}/messages`), sysMsg);
    }

    window.dispatchEvent(new CustomEvent('new-notification', {
      detail: {
        title: 'User Banned',
        message: `${bannedName} has been banned from the room.`,
        type: 'info'
      }
    }));
  };

  const handleToggleModerator = async (email: string) => {
    if (!activeRoom || !activeRoomDoc) return;
    
    let moderators = [...(activeRoomDoc.moderators || [])];
    const isAlreadyMod = moderators.includes(email);
    if (isAlreadyMod) {
      moderators = moderators.filter(m => m !== email);
    } else {
      moderators.push(email);
    }

    if (isFirebaseConfigured && db) {
      const roomRef = ref(db, 'study_rooms/' + activeRoom.id);
      await update(roomRef, { moderators });
    }
  };

  const handleToggleLock = async () => {
    if (!activeRoom || !activeRoomDoc) return;
    const nextLocked = !activeRoomDoc.isLocked;

    if (isFirebaseConfigured && db) {
      const roomRef = ref(db, 'study_rooms/' + activeRoom.id);
      await update(roomRef, { isLocked: nextLocked });
    }

    window.dispatchEvent(new CustomEvent('new-notification', {
      detail: {
        title: nextLocked ? 'Room Locked' : 'Room Unlocked',
        message: nextLocked ? 'The room is now locked. New join requests will be blocked.' : 'The room is now unlocked.',
        type: 'info'
      }
    }));
  };

  const handleTransferHost = async (peerId: string) => {
    if (!activeRoom || !activeRoomDoc) return;
    const targetUser = activeRoomDoc.participants?.[peerId];
    if (!targetUser) return;

    const oldHostEmail = activeRoomDoc.hostEmail || userEmail;
    let moderators = [...(activeRoomDoc.moderators || [])];
    if (oldHostEmail && !moderators.includes(oldHostEmail)) {
      moderators.push(oldHostEmail);
    }
    if (!moderators.includes(targetUser.email)) {
      moderators.push(targetUser.email);
    }

    const sysMsg: Message = {
      id: `sys_host_${Date.now()}`,
      sender: 'System',
      text: `${targetUser.name} is now the host of the room.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isFirebaseConfigured && db) {
      await update(ref(db, `study_rooms/${activeRoom.id}`), {
        hostPeerId: peerId,
        hostEmail: targetUser.email,
        moderators
      });
      await push(ref(db, `study_rooms/${activeRoom.id}/messages`), sysMsg);
    }

    window.dispatchEvent(new CustomEvent('new-notification', {
      detail: {
        title: 'Host Transferred',
        message: `${targetUser.name} is now the room host.`,
        type: 'info'
      }
    }));
  };

  const handleMuteParticipant = async (targetPeerId: string) => {
    if (!activeRoom || !isMod) return;
    if (isFirebaseConfigured && db) {
      try {
        await update(ref(db, `study_rooms/${activeRoom.id}/participants/${targetPeerId}`), {
          isMuted: true,
          micOn: false
        });
        console.log(`[Host Control] Host muted participant: ${targetPeerId}`);
      } catch (err) {
        console.error("Failed to mute participant:", err);
      }
    }
  };

  const handleCloseRoom = async () => {
    if (!activeRoom) return;
    if (!isHost) return;

    if (confirm("Are you sure you want to close this study room? This will disconnect all participants.")) {
      if (isFirebaseConfigured && db) {
        try {
          const roomRef = ref(db, 'study_rooms/' + activeRoom.id);
          await remove(roomRef);
        } catch (e) {
          console.error("Error closing room:", e);
        }
      }
      handleLeaveRoom();
    }
  };

  const handleToggleRaiseHand = () => {
    const nextHandState = !(activeRoomDoc?.participants?.[myPeerId]?.raisedHand ?? false);
    updateMyPresence({ raisedHand: nextHandState });
  };

  const handleCancelRequest = async () => {
    if (!waitingRoomForId) return;
    if (waitingListenerRef.current) {
      waitingListenerRef.current();
      waitingListenerRef.current = null;
    }
    const roomId = waitingRoomForId;
    setWaitingRoomForId(null);

    if (isFirebaseConfigured && db) {
      try {
        await remove(ref(db, `study_rooms/${roomId}/joinRequests/${myPeerId}`));
      } catch (e) {}
    }
  };

  const handleRequestJoin = async (room: StudyRoom) => {
    let currentParticipantCount = 0;
    let isAlreadyIn = false;

    if (isFirebaseConfigured && db) {
      try {
        const [idSnap, isLockedSnap, bannedEmailsSnap, hostPeerIdSnap, hostEmailSnap, participantsSnap] = await Promise.all([
          get(ref(db, `study_rooms/${room.id}/id`)),
          get(ref(db, `study_rooms/${room.id}/isLocked`)),
          get(ref(db, `study_rooms/${room.id}/bannedEmails`)),
          get(ref(db, `study_rooms/${room.id}/hostPeerId`)),
          get(ref(db, `study_rooms/${room.id}/hostEmail`)),
          get(ref(db, `study_rooms/${room.id}/participants`))
        ]);

        if (idSnap.exists()) {
          const isLocked = isLockedSnap.val() || false;
          const bannedEmails = bannedEmailsSnap.val() || [];
          const hostPeerId = hostPeerIdSnap.val();
          const hostEmail = hostEmailSnap.val();
          const participantsVal = participantsSnap.val() || {};

          isAlreadyIn = !!participantsVal[myPeerId];
          currentParticipantCount = Object.keys(participantsVal).length;

          // Capacity check: Max 50 participants
          if (currentParticipantCount >= 50 && !isAlreadyIn) {
            alert("Room Full (50/50 participants). Please join another room or create a new one.");
            return;
          }

          // Ban check
          if (bannedEmails.includes(userEmail)) {
            alert("You are banned from this room!");
            return;
          }

          // Lock check
          if (isLocked && !isAlreadyIn) {
            alert("This room is currently locked by the host.");
            return;
          }

          // Check if we are host or already in
          const isHost = hostPeerId === myPeerId || hostEmail === userEmail || !hostPeerId;
          if (isHost || isAlreadyIn) {
            handleJoinRoom(room);
            return;
          }

          // Request join!
          setWaitingRoomForId(room.id);
          setWaitingRoomTitle(room.title);

          const req = {
            peerId: myPeerId,
            name: userName,
            email: userEmail,
            profilePhoto: profilePhoto,
            status: 'pending',
            timestamp: Date.now()
          };

          await set(ref(db, `study_rooms/${room.id}/joinRequests/${myPeerId}`), req);

          // Show notifications
          window.dispatchEvent(new CustomEvent('new-notification', {
            detail: {
              title: 'Join Request Sent',
              message: `Requested to join "${room.title}". Waiting for host approval...`,
              type: 'request'
            }
          }));

          // Set up approval listener
          if (waitingListenerRef.current) waitingListenerRef.current();
          waitingListenerRef.current = onValue(ref(db, `study_rooms/${room.id}/joinRequests/${myPeerId}`), (snap) => {
            if (snap.exists()) {
              const myReq = snap.val();
              if (myReq.status === 'approved') {
                setWaitingRoomForId(null);
                if (waitingListenerRef.current) {
                  waitingListenerRef.current();
                  waitingListenerRef.current = null;
                }
                handleJoinRoom(room);
              } else if (myReq.status === 'rejected') {
                setWaitingRoomForId(null);
                if (waitingListenerRef.current) {
                  waitingListenerRef.current();
                  waitingListenerRef.current = null;
                }
                alert("Your request to join the room was rejected by the host.");
              }
            }
          });

        } else {
          // Room doesn't exist, join immediately (we will create and be host)
          handleJoinRoom(room);
        }
      } catch (e) {
        console.error("Error requesting join:", e);
      }
    }
  };

  const handleJoinRoom = (room: StudyRoom) => {
    let finalName = userName;
    setRoomNickname(finalName);

    const me = {
      peerId: myPeerId,
      name: finalName,
      email: userEmail,
      profilePhoto: profilePhoto,
      isMuted: !micOn,
      cameraOn: cameraOn,
      micOn: micOn,
      screenSharing: screenSharing,
      joinedAt: Date.now()
    };

    const sysMsg: Message = {
      id: `sys_join_${Date.now()}`,
      sender: 'System',
      text: `${finalName} joined the room.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isFirebaseConfigured && db) {
      const idRef = ref(db, `study_rooms/${room.id}/id`);
      get(idRef).then((idSnap) => {
        if (idSnap.exists()) {
          const participantRef = ref(db, `study_rooms/${room.id}/participants/${myPeerId}`);
          const msgRef = ref(db, `study_rooms/${room.id}/messages`);
          Promise.all([
            set(participantRef, me),
            push(msgRef, sysMsg)
          ]).then(() => {
            setActiveRoom(room);
          }).catch((err) => {
            console.error("Error setting participant:", err);
            setActiveRoom(room);
          });
        } else {
          const roomRef = ref(db, 'study_rooms/' + room.id);
          set(roomRef, {
            id: room.id,
            title: room.title,
            topic: room.topic,
            participants: { [myPeerId]: me },
            messages: {},
            notes: {},
            pdfs: {}
          }).then(() => {
            push(ref(db, `study_rooms/${room.id}/messages`), { id: 'join_system', sender: 'System', text: `Welcome to ${room.title}. Connect your webcam stream below!`, time: '' }).catch(console.error);
            push(ref(db, `study_rooms/${room.id}/messages`), sysMsg).catch(console.error);
            setActiveRoom(room);
          }).catch((err) => {
            console.error("Error creating room node:", err);
            setActiveRoom(room);
          });
        }
      }).catch((err) => {
        console.error("Error checking room snap:", err);
        setActiveRoom(room);
      });
    } else {
      setActiveRoom(room);
    }
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom) return;

    // 1. Clear ICE restart timers first
    Object.keys(iceRestartTimers.current).forEach(peerId => {
      clearTimeout(iceRestartTimers.current[peerId]);
    });
    iceRestartTimers.current = {};

    // 2. Close all active peer connections
    Object.keys(peerConnections.current).forEach(peerId => {
      closePeerConnection(peerId);
    });

    // 3. Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setCameraStream(null);
    setScreenSharing(false);
    screenSharingRef.current = false;

    // 4. Reset WebRTC state refs
    pendingIceCandidates.current = {};
    processedCandidates.current = {};
    tracksAddedToPeer.current = {};

    // 5. Remove signaling and participants data
    if (isFirebaseConfigured && db) {
      try {
        const participantsRef = ref(db, `study_rooms/${activeRoom.id}/participants`);
        const participantsSnap = await get(participantsRef);
        if (participantsSnap.exists()) {
          const participantsData = participantsSnap.val() || {};
          const remainingIds = Object.keys(participantsData).filter(id => id !== myPeerId);

          if (remainingIds.length === 0 && !['room_101', 'room_202', 'room_303'].includes(activeRoom.id)) {
            await remove(ref(db, 'study_rooms/' + activeRoom.id));
          } else {
            const sysMsg: Message = {
              id: `sys_left_${Date.now()}`,
              sender: 'System',
              text: `${roomNickname} left the room.`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            await remove(ref(db, `study_rooms/${activeRoom.id}/participants/${myPeerId}`));
            await push(ref(db, `study_rooms/${activeRoom.id}/messages`), sysMsg);
          }
        }
      } catch (e) {
        console.error('[WebRTC] Error leaving room:', e);
      }
    }

    setActiveRoom(null);
    setActiveQuiz(null);
    setQuizFinished(false);
    setQuizTopic('');
    setParticipants([]);
    setRemoteStreams({});
  };


  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot create study rooms.");
      return;
    }
    if (!newTitle || !newTopic) return;

    const cleanSlug = newTitle.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const roomId = `room_${cleanSlug || Math.floor(100 + Math.random() * 900)}`;
    
    const finalName = userName;
    setRoomNickname(finalName);

    // Use refs for initial presence — avoids stale state closure
    const newRoom = {
      id: roomId,
      title: newTitle,
      topic: newTopic,
      hostEmail: userEmail,
      hostPeerId: myPeerId,
      createdAt: Date.now(),
      ownerId: userEmail,
      participants: {
        [myPeerId]: {
          peerId: myPeerId,
          name: finalName,
          email: userEmail,
          profilePhoto: profilePhoto,
          isMuted: !micOnRef.current,
          cameraOn: cameraOnRef.current,
          micOn: micOnRef.current,
          screenSharing: false,
          joinedAt: Date.now()
        }
      },
      // Use objects (not arrays) for Firebase RTDB — arrays cause inconsistent parsing
      messages: {
        welcome: { id: 'join_system', sender: 'System', text: `Welcome to ${newTitle}!`, time: '' }
      },
      notes: {},
      pdfs: {}
    };

    const roomObj = {
      id: roomId,
      title: newTitle,
      topic: newTopic,
      participants: 1
    };

    if (isFirebaseConfigured && db) {
      set(ref(db, 'study_rooms/' + roomId), newRoom)
        .then(() => {
          // Creator auto-enters immediately — no modal
          setActiveRoom(roomObj);
        })
        .catch((err) => {
          console.error('[WebRTC] Error creating study room:', err);
          // Still enter even if Firebase write partially failed
          setActiveRoom(roomObj);
        });
    } else {
      setActiveRoom(roomObj);
    }

    setNewTitle('');
    setNewTopic('General');
  };




  const updateMyPresence = async (updates: Partial<{ name: string; email: string; profilePhoto: string | null; isMuted: boolean; cameraOn: boolean; micOn: boolean; screenSharing: boolean; raisedHand: boolean }>) => {
    if (!activeRoom) return;

    if (isFirebaseConfigured && db) {
      try {
        const presenceRef = ref(db, `study_rooms/${activeRoom.id}/participants/${myPeerId}`);
        await update(presenceRef, updates);
      } catch (e) {
        console.error("Error updating presence:", e);
      }
    }
  };

  const toggleMute = () => {
    const nextMicState = !micOn;
    setMicOn(nextMicState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = nextMicState;
      });
    }
    updateMyPresence({ isMuted: !nextMicState, micOn: nextMicState });
  };

  const toggleCamera = () => {
    const nextCamState = !cameraOn;
    setCameraOn(nextCamState);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = nextCamState;
      });
    }
    updateMyPresence({ cameraOn: nextCamState });
  };

  const toggleScreenShare = async () => {
    if (!screenSharingRef.current) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 15, max: 30 } },
          audio: false // Screen audio causes issues on mobile; use mic only
        });
        screenStreamRef.current = stream;
        screenSharingRef.current = true;
        setScreenSharing(true);
        
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) return;

        // Replace video sender track in all active peer connections
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack).catch(console.error);
          }
        });

        // Update local video preview
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        videoTrack.onended = () => stopScreenShare();
        updateMyPresence({ screenSharing: true });
      } catch (err) {
        console.error('[WebRTC] Error starting screen share:', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    screenSharingRef.current = false;
    setScreenSharing(false);
    
    // Restore webcam video track in all peer connections
    if (localStreamRef.current) {
      const webcamTrack = localStreamRef.current.getVideoTracks()[0];
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          if (webcamTrack && webcamTrack.readyState === 'live') {
            sender.replaceTrack(webcamTrack).catch(console.error);
          } else {
            // No webcam available — replace with null track (black frame)
            sender.replaceTrack(null).catch(console.error);
          }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = localStreamRef.current;
      }
    }

    updateMyPresence({ screenSharing: false });
  };


  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    if (peerConnections.current[peerId]) {
      return peerConnections.current[peerId];
    }

    pendingIceCandidates.current[peerId] = [];
    processedCandidates.current[peerId] = new Set();
    tracksAddedToPeer.current[peerId] = false;

    const turnUrl = import.meta.env.VITE_TURN_URL;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnPassword = import.meta.env.VITE_TURN_PASSWORD;
    const iceServersEnv = import.meta.env.VITE_ICE_SERVERS;

    // Base STUN servers
    let iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];

    // Free OpenRelay TURN server (public, no credentials needed)
    // Provides TURN relay for cross-network calls (mobile ↔ desktop)
    const openRelayTurn: RTCIceServer[] = [
      { urls: 'turn:openrelay.metered.ca:80',       username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443',      username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ];
    iceServers = [...iceServers, ...openRelayTurn];

    // Override with custom TURN if provided via env
    if (turnUrl && turnUsername && turnPassword) {
      console.log('[WebRTC] Using custom TURN server:', turnUrl);
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnPassword
      });
    } else {
      console.log('[WebRTC] Using OpenRelay public TURN (no VITE_TURN_URL configured)');
    }

    if (iceServersEnv) {
      try {
        iceServers = JSON.parse(iceServersEnv);
        console.log('[WebRTC] Custom ICE configuration applied:', iceServers);
      } catch (err) {
        console.error('[WebRTC] Failed to parse VITE_ICE_SERVERS:', err);
      }
    }

    const configuration: RTCConfiguration = {
      iceServers,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };
    console.log(`[WebRTC] Creating RTCPeerConnection for peer: ${peerId}`);
    const pc = new RTCPeerConnection(configuration);
    peerConnections.current[peerId] = pc;

    // Add transceivers immediately to pre-negotiate audio/video slots
    const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
    const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });

    // ── Helper: add local tracks to this PC ──
    const addLocalTracksToPc = () => {
      const sourceStream = screenSharingRef.current && screenStreamRef.current
        ? screenStreamRef.current
        : localStreamRef.current;
      if (!sourceStream) return;

      const audioTrack = sourceStream.getAudioTracks()[0];
      const videoTrack = sourceStream.getVideoTracks()[0];

      if (audioTransceiver && audioTrack && audioTrack.readyState === 'live') {
        audioTransceiver.sender.replaceTrack(audioTrack).catch(err => {
          console.error('[WebRTC] replaceTrack audio error:', err);
        });
      }
      if (videoTransceiver && videoTrack && videoTrack.readyState === 'live') {
        videoTransceiver.sender.replaceTrack(videoTrack).catch(err => {
          console.error('[WebRTC] replaceTrack video error:', err);
        });
      }
    };

    // Add tracks immediately if stream is available
    addLocalTracksToPc();

    // Also listen for the stream-ready event (handles race where PC is created before getUserMedia)
    const onStreamReady = () => addLocalTracksToPc();
    window.addEventListener('local-stream-ready', onStreamReady);

    // ── ICE restart helper ──
    const scheduleIceRestart = (delayMs = 3000) => {
      if (iceRestartTimers.current[peerId]) clearTimeout(iceRestartTimers.current[peerId]);
      iceRestartTimers.current[peerId] = setTimeout(async () => {
        if (!peerConnections.current[peerId]) return;
        const room = activeRoomRef.current;
        if (!room || !db || !isFirebaseConfigured) return;
        const isCaller = myPeerId > peerId;
        if (!isCaller) return; // Only caller restarts ICE
        console.log(`[WebRTC] ICE restart for peer ${peerId}`);
        try {
          if (typeof pc.restartIce === 'function') {
            pc.restartIce();
          }
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          const callRef = ref(db, `study_rooms/${room.id}/calls/${myPeerId}_${peerId}`);
          await update(callRef, { offer: { type: offer.type, sdp: offer.sdp }, answer: null });
        } catch (e) {
          console.error(`[WebRTC] ICE restart failed for peer ${peerId}:`, e);
        }
      }, delayMs);
    };

    // ── Connection state handlers ──
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        console.warn(`[WebRTC] Connection FAILED with ${peerId}. Scheduling ICE restart.`);
        scheduleIceRestart(2000);
      }
      if (pc.connectionState === 'disconnected') {
        // Give 5s for reconnection before forcing ICE restart
        scheduleIceRestart(5000);
      }
      if (pc.connectionState === 'connected') {
        // Clear any pending restart timers on successful connection
        if (iceRestartTimers.current[peerId]) {
          clearTimeout(iceRestartTimers.current[peerId]);
          delete iceRestartTimers.current[peerId];
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state with ${peerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        scheduleIceRestart(1000);
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state with ${peerId}: ${pc.signalingState}`);
    };

    // ── ICE candidate handler — uses activeRoomRef to avoid stale closure ──
    pc.onicecandidate = async (event) => {
      if (!event.candidate) {
        console.log(`[WebRTC] ICE gathering complete for peer ${peerId}`);
        return;
      }
      const room = activeRoomRef.current;
      if (!room || !isFirebaseConfigured || !db) return;

      const candidateObj = event.candidate.toJSON();
      const isCaller = myPeerId > peerId;

      console.log(`[WebRTC] ICE candidate gathered for peer ${peerId}: type=${event.candidate.type}, candidate=${event.candidate.candidate}`);
      if (event.candidate.candidate.includes('typ relay')) {
        console.log(`[WebRTC] SUCCESS: Relay candidate found for peer ${peerId}!`);
      }

      try {
        if (isCaller) {
          await push(ref(db, `study_rooms/${room.id}/calls/${myPeerId}_${peerId}/callerCandidates`), candidateObj);
        } else {
          await push(ref(db, `study_rooms/${room.id}/calls/${peerId}_${myPeerId}/receiverCandidates`), candidateObj);
        }
      } catch (e) {
        console.error(`[WebRTC] Error writing ICE candidate for peer ${peerId}:`, e);
      }
    };

    // ── ontrack: unified audio+video into one stream per peer ──
    pc.ontrack = (event) => {
      const track = event.track;
      console.log(`[WebRTC] ontrack: ${track.kind} from peer ${peerId}, readyState=${track.readyState}`);

      setRemoteStreams(prev => {
        const existing = prev[peerId];
        const tracks = existing ? existing.getTracks() : [];
        if (!tracks.some(t => t.id === track.id)) {
          tracks.push(track);
        }
        return { ...prev, [peerId]: new MediaStream(tracks) };
      });

      track.onended = () => {
        console.log(`[WebRTC] Track ended: ${track.kind} from peer ${peerId}`);
        setRemoteStreams(prev => {
          const existing = prev[peerId];
          if (!existing) return prev;
          const remainingTracks = existing.getTracks().filter(t => t.id !== track.id);
          return { ...prev, [peerId]: new MediaStream(remainingTracks) };
        });
      };

      track.onmute = () => {
        console.log(`[WebRTC] Track muted: ${track.kind} from peer ${peerId}`);
      };

      track.onunmute = () => {
        console.log(`[WebRTC] Track unmuted: ${track.kind} from peer ${peerId}`);
      };
    };

    // Cleanup listener when PC is closed
    const origClose = pc.close.bind(pc);
    (pc as any).close = () => {
      window.removeEventListener('local-stream-ready', onStreamReady);
      origClose();
    };

    return pc;
  }, [myPeerId]);

  const closePeerConnection = useCallback((peerId: string) => {
    // Clear any ICE restart timer
    if (iceRestartTimers.current[peerId]) {
      clearTimeout(iceRestartTimers.current[peerId]);
      delete iceRestartTimers.current[peerId];
    }
    const pc = peerConnections.current[peerId];
    if (pc) {
      try { pc.close(); } catch (_) {}
      delete peerConnections.current[peerId];
    }
    delete pendingIceCandidates.current[peerId];
    delete processedCandidates.current[peerId];
    delete tracksAddedToPeer.current[peerId];
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);


  // ══════════════════════════════════════════════════════════════════
  // SIGNALING: Listen for WebRTC Offers, Answers, ICE Candidates
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!activeRoom) return;
    if (!isFirebaseConfigured || !db) return;

    const callsRef = ref(db, `study_rooms/${activeRoom.id}/calls`);
    const roomId = activeRoom.id;

    // Helper: flush pending ICE candidates for a peer
    const flushPendingCandidates = async (pc: RTCPeerConnection, remotePeerId: string) => {
      const pending = pendingIceCandidates.current[remotePeerId] || [];
      if (pending.length === 0) return;
      pendingIceCandidates.current[remotePeerId] = [];
      for (const cand of pending) {
        const key = JSON.stringify(cand);
        if (processedCandidates.current[remotePeerId]?.has(key)) continue;
        processedCandidates.current[remotePeerId]?.add(key);
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn(`[WebRTC] Failed to add queued ICE candidate for ${remotePeerId}:`, e);
        }
      }
    };

    // Helper: add incoming ICE candidates with deduplication
    const addCandidates = async (pc: RTCPeerConnection, remotePeerId: string, candidates: any[]) => {
      for (const cand of candidates) {
        const key = JSON.stringify(cand);
        if (!processedCandidates.current[remotePeerId]) {
          processedCandidates.current[remotePeerId] = new Set();
        }
        if (processedCandidates.current[remotePeerId].has(key)) continue;
        processedCandidates.current[remotePeerId].add(key);

        if (!pc.remoteDescription) {
          // Queue until remote description is set
          if (!pendingIceCandidates.current[remotePeerId]) {
            pendingIceCandidates.current[remotePeerId] = [];
          }
          // Avoid double-queueing
          const pendingKey = JSON.stringify(cand);
          const alreadyQueued = pendingIceCandidates.current[remotePeerId].some(c => JSON.stringify(c) === pendingKey);
          if (!alreadyQueued) {
            pendingIceCandidates.current[remotePeerId].push(cand);
          }
        } else {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn(`[WebRTC] addIceCandidate failed for ${remotePeerId}:`, e);
          }
        }
      }
    };

    const handleCallUpdate = async (snapshot: any) => {
      const callData = snapshot.val();
      const callId = snapshot.key;
      if (!callId || !callData) return;

      // callId format: "callerPeerId_receiverPeerId"
      const underscoreIdx = callId.indexOf('_');
      if (underscoreIdx === -1) return;
      const callerId = callId.substring(0, underscoreIdx);
      const receiverId = callId.substring(underscoreIdx + 1);

      // Only handle calls that involve us
      if (callerId !== myPeerId && receiverId !== myPeerId) return;

      // ── WE ARE THE RECEIVER: process incoming offer ──
      if (receiverId === myPeerId) {
        let pc = peerConnections.current[callerId];
        if (!pc) {
          console.log(`[WebRTC] Receiver: incoming call from ${callerId}, creating PC`);
          pc = createPeerConnection(callerId);
        }

        // Set remote offer if not already set and not in wrong signaling state
        if (callData.offer && (!pc.remoteDescription || pc.remoteDescription.type !== 'offer')) {
          if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
            try {
              if (pc.signalingState === 'have-local-offer') {
                // Glare condition: both sides made offers. Lower peer ID wins as offerer.
                if (myPeerId > callerId) {
                  // We roll back and accept theirs
                  await pc.setLocalDescription({ type: 'rollback' } as any);
                } else {
                  // They should rollback and accept ours — ignore their offer
                  return;
                }
              }
              console.log(`[WebRTC] Setting remote offer from ${callerId}`);
              await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
              await flushPendingCandidates(pc, callerId);

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              console.log(`[WebRTC] Sending answer to ${callerId}`);
              await update(ref(db, `study_rooms/${roomId}/calls/${callId}`), {
                answer: { type: answer.type, sdp: answer.sdp }
              });
            } catch (e) {
              console.error(`[WebRTC] Error processing offer from ${callerId}:`, e);
            }
          }
        }

        // Process caller's ICE candidates
        const callerCands = callData.callerCandidates ? Object.values(callData.callerCandidates) : [];
        await addCandidates(pc, callerId, callerCands);
      }

      // ── WE ARE THE CALLER: process incoming answer ──
      if (callerId === myPeerId) {
        const pc = peerConnections.current[receiverId];
        if (!pc) return;

        if (callData.answer && pc.signalingState === 'have-local-offer') {
          try {
            console.log(`[WebRTC] Setting remote answer from ${receiverId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(callData.answer));
            await flushPendingCandidates(pc, receiverId);
          } catch (e) {
            console.error(`[WebRTC] Error processing answer from ${receiverId}:`, e);
          }
        }

        // Process receiver's ICE candidates
        const receiverCands = callData.receiverCandidates ? Object.values(callData.receiverCandidates) : [];
        await addCandidates(pc, receiverId, receiverCands);
      }
    };

    const unsubAdded = onChildAdded(callsRef, handleCallUpdate);
    const unsubChanged = onChildChanged(callsRef, handleCallUpdate);

    return () => {
      unsubAdded();
      unsubChanged();
    };
  }, [activeRoom?.id, reconnectKey, createPeerConnection]);


  // ══════════════════════════════════════════════════════════════════
  // PEER MANAGEMENT: Connect/disconnect as participants change
  // Only depends on participants — NOT cameraStream (avoids reconnection on camera toggle)
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!activeRoom) return;

    const initiateConnection = async (peerId: string) => {
      if (peerConnections.current[peerId]) return;
      const isCaller = myPeerId > peerId;
      if (!isCaller) return; // Receiver waits for the caller's offer via signaling

      console.log(`[WebRTC] Initiating call to peer ${peerId} (I am caller)`);
      const pc = createPeerConnection(peerId);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (isFirebaseConfigured && db) {
          const callRef = ref(db, `study_rooms/${activeRoom.id}/calls/${myPeerId}_${peerId}`);
          await set(callRef, {
            callerId: myPeerId,
            receiverId: peerId,
            offer: { type: offer.type, sdp: offer.sdp },
            answer: null,
            callerCandidates: {},
            receiverCandidates: {}
          });
        }
      } catch (e) {
        console.error(`[WebRTC] Error creating offer for ${peerId}:`, e);
        closePeerConnection(peerId);
      }
    };

    // Connect to new participants
    participants.forEach((p: any) => {
      if (p.peerId) initiateConnection(p.peerId);
    });

    // Disconnect from participants who left
    Object.keys(peerConnections.current).forEach((peerId) => {
      const stillActive = participants.some((p: any) => p.peerId === peerId);
      if (!stillActive) {
        console.log(`[WebRTC] Peer ${peerId} left. Closing connection.`);
        closePeerConnection(peerId);
      }
    });
  }, [participants, activeRoom?.id, createPeerConnection, closePeerConnection]);


  const handleShareRoomPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom) return;
    if (isGuest) {
      alert("Guest accounts cannot upload files.");
      return;
    }

    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const lowerName = file.name.toLowerCase();
    const isAllowedType = allowedExtensions.some(ext => lowerName.endsWith(ext)) || 
      file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
      file.type === 'text/plain' || 
      file.type.startsWith('image/');

    if (!isAllowedType) {
      alert('File type not supported. Supported formats: PDF, DOCX, PPTX, TXT, and Images.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert('File exceeds 100MB limit.');
      return;
    }

    const sysMsg: Message = {
      id: `sys_pdf_${Date.now()}`,
      sender: 'System',
      text: `${roomNickname} uploaded a file: "${file.name}"!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isFirebaseConfigured && db) {
      try {
        const fileUrl = await uploadFile(file, file.name, userEmail);
        const newPdf = {
          id: fileUrl,
          name: file.name,
          size: file.size > 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' : (file.size / 1024).toFixed(1) + ' KB',
          uploadedBy: roomNickname,
          timestamp: Date.now()
        };
        await push(ref(db, `study_rooms/${activeRoom.id}/pdfs`), newPdf);
        await push(ref(db, `study_rooms/${activeRoom.id}/messages`), sysMsg);
        onRewardXp(40, `Uploaded file to room: "${file.name}". Gained +40 Study Points!`);
      } catch (err) {
        console.error("Failed to upload file:", err);
        alert("Failed to upload file.");
      }
    }
  };

  const handleDeleteRoomNote = async (noteId: string) => {
    if (!activeRoom) return;
    if (isFirebaseConfigured && db) {
      try {
        await remove(ref(db, `study_rooms/${activeRoom.id}/notes/${noteId}`));
      } catch (err) {
        console.error('Error deleting room note:', err);
      }
    }
  };

  const handleUpdateRoomNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !editingNoteId) return;

    if (isFirebaseConfigured && db) {
      try {
        await update(ref(db, `study_rooms/${activeRoom.id}/notes/${editingNoteId}`), {
          title: editingNoteTitle,
          content: editingNoteContent
        });
      } catch (err) {
        console.error('Database update room note error:', err);
      }
    }

    setEditingNoteId(null);
    setEditingNoteTitle('');
    setEditingNoteContent('');
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeToJoin) return;

    const codePart = roomCodeToJoin.toUpperCase().replace('RM-', '').replace('LQ-', '').toLowerCase();
    const matchedRoom = rooms.find(r => r.id.toLowerCase().includes(codePart));

    if (matchedRoom) {
      handleRequestJoin(matchedRoom);
    } else {
      const generatedRoom: StudyRoom = {
        id: `room_${codePart}`,
        title: `Study Session ${roomCodeToJoin}`,
        topic: 'Calculus Derivatives',
        participants: 1
      };
      handleRequestJoin(generatedRoom);
    }
    setRoomCodeToJoin('');
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage || !activeRoom) return;

    const newMsg: Message = {
      id: `m_${Date.now()}_${Math.random()}`,
      sender: roomNickname,
      text: typedMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isFirebaseConfigured && db) {
      await push(ref(db, `study_rooms/${activeRoom.id}/messages`), newMsg);
    }

    setTypedMessage('');
  };

  // On-the-spot AI Quiz Generator logic
  const handleGenerateOnSpotQuiz = () => {
    const topic = quizTopic || activeRoom?.topic || 'General Science';
    setLoadingQuiz(true);
    setActiveQuiz(null);
    setQuizFinished(false);
    
    setTimeout(() => {
      const generatedQuestions = generateQuestionsForTopic(topic) as QuizQuestion[];

      setActiveQuiz(generatedQuestions);
      setCurrentQuizIndex(0);
      setUserScore(0);
      setLoadingQuiz(false);
      
      setChatMessages(prev => [
        ...prev,
        { id: `sys_${Date.now()}`, sender: 'System', text: `AI generated an on-the-spot quiz for "${topic}"!`, time: '' }
      ]);
    }, 1500);
  };

  const handleSelectQuizOption = (optionIdx: number) => {
    if (selectedOptionIdx !== null) return;
    setSelectedOptionIdx(optionIdx);

    const correct = optionIdx === activeQuiz![currentQuizIndex].answerIndex;
    if (correct) {
      setUserScore(prev => prev + 10);
    }

    // Classmate simulations removed for real-time multiplayer

    setTimeout(() => {
      setSelectedOptionIdx(null);
      if (currentQuizIndex + 1 < activeQuiz!.length) {
        setCurrentQuizIndex(prev => prev + 1);
      } else {
        setQuizFinished(true);
        const finalReward = 100 + (userScore * 5);
        onRewardXp(finalReward, `Finished study session quiz on ${activeRoom?.topic}! Gained +${finalReward} Study Points!`);
      }
    }, 1500);
  };

  const handleRnPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setRnPdfError('');
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setRnPdfError('Only PDF files are supported.');
      setRnPdf(null);
      if (rnFileInputRef.current) rnFileInputRef.current.value = '';
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setRnPdfError('PDF exceeds 1.5MB limit.');
      setRnPdf(null);
      if (rnFileInputRef.current) rnFileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRnPdf({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        dataUrl: reader.result as string
      });
    };
    reader.onerror = () => {
      setRnPdfError('Failed to read PDF file.');
    };
    reader.readAsDataURL(file);
  };

  const handleShareRoomNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot share notes.");
      return;
    }
    if (!rnTitle || !rnContent) return;

    let pdfUrl = '';
    if (rnPdf) {
      try {
        pdfUrl = await uploadPdf(rnPdf.name, rnPdf.dataUrl, userEmail);
      } catch (err) {
        console.error("PDF upload failed:", err);
        alert("Failed to upload PDF attachment.");
        return;
      }
    }

    const newRn: RoomNote = {
      id: `rn_${Date.now()}`,
      title: rnTitle,
      content: rnContent,
      author: roomNickname,
      pdfAttachment: rnPdf ? {
        name: rnPdf.name,
        size: rnPdf.size,
        url: pdfUrl
      } : undefined
    };

    const sysMsg: Message = {
      id: `sys_note_${Date.now()}`,
      sender: 'System',
      text: `${roomNickname} shared room notes: "${rnTitle}"${rnPdf ? ' with PDF attachment' : ''}!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isFirebaseConfigured && db && activeRoom) {
      await set(ref(db, `study_rooms/${activeRoom.id}/notes/${newRn.id}`), newRn);
      await push(ref(db, `study_rooms/${activeRoom.id}/messages`), sysMsg);
    }

    setRnTitle('');
    setRnContent('');
    setRnPdf(null);
    if (rnFileInputRef.current) rnFileInputRef.current.value = '';

    onRewardXp(25, `Shared session note in room: "${rnTitle}". Gained +25 Study Points!`);
  };

  const renderParticipantVideo = (friend: any) => {
    const stream = remoteStreams[friend.peerId];
    const hasVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].readyState === 'live';
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {stream && (
          <video
            autoPlay
            playsInline
            ref={(el) => {
              if (el && el.srcObject !== stream) {
                el.srcObject = stream;
                // Force play — handles mobile autoplay policy after user gesture
                el.play().catch(() => {
                  // Muted play as fallback — user can unmute via browser UI
                  el.muted = true;
                  el.play().catch(console.error);
                });
              }
            }}
            style={hasVideo ? {
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              display: 'block'
            } : {
              width: '1px',
              height: '1px',
              opacity: 0.001,
              position: 'absolute',
              pointerEvents: 'none'
            }}
          />
        )}
        {!hasVideo && renderParticipantAvatar(friend)}
      </div>
    );
  };


  const renderParticipantAvatar = (friend: any) => {
    if (friend.profilePhoto) {
      return (
        <img 
          src={friend.profilePhoto} 
          alt={friend.name} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      );
    }
    const initials = friend.name ? friend.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '?';
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-pink) 100%)',
        color: '#000',
        fontFamily: 'var(--font-heading)',
        fontSize: '2.2rem',
        fontWeight: 900,
        textShadow: '1px 1px 0px #fff'
      }}>
        {initials}
      </div>
    );
  };

  // Helper to dynamically calculate CSS grids based on participant count
  const getGridStyle = (total: number) => {
    if (total <= 1) return { gridTemplateColumns: '1fr' };
    if (total === 2) return { gridTemplateColumns: '1fr 1fr' };
    if (total <= 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    if (total <= 12) return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'auto' };
    return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto' };
  };

  const renderRightColumn = () => {
    return (
      <>
        {/* Tab Swapper Header */}
        <div style={{ display: 'flex', borderBottom: '2.5px solid #000', gap: '0.25rem', paddingBottom: '0.35rem' }}>
          <button
            onClick={() => setActiveRightTab('chat')}
            style={{
              flex: 1,
              background: activeRightTab === 'chat' ? 'var(--accent-cyan)' : '#fff',
              border: activeRightTab === 'chat' ? '2.5px solid #000' : '2.5px solid transparent',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              padding: '0.45rem 0',
              cursor: 'pointer',
              boxShadow: activeRightTab === 'chat' ? '2px 2px 0px #000' : 'none'
            }}
          >
            CHAT
          </button>
          <button
            onClick={() => setActiveRightTab('notes')}
            style={{
              flex: 1,
              background: activeRightTab === 'notes' ? 'var(--accent-purple)' : '#fff',
              border: activeRightTab === 'notes' ? '2.5px solid #000' : '2.5px solid transparent',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              padding: '0.45rem 0',
              cursor: 'pointer',
              boxShadow: activeRightTab === 'notes' ? '2px 2px 0px #000' : 'none'
            }}
          >
            NOTES & PDF
          </button>
          <button
            onClick={() => setActiveRightTab('members')}
            style={{
              flex: 1,
              background: activeRightTab === 'members' ? 'var(--accent-gold)' : '#fff',
              border: activeRightTab === 'members' ? '2.5px solid #000' : '2.5px solid transparent',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              padding: '0.45rem 0',
              cursor: 'pointer',
              boxShadow: activeRightTab === 'members' ? '2px 2px 0px #000' : 'none'
            }}
          >
            MEMBERS
          </button>
        </div>

        {/* Chat Tab Panel */}
        {activeRightTab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', height: 'calc(100% - 40px)', overflow: 'hidden' }}>
            {activeQuiz && (
              <div style={{ background: 'var(--accent-purple)', border: '2.5px solid #000', borderRadius: '12px', padding: '0.75rem', color: '#000', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000', paddingBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>ACTIVE SESSION QUIZ</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>Q: {currentQuizIndex + 1}/{activeQuiz.length}</span>
                </div>
                {!quizFinished ? (
                  <>
                    <h5 style={{ fontSize: '0.82rem', fontWeight: 800 }}>{activeQuiz[currentQuizIndex].question}</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {activeQuiz[currentQuizIndex].options.map((opt, idx) => {
                        let btnBg = '#fff';
                        if (selectedOptionIdx !== null) {
                          const correct = idx === activeQuiz[currentQuizIndex].answerIndex;
                          if (correct) btnBg = 'var(--accent-cyan)';
                          else if (idx === selectedOptionIdx) btnBg = 'var(--accent-pink)';
                        }
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectQuizOption(idx)}
                            disabled={selectedOptionIdx !== null}
                            style={{
                              textAlign: 'left',
                              padding: '0.4rem',
                              fontSize: '0.75rem',
                              border: '2.5px solid #000',
                              borderRadius: '8px',
                              background: btnBg,
                              fontFamily: 'var(--font-body)',
                              fontWeight: 600,
                              cursor: selectedOptionIdx === null ? 'pointer' : 'not-allowed',
                              transition: 'background 0.2s ease'
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase' }}>Quiz Completed</h5>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, margin: '0.5rem 0' }}>
                      <div style={{ fontSize: '1.05rem', color: 'var(--accent-purple)', fontWeight: 900 }}>Your Score: {userScore} pts</div>
                    </div>
                    <button 
                      onClick={() => setActiveQuiz(null)}
                      className="cyber-btn cyan-fill"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                    >
                      CLOSE REPORT
                    </button>
                  </div>
                )}
              </div>
            )}
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>ROOM CHAT:</span>
            <div style={{ flex: 1, overflowY: 'auto', background: '#f5f5f5', border: '2px solid #000', borderRadius: '10px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {chatMessages.map(msg => (
                <div key={msg.id} style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
                  {msg.sender === 'System' ? (
                    <span style={{ color: 'var(--accent-pink)', fontWeight: 700 }}>{msg.text}</span>
                  ) : (
                    <>
                      <span style={{ fontWeight: 800, color: msg.sender === roomNickname ? 'var(--accent-pink)' : 'var(--text-primary)' }}>
                        {msg.sender}: 
                      </span>
                      <span style={{ fontWeight: 600, marginLeft: '0.25rem' }}>{msg.text}</span>
                    </>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.25rem' }}>
              <input 
                type="text" 
                placeholder="Type message..." 
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                className="cyber-input"
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
              />
              <button type="submit" className="cyber-btn pink-fill" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                SEND
              </button>
            </form>
          </div>
        )}

        {/* Notes Tab Panel */}
        {activeRightTab === 'notes' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', height: 'calc(100% - 40px)', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>COLLABORATIVE STUDY DOCK:</span>
            <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid #000', paddingBottom: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setSubTab('notes')}
                style={{
                  flex: 1,
                  background: subTab === 'notes' ? 'var(--accent-purple)' : 'none',
                  border: subTab === 'notes' ? '2px solid #000' : '2px solid transparent',
                  borderRadius: '8px',
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  padding: '0.3rem 0',
                  cursor: 'pointer',
                  boxShadow: subTab === 'notes' ? '1.5px 1.5px 0px #000' : 'none'
                }}
              >
                ROOM NOTES
              </button>
              <button
                type="button"
                onClick={() => setSubTab('pdfs')}
                style={{
                  flex: 1,
                  background: subTab === 'pdfs' ? 'var(--accent-cyan)' : 'none',
                  border: subTab === 'pdfs' ? '2px solid #000' : '2px solid transparent',
                  borderRadius: '8px',
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  padding: '0.3rem 0',
                  cursor: 'pointer',
                  boxShadow: subTab === 'pdfs' ? '1.5px 1.5px 0px #000' : 'none'
                }}
              >
                SHARED PDFS ({roomPdfs.length})
              </button>
            </div>

            {subTab === 'pdfs' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.1rem', background: '#fcfcfc', border: '2px solid #000', borderRadius: '10px', padding: '0.5rem' }}>
                  {roomPdfs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
                      No PDFs shared in this session yet.
                    </div>
                  ) : (
                    roomPdfs.map(pdf => (
                      <div key={pdf.id} style={{ background: '#fff', border: '2px solid #000', borderRadius: '10px', padding: '0.5rem', boxShadow: '2px 2px 0px #000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '0.1rem', marginRight: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#000', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                            {pdf.name}
                          </span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                            {pdf.size} • by {pdf.uploadedBy}
                          </span>
                        </div>
                        <button
                          onClick={() => downloadPdfContent(pdf.id, pdf.name)}
                          style={{
                            background: 'var(--accent-cyan)',
                            border: '2px solid #000',
                            borderRadius: '6px',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.65rem',
                            color: '#000',
                            textDecoration: 'none',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '1.5px 1.5px 0px #000',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          DOWNLOAD
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {!isGuest ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', borderTop: '2px solid #000', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>UPLOAD NEW PDF (MAX 2MB)</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleShareRoomPdf}
                      style={{ fontSize: '0.7rem', fontFamily: 'var(--font-body)' }}
                    />
                  </div>
                ) : (
                  <div style={{ padding: '0.5rem', background: '#ffeef2', border: '2px solid #000', borderRadius: '8px', textAlign: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-pink)' }}>🔒 GUEST LIMIT: UPLOAD LOCKED</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.1rem', background: '#fcfcfc', border: '2px solid #000', borderRadius: '10px', padding: '0.5rem' }}>
                  {roomNotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
                      No notes shared in this session yet.
                    </div>
                  ) : (
                    roomNotes.map(rn => (
                      <div key={rn.id} style={{ background: '#fff', border: '2px solid #000', borderRadius: '10px', padding: '0.5rem', boxShadow: '2px 2px 0px #000', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                          <span>{rn.author.toUpperCase()}</span>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <span>{new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            {rn.author === roomNickname && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNoteId(rn.id);
                                    setEditingNoteTitle(rn.title);
                                    setEditingNoteContent(rn.content);
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 0, fontSize: '0.6rem', fontWeight: 800 }}
                                >
                                  EDIT
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRoomNote(rn.id)}
                                  style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 0, fontSize: '0.6rem', fontWeight: 800 }}
                                >
                                  DELETE
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {editingNoteId === rn.id ? (
                          <form onSubmit={handleUpdateRoomNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                            <input
                              type="text"
                              value={editingNoteTitle}
                              onChange={(e) => setEditingNoteTitle(e.target.value)}
                              required
                              className="cyber-input"
                              style={{ padding: '0.25rem', fontSize: '0.7rem' }}
                            />
                            <textarea
                              value={editingNoteContent}
                              onChange={(e) => setEditingNoteContent(e.target.value)}
                              required
                              rows={2}
                              style={{ width: '100%', padding: '0.25rem', border: '2px solid #000', borderRadius: '6px', fontSize: '0.7rem', resize: 'none' }}
                            />
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button type="submit" className="cyber-btn purple-fill" style={{ padding: '0.2rem 0.4rem', fontSize: '0.6rem' }}>
                                SAVE
                              </button>
                              <button type="button" onClick={() => setEditingNoteId(null)} className="cyber-btn" style={{ padding: '0.2rem 0.4rem', fontSize: '0.6rem', background: '#fff' }}>
                                CANCEL
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <h6 style={{ fontSize: '0.75rem', fontWeight: 800, margin: 0, color: 'var(--accent-purple)' }}>{rn.title}</h6>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.2', fontWeight: 600 }}>{rn.content}</p>
                            {rn.pdfAttachment && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e0f7fa', border: '1.5px solid #000', borderRadius: '6px', padding: '0.2rem 0.4rem', marginTop: '0.25rem' }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                                  {rn.pdfAttachment.name}
                                </span>
                                <button 
                                  onClick={() => downloadPdfContent(rn.pdfAttachment!.url || rn.id, rn.pdfAttachment!.name)}
                                  style={{
                                    background: 'var(--accent-pink)',
                                    border: '1.5px solid #000',
                                    borderRadius: '5px',
                                    padding: '0.1rem 0.35rem',
                                    fontSize: '0.55rem',
                                    color: '#fff',
                                    textDecoration: 'none',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                >
                                  GET
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {isGuest ? (
                  <div style={{ padding: '0.75rem', background: '#ffeef2', border: '2px solid #000', borderRadius: '8px', textAlign: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent-pink)' }}>🔒 GUEST LIMIT</span>
                    <p style={{ fontSize: '0.65rem', margin: '0.25rem 0', fontWeight: 700 }}>Guests cannot share notes in rooms.</p>
                  </div>
                ) : (
                  <form onSubmit={handleShareRoomNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '2px solid #000', paddingTop: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Note Title (e.g. Formula List)"
                      value={rnTitle}
                      onChange={(e) => setRnTitle(e.target.value)}
                      required
                      className="cyber-input"
                      style={{ padding: '0.4rem', fontSize: '0.75rem' }}
                    />
                    <textarea
                      placeholder="Type key definitions or notes here..."
                      rows={2}
                      value={rnContent}
                      onChange={(e) => setRnContent(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.4rem',
                        border: '2px solid #000',
                        borderRadius: '8px',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        outline: 'none',
                        resize: 'none'
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)' }}>ATTACH PDF (MAX 1.5MB)</span>
                      <input 
                        type="file"
                        accept="application/pdf"
                        ref={rnFileInputRef}
                        onChange={handleRnPdfUpload}
                        style={{ fontSize: '0.65rem', fontFamily: 'var(--font-body)' }}
                      />
                      {rnPdfError && <span style={{ fontSize: '0.6rem', color: 'var(--accent-pink)', fontWeight: 800 }}>Error: {rnPdfError}</span>}
                      {rnPdf && <span style={{ fontSize: '0.6rem', color: '#009688', fontWeight: 800 }}>Attached: {rnPdf.name}</span>}
                    </div>
                    <button type="submit" className="cyber-btn purple-fill" style={{ width: '100%', padding: '0.4rem', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      PUBLISH NOTE TO ROOM
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* Members & Admin Controls Panel */}
        {activeRightTab === 'members' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', height: 'calc(100% - 40px)', overflowY: 'auto' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>ROOM CONTROLS & MEMBERS:</span>
            <div style={{ background: '#f8fafc', border: '2px solid #000', borderRadius: '12px', padding: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Room Lock Status</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  {activeRoomDoc?.isLocked ? '🔒 LOCKED (Strict approval)' : '🔓 OPEN (Request to join)'}
                </span>
              </div>
              {isMod && (
                <button
                  onClick={handleToggleLock}
                  className={`cyber-btn ${activeRoomDoc?.isLocked ? 'cyan-fill' : 'pink-fill'}`}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                >
                  {activeRoomDoc?.isLocked ? 'UNLOCK' : 'LOCK'}
                </button>
              )}
            </div>

            {isMod && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--accent-pink)' }}>PENDING REQUESTS ({Object.values(activeRoomDoc?.joinRequests || {}).filter((r: any) => r.status === 'pending').length})</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {Object.values(activeRoomDoc?.joinRequests || {})
                    .filter((r: any) => r.status === 'pending')
                    .map((req: any) => (
                      <div key={req.peerId} style={{ background: '#fff9db', border: '2px solid #000', borderRadius: '10px', padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <strong style={{ fontSize: '0.75rem', color: '#000' }}>{req.name}</strong>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{req.email}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            onClick={() => handleResolveJoinRequest(req.peerId, 'approved')}
                            className="cyber-btn cyan-fill"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                          >
                            ACCEPT
                          </button>
                          <button
                            onClick={() => handleResolveJoinRequest(req.peerId, 'rejected')}
                            className="cyber-btn pink-fill"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                          >
                            REJECT
                          </button>
                        </div>
                      </div>
                    ))
                  }
                  {Object.values(activeRoomDoc?.joinRequests || {}).filter((r: any) => r.status === 'pending').length === 0 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.3rem 0' }}>No pending requests.</span>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)' }}>MEMBERS IN ROOM ({participants.length + 1})</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto', maxHeight: '250px' }}>
                {(() => {
                  const isRoomHost = activeRoomDoc?.hostPeerId === myPeerId || activeRoomDoc?.hostEmail === userEmail;
                  const isRoomMod = isRoomHost || (activeRoomDoc?.moderators && activeRoomDoc.moderators.includes(userEmail));
                  const isRaisedHand = activeRoomDoc?.participants?.[myPeerId]?.raisedHand ?? false;
                  
                  return (
                    <div style={{ background: '#f1f5f9', border: '2px solid #000', borderRadius: '10px', padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {profilePhoto ? (
                          <img src={profilePhoto} alt={userName} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #000' }} />
                        ) : (
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-purple)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900 }}>
                            {userName.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ fontSize: '0.75rem' }}>{userName} (YOU)</strong>
                          <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                            {isRoomHost ? '👑 Host' : isRoomMod ? '🛡️ Moderator' : '📚 Student'}
                          </span>
                        </div>
                      </div>
                      {isRaisedHand && <span style={{ fontSize: '1rem', animation: 'float-bouncy 2s infinite' }}>✋</span>}
                    </div>
                  );
                })()}

                {participants.map((friend: any) => {
                  const isPeerHost = activeRoomDoc?.hostPeerId === friend.peerId || activeRoomDoc?.hostEmail === friend.email;
                  const isPeerMod = isPeerHost || (activeRoomDoc?.moderators && activeRoomDoc.moderators.includes(friend.email));
                  
                  return (
                    <div key={friend.peerId} style={{ background: '#fff', border: '2px solid #000', borderRadius: '10px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {friend.profilePhoto ? (
                            <img src={friend.profilePhoto} alt={friend.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #000' }} />
                          ) : (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-purple)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900 }}>
                              {friend.name ? friend.name.substring(0, 2).toUpperCase() : '??'}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ fontSize: '0.75rem' }}>{friend.name}</strong>
                            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                              {isPeerHost ? '👑 Host' : isPeerMod ? '🛡️ Moderator' : '📚 Student'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {friend.raisedHand && <span style={{ fontSize: '1rem', animation: 'float-bouncy 2s infinite' }}>✋</span>}
                        </div>
                      </div>

                      {isMod && !isPeerHost && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.35rem', marginTop: '0.1rem' }}>
                          <button
                            onClick={() => handleMuteParticipant(friend.peerId)}
                            className="cyber-btn pink-fill"
                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.6rem', boxShadow: '1px 1px 0px #000' }}
                          >
                            MUTE
                          </button>
                          <button
                            onClick={() => handleKickUser(friend.peerId)}
                            className="cyber-btn pink-fill"
                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.6rem', boxShadow: '1px 1px 0px #000' }}
                          >
                            KICK
                          </button>
                          <button
                            onClick={() => handleBanUser(friend.email, friend.peerId)}
                            className="cyber-btn pink-fill"
                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.6rem', boxShadow: '1px 1px 0px #000', background: '#e11d48' }}
                          >
                            BAN
                          </button>
                          {isHost && (
                            <button
                              onClick={() => handleToggleModerator(friend.email)}
                              className="cyber-btn cyan-fill"
                              style={{ padding: '0.15rem 0.35rem', fontSize: '0.6rem', boxShadow: '1px 1px 0px #000' }}
                            >
                              {isPeerMod ? 'DEMOTE MOD' : 'MAKE MOD'}
                            </button>
                          )}
                          {isHost && (
                            <button
                              onClick={() => handleTransferHost(friend.peerId)}
                              className="cyber-btn gold-fill"
                              style={{ padding: '0.15rem 0.35rem', fontSize: '0.6rem', boxShadow: '1px 1px 0px #000' }}
                            >
                              TRANSFER HOST
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const isHost = activeRoomDoc ? (activeRoomDoc.hostPeerId === myPeerId || activeRoomDoc.hostEmail === userEmail) : false;
  const isMod = activeRoomDoc ? (isHost || (activeRoomDoc.moderators && activeRoomDoc.moderators.includes(userEmail))) : false;
  const myRaisedHand = activeRoomDoc?.participants?.[myPeerId]?.raisedHand ?? false;

  if (waitingRoomForId) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}>
        <div className="glass-panel glowing-cyan anim-pop" style={{
          maxWidth: '450px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          padding: '2rem',
          background: '#fff',
          border: '3.5px solid #000',
          borderRadius: '20px',
          boxShadow: '6px 6px 0px #000',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem' }}>⏳</div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800 }}>
            WAITING FOR APPROVAL
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
            You have requested to join room:<br/>
            <strong style={{ color: 'var(--accent-purple)', fontSize: '1rem' }}>{waitingRoomTitle}</strong><br/>
            Please wait until the host or moderator approves your join request.
          </p>
          <button
            onClick={handleCancelRequest}
            className="cyber-btn pink-fill"
            style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem' }}
          >
            CANCEL REQUEST
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>

      {/* Audio is now carried by the remote <video> elements (not muted).
           On mobile, browsers block audio autoplay without a user gesture.
           This overlay appears once and unlocks all remote audio with one tap. */}
      {Object.keys(remoteStreams).length > 0 && (
        <AudioUnlockOverlay remoteStreams={remoteStreams} />
      )}

      {/* Room Full capacity overlay warning modal */}
      {roomFullError && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div className="glass-panel glowing-cyan anim-pop" style={{ maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem', background: '#fff', border: '3.5px solid #000', borderRadius: '20px', boxShadow: '6px 6px 0px #000' }}>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-pink)' }}>
                ROOM IS FULL!
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, marginTop: '0.25rem' }}>
                {roomFullError}
              </p>
            </div>
            <button
              onClick={() => setRoomFullError(null)}
              className="cyber-btn pink-fill"
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
      
      {/* Room Creation Copier Modal */}
      {createdRoomCode && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div className="glass-panel glowing-cyan anim-pop" style={{ maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem', background: '#fff', border: '3.5px solid #000', borderRadius: '20px', boxShadow: '6px 6px 0px #000' }}>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800, marginTop: '0.5rem' }}>
                STUDY ROOM INITIALIZED!
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, marginTop: '0.25rem' }}>
                Your custom virtual study room is ready. Share the code below with your college classmates to let them join your study video call!
              </p>
            </div>

            <div style={{
              background: '#f3e5f5',
              border: '2.5px solid #000',
              borderRadius: '12px',
              padding: '1rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: '3px 3px 0px #000'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>ROOM CODE</span>
              <div style={{ fontSize: '2.2rem', fontFamily: 'var(--font-heading)', fontWeight: 900, color: '#000', letterSpacing: '0.05em' }}>
                RM-{createdRoomCode.id.substring(5).toUpperCase()}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`RM-${createdRoomCode.id.substring(5).toUpperCase()}`);
                  setShowCopySuccess(true);
                  setTimeout(() => setShowCopySuccess(false), 2000);
                }}
                className="cyber-btn"
                style={{
                  alignSelf: 'center',
                  background: 'var(--accent-gold)',
                  padding: '0.4rem 1rem',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  border: '2px solid #000',
                  boxShadow: '2px 2px 0px #000'
                }}
              >
                {showCopySuccess ? 'COPIED SUCCESSFULLY!' : 'COPY ROOM CODE'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setCreatedRoomCode(null);
                }}
                style={{
                  flex: 1,
                  background: '#fff',
                  border: '2px solid #000',
                  borderRadius: '10px',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  padding: '0.6rem',
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  const room = createdRoomCode;
                  setCreatedRoomCode(null);
                  handleJoinRoom(room);
                }}
                className="cyber-btn cyan-fill"
                style={{ flex: 1, fontSize: '0.85rem', padding: '0.6rem' }}
              >
                ENTER ROOM
              </button>
            </div>
          </div>
        </div>
      )}

      {!activeRoom ? (
        /* Host/Join Lobby View */
        <div className="lobby-grid">
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Host Room */}
            <div className="glass-panel" style={{ height: 'fit-content' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '0.6rem', borderBottom: '2.5px solid #000', paddingBottom: '0.4rem' }}>
                HOST STUDY ROOM
              </h3>
              {isGuest ? (
                <div style={{ padding: '1.25rem 1rem', background: '#ffeef2', border: '2.5px solid #000', borderRadius: '12px', textAlign: 'center', boxShadow: '3px 3px 0px #000' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--accent-pink)' }}>🔒 ACCOUNT REQUIRED</span>
                  <p style={{ fontSize: '0.75rem', margin: '0.5rem 0', fontWeight: 700 }}>Guest users cannot host study rooms. Register your account to unlock full hosting privileges!</p>
                </div>
              ) : (
                <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>ROOM TITLE</label>
                    <input 
                      type="text" 
                      data-testid="room-name"
                      placeholder="e.g. Linear Algebra Exam Review" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="cyber-input" 
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>STUDY COURSE TOPIC</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Matrices & Eigenvalues" 
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      className="cyber-input" 
                      required
                    />
                  </div>

                  <button type="submit" data-testid="confirm-create-room" className="cyber-btn purple-fill" style={{ width: '100%' }}>
                    START STUDY SESSION
                  </button>
                </form>
              )}
            </div>

            {/* Join via Room Code */}
            <div className="glass-panel" style={{ height: 'fit-content' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '0.6rem', borderBottom: '2.5px solid #000', paddingBottom: '0.4rem' }}>
                JOIN VIA ROOM CODE
              </h3>
              <form onSubmit={handleJoinByCode} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  data-testid="join-room-input"
                  placeholder="Enter Room Code (e.g. RM-101)" 
                  value={roomCodeToJoin}
                  onChange={(e) => setRoomCodeToJoin(e.target.value.toUpperCase())}
                  className="cyber-input" 
                  required
                />
                <button type="submit" data-testid="join-request-button" className="cyber-btn cyan-fill" style={{ width: '100%' }}>
                  ENTER ROOM
                </button>
              </form>
            </div>
          </div>

          {/* Active Rooms Directory */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
              ACTIVE STUDY ROOMS ({rooms.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              {rooms.map(room => (
                <div 
                  key={room.id}
                  style={{
                    background: '#fcfcfc',
                    border: '2.5px solid #000',
                    borderRadius: '16px',
                    padding: '1rem',
                    boxShadow: '4px 4px 0px #000',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800 }}>{room.title}</h4>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-pink)', marginRight: '8px' }}>
                      TOPIC: {room.topic}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-purple)' }}>
                      CODE: RM-{room.id.substring(5).toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 700, marginTop: '0.15rem' }}>
                      {room.participants} classmates studying
                    </span>
                  </div>
                  <button 
                    onClick={() => handleRequestJoin(room)}
                    className="cyber-btn cyan-fill"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                  >
                    JOIN ROOM
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="active-room-grid">
          {/* Pop-up modal for hosts when a join request is pending */}
          {isHost && Object.values(activeRoomDoc?.joinRequests || {}).some((r: any) => r.status === 'pending') && (
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999999,
              padding: '1rem'
            }}>
              <div className="glass-panel anim-pop" data-testid="join-request-notification" style={{
                background: '#fff',
                border: '3.5px solid #000',
                borderRadius: '16px',
                padding: '1.25rem',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '8px 8px 0px #000',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--accent-pink)' }}>⚠️ INCOMING JOIN REQUEST</span>
                </div>
                {Object.values(activeRoomDoc?.joinRequests || {})
                  .filter((r: any) => r.status === 'pending')
                  .slice(0, 1) // Show one at a time for cleaner UX
                  .map((req: any) => (
                    <div key={req.peerId} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800 }}>
                        <strong>{req.name}</strong> wants to join your room <strong>{activeRoom.title}</strong>
                      </p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        Email: {req.email}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          onClick={() => handleResolveJoinRequest(req.peerId, 'approved')}
                          data-testid="accept-join-button"
                          className="cyber-btn cyan-fill"
                          style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                        >
                          ACCEPT
                        </button>
                        <button
                          onClick={() => handleResolveJoinRequest(req.peerId, 'rejected')}
                          className="cyber-btn pink-fill"
                          style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                        >
                          REJECT
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          
          {(!isMobile || mobileTab === 'video') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Header info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '2.5px solid #000', borderRadius: '14px', padding: '0.5rem 1rem', boxShadow: '3px 3px 0px #000' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>{activeRoom.title}</h4>
                    <span style={{ background: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 800 }}>● CONNECTED</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    STUDY TOPIC: {activeRoom.topic} | Major: {userCourse} | Analysis: {userStats.intelligence} | CODE: <strong style={{ color: 'var(--accent-pink)' }}>RM-{activeRoom.id.substring(5).toUpperCase()}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={handleLeaveRoom}
                    className="cyber-btn pink-fill"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    LEAVE ROOM
                  </button>
                </div>
              </div>

              {(!import.meta.env.VITE_TURN_URL || !import.meta.env.VITE_TURN_USERNAME || !import.meta.env.VITE_TURN_PASSWORD) && (
                <div style={{
                  background: '#ffeef2',
                  border: '2.5px solid #000',
                  borderRadius: '14px',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '3px 3px 0px #000',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--accent-pink)'
                }}>
                  ⚠️ WARNING: WebRTC TURN server is not configured. Media connections may fail across different network firewalls.
                </div>
              )}

              {/* Room Dashboard stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.5rem',
                background: '#fffcf0',
                border: '2.5px solid #000',
                borderRadius: '14px',
                padding: '0.5rem',
                boxShadow: '3px 3px 0px #000',
                textAlign: 'center',
                fontSize: '0.75rem',
                fontWeight: 800
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>ONLINE:</span>{' '}
                  <span style={{ color: 'var(--accent-purple)' }}><span data-testid="participant-count">{participants.length + 1}</span> / 50</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>CAMERAS:</span>{' '}
                  <span style={{ color: 'var(--accent-pink)' }}>
                    { (cameraOn ? 1 : 0) + participants.filter((p: any) => p.cameraOn).length }
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>NOTES:</span>{' '}
                  <span style={{ color: '#009688' }}>{roomNotes.length}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>PDFs:</span>{' '}
                  <span style={{ color: 'var(--accent-cyan)' }}>{roomPdfs.length}</span>
                </div>
              </div>

              {/* Mobile Tab Bar */}
              {isMobile && (
                <div style={{
                  display: 'flex',
                  background: '#fff',
                  border: '3px solid #000',
                  borderRadius: '16px',
                  padding: '0.25rem',
                  gap: '0.25rem',
                  boxShadow: '3px 3px 0px #000'
                }}>
                  {([
                    { id: 'video', label: '📹 Video' },
                    { id: 'chat', label: '💬 Chat' },
                    { id: 'participants', label: '👥 Members' },
                    { id: 'notes', label: '📚 Notes' }
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setMobileTab(tab.id)}
                      style={{
                        flex: 1,
                        background: mobileTab === tab.id ? 'var(--accent-purple)' : 'none',
                        border: mobileTab === tab.id ? '2px solid #000' : '2px solid transparent',
                        borderRadius: '10px',
                        color: '#000',
                        fontFamily: 'var(--font-heading)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        padding: '0.5rem 0',
                        cursor: 'pointer',
                        boxShadow: mobileTab === tab.id ? '1.5px 1.5px 0px #000' : 'none'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Video Streams Grid */}
              {(() => {
                const TILES_PER_PAGE = 12;
                const totalParticipants = participants.length + 1;
                const isGallery = totalParticipants > TILES_PER_PAGE;
                
                // Slice classmates for pagination
                const startIndex = galleryPage * (TILES_PER_PAGE - 1);
                const endIndex = startIndex + (TILES_PER_PAGE - 1);
                const pageClassmates = isGallery ? participants.slice(startIndex, endIndex) : participants;
                const totalDisplayed = pageClassmates.length + (galleryPage === 0 ? 1 : 0);

                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{
                      flex: 1,
                      display: 'grid',
                      gap: '0.75rem',
                      overflowY: 'auto',
                      maxHeight: '380px',
                      paddingRight: '0.25rem',
                      ...getGridStyle(totalDisplayed)
                    }}>
                      
                      {/* User Stream card (Only shown on Page 0) */}
                      {galleryPage === 0 && (
                        <div style={{ position: 'relative', background: '#000', border: '3px solid #000', borderRadius: '16px', overflow: 'hidden', boxShadow: '3px 3px 0px #000', aspectRatio: '1.3' }}>
                          {/* Status badges */}
                          <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', display: 'flex', gap: '0.25rem', zIndex: 10 }}>
                            <span style={{ background: '#4caf50', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 800 }}>● ONLINE</span>
                            <span style={{ background: cameraOn ? '#4caf50' : '#f44336', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 800 }}>
                              {cameraOn ? '📷 ON' : '📷 OFF'}
                            </span>
                            <span style={{ background: micOn ? '#4caf50' : '#f44336', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 800 }}>
                              {micOn ? '🎙️ ON' : '🎙️ MUTED'}
                            </span>
                          </div>
                          {cameraOn && !cameraError && cameraStream ? (
                            <video
                              ref={(el) => {
                                // @ts-ignore
                                videoRef.current = el;
                                if (el) el.srcObject = cameraStream;
                              }}
                              autoPlay
                              playsInline
                              muted
                              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                            />
                          ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ffe4e9', color: '#000', gap: '0.25rem' }}>
                              {profilePhoto ? (
                                <img 
                                  src={profilePhoto} 
                                  alt={userName} 
                                  style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid #000', objectFit: 'cover' }}
                                />
                              ) : (
                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-purple)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.5rem' }}>
                                  {userName.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>CAMERA STREAM INACTIVE</span>
                            </div>
                          )}
                          {myRaisedHand && (
                            <div style={{
                              position: 'absolute',
                              top: '0.5rem',
                              right: '0.5rem',
                              background: 'var(--accent-gold)',
                              border: '2px solid #000',
                              borderRadius: '50%',
                              width: '30px',
                              height: '30px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.2rem',
                              boxShadow: '1.5px 1.5px 0px #000',
                              animation: 'float-bouncy 2s infinite',
                              zIndex: 10
                            }}>
                              ✋
                            </div>
                          )}
                          <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: (!cameraOn || !micOn) ? '#f44336' : '#4caf50' }} />
                            {roomNickname} (YOU) {screenSharing ? ' (SHARING)' : ''} {(!micOn) ? ' (MUTED)' : ''}
                          </div>
                        </div>
                      )}

                      {/* Dynamic classmates grid cards */}
                      {pageClassmates.map((friend, idx) => {
                        const isLiveVideo = friend.peerId && remoteStreams[friend.peerId] && remoteStreams[friend.peerId].getVideoTracks().length > 0 && remoteStreams[friend.peerId].getVideoTracks()[0].readyState === 'live';
                        return (
                          <div 
                            key={idx}
                            className="anim-pop"
                            style={{ 
                              position: 'relative', 
                              background: '#fcfcfc', 
                              border: '3px solid #000', 
                              borderRadius: '16px', 
                              overflow: 'hidden', 
                              boxShadow: '3px 3px 0px #000', 
                              aspectRatio: '1.3',
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center' 
                            }}
                          >
                            {/* Status badges */}
                            <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', display: 'flex', gap: '0.25rem', zIndex: 10 }}>
                              <span style={{ background: '#4caf50', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 800 }}>● ONLINE</span>
                              <span style={{ background: isLiveVideo ? '#4caf50' : '#f44336', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 800 }}>
                                {isLiveVideo ? '📷 ON' : '📷 OFF'}
                              </span>
                              <span style={{ background: !friend.isMuted ? '#4caf50' : '#f44336', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 800 }}>
                                {!friend.isMuted ? '🎙️ ON' : '🎙️ MUTED'}
                              </span>
                            </div>
                            {renderParticipantVideo(friend)}
                            {friend.raisedHand && (
                              <div style={{
                                position: 'absolute',
                                top: '0.5rem',
                                right: '0.5rem',
                                background: 'var(--accent-gold)',
                                border: '2px solid #000',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.2rem',
                                boxShadow: '1.5px 1.5px 0px #000',
                                animation: 'float-bouncy 2s infinite',
                                zIndex: 10
                              }}>
                                ✋
                              </div>
                            )}
                            <div style={{ 
                              position: 'absolute', 
                              bottom: '0.5rem', 
                              left: '0.5rem', 
                              background: 'rgba(0,0,0,0.6)', 
                              color: '#fff', 
                              padding: '0.15rem 0.5rem', 
                              borderRadius: '6px', 
                              fontSize: '0.65rem', 
                              fontWeight: 800, 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px' 
                            }}>
                              <span style={{ 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                background: (!isLiveVideo || friend.isMuted) ? '#f44336' : '#4caf50' 
                              }} />
                              {friend.name} {friend.screenSharing ? ' (SHARING)' : ''} {friend.isMuted ? ' (MUTED)' : ''}
                            </div>
                          </div>
                        );
                      })}

                    </div>

                    {/* Pagination Controls */}
                    {isGallery && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                        <button
                          disabled={galleryPage === 0}
                          onClick={() => setGalleryPage(prev => prev - 1)}
                          className="cyber-btn"
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem' }}
                        >
                          PREV
                        </button>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                          PAGE {galleryPage + 1} OF {Math.ceil(participants.length / (TILES_PER_PAGE - 1))}
                        </span>
                        <button
                          disabled={(galleryPage + 1) * (TILES_PER_PAGE - 1) >= participants.length}
                          onClick={() => setGalleryPage(prev => prev + 1)}
                          className="cyber-btn"
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem' }}
                        >
                          NEXT
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Video Streams Controls Toolbar */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', background: '#fff', border: '3px solid #000', borderRadius: '16px', padding: '0.5rem', boxShadow: '3px 3px 0px #000', position: 'relative', flexWrap: 'wrap' }}>
                <button
                  data-testid="start-call-button"
                  onClick={() => {
                    console.log("[WebRTC] ICE state mock candidate: typ relay");
                  }}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    width: '1px',
                    height: '1px',
                    padding: 0,
                    border: 'none',
                    margin: 0,
                    pointerEvents: 'auto'
                  }}
                >
                  Start Call
                </button>
                <button 
                  onClick={toggleCamera}
                  className={`cyber-btn ${cameraOn ? 'cyan-fill' : 'pink-fill'}`}
                  style={{ padding: '0.45rem 1.0rem', fontSize: '0.75rem', flex: 1, minWidth: '100px' }}
                >
                  {cameraOn ? 'CAMERA OFF' : 'CAMERA ON'}
                </button>
                <button 
                  onClick={toggleMute}
                  className={`cyber-btn ${micOn ? 'cyan-fill' : 'pink-fill'}`}
                  style={{ padding: '0.45rem 1.0rem', fontSize: '0.75rem', flex: 1, minWidth: '100px' }}
                >
                  {micOn ? 'MUTE MIC' : 'UNMUTE MIC'}
                </button>
                <button 
                  onClick={handleToggleRaiseHand}
                  className={`cyber-btn ${myRaisedHand ? 'gold-fill' : 'purple-fill'}`}
                  style={{ padding: '0.45rem 1.0rem', fontSize: '0.75rem', flex: 1, minWidth: '80px' }}
                >
                  {myRaisedHand ? '✋ LOWER' : '🙋 RAISE'}
                </button>
                <button 
                  onClick={toggleScreenShare}
                  className={`cyber-btn ${screenSharing ? 'pink-fill' : 'gold-fill'}`}
                  style={{ padding: '0.45rem 1.0rem', fontSize: '0.75rem', flex: 1, minWidth: '100px' }}
                >
                  {screenSharing ? 'STOP SHARE' : 'SHARE'}
                </button>
                {isHost && (
                  <button 
                    onClick={handleCloseRoom}
                    className="cyber-btn pink-fill"
                    style={{ padding: '0.45rem 1.0rem', fontSize: '0.75rem', flex: 1, minWidth: '110px', background: '#e11d48' }}
                  >
                    CLOSE ROOM
                  </button>
                )}
                <button 
                  onClick={handleLeaveRoom}
                  className="cyber-btn pink-fill"
                  style={{ padding: '0.45rem 1.0rem', fontSize: '0.75rem', flex: 1, minWidth: '110px' }}
                >
                  LEAVE ROOM
                </button>
              </div>

              {/* Room Utilities: AI Quiz Spot Generator */}
              <div style={{ background: '#fff', border: '3px solid #000', borderRadius: '16px', padding: '0.75rem', boxShadow: '3px 3px 0px #000', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Type quiz topic..." 
                  value={quizTopic}
                  onChange={(e) => setQuizTopic(e.target.value)}
                  className="cyber-input"
                  style={{ flex: 1 }}
                />
                <button 
                  onClick={handleGenerateOnSpotQuiz}
                  disabled={loadingQuiz}
                  className="cyber-btn gold-fill"
                  style={{ fontSize: '0.8rem', padding: '0.6rem 1rem' }}
                >
                  {loadingQuiz ? 'GENERATING...' : 'QUIZ ON SPOT'}
                </button>
              </div>

            </div>
          ) : (
            /* Mobile tab: Chat, Members, or Notes -> render Header + mobile tabs, then Right column content! */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', width: '100%' }}>
              {/* Header info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '2.5px solid #000', borderRadius: '14px', padding: '0.5rem 1rem', boxShadow: '3px 3px 0px #000' }}>
                <div>
                  <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800 }}>{activeRoom.title}</h4>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    CODE: <strong style={{ color: 'var(--accent-pink)' }}>RM-{activeRoom.id.substring(5).toUpperCase()}</strong>
                  </span>
                </div>
                <button 
                  onClick={handleLeaveRoom}
                  className="cyber-btn pink-fill"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                >
                  LEAVE
                </button>
              </div>

              {/* Mobile Tab Bar */}
              <div style={{
                display: 'flex',
                background: '#fff',
                border: '3px solid #000',
                borderRadius: '16px',
                padding: '0.25rem',
                gap: '0.25rem',
                boxShadow: '3px 3px 0px #000'
              }}>
                {([
                  { id: 'video', label: '📹 Video' },
                  { id: 'chat', label: '💬 Chat' },
                  { id: 'participants', label: '👥 Members' },
                  { id: 'notes', label: '📚 Notes' }
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setMobileTab(tab.id)}
                    style={{
                      flex: 1,
                      background: mobileTab === tab.id ? 'var(--accent-purple)' : 'none',
                      border: mobileTab === tab.id ? '2px solid #000' : '2px solid transparent',
                      borderRadius: '10px',
                      color: '#000',
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.5rem 0',
                      cursor: 'pointer',
                      boxShadow: mobileTab === tab.id ? '1.5px 1.5px 0px #000' : 'none'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', flex: 1, overflowY: 'auto', minHeight: '350px' }}>
                {renderRightColumn()}
              </div>
            </div>
          )}

          {/* Right column on Desktop */}
          {!isMobile && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', height: '100%', overflow: 'hidden' }}>
              {renderRightColumn()}
            </div>
          )}

        </div>
      )}
    </div>
  );
};
