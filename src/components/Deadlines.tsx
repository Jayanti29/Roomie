import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, Plus, Trash2, Users, CheckCircle, ShieldAlert } from 'lucide-react';
import { db, isFirebaseConfigured, ref, push, onValue, set, remove } from '../firebase';

interface DeadlineItem {
  id: string;
  title: string;
  courseCode: string;
  dueDate: string;
  dueTime: string;
  subscribers: string[]; // List of student emails studying for this together
}

interface DeadlinesProps {
  userEmail: string;
  userName: string;
  onRewardXp?: (amount: number, reason: string) => void;
}

export const Deadlines: React.FC<DeadlinesProps> = ({ userEmail, userName, onRewardXp }) => {
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('23:59');

  // Load deadlines
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      // Fallback mock deadlines
      setDeadlines([
        {
          id: 'dl_1',
          title: 'Database Systems Lab 3',
          courseCode: 'CS304',
          dueDate: new Date(Date.now() + 36 * 3600 * 1000).toISOString().split('T')[0], // ~1.5 days away
          dueTime: '17:00',
          subscribers: ['cleo@roomie.com']
        },
        {
          id: 'dl_2',
          title: 'Algorithms Midterm Exam',
          courseCode: 'CS301',
          dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0], // 5 days away
          dueTime: '09:00',
          subscribers: ['sam@roomie.com', 'cleo@roomie.com']
        },
        {
          id: 'dl_3',
          title: 'Technical Writing Proposal',
          courseCode: 'ENG210',
          dueDate: new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString().split('T')[0], // 12 days away
          dueTime: '23:59',
          subscribers: []
        }
      ]);
      return;
    }

    const deadlinesRef = ref(db, 'roommate_deadlines');
    const unsub = onValue(deadlinesRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key],
          subscribers: val[key].subscribers || []
        }));
        // Sort by proximity (earliest first)
        list.sort((a, b) => {
          const aDateTime = new Date(`${a.dueDate}T${a.dueTime}`).getTime();
          const bDateTime = new Date(`${b.dueDate}T${b.dueTime}`).getTime();
          return aDateTime - bDateTime;
        });
        setDeadlines(list);
      } else {
        setDeadlines([]);
      }
    });

    return () => unsub();
  }, []);

  const handleAddDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCourseCode.trim() || !newDueDate) return;

    const newDl: Omit<DeadlineItem, 'id'> = {
      title: newTitle,
      courseCode: newCourseCode.toUpperCase(),
      dueDate: newDueDate,
      dueTime: newDueTime || '23:59',
      subscribers: [userEmail] // Creator automatically signs up
    };

    if (isFirebaseConfigured && db) {
      const deadlinesRef = ref(db, 'roommate_deadlines');
      await push(deadlinesRef, newDl);
    } else {
      setDeadlines(prev => {
        const updated = [...prev, { id: 'dl_' + Date.now(), ...newDl }];
        return updated.sort((a, b) => {
          const aDateTime = new Date(`${a.dueDate}T${a.dueTime}`).getTime();
          const bDateTime = new Date(`${b.dueDate}T${b.dueTime}`).getTime();
          return aDateTime - bDateTime;
        });
      });
    }

    setNewTitle('');
    setNewCourseCode('');
    setNewDueDate('');
    setNewDueTime('23:59');

    if (onRewardXp) {
      onRewardXp(20, 'Logged Academic Deadline');
    }
  };

  const handleToggleSubscribe = async (id: string) => {
    const dl = deadlines.find(d => d.id === id);
    if (!dl) return;

    let updatedSubs = [...dl.subscribers];
    if (updatedSubs.includes(userEmail)) {
      updatedSubs = updatedSubs.filter(email => email !== userEmail);
    } else {
      updatedSubs.push(userEmail);
      if (onRewardXp) {
        onRewardXp(10, 'RSVP to study review session');
      }
    }

    if (isFirebaseConfigured && db) {
      await set(ref(db, `roommate_deadlines/${id}/subscribers`), updatedSubs);
    } else {
      setDeadlines(prev => prev.map(d => d.id === id ? { ...d, subscribers: updatedSubs } : d));
    }
  };

  const handleDeleteDeadline = async (id: string) => {
    if (isFirebaseConfigured && db) {
      await remove(ref(db, `roommate_deadlines/${id}`));
    } else {
      setDeadlines(prev => prev.filter(d => d.id !== id));
    }
  };

  // Get severity style (days remaining color-coding)
  const getProximityStatus = (dueDate: string, dueTime: string) => {
    const diffMs = new Date(`${dueDate}T${dueTime}`).getTime() - Date.now();
    const diffHours = diffMs / (3600 * 1000);

    if (diffHours < 0) {
      return { label: 'Passed', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' };
    }
    if (diffHours <= 48) {
      return { label: 'CRITICAL (Under 48h)', color: '#b91c1c', bg: '#fee2e2', border: '#ef4444' };
    }
    if (diffHours <= 168) {
      return { label: 'SOON (This Week)', color: '#b45309', bg: '#fef3c7', border: '#f59e0b' };
    }
    return { label: 'UPCOMING', color: '#15803d', bg: '#dcfce7', border: '#10b981' };
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
      
      {/* Calendar header */}
      <div className="card-flat" style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #ffedd5 100%)', border: '3px solid #0f172a', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={24} style={{ color: 'var(--accent-pink)' }} /> Shared Academic Deadlines
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '750px', fontWeight: 600 }}>
          Coordinate study timelines with flatmates. Log assignments, homework, and exams. Sign up for study groups to split revision tasks and prepare together.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left: Log Deadline form */}
        <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={18} /> Propose Deadline
          </h3>
          <form onSubmit={handleAddDeadline} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Assessment / Exam Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Calculus midterm revision..."
                required
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '2px solid #0f172a',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Course Code</label>
                <input
                  type="text"
                  value={newCourseCode}
                  onChange={e => setNewCourseCode(e.target.value)}
                  placeholder="e.g. CS302"
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '2px solid #0f172a',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                />
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Due Date</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    border: '2px solid #0f172a',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: '#fff'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Due Time (Optional)</label>
              <input
                type="time"
                value={newDueTime}
                onChange={e => setNewDueTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '2px solid #0f172a',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: '#fff'
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '0.6rem', marginTop: '0.2rem', fontWeight: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <Calendar size={16} /> Save Deadline
            </button>
          </form>
        </div>

        {/* Right: Sorted list of deadlines */}
        <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={18} /> Timeline Checklist
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
            {deadlines.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '3rem 1rem', border: '2px dashed var(--outline-thin)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                <ShieldAlert size={28} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>No shared deadlines tracked.</span>
              </div>
            ) : (
              deadlines.map((dl) => {
                const status = getProximityStatus(dl.dueDate, dl.dueTime);
                const hasJoined = dl.subscribers.includes(userEmail);
                return (
                  <div
                    key={dl.id}
                    style={{
                      border: '2px solid #0f172a',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      background: '#fff',
                      boxShadow: '2px 2px 0px #0f172a',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    
                    {/* Severity colored banner */}
                    <div style={{
                      background: status.bg,
                      color: status.color,
                      border: `1.5px solid ${status.border}`,
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      alignSelf: 'flex-start',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      <Clock size={10} /> {status.label}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          background: 'var(--accent-primary-light)',
                          border: '1px solid #0f172a',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          marginRight: '0.4rem'
                        }}>
                          {dl.courseCode}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                          {dl.title}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteDeadline(dl.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Deadline date/time details */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      <span>Due: <strong>{dl.dueDate}</strong></span>
                      <span>Time: <strong>{dl.dueTime}</strong></span>
                    </div>

                    {/* Study RSVPs */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '2px solid #f1f5f9',
                      paddingTop: '0.5rem',
                      marginTop: '2px'
                    }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Users size={12} /> {dl.subscribers.length} studying together
                      </span>

                      <button
                        onClick={() => handleToggleSubscribe(dl.id)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          border: '1px solid #0f172a',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          background: hasJoined ? '#fee2e2' : 'var(--accent-secondary-light)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        <CheckCircle size={10} />
                        {hasJoined ? 'Leave Study' : 'Join Study'}
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
