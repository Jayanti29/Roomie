// src/components/Dashboard.tsx
import React from 'react';

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

interface DashboardProps {
  profile: {
    name: string;
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
  // Filters
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>
      
      {/* 1. Welcome Card Banner */}
      <div className="glass-panel" style={{
        background: 'var(--accent-purple)',
        color: '#000',
        padding: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        alignItems: 'center'
      }}>
        {profile.profilePhoto ? (
          <img
            src={profile.profilePhoto}
            alt="Avatar"
            style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3.5px solid #000', objectFit: 'cover', boxShadow: '2px 2px 0px #000' }}
          />
        ) : (
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', border: '3.5px solid #000',
            boxShadow: '2px 2px 0px #000', background: '#e2e8f0', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '2rem'
          }}>
            👤
          </div>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '250px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900 }}>
            Welcome back, {profile.name}!
          </h2>
          <p style={{ fontSize: '0.9rem', fontWeight: 700 }}>
            📚 {profile.degree} in <strong style={{ textDecoration: 'underline' }}>{profile.specialization}</strong> — {profile.semester}
          </p>
          <p style={{ fontSize: '0.8rem', color: '#2c2c2c', fontWeight: 700 }}>
            🏫 {profile.college} ({profile.university})
          </p>
          {profile.careerGoal && (
            <p style={{ fontSize: '0.8rem', background: '#fff', border: '1.5px solid #000', padding: '0.15rem 0.5rem', borderRadius: '6px', width: 'fit-content', marginTop: '0.4rem', fontWeight: 800 }}>
              🎯 Target Career: {profile.careerGoal}
            </p>
          )}
        </div>

        {/* Study points / milestones mini panels */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ background: '#fff', border: '2.5px solid #000', padding: '0.6rem 1rem', borderRadius: '12px', boxShadow: '2.5px 2.5px 0px #000', textAlign: 'center' }}>
            <span style={{ fontSize: '1.4rem', display: 'block' }}>⚡</span>
            <strong style={{ fontSize: '1rem', display: 'block' }}>{studyPoints}</strong>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>STUDY POINTS</span>
          </div>
          <div style={{ background: '#fff', border: '2.5px solid #000', padding: '0.6rem 1rem', borderRadius: '12px', boxShadow: '2.5px 2.5px 0px #000', textAlign: 'center' }}>
            <span style={{ fontSize: '1.4rem', display: 'block' }}>🏆</span>
            <strong style={{ fontSize: '1rem', display: 'block' }}>{milestonesCount}</strong>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>MILESTONES</span>
          </div>
        </div>
      </div>

      {/* 2. Grid Sections */}
      <div className="dashboard-grid">
        
        {/* Left Side Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Active Courses Progress */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900 }}>
                📖 ACTIVE COURSES ({courses.length})
              </h3>
              <button
                onClick={() => onNavigate('profile')}
                className="cyber-btn"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto', background: 'var(--accent-gold)' }}
              >
                EDIT
              </button>
            </div>
            
            {courses.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, padding: '1rem 0' }}>
                No active courses added. Add some courses in your Profile to track progress!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', border: '2px solid #000', padding: '0.5rem 0.8rem', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>Overall Academic Completion</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--accent-pink)' }}>{calculateOverallProgress()}%</span>
                </div>
                {courses.map(course => (
                  <div key={course.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                      <span style={{ color: '#000' }}>{course.name}</span>
                      <span>{course.progress}%</span>
                    </div>
                    <div style={{ height: '12px', background: '#eaeaea', border: '1.5px solid #000', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${course.progress}%`, background: 'var(--accent-cyan)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Tasks */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900 }}>
                📋 RECENT PLANNED TASKS
              </h3>
              <button
                onClick={() => onNavigate('planner')}
                className="cyber-btn"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto', background: 'var(--accent-cyan)' }}
              >
                PLANNER
              </button>
            </div>

            {recentTasks.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, padding: '1rem 0' }}>
                No active tasks. Create some in your Planner!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentTasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid #000', padding: '0.5rem 0.8rem', borderRadius: '10px', background: '#fffcf0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '0.8rem' }}>{task.title}</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        Priority: {task.priority} | Status: {task.status}
                      </span>
                    </div>
                    {task.deadline && (
                      <span style={{ fontSize: '0.65rem', background: '#000', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                        {task.deadline}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Upcoming Deadlines */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900 }}>
                ⏰ UPCOMING DEADLINES
              </h3>
              <span style={{ fontSize: '1.2rem' }}>📅</span>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, padding: '1rem 0' }}>
                No upcoming deadlines. Excellent job!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {upcomingDeadlines.map(task => (
                  <div key={task.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', border: '2px solid #000', padding: '0.5rem 0.8rem', borderRadius: '10px', background: '#ffeef2' }}>
                    <span style={{ fontSize: '1.2rem' }}>🚨</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                      <strong style={{ fontSize: '0.8rem' }}>{task.title}</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--accent-pink)', fontWeight: 800 }}>
                        Due Date: {task.deadline}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Notes */}
          <div className="glass-panel" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900 }}>
                📚 RECENT SHARED NOTES
              </h3>
              <button
                onClick={() => onNavigate('notes')}
                className="cyber-btn"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', minHeight: 'auto', background: 'var(--accent-purple)' }}
              >
                NOTES
              </button>
            </div>

            {recentNotes.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, padding: '1rem 0' }}>
                No shared notes found. Share your first note!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentNotes.map(note => (
                  <div key={note.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid #000', padding: '0.5rem 0.8rem', borderRadius: '10px', background: '#f4fbf7' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '0.8rem' }}>{note.title}</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        Subject: {note.course} | By: {note.authorName}
                      </span>
                    </div>
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
