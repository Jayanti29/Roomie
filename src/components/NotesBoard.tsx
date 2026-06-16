import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, onValue, set, update, get, push, onChildAdded, onChildChanged, onChildRemoved, uploadPdf } from '../firebase';

export const getCustomSubjectsForCourse = (course: string): string[] => {
  const c = course.toLowerCase();
  if (c.includes('computer') || c.includes('software') || c.includes('it') || c.includes('coding') || c.includes('dev') || c.includes('bca') || c.includes('mca') || c.includes('tech')) {
    return ['Computer Science', 'Mathematics', 'Data Structures', 'Algorithms', 'Web Development', 'Database Systems'];
  }
  if (c.includes('mech') || c.includes('physic') || c.includes('aerospace') || c.includes('civil') || c.includes('electr')) {
    return ['Physics', 'Mathematics', 'Calculus', 'Thermodynamics', 'Fluid Mechanics', 'Engineering Design'];
  }
  if (c.includes('bio') || c.includes('chem') || c.includes('med') || c.includes('doctor') || c.includes('psych') || c.includes('mbbs')) {
    return ['Biology', 'Chemistry', 'Organic Chemistry', 'Anatomy', 'Physiology', 'Genetics', 'Pathology'];
  }
  if (c.includes('bus') || c.includes('fin') || c.includes('econ') || c.includes('comm') || c.includes('acc') || c.includes('mgt') || c.includes('mba') || c.includes('b.com')) {
    return ['Economics', 'Finance', 'Accounting', 'Marketing', 'Management', 'Statistics'];
  }
  if (c.includes('law') || c.includes('llb') || c.includes('legal')) {
    return ['Jurisprudence', 'Constitutional Law', 'Contract Law', 'Criminal Law', 'Legal Writing', 'Human Rights'];
  }
  if (c.includes('art') || c.includes('design') || c.includes('music') || c.includes('paint') || c.includes('theater') || c.includes('literature') || c.includes('b.a.')) {
    return ['Fine Arts', 'Graphic Design', 'Art History', 'Creativity', 'Music Theory', 'Portfolio Design'];
  }
  const capitalizedCourse = course.charAt(0).toUpperCase() + course.slice(1);
  return [capitalizedCourse, 'Mathematics', 'Computer Science', 'Physics', 'Chemistry', 'Biology', 'Literature'];
};

