import React, { useState, useEffect } from 'react';
import { Trophy, CheckCircle, Plus, Trash2, Award, ShieldAlert, Zap } from 'lucide-react';
import { db, isFirebaseConfigured, ref, push, onValue, set, remove } from '../firebase';

interface GoalItem {
  id: string;
  title: string;
  category: string;
  progress: number; // 0 to 100
  targetDate: string;
  xpReward: number;
  assignedTo: string;
  completed: boolean;
}

interface GoalsProps {
  userEmail: string;
  userName: string;
  onRewardXp?: (amount: number, reason: string) => void;
}

const CATEGORIES = ['Study', 'Flat Upgrade', 'Social', 'Fitness', 'Other'];

export const Goals: React.FC<GoalsProps> = ({ userEmail: _userEmail, userName: _userName, onRewardXp }) => {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Study');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newAssignee, setNewAssignee] = useState('All');
  const [newXpReward, setNewXpReward] = useState(50);

  // Load goals
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      // Load fallback local mock state
      setGoals([
        {
          id: 'goal_1',
          title: 'Accumulate 20 hours of focused study this week.',
          category: 'Study',
          progress: 65,
          targetDate: '2026-07-05',
          xpReward: 100,
          assignedTo: 'All',
          completed: false
        },
        {
          id: 'goal_2',
          title: 'Fix the balcony table and add potted plants.',
          category: 'Flat Upgrade',
          progress: 100,
          targetDate: '2026-06-30',
          xpReward: 80,
          assignedTo: 'Cleo',
          completed: true
        }
      ]);
      return;
    }

    const goalsRef = ref(db, 'roommate_goals');
    const unsub = onValue(goalsRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        setGoals(list);
      } else {
        setGoals([]);
      }
    });

    return () => unsub();
  }, []);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newGoal: Omit<GoalItem, 'id' | 'completed'> = {
      title: newTitle,
      category: newCategory,
      progress: 0,
      targetDate: newTargetDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
      xpReward: newXpReward,
      assignedTo: newAssignee
    };

    if (isFirebaseConfigured && db) {
      const goalsRef = ref(db, 'roommate_goals');
      await push(goalsRef, {
        ...newGoal,
        completed: false
      });
    } else {
      setGoals(prev => [
        ...prev,
        {
          id: 'goal_' + Date.now(),
          ...newGoal,
          completed: false
        }
      ]);
    }

    setNewTitle('');
    setNewXpReward(50);
  };

  const handleUpdateProgress = async (id: string, progressValue: number) => {
    const isCompletedNow = progressValue >= 100;
    const prevGoal = goals.find(g => g.id === id);

    if (isFirebaseConfigured && db) {
      await set(ref(db, `roommate_goals/${id}/progress`), progressValue);
      await set(ref(db, `roommate_goals/${id}/completed`), isCompletedNow);
    } else {
      setGoals(prev => prev.map(g => g.id === id ? { ...g, progress: progressValue, completed: isCompletedNow } : g));
    }

    // Trigger XP reward if goal wasn't already completed and is completed now
    if (isCompletedNow && prevGoal && !prevGoal.completed && onRewardXp) {
      onRewardXp(prevGoal.xpReward, `Completed Shared Goal: ${prevGoal.title}`);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (isFirebaseConfigured && db) {
      await remove(ref(db, `roommate_goals/${id}`));
    } else {
      setGoals(prev => prev.filter(g => g.id !== id));
    }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
      
      {/* Banner */}
      <div className="card-flat" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #e0f2fe 100%)', border: '3px solid #0f172a', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={24} style={{ color: 'var(--accent-primary)' }} /> Flatmate Goals & Milestones
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '750px', fontWeight: 600 }}>
          Set collaborative goals for study focus, apartment renovations, flat budget milestones, or workouts. Track progress in real time and unlock student XP rewards upon completion!
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left: Create Goal Form */}
        <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={18} /> Propose Flat Goal
          </h3>
          <form onSubmit={handleAddGoal} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Goal / Target</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Paint the living room accent wall..."
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '2px solid #0f172a',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: '#fff'
                  }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Target Date</label>
                <input
                  type="date"
                  value={newTargetDate}
                  onChange={e => setNewTargetDate(e.target.value)}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Assignee</label>
                <input
                  type="text"
                  value={newAssignee}
                  onChange={e => setNewAssignee(e.target.value)}
                  placeholder="e.g. Cleo or All"
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
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>XP Reward</label>
                <input
                  type="number"
                  min={10}
                  max={250}
                  value={newXpReward}
                  onChange={e => setNewXpReward(Number(e.target.value))}
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
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '0.6rem', marginTop: '0.2rem', fontWeight: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <Zap size={16} /> Add Shared Goal
            </button>
          </form>
        </div>

        {/* Right: Goals List */}
        <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle size={18} /> Flat Goal Checklist
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
            {goals.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '3rem 1rem', border: '2px dashed var(--outline-thin)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                <ShieldAlert size={28} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>No collaborative goals proposed yet.</span>
              </div>
            ) : (
              goals.map((goal) => (
                <div
                  key={goal.id}
                  style={{
                    border: '2px solid #0f172a',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    background: goal.completed ? '#f0fdf4' : '#fff',
                    boxShadow: '2px 2px 0px #0f172a',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 900,
                        background: 'var(--accent-pink-light)',
                        border: '1px solid #0f172a',
                        padding: '2px 5px',
                        borderRadius: '3px',
                        marginRight: '0.4rem'
                      }}>
                        {goal.category}
                      </span>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        color: '#0f172a',
                        textDecoration: goal.completed ? 'line-through' : 'none'
                      }}>
                        {goal.title}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
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

                  {/* Progress slider / bar */}
                  <div style={{ marginTop: '0.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px', fontSize: '0.7rem', fontWeight: 800 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Goal Progress</span>
                      <span style={{ color: '#0f172a' }}>{goal.progress}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={goal.progress}
                        disabled={goal.completed}
                        onChange={(e) => handleUpdateProgress(goal.id, Number(e.target.value))}
                        style={{
                          flex: 1,
                          cursor: goal.completed ? 'not-allowed' : 'pointer'
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer metadata */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', borderTop: '2px solid #f1f5f9', paddingTop: '0.4rem' }}>
                    <span>
                      Assigned: <strong style={{ color: '#0f172a' }}>{goal.assignedTo}</strong>
                    </span>
                    <span>
                      Target: <strong style={{ color: '#0f172a' }}>{goal.targetDate}</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--accent-primary)', fontWeight: 900 }}>
                      <Award size={12} /> +{goal.xpReward} XP
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
