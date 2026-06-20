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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem', textAlign: 'left' }}>
      
      {/* 1. Welcome Title and Metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '0.25rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Welcome back, {profile.name}!
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 700, margin: '0.25rem 0 0 0' }}>
            {profile.degree} in {profile.specialization} • {profile.semester} • {profile.college}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ background: '#ffffff', border: '1.5px solid #0f172a', padding: '0.5rem 1rem', borderRadius: '16px', textAlign: 'center', minWidth: '95px', boxShadow: '0 4px 0 #0f172a' }}>
            <strong style={{ fontSize: '1.25rem', display: 'block', color: 'var(--accent-primary)', fontWeight: 900 }}>{studyPoints}</strong>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>STUDY POINTS</span>
          </div>
          <div style={{ background: '#ffffff', border: '1.5px solid #0f172a', padding: '0.5rem 1rem', borderRadius: '16px', textAlign: 'center', minWidth: '95px', boxShadow: '0 4px 0 #0f172a' }}>
            <strong style={{ fontSize: '1.25rem', display: 'block', color: 'var(--accent-cyan)', fontWeight: 900 }}>{milestonesCount}</strong>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>MILESTONES</span>
          </div>
        </div>
      </div>

      {/* 2. Compact Leaderboard Widget */}
      <Leaderboard
        isCompact={true}
        currentUserEmail={profile.email}
        currentCollege={profile.college}
        currentDegree={profile.degree}
        currentStudyPoints={studyPoints}
      />

      {/* 2. Grid Sections */}
      <div className="dashboard-grid">
        
        {/* Left Side Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
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

          {/* Weekly Academic Activity (Static/Calculated SVG graph) */}
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

        {/* Right Side Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
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