export const downloadPdfContent = async (idOrUrl: string, fileName: string) => {
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

interface Comment {
  id: string;
  author: string;
  authorEmail: string;
  text: string;
  timestamp: number;
}

interface StudyNote {
  id: string;
  title: string;
  content: string;
  course: string;
  author: string;
  authorEmail: string;
  likes: number;
  date: string;
  summary?: string;
  comments?: Comment[];
  pdfAttachment?: {
    name: string;
    size: string;
    dataUrl?: string;
    url?: string;
  };
}

interface NotesBoardProps {
  userName: string;
  userEmail: string;
  userCourse: string;
  onRewardXp: (xp: number, message: string) => void;
  activeSubView?: 'notes' | 'chat';
  isGuest?: boolean;
  isAdmin?: boolean;
}

export const NotesBoard: React.FC<NotesBoardProps> = ({ userName, userEmail, userCourse, onRewardXp, activeSubView, isGuest, isAdmin = false }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileFeedTab, setMobileFeedTab] = useState<'feed' | 'create'>('feed');
  const [reconnectKey, setReconnectKey] = useState(0);
  const [friendsList, setFriendsList] = useState<string[]>([]);

  // Navigation & Workspace Selection
  const [activeItem, setActiveItem] = useState<{ type: 'feed' | 'channel' | 'group' | 'dm'; id: string }>({
    type: 'feed',
    id: 'global'
  });


  // DB Sync States
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [presenceUsers, setPresenceUsers] = useState<any[]>([]);
  const [activeChatMessages, setActiveChatMessages] = useState<any[]>([]);


  const handleAdminDeleteNote = async (noteId: string) => {
    if (confirm("Are you sure you want to delete this note as an admin?")) {
      if (isFirebaseConfigured && db) {
        await set(ref(db, `shared_notes/${noteId}`), null);
      }
    }
  };

  const handleAdminDeleteChannel = async (chanId: string) => {
    if (confirm("Are you sure you want to delete this channel as an admin?")) {
      if (isFirebaseConfigured && db) {
        await set(ref(db, `community_channels/${chanId}`), null);
        if (activeItem.type === 'channel' && activeItem.id === chanId) {
          setActiveItem({ type: 'feed', id: 'global' });
        }
      }
    }
  };

  const handleAdminDeleteGroup = async (groupId: string) => {
    if (confirm("Are you sure you want to delete this group as an admin?")) {
      if (isFirebaseConfigured && db) {
        await set(ref(db, `community_groups/${groupId}`), null);
        if (activeItem.type === 'group' && activeItem.id === groupId) {
          setActiveItem({ type: 'feed', id: 'global' });
        }
      }
    }
  };

  const handleAdminDeleteMessage = async (msgId: string) => {
    if (!confirm("Delete this message?")) return;
    if (!isFirebaseConfigured || !db) return;

    let path = '';
    if (activeItem.type === 'channel') {
      path = `community_channels/${activeItem.id}/messages`;
    } else if (activeItem.type === 'group') {
      path = `community_groups/${activeItem.id}/messages`;
    } else if (activeItem.type === 'dm') {
      const chatId = getDmChatId(userEmail, activeItem.id);
      path = `private_chats/${chatId}/messages`;
    }

    if (!path) return;

    try {
      const snap = await get(ref(db, path));
      if (snap.exists()) {
        const val = snap.val();
        const key = Object.keys(val).find(k => val[k].id === msgId);
        if (key) {
          await set(ref(db, `${path}/${key}`), null);
          setActiveChatMessages(prev => prev.filter(m => m.id !== msgId));
        }
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };
  const [isServiceUnavailable] = useState(!isFirebaseConfigured || !db);

  // Search & Filters
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');
  const [filterType, setFilterType] = useState<'all' | 'bookmarks' | 'my-notes'>('all');
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Scanning Modals
  const [activeSummaryNote, setActiveSummaryNote] = useState<StudyNote | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  // Note Composer Form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [course, setCourse] = useState('Computer Science');
  const [pdfFile, setPdfFile] = useState<{ name: string; size: string; dataUrl: string } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Creation Modals
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Comment Thread State
  const [commentingNoteId, setCommentingNoteId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Channel/Group Workspace specific states
  const [wsTab, setWsTab] = useState<'chat' | 'notes' | 'pdfs' | 'members'>('chat');
  const [wsTitle, setWsTitle] = useState('');
  const [wsContent, setWsContent] = useState('');
  const [wsSubject, setWsSubject] = useState('Computer Science');
  const [wsPdfFile, setWsPdfFile] = useState<{ name: string; size: string; dataUrl: string } | null>(null);
  const [wsPdfError, setWsPdfError] = useState('');
  const wsFileInputRef = useRef<HTMLInputElement>(null);

  // DM specific States
  const [activeChatTyping, setActiveChatTyping] = useState(false);
  const [chatInputText, setChatInputText] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const coursesList = getCustomSubjectsForCourse(userCourse);

  // Default Subject set
  useEffect(() => {
    if (coursesList.length > 0) {
      setCourse(coursesList[0]);
      setWsSubject(coursesList[0]);
    }
  }, [userCourse]);

  // Load User Bookmarks
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const userKey = userEmail.replace(/\./g, '_');
      const docRef = ref(db, 'bookmarks/' + userKey);
      const unsub = onValue(docRef, (snap) => {
        if (snap.exists()) {
          setBookmarks(snap.val() || []);
        } else {
          setBookmarks([]);
        }
      });
      return () => unsub();
    }
  }, [userEmail, isFirebaseConfigured, reconnectKey]);

  // Mobile resizing detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync / Load Friends List
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const userKey = userEmail.replace(/\./g, '_');
      const docRef = ref(db, 'friends_lists/' + userKey);
      const unsub = onValue(docRef, (snap) => {
        if (snap.exists()) {
          setFriendsList(snap.val().friends || []);
        } else {
          setFriendsList([]);
        }
      });
      return () => unsub();
    }
  }, [userEmail, isFirebaseConfigured, reconnectKey]);

  // Friend toggle handler (Add/Remove)
  const handleToggleFriend = async (friendEmail: string) => {
    const isFriend = friendsList.includes(friendEmail);
    const updated = isFriend 
      ? friendsList.filter(email => email !== friendEmail)
      : [...friendsList, friendEmail];
    
    if (isFirebaseConfigured && db) {
      const userKey = userEmail.replace(/\./g, '_');
      await update(ref(db, 'friends_lists/' + userKey), { friends: updated });
    }

    window.dispatchEvent(new CustomEvent('new-notification', {
      detail: {
        title: isFriend ? 'Friend Removed' : 'Friend Added',
        message: isFriend ? `Removed ${friendEmail} from friends list.` : `Added ${friendEmail} to friends list.`,
        type: 'info'
      }
    }));
  };

  // Firestore Reconnect listener
  useEffect(() => {
    const handleReconnect = () => {
      console.log('[Firestore] Reconnection triggered in NotesBoard, resubscribing...');
      setReconnectKey(prev => prev + 1);
    };
    window.addEventListener('firestore-reconnect', handleReconnect);
    return () => window.removeEventListener('firestore-reconnect', handleReconnect);
  }, []);

  const notesRefVal = useRef<StudyNote[]>([]);

  useEffect(() => {
    notesRefVal.current = notes;
  }, [notes]);

  // Load Shared Notes, Channels, Groups, and Presence Users incrementally
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const mountTime = Date.now();

      // 1. Subscribe to shared notes incrementally
      const notesRef = ref(db, 'shared_notes');
      
      const onNoteAdded = onChildAdded(notesRef, (snap) => {
        const val = snap.val();
        if (val) {
          setNotes(prev => {
            if (prev.some(n => n.id === val.id)) return prev;
            const updated = [...prev, val];
            updated.sort((a, b) => b.date.localeCompare(a.date));
            return updated;
          });
          const noteTime = val.timestamp || Date.parse(val.date) || 0;
          if (noteTime > mountTime && val.authorEmail !== userEmail) {
            window.dispatchEvent(new CustomEvent('new-notification', {
              detail: {
                title: 'New Note Shared',
                message: `${val.author} shared: "${val.title}"`,
                type: 'note'
              }
            }));
          }
        }
      });

      const onNoteChanged = onChildChanged(notesRef, (snap) => {
        const val = snap.val();
        if (val) {
          setNotes(prev => {
            const oldNote = prev.find(n => n.id === val.id);
            if (oldNote) {
              if (val.likes > oldNote.likes && val.authorEmail === userEmail) {
                window.dispatchEvent(new CustomEvent('new-notification', {
                  detail: {
                    title: 'Your note was liked!',
                    message: `Someone liked your note: "${val.title}"`,
                    type: 'note'
                  }
                }));
              }
              const valComments = val.comments || [];
              const oldComments = oldNote.comments || [];
              if (valComments.length > oldComments.length) {
                const latestComment = valComments[valComments.length - 1];
                if (latestComment && latestComment.authorEmail !== userEmail) {
                  window.dispatchEvent(new CustomEvent('new-notification', {
                    detail: {
                      title: val.authorEmail === userEmail ? 'New Comment on Your Note' : `New Comment on "${val.title}"`,
                      message: `${latestComment.author}: "${latestComment.text}"`,
                      type: 'note'
                    }
                  }));
                }
              }
            }
            const updated = prev.map(n => n.id === val.id ? val : n);
            updated.sort((a, b) => b.date.localeCompare(a.date));
            return updated;
          });
        }
      });

      const onNoteRemoved = onChildRemoved(notesRef, (snap) => {
        const val = snap.val();
        if (val) {
          setNotes(prev => prev.filter(n => n.id !== val.id));
        }
      });

      // 2. Subscribe to community channels incrementally
      const channelsRef = ref(db, 'community_channels');
      
      get(channelsRef).then((snap) => {
        if (!snap.exists() || !snap.val()) {
          initDefaultChannels();
        }
      });

      const onChanAdded = onChildAdded(channelsRef, (snap) => {
        const val = snap.val();
        if (val) {
          setChannels(prev => {
            if (prev.some(c => c.id === val.id)) return prev;
            return [...prev, val];
          });
        }
      });

      const onChanChanged = onChildChanged(channelsRef, (snap) => {
        const val = snap.val();
        if (val) {
          setChannels(prev => {
            const oldChan = prev.find(c => c.id === val.id);
            const valMsgs = Array.isArray(val.messages) ? val.messages : Object.values(val.messages || {});
            const oldMsgs = oldChan ? (Array.isArray(oldChan.messages) ? oldChan.messages : Object.values(oldChan.messages || {})) : [];
            
            if (oldChan && valMsgs.length > oldMsgs.length) {
              const lastMsg = valMsgs[valMsgs.length - 1];
              if (lastMsg && lastMsg.senderEmail !== userEmail) {
                const isMention = lastMsg.text.includes(`@${userName}`) || lastMsg.text.includes(`@${userEmail}`);
                window.dispatchEvent(new CustomEvent('new-notification', {
                  detail: {
                    title: isMention ? 'You were mentioned!' : `New Message in #${val.name}`,
                    message: `${lastMsg.sender}: ${lastMsg.text}`,
                    type: isMention ? 'mention' : 'message'
                  }
                }));
              }
            }
            return prev.map(c => c.id === val.id ? val : c);
          });
        }
      });

      const onChanRemoved = onChildRemoved(channelsRef, (snap) => {
        const val = snap.val();
        if (val) {
          setChannels(prev => prev.filter(c => c.id !== val.id));
        }
      });

      // 3. Subscribe to study groups incrementally
      const groupsRef = ref(db, 'community_groups');
      
      get(groupsRef).then((snap) => {
        if (!snap.exists() || !snap.val()) {
          initDefaultGroups();
        }
      });

      const onGpAdded = onChildAdded(groupsRef, (snap) => {
        const rawVal = snap.val();
        if (rawVal) {
          const val = {
            id: rawVal.metadata?.id || snap.key,
            name: rawVal.metadata?.name || '',
            members: rawVal.members || {},
            messages: rawVal.messages || {},
            notes: rawVal.metadata?.notes || [],
            pdfs: rawVal.metadata?.pdfs || []
          };
          setGroups(prev => {
            if (prev.some(g => g.id === val.id)) return prev;
            return [...prev, val];
          });
        }
      });

      const onGpChanged = onChildChanged(groupsRef, (snap) => {
        const rawVal = snap.val();
        if (rawVal) {
          const val = {
            id: rawVal.metadata?.id || snap.key,
            name: rawVal.metadata?.name || '',
            members: rawVal.members || {},
            messages: rawVal.messages || {},
            notes: rawVal.metadata?.notes || [],
            pdfs: rawVal.metadata?.pdfs || []
          };
          setGroups(prev => {
            const oldGroup = prev.find(g => g.id === val.id);
            const valMsgs = Array.isArray(val.messages) ? val.messages : Object.values(val.messages || {});
            const oldMsgs = oldGroup ? (Array.isArray(oldGroup.messages) ? oldGroup.messages : Object.values(oldGroup.messages || {})) : [];
            
            if (oldGroup && valMsgs.length > oldMsgs.length) {
              const lastMsg = valMsgs[valMsgs.length - 1];
              if (lastMsg && lastMsg.senderEmail !== userEmail) {
                const isMention = lastMsg.text.includes(`@${userName}`) || lastMsg.text.includes(`@${userEmail}`);
                window.dispatchEvent(new CustomEvent('new-notification', {
                  detail: {
                    title: isMention ? 'You were mentioned!' : `New Message in ${val.name}`,
                    message: `${lastMsg.sender}: ${lastMsg.text}`,
                    type: isMention ? 'mention' : 'message'
                  }
                }));
              }
            }
            return prev.map(g => g.id === val.id ? val : g);
          });
        }
      });

      const onGpRemoved = onChildRemoved(groupsRef, (snap) => {
        const rawVal = snap.val();
        const groupId = rawVal?.metadata?.id || snap.key;
        if (groupId) {
          setGroups(prev => prev.filter(g => g.id !== groupId));
        }
      });

      // 4. Subscribe to presence users
      const usersRef = ref(db, 'community_users');
      const unsubUsers = onValue(usersRef, (snap) => {
        const val = snap.val() || {};
        const list = Object.keys(val).map(key => val[key]);
        setPresenceUsers(list);
      });

      return () => {
        onNoteAdded();
        onNoteChanged();
        onNoteRemoved();
        onChanAdded();
        onChanChanged();
        onChanRemoved();
        onGpAdded();
        onGpChanged();
        onGpRemoved();
        unsubUsers();
      };
    }
  }, [isFirebaseConfigured, reconnectKey]);

  // Load messages for current active channel/group/DM on demand incrementally using onChildAdded
  useEffect(() => {
    setActiveChatMessages([]); // clear old messages
    if (!isFirebaseConfigured || !db) return;
    if (activeItem.type === 'feed') return;

    let path = '';
    if (activeItem.type === 'channel') {
      path = `community_channels/${activeItem.id}/messages`;
    } else if (activeItem.type === 'group') {
      path = `community_groups/${activeItem.id}/messages`;
    } else if (activeItem.type === 'dm') {
      const chatId = getDmChatId(userEmail, activeItem.id);
      path = `private_chats/${chatId}/messages`;
    }

    if (!path) return;

    const messagesRef = ref(db, path);
    const mountTime = Date.now();
    
    const unsub = onChildAdded(messagesRef, (snap) => {
      const val = snap.val();
      if (val) {
        setActiveChatMessages(prev => {
          if (prev.some(m => m.id === val.id)) return prev;
          return [...prev, val];
        });

        // Trigger notification for new messages received after mounting
        if (val.timestamp > mountTime && val.senderEmail !== userEmail) {
          const isMention = val.text.includes(`@${userName}`) || val.text.includes(`@${userEmail}`);
          window.dispatchEvent(new CustomEvent('new-notification', {
            detail: {
              title: activeItem.type === 'dm' 
                ? `Direct Message from ${val.sender}` 
                : (isMention ? 'You were mentioned!' : `New Message in ${activeItem.type === 'channel' ? '#' : ''}${activeItem.id}`),
              message: val.text,
              type: isMention ? 'mention' : 'message'
            }
          }));
        }
      }
    });

    // Mark DM messages as read if activeItem is a DM
    if (activeItem.type === 'dm') {
      const chatId = getDmChatId(userEmail, activeItem.id);
      get(ref(db, `private_chats/${chatId}/messages`)).then((snap) => {
        if (snap.exists()) {
          const val = snap.val();
          const updates: any = {};
          Object.entries(val).forEach(([key, msg]: [string, any]) => {
            if (msg.senderEmail !== userEmail && !msg.read) {
              updates[`/private_chats/${chatId}/messages/${key}/read`] = true;
            }
          });
          update(ref(db), updates).catch(() => {});
        }
      });
    }

    return () => {
      unsub();
    };
  }, [activeItem, userEmail, isFirebaseConfigured, reconnectKey]);


  // DM Typing sync
  useEffect(() => {
    if (activeItem.type !== 'dm') return;
    const chatId = getDmChatId(userEmail, activeItem.id);
    const otherUserSlug = activeItem.id.replace(/\./g, '_');

    if (isFirebaseConfigured && db) {
      const docRef = ref(db, 'private_chats/' + chatId);
      const unsub = onValue(docRef, (snap) => {
        if (snap.exists()) {
          const snapVal = snap.val() || {};
          const typingMap = snapVal.typing || {};
          setActiveChatTyping(!!typingMap[otherUserSlug]);
        } else {
          setActiveChatTyping(false);
        }
      });
      return () => unsub();
    }
  }, [activeItem, userEmail, isFirebaseConfigured, reconnectKey]);


  // Auto Scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatMessages, channels, groups, activeItem, wsTab]);

  // DB initialization helpers
  const initDefaultChannels = async () => {
    if (!isFirebaseConfigured || !db) return;
    const defaults = [
      { id: 'chan_general', name: 'general', messages: [], notes: [], pdfs: [] },
      { id: 'chan_placements', name: 'placements', messages: [], notes: [], pdfs: [] },
      { id: 'chan_coding', name: 'coding-help', messages: [], notes: [], pdfs: [] },
      { id: 'chan_internships', name: 'internships', messages: [], notes: [], pdfs: [] }
    ];
    for (const chan of defaults) {
      await set(ref(db, 'community_channels/' + chan.id), chan);
    }
  };

  const initDefaultGroups = async () => {
    if (!isFirebaseConfigured || !db) return;
    const defaults = [
      { id: 'group_java', name: 'Java Group' },
      { id: 'group_python', name: 'Python Club' },
      { id: 'group_ml', name: 'Machine Learning Club' }
    ];
    for (const gp of defaults) {
      await set(ref(db, `community_groups/${gp.id}/metadata`), {
        id: gp.id,
        name: gp.name,
        notes: [],
        pdfs: []
      });
      // Initial members is empty
      await set(ref(db, `community_groups/${gp.id}/members`), {});
      // Send initial system message
      const sysMsg = {
        id: `sys_init_${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@roomie.io',
        text: `Group "${gp.name}" initialized.`,
        timestamp: Date.now()
      };
      await push(ref(db, `community_groups/${gp.id}/messages`), sysMsg);
    }
  };

  const getDmChatId = (email1: string, email2: string) => {
    const slug1 = email1.replace(/\./g, '_');
    const slug2 = email2.replace(/\./g, '_');
    return [slug1, slug2].sort().join('_vs_');
  };

  // Uploader for Global Feed Notes
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError('');
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported.');
      setPdfFile(null);
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setUploadError('PDF exceeds 1.5MB limit.');
      setPdfFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPdfFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        dataUrl: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  // Uploader for Workspace (Channels / Groups)
  const handleWsPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setWsPdfError('');
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setWsPdfError('Only PDF files are supported.');
      setWsPdfFile(null);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setWsPdfError('PDF exceeds 2MB limit.');
      setWsPdfFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setWsPdfFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        dataUrl: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  // Create Global Note
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let pdfUrl = '';
    if (pdfFile) {
      try {
        pdfUrl = await uploadPdf(pdfFile.name, pdfFile.dataUrl, userEmail);
      } catch (err) {
        console.error('PDF upload failed:', err);
      }
    }

    const newNote: StudyNote = {
      id: noteId,
      title,
      content,
      course,
      author: userName,
      authorEmail: userEmail,
      likes: 0,
      date: new Date().toLocaleDateString(),
      comments: [],
      pdfAttachment: pdfFile ? { name: pdfFile.name, size: pdfFile.size, url: pdfUrl } : undefined
    };

    if (isFirebaseConfigured && db) {
      try {
        await set(ref(db, 'shared_notes/' + noteId), newNote);
      } catch (err) {
        console.error('Database save note error:', err);
      }
    }

    setTitle('');
    setContent('');
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    onRewardXp(75, `Published study notes: "${newNote.title}"!`);
  };

  // Like Global Note
  const handleLikeNote = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    if (isFirebaseConfigured && db) {
      try {
        const noteRef = ref(db, 'shared_notes/' + noteId);
        await update(noteRef, {
          likes: (note.likes || 0) + 1
        });
      } catch (err) {
        console.error('Database update note likes error:', err);
      }
    }
  };

  // Bookmark Global Note
  const handleToggleBookmark = async (noteId: string) => {
    let updated;
    if (bookmarks.includes(noteId)) {
      updated = bookmarks.filter(id => id !== noteId);
    } else {
      updated = [...bookmarks, noteId];
    }
    setBookmarks(updated);
    if (isFirebaseConfigured && db) {
      const userKey = userEmail.replace(/\./g, '_');
      await set(ref(db, 'bookmarks/' + userKey), updated);
    }
  };

  // Add Comment on Note
  const handleAddComment = async (noteId: string) => {
    if (!commentText.trim()) return;

    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      author: userName,
      authorEmail: userEmail,
      text: commentText,
      timestamp: Date.now()
    };

    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const updatedComments = [...(note.comments || []), newComment];

    if (isFirebaseConfigured && db) {
      try {
        await update(ref(db, 'shared_notes/' + noteId), {
          comments: updatedComments
        });
      } catch (err) {
        console.error('Database save comment error:', err);
      }
    }

    setCommentText('');
  };

  // AI Summary Scan
  const handleTriggerSummary = (note: StudyNote) => {
    setActiveSummaryNote(note);
    setSummarizing(true);
    setTimeout(() => {
      setSummarizing(false);
    }, 800);
  };

  // Custom Channel Creation
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const channelSlug = newChannelName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const newChan = {
      id: `chan_${Date.now()}`,
      name: channelSlug,
      messages: [],
      notes: [],
      pdfs: []
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, 'community_channels/' + newChan.id), newChan);
    }

    setNewChannelName('');
    setShowCreateChannelModal(false);
    setActiveItem({ type: 'channel', id: newChan.id });
    onRewardXp(40, `Created public channel #${channelSlug}!`);
  };

  // Custom Group Creation
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot create study groups.");
      return;
    }
    if (!newGroupName.trim()) return;

    const groupId = `group_${Date.now()}`;
    const userSlug = userEmail.replace(/\./g, '_');
    
    const initialMessage = {
      id: `sys_create_${Date.now()}`,
      sender: 'System',
      senderEmail: 'system@roomie.io',
      text: `Study group "${newGroupName}" was created by ${userName}.`,
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${groupId}/metadata`), {
        id: groupId,
        name: newGroupName,
        notes: [],
        pdfs: []
      });
      await set(ref(db, `community_groups/${groupId}/members/${userSlug}`), true);
      await push(ref(db, `community_groups/${groupId}/messages`), initialMessage);
    }

    setNewGroupName('');
    setShowCreateGroupModal(false);
    setActiveItem({ type: 'group', id: groupId });
    onRewardXp(50, `Formed new study group "${newGroupName}"!`);
  };

  // Join / Leave Study Group
  const handleToggleJoinGroup = async (groupId: string) => {
    const gp = groups.find(g => g.id === groupId);
    if (!gp) return;

    const gpMembers = Array.isArray(gp.members)
      ? gp.members
      : (gp.members ? Object.keys(gp.members).map(k => k.replace(/_/g, '.')) : []);

    const isMember = gpMembers.includes(userEmail);
    const userSlug = userEmail.replace(/\./g, '_');

    const sysMsg = {
      id: `sys_${Date.now()}`,
      sender: 'System',
      senderEmail: 'system@roomie.io',
      text: `${userName} has ${isMember ? 'left' : 'joined'} the group.`,
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      await set(ref(db, `community_groups/${groupId}/members/${userSlug}`), isMember ? null : true);
      await push(ref(db, `community_groups/${groupId}/messages`), sysMsg);
    }
  };

  // Send message in Workspace or DM
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;

    const newMsg = {
      id: `msg_${Date.now()}_${Math.random()}`,
      sender: userName,
      senderEmail: userEmail,
      text: chatInputText,
      timestamp: Date.now(),
      read: false
    };

    if (isFirebaseConfigured && db) {
      if (activeItem.type === 'channel') {
        await push(ref(db, `community_channels/${activeItem.id}/messages`), newMsg);
      } else if (activeItem.type === 'group') {
        await push(ref(db, `community_groups/${activeItem.id}/messages`), newMsg);
      } else if (activeItem.type === 'dm') {
        const chatId = getDmChatId(userEmail, activeItem.id);
        await push(ref(db, `private_chats/${chatId}/messages`), newMsg);
      }
    }

    setChatInputText('');
    updateTypingStatus(false);
  };
  // Typing status update helper
  const updateTypingStatus = async (typing: boolean) => {
    if (activeItem.type !== 'dm') return;
    const chatId = getDmChatId(userEmail, activeItem.id);
    const mySlug = userEmail.replace(/\./g, '_');

    if (isFirebaseConfigured && db) {
      const docRef = ref(db, 'private_chats/' + chatId + '/typing');
      try {
        await update(docRef, {
          [mySlug]: typing
        });
      } catch (e) {}
    }
  };

  const typingTimeoutRef = useRef<any>(null);
  const handleInputChange = (text: string) => {
    setChatInputText(text);
    if (activeItem.type === 'dm') {
      updateTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 1500);
    }
  };

  // Share Note inside Workspace (Channels / Groups)
  const handleShareNoteInWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsTitle || !wsContent) return;

    const noteId = `ws_note_${Date.now()}`;
    let pdfUrl = '';
    if (wsPdfFile) {
      try {
        pdfUrl = await uploadPdf(wsPdfFile.name, wsPdfFile.dataUrl, userEmail);
      } catch (err) {
        console.error('PDF upload failed:', err);
      }
    }

    const newNote = {
      id: noteId,
      title: wsTitle,
      content: wsContent,
      course: wsSubject,
      author: userName,
      authorEmail: userEmail,
      date: new Date().toISOString().split('T')[0],
      likes: 0,
      comments: [],
      pdfAttachment: wsPdfFile ? { name: wsPdfFile.name, size: wsPdfFile.size, url: pdfUrl } : undefined
    };

    const sysMsg = {
      id: `sys_note_${Date.now()}`,
      sender: 'System',
      senderEmail: 'system@roomie.io',
      text: `${userName} published a workspace note: "${wsTitle}".`,
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      if (activeItem.type === 'channel') {
        await push(ref(db, `community_channels/${activeItem.id}/notes`), newNote);
        await push(ref(db, `community_channels/${activeItem.id}/messages`), sysMsg);
        onRewardXp(25, `Shared note in #${channels.find(c => c.id === activeItem.id)?.name || ''}!`);
      } else if (activeItem.type === 'group') {
        await push(ref(db, `community_groups/${activeItem.id}/notes`), newNote);
        await push(ref(db, `community_groups/${activeItem.id}/messages`), sysMsg);
        onRewardXp(25, `Shared note in study group ${groups.find(g => g.id === activeItem.id)?.name || ''}!`);
      }
    }

    setWsTitle('');
    setWsContent('');
    setWsPdfFile(null);
    if (wsFileInputRef.current) wsFileInputRef.current.value = '';
  };

  // Share PDF inside Workspace (Channels / Groups)
  const handleSharePdfInWorkspace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      const pdfId = `ws_pdf_${Date.now()}`;
      let pdfUrl = '';
      try {
        pdfUrl = await uploadPdf(file.name, reader.result as string, userEmail);
      } catch (err) {
        console.error('PDF upload failed:', err);
      }
      const newPdf = {
        id: pdfId,
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        uploadedBy: userName,
        uploadedByEmail: userEmail,
        timestamp: Date.now(),
        url: pdfUrl
      };

      const sysMsg = {
        id: `sys_pdf_${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@roomie.io',
        text: `${userName} uploaded a PDF: "${file.name}".`,
        timestamp: Date.now()
      };

      if (isFirebaseConfigured && db) {
        if (activeItem.type === 'channel') {
          await push(ref(db, `community_channels/${activeItem.id}/pdfs`), newPdf);
          await push(ref(db, `community_channels/${activeItem.id}/messages`), sysMsg);
          onRewardXp(30, `Uploaded PDF to #${channels.find(c => c.id === activeItem.id)?.name || ''}!`);
        } else if (activeItem.type === 'group') {
          await push(ref(db, `community_groups/${activeItem.id}/pdfs`), newPdf);
          await push(ref(db, `community_groups/${activeItem.id}/messages`), sysMsg);
          onRewardXp(30, `Uploaded PDF to group ${groups.find(g => g.id === activeItem.id)?.name || ''}!`);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Filtering Notes for Feed
  const filteredNotes = notes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.author.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCourse = selectedCourseFilter === 'All' || n.course === selectedCourseFilter;
    
    let matchesType = true;
    if (filterType === 'bookmarks') {
      matchesType = bookmarks.includes(n.id);
    } else if (filterType === 'my-notes') {
      matchesType = n.authorEmail === userEmail;
    }

    return matchesSearch && matchesCourse && matchesType;
  });

  // Global search autocomplete results
  const matchingNotes = globalSearch.trim() === '' ? [] : notes.filter(n => 
    n.title.toLowerCase().includes(globalSearch.toLowerCase()) || 
    n.content.toLowerCase().includes(globalSearch.toLowerCase())
  ).slice(0, 3);

  const matchingChannels = globalSearch.trim() === '' ? [] : channels.filter(c => 
    c.name.toLowerCase().includes(globalSearch.toLowerCase())
  ).slice(0, 3);

  const matchingGroups = globalSearch.trim() === '' ? [] : groups.filter(g => 
    g.name.toLowerCase().includes(globalSearch.toLowerCase())
  ).slice(0, 3);

  const matchingUsers = globalSearch.trim() === '' ? [] : presenceUsers.filter(u => 
    u.email !== userEmail && 
    (u.name.toLowerCase().includes(globalSearch.toLowerCase()) || u.email.toLowerCase().includes(globalSearch.toLowerCase()))
  ).slice(0, 3);

  const currentChannel = activeItem.type === 'channel' ? channels.find(c => c.id === activeItem.id) : null;
  const currentGroup = activeItem.type === 'group' ? groups.find(g => g.id === activeItem.id) : null;
  const currentBuddy = activeItem.type === 'dm' ? presenceUsers.find(u => u.email === activeItem.id) : null;

  const currentChannelNotes = currentChannel ? (Array.isArray(currentChannel.notes) ? currentChannel.notes : Object.values(currentChannel.notes || {})) : [];
  const currentGroupNotes = currentGroup ? (Array.isArray(currentGroup.notes) ? currentGroup.notes : Object.values(currentGroup.notes || {})) : [];
  const currentChannelPdfs = currentChannel ? (Array.isArray(currentChannel.pdfs) ? currentChannel.pdfs : Object.values(currentChannel.pdfs || {})) : [];
  const currentGroupPdfs = currentGroup ? (Array.isArray(currentGroup.pdfs) ? currentGroup.pdfs : Object.values(currentGroup.pdfs || {})) : [];
  const currentGroupMembers = currentGroup ? (Array.isArray(currentGroup.members) ? currentGroup.members : Object.keys(currentGroup.members || {}).map(k => k.replace(/_/g, '.'))) : [];

  // Force Feed tab on mobile if subview is notes
  useEffect(() => {
    if (isMobile && activeSubView === 'notes') {
      setActiveItem({ type: 'feed', id: 'global' });
    }
  }, [isMobile, activeSubView]);

  const displaySidebar = !isMobile || (activeSubView === 'chat' && activeItem.type === 'feed');
  const displayWorkspace = !isMobile || (activeSubView === 'notes') || (activeSubView === 'chat' && activeItem.type !== 'feed');

  if (isServiceUnavailable) {
    return (
      <div className="glass-panel" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '76vh',
        width: '100%',
        background: '#fff3f5',
        border: '3px solid #000',
        borderRadius: '16px',
        boxShadow: '4px 4px 0px #000',
        textAlign: 'center',
        padding: '2rem',
        gap: '1rem'
      }}>
        <span style={{ fontSize: '3rem' }}>❌</span>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-pink)' }}>
          Realtime service unavailable
        </h2>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', maxWidth: '360px' }}>
          We could not establish a connection to our cloud server database. Please check your network connection or try logging in again.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      gap: isMobile ? '0' : '1.25rem',
      height: isMobile ? 'calc(100vh - 160px)' : '76vh',
      width: '100%',
      fontFamily: 'var(--font-body)',
      flexDirection: isMobile ? 'column' : 'row'
    }}>

      
      {/* 1. Left Sidebar Panel */}
      {displaySidebar && (
        <div style={{
          width: isMobile ? '100%' : '260px',
          background: '#fff',
          border: '3px solid #000',
          borderRadius: '16px',
          boxShadow: '4px 4px 0px #000',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>

        {/* Sidebar Header */}
        <div style={{
          padding: '0.75rem',
          borderBottom: '3px solid #000',
          background: 'var(--accent-purple)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem'
        }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>COMMUNITY HUB</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 900, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {userName}
          </span>
        </div>

        {/* Scrollable Nav Items */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {/* Feed Selectors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <button
              onClick={() => setActiveItem({ type: 'feed', id: 'global' })}
              style={{
                textAlign: 'left',
                width: '100%',
                padding: '0.5rem',
                border: activeItem.type === 'feed' ? '2px solid #000' : '2px solid transparent',
                borderRadius: '8px',
                background: activeItem.type === 'feed' ? '#fff9db' : 'none',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: activeItem.type === 'feed' ? '2px 2px 0px #000' : 'none'
              }}
            >
              🌐 General Notes Feed
            </button>
          </div>

          {/* Channels Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.35rem 0.25rem 0.35rem', borderBottom: '2.5px solid #000' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)' }}>PUBLIC CHANNELS</span>
              {!isGuest && (
                <button
                  onClick={() => setShowCreateChannelModal(true)}
                  style={{
                    background: '#fff',
                    border: '1.5px solid #000',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    padding: '0 0.3rem'
                  }}
                >
                  +
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
              {channels.map(chan => (
                <div key={chan.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <button
                    onClick={() => {
                      setActiveItem({ type: 'channel', id: chan.id });
                      setWsTab('chat');
                    }}
                    style={{
                      textAlign: 'left',
                      flex: 1,
                      padding: '0.4rem 0.5rem',
                      border: activeItem.type === 'channel' && activeItem.id === chan.id ? '2px solid #000' : '2px solid transparent',
                      borderRadius: '8px',
                      background: activeItem.type === 'channel' && activeItem.id === chan.id ? 'var(--accent-purple)' : 'none',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      boxShadow: activeItem.type === 'channel' && activeItem.id === chan.id ? '1.5px 1.5px 0px #000' : 'none'
                    }}
                  >
                    # {chan.name}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdminDeleteChannel(chan.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'red',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: 800,
                        marginLeft: '0.2rem',
                        padding: '0.2rem'
                      }}
                      title="Delete Channel"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Study Groups Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.35rem 0.25rem 0.35rem', borderBottom: '2.5px solid #000' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)' }}>STUDY GROUPS</span>
              {!isGuest && (
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  style={{
                    background: '#fff',
                    border: '1.5px solid #000',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    padding: '0 0.3rem'
                  }}
                >
                  +
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
              {groups.map(gp => {
                const gpMembers = Array.isArray(gp.members) ? gp.members : (gp.members ? Object.keys(gp.members).map(k => k.replace(/_/g, '.')) : []);
                const joined = gpMembers.includes(userEmail);
                return (
                  <div key={gp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <button
                      onClick={() => {
                        setActiveItem({ type: 'group', id: gp.id });
                        setWsTab('chat');
                      }}
                      style={{
                        textAlign: 'left',
                        flex: 1,
                        padding: '0.4rem 0.5rem',
                        border: activeItem.type === 'group' && activeItem.id === gp.id ? '2px solid #000' : '2px solid transparent',
                        borderRadius: '8px',
                        background: activeItem.type === 'group' && activeItem.id === gp.id ? 'var(--accent-pink)' : 'none',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        boxShadow: activeItem.type === 'group' && activeItem.id === gp.id ? '1.5px 1.5px 0px #000' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                        {gp.name}
                      </span>
                      <span style={{ fontSize: '0.55rem', background: '#000', color: '#fff', padding: '0.05rem 0.25rem', borderRadius: '4px' }}>
                        {joined ? 'IN' : gpMembers.length}
                      </span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdminDeleteGroup(gp.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'red',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: 800,
                          marginLeft: '0.2rem',
                          padding: '0.2rem'
                        }}
                        title="Delete Group"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* DM / Presence Users Section */}
          {isGuest ? (
            <div style={{
              background: '#ffeef2',
              border: '2.5px solid #000',
              borderRadius: '12px',
              padding: '0.65rem 0.8rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--accent-pink)',
              boxShadow: '3px 3px 0px #000',
              lineHeight: '1.4',
              marginTop: '0.75rem'
            }}>
              <span>🔒 CHAT LOCKED</span>
              <p style={{ fontSize: '0.65rem', margin: '0.35rem 0 0 0', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Private messaging and classmate chat is restricted for guest accounts. Register to connect!
              </p>
            </div>
          ) : (
            <>
              {/* Friends Section */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ padding: '0 0.35rem 0.25rem 0.35rem', borderBottom: '2.5px solid #000' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)' }}>MY FRIENDS</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
                  {presenceUsers
                    .filter(u => u.email !== userEmail && friendsList.includes(u.email))
                    .map(buddy => {
                      const isOnline = buddy.online;
                      return (
                        <div
                          key={buddy.email}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.2rem 0.35rem',
                            borderRadius: '8px',
                            background: activeItem.type === 'dm' && activeItem.id === buddy.email ? 'var(--accent-cyan)' : 'none',
                            border: activeItem.type === 'dm' && activeItem.id === buddy.email ? '2px solid #000' : '2px solid transparent',
                            boxShadow: activeItem.type === 'dm' && activeItem.id === buddy.email ? '1.5px 1.5px 0px #000' : 'none'
                          }}
                        >
                          <button
                            onClick={() => setActiveItem({ type: 'dm', id: buddy.email })}
                            style={{
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              flex: 1,
                              overflow: 'hidden'
                            }}
                          >
                            <span style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: isOnline ? 'var(--accent-green)' : '#94a3b8',
                              border: '1px solid #000',
                              display: 'inline-block'
                            }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              ⭐ {buddy.name}
                            </span>
                          </button>
                          {!isGuest && (
                            <button
                              onClick={() => handleToggleFriend(buddy.email)}
                              title="Remove Friend"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '0 0.2rem',
                                fontWeight: 900
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  {presenceUsers.filter(u => u.email !== userEmail && friendsList.includes(u.email)).length === 0 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', display: 'block', padding: '0.5rem 0' }}>No friends added yet.</span>
                  )}
                </div>
              </div>

              {/* Classmates Section */}
              <div>
                <div style={{ padding: '0 0.35rem 0.25rem 0.35rem', borderBottom: '2.5px solid #000' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)' }}>CLASSMATES (ONLINE)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
                  {presenceUsers
                    .filter(u => u.email !== userEmail && !friendsList.includes(u.email))
                    .map(buddy => {
                      const isOnline = buddy.online;
                      return (
                        <div
                          key={buddy.email}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.2rem 0.35rem',
                            borderRadius: '8px',
                            background: activeItem.type === 'dm' && activeItem.id === buddy.email ? 'var(--accent-cyan)' : 'none',
                            border: activeItem.type === 'dm' && activeItem.id === buddy.email ? '2px solid #000' : '2px solid transparent',
                            boxShadow: activeItem.type === 'dm' && activeItem.id === buddy.email ? '1.5px 1.5px 0px #000' : 'none'
                          }}
                        >
                          <button
                            onClick={() => setActiveItem({ type: 'dm', id: buddy.email })}
                            style={{
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              flex: 1,
                              overflow: 'hidden'
                            }}
                          >
                            <span style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: isOnline ? 'var(--accent-green)' : '#94a3b8',
                              border: '1px solid #000',
                              display: 'inline-block'
                            }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {buddy.name}
                            </span>
                          </button>
                          {!isGuest && (
                            <button
                              onClick={() => handleToggleFriend(buddy.email)}
                              title="Add Friend"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                padding: '0 0.2rem',
                                color: 'var(--accent-purple)',
                                fontWeight: 900
                              }}
                            >
                              ＋
                            </button>
                          )}
                        </div>
                      );
                    })}
                  {presenceUsers.filter(u => u.email !== userEmail && !friendsList.includes(u.email)).length === 0 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', display: 'block', padding: '0.5rem 0' }}>No other classmates online.</span>
                  )}
                </div>
              </div>
            </>
          )}


        </div>
      </div>
      )}

      {/* 2. Main Workspace Panel */}
      <div style={{
        flex: 1,
        background: '#fff',
        border: '3px solid #000',
        borderRadius: '16px',
        boxShadow: '4px 4px 0px #000',
        display: displayWorkspace ? 'flex' : 'none',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%'
      }}>

        {/* Workspace Main Top Header with Global Search */}
        <div style={{
          padding: '0.6rem 1rem',
          borderBottom: '3px solid #000',
          background: '#fafafa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative'
        }}>
          <h2 style={{
            fontSize: '1rem',
            fontWeight: 900,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {isMobile && activeSubView === 'chat' && activeItem.type !== 'feed' && (
              <button
                onClick={() => setActiveItem({ type: 'feed', id: 'global' })}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  padding: '0 0.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 900
                }}
              >
                ←
              </button>
            )}
            {activeItem.type === 'feed' && '🌐 GLOBAL COMMUNITY FEED'}
            {activeItem.type === 'channel' && `# ${currentChannel?.name || 'channel'}`}
            {activeItem.type === 'group' && `👥 ${currentGroup?.name || 'study-group'}`}
            {activeItem.type === 'dm' && `💬 DM WITH ${currentBuddy?.name || activeItem.id}`}
          </h2>


          {/* Global Search Input Box */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Global search..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="cyber-input"
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                width: '180px'
              }}
            />
            {globalSearch.trim() !== '' && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                width: '280px',
                background: '#fff',
                border: '2.5px solid #000',
                borderRadius: '8px',
                boxShadow: '4px 4px 0px #000',
                zIndex: 9999,
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                marginTop: '0.3rem',
                maxHeight: '260px',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-muted)' }}>MATCHES</span>
                  <button onClick={() => setGlobalSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 900 }}>✕</button>
                </div>
                
                {matchingNotes.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.55rem', fontWeight: 900, borderBottom: '1px solid #000', paddingBottom: '0.1rem' }}>NOTES</div>
                    {matchingNotes.map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setActiveItem({ type: 'feed', id: 'global' });
                          setSearchQuery(n.title);
                          setGlobalSearch('');
                        }}
                        style={{ padding: '0.2rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                      >
                        📄 {n.title}
                      </div>
                    ))}
                  </div>
                )}

                {matchingChannels.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.55rem', fontWeight: 900, borderBottom: '1px solid #000', paddingBottom: '0.1rem' }}>CHANNELS</div>
                    {matchingChannels.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setActiveItem({ type: 'channel', id: c.id });
                          setGlobalSearch('');
                        }}
                        style={{ padding: '0.2rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                      >
                        # {c.name}
                      </div>
                    ))}
                  </div>
                )}

                {matchingGroups.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.55rem', fontWeight: 900, borderBottom: '1px solid #000', paddingBottom: '0.1rem' }}>GROUPS</div>
                    {matchingGroups.map(g => (
                      <div
                        key={g.id}
                        onClick={() => {
                          setActiveItem({ type: 'group', id: g.id });
                          setGlobalSearch('');
                        }}
                        style={{ padding: '0.2rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                      >
                        👥 {g.name}
                      </div>
                    ))}
                  </div>
                )}

                {matchingUsers.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.55rem', fontWeight: 900, borderBottom: '1px solid #000', paddingBottom: '0.1rem' }}>CLASSMATES</div>
                    {matchingUsers.map(u => (
                      <div
                        key={u.email}
                        onClick={() => {
                          setActiveItem({ type: 'dm', id: u.email });
                          setGlobalSearch('');
                        }}
                        style={{ padding: '0.2rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                      >
                        👤 {u.name}
                      </div>
                    ))}
                  </div>
                )}

                {matchingNotes.length === 0 && matchingChannels.length === 0 && matchingGroups.length === 0 && matchingUsers.length === 0 && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>No matches found.</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Workspace Workspace View Panels */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          
          {/* ========================================== */}
          {/* TAB PANEL: FEED VIEW                      */}
          {/* ========================================== */}
          {activeItem.type === 'feed' && (
            <div style={{
              display: 'flex',
              height: '100%',
              overflow: 'hidden',
              padding: '0.75rem',
              gap: isMobile ? '0.5rem' : '0.75rem',
              flexDirection: isMobile ? 'column' : 'row'
            }}>
              {isMobile && (
                <div style={{ display: 'flex', gap: '0.4rem', width: '100%', marginBottom: '0.2rem' }}>
                  <button
                    onClick={() => setMobileFeedTab('feed')}
                    style={{
                      flex: 1,
                      background: mobileFeedTab === 'feed' ? 'var(--accent-purple)' : '#fff',
                      border: '2px solid #000',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      padding: '0.45rem 0',
                      cursor: 'pointer',
                      boxShadow: mobileFeedTab === 'feed' ? '1.5px 1.5px 0px #000' : 'none'
                    }}
                  >
                    📚 VIEW FEED
                  </button>
                  <button
                    onClick={() => setMobileFeedTab('create')}
                    style={{
                      flex: 1,
                      background: mobileFeedTab === 'create' ? 'var(--accent-cyan)' : '#fff',
                      border: '2px solid #000',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      padding: '0.45rem 0',
                      cursor: 'pointer',
                      boxShadow: mobileFeedTab === 'create' ? '1.5px 1.5px 0px #000' : 'none'
                    }}
                  >
                    ✍️ PUBLISH NOTE
                  </button>
                </div>
              )}

              {/* Note creator column */}
              {(!isMobile || mobileFeedTab === 'create') && (
                <div style={{ width: isMobile ? '100%' : '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                <div style={{
                  background: '#fffcf0',
                  border: '2.5px solid #000',
                  borderRadius: '12px',
                  padding: '0.75rem',
                  boxShadow: '3px 3px 0px #000'
                }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 900, borderBottom: '2px solid #000', paddingBottom: '0.25rem' }}>
                    PUBLISH STUDY NOTES
                  </h3>
                  {isGuest ? (
                    <div style={{ padding: '1rem', background: '#ffeef2', border: '2.5px solid #000', borderRadius: '12px', textAlign: 'center', boxShadow: '3px 3px 0px #000' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--accent-pink)' }}>🔒 ACCOUNT REQUIRED</span>
                      <p style={{ fontSize: '0.7rem', margin: '0.5rem 0', fontWeight: 700 }}>Guest users cannot publish notes or upload PDFs. Register an account to share materials!</p>
                    </div>
                  ) : (
                    <form onSubmit={handleCreateNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)' }}>NOTE TITLE</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Calculus Derivatives" 
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="cyber-input" 
                          required
                          style={{ padding: '0.4rem', fontSize: '0.75rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)' }}>SUBJECT</label>
                        <select
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.4rem',
                            border: '2.5px solid #000',
                            borderRadius: '8px',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            background: '#fff'
                          }}
                        >
                          {coursesList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)' }}>NOTE CONTENT</label>
                        <textarea 
                          rows={4}
                          placeholder="Type definitions or definitions here..."
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.4rem',
                            border: '2.5px solid #000',
                            borderRadius: '8px',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            resize: 'none'
                          }}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                          ATTACH STUDY PDF (MAX 1.5MB)
                        </label>
                        <input 
                          type="file" 
                          accept="application/pdf"
                          ref={fileInputRef}
                          onChange={handlePdfUpload}
                          style={{ width: '100%', fontSize: '0.65rem' }}
                        />
                        {uploadError && <span style={{ fontSize: '0.6rem', color: 'var(--accent-pink)', fontWeight: 800 }}>Error: {uploadError}</span>}
                        {pdfFile && <span style={{ fontSize: '0.6rem', color: '#009688', fontWeight: 800 }}>Selected: {pdfFile.name}</span>}
                      </div>

                      <button type="submit" className="cyber-btn pink-fill" style={{ width: '100%', padding: '0.5rem', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                        PUBLISH & GET XP
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}


              {/* Feed scrollable column */}
              {(!isMobile || mobileFeedTab === 'feed') && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
                {/* Filter section */}
                <div style={{
                  background: '#fff',
                  border: '2.5px solid #000',
                  borderRadius: '12px',
                  padding: '0.5rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  boxShadow: '3px 3px 0px #000'
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Search notes feed..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="cyber-input"
                      style={{ flex: 1, padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      <button
                        onClick={() => setFilterType('all')}
                        style={{
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          border: '2px solid #000',
                          borderRadius: '6px',
                          background: filterType === 'all' ? 'var(--accent-purple)' : '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        ALL
                      </button>
                      <button
                        onClick={() => setFilterType('bookmarks')}
                        style={{
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          border: '2px solid #000',
                          borderRadius: '6px',
                          background: filterType === 'bookmarks' ? 'var(--accent-gold)' : '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        BOOKMARKS
                      </button>
                      <button
                        onClick={() => setFilterType('my-notes')}
                        style={{
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          border: '2px solid #000',
                          borderRadius: '6px',
                          background: filterType === 'my-notes' ? 'var(--accent-cyan)' : '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        MY NOTES
                      </button>
                    </div>
                  </div>

                  {/* Subject filter slider */}
                  <div style={{ display: 'flex', gap: '0.3rem', overflowX: 'auto', paddingBottom: '0.1rem' }}>
                    {['All', ...coursesList].map(c => (
                      <button
                        key={c}
                        onClick={() => setSelectedCourseFilter(c)}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          border: '1.5px solid #000',
                          borderRadius: '6px',
                          background: selectedCourseFilter === c ? 'var(--accent-pink)' : '#fff',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        {c.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes List Scroll container */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.2rem' }}>
                  {filteredNotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      NO NOTES FOUND
                    </div>
                  ) : (
                    filteredNotes.map(note => {
                      const commentThreadOpen = commentingNoteId === note.id;
                      const isBookmarked = bookmarks.includes(note.id);
                      return (
                        <div
                          key={note.id}
                          style={{
                            background: '#fff',
                            border: '2.5px solid #000',
                            borderRadius: '12px',
                            padding: '0.75rem',
                            boxShadow: '3px 3px 0px #000',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 900, background: 'var(--accent-gold)', border: '1.5px solid #000', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                              {note.course.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                              By {note.author} • {note.date}
                            </span>
                          </div>

                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900 }}>{note.title}</h4>
                          <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: '1.35', color: 'var(--text-secondary)' }}>{note.content}</p>

                          {note.pdfAttachment && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e0f7fa', border: '1.5px solid #000', borderRadius: '6px', padding: '0.25rem 0.5rem', marginTop: '0.1rem' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                PDF: {note.pdfAttachment.name} ({note.pdfAttachment.size})
                              </span>
                              <button
                                onClick={() => downloadPdfContent(note.pdfAttachment!.url || note.id, note.pdfAttachment!.name)}
                                style={{
                                  background: 'var(--accent-pink)',
                                  border: '1.5px solid #000',
                                  borderRadius: '5px',
                                  padding: '0.15rem 0.4rem',
                                  fontSize: '0.55rem',
                                  color: '#fff',
                                  fontWeight: 900,
                                  cursor: 'pointer'
                                }}
                              >
                                GET
                              </button>
                            </div>
                          )}

                          {/* Footer Actions */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eaeaea', paddingTop: '0.4rem', marginTop: '0.1rem' }}>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <button
                                onClick={() => handleLikeNote(note.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                              >
                                👍 {note.likes || 0}
                              </button>
                              <button
                                onClick={() => setCommentingNoteId(commentThreadOpen ? null : note.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                              >
                                💬 {note.comments?.length || 0} Comments
                              </button>
                              <button
                                onClick={() => handleToggleBookmark(note.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 900 }}
                              >
                                {isBookmarked ? '⭐ Bookmarked' : '☆ Bookmark'}
                              </button>
                            </div>

                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button
                                onClick={() => handleTriggerSummary(note)}
                                style={{
                                  background: 'var(--accent-cyan)',
                                  border: '1.5px solid #000',
                                  borderRadius: '6px',
                                  padding: '0.15rem 0.4rem',
                                  fontSize: '0.65rem',
                                  fontWeight: 900,
                                  cursor: 'pointer',
                                  boxShadow: '1.5px 1.5px 0px #000'
                                }}
                              >
                                AI SCAN
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleAdminDeleteNote(note.id)}
                                  style={{
                                    background: 'var(--accent-pink)',
                                    border: '1.5px solid #000',
                                    borderRadius: '6px',
                                    padding: '0.15rem 0.4rem',
                                    fontSize: '0.65rem',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    boxShadow: '1.5px 1.5px 0px #000'
                                  }}
                                >
                                  DELETE
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Comment Thread Panel */}
                          {commentThreadOpen && (
                            <div style={{ borderTop: '1.5px dashed #000', paddingTop: '0.5rem', marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '120px', overflowY: 'auto', background: '#fafafa', borderRadius: '6px', padding: '0.3rem' }}>
                                {(note.comments || []).length === 0 ? (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>No comments yet.</span>
                                ) : (
                                  (note.comments || []).map(c => (
                                    <div key={c.id} style={{ fontSize: '0.68rem', display: 'flex', flexDirection: 'column', gap: '0.05rem', borderBottom: '1px solid #eee', paddingBottom: '0.15rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                                        <span>{c.author}</span>
                                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                      <span>{c.text}</span>
                                    </div>
                                  ))
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '0.3rem' }}>
                                <input
                                  type="text"
                                  placeholder="Add a comment..."
                                  value={commentText}
                                  onChange={(e) => setCommentText(e.target.value)}
                                  className="cyber-input"
                                  style={{ flex: 1, padding: '0.25rem', fontSize: '0.7rem' }}
                                />
                                <button
                                  onClick={() => handleAddComment(note.id)}
                                  className="cyber-btn pink-fill"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                >
                                  REPLY
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}


          {/* ========================================== */}
          {/* TAB PANEL: CHANNEL / GROUP VIEW           */}
          {/* ========================================== */}
          {(activeItem.type === 'channel' || activeItem.type === 'group') && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Channel / Group subtab headers */}
              <div style={{
                display: 'flex',
                background: '#fff',
                borderBottom: '2.5px solid #000',
                padding: '0.3rem 0.5rem',
                gap: '0.3rem'
              }}>
                {(['chat', 'notes', 'pdfs', 'members'] as const).map(tab => {
                  if (tab === 'members' && activeItem.type === 'channel') return null;
                  return (
                    <button
                      key={tab}
                      onClick={() => setWsTab(tab)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-heading)',
                        background: wsTab === tab ? 'var(--accent-purple)' : 'none',
                        border: wsTab === tab ? '2px solid #000' : '2px solid transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        boxShadow: wsTab === tab ? '1.5px 1.5px 0px #000' : 'none'
                      }}
                    >
                      {tab.toUpperCase()}
                    </button>
                  );
                })}
              </div>

              {/* Tab views content area */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0.75rem' }}>
                
                {/* 1. Chat view tab */}
                {wsTab === 'chat' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '0.5rem' }}>
                    {/* Chat Messages Log */}
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      background: '#fafafa',
                      border: '2.5px solid #000',
                      borderRadius: '12px',
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      {activeChatMessages.length === 0 ? (
                        <span style={{ margin: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {activeItem.type === 'channel' ? 'No messages yet. Send the first message!' : 'No messages yet. Join group and say hi!'}
                        </span>
                      ) : (
                        activeChatMessages.map((msg: any) => (
                          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.75rem', color: msg.sender === 'System' ? '#64748b' : (msg.senderEmail === userEmail ? 'var(--accent-pink)' : '#000') }}>
                                  {msg.sender}
                                </span>
                                <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {isAdmin && (
                                <button
                                  onClick={() => handleAdminDeleteMessage(msg.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'red',
                                    fontSize: '0.6rem',
                                    cursor: 'pointer',
                                    fontWeight: 800
                                  }}
                                >
                                  ✕ Delete
                                </button>
                              )}
                            </div>
                            <span style={{ fontSize: '0.75rem', fontStyle: msg.sender === 'System' ? 'italic' : 'normal', color: msg.sender === 'System' ? '#64748b' : '#000' }}>
                              {msg.text}
                            </span>
                          </div>
                        ))
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat composer form */}
                    {activeItem.type === 'group' && !currentGroupMembers.includes(userEmail) ? (
                      <div style={{ display: 'flex', background: '#ffeef2', border: '2px solid #000', borderRadius: '8px', padding: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>You must join this study group to participate in chat.</span>
                        <button onClick={() => handleToggleJoinGroup(activeItem.id)} className="cyber-btn pink-fill" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}>JOIN GROUP</button>
                      </div>
                    ) : (
                      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.4rem' }}>
                        <input
                          type="text"
                          placeholder="Type chat message..."
                          value={chatInputText}
                          onChange={(e) => handleInputChange(e.target.value)}
                          className="cyber-input"
                          style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem' }}
                        />
                        <button type="submit" className="cyber-btn purple-fill" style={{ padding: '0.45rem 0.75rem', fontSize: '0.75rem' }}>
                          SEND
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* 2. Workspace Notes view tab */}
                {wsTab === 'notes' && (
                  <div style={{ flex: 1, display: 'flex', gap: '0.75rem', overflow: 'hidden' }}>
                    {/* Share note form in workspace */}
                    <div style={{ width: '220px', flexShrink: 0, background: '#fdfdfd', border: '2px solid #000', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 900, borderBottom: '1.5px solid #000', paddingBottom: '0.2rem' }}>SHARE WORKSPACE NOTE</span>
                      {isGuest ? (
                        <div style={{ padding: '0.5rem', background: '#ffeef2', border: '2px solid #000', borderRadius: '8px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-pink)' }}>🔒 GUEST LIMIT</span>
                          <p style={{ fontSize: '0.6rem', margin: '0.25rem 0', fontWeight: 700 }}>Register to share notes in channels/groups.</p>
                        </div>
                      ) : (
                        <form onSubmit={handleShareNoteInWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <input
                            type="text"
                            placeholder="Note Title"
                            value={wsTitle}
                            onChange={(e) => setWsTitle(e.target.value)}
                            required
                            className="cyber-input"
                            style={{ padding: '0.3rem', fontSize: '0.7rem' }}
                          />
                          <textarea
                            placeholder="Note Content..."
                            rows={4}
                            value={wsContent}
                            onChange={(e) => setWsContent(e.target.value)}
                            required
                            style={{ width: '100%', padding: '0.3rem', border: '2px solid #000', borderRadius: '6px', fontSize: '0.7rem', resize: 'none' }}
                          />
                          <div>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800 }}>ATTACH PDF (MAX 1.5MB)</span>
                            <input type="file" accept="application/pdf" ref={wsFileInputRef} onChange={handleWsPdfUpload} style={{ fontSize: '0.6rem' }} />
                            {wsPdfError && <span style={{ fontSize: '0.55rem', color: 'var(--accent-pink)', fontWeight: 800 }}>{wsPdfError}</span>}
                            {wsPdfFile && <span style={{ fontSize: '0.55rem', color: '#009688', fontWeight: 800 }}>Attached</span>}
                          </div>
                          <button type="submit" className="cyber-btn purple-fill" style={{ width: '100%', padding: '0.35rem', fontSize: '0.7rem' }}>
                            PUBLISH NOTE
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Workspace notes listing */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {activeItem.type === 'channel' ? (
                        currentChannelNotes.length === 0 ? (
                          <span style={{ textAlign: 'center', margin: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>No shared notes in this channel yet.</span>
                        ) : (
                          currentChannelNotes.map((n: any) => (
                            <div key={n.id} style={{ background: '#fff', border: '2px solid #000', borderRadius: '8px', padding: '0.5rem', boxShadow: '2px 2px 0px #000' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                <span style={{ fontWeight: 800 }}>{n.author}</span>
                                <span>{n.date}</span>
                              </div>
                              <h5 style={{ margin: '0.1rem 0', fontSize: '0.8rem', fontWeight: 900 }}>{n.title}</h5>
                              <p style={{ margin: 0, fontSize: '0.72rem' }}>{n.content}</p>
                              {n.pdfAttachment && (
                                <button
                                  onClick={() => downloadPdfContent(n.pdfAttachment.url || n.id, n.pdfAttachment.name)}
                                  style={{ display: 'inline-block', fontSize: '0.6rem', color: 'var(--accent-pink)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.2rem', fontWeight: 800 }}
                                >
                                  📥 DOWNLOAD ATTACHMENT ({n.pdfAttachment.name})
                                </button>
                              )}
                            </div>
                          ))
                        )
                      ) : (
                        currentGroupNotes.length === 0 ? (
                          <span style={{ textAlign: 'center', margin: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>No shared notes in this study group yet.</span>
                        ) : (
                          currentGroupNotes.map((n: any) => (
                            <div key={n.id} style={{ background: '#fff', border: '2px solid #000', borderRadius: '8px', padding: '0.5rem', boxShadow: '2px 2px 0px #000' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                <span style={{ fontWeight: 800 }}>{n.author}</span>
                                <span>{n.date}</span>
                              </div>
                              <h5 style={{ margin: '0.1rem 0', fontSize: '0.8rem', fontWeight: 900 }}>{n.title}</h5>
                              <p style={{ margin: 0, fontSize: '0.72rem' }}>{n.content}</p>
                              {n.pdfAttachment && (
                                <button
                                  onClick={() => downloadPdfContent(n.pdfAttachment.url || n.id, n.pdfAttachment.name)}
                                  style={{ display: 'inline-block', fontSize: '0.6rem', color: 'var(--accent-pink)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.2rem', fontWeight: 800 }}
                                >
                                  📥 DOWNLOAD ATTACHMENT ({n.pdfAttachment.name})
                                </button>
                              )}
                            </div>
                          ))
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Workspace PDFs view tab */}
                {wsTab === 'pdfs' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
                    {/* PDFs Feed list */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#fafafa', border: '2px solid #000', borderRadius: '10px', padding: '0.5rem' }}>
                      {activeItem.type === 'channel' ? (
                        currentChannelPdfs.length === 0 ? (
                          <span style={{ margin: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>No PDFs uploaded in this channel yet.</span>
                        ) : (
                          currentChannelPdfs.map((pdf: any) => (
                            <div key={pdf.id} style={{ background: '#fff', border: '2px solid #000', borderRadius: '8px', padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>📄 {pdf.name}</span>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{pdf.size} • Uploaded by {pdf.uploadedBy}</div>
                              </div>
                              <button
                                onClick={() => downloadPdfContent(pdf.url || pdf.id, pdf.name)}
                                className="cyber-btn cyan-fill"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', cursor: 'pointer' }}
                              >
                                DOWNLOAD
                              </button>
                            </div>
                          ))
                        )
                      ) : (
                        currentGroupPdfs.length === 0 ? (
                          <span style={{ margin: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>No PDFs uploaded in this study group yet.</span>
                        ) : (
                          currentGroupPdfs.map((pdf: any) => (
                            <div key={pdf.id} style={{ background: '#fff', border: '2px solid #000', borderRadius: '8px', padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>📄 {pdf.name}</span>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{pdf.size} • Uploaded by {pdf.uploadedBy}</div>
                              </div>
                              <button
                                onClick={() => downloadPdfContent(pdf.url || pdf.id, pdf.name)}
                                className="cyber-btn cyan-fill"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', cursor: 'pointer' }}
                              >
                                DOWNLOAD
                              </button>
                            </div>
                          ))
                        )
                      )}
                    </div>

                    {/* Uploader row */}
                    {isGuest ? (
                      <div style={{ background: '#ffeef2', border: '2px solid #000', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-pink)' }}>🔒 GUEST LIMIT: UPLOAD LOCKED</span>
                      </div>
                    ) : activeItem.type === 'group' && !currentGroupMembers.includes(userEmail) ? (
                      <span style={{ fontSize: '0.7rem', fontStyle: 'italic', textAlign: 'center' }}>Join group to upload materials.</span>
                    ) : (
                      <div style={{ background: '#fff9db', border: '2px solid #000', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>SHARE PDF (MAX 2MB)</span>
                        <input type="file" accept="application/pdf" onChange={handleSharePdfInWorkspace} style={{ fontSize: '0.68rem' }} />
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Group Members / Presence View Tab */}
                {wsTab === 'members' && activeItem.type === 'group' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>Group Members: {currentGroupMembers.length}</span>
                      <button
                        onClick={() => handleToggleJoinGroup(activeItem.id)}
                        className={`cyber-btn ${currentGroupMembers.includes(userEmail) ? '' : 'pink-fill'}`}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        {currentGroupMembers.includes(userEmail) ? 'LEAVE STUDY GROUP' : 'JOIN STUDY GROUP'}
                      </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {currentGroupMembers.map((memberEmail: string) => {
                        const userProfile = presenceUsers.find(u => u.email === memberEmail);
                        const isOnline = userProfile?.online;
                        return (
                          <div key={memberEmail} style={{ background: '#fff', border: '2px solid #000', borderRadius: '8px', padding: '0.45rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{userProfile?.name || memberEmail.split('@')[0]}</span>
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              background: isOnline ? 'var(--accent-green)' : '#cbd5e1',
                              color: '#000',
                              border: '1.5px solid #000',
                              borderRadius: '4px',
                              padding: '0.05rem 0.35rem'
                            }}>
                              {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB PANEL: DIRECT MESSAGE (DM) VIEW       */}
          {/* ========================================== */}
          {activeItem.type === 'dm' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0.75rem', gap: '0.5rem' }}>
              {/* Status Header */}
              <div style={{
                background: '#fafafa',
                border: '2px solid #000',
                borderRadius: '8px',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: currentBuddy?.online ? 'var(--accent-green)' : '#94a3b8',
                    border: '1.5px solid #000'
                  }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 900 }}>{currentBuddy?.name || activeItem.id}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({activeItem.id})</span>
                </div>
                {activeChatTyping && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--accent-pink)', fontWeight: 800, animation: 'float-bouncy 1.5s infinite' }}>
                    Typing...
                  </span>
                )}
              </div>

              {/* Chat log */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                background: '#fafafa',
                border: '2.5px solid #000',
                borderRadius: '12px',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {activeChatMessages.length === 0 ? (
                  <span style={{ margin: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>No messages yet. Send a direct message to say hi!</span>
                ) : (
                  activeChatMessages.map(msg => (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem', alignSelf: msg.senderEmail === userEmail ? 'flex-end' : 'flex-start', minWidth: '150px' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', justifyContent: msg.senderEmail === userEmail ? 'flex-end' : 'flex-start' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.72rem', color: msg.senderEmail === userEmail ? 'var(--accent-pink)' : '#000' }}>
                            {msg.senderEmail === userEmail ? 'Me' : msg.sender}
                          </span>
                          <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleAdminDeleteMessage(msg.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'red',
                              fontSize: '0.6rem',
                              cursor: 'pointer',
                              fontWeight: 800,
                              marginLeft: '0.5rem'
                            }}
                          >
                            ✕ Delete
                          </button>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        background: msg.senderEmail === userEmail ? '#dbeafe' : '#f1f5f9',
                        border: '1.5px solid #000',
                        borderRadius: '6px',
                        padding: '0.2rem 0.45rem',
                        boxShadow: '1.5px 1.5px 0px #000'
                      }}>{msg.text}</span>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input form */}
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Type a private message..."
                  value={chatInputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="cyber-input"
                  style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem' }}
                />
                <button type="submit" className="cyber-btn purple-fill" style={{ padding: '0.45rem 0.75rem', fontSize: '0.75rem' }}>
                  SEND
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* ========================================== */}
      {/* DIALOG MODALS SECTION                      */}
      {/* ========================================== */}
      
      {/* 1. Create Public Channel Modal */}
      {showCreateChannelModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999
        }}>
          <div style={{
            background: '#fff',
            border: '3px solid #000',
            borderRadius: '16px',
            padding: '1.25rem',
            width: '320px',
            boxShadow: '4px 4px 0px #000',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>CREATE PUBLIC CHANNEL</h3>
            <form onSubmit={handleCreateChannel} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="channel-name (e.g. coding-help)"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                required
                className="cyber-input"
                style={{ padding: '0.45rem', fontSize: '0.75rem' }}
              />
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button type="button" onClick={() => setShowCreateChannelModal(false)} className="cyber-btn" style={{ padding: '0.35rem 0.6rem', fontSize: '0.7rem', background: '#fff' }}>CANCEL</button>
                <button type="submit" className="cyber-btn purple-fill" style={{ padding: '0.35rem 0.6rem', fontSize: '0.7rem' }}>CREATE</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Create Study Group Modal */}
      {showCreateGroupModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999
        }}>
          <div style={{
            background: '#fff',
            border: '3px solid #000',
            borderRadius: '16px',
            padding: '1.25rem',
            width: '320px',
            boxShadow: '4px 4px 0px #000',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>CREATE STUDY GROUP</h3>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Study Group Name (e.g. ML Club)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                required
                className="cyber-input"
                style={{ padding: '0.45rem', fontSize: '0.75rem' }}
              />
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button type="button" onClick={() => setShowCreateGroupModal(false)} className="cyber-btn" style={{ padding: '0.35rem 0.6rem', fontSize: '0.7rem', background: '#fff' }}>CANCEL</button>
                <button type="submit" className="cyber-btn purple-fill" style={{ padding: '0.35rem 0.6rem', fontSize: '0.7rem' }}>CREATE</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. AI Summary Scan Modal */}
      {activeSummaryNote && (
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
          <div className="glass-panel glowing-cyan anim-pop" style={{ maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.5rem' }}>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800 }}>
                AI STUDY SUMMARY
              </h4>
              <button 
                onClick={() => setActiveSummaryNote(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            {summarizing ? (
              <div style={{ textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  border: '3.5px dashed var(--accent-pink)',
                  borderRadius: '50%',
                  animation: 'float-bouncy 1.5s infinite'
                }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>AI Scanning Knowledge Node...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                  SUBJECT: {activeSummaryNote.course.toUpperCase()}
                </span>
                <h5 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem' }}>{activeSummaryNote.title}</h5>
                
                <div style={{
                  background: '#f8faf3',
                  border: '2px solid #000',
                  borderRadius: '12px',
                  padding: '0.75rem',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  lineHeight: '1.5',
                  whiteSpace: 'pre-line'
                }}>
                  {activeSummaryNote.summary || '• No summary available.'}
                </div>

                <button 
                  onClick={() => setActiveSummaryNote(null)}
                  className="cyber-btn pink-fill"
                  style={{ width: '100%' }}
                >
                  CLOSE REPORT
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
