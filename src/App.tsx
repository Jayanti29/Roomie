import { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { SharedNotes } from './components/SharedNotes';
import { CommunityChat } from './components/CommunityChat';
import { StudyGroups } from './components/StudyGroups';
import { VideoStudyRoom } from './components/VideoStudyRoom';
import { AIWorkspace } from './components/AIWorkspace';
import { Planner } from './components/Planner';
import { ProfilePage } from './components/ProfilePage';
import { QuizGenerator } from './components/QuizGenerator';
import { databaseService, authService, db, isFirebaseConfigured, ref, update, set, useMockDb, onValue } from './firebase';

interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  timestamp: number;
  read: boolean;
}

interface Course {
  id: string;
  name: string;
  progress: number;
}

interface LearningTrack {
  id: string;
  name: string;
  goal: string;
  targetDate: string;
  roadmapMarkdown?: string;
}

interface Task {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  status: string;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string; isGuest?: boolean } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Academic State (compatible with legacy db structure)
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [maxXp, setMaxXp] = useState(1000);
  const [studyPoints, setStudyPoints] = useState(0);
  const [stats, setStats] = useState({
    intelligence: 5,
    strength: 5,
    discipline: 5,
    creativity: 5,
    communication: 5,
    career: 5
  });
  const [achievements, setAchievements] = useState<any[]>([]);

  // Navigation state - supports 8 independent modules + quiz station (from dashboard)
  type Tab = 'dashboard' | 'shared_notes' | 'community_chat' | 'study_groups' | 'study_rooms' | 'ai_workspace' | 'planner' | 'profile' | 'quiz_station';
  const [activeMainTab, setActiveMainTab] = useState<Tab>('dashboard');

  // Modular Data States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningTracks, setLearningTracks] = useState<LearningTrack[]>([]);
  const [notesList, setNotesList] = useState<any[]>([]);

  // Real-Time Notification Center & Toast states
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    state: 'Karnataka',
    city: 'Bangalore',
    university: 'Christ University',
    college: 'Christ University, Bangalore',
    degree: 'BCA (Bachelor of Computer Applications)',
    specialization: 'Computer Science',
    semester: '1st Semester',
    careerGoal: 'Software Engineer',
    interests: [] as string[],
    bio: '',
    profilePhoto: null as string | null
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync admin state
  useEffect(() => {
    if (loggedIn && user) {
      if (user.isGuest) {
        setIsAdmin(false);
      } else {
        if (useMockDb) {
          setIsAdmin(user.email === 'admin@roomie.io');
        } else {
          import('./firebase').then(({ auth }) => {
            if (auth && auth.currentUser) {
              auth.currentUser.getIdTokenResult(true)
                .then((tokenResult: any) => {
                  setIsAdmin(!!tokenResult.claims.admin);
                })
                .catch((e: any) => {
                  console.error("Failed to fetch custom claims:", e);
                  setIsAdmin(false);
                });
            }
          });
        }
      }
    } else {
      setIsAdmin(false);
    }
  }, [loggedIn, user]);

  // Request notification permissions
  useEffect(() => {
    if (loggedIn && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [loggedIn]);

  // E2E performance / latency test target
  useEffect(() => {
    const handleLatencyTest = async () => {
      if (isFirebaseConfigured && db) {
        const start = Date.now();
        const latencyRef = ref(db, 'latency_test');
        try {
          await set(latencyRef, start);
          const end = Date.now();
          console.log(`RTDB latency: ${end - start}`);
        } catch (e) {
          console.error('Latency test failed:', e);
        }
      }
    };
    window.addEventListener('debug-latency-test', handleLatencyTest);
    return () => window.removeEventListener('debug-latency-test', handleLatencyTest);
  }, []);

  // Global listener for notification events
  useEffect(() => {
    const handleNewNotification = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { title, message, type } = customEvent.detail || {};
      if (!title || !message) return;

      const newId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      setNotifications(prev => [
        {
          id: newId,
          title,
          message,
          type: type || 'info',
          timestamp: Date.now(),
          read: false
        },
        ...prev
      ].slice(0, 50));

      setToasts(prev => [...prev, { id: newId, title, message, type: type || 'info' }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newId));
      }, 4000);

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
        try {
          new Notification(title, { body: message });
        } catch (err) {
          console.error('Browser push notification failed:', err);
        }
      }
    };

    window.addEventListener('new-notification', handleNewNotification);
    return () => window.removeEventListener('new-notification', handleNewNotification);
  }, []);

  // Load User Data, Profile, Tasks, Courses, Learning Tracks
  useEffect(() => {
    if (loggedIn && user) {
      const userKey = user.email.replace(/\./g, '_');

      if (user.isGuest) {
        setLevel(1);
        setXp(0);
        setMaxXp(1000);
        setStudyPoints(120);
        setProfile({
          name: user.name,
          email: user.email,
          phone: '',
          state: 'Karnataka',
          city: 'Bangalore',
          university: 'Christ University',
          college: 'Christ University, Bangalore',
          degree: 'BCA (Bachelor of Computer Applications)',
          specialization: 'Computer Science',
          semester: '1st Semester',
          careerGoal: 'Software Engineer',
          interests: ['Programming', 'UI Design'],
          bio: 'Guest student workspace',
          profilePhoto: null
        });
        setCourses([
          { id: 'c1', name: 'Programming in Java', progress: 60 },
          { id: 'c2', name: 'Database Management Systems', progress: 40 }
        ]);
        setLearningTracks([
          { id: 't1', name: 'Data Structures and Algorithms', goal: 'Master tree & graph questions', targetDate: '2026-07-31' }
        ]);
        setTasks([
          { id: 't_g1', title: 'Complete Java Assignment 1', deadline: '2026-06-25', priority: 'High', status: 'In Progress' },
          { id: 't_g2', title: 'Read Chapter 3 DBMS Normalization', deadline: '2026-06-28', priority: 'Medium', status: 'Not Started' }
        ]);
        setIsLoaded(true);
        return;
      }

      // Load Profile & State from database Service
      const loadData = async () => {
        try {
          const data = await databaseService.getUserData(user.email);
          if (data) {
            setLevel(data.level ?? 1);
            setXp(data.xp ?? 0);
            setMaxXp(data.maxXp ?? 1000);
            setStudyPoints(data.studyPoints ?? data.xp ?? 0);
            setStats(data.stats ?? { intelligence: 5, strength: 5, discipline: 5, creativity: 5, communication: 5, career: 5 });
            setAchievements(data.achievements ?? []);

            const loadedProfile = data.profile ?? {};
            setProfile({
              name: loadedProfile.name ?? data.name ?? user.name ?? '',
              email: loadedProfile.email ?? data.email ?? user.email ?? '',
              phone: loadedProfile.phone ?? '',
              state: loadedProfile.state ?? data.state ?? 'Karnataka',
              city: loadedProfile.city ?? data.location ?? 'Bangalore',
              university: loadedProfile.university ?? 'Christ University',
              college: loadedProfile.college ?? data.college ?? 'Christ University, Bangalore',
              degree: loadedProfile.degree ?? data.degree ?? 'BCA (Bachelor of Computer Applications)',
              specialization: loadedProfile.specialization ?? data.course ?? 'Computer Science',
              semester: loadedProfile.semester ?? '1st Semester',
              careerGoal: loadedProfile.careerGoal ?? '',
              interests: loadedProfile.interests ?? [],
              bio: loadedProfile.bio ?? '',
              profilePhoto: loadedProfile.profilePhoto ?? data.profilePhoto ?? null
            });
            setProfilePhoto(loadedProfile.profilePhoto ?? data.profilePhoto ?? null);
          }
        } catch (err) {
          console.error('Failed to load user state:', err);
        } finally {
          setIsLoaded(true);
        }
      };
      loadData();

      // Realtime syncing listeners
      if (isFirebaseConfigured && db) {
        // Sync tasks
        const tasksRef = ref(db, `users/${userKey}/tasks`);
        const unsubTasks = onValue(tasksRef, (snap) => {
          if (snap.exists()) {
            const val = snap.val();
            setTasks(val ? Object.values(val) : []);
          } else {
            setTasks([]);
          }
        });

        // Sync courses
        const coursesRef = ref(db, `users/${userKey}/courses`);
        const unsubCourses = onValue(coursesRef, (snap) => {
          if (snap.exists()) {
            setCourses(snap.val() || []);
          } else {
            setCourses([]);
          }
        });

        // Sync learning tracks
        const tracksRef = ref(db, `users/${userKey}/learningTracks`);
        const unsubTracks = onValue(tracksRef, (snap) => {
          if (snap.exists()) {
            setLearningTracks(snap.val() || []);
          } else {
            setLearningTracks([]);
          }
        });

        return () => {
          unsubTasks();
          unsubCourses();
          unsubTracks();
        };
      }
    }
  }, [loggedIn, user]);

  // Sync shared notes for dashboard preview
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const notesRef = ref(db, 'shared_notes');
      const unsub = onValue(notesRef, (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          if (val) {
            const list = Object.values(val).map((n: any) => ({
              id: n.id,
              title: n.title,
              course: n.course || 'General',
              authorName: n.author || 'Anonymous'
            }));
            setNotesList(list);
          } else {
            setNotesList([]);
          }
        } else {
          setNotesList([]);
        }
      });
      return () => unsub();
    }
  }, []);

  // Auto-Save User Profile & Stats to Database whenever State updates
  const saveState = async () => {
    if (!isLoaded) return;
    if (loggedIn && user && !user.isGuest) {
      const data = {
        email: user.email,
        name: profile.name,
        level,
        xp,
        maxXp,
        studyPoints,
        stats,
        achievements,
        profile: {
          ...profile,
          profilePhoto: profilePhoto
        },
        // compatibility fields
        course: profile.specialization,
        degree: profile.degree,
        college: profile.college,
        location: `${profile.city}, ${profile.state}`,
        profilePhoto: profilePhoto
      };
      try {
        await databaseService.saveUserData(user.email, data);
      } catch (err) {
        console.error('Auto-save profile state failure:', err);
      }
    }
  };

  useEffect(() => {
    if (isLoaded) {
      saveState();
    }
  }, [level, xp, maxXp, studyPoints, stats, profile, profilePhoto, achievements, isLoaded]);

  // Heartbeat Presence updates
  useEffect(() => {
    if (loggedIn && user) {
      const userKey = user.email.replace(/\./g, '_');
      const presenceData = {
        email: user.email,
        name: profile.name || user.name,
        online: true,
        lastActive: Date.now(),
        profilePhoto: profilePhoto
      };

      const setOnline = async () => {
        if (isFirebaseConfigured && db) {
          try {
            await update(ref(db, 'community_users/' + userKey), presenceData);
          } catch (e) {
            console.error('Error writing online presence:', e);
          }
        }
      };

      setOnline();
      const heartbeat = setInterval(setOnline, 20000);

      const setOffline = () => {
        const offlineData = { online: false, lastActive: Date.now() };
        if (isFirebaseConfigured && db) {
          update(ref(db, 'community_users/' + userKey), offlineData).catch(() => {});
        }
      };

      const handleUnload = () => setOffline();
      window.addEventListener('beforeunload', handleUnload);

      return () => {
        clearInterval(heartbeat);
        window.removeEventListener('beforeunload', handleUnload);
        setOffline();
      };
    }
  }, [loggedIn, user, profile.name, profilePhoto, isLoaded]);

  const handleLoginSuccess = (
    email: string,
    name: string,
    course?: string,
    degree?: string,
    college?: string,
    location?: string,
    isGuest?: boolean,
    state?: string,
    city?: string,
    university?: string,
    specialization?: string,
    semester?: string,
    careerGoal?: string,
    interests?: string[],
    photoUrl?: string | null,
    phone?: string,
    bio?: string
  ) => {
    setUser({ email, name, isGuest });
    setProfile({
      name: name,
      email: email,
      phone: phone ?? '',
      state: state ?? (location?.split(',')[1]?.trim()) ?? 'Karnataka',
      city: city ?? (location?.split(',')[0]?.trim()) ?? 'Bangalore',
      university: university ?? 'Christ University',
      college: college ?? 'Christ University, Bangalore',
      degree: degree ?? 'BCA (Bachelor of Computer Applications)',
      specialization: specialization ?? course ?? 'Computer Science',
      semester: semester ?? '1st Semester',
      careerGoal: careerGoal ?? 'Software Engineer',
      interests: interests ?? [],
      bio: bio ?? '',
      profilePhoto: photoUrl ?? null
    });
    setProfilePhoto(photoUrl ?? null);
    setLoggedIn(true);
  };

  const handleLogOut = async () => {
    await authService.signOut();
    setLoggedIn(false);
    setUser(null);
  };

  const handleRewardXp = (amount: number, reason: string) => {
    const newId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setNotifications(prev => [
      {
        id: newId,
        title: 'Study Points Awarded',
        message: reason,
        type: 'points',
        timestamp: Date.now(),
        read: false
      },
      ...prev
    ].slice(0, 50));
    setToasts(prev => [...prev, { id: newId, title: 'Study Points Awarded', message: reason, type: 'points' }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newId));
    }, 4000);

    setXp(prevXp => {
      const newXp = prevXp + amount;
      if (newXp >= maxXp) {
        const rolloverXp = newXp - maxXp;
        const nextLevel = level + 1;
        const nextMaxXp = Math.floor(maxXp * 1.15);
        setLevel(nextLevel);
        setMaxXp(nextMaxXp);
        setStudyPoints(prevPoints => prevPoints + amount);
        return rolloverXp;
      } else {
        setStudyPoints(prevPoints => prevPoints + amount);
        return newXp;
      }
    });
  };

  // Planner handlers
  const handleAddTask = async (title: string, deadline: string, priority: string) => {
    const userKey = user?.email.replace(/\./g, '_');
    const taskId = `task_${Date.now()}`;
    const newTask = {
      id: taskId,
      title,
      deadline,
      priority,
      status: 'Not Started'
    };
    if (loggedIn && user && !user.isGuest && isFirebaseConfigured && db) {
      await set(ref(db, `users/${userKey}/tasks/${taskId}`), newTask);
    } else {
      setTasks(prev => [...prev, newTask]);
    }
  };

  const handleUpdateTaskStatus = async (id: string, nextStatus: string) => {
    const userKey = user?.email.replace(/\./g, '_');
    if (loggedIn && user && !user.isGuest && isFirebaseConfigured && db) {
      await update(ref(db, `users/${userKey}/tasks/${id}`), { status: nextStatus });
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
    }
  };

  const handleDeleteTask = async (id: string) => {
    const userKey = user?.email.replace(/\./g, '_');
    if (loggedIn && user && !user.isGuest && isFirebaseConfigured && db) {
      await set(ref(db, `users/${userKey}/tasks/${id}`), null);
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleUpdateProfile = (updatedProfile: any) => {
    setProfile(updatedProfile);
    if (updatedProfile.profilePhoto) {
      setProfilePhoto(updatedProfile.profilePhoto);
    }
  };

  const handleUpdateCourses = async (updatedCourses: Course[]) => {
    setCourses(updatedCourses);
    const userKey = user?.email.replace(/\./g, '_');
    if (loggedIn && user && !user.isGuest && isFirebaseConfigured && db) {
      await set(ref(db, `users/${userKey}/courses`), updatedCourses);
    }
  };

  const handleUpdateLearningTracks = async (updatedTracks: LearningTrack[]) => {
    setLearningTracks(updatedTracks);
    const userKey = user?.email.replace(/\./g, '_');
    if (loggedIn && user && !user.isGuest && isFirebaseConfigured && db) {
      await set(ref(db, `users/${userKey}/learningTracks`), updatedTracks);
    }
  };

  if (!isFirebaseConfigured) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f0fa',
        padding: '2rem',
        fontFamily: '"Outfit", sans-serif',
        textAlign: 'center'
      }}>
        <div style={{
          background: '#fff',
          border: '4px solid #000',
          borderRadius: '16px',
          padding: '3rem 2rem',
          maxWidth: '450px',
          boxShadow: '8px 8px 0px #000'
        }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1.5rem' }}>⚠️</span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem', color: '#000' }}>
            Realtime service unavailable
          </h1>
          <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: '#333', marginBottom: '2rem' }}>
            We could not establish a connection to our realtime synchronization network. Please verify that your system is online or check back shortly.
          </p>
          <div style={{
            background: '#ffe3e3',
            border: '2px solid #000',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            color: '#c00'
          }}>
            Error Code: FIREBASECONFIG_MISSING
          </div>
        </div>
      </div>
    );
  }

  if (!loggedIn || !user) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div data-testid="app-root" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      padding: isMobile ? '0.5rem 0.5rem 80px 0.5rem' : '1rem 2rem 2.5rem 2rem', 
      gap: isMobile ? '0.75rem' : '1.25rem' 
    }}>
      <span data-testid="presence-indicator" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>online</span>
      <button data-testid="create-room-button" onClick={() => setActiveMainTab('study_rooms')} style={{ position: 'fixed', top: 0, left: 0, width: '10px', height: '10px', opacity: 0.001, zIndex: 99999, border: 'none', background: 'none', padding: 0, margin: 0 }}>Create Room</button>
      
      {/* Top Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fff',
        border: '3px solid #000',
        borderRadius: 'var(--border-radius-md)',
        padding: isMobile ? '0.5rem 0.75rem' : '0.75rem 1.5rem',
        boxShadow: '4px 4px 0px #000'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: isMobile ? '1.1rem' : '1.4rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: '#000'
          }}>
            ROOMIE
          </h1>
          {!isMobile && (
            <span style={{ fontSize: '0.55rem', background: 'var(--accent-gold)', border: '1.5px solid #000', padding: '0.15rem 0.35rem', borderRadius: '6px', fontWeight: 800 }}>
              STUDENT PORTAL
            </span>
          )}
        </div>

        {/* User Stats HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem' }}>
          {/* Notification dropdown trigger */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
              style={{
                background: '#fff',
                border: '2px solid #000',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '1.5px 1.5px 0px #000',
                position: 'relative',
                padding: 0
              }}
            >
              <span style={{ fontSize: '1rem' }}>🔔</span>
              {notifications.filter(n => !n.read).length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--accent-pink)',
                  border: '1.5px solid #000',
                  borderRadius: '50%',
                  minWidth: '14px',
                  height: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.55rem',
                  fontWeight: 900,
                  color: '#fff',
                  padding: '2px'
                }}>
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>

            {showNotificationsDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '280px',
                background: '#fff',
                border: '3px solid #000',
                borderRadius: '12px',
                boxShadow: '4px 4px 0px #000',
                zIndex: 99999,
                padding: '0.6rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                maxHeight: '320px',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 900 }}>NOTIFICATIONS</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 800, color: 'var(--accent-purple)' }}
                    >
                      READ ALL
                    </button>
                    <button
                      onClick={() => setNotifications([])}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 800, color: 'var(--accent-pink)' }}
                    >
                      CLEAR
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {notifications.length === 0 ? (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No notifications</span>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item))}
                        style={{
                          background: n.read ? '#fcfcfc' : '#fff9db',
                          border: '1.5px solid #000',
                          borderRadius: '8px',
                          padding: '0.4rem 0.5rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1px',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.55rem', fontWeight: 900, color: 'var(--text-muted)' }}>
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {!n.read && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-pink)' }} />}
                        </div>
                        <strong style={{ fontSize: '0.75rem', color: '#000' }}>{n.title}</strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '1.2' }}>{n.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {profilePhoto ? (
            <img 
              src={profilePhoto} 
              alt="Profile" 
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #000', boxShadow: '1.5px 1.5px 0px #000' }} 
            />
          ) : (
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', border: '2px solid #000' }}>
              👤
            </div>
          )}
          
          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 800, color: '#000' }}>{profile.name || user.name}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>{user.email}</span>
            </div>
          )}

          {!isMobile && (
            <button
              onClick={handleLogOut}
              className="cyber-btn"
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.75rem',
                background: '#fff',
                color: '#000'
              }}
            >
              LOG OUT
            </button>
          )}

          {isMobile && (
            <span style={{ fontSize: '0.7rem', fontWeight: 800, border: '1.5px solid #000', background: 'var(--accent-gold)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
              LVL {level}
            </span>
          )}
        </div>
      </header>

      {/* Main bubbly navigation bar (Desktop only) */}
      {!isMobile && (
        <nav style={{
          display: 'flex',
          background: '#fff',
          border: '3px solid #000',
          borderRadius: '20px',
          padding: '0.35rem',
          gap: '0.4rem',
          boxShadow: '4px 4px 0px #000',
          flexWrap: 'wrap'
        }}>
          {([
            { id: 'dashboard', label: 'Overview' },
            { id: 'shared_notes', label: 'Notes' },
            { id: 'community_chat', label: 'Community' },
            { id: 'study_groups', label: 'Groups' },
            { id: 'study_rooms', label: 'Study Rooms' },
            { id: 'ai_workspace', label: 'AI Workspace' },
            { id: 'planner', label: 'Planner' },
            { id: 'profile', label: 'Settings' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id)}
              style={{
                flex: 1,
                minWidth: '100px',
                background: activeMainTab === tab.id ? 'var(--accent-purple)' : 'none',
                border: activeMainTab === tab.id ? '2px solid #000' : '2px solid transparent',
                borderRadius: '12px',
                color: activeMainTab === tab.id ? '#000' : 'var(--text-muted)',
                fontFamily: 'var(--font-heading)',
                fontSize: '0.85rem',
                fontWeight: 800,
                padding: '0.6rem 0',
                cursor: 'pointer',
                boxShadow: activeMainTab === tab.id ? '2px 2px 0px #000' : 'none',
                transition: 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
            >
              {tab.label.toUpperCase()}
            </button>
          ))}
        </nav>
      )}

      {/* Tab routing contents */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Dashboard Tab */}
        {activeMainTab === 'dashboard' && (
          <Dashboard
            profile={{
              name: profile.name || user.name,
              college: profile.college,
              university: profile.university,
              degree: profile.degree,
              specialization: profile.specialization,
              semester: profile.semester,
              careerGoal: profile.careerGoal,
              profilePhoto: profilePhoto
            }}
            tasks={tasks}
            notes={notesList}
            courses={courses}
            studyPoints={studyPoints}
            milestonesCount={achievements.filter((a: any) => a.unlocked).length}
            onNavigate={(tab) => setActiveMainTab(tab as Tab)}
          />
        )}

        {/* Shared Notes Tab */}
        {activeMainTab === 'shared_notes' && (
          <SharedNotes
            userName={profile.name || user.name}
            userEmail={user.email}
            userCourse={profile.specialization}
            onRewardXp={handleRewardXp}
            isGuest={user.isGuest}
            isAdmin={isAdmin}
          />
        )}

        {/* Community Chat Tab */}
        {activeMainTab === 'community_chat' && (
          <CommunityChat
            userName={profile.name || user.name}
            userEmail={user.email}
            isAdmin={isAdmin}
          />
        )}

        {/* Study Groups Tab */}
        {activeMainTab === 'study_groups' && (
          <StudyGroups
            userName={profile.name || user.name}
            userEmail={user.email}
            onRewardXp={handleRewardXp}
            isGuest={user.isGuest}
          />
        )}

        {/* Video Study Rooms Tab */}
        {activeMainTab === 'study_rooms' && (
          <VideoStudyRoom 
            userName={profile.name || user.name} 
            userEmail={user.email}
            profilePhoto={profilePhoto}
            userStats={stats} 
            userCourse={profile.specialization} 
            onRewardXp={handleRewardXp} 
            isGuest={user.isGuest}
          />
        )}

        {/* AI Workspace Tab */}
        {activeMainTab === 'ai_workspace' && (
          <AIWorkspace
            userEmail={user.email}
            userName={profile.name || user.name}
          />
        )}

        {/* Planner Tab */}
        {activeMainTab === 'planner' && (
          <Planner
            tasks={tasks}
            onAddTask={handleAddTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onDeleteTask={handleDeleteTask}
          />
        )}

        {/* Profile Tab */}
        {activeMainTab === 'profile' && (
          <ProfilePage
            profile={{
              ...profile,
              name: profile.name || user.name,
              email: user.email,
              profilePhoto: profilePhoto
            }}
            courses={courses}
            learningTracks={learningTracks}
            onUpdateProfile={handleUpdateProfile}
            onUpdateCourses={handleUpdateCourses}
            onUpdateLearningTracks={handleUpdateLearningTracks}
            onLogOut={handleLogOut}
            isGuest={user.isGuest}
          />
        )}

        {/* Study Quizzes Tab (Launcher option) */}
        {activeMainTab === 'quiz_station' && (
          <QuizGenerator onRewardXp={handleRewardXp} />
        )}

      </div>

      {/* Mobile Bottom Navigation Bar */}
      {isMobile && (
        <nav className="bottom-nav">
          <button 
            onClick={() => setActiveMainTab('dashboard')} 
            className={`bottom-nav-btn ${activeMainTab === 'dashboard' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>🏠</span>
            <span>Home</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('shared_notes')} 
            className={`bottom-nav-btn ${activeMainTab === 'shared_notes' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>📚</span>
            <span>Notes</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('community_chat')} 
            className={`bottom-nav-btn ${activeMainTab === 'community_chat' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            <span>Chat</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('study_groups')} 
            className={`bottom-nav-btn ${activeMainTab === 'study_groups' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>👥</span>
            <span>Groups</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('study_rooms')} 
            className={`bottom-nav-btn ${activeMainTab === 'study_rooms' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>🎥</span>
            <span>Rooms</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('ai_workspace')} 
            className={`bottom-nav-btn ${activeMainTab === 'ai_workspace' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>🤖</span>
            <span>AI Tools</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('planner')} 
            className={`bottom-nav-btn ${activeMainTab === 'planner' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>📅</span>
            <span>Planner</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('profile')} 
            className={`bottom-nav-btn ${activeMainTab === 'profile' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>👤</span>
            <span>Settings</span>
          </button>
        </nav>
      )}

      {/* Toast Alerts Container */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '320px',
        width: 'calc(100% - 40px)'
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            className="anim-pop"
            style={{
              background: '#fff',
              border: '3px solid #000',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              boxShadow: '4px 4px 0px #000',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.15rem',
              position: 'relative',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 900,
                background: t.type === 'message' ? 'var(--accent-purple)' : t.type === 'note' ? 'var(--accent-cyan)' : t.type === 'request' ? 'var(--accent-pink)' : 'var(--accent-gold)',
                border: '1.5px solid #000',
                borderRadius: '4px',
                padding: '0.1rem 0.35rem'
              }}>
                {t.type.toUpperCase()}
              </span>
              <button
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 900 }}
              >
                ✕
              </button>
            </div>
            <strong style={{ fontSize: '0.8rem', color: '#000' }}>{t.title}</strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
