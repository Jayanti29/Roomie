import React, { useState } from 'react';
import { 
  Award, Activity, BookOpen, 
  Map, Calendar, Timer, Trash2, Edit2, Plus, 
  CheckCircle2, BookMarked
} from 'lucide-react';

interface Course {
  id: string;
  name: string;
  progress: number;
  deadline?: string;
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

interface Roadmap {
  id: string;
  name: string;
  goal: string;
  targetDate: string;
  progress: number;
  type: 'ai' | 'manual';
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
  level: number;
  xp: number;
  maxXp: number;
  studyPoints: number;
  milestonesCount: number;
  tasks: Task[];
  notes: Note[];
  courses: Course[];
  roadmaps: Roadmap[];
  focusSessions: FocusSession[];
  onUpdateCourses: (updatedCourses: Course[]) => void;
  onNavigate: (tab: string) => void;
  profile?: {
    degree: string;
    specialization: string;
    semester: string;
    college: string;
    university: string;
  };
}

export const Dashboard: React.FC<DashboardProps> = ({
  level,
  xp,
  maxXp,
  studyPoints,
  milestonesCount,
  tasks,
  notes,
  courses,
  roadmaps,
  focusSessions,
  onUpdateCourses,
  onNavigate,
  profile
}) => {
  // Course form state
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseProgress, setNewCourseProgress] = useState(0);
  const [newCourseDeadline, setNewCourseDeadline] = useState('');

