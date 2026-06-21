// src/components/Planner.tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  status: string;
}

interface PlannerProps {
  tasks: Task[];
  onAddTask: (title: string, deadline: string, priority: string) => void;
  onUpdateTaskStatus: (id: string, nextStatus: string) => void;
  onDeleteTask: (id: string) => void;
}

export const Planner: React.FC<PlannerProps> = ({
  tasks,
  onAddTask,
  onUpdateTaskStatus,
  onDeleteTask
}) => {
  const [taskTitle, setTaskTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('Medium');

  // Calendar setup helpers
  const daysInMonth = 30;
  const currentDaysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getTasksForDay = (day: number) => {
    // Basic mapping: match day number against the deadline string (e.g. if deadline ends with '-07' or has '7')
    return tasks.filter(t => {
      if (!t.deadline) return false;
      const parts = t.deadline.split('-');
      const dayPart = parseInt(parts[parts.length - 1]);
      return dayPart === day;
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    onAddTask(taskTitle, deadline, priority);
    setTaskTitle('');
    setDeadline('');
    setPriority('Medium');
  };

  const completedCount = tasks.filter(t => t.status === 'Completed').length;
  const completionPercentage = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="notes-board-grid" style={{ paddingBottom: '2rem' }}>
      
      {/* LEFT PANEL: Task CRUD Form & Progress */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Create Task Form */}
        <div className="glass-panel" style={{ background: '#fff', borderRadius: '24px', border: '1.5px solid #0f172a', boxShadow: '0 8px 0 rgba(15, 23, 42, 0.05)' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.4rem', marginBottom: '1.25rem' }}>
            ADD PERSONAL TASK
          </h3>
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>TASK TITLE</label>
              <input
                type="text"
                className="cyber-input"
                placeholder="e.g. Study Operating Systems Unit 1"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
                style={{ borderRadius: '20px', border: '1.5px solid #cbd5e1', padding: '0.65rem 1rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>DUE DATE</label>
                <input
                  type="date"
                  className="cyber-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={{ borderRadius: '20px', border: '1.5px solid #cbd5e1', padding: '0.65rem 1rem' }}
                />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>PRIORITY</label>
                <select
                  className="cyber-input"
                  style={{ appearance: 'auto', cursor: 'pointer', borderRadius: '20px', border: '1.5px solid #cbd5e1', padding: '0.65rem 1rem' }}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="cyber-btn pink-fill"
              style={{
                width: '100%',
                borderRadius: '20px',
                background: 'var(--accent-primary)',
                fontWeight: 800,
                minHeight: '44px',
                border: 'none',
                boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
              }}
            >
              ADD TO LIST
            </button>
          </form>
        </div>

        {/* Progress Tracker Card */}
        <div className="glass-panel" style={{ background: '#fff', borderRadius: '24px', border: '1.5px solid #0f172a', boxShadow: '0 8px 0 rgba(15, 23, 42, 0.05)' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.4rem', marginBottom: '0.8rem' }}>
            STUDY PROGRESS TRACKER
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 800 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Completed Tasks</span>
              <span style={{ color: 'var(--accent-primary)' }}>{completedCount} / {tasks.length}</span>
            </div>
            
            <div style={{ height: '12px', background: '#eaeaea', border: 'none', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${completionPercentage}%`, background: 'var(--accent-cyan)' }} />
            </div>
            
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center' }}>
              Completion parameters: {completionPercentage}% resolved.
            </span>
          </div>
        </div>

      </div>

      {/* RIGHT PANEL: Tasks List & Calendar View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Tasks List Board */}
        <div className="glass-panel" style={{ background: '#fff', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', borderRadius: '24px', border: '1.5px solid #0f172a', boxShadow: '0 8px 0 rgba(15, 23, 42, 0.05)' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 900, borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.5rem' }}>
            STUDY AGENDA
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto', maxHeight: '350px' }}>
            {tasks.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, padding: '2rem 0', textAlign: 'center' }}>
                No active tasks listed. Add a task to stay consistent!
              </p>
            ) : (
              tasks.map(task => (
                <div
                  key={task.id}
                  style={{
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '0.75rem 1rem',
                    background: task.status === 'Completed' ? '#ecfdf5' : '#fefdf0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: 'var(--shadow-flat-sm)',
                    gap: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                    <strong style={{ fontSize: '0.85rem', textDecoration: task.status === 'Completed' ? 'line-through' : 'none', color: '#0f172a' }}>
                      {task.title}
                    </strong>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.58rem',
                        fontWeight: 850,
                        background: task.priority === 'High' ? 'var(--accent-pink)' : task.priority === 'Medium' ? 'var(--accent-gold)' : 'var(--accent-cyan)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        color: '#fff'
                      }}>
                        {task.priority.toUpperCase()}
                      </span>
                      {task.deadline && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {task.deadline}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <select
                      className="cyber-input"
                      style={{ fontSize: '0.68rem', padding: '0.15rem 0.35rem', minHeight: 'auto', width: 'fit-content', border: '1.5px solid #cbd5e1', cursor: 'pointer', appearance: 'auto', borderRadius: '12px' }}
                      value={task.status}
                      onChange={(e) => onUpdateTaskStatus(task.id, e.target.value)}
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                    
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0.25rem', color: 'var(--text-muted)'
                      }}
                      title="Delete task"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visual Monthly Calendar Overview */}
        <div className="glass-panel" style={{ background: '#fff', borderRadius: '24px', border: '1.5px solid #0f172a', boxShadow: '0 8px 0 rgba(15, 23, 42, 0.05)' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.4rem', marginBottom: '0.8rem' }}>
            DEADLINE VISUALIZER (CURRENT MONTH)
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '4px',
            border: '1.5px solid #0f172a',
            background: '#ffffff',
            padding: '6px',
            borderRadius: '16px'
          }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 800, padding: '2px 0' }}>
                {day.toUpperCase()}
              </div>
            ))}
            {currentDaysArray.map(day => {
              const dayTasks = getTasksForDay(day);
              const hasHighPriority = dayTasks.some(t => t.priority === 'High');
              const hasAny = dayTasks.length > 0;
              
              let dayBg = '#ffffff';
              let dayBorder = '1px solid #e2e8f0';
              if (hasHighPriority) {
                dayBg = 'var(--accent-pink)';
                dayBorder = '1px solid transparent';
              } else if (hasAny) {
                dayBg = 'var(--accent-gold)';
                dayBorder = '1px solid transparent';
              }

              return (
                <div
                  key={day}
                  style={{
                    background: dayBg,
                    border: dayBorder,
                    minHeight: '38px',
                    borderRadius: '8px',
                    padding: '3px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative'
                  }}
                  title={hasAny ? `${dayTasks.length} task(s) due` : `Day ${day}`}
                >
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: hasHighPriority ? '#fff' : 'var(--text-primary)' }}>{day}</span>
                  {hasAny && (
                    <span style={{
                      fontSize: '0.55rem', background: '#000', color: '#fff',
                      borderRadius: '50%', width: '12px', height: '12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, alignSelf: 'flex-end'
                    }}>
                      {dayTasks.length}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
