import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, auth, onValue } from '../firebase';
import { Clock, BookOpen, Volume2, VolumeX, BarChart2, Play, Pause, Square, Award, List, Flame, Calendar } from 'lucide-react';

interface Course {
  id: string;
  name: string;
  progress: number;
}

interface FocusSession {
  id?: string;
  taskName: string;
  duration: number; // in minutes
  completed: boolean;
  startedAt: string;
  completedAt: string;
}

interface FocusClockProps {
  userEmail: string;
  courses: Course[];
  timerActive: boolean;
  timerPaused: boolean;
  timerTimeLeft: number;
  timerTotal: number;
  timerTaskName: string;
  timerSubject: string;
  timerMode: boolean; // true = pomodoro
  timerCycle: 'focus' | 'break';
  setTimerTaskName: (name: string) => void;
  setTimerSubject: (subj: string) => void;
  onStartTimer: (task: string, subject: string, totalSecs: number, isPomo: boolean, cycleVal: 'focus' | 'break') => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onStopTimer: () => void;
  onToggleMode: () => void;
  onSetDuration: (totalSecs: number) => void;
}

export const FocusClock: React.FC<FocusClockProps> = ({
  userEmail,
  courses,
  timerActive,
  timerPaused,
  timerTimeLeft,
  timerTotal,
  timerTaskName,
  timerSubject,
  timerMode,
  timerCycle,
  setTimerTaskName,
  setTimerSubject,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onStopTimer,
  onToggleMode,
  onSetDuration
}) => {
  const currentUid = auth?.currentUser?.uid || userEmail.replace(/\./g, '_');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isLofiOn, setIsLofiOn] = useState(false);

  // Audio Context synthesis references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const synthIntervalRef = useRef<any>(null);
  const chordNodesRef = useRef<OscillatorNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Synced status banner
  const [showStatus, setShowStatus] = useState<string | null>(null);

  // Preset durations for custom mode
  const presets = [
    { label: '25 Min', h: 0, m: 25 },
    { label: '45 Min', h: 0, m: 45 },
    { label: '1 Hour', h: 1, m: 0 },
    { label: '2 Hours', h: 2, m: 0 }
  ];

  // Focus Sessions Database State
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch session history from Realtime Database
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const sessionsRef = ref(db, `users/${currentUid}/focus_sessions`);
      const unsub = onValue(sessionsRef, (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          const list = Object.entries(val).map(([id, s]: [string, any]) => ({
            id,
            ...s
          }));
          setSessions(list.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()));
        } else {
          setSessions([]);
        }
        setLoadingStats(false);
      });
      return () => unsub();
    } else {
      // Local mock DB fallback
      try {
        const localData = JSON.parse(localStorage.getItem('roomie_mock_focus_sessions') || '[]');
        setSessions(localData.sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()));
      } catch (e) {}
      setLoadingStats(false);
    }
  }, [currentUid]);

  // Set presets (disabled in Pomodoro mode)
  const handlePreset = (hVal: number, mVal: number) => {
    if (timerActive || timerMode) return;
    setHours(hVal);
    setMinutes(mVal);
    setSeconds(0);
    const secs = (hVal * 3600) + (mVal * 60);
    onSetDuration(secs);
  };

  // Switch between custom duration and Pomodoro Mode
  useEffect(() => {
    if (timerActive) return;
    if (timerMode) {
      if (timerCycle === 'focus') {
        onSetDuration(25 * 60);
      } else {
        onSetDuration(5 * 60);
      }
    } else {
      const secs = (hours * 3600) + (minutes * 60) + seconds;
      onSetDuration(secs);
    }
  }, [hours, minutes, seconds, timerMode, timerCycle, timerActive]);

  // Web Audio Synthesizer Logic
  const startSynth = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
      gainNodeRef.current = masterGain;

      // Vinyl Crackle Noise
      const bufferSize = 2 * audioCtx.sampleRate;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.6;

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.04, audioCtx.currentTime);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseSource.start();
      noiseSourceRef.current = noiseSource;

      // Lofi study chord player (Triangle waves, lowpass filter)
      const playChord = (frequencies: number[]) => {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        
        chordNodesRef.current.forEach(osc => {
          try { osc.stop(); } catch(e){}
        });
        chordNodesRef.current = [];

        frequencies.forEach(freq => {
          const osc = audioCtx.createOscillator();
          const oscGain = audioCtx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

          oscGain.gain.setValueAtTime(0, audioCtx.currentTime);
          oscGain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 2.5);
          oscGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 7.5);

          const toneFilter = audioCtx.createBiquadFilter();
          toneFilter.type = 'lowpass';
          toneFilter.frequency.setValueAtTime(320, audioCtx.currentTime);

          osc.connect(oscGain);
          oscGain.connect(toneFilter);
          toneFilter.connect(masterGain);
          osc.start();
          chordNodesRef.current.push(osc);
        });
      };

      const chords = [
        [130.81, 164.81, 196.00, 246.94], // Cmaj7
        [110.00, 130.81, 164.81, 196.00], // Am7
        [146.83, 174.61, 220.00, 261.63], // Dm7
        [98.00, 146.83, 196.00, 246.94]   // G7
      ];

      let currentChord = 0;
      playChord(chords[currentChord]);

      synthIntervalRef.current = setInterval(() => {
        currentChord = (currentChord + 1) % chords.length;
        playChord(chords[currentChord]);
      }, 8000);

    } catch (e) {
      console.warn("Failed to initialize Web Audio Synthesizer:", e);
    }
  };

  const stopSynth = () => {
    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }
    chordNodesRef.current.forEach(osc => {
      try { osc.stop(); } catch(e){}
    });
    chordNodesRef.current = [];
    if (noiseSourceRef.current) {
      try { noiseSourceRef.current.stop(); } catch(e){}
      noiseSourceRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch(e){}
      audioCtxRef.current = null;
    }
  };

  useEffect(() => {
    if (isLofiOn && timerActive && !timerPaused) {
      startSynth();
    } else {
      stopSynth();
    }
    return () => stopSynth();
  }, [isLofiOn, timerActive, timerPaused]);

  const handleStart = () => {
    const duration = timerMode
      ? (timerCycle === 'focus' ? 25 * 60 : 5 * 60)
      : (hours * 3600 + minutes * 60 + seconds);

    if (duration <= 0) {
      alert("Please select or enter a valid duration.");
      return;
    }

    onStartTimer(timerTaskName, timerSubject, duration, timerMode, timerCycle);
    
    setShowStatus(timerMode 
      ? `Pomodoro ${timerCycle === 'focus' ? 'Focus Block' : 'Break'} Started!` 
      : "Focus Session Started! Keep it up.");
    setTimeout(() => setShowStatus(null), 3000);
  };

  const handlePause = () => {
    onPauseTimer();
    setShowStatus("Session paused.");
    setTimeout(() => setShowStatus(null), 2000);
  };

  const handleResume = () => {
    onResumeTimer();
    setShowStatus("Session resumed.");
    setTimeout(() => setShowStatus(null), 2000);
  };

  const handleStop = () => {
    onStopTimer();
    setShowStatus("Session stopped. Partially recorded.");
    setTimeout(() => setShowStatus(null), 4000);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? String(h).padStart(2, '0') + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const spentPercent = timerTotal > 0 ? (timerTotal - timerTimeLeft) / timerTotal : 0;
  const handRotationAngle = spentPercent * 360;

  // Math Statistics
  const totalCompletedSessions = sessions.filter(s => s.completed).length;
  const totalFocusMinutes = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const totalFocusHours = (totalFocusMinutes / 60).toFixed(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2.5rem', textAlign: 'left' }}>
      
      {/* Header and Mode switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          background: '#fed7aa',
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
          RETRO POMODORO CLOCK
          <div style={{ position: 'absolute', top: '-6px', left: '10px', width: '20px', height: '8px', background: 'rgba(0,0,0,0.1)' }} />
          <div style={{ position: 'absolute', top: '-6px', right: '10px', width: '20px', height: '8px', background: 'rgba(0,0,0,0.1)' }} />
        </div>

        <button
          onClick={() => {
            if (timerActive) return;
            onToggleMode();
          }}
          className="cyber-btn"
          style={{
            border: '2px solid #0f172a',
            boxShadow: '3px 3px 0px #0f172a',
            fontWeight: 800,
            background: timerMode ? 'var(--accent-purple-light)' : '#ffffff',
            borderRadius: '12px',
            color: '#0f172a',
            cursor: timerActive ? 'not-allowed' : 'pointer'
          }}
          disabled={timerActive}
        >
          {timerMode ? 'Switch to Custom Timer' : 'Switch to Pomodoro Mode'}
        </button>
      </div>

      {showStatus && (
        <div className="anim-pop" style={{
          background: '#dcfce7',
          border: '2px solid #0f172a',
          padding: '0.5rem 1.25rem',
          borderRadius: '12px',
          fontWeight: 800,
          color: '#15803d',
          fontSize: '0.85rem',
          boxShadow: '3px 3px 0px #0f172a',
          width: 'fit-content'
        }}>
          {showStatus}
        </div>
      )}

      {/* Main split grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1.75rem' }} className="lobby-grid">
        
        {/* Left Side: Vintage notebook styled timer block */}
        <div style={{
          background: '#ffffff',
          border: '3px solid #0f172a',
          borderRadius: '24px',
          boxShadow: '6px 6px 0px #0f172a',
          padding: '1.5rem',
          position: 'relative',
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          {/* Binder Ring effect */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '-12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.8rem',
            zIndex: 10
          }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{
                width: '24px',
                height: '14px',
                borderRadius: '8px',
                background: '#94a3b8',
                border: '2px solid #0f172a',
                boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.15)'
              }} />
            ))}
          </div>

          <div style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* Subject selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <BookOpen size={14} /> SELECT STUDY SUBJECT
              </label>
              
              <select
                value={timerSubject}
                onChange={(e) => {
                  setTimerSubject(e.target.value);
                  setTimerTaskName('');
                }}
                disabled={timerActive}
                className="cyber-input"
                style={{
                  appearance: 'auto',
                  border: '2px solid #0f172a',
                  borderRadius: '12px',
                  padding: '0.6rem',
                  fontWeight: 700,
                  background: timerActive ? '#f1f5f9' : '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- Select Active Course --</option>
                {courses.map(course => (
                  <option key={course.id} value={course.name}>{course.name}</option>
                ))}
                <option value="custom">-- Use Custom Topic Name --</option>
              </select>

              {(timerSubject === 'custom' || timerSubject === '') && (
                <input
                  type="text"
                  placeholder="Type subject/topic name..."
                  value={timerTaskName}
                  onChange={(e) => setTimerTaskName(e.target.value)}
                  disabled={timerActive}
                  className="cyber-input"
                  style={{
                    marginTop: '0.4rem',
                    border: '2px solid #0f172a',
                    borderRadius: '12px',
                    padding: '0.6rem',
                    fontWeight: 700,
                    background: timerActive ? '#f1f5f9' : '#ffffff'
                  }}
                />
              )}
            </div>

            {/* Pomodoro Mode States indicator */}
            {timerMode && (
              <div style={{
                background: timerCycle === 'focus' ? '#fed7aa' : '#bbf7d0',
                border: '2px solid #0f172a',
                borderRadius: '12px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '3px 3px 0px #0f172a',
                fontFamily: 'var(--font-heading)'
              }} className="anim-pop">
                <div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)', display: 'block' }}>CYCLE STATUS</span>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                    {timerCycle === 'focus' ? 'FOCUS BLOCK (25 Min)' : 'SHORT BREAK (5 Min)'}
                  </strong>
                </div>
                <Flame size={20} className="anim-float" style={{ color: timerCycle === 'focus' ? '#ea580c' : '#16a34a' }} />
              </div>
            )}

            {/* Custom durations (only visible when Pomodoro mode is off) */}
            {!timerMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>QUICK PRESETS</span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePreset(p.h, p.m)}
                      disabled={timerActive}
                      className="cyber-btn"
                      style={{
                        flex: '1 1 auto',
                        border: '1.5px solid #0f172a',
                        background: (hours === p.h && minutes === p.m) ? 'var(--accent-primary-light)' : '#ffffff',
                        boxShadow: '2px 2px 0px #0f172a',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '8px'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>Hours</span>
                    <select
                      value={hours}
                      onChange={(e) => handlePreset(Number(e.target.value), minutes)}
                      disabled={timerActive}
                      className="cyber-input"
                      style={{ border: '2px solid #0f172a', borderRadius: '8px', padding: '0.3rem', fontWeight: 700 }}
                    >
                      {[0, 1, 2, 3].map(h => (
                        <option key={h} value={h}>{h} hr</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>Minutes</span>
                    <select
                      value={minutes}
                      onChange={(e) => handlePreset(hours, Number(e.target.value))}
                      disabled={timerActive}
                      className="cyber-input"
                      style={{ border: '2px solid #0f172a', borderRadius: '8px', padding: '0.3rem', fontWeight: 700 }}
                    >
                      {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                        <option key={m} value={m}>{m} min</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Circular Dial Clock Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                background: '#fffdf8',
                border: '3px solid #0f172a',
                boxShadow: '5px 5px 0px #0f172a',
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden'
              }}>
                <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                  <circle cx="80" cy="80" r="70" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="8"
                    strokeDasharray="440"
                    strokeDashoffset={440 - (440 * spentPercent)}
                    strokeLinecap="round"
                    style={{ transition: timerActive ? 'stroke-dashoffset 1s linear' : 'stroke-dashoffset 0.3s ease' }}
                  />
                  {[0, 90, 180, 270].map((deg, i) => {
                    const rad = (deg * Math.PI) / 180;
                    const x1 = 80 + 62 * Math.cos(rad);
                    const y1 = 80 + 62 * Math.sin(rad);
                    const x2 = 80 + 70 * Math.cos(rad);
                    const y2 = 80 + 70 * Math.sin(rad);
                    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f172a" strokeWidth="2.5" />;
                  })}
                </svg>

                {/* Hands indicator */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  transform: `rotate(${handRotationAngle}deg)`,
                  transition: timerActive && !timerPaused ? 'transform 1s linear' : 'transform 0.3s ease',
                  pointerEvents: 'none'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: 'calc(50% - 2px)',
                    width: '4px',
                    height: '60px',
                    background: '#ec4899',
                    borderRadius: '4px',
                    border: '1px solid #0f172a'
                  }} />
                </div>

                <div style={{
                  position: 'absolute',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  color: '#0f172a',
                  background: '#fef08a',
                  border: '2px solid #0f172a',
                  padding: '0.1rem 0.65rem',
                  borderRadius: '6px',
                  boxShadow: '2px 2px 0px #0f172a'
                }}>
                  {formatTime(timerTimeLeft)}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                {!timerActive ? (
                  <button
                    onClick={handleStart}
                    className="cyber-btn pink-fill"
                    style={{ border: '2px solid #0f172a', boxShadow: '3px 3px 0px #0f172a', fontWeight: 900, borderRadius: '12px', padding: '0.5rem 1.5rem' }}
                  >
                    <Play size={16} style={{ marginRight: '0.35rem' }} /> START FOCUS
                  </button>
                ) : (
                  <>
                    {timerPaused ? (
                      <button
                        onClick={handleResume}
                        className="cyber-btn"
                        style={{ border: '2px solid #0f172a', background: '#a7f3d0', boxShadow: '3px 3px 0px #0f172a', fontWeight: 900, borderRadius: '12px', padding: '0.5rem 1rem' }}
                      >
                        RESUME
                      </button>
                    ) : (
                      <button
                        onClick={handlePause}
                        className="cyber-btn"
                        style={{ border: '2px solid #0f172a', background: '#fef08a', boxShadow: '3px 3px 0px #0f172a', fontWeight: 900, borderRadius: '12px', padding: '0.5rem 1rem' }}
                      >
                        <Pause size={16} /> PAUSE
                      </button>
                    )}
                    <button
                      onClick={handleStop}
                      className="cyber-btn"
                      style={{ border: '2px solid #0f172a', background: '#fca5a5', boxShadow: '3px 3px 0px #0f172a', fontWeight: 900, borderRadius: '12px', padding: '0.5rem 1rem' }}
                    >
                      <Square size={16} /> STOP
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Sound Synth Option */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#e0e7ff',
              border: '2px solid #0f172a',
              borderRadius: '12px',
              padding: '0.65rem 0.8rem',
              boxShadow: '3px 3px 0px #0f172a',
              marginTop: '0.4rem'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 850 }}>FOCUS SOUND MACHINE</strong>
                <span style={{ fontSize: '0.65rem', color: '#4f46e5', fontWeight: 650 }}>Rain crackle & soft lofi keys</span>
              </div>
              <button
                onClick={() => setIsLofiOn(!isLofiOn)}
                style={{
                  background: isLofiOn ? '#8b5cf6' : '#ffffff',
                  color: isLofiOn ? '#ffffff' : '#0f172a',
                  border: '2px solid #0f172a',
                  borderRadius: '8px',
                  fontWeight: 900,
                  fontSize: '0.7rem',
                  padding: '0.25rem 0.5rem',
                  cursor: 'pointer'
                }}
              >
                {isLofiOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
            </div>

          </div>

        </div>

        {/* Right Side: Vintage focus stats notebook log sheet */}
        <div style={{
          background: '#fdfbf7',
          border: '3px solid #0f172a',
          borderRadius: '24px',
          boxShadow: '6px 6px 0px #0f172a',
          padding: '1.5rem',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          minHeight: '450px'
        }}>
          {/* Lined Notebook Paper Background style */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: 'linear-gradient(#e2e8f0 1.5px, transparent 1.5px)',
            backgroundSize: '100% 28px',
            opacity: 0.45,
            pointerEvents: 'none',
            borderRadius: '20px'
          }} />

          <div style={{ zIndex: 5, display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1rem',
              fontWeight: 900,
              color: '#0f172a',
              borderBottom: '2px solid #0f172a',
              paddingBottom: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              margin: 0
            }}>
              <BarChart2 size={18} /> FOCUS STATISTICS
            </h3>

            {/* Statistics badges */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{
                background: '#ffffff',
                border: '2px solid #0f172a',
                borderRadius: '16px',
                padding: '0.75rem',
                boxShadow: '3px 3px 0px #0f172a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>TOTAL HOURS</span>
                <strong style={{ fontSize: '1.5rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Clock size={20} style={{ color: 'var(--accent-primary)' }} /> {totalFocusHours}
                </strong>
              </div>

              <div style={{
                background: '#ffffff',
                border: '2px solid #0f172a',
                borderRadius: '16px',
                padding: '0.75rem',
                boxShadow: '3px 3px 0px #0f172a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>COMPLETED SESSIONS</span>
                <strong style={{ fontSize: '1.5rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Award size={20} style={{ color: '#ea580c' }} /> {totalCompletedSessions}
                </strong>
              </div>
            </div>

            {/* Recent Sessions list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', marginTop: '0.5rem', maxHeight: '250px' }}>
              <h4 style={{
                fontSize: '0.75rem',
                fontWeight: 900,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                margin: '0.5rem 0 0.2rem 0'
              }}>
                <List size={14} /> RECENT LOG ENTRIES
              </h4>

              {loadingStats ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reading academic diaries...</span>
              ) : sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600 }}>No study log entries found. Start a focus clock session to document your learning milestones!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sessions.slice(0, 5).map((s, idx) => (
                    <div
                      key={s.id || idx}
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #0f172a',
                        borderRadius: '12px',
                        padding: '0.5rem 0.75rem',
                        boxShadow: '2px 2px 0px #0f172a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>{s.taskName}</strong>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Calendar size={10} /> {new Date(s.completedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          background: s.completed ? '#dcfce7' : '#fee2e2',
                          color: s.completed ? '#16a34a' : '#dc2626',
                          padding: '1px 6px',
                          border: '1px solid #0f172a',
                          borderRadius: '4px'
                        }}>
                          {s.completed ? 'COMPLETED' : 'PARTIAL'}
                        </span>
                        <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>{s.duration}m</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