  // Course editing state
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseProgress, setEditCourseProgress] = useState(0);
  const [editCourseDeadline, setEditCourseDeadline] = useState('');

  // Course Management Handlers
  const handleAddCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;

    const newCourse: Course = {
      id: `course_${Date.now()}`,
      name: newCourseName.trim(),
      progress: Math.min(100, Math.max(0, newCourseProgress)),
      deadline: newCourseDeadline || undefined
    };

    onUpdateCourses([...courses, newCourse]);
    setNewCourseName('');
    setNewCourseProgress(0);
    setNewCourseDeadline('');
    setShowAddCourse(false);
  };

  const handleEditCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourseId || !editCourseName.trim()) return;

    const updated = courses.map(c => 
      c.id === editingCourseId 
        ? { ...c, name: editCourseName.trim(), progress: editCourseProgress, deadline: editCourseDeadline || undefined }
        : c
    );
    onUpdateCourses(updated);
    setEditingCourseId(null);
  };

  const handleStartEditCourse = (course: Course) => {
    setEditingCourseId(course.id);
    setEditCourseName(course.name);
    setEditCourseProgress(course.progress);
    setEditCourseDeadline(course.deadline || '');
  };

  const handleDeleteCourse = (courseId: string) => {
    if (!confirm("Are you sure you want to delete this course from curriculum?")) return;
    const updated = courses.filter(c => c.id !== courseId);
    onUpdateCourses(updated);
  };

  // Calculations
  const completedSessions = focusSessions.filter(s => s.completed);
  const totalCompletedSessionsCount = completedSessions.length;

  const todaySessions = focusSessions.filter(s => {
    if (!s.completed || !s.completedAt) return false;
    try {
      return new Date(s.completedAt).toDateString() === new Date().toDateString();
    } catch (e) {
      return false;
    }
  });
  const todayFocusMinutes = todaySessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const todayFocusHours = (todayFocusMinutes / 60).toFixed(1);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weeklySessions = focusSessions.filter(s => {
    if (!s.completed || !s.completedAt) return false;
    try {
      const completedTime = new Date(s.completedAt).getTime();
      return completedTime >= sevenDaysAgo.getTime();
    } catch (e) {
      return false;
    }
  });
  const weeklyFocusMinutes = weeklySessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const weeklyFocusHours = (weeklyFocusMinutes / 60).toFixed(1);

  const calculateOverallProgress = () => {
    const totalItems = courses.length + roadmaps.length;
    if (totalItems === 0) return 0;
    const coursesSum = courses.reduce((sum, c) => sum + c.progress, 0);
    const roadmapsSum = roadmaps.reduce((sum, r) => sum + r.progress, 0);
    return Math.round((coursesSum + roadmapsSum) / totalItems);
  };

  const upcomingDeadlines = tasks
    .filter(t => t.status !== 'Completed' && t.deadline)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  const getRecentActivity = () => {
    const activityList: { id: string; type: 'focus' | 'note' | 'task'; text: string; time: Date }[] = [];

    focusSessions.forEach((s, idx) => {
      activityList.push({
        id: `focus-${idx}-${s.completedAt}`,
        type: 'focus',
        text: `Focused for ${s.duration} mins on "${s.taskName}" (${s.completed ? 'Completed' : 'Stopped early'})`,
        time: new Date(s.completedAt)
      });
    });

    notes.slice(0, 5).forEach((n, idx) => {
      activityList.push({
        id: `note-${n.id || idx}`,
        type: 'note',
        text: `Shared study notes: "${n.title}" for course "${n.course}"`,
        time: n.createdAt ? new Date(n.createdAt) : new Date(Date.now() - (idx * 3600 * 1000 * 2))
      });
    });

    tasks.filter(t => t.status === 'Completed').forEach(t => {
      activityList.push({
        id: `task-${t.id}`,
        type: 'task',
        text: `Finished task: "${t.title}"`,
        time: new Date(Date.now() - 3600 * 1000) // fallback
      });
    });

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
          ACADEMIC DASHBOARD
          <div style={{ position: 'absolute', top: '-8px', left: '15px', width: '25px', height: '10px', background: 'rgba(0,0,0,0.1)', transform: 'rotate(-30deg)' }} />
          <div style={{ position: 'absolute', top: '-8px', right: '15px', width: '25px', height: '10px', background: 'rgba(0,0,0,0.1)', transform: 'rotate(30deg)' }} />
        </div>
      </div>

      {/* Grid of the 7 Cartoon Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginTop: '0.5rem'
      }}>

        {/* 1. ACADEMIC REPORT */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#fed7aa', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(-2deg)', display: 'flex', alignItems: 'center', gap: '3px'
          }}>
            <Award size={12} /> ACADEMIC REPORT
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>Level:</span>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--accent-purple)' }}>Lvl {level}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                <span>XP Progress</span>
                <span>{xp} / {maxXp}</span>
              </div>
              <div style={{ height: '8px', background: '#f1f5f9', border: '1.5px solid #0f172a', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (xp / maxXp) * 100)}%`, background: 'var(--accent-purple)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>Study Points:</span>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>{studyPoints} PTS</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>Milestones Unlock:</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{milestonesCount} Badges</span>
            </div>

            {profile && (
              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                <div style={{ color: 'var(--accent-purple)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.65rem', marginBottom: '2px' }}>Education Summary</div>
                <div>{profile.degree} in {profile.specialization} ({profile.semester || 'N/A'})</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{profile.college}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{profile.university}</div>
              </div>
            )}
          </div>
        </div>

        {/* 2. CURRENT LEARNING PROGRESS */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#e9d5ff', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(2deg)', display: 'flex', alignItems: 'center', gap: '3px'
          }}>
            <Activity size={12} /> LEARNING PROGRESS
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 950, color: 'var(--accent-primary)', textShadow: '1px 1px 0px #0f172a', margin: '0.5rem 0 0.25rem 0' }}>
              {calculateOverallProgress()}%
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, textAlign: 'center' }}>
              Average Curriculum Completion (Courses & Roadmaps)
            </span>
            <div style={{ height: '10px', width: '100%', background: '#f1f5f9', border: '2px solid #0f172a', borderRadius: '6px', overflow: 'hidden', marginTop: '0.5rem' }}>
              <div style={{ height: '100%', width: `${calculateOverallProgress()}%`, background: 'var(--accent-primary)' }} />
            </div>
          </div>
        </div>

        {/* 3. ACTIVE COURSES (With inline CRUD) */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#ccfbf1', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(-1.5deg)', display: 'flex', alignItems: 'center', gap: '3px'
          }}>
            <BookOpen size={12} /> ACTIVE COURSES ({courses.length})
          </div>

          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '180px', overflowY: 'auto' }}>
            {editingCourseId ? (
              <form onSubmit={handleEditCourseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1.5px solid #0f172a', padding: '0.5rem', borderRadius: '8px', background: '#f8fafc' }}>
                <input type="text" className="cyber-input" value={editCourseName} onChange={e => setEditCourseName(e.target.value)} required style={{ fontSize: '0.75rem', padding: '0.2rem' }} />
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input type="range" min="0" max="100" value={editCourseProgress} onChange={e => setEditCourseProgress(parseInt(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{editCourseProgress}%</span>
                </div>
                <input type="date" className="cyber-input" value={editCourseDeadline} onChange={e => setEditCourseDeadline(e.target.value)} style={{ fontSize: '0.7rem', padding: '0.2rem' }} />
                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setEditingCourseId(null)} className="cyber-btn" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>Cancel</button>
                  <button type="submit" className="cyber-btn pink-fill" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>Save</button>
                </div>
              </form>
            ) : showAddCourse ? (
              <form onSubmit={handleAddCourseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1.5px dashed #0f172a', padding: '0.5rem', borderRadius: '8px', background: '#f8fafc' }}>
                <input type="text" className="cyber-input" placeholder="Course Name (e.g. DBMS)" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} required style={{ fontSize: '0.75rem', padding: '0.2rem' }} />
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input type="range" min="0" max="100" value={newCourseProgress} onChange={e => setNewCourseProgress(parseInt(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{newCourseProgress}%</span>
                </div>
                <input type="date" className="cyber-input" value={newCourseDeadline} onChange={e => setNewCourseDeadline(e.target.value)} style={{ fontSize: '0.7rem', padding: '0.2rem' }} />
                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowAddCourse(false)} className="cyber-btn" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>Cancel</button>
                  <button type="submit" className="cyber-btn pink-fill" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>Add</button>
                </div>
              </form>
            ) : (
              <>
                {courses.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No active courses added yet.</p>
                ) : (
                  courses.map(course => (
                    <div key={course.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid #cbd5e1', padding: '0.4rem 0.6rem', borderRadius: '10px', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{course.name}</span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => handleStartEditCourse(course)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Edit2 size={12} /></button>
                          <button onClick={() => handleDeleteCourse(course.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-pink)' }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {course.deadline ? <span>Due: {course.deadline}</span> : <span />}
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{course.progress}%</span>
                      </div>
                      <div style={{ height: '6px', background: '#f1f5f9', border: '1px solid #0f172a', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${course.progress}%`, background: 'var(--accent-green)' }} />
                      </div>
                    </div>
                  ))
                )}
                {!showAddCourse && (
                  <button onClick={() => setShowAddCourse(true)} className="cyber-btn" style={{ fontSize: '0.7rem', padding: '0.25rem', width: '100%', marginTop: '0.25rem' }}>
                    <Plus size={12} /> Add New Course
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 4. CURRENT ROADMAPS */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#fed7aa', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(1deg)', display: 'flex', alignItems: 'center', gap: '3px'
          }}>
            <Map size={12} /> ACTIVE ROADMAPS
          </div>

          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '180px', overflowY: 'auto' }}>
            {roadmaps.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No active learning roadmaps.</p>
                <button onClick={() => onNavigate('learning_roadmaps')} className="cyber-btn" style={{ fontSize: '0.7rem', padding: '0.25rem' }}>
                  Generate Roadmap
                </button>
              </div>
            ) : (
              <>
                {roadmaps.slice(0, 3).map(r => (
                  <div key={r.id} onClick={() => onNavigate('learning_roadmaps')} style={{ border: '1.5px solid #0f172a', borderRadius: '10px', padding: '0.5rem', background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <strong style={{ fontSize: '0.78rem', color: '#0f172a' }}>{r.name}</strong>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      <span>Target: {r.targetDate}</span>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>{r.progress}%</span>
                    </div>
                    <div style={{ height: '6px', background: '#f1f5f9', border: '1px solid #0f172a', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${r.progress}%`, background: 'var(--accent-purple)' }} />
                    </div>
                  </div>
                ))}
                {roadmaps.length > 3 && (
                  <button onClick={() => onNavigate('learning_roadmaps')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-primary)', alignSelf: 'flex-end' }}>
                    View all active roadmaps &gt;
                  </button>
                )}
              </>
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
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#fca5a5', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(-2deg)', display: 'flex', alignItems: 'center', gap: '3px'
          }}>
            <Calendar size={12} /> UPCOMING DEADLINES
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '180px', overflowY: 'auto' }}>
            {upcomingDeadlines.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No pending deadlines. Nice work!</p>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'left' }}>
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
                    {task.deadline}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 6. FOCUS CLOCK SUMMARY */}
        <div className="glass-panel" style={{
          background: '#fffdf6',
          border: '2px solid #0f172a',
          boxShadow: '5px 5px 0px #0f172a',
          borderRadius: '20px',
          padding: '1.25rem',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#bbf7d0', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(1.5deg)', display: 'flex', alignItems: 'center', gap: '3px'
          }}>
            <Timer size={12} /> FOCUS HOURS
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 750, display: 'block', textTransform: 'uppercase' }}>
                  Today
                </span>
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 950, color: '#166534', margin: 0 }}>
                  {todayFocusHours} Hrs
                </h4>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 750, display: 'block', textTransform: 'uppercase' }}>
                  Weekly
                </span>
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 950, color: '#166534', margin: 0 }}>
                  {weeklyFocusHours} Hrs
                </h4>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 750, display: 'block', textTransform: 'uppercase' }}>
                  Completed
                </span>
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 950, color: '#166534', margin: 0 }}>
                  {totalCompletedSessionsCount} Sessions
                </h4>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                onClick={() => onNavigate('focus_clock')}
                className="cyber-btn purple-fill"
                style={{
                  border: '2px solid #0f172a',
                  boxShadow: '2px 2px 0px #0f172a',
                  fontSize: '0.75rem',
                  fontWeight: 900,
                  borderRadius: '8px',
                  padding: '0.35rem 0.65rem',
                  cursor: 'pointer'
                }}
              >
                Start Clock
              </button>
            </div>
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
          <div style={{
            position: 'absolute', top: '-12px', left: '15px',
            background: '#e0e7ff', border: '1.5px solid #0f172a',
            padding: '2px 10px', fontSize: '0.75rem', fontWeight: 900,
            transform: 'rotate(-1deg)', display: 'flex', alignItems: 'center', gap: '3px'
          }}>
            <Activity size={12} /> RECENT ACADEMIC ACTIVITY
          </div>
          
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '180px', overflowY: 'auto' }}>
            {recentActivity.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, padding: '0.5rem 0' }}>
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
                    {act.type === 'focus' ? <Timer size={14} /> : act.type === 'note' ? <BookMarked size={14} /> : <CheckCircle2 size={14} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'left' }}>
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
