import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured, ref, onValue, auth } from '../firebase';

interface Course {
  id: string;
  name: string;
  progress: number;
}

interface Task {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  status: string;
  completedAt?: string;
}

interface Note {
  id: string;
  title: string;
  course: string;
  authorName: string;
  createdAt?: string;
}

interface FocusSession {
  id?: string;
  taskName: string;
  duration: number;
  completed: boolean;
  startedAt: string;
  completedAt: string;
}

interface DashboardProps {
  profile: {
    name: string;
    email: string;
    college: string;
    university: string;
    degree: string;
    specialization: string;
    semester: string;
    careerGoal: string;
    profilePhoto: string | null;
  };
  tasks: Task[];
  notes: Note[];
  courses: Course[];
  studyPoints: number;
  milestonesCount: number;
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  profile,
  tasks,
  notes,
  courses,
  studyPoints: _studyPoints,
  milestonesCount: _milestonesCount,
  onNavigate
}) => {
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Sync focus sessions from Firebase Realtime Database
  useEffect(() => {
    const currentUid = auth?.currentUser?.uid || profile.email.replace(/\./g, '_');
    
    if (isFirebaseConfigured && db) {
      const sessionsRef = ref(db, `users/${currentUid}/focus_sessions`);
      const unsub = onValue(sessionsRef, (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          const list = Object.entries(val).map(([id, s]: [string, any]) => ({
            id,
            ...s
          }));
          setFocusSessions(list);
        } else {
          setFocusSessions([]);
        }
        setLoadingSessions(false);
      });
      return () => unsub();
    } else {
      // Local Storage mock DB fallback
      try {
        const localKey = 'roomie_mock_focus_sessions';
        const list = JSON.parse(localStorage.getItem(localKey) || '[]');
        setFocusSessions(list);
      } catch (e) {
        console.error("Failed to read local focus sessions:", e);
      }
      setLoadingSessions(false);
    }
  }, [profile.email]);

  // Calculations
  const completedSessions = focusSessions.filter(s => s.completed);
  const totalCompletedSessionsCount = completedSessions.length;

  const calculateOverallProgress = () => {
    if (courses.length === 0) return 0;
    const total = courses.reduce((sum, c) => sum + c.progress, 0);
    return Math.round(total / courses.length);
  };

  const upcomingDeadlines = tasks
    .filter(t => t.status !== 'Completed' && t.deadline)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  // Generate Recent Academic Activity Feed (focus sessions completed, notes uploaded, tasks completed)
  const getRecentActivity = () => {
    const activityList: { id: string; type: 'focus' | 'note' | 'task'; text: string; time: Date }[] = [];

    // Focus Session events
    focusSessions.forEach((s, idx) => {
      activityList.push({
        id: `focus-${idx}-${s.completedAt}`,
        type: 'focus',
        text: `Focused for ${s.duration} mins on "${s.taskName}" (${s.completed ? 'Completed' : 'Stopped early'})`,
        time: new Date(s.completedAt)
      });
    });

    // Notes Shared events
    notes.slice(0, 5).forEach((n, idx) => {
      activityList.push({
        id: `note-${n.id || idx}`,
        type: 'note',
        text: `Shared study material: "${n.title}" for course "${n.course}"`,
        time: n.createdAt ? new Date(n.createdAt) : new Date(Date.now() - (idx * 3600 * 1000 * 2)) // simulated
      });
    });

    // Task completion events
    tasks.filter(t => t.status === 'Completed').forEach(t => {
      activityList.push({
        id: `task-${t.id}`,
        type: 'task',
        text: `Finished study task: "${t.title}"`,
        time: t.completedAt ? new Date(t.completedAt) : new Date(Date.now() - 3600 * 1000)
      });
    });

    // Sort descending by time
    return activityList
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 5);
  };

  const recentActivity = getRecentActivity();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      paddingBottom: '2.5rem',
      textAlign: 'left',
      background: 'var(--bg-app, #fdfbf7)',
      width: '100%'
    }}>
      
      {/* Tape heading decoration */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          background: '#a7f3d0',
          border: '2px solid #0f172a',
          padding: '0.35rem 1.75rem',
          borderRadius: '4px',
          fontFamily: 'var(--font-heading)',
          fontWeight: 900,
          fontSize: '1.15rem',
          color: '#0f172a',
          boxShadow: '3px 3px 0px #0f172a',
          transform: 'rotate(-1deg)',
          position: 'relative'
        }}>
          ACADEMIC REPORT
          <div style={{ position: 'absolute', top: '-8px', left: '15px', width: '25px', height: '10px', background: 'rgba(0,0,0,0.1)', transform: 'rotate(-30deg)' }} />
          <div style={{ position: 'absolute', top: '-8px', right: '15px', width: '25px', height: '10px', background: 'rgba(0,0,0,0.1)', transform: 'rotate(30deg)' }} />
        </div>

        <button
          onClick={() => onNavigate('profile')}
          className="cyber-btn"
          style={{
            border: '2px solid #0f172a',
            boxShadow: '3px 3px 0px #0f172a',
            fontSize: '0.8rem',
            fontWeight: 800,
            background: '#ffffff',
            borderRadius: '12px'
          }}
        >
          ⚙️ Edit Profile
        </button>
      </div>

      {/* Grid of the exactly 7 requested cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginTop: '0.5rem'
      }}>

        {/* 1. CURRENT DEGREE */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative'
        }}>
          {/* Asymmetric Tape Header */}
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#fed7aa', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(-2deg)'
          }}>
            CURRENT DEGREE
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {profile.degree || 'Bachelor of Science'}
            </h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginTop: '0.25rem' }}>
              Specialization: {profile.specialization || 'Computer Science'}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#0f172a', background: '#dbeafe', border: '1.5px solid #0f172a', borderRadius: '6px', display: 'inline-block', padding: '1px 8px', fontWeight: 800, marginTop: '0.75rem' }}>
              🏫 {profile.college || 'State University'}
            </span>
          </div>
        </div>

        {/* 2. CURRENT SEMESTER */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative'
        }}>
          {/* Asymmetric Tape Header */}
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#fef08a', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(2deg)'
          }}>
            CURRENT SEMESTER
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {profile.semester || '1st Semester'}
              </h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginTop: '0.25rem' }}>
                University: {profile.university || 'Christ University'}
              </span>
            </div>
            <div style={{
              fontSize: '2rem',
              background: '#fbcfe8',
              border: '2px solid #0f172a',
              borderRadius: '12px',
              width: '50px',
              height: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '2px 2px 0px #0f172a'
            }}>
              📅
            </div>
          </div>
        </div>

        {/* 3. LEARNING PROGRESS */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative'
        }}>
          {/* Asymmetric Tape Header */}
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#e9d5ff', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(-1.5deg)'
          }}>
            LEARNING PROGRESS
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#6366f1' }}>
                {calculateOverallProgress()}%
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                Degree Target Completion
              </span>
            </div>
            
            {/* Hand-drawn style progress bar */}
            <div style={{
              height: '14px',
              background: '#f1f5f9',
              border: '2px solid #0f172a',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                height: '100%',
                width: `${calculateOverallProgress()}%`,
                background: '#6366f1',
                borderRadius: '4px',
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>
        </div>

        {/* 4. ACTIVE COURSES */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative',
          gridColumn: 'span 1'
        }}>
          {/* Asymmetric Tape Header */}
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#ccfbf1', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(1deg)'
          }}>
            ACTIVE COURSES
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {courses.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '0.5rem 0' }}>
                No active courses. Set them up in settings!
              </p>
            ) : (
              courses.map(course => (
                <div key={course.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 800 }}>
                    <span style={{ color: '#0f172a' }}>📖 {course.name}</span>
                    <span style={{ color: '#6366f1' }}>{course.progress}%</span>
                  </div>
                  <div style={{ height: '8px', background: '#f1f5f9', border: '1.5px solid #0f172a', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${course.progress}%`, background: '#10b981' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 5. UPCOMING DEADLINES */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative'
        }}>
          {/* Asymmetric Tape Header */}
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#fca5a5', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(-2deg)'
          }}>
            UPCOMING DEADLINES
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {upcomingDeadlines.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '0.5rem 0' }}>
                🎉 Yay! No upcoming deadlines.
              </p>
            ) : (
              upcomingDeadlines.map(task => (
                <div key={task.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1.5px solid #0f172a',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '10px',
                  background: '#fef2f2'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#991b1b' }}>{task.title}</span>
                    <span style={{ fontSize: '0.62rem', color: '#b91c1c', fontWeight: 700 }}>Priority: {task.priority}</span>
                  </div>
                  <span style={{
                    fontSize: '0.65rem',
                    background: '#0f172a',
                    color: '#fff',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '6px',
                    fontWeight: 800
                  }}>
                    ⏳ {task.deadline}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 6. FOCUS SESSIONS COMPLETED */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative'
        }}>
          {/* Asymmetric Tape Header */}
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#bbf7d0', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(1.5deg)'
          }}>
            FOCUS SESSIONS COMPLETED
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              {loadingSessions ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Syncing...</span>
              ) : (
                <>
                  <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 950, color: '#166534', margin: 0 }}>
                    {totalCompletedSessionsCount}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 750 }}>
                    Tracked via actual timers
                  </span>
                </>
              )}
            </div>
            <button
              onClick={() => onNavigate('focus_clock')}
              className="cyber-btn"
              style={{
                background: '#8b5cf6',
                color: '#fff',
                border: '2px solid #0f172a',
                boxShadow: '2px 2px 0px #0f172a',
                fontSize: '0.75rem',
                fontWeight: 900,
                borderRadius: '8px',
                padding: '0.35rem 0.65rem'
              }}
            >
              ⏱️ Focus Clock
            </button>
          </div>
        </div>

        {/* 7. RECENT ACADEMIC ACTIVITY */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative',
          gridColumn: 'span 2'
        }}>
          {/* Asymmetric Tape Header */}
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#e0e7ff', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(-1deg)'
          }}>
            RECENT ACADEMIC ACTIVITY
          </div>
          
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {recentActivity.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '0.5rem 0' }}>
                No recent activity recorded yet. Start a focus clock or upload material to see your timeline update!
              </p>
            ) : (
              recentActivity.map(act => (
                <div key={act.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  borderBottom: '1px dashed #cbd5e1',
                  paddingBottom: '0.5rem'
                }}>
                  <div style={{
                    fontSize: '1.1rem',
                    background: act.type === 'focus' ? '#bbf7d0' : act.type === 'note' ? '#dbeafe' : '#fef08a',
                    border: '1.5px solid #0f172a',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {act.type === 'focus' ? '⏱️' : act.type === 'note' ? '📚' : '✅'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 750 }}>
                      {act.text}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {act.time.toLocaleDateString()} {act.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
