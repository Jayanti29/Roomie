// src/components/Planner.tsx
import React, { useState } from 'react';

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
        <div className="glass-panel" style={{ background: '#fff' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, borderBottom: '2.5px solid #000', paddingBottom: '0.4rem', marginBottom: '1.25rem' }}>
            ✏️ ADD PERSONAL TASK
          </h3>
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>TASK TITLE</label>
              <input
                type="text"
                className="cyber-input"
                placeholder="e.g. Study Operating Systems Unit 1"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>DUE DATE</label>
                <input
                  type="date"
                  className="cyber-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>PRIORITY</label>
                <select
                  className="cyber-input"
                  style={{ appearance: 'auto', cursor: 'pointer' }}
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
              style={{ width: '100%', border: '3px solid #000', boxShadow: '4px 4px 0px #000', marginTop: '0.5rem' }}
            >
              ADD TO LIST
            </button>
          </form>
        </div>

        {/* Progress Tracker Card */}
        <div className="glass-panel" style={{ background: '#fff' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, borderBottom: '2.5px solid #000', paddingBottom: '0.4rem', marginBottom: '0.8rem' }}>
            📊 STUDY PROGRESS TRACKER
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 800 }}>
              <span>Completed Tasks</span>
              <span>{completedCount} / {tasks.length}</span>
            </div>
            
            <div style={{ height: '14px', background: '#eaeaea', border: '2px solid #000', borderRadius: '7px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${completionPercentage}%`, background: 'var(--accent-green)' }} />
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
        <div className="glass-panel" style={{ background: '#fff', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 900, borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
            📋 STUDY AGENDA
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
                    border: '2.5px solid #000',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    background: task.status === 'Completed' ? '#dff0d8' : '#fffcf0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '2px 2px 0px #000',
                    gap: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                    <strong style={{ fontSize: '0.85rem', textDecoration: task.status === 'Completed' ? 'line-through' : 'none' }}>
                      {task.title}
                    </strong>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.58rem',
                        fontWeight: 900,
                        background: task.priority === 'High' ? 'var(--accent-pink)' : task.priority === 'Medium' ? 'var(--accent-gold)' : 'var(--accent-cyan)',
                        border: '1.5px solid #000',
                        borderRadius: '4px',
                        padding: '1px 4px',
                        color: task.priority === 'High' ? '#fff' : '#000'
                      }}>
                        {task.priority.toUpperCase()}
                      </span>
                      {task.deadline && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                          📅 {task.deadline}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <select
                      className="cyber-input"
                      style={{ fontSize: '0.65rem', padding: '0.15rem 0.35rem', minHeight: 'auto', width: 'fit-content', border: '1.5px solid #000', cursor: 'pointer', appearance: 'auto' }}
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
                        fontSize: '1rem', padding: '0.25rem'
                      }}
                      title="Delete task"
                    >
                      ❌
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visual Monthly Calendar Overview */}
        <div className="glass-panel" style={{ background: '#fff' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, borderBottom: '2.5px solid #000', paddingBottom: '0.4rem', marginBottom: '0.8rem' }}>
            📅 DEADLINE VISUALIZER (CURRENT MONTH)
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '4px',
            border: '2px solid #000',
            background: '#000',
            padding: '4px',
            borderRadius: '12px'
          }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} style={{ textAlign: 'center', color: '#fff', fontSize: '0.6rem', fontWeight: 900, padding: '2px 0' }}>
                {day.toUpperCase()}
              </div>
            ))}
            {currentDaysArray.map(day => {
              const dayTasks = getTasksForDay(day);
              const hasHighPriority = dayTasks.some(t => t.priority === 'High');
              const hasAny = dayTasks.length > 0;
              
              let dayBg = '#fff';
              if (hasHighPriority) dayBg = 'var(--accent-pink)';
              else if (hasAny) dayBg = 'var(--accent-gold)';

              return (
                <div
                  key={day}
                  style={{
                    background: dayBg,
                    minHeight: '38px',
                    borderRadius: '6px',
                    padding: '2px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative'
                  }}
                  title={hasAny ? `${dayTasks.length} task(s) due` : `Day ${day}`}
                >
                  <span style={{ fontSize: '0.55rem', fontWeight: 900, color: hasHighPriority ? '#fff' : '#000' }}>{day}</span>
                  {hasAny && (
                    <span style={{
                      fontSize: '0.5rem', background: '#000', color: '#fff',
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
