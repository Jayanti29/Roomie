import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured, ref, set, onValue, auth } from '../firebase';
import { Plus, Compass, Trash2, CheckCircle, Sparkles, X } from 'lucide-react';

interface Checkpoint {
  id: string;
  title: string;
  completed: boolean;
  tasks?: string[];
  milestone?: string;
  week?: number;
}

interface Roadmap {
  id: string;
  name: string;
  goal: string;
  targetDate: string;
  progress: number;
  type: 'ai' | 'manual';
  checkpoints: Checkpoint[];
  createdAt: number;
}

interface LearningRoadmapsProps {
  userEmail: string;
  userName: string;
  onRewardXp: (amount: number, reason: string) => void;
  isGuest?: boolean;
}

export const LearningRoadmaps: React.FC<LearningRoadmapsProps> = ({
  userEmail,
  userName: _userName,
  onRewardXp,
  isGuest
}) => {
  const currentUid = auth?.currentUser?.uid || userEmail.replace(/\./g, '_');
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Manual Checkpoint additions
  const [manualCheckpoints, setManualCheckpoints] = useState<string[]>(['']);

  // Detail viewing
  const [activeRoadmap, setActiveRoadmap] = useState<Roadmap | null>(null);

  // Subscribe to roadmaps from RTDB
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const roadmapsRef = ref(db, `users/${currentUid}/roadmaps`);
      const unsub = onValue(roadmapsRef, (snap) => {
        try {
          if (snap.exists()) {
            const val = snap.val();
            const list = Object.entries(val).map(([id, r]: [string, any]) => {
              const checkpoints = r.checkpoints || r.milestones || [];
              const checkpointsList = Array.isArray(checkpoints) ? checkpoints : Object.values(checkpoints);
              return {
                id,
                ...r,
                name: r.name || r.title || '',
                title: r.title || r.name || '',
                goal: r.goal || r.description || '',
                description: r.description || r.goal || '',
                targetDate: r.targetDate || r.deadline || '',
                deadline: r.deadline || r.targetDate || '',
                checkpoints: checkpointsList,
                milestones: checkpointsList
              };
            });
            setRoadmaps(list.sort((a, b) => b.createdAt - a.createdAt));
          } else {
            setRoadmaps([]);
          }
          console.log('[ROADMAP LOAD SUCCESS]');
        } catch (e) {
          console.error('[ROADMAP LOAD FAILED]', e);
        }
        setLoading(false);
      });
      return () => unsub();
    } else {
      // Localstorage mock fallback
      try {
        const list = JSON.parse(localStorage.getItem('roomie_mock_roadmaps') || '[]');
        setRoadmaps(list);
      } catch (e) {}
      setLoading(false);
    }
  }, [currentUid]);

  const saveRoadmapsMock = (updatedList: Roadmap[]) => {
    localStorage.setItem('roomie_mock_roadmaps', JSON.stringify(updatedList));
    setRoadmaps(updatedList);
  };

  const handleAddManualCheckpointField = () => {
    setManualCheckpoints([...manualCheckpoints, '']);
  };

  const handleManualCheckpointValueChange = (index: number, val: string) => {
    const list = [...manualCheckpoints];
    list[index] = val;
    setManualCheckpoints(list);
  };

  const handleRemoveManualCheckpointField = (index: number) => {
    const list = manualCheckpoints.filter((_, idx) => idx !== index);
    setManualCheckpoints(list.length > 0 ? list : ['']);
  };

  const handleCreateManualRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot save roadmaps.");
      return;
    }
    if (!topic.trim()) return;

    const parsedCheckpoints: Checkpoint[] = manualCheckpoints
      .filter(cp => cp.trim().length > 0)
      .map((cp, idx) => ({
        id: `cp_${idx}_${Date.now()}`,
        title: cp,
        completed: false
      }));

    const newRoadmap: any = {
      id: `roadmap_${Date.now()}`,
      name: topic,
      title: topic,
      goal: goal || `Learn ${topic}`,
      description: goal || `Learn ${topic}`,
      targetDate: targetDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      deadline: targetDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      progress: 0,
      type: 'manual',
      checkpoints: parsedCheckpoints,
      milestones: parsedCheckpoints,
      createdAt: Date.now()
    };

    if (isFirebaseConfigured && db) {
      try {
        await set(ref(db, `users/${currentUid}/roadmaps/${newRoadmap.id}`), newRoadmap);
        console.log('[ROADMAP SAVE SUCCESS]', newRoadmap.id);
      } catch (err) {
        console.error('Failed to save manual roadmap:', err);
      }
    } else {
      saveRoadmapsMock([newRoadmap, ...roadmaps]);
    }

    onRewardXp(20, `Created manual roadmap for ${topic}! Gained +20 Study Points!`);
    resetForm();
  };

  const handleCreateAiRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot save roadmaps.");
      return;
    }
    if (!topic.trim()) return;

    setGenerating(true);
    try {
      const systemInstruction = `You are Roomie AI Planner, a professional study advisor. Generate a highly detailed week-by-week learning roadmap for the requested subject. 
You MUST respond ONLY with a valid JSON array of objects representing weekly checkpoints. Do not wrap in markdown \`\`\`json blocks.
Each weekly checkpoint object MUST contain:
- week: number (e.g. 1, 2)
- title: string (the core weekly topic name)
- tasks: array of strings (2-3 detailed tasks or items to learn)
- milestone: string (what the student completes by the end of the week)

Example response structure:
[
  {
    "week": 1,
    "title": "Variables and Basics",
    "tasks": ["Configure compiler and JDK environment", "Write simple arithmetic programs", "Understand primitives vs objects"],
    "milestone": "Compile and run three Java basic programs successfully"
  }
]`;

      const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: `Please create a study roadmap to learn "${topic}" in ${durationWeeks} weeks. My study goal is: "${goal || 'General understanding'}".` }
      ];

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });

      if (!res.ok) throw new Error("API request failed");

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      // Clean potential JSON markdown code block formatting
      let cleanJson = content.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.substring(7);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.substring(0, cleanJson.length - 3);
      }
      cleanJson = cleanJson.trim();

      const parsedWeeks = JSON.parse(cleanJson);
      const generatedCheckpoints: Checkpoint[] = parsedWeeks.map((weekObj: any, idx: number) => ({
        id: `cp_ai_${idx}_${Date.now()}`,
        title: `Week ${weekObj.week}: ${weekObj.title}`,
        completed: false,
        tasks: weekObj.tasks || [],
        milestone: weekObj.milestone || '',
        week: weekObj.week
      }));

      const newRoadmap: any = {
        id: `roadmap_${Date.now()}`,
        name: topic,
        title: topic,
        goal: goal || `Learn ${topic}`,
        description: goal || `Learn ${topic}`,
        targetDate: targetDate || new Date(Date.now() + durationWeeks * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
        deadline: targetDate || new Date(Date.now() + durationWeeks * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
        progress: 0,
        type: 'ai',
        checkpoints: generatedCheckpoints,
        milestones: generatedCheckpoints,
        createdAt: Date.now()
      };

      if (isFirebaseConfigured && db) {
        try {
          await set(ref(db, `users/${currentUid}/roadmaps/${newRoadmap.id}`), newRoadmap);
          console.log('[ROADMAP SAVE SUCCESS]', newRoadmap.id);
        } catch (err) {
          console.error('Failed to save AI roadmap:', err);
        }
      } else {
        saveRoadmapsMock([newRoadmap, ...roadmaps]);
      }

      onRewardXp(40, `Generated AI Roadmap for ${topic}! Gained +40 Study Points!`);
      resetForm();
    } catch (err) {
      console.error("Roadmap generation error:", err);
      alert("Failed to parse AI response. Please try again with a simpler topic name.");
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleCheckpoint = async (roadmapId: string, checkpointId: string) => {
    const roadmap = roadmaps.find(r => r.id === roadmapId);
    if (!roadmap) return;

    const updatedCheckpoints = roadmap.checkpoints.map(cp => 
      cp.id === checkpointId ? { ...cp, completed: !cp.completed } : cp
    );

    const completedCount = updatedCheckpoints.filter(cp => cp.completed).length;
    const progress = Math.round((completedCount / updatedCheckpoints.length) * 100);

    if (isFirebaseConfigured && db) {
      await updateRoadmapInDb(roadmapId, updatedCheckpoints, progress);
    } else {
      const updated = roadmaps.map(r => 
        r.id === roadmapId ? { ...r, checkpoints: updatedCheckpoints, progress } : r
      );
      saveRoadmapsMock(updated);
    }

    // Award minor points for task completion
    const justCompleted = updatedCheckpoints.find(cp => cp.id === checkpointId)?.completed;
    if (justCompleted) {
      onRewardXp(5, `Completed milestone task in "${roadmap.name}"!`);
    }
  };

  const updateRoadmapInDb = async (roadmapId: string, checkpoints: Checkpoint[], progress: number) => {
    if (isFirebaseConfigured && db) {
      const checkpointsObj = checkpoints.reduce((acc, cp, idx) => {
        acc[cp.id || idx] = cp;
        return acc;
      }, {} as any);

      try {
        await set(ref(db, `users/${currentUid}/roadmaps/${roadmapId}/checkpoints`), checkpointsObj);
        await set(ref(db, `users/${currentUid}/roadmaps/${roadmapId}/milestones`), checkpointsObj);
        await set(ref(db, `users/${currentUid}/roadmaps/${roadmapId}/progress`), progress);
        console.log('[ROADMAP SAVE SUCCESS]', roadmapId);
      } catch (err) {
        console.error('Failed to update roadmap in DB:', err);
      }
    }
  };

  const handleDeleteRoadmap = async (roadmapId: string) => {
    if (!confirm("Are you sure you want to delete this study roadmap?")) return;

    if (isFirebaseConfigured && db) {
      await set(ref(db, `users/${currentUid}/roadmaps/${roadmapId}`), null);
    } else {
      const updated = roadmaps.filter(r => r.id !== roadmapId);
      saveRoadmapsMock(updated);
    }

    if (activeRoadmap?.id === roadmapId) {
      setActiveRoadmap(null);
    }
  };

  const resetForm = () => {
    setTopic('');
    setGoal('');
    setTargetDate('');
    setDurationWeeks(4);
    setManualCheckpoints(['']);
    setShowAddForm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2.5rem', textAlign: 'left' }}>
      
      {/* Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          background: '#e0e7ff',
          border: '2px solid #0f172a',
          padding: '0.35rem 1.5rem',
          borderRadius: '4px',
          fontFamily: 'var(--font-heading)',
          fontWeight: 900,
          fontSize: '1.1rem',
          color: '#0f172a',
          boxShadow: '3px 3px 0px #0f172a',
          transform: 'rotate(-1deg)',
          position: 'relative'
        }}>
          LEARNING ROADMAPS
          <div style={{ position: 'absolute', top: '-6px', left: '10px', width: '20px', height: '8px', background: 'rgba(0,0,0,0.1)' }} />
          <div style={{ position: 'absolute', top: '-6px', right: '10px', width: '20px', height: '8px', background: 'rgba(0,0,0,0.1)' }} />
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="cyber-btn purple-fill"
          style={{
            border: '2px solid #0f172a',
            boxShadow: '3px 3px 0px #0f172a',
            fontWeight: 800,
            borderRadius: '12px'
          }}
        >
          <Plus size={16} /> {showAddForm ? 'Close Builder' : 'Create Roadmap'}
        </button>
      </div>

      {/* Creation form */}
      {showAddForm && (
        <div className="glass-panel anim-pop" style={{
          background: '#ffffff',
          border: '2px solid #0f172a',
          borderRadius: '24px',
          boxShadow: '5px 5px 0px #0f172a',
          padding: '1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setMode('ai')}
              style={{
                background: 'none', border: 'none', fontWeight: 800, cursor: 'pointer',
                color: mode === 'ai' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                borderBottom: mode === 'ai' ? '3px solid var(--accent-purple)' : '3px solid transparent',
                paddingBottom: '0.3rem', fontSize: '0.9rem', fontFamily: 'var(--font-heading)'
              }}
            >
              <Sparkles size={16} style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'text-bottom' }} /> AI Generator
            </button>
            <button
              onClick={() => setMode('manual')}
              style={{
                background: 'none', border: 'none', fontWeight: 800, cursor: 'pointer',
                color: mode === 'manual' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                borderBottom: mode === 'manual' ? '3px solid var(--accent-purple)' : '3px solid transparent',
                paddingBottom: '0.3rem', fontSize: '0.9rem', fontFamily: 'var(--font-heading)'
              }}
            >
              <Compass size={16} style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Manual Designer
            </button>
          </div>

          <form onSubmit={mode === 'ai' ? handleCreateAiRoadmap : handleCreateManualRoadmap} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="lobby-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>SUBJECT / TOPIC NAME</label>
                <input
                  type="text"
                  className="cyber-input"
                  placeholder={mode === 'ai' ? "e.g. Java Programming, Data Structures" : "e.g. UPSC Prelims Economy"}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>GOAL STATEMENT</label>
                <input
                  type="text"
                  className="cyber-input"
                  placeholder="e.g. Build backend API, master arrays and hash maps"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="lobby-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>TARGET COMPLETION DATE</label>
                <input
                  type="date"
                  className="cyber-input"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>

              {mode === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>AI SYLLABUS SPAN (WEEKS)</label>
                  <select
                    className="cyber-input"
                    value={durationWeeks}
                    onChange={(e) => setDurationWeeks(Number(e.target.value))}
                    style={{ appearance: 'auto', cursor: 'pointer' }}
                  >
                    <option value={2}>2 Weeks Blitz</option>
                    <option value={4}>4 Weeks Standard</option>
                    <option value={8}>8 Weeks Master</option>
                    <option value={12}>12 Weeks Full Term</option>
                  </select>
                </div>
              )}
            </div>

            {mode === 'manual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>ADD MILESTONE TOPICS / CHECKPOINTS</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {manualCheckpoints.map((cp, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, minWidth: '45px', color: 'var(--text-muted)' }}>CP #{idx + 1}</span>
                      <input
                        type="text"
                        className="cyber-input"
                        placeholder="e.g. Read chapters 1-3, complete arrays quiz"
                        value={cp}
                        onChange={(e) => handleManualCheckpointValueChange(idx, e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveManualCheckpointField(idx)}
                        className="cyber-btn"
                        style={{ padding: '0.4rem', background: '#fee2e2', color: '#dc2626', border: 'none', minHeight: '36px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddManualCheckpointField}
                  className="cyber-btn"
                  style={{ alignSelf: 'flex-start', padding: '0.3rem 0.75rem', fontSize: '0.75rem', marginTop: '0.2rem' }}
                >
                  + Add Checkpoint Topic
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={generating}
              className="cyber-btn pink-fill"
              style={{
                alignSelf: 'flex-end', border: '2px solid #0f172a',
                boxShadow: '3px 3px 0px #0f172a', fontWeight: 800,
                borderRadius: '12px', padding: '0.65rem 1.5rem', marginTop: '0.5rem'
              }}
            >
              {generating ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Sparkles size={14} className="anim-float" /> Generating interactive checkpoints...
                </span>
              ) : (
                mode === 'ai' ? 'Generate AI Roadmap with Gemini' : 'Save Manual Design'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Main Grid View */}
      <div style={{ display: 'grid', gridTemplateColumns: activeRoadmap ? '1.1fr 1fr' : '1fr', gap: '1.5rem' }} className="lobby-grid">
        
        {/* Left Side: Shelf List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{
            background: '#ffffff',
            border: '2px solid #0f172a',
            borderRadius: '24px',
            boxShadow: '4px 4px 0px #0f172a',
            padding: '1.25rem'
          }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', borderBottom: '2px solid #0f172a', paddingBottom: '0.4rem', marginBottom: '1rem' }}>
              ACTIVE ACADEMIC CURRICULA
            </h3>

            {loading ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading learning paths...</span>
            ) : roadmaps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <Compass size={36} style={{ marginBottom: '0.5rem', opacity: 0.7 }} />
                <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>No active roadmaps found. Generate one with AI or define custom study checkpoints!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {roadmaps.map(roadmap => (
                  <div
                    key={roadmap.id}
                    className="anim-pop"
                    onClick={() => setActiveRoadmap(roadmap)}
                    style={{
                      border: activeRoadmap?.id === roadmap.id ? '2.5px solid var(--accent-purple)' : '1.5px solid #0f172a',
                      borderRadius: '16px',
                      padding: '1rem',
                      background: activeRoadmap?.id === roadmap.id ? 'var(--accent-primary-light)' : '#ffffff',
                      boxShadow: activeRoadmap?.id === roadmap.id ? 'none' : '3px 3px 0px #0f172a',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        background: roadmap.type === 'ai' ? '#f3e8ff' : '#fef3c7',
                        color: roadmap.type === 'ai' ? '#7c3aed' : '#d97706',
                        padding: '2px 8px',
                        border: '1px solid #0f172a',
                        borderRadius: '6px'
                      }}>
                        {roadmap.type === 'ai' ? 'AI GENERATED' : 'MANUAL TOPICS'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteRoadmap(roadmap.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {roadmap.name}
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Goal: {roadmap.goal}</span>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', fontWeight: 800, marginTop: '0.2rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Target: {roadmap.targetDate}</span>
                      <span style={{ color: 'var(--accent-primary)' }}>Progress: {roadmap.progress}%</span>
                    </div>

                    <div style={{ height: '8px', background: '#f1f5f9', border: '1.5px solid #0f172a', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${roadmap.progress}%`, background: 'var(--accent-primary)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Roadmap Checklist Details */}
        {activeRoadmap && (
          <div className="glass-panel anim-pop" style={{
            background: '#ffffff',
            border: '2px solid #0f172a',
            borderRadius: '24px',
            boxShadow: '4px 4px 0px #0f172a',
            padding: '1.25rem',
            height: 'fit-content'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.4rem', marginBottom: '1rem' }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', color: '#0f172a' }}>
                {activeRoadmap.name} Checklist
              </strong>
              <button
                onClick={() => setActiveRoadmap(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 900 }}
              >
                <X size={14} style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.2rem' }}>
              {activeRoadmap.checkpoints.length === 0 ? (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No checkpoints added.</span>
              ) : (
                activeRoadmap.checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    style={{
                      border: '1.5px solid #0f172a',
                      borderRadius: '12px',
                      padding: '0.65rem 0.8rem',
                      background: cp.completed ? '#f0fdf4' : '#ffffff',
                      boxShadow: '2px 2px 0px #0f172a',
                      display: 'flex',
                      gap: '0.6rem',
                      alignItems: 'flex-start'
                    }}
                  >
                    <button
                      onClick={() => handleToggleCheckpoint(activeRoadmap.id, cp.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px', color: cp.completed ? 'var(--accent-green)' : 'var(--text-muted)' }}
                    >
                      {cp.completed ? <CheckCircle size={18} /> : <div style={{ width: '16px', height: '16px', border: '1.5px solid #0f172a', borderRadius: '4px' }} />}
                    </button>
                    
                    <div style={{ flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        color: cp.completed ? 'var(--text-muted)' : '#0f172a',
                        textDecoration: cp.completed ? 'line-through' : 'none'
                      }}>
                        {cp.title}
                      </span>
                      {cp.milestone && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', fontWeight: 800 }}>
                          Objective: {cp.milestone}
                        </span>
                      )}
                      {cp.tasks && cp.tasks.length > 0 && (
                        <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          {cp.tasks.map((task, tidx) => (
                            <li key={tidx}>{task}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
