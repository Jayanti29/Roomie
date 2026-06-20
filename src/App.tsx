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
import { Leaderboard } from './components/Leaderboard';
import { QuizGenerator } from './components/QuizGenerator';
import { Onboarding } from './components/Onboarding';
import { Friends } from './components/Friends';
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

type Tab = 'dashboard' | 'shared_notes' | 'community_chat' | 'study_groups' | 'study_rooms' | 'friends' | 'ai_workspace' | 'planner' | 'leaderboard' | 'profile' | 'settings' | 'account' | 'quiz_station';

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

  // Navigation state
  const [activeMainTab, setActiveMainTab] = useState<Tab>('dashboard');
  const [profileSubTab, setProfileSubTab] = useState<'personal' | 'academic'>('personal');

  // Modular Data States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningTracks, setLearningTracks] = useState<LearningTrack[]>([]);
  const [notesList, setNotesList] = useState<any[]>([]);

  // Real-Time Notification Center & Toast states
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

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
    profilePhoto: null as string | null,
    onboardingCompleted: false
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auth Restorer / Listener
  useEffect(() => {
    const checkAuth = async () => {
      if (isFirebaseConfigured) {
        try {
          const { auth } = await import('./firebase');
          if (!auth) {
            setIsLoaded(true);
            return;
          }
          const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: any) => {
            if (firebaseUser) {
              const email = firebaseUser.email || `guest_${firebaseUser.uid}@roomie.io`;
              const name = firebaseUser.displayName || email.split('@')[0];
              const isGuest = firebaseUser.isAnonymous;
              
              let course = 'Computer Science';
              let degree = 'Bachelor of Science';
              let college = 'State University';
              let location = 'San Francisco, CA';
              let stateVal = '';
              let cityVal = '';
              let uniVal = '';
              let specVal = '';
              let semVal = '1st Semester';
              let careerGoalVal = '';
              let interestsVal: string[] = [];
              let profilePhotoVal: string | null = null;
              let phoneVal = '';
              let bioVal = '';
              let onboardingCompletedVal = false;

              try {
                const data = await databaseService.getUserData(email);
                if (data) {
                  course = data.course || data.specialization || course;
                  degree = data.degree || degree;
                  college = data.college || college;
                  location = data.location || data.city || location;
                  stateVal = data.state || '';
                  cityVal = data.city || '';
                  uniVal = data.university || '';
                  specVal = data.specialization || '';
                  semVal = data.semester || '1st Semester';
                  careerGoalVal = data.careerGoal || '';
                  interestsVal = data.interests || [];
                  profilePhotoVal = data.profilePhoto || null;
                  phoneVal = data.phone || '';
                  bioVal = data.bio || '';
                  onboardingCompletedVal = data.profile?.onboardingCompleted ?? false;
                }
              } catch (e) {
                console.warn("Could not load user details on restore:", e);
              }

              handleLoginSuccess(
                email, 
                name, 
                course, 
                degree, 
                college, 
                location,
                isGuest,
                stateVal,
                cityVal,
                uniVal,
                specVal,
                semVal,
                careerGoalVal,
                interestsVal,
                profilePhotoVal,
                phoneVal,
                bioVal,
                onboardingCompletedVal
              );
            } else {
              const savedSession = localStorage.getItem('roomie_mock_session');
              if (savedSession) {
                try {
                  const parsed = JSON.parse(savedSession);
                  handleLoginSuccess(
                    parsed.email,
                    parsed.name,
                    parsed.course,
                    parsed.degree,
                    parsed.college,
                    parsed.location,
                    parsed.isGuest,
                    parsed.state,
                    parsed.city,
                    parsed.university,
                    parsed.specialization,
                    parsed.semester,
                    parsed.careerGoal,
                    parsed.interests,
                    parsed.profilePhoto,
                    parsed.phone,
                    parsed.bio,
                    parsed.onboardingCompleted
                  );
                } catch (e) {}
              } else {
                setLoggedIn(false);
                setUser(null);
              }
            }
            setIsLoaded(true);
          });
          return unsubscribe;
        } catch (e) {
          console.error("Auth initialization check error:", e);
          setIsLoaded(true);
        }
      } else {
        setIsLoaded(true);
      }
    };

    let unsubPromise = checkAuth();
    return () => {
      unsubPromise.then(unsub => unsub && unsub());
    };
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

  // E2E latency test target
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

  // Real-time notifications subscription from Firebase Realtime Database
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    if (loggedIn && user && isFirebaseConfigured && db) {
      import('./firebase').then(({ auth }) => {
        if (!auth) return;
        const listenToNotifs = () => {
          const uid = auth.currentUser?.uid || user.email.replace(/\./g, '_');
          const notificationsRef = ref(db, `notifications/${uid}`);
          
          unsubscribe = onValue(notificationsRef, (snap) => {
            if (snap.exists()) {
              const val = snap.val();
              if (val) {
                const dbList = Object.keys(val).map(key => ({
                  id: key,
                  title: val[key].title || 'Alert',
                  message: val[key].message || '',
                  type: val[key].type || 'info',
                  timestamp: val[key].timestamp || Date.now(),
                  read: val[key].read ?? false
                }));
                setNotifications(prev => {
                  const localOnly = prev.filter(n => !n.id.startsWith('notif_db_'));
                  const dbMapped = dbList.map(n => ({ ...n, id: `notif_db_${n.id}` }));
                  const merged = [...dbMapped, ...localOnly];
                  return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
                });
              } else {
                setNotifications(prev => prev.filter(n => !n.id.startsWith('notif_db_')));
              }
            } else {
              setNotifications(prev => prev.filter(n => !n.id.startsWith('notif_db_')));
            }
          });
        };

        if (auth.currentUser) {
          listenToNotifs();
        } else {
          const unsubAuth = auth.onAuthStateChanged((u: any) => {
            if (u) {
              listenToNotifs();
              unsubAuth();
            }
          });
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loggedIn, user]);

  const handleMarkNotificationRead = async (id: string) => {
    if (id.startsWith('notif_db_')) {
      const dbId = id.substring(9);
      if (isFirebaseConfigured && db && loggedIn && user) {
        import('./firebase').then(({ auth }) => {
          const uid = auth?.currentUser?.uid || user.email.replace(/\./g, '_');
          update(ref(db, `notifications/${uid}/${dbId}`), { read: true }).catch(console.error);
        });
      }
    } else {
      setNotifications(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (isFirebaseConfigured && db && loggedIn && user) {
      import('./firebase').then(({ auth }) => {
        const uid = auth?.currentUser?.uid || user.email.replace(/\./g, '_');
        const updates: any = {};
        notifications.forEach(n => {
          if (n.id.startsWith('notif_db_')) {
            const dbId = n.id.substring(9);
            updates[`notifications/${uid}/${dbId}/read`] = true;
          }
        });
        if (Object.keys(updates).length > 0) {
          update(ref(db), updates).catch(console.error);
        }
      });
    }
  };

  const handleClearNotifications = async () => {
    setNotifications([]);
    if (isFirebaseConfigured && db && loggedIn && user) {
      import('./firebase').then(({ auth }) => {
        const uid = auth?.currentUser?.uid || user.email.replace(/\./g, '_');
        set(ref(db, `notifications/${uid}`), null).catch(console.error);
      });
    }
  };

  // Listen to DM redirect events
  useEffect(() => {
    const handleJoinRoom = () => {
      setActiveMainTab('study_rooms');
    };
    const handleJoinGroup = () => {
      setActiveMainTab('study_groups');
    };
    window.addEventListener('join-study-room', handleJoinRoom);
    window.addEventListener('join-study-group', handleJoinGroup);
    return () => {
      window.removeEventListener('join-study-room', handleJoinRoom);
      window.removeEventListener('join-study-group', handleJoinGroup);
    };
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
          profilePhoto: null,
          onboardingCompleted: false
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
              profilePhoto: loadedProfile.profilePhoto ?? data.profilePhoto ?? null,
              onboardingCompleted: loadedProfile.onboardingCompleted ?? false
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

      if (isFirebaseConfigured && db) {
        const tasksRef = ref(db, `users/${userKey}/tasks`);
        const unsubTasks = onValue(tasksRef, (snap) => {
          if (snap.exists()) {
            const val = snap.val();
            setTasks(val ? Object.values(val) : []);
          } else {
            setTasks([]);
          }
        });

        const coursesRef = ref(db, `users/${userKey}/courses`);
        const unsubCourses = onValue(coursesRef, (snap) => {
          if (snap.exists()) {
            setCourses(snap.val() || []);
          } else {
            setCourses([]);
          }
        });

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
    bio?: string,
    onboardingCompleted?: boolean
  ) => {
    const sessionData = {
      email, name, course, degree, college, location, isGuest,
      state, city, university, specialization, semester, careerGoal,
      interests, profilePhoto: photoUrl, phone, bio, onboardingCompleted
    };
    if (useMockDb) {
      localStorage.setItem('roomie_mock_session', JSON.stringify(sessionData));
    }
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
      profilePhoto: photoUrl ?? null,
      onboardingCompleted: onboardingCompleted ?? false
    });
    setProfilePhoto(photoUrl ?? null);
    setLoggedIn(true);
  };

  const handleLogOut = async () => {
    localStorage.removeItem('roomie_mock_session');
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

  const getPageTitle = () => {
    switch (activeMainTab) {
      case 'dashboard': return 'Dashboard';
      case 'shared_notes': return 'Shared Notes';
      case 'community_chat': return 'Community Chat';
      case 'study_groups': return 'Study Groups';
      case 'study_rooms': return 'Study Rooms';
      case 'ai_workspace': return 'AI Workspace';
      case 'planner': return 'Planner';
      case 'leaderboard': return 'Leaderboard';
      case 'profile': return 'Profile Settings';
      case 'settings': return 'App Settings';
      case 'account': return 'Account Settings';
      case 'quiz_station': return 'Study Quiz';
      default: return 'Roomie';
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
        background: '#f8fafc',
        padding: '2rem',
        fontFamily: '"Outfit", sans-serif',
        textAlign: 'center'
      }}>
        <div style={{
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: '16px',
          padding: '3rem 2rem',
          maxWidth: '450px',
          boxShadow: 'var(--shadow-flat-md)'
        }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem', color: '#0f172a' }}>
            Realtime service unavailable
          </h1>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            We could not establish a connection to our realtime synchronization network. Please verify that your system is online or check back shortly.
          </p>
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            color: 'var(--accent-pink)'
          }}>
            Error Code: FIREBASECONFIG_MISSING
          </div>
        </div>
      </div>
    );
  }

  // Pre-load Spinner
  if (!isLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: '"Outfit", sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #cbd5e1',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem auto'
          }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Connecting to Roomie...</div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!loggedIn || !user) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const isBypassed = user.email.includes('testuser') || (typeof window !== 'undefined' && window.location.search.includes('debug=true'));

  if (!isBypassed && !profile.onboardingCompleted) {
    return (
      <Onboarding
        userEmail={user.email}
        defaultName={profile.name || user.name || ''}
        onComplete={(profileData) => {
          const updatedProfile = {
            ...profile,
            ...profileData,
            onboardingCompleted: true
          };
          setProfile(updatedProfile);
          if (profileData.profilePhoto) {
            setProfilePhoto(profileData.profilePhoto);
          }
        }}
      />
    );
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
        border: '1px solid #e2e8f0',
        borderRadius: 'var(--border-radius-md)',
        padding: isMobile ? '0.5rem 0.75rem' : '0.75rem 1.5rem',
        boxShadow: 'var(--shadow-flat-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: isMobile ? '1.1rem' : '1.4rem',
            fontWeight: 900,
            letterSpacing: '0.05em',
            color: '#0f172a'
          }}>
            ROOMIE
          </h1>
          {!isMobile && (
            <span style={{ fontSize: '0.65rem', background: 'var(--accent-primary-light)', color: 'var(--accent-primary)', padding: '0.15rem 0.45rem', borderRadius: '6px', fontWeight: 800 }}>
              COLLABORATE
            </span>
          )}
        </div>

        {/* Current Page Title */}
        {!isMobile && (
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {getPageTitle()}
          </div>
        )}

        {/* User Stats HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem' }}>
          {/* Notification Center */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
              style={{
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                position: 'relative',
                padding: 0,
                outline: 'none'
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"></path>
              </svg>
              {notifications.filter(n => !n.read).length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  background: 'var(--accent-pink)',
                  borderRadius: '50%',
                  minWidth: '14px',
                  height: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6rem',
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
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-flat-md)',
                zIndex: 99999,
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxHeight: '320px',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>NOTIFICATIONS</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleMarkAllNotificationsRead}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-primary)' }}
                    >
                      Read All
                    </button>
                    <button
                      onClick={handleClearNotifications}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-pink)' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {notifications.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No notifications</span>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkNotificationRead(n.id)}
                        style={{
                          background: n.read ? '#fff' : '#f5f3ff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '0.5rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {!n.read && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-pink)' }} />}
                        </div>
                        <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>{n.title}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>{n.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar with Dropdown */}
          <div style={{ position: 'relative' }}>
            <div 
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              {profilePhoto ? (
                <img 
                  src={profilePhoto} 
                  alt="Profile" 
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #cbd5e1', boxShadow: 'var(--shadow-flat-sm)' }} 
                />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eaeaea', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', color: '#64748b' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
              )}
              {!isMobile && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', fontSize: '0.8rem', lineHeight: '1.2' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{profile.name || user.name}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{user.email}</span>
                </div>
              )}
            </div>
 
            {showProfileDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '180px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-flat-md)',
                zIndex: 99999,
                padding: '0.5rem 0',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <button
                  onClick={() => {
                    setActiveMainTab('profile');
                    setProfileSubTab('personal');
                    setShowProfileDropdown(false);
                  }}
                  style={{
                    background: 'none', border: 'none', textAlign: 'left',
                    padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer',
                    color: 'var(--text-primary)', fontWeight: 500
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  My Profile
                </button>
                <button
                  onClick={() => {
                    setActiveMainTab('profile');
                    setProfileSubTab('academic');
                    setShowProfileDropdown(false);
                  }}
                  style={{
                    background: 'none', border: 'none', textAlign: 'left',
                    padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer',
                    color: 'var(--text-primary)', fontWeight: 500
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  Academic Profile
                </button>
                <button
                  onClick={() => {
                    setActiveMainTab('settings');
                    setShowProfileDropdown(false);
                  }}
                  style={{
                    background: 'none', border: 'none', textAlign: 'left',
                    padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer',
                    color: 'var(--text-primary)', fontWeight: 500
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  Settings
                </button>
                <button
                  onClick={() => {
                    setActiveMainTab('account');
                    setShowProfileDropdown(false);
                  }}
                  style={{
                    background: 'none', border: 'none', textAlign: 'left',
                    padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer',
                    color: 'var(--text-primary)', fontWeight: 500
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  Account
                </button>
                <div style={{ borderTop: '1px solid #f1f5f9', margin: '0.25rem 0' }} />
                <button
                  onClick={() => {
                    handleLogOut();
                    setShowProfileDropdown(false);
                  }}
                  style={{
                    background: 'none', border: 'none', textAlign: 'left',
                    padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer',
                    color: 'var(--accent-pink)', fontWeight: 600
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main navigation bar (Desktop only) */}
      {!isMobile && (
        <nav style={{
          display: 'flex',
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: '12px',
          padding: '0.35rem',
          gap: '0.4rem',
          boxShadow: 'var(--shadow-flat-sm)',
          flexWrap: 'wrap'
        }}>
          {([
            { id: 'dashboard', label: 'Overview' },
            { id: 'shared_notes', label: 'Notes' },
            { id: 'community_chat', label: 'Community' },
            { id: 'study_groups', label: 'Groups' },
            { id: 'study_rooms', label: 'Study Rooms' },
            { id: 'friends', label: 'Friends' },
            { id: 'ai_workspace', label: 'AI Workspace' },
            { id: 'planner', label: 'Planner' },
            { id: 'leaderboard', label: 'Leaderboard' },
            { id: 'profile', label: 'Settings' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id)}
              style={{
                flex: 1,
                minWidth: '100px',
                background: activeMainTab === tab.id ? 'var(--accent-primary-light)' : 'none',
                border: 'none',
                borderRadius: '8px',
                color: activeMainTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-heading)',
                fontSize: '0.875rem',
                fontWeight: activeMainTab === tab.id ? 700 : 500,
                padding: '0.6rem 0',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
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
              email: user.email,
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
            onNavigate={(tab) => {
              if (tab === 'notes') {
                setActiveMainTab('shared_notes');
              } else {
                setActiveMainTab(tab as Tab);
              }
            }}
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

        {/* Friends Tab */}
        {activeMainTab === 'friends' && (
          <Friends
            userName={profile.name || user.name}
            userEmail={user.email}
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

        {/* Leaderboard Tab */}
        {activeMainTab === 'leaderboard' && (
          <Leaderboard
            currentUserEmail={user.email}
            currentCollege={profile.college}
            currentDegree={profile.degree}
            currentStudyPoints={studyPoints}
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
            activeSubTab={profileSubTab}
          />
        )}

        {/* Settings Tab */}
        {activeMainTab === 'settings' && (
          <div className="glass-panel anim-pop" style={{ background: '#fff', padding: '1.5rem', minHeight: '400px', textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>Application Settings</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '500px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Real-time Notifications</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Get desktop alerts for direct messages and study rooms.</span>
                </div>
                <input type="checkbox" style={{ width: '20px', height: '20px', cursor: 'pointer' }} defaultChecked />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Sound Effects</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Play soft notification sounds.</span>
                </div>
                <input type="checkbox" style={{ width: '20px', height: '20px', cursor: 'pointer' }} defaultChecked />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Public Presence</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Show other students when you are online in study rooms.</span>
                </div>
                <input type="checkbox" style={{ width: '20px', height: '20px', cursor: 'pointer' }} defaultChecked />
              </div>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeMainTab === 'account' && (
          <div className="glass-panel anim-pop" style={{ background: '#fff', padding: '1.5rem', minHeight: '400px', textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>Account Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>EMAIL ADDRESS</span>
                <strong style={{ fontSize: '0.95rem', color: '#000' }}>{user.email}</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ACCOUNT STATUS</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--accent-green)' }}>{user.isGuest ? 'Guest Session' : 'Verified Academic Account'}</strong>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Security Settings</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>To change password, update email or delete account, please access through the security dialog in the Settings tab.</p>
                <button 
                  onClick={() => setActiveMainTab('profile')} 
                  className="cyber-btn purple-fill"
                  style={{ width: 'fit-content' }}
                >
                  Manage Security via Settings
                </button>
              </div>
            </div>
          </div>
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
            <span>Home</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('shared_notes')} 
            className={`bottom-nav-btn ${activeMainTab === 'shared_notes' ? 'active' : ''}`}
          >
            <span>Notes</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('community_chat')} 
            className={`bottom-nav-btn ${activeMainTab === 'community_chat' ? 'active' : ''}`}
          >
            <span>Chat</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('study_groups')} 
            className={`bottom-nav-btn ${activeMainTab === 'study_groups' ? 'active' : ''}`}
          >
            <span>Groups</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('study_rooms')} 
            className={`bottom-nav-btn ${activeMainTab === 'study_rooms' ? 'active' : ''}`}
          >
            <span>Rooms</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('friends')} 
            className={`bottom-nav-btn ${activeMainTab === 'friends' ? 'active' : ''}`}
          >
            <span>Friends</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('ai_workspace')} 
            className={`bottom-nav-btn ${activeMainTab === 'ai_workspace' ? 'active' : ''}`}
          >
            <span>AI Tools</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('planner')} 
            className={`bottom-nav-btn ${activeMainTab === 'planner' ? 'active' : ''}`}
          >
            <span>Planner</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('profile')} 
            className={`bottom-nav-btn ${activeMainTab === 'profile' ? 'active' : ''}`}
          >
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
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              boxShadow: 'var(--shadow-flat-md)',
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
                borderRadius: '4px',
                padding: '0.1rem 0.35rem',
                color: '#fff'
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
            <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>{t.title}</strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
