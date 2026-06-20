import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured, ref, onValue } from '../firebase';
import { Leaderboard } from './Leaderboard';

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
}

interface Note {
  id: string;
  title: string;
  course: string;
  authorName: string;
}

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  members?: Record<string, boolean>;
  createdBy: string;
}

interface StudyRoom {
  id: string;
  title: string;
  course: string;
  hostEmail: string;
  participantCount?: number;
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
  studyPoints,
  milestonesCount,
  onNavigate
}) => {
  const [recentGroups, setRecentGroups] = useState<StudyGroup[]>([]);
  const [recentRooms, setRecentRooms] = useState<StudyRoom[]>([]);

  // Fetch groups & rooms for overview preview
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    // Load groups
    const groupsRef = ref(db, 'community_groups');
    const unsubGroups = onValue(groupsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.values(val).map((g: any) => ({
          id: g.id,
          name: g.name,
          description: g.description || '',
          members: g.members,
          createdBy: g.createdBy
        })).slice(0, 3);
        setRecentGroups(list);
      } else {
        setRecentGroups([]);
      }
    });

    // Load rooms
    const roomsRef = ref(db, 'study_rooms');
    const unsubRooms = onValue(roomsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.values(val).map((r: any) => ({
          id: r.id,
          title: r.title,
          course: r.course || 'General',
          hostEmail: r.hostEmail,
          participantCount: r.participants ? Object.keys(r.participants).length : 0
        })).slice(0, 3);
        setRecentRooms(list);
      } else {
        setRecentRooms([]);
      }
    });

    return () => {
      unsubGroups();
      unsubRooms();
    };
  }, []);

  // Filter tasks
  const recentTasks = tasks.filter(t => t.status !== 'Completed').slice(0, 3);
  const upcomingDeadlines = tasks
    .filter(t => t.status !== 'Completed' && t.deadline)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 3);
  const recentNotes = notes.slice(0, 3);

  const calculateOverallProgress = () => {
    if (courses.length === 0) return 0;
    const total = courses.reduce((sum, c) => sum + c.progress, 0);
    return Math.round(total / courses.length);
  };

  // Weekly study activity dummy weights representing professional layout
  const weekDays = [
    { name: 'Mon', hours: 4.2 },
    { name: 'Tue', hours: 5.5 },
    { name: 'Wed', hours: 3.0 },
    { name: 'Thu', hours: 6.8 },
    { name: 'Fri', hours: 4.0 },
    { name: 'Sat', hours: 2.5 },
    { name: 'Sun', hours: 5.0 }
  ];

  const getAiRecommendations = () => {
    const recs = [];
    
    // DBMS or low progress course recommendation
    const lowProgressCourse = courses.find(c => c.progress < 50);
    if (lowProgressCourse) {
      recs.push({
        id: 'rec_course',
        title: `Boost ${lowProgressCourse.name}`,
        desc: `Your progress is currently at ${lowProgressCourse.progress}%. Spend 45 minutes reviewing normal forms and queries today.`,
        actionLabel: 'Study Course',
        tab: 'profile'
      });
    } else if (courses.length > 0) {
      recs.push({
        id: 'rec_course_generic',
        title: 'Maintain Study Momentum',
        desc: `You are doing great! Dedicate some time to review ${courses[0].name} to keep your progress high.`,
        actionLabel: 'Study Course',
        tab: 'profile'
      });
    } else {
      recs.push({
        id: 'rec_course_empty',
        title: 'Initialize Course Catalog',
        desc: 'Add your active academic courses in your Profile Settings to get tailored progress tracking and recommendations.',
        actionLabel: 'Go to Profile',
        tab: 'profile'
      });
    }

    // Task deadline recommendation
    const nextTask = tasks.find(t => t.status !== 'Completed' && t.deadline);
    if (nextTask) {
      recs.push({
        id: 'rec_task',
        title: `Prepare for: ${nextTask.title}`,
        desc: `This task is pending with a deadline set for ${nextTask.deadline}. Break it down into 3 smaller sub-tasks today.`,
        actionLabel: 'Open Planner',
        tab: 'planner'
      });
    } else {
      recs.push({
        id: 'rec_task_generic',
        title: 'Plan Your Next Milestone',
        desc: 'All clear! Create new learning goals or tasks in the Planner to organize your week.',
        actionLabel: 'Open Planner',
        tab: 'planner'
      });
    }

    // Community / Group recommendation
    if (recentGroups.length > 0) {
      recs.push({
        id: 'rec_group',
        title: `Connect in: ${recentGroups[0].name}`,
        desc: 'Share your study progress or ask questions in your active group chat to reinforce your learnings.',
        actionLabel: 'Open Groups',
        tab: 'study_groups'
      });
    } else {
      recs.push({
        id: 'rec_group_generic',
        title: 'Join Education Communities',
        desc: 'Collaborative learning is 2x more effective. Join a study group or enter a live study room to study with peers.',
        actionLabel: 'Join Groups',
        tab: 'study_groups'
      });
    }

    return recs;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem', textAlign: 'left' }}>
      
      {/* 1. Welcoming Banner Greeting */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.25rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
          Welcome back to your workspace!
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
          Manage your schedule, collaborate with classmates, and view your academic performance analytics in real-time.
        </p>
      </div>

      {/* 2. Four Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', width: '100%' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '16px', boxShadow: 'var(--shadow-flat-sm)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--accent-primary)', fontWeight: 900 }}>{calculateOverallProgress()}%</strong>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '16px', boxShadow: 'var(--shadow-flat-sm)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Study Hours</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--accent-cyan)', fontWeight: 900 }}>31.0h</strong>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '16px', boxShadow: 'var(--shadow-flat-sm)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Study Points</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--accent-purple)', fontWeight: 900 }}>{studyPoints}</strong>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '16px', boxShadow: 'var(--shadow-flat-sm)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Milestones</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--accent-pink)', fontWeight: 900 }}>{milestonesCount}</strong>
        </div>
      </div>

      {/* 3. Grid Sections */}
      <div className="dashboard-grid">
        
        {/* Left Side Column: Analytics & Courses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* AI Recommendations Widget */}
          <div className="glass-panel" style={{ background: '#fdfbf7', border: '1.5px dashed var(--accent-purple)', borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '20px', height: '20px', color: 'var(--accent-purple)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096m.813 5.096a3.21 3.21 0 106.396-1.396 3.21 3.21 0 00-6.396 1.396zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-purple)', margin: 0 }}>
                AI Recommendations
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {getAiRecommendations().map(rec => (
                <div key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', padding: '0.85rem 1rem', borderRadius: '12px', gap: '1rem', boxShadow: 'var(--shadow-flat-sm)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'left', flex: 1 }}>
                    <strong style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 800 }}>{rec.title}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>{rec.desc}</span>
                  </div>
                  <button
                    onClick={() => onNavigate(rec.tab)}
                    className="cyber-btn"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', minHeight: 'auto', whiteSpace: 'nowrap', background: 'var(--accent-purple-light)', color: 'var(--accent-purple)', border: 'none', fontWeight: 700 }}
                  >
                    {rec.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Active Courses Progress */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                ACTIVE COURSES ({courses.length})
              </h3>
              <button
                onClick={() => onNavigate('profile')}
                className="cyber-btn"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto' }}
              >
                Manage
              </button>
            </div>
            
            {courses.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, padding: '1rem 0' }}>
                No active courses added. Add courses in your Profile to track progress.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Overall Academic Completion</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{calculateOverallProgress()}%</span>
                </div>
                {courses.map(course => (
                  <div key={course.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{course.name}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{course.progress}%</span>
                    </div>
                    <div style={{ height: '8px', background: '#f1f5f9', border: 'none', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${course.progress}%`, background: 'var(--accent-primary)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Academic Activity */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
              WEEKLY STUDY ACTIVITY
            </h3>
            
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', padding: '0 0.5rem' }}>
              {weekDays.map(day => {
                const heightPercent = Math.round((day.hours / 8) * 100);
                return (
                  <div key={day.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>{day.hours}h</span>
                    <div style={{
                      width: '100%',
                      height: `${heightPercent}px`,
                      background: 'var(--accent-primary)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: '4px',
                      transition: 'height 0.3s ease'
                    }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{day.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Side Column: Leaderboard, Tasks & Communities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Top 5 Leaderboard Widget */}
          <Leaderboard
            isCompact={true}
            currentUserEmail={profile.email}
            currentCollege={profile.college}
            currentDegree={profile.degree}
            currentStudyPoints={studyPoints}
          />

          {/* Recent Tasks */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                RECENT PLANNED TASKS
              </h3>
              <button
                onClick={() => onNavigate('planner')}
                className="cyber-btn"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto' }}
              >
                Planner
              </button>
            </div>

            {recentTasks.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, padding: '1rem 0' }}>
                No active tasks. Create tasks in your Planner.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentTasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{task.title}</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Priority: {task.priority} | Status: {task.status}
                      </span>
                    </div>
                    {task.deadline && (
                      <span style={{ fontSize: '0.65rem', background: '#334155', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                        {task.deadline}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Deadlines */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                UPCOMING DEADLINES
              </h3>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, padding: '1rem 0' }}>
                No upcoming deadlines. Good job!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {upcomingDeadlines.map(task => (
                  <div key={task.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', border: '1px solid #fee2e2', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#fef2f2' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                      <strong style={{ fontSize: '0.8rem', color: '#991b1b' }}>{task.title}</strong>
                      <span style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 700 }}>
                        Due: {task.deadline}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Shared Notes */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                RECENT SHARED NOTES
              </h3>
              <button
                onClick={() => onNavigate('notes')}
                className="cyber-btn"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto' }}
              >
                Notes
              </button>
            </div>

            {recentNotes.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, padding: '1rem 0' }}>
                No shared notes found.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentNotes.map(note => (
                  <div key={note.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#f0fdf4' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '0.8rem', color: '#166534' }}>{note.title}</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {note.course} | By: {note.authorName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Study Groups */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                RECENT STUDY GROUPS
              </h3>
              <button
                onClick={() => onNavigate('study_groups')}
                className="cyber-btn"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto' }}
              >
                Groups
              </button>
            </div>

            {recentGroups.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, padding: '1rem 0' }}>
                No active study groups. Join or form a study group!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentGroups.map(group => (
                  <div key={group.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#fcfcfc' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--accent-purple)' }}>{group.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{group.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Study Rooms */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                ACTIVE STUDY ROOMS
              </h3>
              <button
                onClick={() => onNavigate('study_rooms')}
                className="cyber-btn"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto' }}
              >
                Rooms
              </button>
            </div>

            {recentRooms.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, padding: '1rem 0' }}>
                No active study rooms. Create one and study together!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentRooms.map(room => (
                  <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{room.title}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Subject: {room.course} | Host: {room.hostEmail.split('@')[0]}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', background: 'var(--accent-primary-light)', color: 'var(--accent-primary)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                      {room.participantCount} active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
