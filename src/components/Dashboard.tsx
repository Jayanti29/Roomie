import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured, ref, onValue } from '../firebase';

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
}

interface StudyRoom {
  id: string;
  title: string;
  course: string;
  hostEmail: string;
  participantCount?: number;
}

interface CommunitySpace {
  id: string;
  name: string;
  description: string;
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
  profile: _profile,
  tasks,
  notes,
  courses,
  studyPoints: _studyPoints,
  milestonesCount: _milestonesCount,
  onNavigate
}) => {
  const [recentGroups, setRecentGroups] = useState<StudyGroup[]>([]);
  const [recentRooms, setRecentRooms] = useState<StudyRoom[]>([]);
  const [recentCommunities, setRecentCommunities] = useState<CommunitySpace[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    // Load groups
    const groupsRef = ref(db, 'community_groups');
    const unsubGroups = onValue(groupsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.values(val).map((g: any) => ({
          id: g.metadata?.id || g.id,
          name: g.metadata?.name || g.name,
          description: g.metadata?.description || g.description || ''
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

    // Load communities
    const commsRef = ref(db, 'custom_communities');
    const unsubComms = onValue(commsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.values(val).map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description || ''
        })).slice(0, 3);
        setRecentCommunities(list);
      } else {
        setRecentCommunities([]);
      }
    });

    return () => {
      unsubGroups();
      unsubRooms();
      unsubComms();
    };
  }, []);

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
      
      {/* 2-Column Grid of Layout Widgets */}
      <div className="dashboard-grid" style={{ marginTop: '0.5rem' }}>
        
        {/* Left Column: Progress & Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Learning Progress Widget */}
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                LEARNING PROGRESS
              </h3>
              <span style={{ fontSize: '0.85rem', fontWeight: 850, color: 'var(--accent-primary)' }}>
                {calculateOverallProgress()}% Done
              </span>
            </div>
            
            {courses.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '1rem 0' }}>
                No active courses added. Track your progress in Settings.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {courses.map(course => (
                  <div key={course.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{course.name}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{course.progress}%</span>
                    </div>
                    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <div style={{ height: '100%', width: `${course.progress}%`, background: 'var(--accent-primary)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Activity Widget */}
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1.25rem', margin: 0 }}>
              WEEKLY STUDY ACTIVITY
            </h3>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-end', justifyContent: 'space-between', height: '130px', padding: '0 0.5rem' }}>
              {weekDays.map(day => {
                const heightPercent = Math.round((day.hours / 8) * 100);
                return (
                  <div key={day.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>{day.hours}h</span>
                    <div style={{
                      width: '100%',
                      height: `${heightPercent}px`,
                      background: 'var(--accent-primary)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: '4px'
                    }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{day.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Communities Widget */}
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                RECENT COMMUNITIES
              </h3>
              <button
                onClick={() => onNavigate('community_chat')}
                className="cyber-btn"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto' }}
              >
                Open
              </button>
            </div>
            
            {recentCommunities.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '1rem 0' }}>
                Join community spaces to connect.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentCommunities.map(c => (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#fcfcfc' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{c.name}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Tasks, Deadlines, Notes, Rooms, Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Recent Tasks */}
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
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
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '1rem 0' }}>
                No active tasks. Create tasks in your Planner.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentTasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{task.title}</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 650 }}>
                        Priority: {task.priority} | Status: {task.status}
                      </span>
                    </div>
                    {task.deadline && (
                      <span style={{ fontSize: '0.65rem', background: '#334155', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                        {task.deadline}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Deadlines */}
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', margin: 0 }}>
              UPCOMING DEADLINES
            </h3>

            {upcomingDeadlines.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '1rem 0' }}>
                No upcoming deadlines. All caught up!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {upcomingDeadlines.map(task => (
                  <div key={task.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', border: '1px solid #fee2e2', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#fef2f2' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, textAlign: 'left' }}>
                      <strong style={{ fontSize: '0.8rem', color: '#991b1b' }}>{task.title}</strong>
                      <span style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 750 }}>
                        Due: {task.deadline}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Notes */}
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                RECENT NOTES
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
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '1rem 0' }}>
                No shared notes found.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentNotes.map(note => (
                  <div key={note.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#f0fdf4' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
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
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                RECENT GROUPS
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
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '1rem 0' }}>
                No active study groups.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentGroups.map(group => (
                  <div key={group.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#fcfcfc' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--accent-purple)' }}>{group.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{group.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Study Rooms */}
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                RECENT STUDY ROOMS
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
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '1rem 0' }}>
                No active study rooms.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentRooms.map(room => (
                  <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
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
