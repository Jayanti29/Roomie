import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured, ref, get } from '../firebase';

interface LeaderboardUser {
  name: string;
  email: string;
  college: string;
  degree: string;
  studyPoints: number;
  tasksCompleted: number;
  learningProgress: number;
  studyHours: number;
  isCurrentUser?: boolean;
}

interface LeaderboardProps {
  currentUserEmail: string;
  currentCollege: string;
  currentDegree: string;
  currentStudyPoints: number;
  isCompact?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  currentUserEmail,
  currentCollege,
  currentDegree,
  currentStudyPoints,
  isCompact = false
}) => {
  const [activeTab, setActiveTab] = useState<'global' | 'college' | 'degree' | 'friends'>('global');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(false);

  // Load Leaderboard data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const list: LeaderboardUser[] = [];

      if (isFirebaseConfigured && db) {
        try {
          const snap = await get(ref(db, 'users'));
          if (snap.exists()) {
            const val = snap.val();
            Object.values(val).forEach((u: any) => {
              // Calculate completion percentage or tasks completed
              let tasksDone = 0;
              if (u.tasks) {
                tasksDone = Object.values(u.tasks).filter((t: any) => t.status === 'Completed').length;
              }
              let progressVal = 0;
              if (u.courses && u.courses.length > 0) {
                const total = u.courses.reduce((sum: number, c: any) => sum + (c.progress || 0), 0);
                progressVal = Math.round(total / u.courses.length);
              }

              list.push({
                name: u.name || u.profile?.name || 'Anonymous Student',
                email: u.email || '',
                college: u.college || u.profile?.college || 'Other',
                degree: u.degree || u.profile?.degree || 'General',
                studyPoints: u.studyPoints ?? u.xp ?? 0,
                tasksCompleted: tasksDone,
                learningProgress: progressVal,
                studyHours: Math.round((u.studyPoints ?? u.xp ?? 0) / 25) || 2 // approximate hours based on points
              });
            });
          }
        } catch (e) {
          console.error("Failed to load leaderboard users:", e);
        }
      }

      // Default mock fallback if no database users or offline/local
      if (list.length === 0) {
        const mockNames = ['Rahul Sharma', 'Ananya Iyer', 'Aditya Verma', 'Sneha Patel', 'Vikram Rao', 'Pooja Hegde', 'Rohan Gupta', 'Meera Nair'];
        const mockDegrees = ['BCA', 'BTech', 'MCA', 'BCom', 'BSc', 'MBA'];
        const mockColleges = ['Christ University', 'IIT Bombay', 'NIT Trichy', 'Delhi University', 'VIT Vellore'];
        
        mockNames.forEach((name, idx) => {
          list.push({
            name,
            email: `student_${idx}@roomie.io`,
            college: mockColleges[idx % mockColleges.length],
            degree: mockDegrees[idx % mockDegrees.length],
            studyPoints: 1200 - idx * 150,
            tasksCompleted: 15 - idx,
            learningProgress: 85 - idx * 5,
            studyHours: 48 - idx * 4
          });
        });
      }

      // Ensure current user is included if not found
      if (!list.some(u => u.email === currentUserEmail)) {
        list.push({
          name: 'You',
          email: currentUserEmail,
          college: currentCollege || 'State University',
          degree: currentDegree || 'Bachelor of Science',
          studyPoints: currentStudyPoints,
          tasksCompleted: 4,
          learningProgress: 50,
          studyHours: Math.round(currentStudyPoints / 25) || 5,
          isCurrentUser: true
        });
      }

      setLeaderboardData(list);
      setLoading(false);
    };

    fetchData();
  }, [currentUserEmail, currentCollege, currentDegree, currentStudyPoints]);

  // Filter based on active tab
  const getFilteredData = () => {
    let filtered = [...leaderboardData];
    if (activeTab === 'college') {
      filtered = filtered.filter(u => u.college.toLowerCase().includes(currentCollege.toLowerCase()) || u.isCurrentUser);
    } else if (activeTab === 'degree') {
      filtered = filtered.filter(u => u.degree.toLowerCase().includes(currentDegree.toLowerCase()) || u.isCurrentUser);
    } else if (activeTab === 'friends') {
      // simulate friends: subset of people or same college/degree
      filtered = filtered.slice(0, 4);
    }
    // Sort descending by study points
    return filtered.sort((a, b) => b.studyPoints - a.studyPoints);
  };

  const filteredUsers = getFilteredData();

  if (isCompact) {
    return (
      <div className="glass-panel anim-pop" style={{
        background: '#ffffff',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
        borderRadius: '24px',
        border: '1.5px solid #0f172a',
        boxShadow: '0 6px 0 rgba(15, 23, 42, 0.05)',
        width: '100%'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Academic Rankings
          </h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Top Students</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '0.25rem' }}>
          {(['global', 'college', 'degree', 'friends'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.35rem 0.65rem',
                background: activeTab === tab ? 'var(--accent-primary-light)' : 'none',
                border: 'none',
                borderRadius: '12px',
                color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: activeTab === tab ? 800 : 600,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading ranks...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {filteredUsers.slice(0, 4).map((u, index) => {
              const isSelf = u.email === currentUserEmail || u.isCurrentUser;
              return (
                <div
                  key={u.email}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '12px',
                    background: isSelf ? '#f5f3ff' : '#f8fafc',
                    border: isSelf ? '1.5px solid var(--accent-primary)' : '1.5px solid #cbd5e1',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontWeight: 900,
                      color: index === 0 ? 'var(--accent-gold)' : index === 1 ? '#64748b' : index === 2 ? '#b45309' : 'var(--text-muted)',
                      width: '20px'
                    }}>
                      #{index + 1}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>
                        {u.name} {isSelf && <span style={{ fontSize: '0.65rem', background: 'var(--accent-primary-light)', color: 'var(--accent-primary)', padding: '0.05rem 0.3rem', borderRadius: '4px', marginLeft: '0.2rem' }}>You</span>}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {u.college.split(',')[0]} • {u.degree}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>{u.studyPoints}</strong>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block' }}>pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass-panel anim-pop" style={{
      background: '#ffffff',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      height: '100%',
      minHeight: '500px',
      borderRadius: '24px',
      border: '1.5px solid #0f172a',
      boxShadow: '0 8px 0 rgba(15, 23, 42, 0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.75rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Academic Leaderboard</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>Celebrate learning achievements across the student community.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.25rem' }}>
        {(['global', 'college', 'degree', 'friends'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem 1rem',
              background: activeTab === tab ? 'var(--accent-primary-light)' : 'none',
              border: 'none',
              borderRadius: '12px',
              color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab ? 800 : 600,
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading leaderboard ranks...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #0f172a', color: 'var(--text-muted)', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Rank</th>
                <th style={{ padding: '0.75rem 1rem' }}>Student</th>
                <th style={{ padding: '0.75rem 1rem' }}>Institution</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Study Points</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tasks Completed</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Learning Progress</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Study Hours</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, index) => {
                const isSelf = u.email === currentUserEmail || u.isCurrentUser;
                return (
                  <tr
                    key={u.email}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelf ? '#f5f3ff' : 'transparent',
                      fontWeight: isSelf ? 700 : 400
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem', color: index === 0 ? 'var(--accent-gold)' : index === 1 ? '#64748b' : index === 2 ? '#b45309' : 'var(--text-muted)', fontWeight: 900 }}>
                      #{index + 1}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>
                      {u.name} {isSelf && <span style={{ fontSize: '0.75rem', background: 'var(--accent-primary-light)', color: 'var(--accent-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.4rem' }}>You</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                      {u.college} • {u.degree}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      {u.studyPoints}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {u.tasksCompleted}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <span style={{ minWidth: '35px', textAlign: 'right' }}>{u.learningProgress}%</span>
                        <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${u.learningProgress}%`, height: '100%', background: 'var(--accent-cyan)' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {u.studyHours}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
