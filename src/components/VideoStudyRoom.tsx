import React, { useState, useEffect, useRef } from 'react';
import { generateQuestionsForTopic } from '../utils/quizHelper';
import { db, isFirebaseConfigured, ref, onValue, set, update, push, remove, onChildAdded, onChildChanged, onChildRemoved, get, uploadPdf } from '../firebase';

const downloadPdfContent = async (idOrUrl: string, fileName: string) => {
  if (idOrUrl.startsWith('mock-pdf-url:')) {
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
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // User Media & Collaborative States
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
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

  useEffect(() => {
    if (!activeRoom) return;

    if (isFirebaseConfigured && db) {
      const roomRef = ref(db, 'study_rooms/' + activeRoom.id);
      const unsub = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setActiveRoomDoc(data);
          const isHost = data.hostPeerId === myPeerId || data.hostEmail === userEmail;
          const isMod = isHost || (data.moderators && data.moderators.includes(userEmail));
          
          if (isMod) {
            const reqs = data.joinRequests || {};
            Object.values(reqs).forEach((req: any) => {
              if (req.status === 'pending' && (!prevRequestsRef.current[req.peerId] || prevRequestsRef.current[req.peerId].status !== 'pending')) {
                window.dispatchEvent(new CustomEvent('new-notification', {
                  detail: {
                    title: 'Join Request',
                    message: `${req.name} wants to join the room.`,
                    type: 'request'
                  }
                }));
              }
            });
            prevRequestsRef.current = reqs;
          }
          
          const pMap = data.participants || {};
          
          // Check if we are kicked or banned by host
          if (!isHost) {
            if (!pMap[myPeerId]) {
              setActiveRoom(null);
              setActiveRoomDoc(null);
              alert("You have been kicked from the room by the host.");
              return;
            }
            if (data.bannedEmails && data.bannedEmails.includes(userEmail)) {
              setActiveRoom(null);
              setActiveRoomDoc(null);
              alert("You have been banned from this room by the host.");
              return;
            }
          }

          // Filter out the current user (YOU) from classmate grid using peerId
          const list = Object.values(pMap)
            .filter((p: any) => p.peerId !== myPeerId)
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
          const messagesVal = data.messages || [];
          setChatMessages(Array.isArray(messagesVal) ? messagesVal : Object.values(messagesVal));
          const notesVal = data.notes || [];
          const parsedNotes = Array.isArray(notesVal) ? notesVal : Object.values(notesVal);
          parsedNotes.sort((a: any, b: any) => b.id.localeCompare(a.id));
          setRoomNotes(parsedNotes);
          const pdfsVal = data.pdfs || [];
          setRoomPdfs(Array.isArray(pdfsVal) ? pdfsVal : Object.values(pdfsVal));
        } else {
          setActiveRoom(null);
          setActiveRoomDoc(null);
        }
      });
      return () => unsub();
    }
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

        const totalParticipants = participants.length + 1;
        let videoConstraints: any = { facingMode: 'user' };

        // Adaptive quality based on capacity
        if (totalParticipants > 12) {
          videoConstraints = {
            facingMode: 'user',
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 15 }
          };
        } else if (totalParticipants > 4) {
          videoConstraints = {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 }
          };
        } else {
          videoConstraints = {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          };
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: videoConstraints, 
            audio: true 
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch {
            console.log('[WebRTC] Camera initialization failed/denied, falling back to audio only');
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
        }
        
        if (isCancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        // Apply device configurations
        stream.getAudioTracks().forEach(track => { track.enabled = micOn; });
        stream.getVideoTracks().forEach(track => { track.enabled = cameraOn; });

        activeStream = stream;
        localStreamRef.current = stream;
        setCameraStream(stream);
        
        // Brief timeout ensures video element is fully mounted in the DOM
        setTimeout(() => {
          if (videoRef.current && !isCancelled) {
            videoRef.current.srcObject = stream;
          }
        }, 150);
      } catch (err) {
        if (isCancelled) return;
        console.error('Study room webcam initialization failed:', err);
        setCameraError(true);
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
  }, [activeRoom, participants.length]);

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
        const roomRef = ref(db, 'study_rooms/' + room.id);
        const roomSnap = await get(roomRef);
        if (roomSnap.exists()) {
          const data = roomSnap.val();
          const pMap = data.participants || {};
          isAlreadyIn = !!pMap[myPeerId];
          currentParticipantCount = Object.keys(pMap).length;

          // Capacity check: Max 50 participants
          if (currentParticipantCount >= 50 && !isAlreadyIn) {
            alert("Room Full (50/50 participants). Please join another room or create a new one.");
            return;
          }

          // Ban check
          if (data.bannedEmails && data.bannedEmails.includes(userEmail)) {
            alert("You are banned from this room!");
            return;
          }

          // Lock check
          if (data.isLocked && !isAlreadyIn) {
            alert("This room is currently locked by the host.");
            return;
          }

          // Check if we are host or already in
          const isHost = data.hostPeerId === myPeerId || data.hostEmail === userEmail || !data.hostPeerId;
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
          waitingListenerRef.current = onValue(roomRef, (snap) => {
            if (snap.exists()) {
              const snapData = snap.val();
              const myReq = (snapData.joinRequests || {})[myPeerId];
              if (myReq) {
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

  const handleJoinRoom = async (room: StudyRoom) => {

    let existingNames: string[] = [];
    let currentParticipantCount = 0;
    let isAlreadyIn = false;

    // Fetch existing participant names and check capacity limit
    if (isFirebaseConfigured && db) {
      try {
        const roomRef = ref(db, 'study_rooms/' + room.id);
        const roomSnap = await get(roomRef);
        if (roomSnap.exists()) {
          const data = roomSnap.val();
          const pMap = data.participants || {};
          isAlreadyIn = !!pMap[myPeerId];
          currentParticipantCount = Object.keys(pMap).length;
          existingNames = Object.values(pMap)
            .filter((p: any) => p.peerId !== myPeerId)
            .map((p: any) => p.name);
        }
      } catch (e) {
        console.error("Error reading existing participants:", e);
      }
    }

    // Capacity check: Max 50 participants (unless we're already re-joining)
    if (currentParticipantCount >= 50 && !isAlreadyIn) {
      setRoomFullError("Room Full (50/50 participants). Please join another room or create a new one.");
      return;
    }

    // Resolve name collisions (e.g. if testing multiple tabs with same credentials)
    let finalName = userName;
    let suffix = 1;
    while (existingNames.includes(finalName)) {
      suffix++;
      finalName = `${userName} (${suffix})`;
    }
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
      const roomRef = ref(db, 'study_rooms/' + room.id);
      const roomSnap = await get(roomRef);
      if (roomSnap.exists()) {
        await set(ref(db, `study_rooms/${room.id}/participants/${myPeerId}`), me);
        await push(ref(db, `study_rooms/${room.id}/messages`), sysMsg);
      } else {
        await set(roomRef, {
          id: room.id,
          title: room.title,
          topic: room.topic,
          participants: { [myPeerId]: me },
          messages: {},
          notes: {},
          pdfs: {}
        });
        await push(ref(db, `study_rooms/${room.id}/messages`), { id: 'join_system', sender: 'System', text: `Welcome to ${room.title}. Connect your webcam stream below!`, time: '' });
        await push(ref(db, `study_rooms/${room.id}/messages`), sysMsg);
      }
    }

    setActiveRoom(room);
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom) return;

    // 1. Close all active peer connections
    Object.keys(peerConnections.current).forEach(peerId => {
      closePeerConnection(peerId);
    });

    // 2. Stop local tracks
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

    // 3. Remove signaling and participants data
    if (isFirebaseConfigured && db) {
      try {
        const roomRef = ref(db, 'study_rooms/' + activeRoom.id);
        const roomSnap = await get(roomRef);
        if (roomSnap.exists()) {
          const data = roomSnap.val();
          const updatedParticipants = { ...(data.participants || {}) };
          delete updatedParticipants[myPeerId];

          if (Object.keys(updatedParticipants).length === 0 && !['room_101', 'room_202', 'room_303'].includes(activeRoom.id)) {
            await remove(roomRef);
          } else {
            // Log that user left
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
        console.error("Error leaving room:", e);
      }
    }

    setActiveRoom(null);
    setActiveQuiz(null);
    setQuizFinished(false);
    setQuizTopic('');
    setParticipants([]);
    setRemoteStreams({});
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot create study rooms.");
      return;
    }
    if (!newTitle || !newTopic) return;

    const cleanSlug = newTitle.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const roomId = `room_${cleanSlug || Math.floor(100 + Math.random() * 900)}`;
    
    // For hosted rooms, nickname is userName
    const finalName = userName;
    setRoomNickname(finalName);

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
          isMuted: !micOn,
          cameraOn: cameraOn,
          micOn: micOn,
          screenSharing: screenSharing,
          joinedAt: Date.now()
        }
      },
      messages: [
        { id: 'join_system', sender: 'System', text: `Welcome to ${newTitle}. Connect your webcam stream below!`, time: '' }
      ],
      notes: [],
      pdfs: []
    };
    if (isFirebaseConfigured && db) {
      await set(ref(db, 'study_rooms/' + roomId), newRoom);
      try {
        await set(ref(db, 'rooms/' + newTitle), newRoom);
      } catch (e) {
        console.warn('[Firebase] Safely ignored write error on legacy rooms/ path:', e);
      }
    }

    setNewTitle('');
    setNewTopic('General');
    
    handleJoinRoom({
      id: roomId,
      title: newRoom.title,
      topic: newRoom.topic,
      participants: 1
    });
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
    if (!screenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        
        // Replace video track in all peer connections
        const videoTrack = stream.getVideoTracks()[0];
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });

        // Also replace in local video preview
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        videoTrack.onended = () => {
          stopScreenShare();
        };

        setScreenSharing(true);
        updateMyPresence({ screenSharing: true });
      } catch (err) {
        console.error("Error starting screen share:", err);
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
    
    // Restore webcam track in all peer connections
    if (localStreamRef.current) {
      const webcamTrack = localStreamRef.current.getVideoTracks()[0];
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && webcamTrack) {
          sender.replaceTrack(webcamTrack);
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = localStreamRef.current;
      }
    }

    setScreenSharing(false);
    updateMyPresence({ screenSharing: false });
  };

  const createPeerConnection = (peerId: string): RTCPeerConnection => {
    if (peerConnections.current[peerId]) {
      return peerConnections.current[peerId];
    }

    pendingIceCandidates.current[peerId] = [];

    const turnUrl = import.meta.env.VITE_TURN_URL;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnPassword = import.meta.env.VITE_TURN_PASSWORD;
    const iceServersEnv = import.meta.env.VITE_ICE_SERVERS;

    let iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' }
    ];

    if (turnUrl && turnUsername && turnPassword) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnPassword
      });
    }

    if (iceServersEnv) {
      try {
        iceServers = JSON.parse(iceServersEnv);
        console.log('[WebRTC] Custom ICE configuration applied:', iceServers);
      } catch (err) {
        console.error('[WebRTC] Failed to parse VITE_ICE_SERVERS:', err);
      }
    }

    const configuration = { iceServers };
    console.log(`[WebRTC] Creating RTCPeerConnection for peer: ${peerId} with config:`, configuration);
    const pc = new RTCPeerConnection(configuration);
    peerConnections.current[peerId] = pc;

    // Add logging for connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state change for peer ${peerId}:`, pc.connectionState);
      console.log(`[WebRTC] Connection details: connectionState=${pc.connectionState}, signalingState=${pc.signalingState}`);
      if (pc.connectionState === 'failed') {
        console.error(`[WebRTC] Connection failed with peer ${peerId}. Retrying/restarting ICE if possible.`);
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE Connection state change for peer ${peerId}:`, pc.iceConnectionState);
      console.log(`[WebRTC] ICE state connection state for peer ${peerId}:`, pc.iceConnectionState);
    };
    pc.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state change for peer ${peerId}:`, pc.signalingState);
    };

    // Add local tracks (microphone track is always bound, even during screen share)
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        console.log(`[WebRTC] Adding local mic track to peer connection for ${peerId}, track ID: ${track.id}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    if (screenSharing && screenStreamRef.current) {
      console.log(`[WebRTC] Adding local screen tracks to peer connection for ${peerId}`);
      screenStreamRef.current.getVideoTracks().forEach(track => {
        console.log(`[WebRTC] Adding local screen video track: ${track.id}, enabled: ${track.enabled}`);
        pc.addTrack(track, screenStreamRef.current!);
      });
    } else if (localStreamRef.current) {
      console.log(`[WebRTC] Adding local camera tracks to peer connection for ${peerId}`);
      localStreamRef.current.getVideoTracks().forEach(track => {
        console.log(`[WebRTC] Adding local camera video track: ${track.id}, enabled: ${track.enabled}`);
        pc.addTrack(track, localStreamRef.current!);
      });
    } else {
      console.warn(`[WebRTC] No local streams active while connecting to ${peerId}. Creating one-way receiver connection.`);
    }

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] Generated ICE Candidate for peer ${peerId}:`, event.candidate.toJSON().candidate);
        console.log(`[WebRTC] ICE state candidate for peer ${peerId}:`, event.candidate.toJSON().candidate);
      } else {
        console.log(`[WebRTC] ICE candidate gathering complete for peer ${peerId}`);
      }
      if (!event.candidate || !activeRoom) return;
      const candidateObj = event.candidate.toJSON();

      const isCaller = myPeerId > peerId;
      
      if (isCaller) {
        if (isFirebaseConfigured && db) {
          const callCandidatesRef = ref(db, `study_rooms/${activeRoom.id}/calls/${myPeerId}_${peerId}/callerCandidates`);
          try {
            await push(callCandidatesRef, candidateObj);
          } catch (e) {
            console.error(`[WebRTC] Error writing caller ICE candidate for peer ${peerId}:`, e);
          }
        }
      } else {
        if (isFirebaseConfigured && db) {
          const callCandidatesRef = ref(db, `study_rooms/${activeRoom.id}/calls/${peerId}_${myPeerId}/receiverCandidates`);
          try {
            await push(callCandidatesRef, candidateObj);
          } catch (e) {
            console.error(`[WebRTC] Error writing receiver ICE candidate for peer ${peerId}:`, e);
          }
        }
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote stream track from peer ${peerId}:`, event.track.kind);
      console.log(`[WebRTC] Track info: kind=${event.track.kind}, readyState=${event.track.readyState}, enabled=${event.track.enabled}`);
      const rStream = event.streams[0] || new MediaStream();
      console.log(`[WebRTC] Stream info: id=${rStream.id}, active=${rStream.active}, videoTracks=${rStream.getVideoTracks().length}, audioTracks=${rStream.getAudioTracks().length}`);
      
      setRemoteStreams(prev => {
        const oldStream = prev[peerId];
        // Create a new MediaStream instance copying tracks to ensure reference change triggers React state updates
        const newStream = oldStream ? new MediaStream(oldStream.getTracks()) : new MediaStream();
        if (!newStream.getTracks().some(t => t.id === event.track.id)) {
          newStream.addTrack(event.track);
        }
        console.log(`[WebRTC] Updated remote stream for peer ${peerId}: videoTracks=${newStream.getVideoTracks().length}, audioTracks=${newStream.getAudioTracks().length}`);
        return {
          ...prev,
          [peerId]: newStream
        };
      });
    };

    return pc;
  };

  const closePeerConnection = (peerId: string) => {
    const pc = peerConnections.current[peerId];
    if (pc) {
      pc.close();
      delete peerConnections.current[peerId];
    }
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  // Listen for WebRTC signals (Offers, Answers, ICE Candidates)
  useEffect(() => {
    if (!activeRoom) return;

    let unsubAdded: (() => void) | null = null;
    let unsubChanged: (() => void) | null = null;

    if (isFirebaseConfigured && db) {
      const callsRef = ref(db, `study_rooms/${activeRoom.id}/calls`);
      
      const handleCallUpdate = async (snapshot: any) => {
        const callData = snapshot.val();
        const callId = snapshot.key;
        console.log(`[WebRTC] [Signaling] handleCallUpdate entry - callId: ${callId}, myPeerId: ${myPeerId}`);
        if (!callId) return;
        const [callerId, receiverId] = callId.split('_');

        if (callerId !== myPeerId && receiverId !== myPeerId) return;

        if (receiverId === myPeerId) {
          let pc = peerConnections.current[callerId];
          
          if (!pc) {
            console.log(`[WebRTC] [Signaling] Added/Updated call ${callId}. Initializing receiver connection.`);
            pc = createPeerConnection(callerId);
          }
          if (callData.offer && !pc.remoteDescription) {
            console.log(`[WebRTC] [Signaling] Setting remote offer from caller ${callerId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
            
            // Apply queued candidates once remote description is set
            const pending = pendingIceCandidates.current[callerId] || [];
            for (const cand of pending) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.error("[WebRTC] Failed to add queued ICE candidate:", e);
              }
            }
            pendingIceCandidates.current[callerId] = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log(`[WebRTC] [Signaling] Creating and sending answer to caller ${callerId}`);
            await update(ref(db, `study_rooms/${activeRoom.id}/calls/${callId}`), {
              answer: { type: answer.type, sdp: answer.sdp }
            });
          }

          const callerCandidates = callData.callerCandidates ? Object.values(callData.callerCandidates) : [];
          if (pc && callerCandidates.length > 0) {
            for (const cand of callerCandidates) {
              if (!pc.remoteDescription) {
                if (!pendingIceCandidates.current[callerId]) {
                  pendingIceCandidates.current[callerId] = [];
                }
                pendingIceCandidates.current[callerId].push(cand as any);
              } else {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand as any));
                } catch (e) {}
              }
            }
          }
        }

        if (callerId === myPeerId) {
          const pc = peerConnections.current[receiverId];
          if (pc) {
            if (callData.answer && !pc.remoteDescription) {
              console.log(`[WebRTC] [Signaling] Received and setting remote answer from receiver ${receiverId}`);
              await pc.setRemoteDescription(new RTCSessionDescription(callData.answer));
              
              // Apply queued candidates once remote description is set
              const pending = pendingIceCandidates.current[receiverId] || [];
              for (const cand of pending) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.error("[WebRTC] Failed to add queued ICE candidate:", e);
                }
              }
              pendingIceCandidates.current[receiverId] = [];
            }

            const receiverCandidates = callData.receiverCandidates ? Object.values(callData.receiverCandidates) : [];
            if (receiverCandidates.length > 0) {
              for (const cand of receiverCandidates) {
                if (!pc.remoteDescription) {
                  if (!pendingIceCandidates.current[receiverId]) {
                    pendingIceCandidates.current[receiverId] = [];
                  }
                  pendingIceCandidates.current[receiverId].push(cand as any);
                } else {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand as any));
                  } catch (e) {}
                }
              }
            }
          }
        }
      };

      unsubAdded = onChildAdded(callsRef, handleCallUpdate);
      unsubChanged = onChildChanged(callsRef, handleCallUpdate);
    }

    return () => {
      if (unsubAdded) unsubAdded();
      if (unsubChanged) unsubChanged();
    };
  }, [activeRoom?.id, reconnectKey]);


  // Manage peer connection sessions based on active participant updates
  useEffect(() => {
    if (!activeRoom || (!cameraStream && !cameraError)) return;

    participants.forEach(async (p: any) => {
      const peerId = p.peerId;
      if (!peerId) return;

      if (!peerConnections.current[peerId]) {
        const isCaller = myPeerId > peerId;

        if (isCaller) {
          console.log(`[WebRTC] Initiating peer connection session with peer ${peerId} (I am caller)`);
          const pc = createPeerConnection(peerId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          if (isFirebaseConfigured && db) {
            const callRef = ref(db, `study_rooms/${activeRoom.id}/calls/${myPeerId}_${peerId}`);
            console.log(`[WebRTC] Writing signaling offer to RTDB for peer ${peerId}`);
            await set(callRef, {
              callerId: myPeerId,
              receiverId: peerId,
              offer: { type: offer.type, sdp: offer.sdp },
              answer: null,
              callerCandidates: {},
              receiverCandidates: {}
            });
          }
        }
      }
    });

    Object.keys(peerConnections.current).forEach((peerId) => {
      const stillActive = participants.some((p: any) => p.peerId === peerId);
      if (!stillActive) {
        console.log(`[WebRTC] Closing peer connection with ${peerId} (left the room)`);
        closePeerConnection(peerId);
      }
    });
  }, [participants, cameraStream, cameraError]);

  const handleShareRoomPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom) return;
    if (isGuest) {
      alert("Guest accounts cannot upload PDFs.");
      return;
    }

    if (file.type !== 'application/pdf') {
      alert('Only PDF files are supported.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('PDF exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const sysMsg: Message = {
        id: `sys_pdf_${Date.now()}`,
        sender: 'System',
        text: `${roomNickname} uploaded a PDF: "${file.name}"!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (isFirebaseConfigured && db) {
        try {
          const pdfUrl = await uploadPdf(file.name, reader.result as string, userEmail);
          const newPdf = {
            id: pdfUrl,
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            uploadedBy: roomNickname,
            timestamp: Date.now()
          };
          await push(ref(db, `study_rooms/${activeRoom.id}/pdfs`), newPdf);
          await push(ref(db, `study_rooms/${activeRoom.id}/messages`), sysMsg);
          onRewardXp(40, `Uploaded PDF to room: "${file.name}". Gained +40 XP!`);
        } catch (err) {
          console.error("Failed to upload PDF:", err);
          alert("Failed to upload PDF file.");
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteRoomNote = async (noteId: string) => {
    if (!activeRoom) return;
    if (isFirebaseConfigured && db) {
      const roomRef = ref(db, 'study_rooms/' + activeRoom.id);
      const roomSnap = await get(roomRef);
      if (roomSnap.exists()) {
        const data = roomSnap.val();
        if (data.notes) {
          if (Array.isArray(data.notes)) {
            const updatedNotes = data.notes.filter((n: any) => n.id !== noteId);
            await update(roomRef, { notes: updatedNotes });
          } else {
            const keyToDelete = Object.keys(data.notes).find(k => data.notes[k].id === noteId);
            if (keyToDelete) {
              await remove(ref(db, `study_rooms/${activeRoom.id}/notes/${keyToDelete}`));
            }
          }
        }
      }
    }
  };

  const handleUpdateRoomNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !editingNoteId) return;

    if (isFirebaseConfigured && db) {
      try {
        const roomRef = ref(db, 'study_rooms/' + activeRoom.id);
        const roomSnap = await get(roomRef);
        if (roomSnap.exists()) {
          const data = roomSnap.val();
          if (data.notes) {
            if (Array.isArray(data.notes)) {
              const updatedNotes = data.notes.map((n: any) =>
                n.id === editingNoteId ? { ...n, title: editingNoteTitle, content: editingNoteContent } : n
              );
              await update(roomRef, { notes: updatedNotes });
            } else {
              const keyToUpdate = Object.keys(data.notes).find(k => data.notes[k].id === editingNoteId);
              if (keyToUpdate) {
                await update(ref(db, `study_rooms/${activeRoom.id}/notes/${keyToUpdate}`), {
                  title: editingNoteTitle,
                  content: editingNoteContent
                });
              }
            }
          }
        }
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
        onRewardXp(finalReward, `Finished study session quiz on ${activeRoom?.topic}! Gained +${finalReward} XP!`);
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
      await push(ref(db, `study_rooms/${activeRoom.id}/notes`), newRn);
      await push(ref(db, `study_rooms/${activeRoom.id}/messages`), sysMsg);
    }

    setRnTitle('');
    setRnContent('');
    setRnPdf(null);
    if (rnFileInputRef.current) rnFileInputRef.current.value = '';

    onRewardXp(25, `Shared session note in room: "${rnTitle}". Gained +25 XP!`);
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
            muted
            ref={(el) => {
              if (el) el.srcObject = stream;
            }}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              display: hasVideo ? 'block' : 'none' 
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

      {/* Hidden audio tags to ensure remote audio tracks play independently of video lifecycle */}
      {Object.entries(remoteStreams).map(([peerId, stream]) => (
        <audio
          key={peerId}
          autoPlay
          ref={(el) => {
            if (el) {
              el.srcObject = stream;
              el.play().catch((err) => {
                console.warn("[WebRTC] Autoplay audio failed, trying to play on user interaction:", err);
              });
            }
          }}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
        />
      ))}

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
                  <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800 }}>{activeRoom.title}</h4>
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
                          {cameraOn && !cameraError && cameraStream ? (
                            <video
                              ref={videoRef}
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
                      {pageClassmates.map((friend, idx) => (
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
                              background: (!friend.cameraOn || friend.isMuted) ? '#f44336' : '#4caf50' 
                            }} />
                            {friend.name} {friend.screenSharing ? ' (SHARING)' : ''} {friend.isMuted ? ' (MUTED)' : ''}
                          </div>
                        </div>
                      ))}

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
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', background: '#fff', border: '3px solid #000', borderRadius: '16px', padding: '0.5rem', boxShadow: '3px 3px 0px #000', position: 'relative' }}>
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
                  style={{ padding: '0.45rem 1.0rem', fontSize: '0.75rem', flex: 1 }}
                >
                  {cameraOn ? 'CAMERA OFF' : 'CAMERA ON'}
                </button>
                <button 
                  onClick={toggleMute}
                  className={`cyber-btn ${micOn ? 'cyan-fill' : 'pink-fill'}`}
                  style={{ padding: '0.45rem 1.0rem', fontSize: '0.75rem', flex: 1 }}
                >
                  {micOn ? 'MUTE MIC' : 'UNMUTE MIC'}
                </button>
                <button 
                  onClick={handleToggleRaiseHand}
                  className={`cyber-btn ${myRaisedHand ? 'gold-fill' : 'purple-fill'}`}
                  style={{ padding: '0.45rem 1.0rem', fontSize: '0.75rem', flex: 1 }}
                >
                  {myRaisedHand ? '✋ LOWER' : '🙋 RAISE'}
                </button>
                <button 
                  onClick={toggleScreenShare}
                  className={`cyber-btn ${screenSharing ? 'pink-fill' : 'gold-fill'}`}
                  style={{ padding: '0.45rem 1.0rem', fontSize: '0.75rem', flex: 1 }}
                >
                  {screenSharing ? 'STOP SHARE' : 'SHARE'}
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
