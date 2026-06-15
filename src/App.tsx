import { useState, useEffect, useRef } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { StatPanel } from './components/StatPanel';
import { QuestBoard } from './components/QuestBoard';
import type { Quest } from './components/QuestBoard';
import { SkillTree } from './components/SkillTree';
import { BossBattle } from './components/BossBattle';
import { Achievements } from './components/Achievements';
import type { Achievement } from './components/Achievements';
import { SocialHub } from './components/SocialHub';
import { AIMentor } from './components/AIMentor';
import { NotesBoard } from './components/NotesBoard';
import { VideoStudyRoom } from './components/VideoStudyRoom';
import { QuizGenerator } from './components/QuizGenerator';
import { ref, update } from 'firebase/database';
import { databaseService, authService, db, isFirebaseConfigured } from './firebase';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string; isGuest?: boolean } | null>(null);

  // Core Game State
  const [level, setLevel] = useState(24);
  const [xp, setXp] = useState(3200);
  const [maxXp, setMaxXp] = useState(5000);
  const [skillPoints, setSkillPoints] = useState(2);
  const [stats, setStats] = useState({
    intelligence: 18,
    strength: 15,
    discipline: 20,
    creativity: 14,
    communication: 16,
    career: 22
  });
  const [unlockedSkills, setUnlockedSkills] = useState<string[]>(['python', 'numpy']);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [sessionXpEarned, setSessionXpEarned] = useState(0);

  // Real-Time Notification Center & Toast states
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

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  // Ask for browser HTML5 push notification permission on login
  useEffect(() => {
    if (loggedIn && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [loggedIn]);

  // Global listener for notifications dispatched anywhere in the app
  useEffect(() => {
    const handleNewNotification = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { title, message, type } = customEvent.detail || {};
      if (!title || !message) return;

      const newId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      // Update Notification List
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

      // Trigger Toast Alert popup
      setToasts(prev => [...prev, { id: newId, title, message, type: type || 'info' }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newId));
      }, 4000);

      // Trigger browser push notification if app is backgrounded
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

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState({
    course: 'Computer Science',
    degree: 'Bachelor of Science',
    college: 'State University',
    location: 'San Francisco, CA'
  });

  const [storyLog, setStoryLog] = useState<string[]>([
    'System core engaged. Welcome back, Operator.',
    'Dungeon Master active. Preparing daily roadmap data...'
  ]);

  // UI Navigation Tabs
  const [activeMainTab, setActiveMainTab] = useState<'dashboard' | 'notes' | 'video_rooms' | 'quiz_station' | 'chat' | 'profile'>('dashboard');
  const [activeRightTab, setActiveRightTab] = useState<'skills' | 'boss' | 'achievements'>('skills');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load User Game Data from database on login
  useEffect(() => {
    if (loggedIn && user) {
      if (user.isGuest) {
        setLevel(1);
        setXp(0);
        setMaxXp(1000);
        setStats({ intelligence: 5, strength: 5, discipline: 5, creativity: 5, communication: 5, career: 5 });
        setUnlockedSkills([]);
        setQuests([
          { id: 'q1', title: 'Complete Python Challenge', category: 'Study', difficulty: 'Medium', xpReward: 100, statReward: { intelligence: 10 }, completed: false },
          { id: 'q2', title: 'Read 20 Pages', category: 'Productivity', difficulty: 'Easy', xpReward: 50, statReward: { discipline: 5 }, completed: false }
        ]);
        setAchievements([]);
        setProfile({
          course: 'BCA (Bachelor of Computer Applications)',
          degree: 'Bachelor of Computer Applications',
          college: 'Christ University, Bangalore',
          location: 'Bangalore, Karnataka'
        });
        setProfilePhoto(null);
        setStoryLog([
          `Welcome to LifeQuest, Guest Operator.`,
          'You are browsing as a Guest. Please register an account to create rooms, write notes, and upload PDFs.'
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
            setStats(data.stats ?? { intelligence: 5, strength: 5, discipline: 5, creativity: 5, communication: 5, career: 5 });
            setUnlockedSkills(data.unlockedSkills ?? []);
            setQuests(data.quests ?? []);
            setAchievements(data.achievements ?? []);

            setProfile({
              course: data.course ?? 'Computer Science',
              degree: data.degree ?? 'Bachelor of Science',
              college: data.college ?? 'State University',
              location: data.location ?? 'San Francisco, CA'
            });
            setProfilePhoto(data.profilePhoto ?? null);
            setStoryLog([
              `Welcome back, ${data.name}. You are currently a level ${data.level} Operator.`,
              'Dungeon Master: Your active daily missions are loaded. Engage constraints to earn rewards.'
            ]);
            
            const totalEarnedPoints = data.level;
            const spent = (data.unlockedSkills ?? []).reduce((acc: number, val: string) => {
              if (val === 'python' || val === 'numpy' || val === 'pandas') return acc + 1;
              if (val === 'ml' || val === 'dl') return acc + 2;
              if (val === 'ai_engineer') return acc + 3;
              return acc;
            }, 0);
            setSkillPoints(Math.max(0, totalEarnedPoints - spent));
          }
        } catch (err) {
          console.error('Failed to load user state:', err);
        } finally {
          setIsLoaded(true);
        }
      };
      loadData();
    }
  }, [loggedIn, user]);

  // Auto-Save data to Database whenever State changes
  const saveState = async () => {
    if (!isLoaded) return;
    if (loggedIn && user && !user.isGuest) {
      const data = {
        email: user.email,
        name: user.name,
        level,
        xp,
        maxXp,
        stats,
        unlockedSkills,
        quests,
        achievements,

        course: profile.course,
        degree: profile.degree,
        college: profile.college,
        location: profile.location,
        profilePhoto: profilePhoto
      };
      try {
        await databaseService.saveUserData(user.email, data);
      } catch (err) {
        console.error('Auto-save failure:', err);
      }
    }
  };

  useEffect(() => {
    if (isLoaded) {
      saveState();
    }
  }, [level, xp, maxXp, stats, unlockedSkills, quests, achievements, profile, profilePhoto, isLoaded]);

  useEffect(() => {
    if (loggedIn && user) {
      const userKey = user.email.replace(/\./g, '_');
      const presenceData = {
        email: user.email,
        name: user.name,
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
        } else {
          console.warn('[Presence] Realtime service unavailable. Firebase not configured.');
        }
      };

      setOnline();

      const heartbeat = setInterval(() => {
        setOnline();
      }, 20000);

      const setOffline = () => {
        const offlineData = {
          online: false,
          lastActive: Date.now()
        };
        if (isFirebaseConfigured && db) {
          update(ref(db, 'community_users/' + userKey), offlineData).catch(() => {});
        } else {
          console.warn('[Presence] Realtime service unavailable. Firebase not configured.');
        }
      };

      const handleUnload = () => {
        setOffline();
      };

      window.addEventListener('beforeunload', handleUnload);

      return () => {
        clearInterval(heartbeat);
        window.removeEventListener('beforeunload', handleUnload);
        setOffline();
      };
    }
  }, [loggedIn, user, profilePhoto, isLoaded]);


  const handleLoginSuccess = (
    email: string, 
    name: string,
    course?: string,
    degree?: string,
    college?: string,
    location?: string,
    isGuest?: boolean
  ) => {
    setUser({ email, name, isGuest });
    if (course || degree || college || location) {
      setProfile({
        course: course ?? 'Computer Science',
        degree: degree ?? 'Bachelor of Science',
        college: college ?? 'State University',
        location: location ?? 'San Francisco, CA'
      });
    }
    setLoggedIn(true);
  };

  const handleLogOut = async () => {
    await authService.signOut();
    setLoggedIn(false);
    setUser(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image file must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const renderSilhouette = (size: string) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, color: '#64748b', background: '#e2e8f0', borderRadius: '50%', padding: '15%' }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );

  // Generic Reward Helpers
  const handleRewardXp = (amount: number, reason: string) => {
    setSessionXpEarned(prev => prev + amount);
    setStoryLog(prev => [reason, ...prev]);
    const newXp = xp + amount;
    if (newXp >= maxXp) {
      const rolloverXp = newXp - maxXp;
      const nextLevel = level + 1;
      const nextMaxXp = Math.floor(maxXp * 1.15);

      setLevel(nextLevel);
      setXp(rolloverXp);
      setMaxXp(nextMaxXp);
      setSkillPoints(prev => prev + 1);
      
      setStoryLog(prev => [`LEVEL UP! Reached Level ${nextLevel}! +1 Skill Point awarded.`, ...prev]);
    } else {
      setXp(newXp);
    }
  };

  const handleRewardStat = (statName: string, value: number) => {
    const key = statName as keyof typeof stats;
    setStats(prev => ({
      ...prev,
      [key]: Math.min(100, prev[key] + value)
    }));
  };

  // Complete Daily Quests
  const handleCompleteQuest = (questId: string) => {
    const quest = quests.find(q => q.id === questId);
    if (!quest || quest.completed) return;

    // Mark as completed
    const updatedQuests = quests.map(q => q.id === questId ? { ...q, completed: true } : q);
    setQuests(updatedQuests);

    // Apply stat adjustments
    const newStats = { ...stats };
    Object.entries(quest.statReward).forEach(([statName, value]) => {
      const key = statName as keyof typeof stats;
      newStats[key] = Math.min(100, newStats[key] + value);
    });
    setStats(newStats);

    const logMsg = `Completed '${quest.title}'. Earned +${quest.xpReward} XP!`;
    handleRewardXp(quest.xpReward, logMsg);

    // Check level achievements
    if (level >= 20) {
      unlockAchievement('lvl_20');
    }

    if (quest.category === 'Coding') {
      unlockAchievement('first_proj');
    }
  };

  const unlockAchievement = (id: string) => {
    setAchievements(prev => prev.map(badge => {
      if (badge.id === id && !badge.unlocked) {
        const notifyMsg = `ACHIEVEMENT UNLOCKED: '${badge.title}' (${badge.rarity})! Check achievements panel.`;
        setStoryLog(prevLogs => [notifyMsg, ...prevLogs]);
        return { ...badge, unlocked: true, unlockedAt: new Date().toLocaleDateString() };
      }
      return badge;
    }));
  };

  const handleAddQuest = (newQuest: Omit<Quest, 'id' | 'completed'>) => {
    const quest: Quest = {
      ...newQuest,
      id: `q_${Date.now()}`,
      completed: false
    };
    setQuests(prev => [...prev, quest]);
    const addMsg = `Mission registered: '${quest.title}'. Reward parameters loaded.`;
    setStoryLog(prev => [addMsg, ...prev]);
  };

  const handleUnlockSkill = (
    skillId: string, 
    cost: number, 
    rewards: { intelligence?: number; career?: number; creativity?: number }
  ) => {
    if (skillPoints < cost) return;

    setUnlockedSkills(prev => [...prev, skillId]);
    setSkillPoints(prev => prev - cost);

    // Apply stat rewards
    const newStats = { ...stats };
    if (rewards.intelligence) newStats.intelligence = Math.min(100, newStats.intelligence + rewards.intelligence);
    if (rewards.career) newStats.career = Math.min(100, newStats.career + rewards.career);
    if (rewards.creativity) newStats.creativity = Math.min(100, newStats.creativity + rewards.creativity);
    setStats(newStats);

    const skillName = skillId.toUpperCase();
    const unlockMsg = `Skill Unlocked: [${skillName}]. Neural pathway initialized. Stats boosted!`;
    setStoryLog(prev => [unlockMsg, ...prev]);
  };

  const handleDefeatBoss = (xpReward: number, badgeName: string) => {
    handleRewardXp(xpReward, `Defeated Overfitter Prime and earned the '${badgeName}' title!`);
    unlockAchievement('ml_master');
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
      
      {/* Top Navbar */}
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
            LIFEQUEST
          </h1>
          {!isMobile && (
            <span style={{ fontSize: '0.55rem', background: 'var(--accent-gold)', border: '1.5px solid #000', padding: '0.15rem 0.35rem', borderRadius: '6px', fontWeight: 800 }}>
              STUDENT GILDED
            </span>
          )}
        </div>

        {/* User HUD Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem' }}>
          {/* Notification Bell */}
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
                      onClick={() => {
                        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                      }}
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
                        onClick={() => {
                          setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                        }}
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
            <div style={{ width: '32px', height: '32px' }}>
              {renderSilhouette('100%')}
            </div>
          )}
          
          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 800, color: '#000' }}>{user.name}</span>
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
          boxShadow: '4px 4px 0px #000'
        }}>
          {([
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'notes', label: 'Shared Notes' },
            { id: 'video_rooms', label: 'Study Video Rooms' },
            { id: 'quiz_station', label: 'AI Quiz Station' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id)}
              style={{
                flex: 1,
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
          <main className="dashboard-grid">


            <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* College Academic Profile Card */}
              <div className="glass-panel" style={{
                background: '#fffcf0',
                border: '3.5px solid #000',
                boxShadow: '4px 4px 0px #000',
                borderRadius: '16px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  borderBottom: '2px solid #000',
                  paddingBottom: '0.4rem'
                }}>
                  ACADEMIC CREDENTIALS
                </h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      border: '2.5px solid #000',
                      position: 'relative',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      flexShrink: 0,
                      boxShadow: '2px 2px 0px #000',
                      transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                    title="Click to upload photo"
                  >
                    {profilePhoto ? (
                      <img 
                        src={profilePhoto} 
                        alt="Profile avatar" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      renderSilhouette('100%')
                    )}
                    <div style={{
                      position: 'absolute',
                      bottom: 0, left: 0, right: 0,
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      fontSize: '0.45rem',
                      fontWeight: 800,
                      textAlign: 'center',
                      padding: '0.2rem 0',
                      fontFamily: 'var(--font-heading)'
                    }}>
                      EDIT
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoChange} 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, flex: 1 }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>COURSE/MAJOR:</span>{' '}
                      <strong style={{ color: 'var(--accent-purple)' }}>{profile.course.toUpperCase()}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>DEGREE LEVEL:</span>{' '}
                      <strong style={{ color: 'var(--accent-pink)' }}>{profile.degree}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>COLLEGE:</span>{' '}
                      <strong style={{ color: '#000' }}>{profile.college}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>LOCATION:</span>{' '}
                      <strong style={{ color: '#009688' }}>{profile.location}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <StatPanel
                stats={stats}
                level={level}
                xp={xp}
                maxXp={maxXp}
                completedQuestsCount={quests.filter(q => q.completed).length}
                totalQuestsCount={quests.length}
                unlockedSkillsCount={unlockedSkills.length}
                unlockedAchievementsCount={achievements.length}
                sessionXpEarned={sessionXpEarned}
              />
              <QuestBoard
                quests={quests}
                onCompleteQuest={handleCompleteQuest}
                onAddQuest={handleAddQuest}
                storyLog={storyLog}
              />

              {/* AI Quiz Station Card for Mobile & Desktop shortcut */}
              <div className="glass-panel glowing-cyan" style={{
                background: 'var(--accent-purple)',
                border: '3.5px solid #000',
                boxShadow: '4px 4px 0px #000',
                borderRadius: '16px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                color: '#000',
                cursor: 'pointer',
                marginTop: '1.25rem'
              }} onClick={() => setActiveMainTab('quiz_station')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800 }}>
                    🤖 AI QUIZ STATION
                  </h3>
                  <span style={{ fontSize: '0.7rem', background: '#fff', border: '1.5px solid #000', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 800 }}>LAUNCH</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700 }}>
                  Generate customized AI tests, battle subject questions, and boost your communication/intelligence parameters instantly!
                </p>
              </div>
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                display: 'flex',
                background: '#fff',
                border: '3px solid #000',
                borderRadius: '16px',
                padding: '0.3rem',
                gap: '0.25rem',
                boxShadow: '3px 3px 0px #000'
              }}>
                {(['skills', 'boss', 'achievements'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveRightTab(tab)}
                    style={{
                      flex: 1,
                      background: activeRightTab === tab ? 'var(--accent-cyan)' : 'none',
                      border: activeRightTab === tab ? '2px solid #000' : '2px solid transparent',
                      borderRadius: '10px',
                      color: '#000',
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.5rem 0',
                      cursor: 'pointer',
                      boxShadow: activeRightTab === tab ? '2px 2px 0px #000' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab === 'skills' ? 'SKILLS' : tab === 'boss' ? 'BOSS' : 'BADGES'}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {activeRightTab === 'skills' && (
                  <SkillTree
                    unlockedSkills={unlockedSkills}
                    skillPoints={skillPoints}
                    onUnlockSkill={handleUnlockSkill}
                  />
                )}
                
                {activeRightTab === 'boss' && (
                  <BossBattle
                    userStats={stats}
                    onDefeatBoss={handleDefeatBoss}
                  />
                )}

                {activeRightTab === 'achievements' && (
                  <Achievements
                    achievements={achievements}
                    userName={user.name}
                    userLevel={level}
                  />
                )}
              </div>

              <SocialHub
                userName={user.name}
                userLevel={level}
                userXp={xp}
              />
            </section>
          </main>
        )}



        {/* Shared Notes / Chat Tab */}
        {(activeMainTab === 'notes' || activeMainTab === 'chat') && (
          <NotesBoard 
            userName={user.name} 
            userEmail={user.email} 
            userCourse={profile.course} 
            onRewardXp={handleRewardXp} 
            activeSubView={isMobile ? activeMainTab : undefined}
            isGuest={user.isGuest}
          />
        )}

        {/* Video Study Rooms Tab */}
        {activeMainTab === 'video_rooms' && (
          <VideoStudyRoom 
            userName={user.name} 
            userEmail={user.email}
            profilePhoto={profilePhoto}
            userStats={stats} 
            userCourse={profile.course} 
            onRewardXp={handleRewardXp} 
            isGuest={user.isGuest}
          />
        )}

        {/* AI Quiz Station Tab */}
        {activeMainTab === 'quiz_station' && (
          <QuizGenerator onRewardXp={handleRewardXp} onRewardStat={handleRewardStat} />
        )}

        {/* Mobile Profile Tab */}
        {isMobile && activeMainTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '40px' }}>
            <div className="glass-panel" style={{
              background: '#fffcf0',
              border: '3.5px solid #000',
              boxShadow: '4px 4px 0px #000',
              borderRadius: '16px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.05rem',
                fontWeight: 800,
                borderBottom: '2px solid #000',
                paddingBottom: '0.4rem'
              }}>
                ACADEMIC CREDENTIALS
              </h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    border: '2.5px solid #000',
                    position: 'relative',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '2px 2px 0px #000'
                  }}
                  title="Click to upload photo"
                >
                  {profilePhoto ? (
                    <img 
                      src={profilePhoto} 
                      alt="Profile avatar" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    renderSilhouette('100%')
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    fontSize: '0.55rem',
                    fontWeight: 800,
                    textAlign: 'center',
                    padding: '0.2rem 0',
                    fontFamily: 'var(--font-heading)'
                  }}>
                    EDIT
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handlePhotoChange} 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, flex: 1 }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>COURSE/MAJOR:</span>{' '}
                    <strong style={{ color: 'var(--accent-purple)' }}>{profile.course.toUpperCase()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>DEGREE LEVEL:</span>{' '}
                    <strong style={{ color: 'var(--accent-pink)' }}>{profile.degree}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>COLLEGE:</span>{' '}
                    <strong style={{ color: '#000' }}>{profile.college}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>LOCATION:</span>{' '}
                    <strong style={{ color: '#009688' }}>{profile.location}</strong>
                  </div>
                </div>
              </div>
            </div>

            <StatPanel
              stats={stats}
              level={level}
              xp={xp}
              maxXp={maxXp}
              completedQuestsCount={quests.filter(q => q.completed).length}
              totalQuestsCount={quests.length}
              unlockedSkillsCount={unlockedSkills.length}
              unlockedAchievementsCount={achievements.length}
              sessionXpEarned={sessionXpEarned}
            />

            <Achievements
              achievements={achievements}
              userName={user.name}
              userLevel={level}
            />

            <button
              onClick={handleLogOut}
              className="cyber-btn pink-fill"
              style={{ width: '100%', height: '44px', fontWeight: 900 }}
            >
              LOG OUT
            </button>
          </div>
        )}

      </div>

      {/* Floating AI Mentor Companion */}
      <AIMentor userName={user.name} userLevel={level} />

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
            onClick={() => setActiveMainTab('notes')} 
            className={`bottom-nav-btn ${activeMainTab === 'notes' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>📚</span>
            <span>Notes</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('video_rooms')} 
            className={`bottom-nav-btn ${activeMainTab === 'video_rooms' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>🎥</span>
            <span>Rooms</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('chat')} 
            className={`bottom-nav-btn ${activeMainTab === 'chat' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            <span>Chat</span>
          </button>
          <button 
            onClick={() => setActiveMainTab('profile')} 
            className={`bottom-nav-btn ${activeMainTab === 'profile' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>👤</span>
            <span>Profile</span>
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

