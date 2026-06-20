import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, push, auth } from '../firebase';

interface FocusClockProps {
  userEmail: string;
}

export const FocusClock: React.FC<FocusClockProps> = ({ userEmail }) => {
  const [taskName, setTaskName] = useState('');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLofiOn, setIsLofiOn] = useState(false);
  
  // Timer calculations
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const timerRef = useRef<any>(null);
  const startedAtRef = useRef<string | null>(null);

  // Audio Context synthesis references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const synthIntervalRef = useRef<any>(null);
  const chordNodesRef = useRef<OscillatorNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Synced status banner
  const [showStatus, setShowStatus] = useState<string | null>(null);

  // Preset durations
  const presets = [
    { label: '25 Min', h: 0, m: 25 },
    { label: '45 Min', h: 0, m: 45 },
    { label: '1 Hour', h: 1, m: 0 },
    { label: '2 Hours', h: 2, m: 0 },
    { label: '3 Hours', h: 3, m: 0 },
  ];

  // Set presets
  const handlePreset = (hVal: number, mVal: number) => {
    if (isActive) return;
    setHours(hVal);
    setMinutes(mVal);
    setSeconds(0);
    const secs = (hVal * 3600) + (mVal * 60);
    setTotalSeconds(secs);
    setTimeLeft(secs);
  };

  // Custom picker modification
  useEffect(() => {
    if (!isActive) {
      const secs = (hours * 3600) + (minutes * 60) + seconds;
      setTotalSeconds(secs);
      setTimeLeft(secs);
    }
  }, [hours, minutes, seconds, isActive]);

  // Audio synthesization logic
  const startSynth = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      // Master volume gain node
      const masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
      gainNodeRef.current = masterGain;

      // Vinyl/Rain noise synthesis
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
      filter.frequency.value = 1000;
      filter.Q.value = 0.5;

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.05, audioCtx.currentTime);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseSource.start();
      noiseSourceRef.current = noiseSource;

      // Relaxing lofi chord player
      const playChord = (frequencies: number[]) => {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        
        // Stop current oscillators
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
          oscGain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 2); // Soft slow attack
          oscGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 7.5); // Decay

          const toneFilter = audioCtx.createBiquadFilter();
          toneFilter.type = 'lowpass';
          toneFilter.frequency.setValueAtTime(350, audioCtx.currentTime);

          osc.connect(oscGain);
          oscGain.connect(toneFilter);
          toneFilter.connect(masterGain);
          osc.start();
          chordNodesRef.current.push(osc);
        });
      };

      // Nostalgic study chords progression (Cmaj7 -> Am7 -> Dm7 -> G7)
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

  // Sync lofi status toggle
  useEffect(() => {
    if (isLofiOn && isActive && !isPaused) {
      startSynth();
    } else {
      stopSynth();
    }
    return () => stopSynth();
  }, [isLofiOn, isActive, isPaused]);

  // Handle countdown logic
  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleCompleteTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isPaused]);

  // Actions
  const handleStart = () => {
    if (totalSeconds <= 0) {
      alert("Please select or enter a valid duration.");
      return;
    }
    setIsActive(true);
    setIsPaused(false);
    startedAtRef.current = new Date().toISOString();
    setShowStatus("Study Session Started! Keep focused.");
    setTimeout(() => setShowStatus(null), 3000);
  };

  const handlePause = () => {
    setIsPaused(true);
    setShowStatus("Session Paused.");
    setTimeout(() => setShowStatus(null), 2000);
  };

  const handleResume = () => {
    setIsPaused(false);
    setShowStatus("Session Resumed.");
    setTimeout(() => setShowStatus(null), 2000);
  };

  const handleStop = () => {
    if (!confirm("Are you sure you want to stop the focus session early?")) return;
    
    // Save partially focused session
    saveSession(false);

    setIsActive(false);
    setIsPaused(false);
    setTimeLeft(totalSeconds);
    stopSynth();
    setShowStatus("Session stopped early. Progress saved.");
    setTimeout(() => setShowStatus(null), 4000);
  };

  const handleCompleteTimer = () => {
    saveSession(true);
    setIsActive(false);
    setIsPaused(false);
    setTimeLeft(totalSeconds);
    stopSynth();
    
    // Play alert beep
    try {
      const beepCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = beepCtx.createOscillator();
      const gain = beepCtx.createGain();
      osc.connect(gain);
      gain.connect(beepCtx.destination);
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(0.1, beepCtx.currentTime);
      osc.start();
      osc.stop(beepCtx.currentTime + 0.8);
    } catch(e){}

    alert("✨ Awesome! You completed your focus session! Your academic profile has been updated.");
    setShowStatus("Session Completed successfully!");
    setTimeout(() => setShowStatus(null), 4000);
  };

  // Save session details to Firebase path users/{uid}/focus_sessions
  const saveSession = async (completedStatus: boolean) => {
    const elapsedSeconds = totalSeconds - timeLeft;
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const targetMinutes = Math.round(totalSeconds / 60);
    const finalDuration = completedStatus ? targetMinutes : elapsedMinutes;

    if (finalDuration <= 0) return; // Do not save zero time sessions

    const currentUid = auth?.currentUser?.uid || userEmail.replace(/\./g, '_');
    const startedVal = startedAtRef.current || new Date(Date.now() - (elapsedSeconds * 1000)).toISOString();
    const completedVal = new Date().toISOString();

    const sessionPayload = {
      taskName: taskName.trim() || 'General Studying',
      duration: finalDuration,
      completed: completedStatus,
      startedAt: startedVal,
      completedAt: completedVal
    };

    if (isFirebaseConfigured && db) {
      try {
        await push(ref(db, `users/${currentUid}/focus_sessions`), sessionPayload);
        console.log('[FocusClock] Saved session payload:', sessionPayload);
      } catch (err) {
        console.error('[FocusClock] Error writing focus session to DB:', err);
      }
    } else {
      // Local Mock DB fallback simulation
      try {
        const localKey = 'roomie_mock_focus_sessions';
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        existing.push(sessionPayload);
        localStorage.setItem(localKey, JSON.stringify(existing));
        console.log('[FocusClock] Mock DB Saved session payload:', sessionPayload);
      } catch (err) {
        console.error('[FocusClock] Error writing mock focus session:', err);
      }
    }
  };

  // Render variables
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? String(h).padStart(2, '0') + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Clock Dial angle calculation (percentage of time spent)
  const spentPercent = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const handRotationAngle = spentPercent * 360;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      paddingBottom: '2.5rem',
      alignItems: 'center',
      textAlign: 'center',
      background: 'var(--bg-app, #fdfbf7)',
      width: '100%',
      maxWidth: '850px',
      margin: '0 auto'
    }}>
      
      {/* Tape header banner */}
      <div style={{
        background: '#fed7aa',
        border: '2px solid #0f172a',
        padding: '0.4rem 2rem',
        borderRadius: '4px',
        fontFamily: 'var(--font-heading)',
        fontWeight: 900,
        fontSize: '1.2rem',
        color: '#0f172a',
        boxShadow: '3px 3px 0px #0f172a',
        transform: 'rotate(-1.5deg)',
        marginBottom: '1rem',
        position: 'relative'
      }}>
        FOCUS CLOCK
        {/* Scrapbook pin tapes */}
        <div style={{ position: 'absolute', top: '-10px', left: '10px', width: '20px', height: '12px', background: 'rgba(0,0,0,0.15)', transform: 'rotate(-45deg)' }} />
        <div style={{ position: 'absolute', top: '-10px', right: '10px', width: '20px', height: '12px', background: 'rgba(0,0,0,0.15)', transform: 'rotate(45deg)' }} />
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
          boxShadow: '3px 3px 0px #0f172a'
        }}>
          {showStatus}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2.5rem',
        width: '100%',
        alignItems: 'center',
        padding: '1rem'
      }} className="lobby-grid">

        {/* LEFT COLUMN: Setup Configuration */}
        <div className="glass-panel" style={{
          background: '#ffffff',
          border: '2px solid #0f172a',
          borderRadius: '24px',
          padding: '1.5rem',
          boxShadow: '6px 6px 0px #0f172a',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          textAlign: 'left'
        }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: '0.9rem',
              color: '#0f172a'
            }}>
              🎯 CURRENT STUDY GOAL / TASK
            </label>
            <input
              type="text"
              placeholder="e.g. Java OOP, DBMS Revision, DSA Practice..."
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              disabled={isActive}
              className="cyber-input"
              style={{
                border: '2px solid #0f172a',
                borderRadius: '12px',
                padding: '0.65rem 0.8rem',
                fontWeight: 700,
                background: isActive ? '#f1f5f9' : '#ffffff'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: '0.9rem',
              color: '#0f172a'
            }}>
              ⏱️ SELECT FOCUS DURATION
            </label>
            
            {/* Presets Grid */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePreset(p.h, p.m)}
                  disabled={isActive}
                  className="cyber-btn"
                  style={{
                    flex: '1 1 auto',
                    border: '2px solid #0f172a',
                    background: (hours === p.h && minutes === p.m) ? '#a7f3d0' : '#ffffff',
                    boxShadow: '2px 2px 0px #0f172a',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '8px'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Hours & Minutes wheels */}
            <div style={{
              display: 'flex',
              gap: '0.8rem',
              alignItems: 'center',
              marginTop: '0.4rem'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>Hours</span>
                <select
                  value={hours}
                  onChange={(e) => handlePreset(Number(e.target.value), minutes)}
                  disabled={isActive}
                  className="cyber-input"
                  style={{
                    border: '2px solid #0f172a',
                    borderRadius: '8px',
                    padding: '0.35rem',
                    fontWeight: 700
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map(hVal => (
                    <option key={hVal} value={hVal}>{hVal} hr</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>Minutes</span>
                <select
                  value={minutes}
                  onChange={(e) => handlePreset(hours, Number(e.target.value))}
                  disabled={isActive}
                  className="cyber-input"
                  style={{
                    border: '2px solid #0f172a',
                    borderRadius: '8px',
                    padding: '0.35rem',
                    fontWeight: 700
                  }}
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(mVal => (
                    <option key={mVal} value={mVal}>{mVal} min</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Lofi Synth option */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#e0e7ff',
            border: '2px solid #0f172a',
            borderRadius: '12px',
            padding: '0.75rem 1rem',
            boxShadow: '3px 3px 0px #0f172a',
            marginTop: '0.5rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <strong style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 850 }}>☕ FOCUS CHORD SYNTH</strong>
              <span style={{ fontSize: '0.68rem', color: '#4f46e5', fontWeight: 650 }}>Synthesizes warm study chords & rain waves</span>
            </div>
            <button
              onClick={() => setIsLofiOn(!isLofiOn)}
              className="cyber-btn"
              style={{
                border: '2px solid #0f172a',
                background: isLofiOn ? '#8b5cf6' : '#ffffff',
                color: isLofiOn ? '#ffffff' : '#0f172a',
                borderRadius: '8px',
                fontWeight: 900,
                fontSize: '0.75rem',
                padding: '0.3rem 0.6rem',
                minHeight: 'auto',
                boxShadow: '1px 1px 0px #0f172a'
              }}
            >
              {isLofiOn ? 'ON' : 'OFF'}
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: Cartoon Dial Clock */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem'
        }}>
          
          {/* Circular dial container */}
          <div style={{
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background: '#fffdf8',
            border: '4px solid #0f172a',
            boxShadow: '8px 8px 0px #0f172a',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
          }}>
            
            {/* Paper Texture Overlay */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
              backgroundSize: '12px 12px',
              opacity: 0.25,
              pointerEvents: 'none'
            }} />

            {/* SVG Progress Arc & Indicators */}
            <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
              {/* Outer dial ring */}
              <circle
                cx="110"
                cy="110"
                r="95"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="10"
              />
              {/* Animated Progress path */}
              <circle
                cx="110"
                cy="110"
                r="95"
                fill="none"
                stroke="#6366f1"
                strokeWidth="10"
                strokeDasharray="597"
                strokeDashoffset={597 - (597 * spentPercent)}
                strokeLinecap="round"
                style={{ transition: isActive ? 'stroke-dashoffset 1s linear' : 'stroke-dashoffset 0.3s ease' }}
              />

              {/* Hand-drawn retro hour tick marks */}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
                const rad = (deg * Math.PI) / 180;
                const x1 = 110 + 82 * Math.cos(rad);
                const y1 = 110 + 82 * Math.sin(rad);
                const x2 = 110 + 92 * Math.cos(rad);
                const y2 = 110 + 92 * Math.sin(rad);
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#0f172a"
                    strokeWidth={deg % 90 === 0 ? "3" : "1.5"}
                  />
                );
              })}
            </svg>

            {/* Hand rotating indicator */}
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              transform: `rotate(${handRotationAngle}deg)`,
              transition: isActive && !isPaused ? 'transform 1s linear' : 'transform 0.3s ease',
              pointerEvents: 'none'
            }}>
              {/* Hand Line drawing */}
              <div style={{
                position: 'absolute',
                top: '25px',
                left: 'calc(50% - 2.5px)',
                width: '5px',
                height: '90px',
                background: '#ec4899',
                borderRadius: '99px',
                border: '1.5px solid #0f172a'
              }} />
              {/* Arrow pointer head */}
              <div style={{
                position: 'absolute',
                top: '20px',
                left: 'calc(50% - 5px)',
                width: '10px',
                height: '10px',
                background: '#ec4899',
                border: '1.5px solid #0f172a',
                borderRadius: '50%',
              }} />
            </div>

            {/* Clock center pin */}
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#eab308',
              border: '3px solid #0f172a',
              zIndex: 10,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }} />

            {/* Numeric floating countdown */}
            <div style={{
              position: 'absolute',
              bottom: '50px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 900,
              fontSize: '1.5rem',
              color: '#0f172a',
              background: '#fef08a',
              border: '2px solid #0f172a',
              padding: '0.15rem 0.8rem',
              borderRadius: '8px',
              boxShadow: '2px 2px 0px #0f172a',
              zIndex: 11
            }}>
              {formatTime(timeLeft)}
            </div>

          </div>

          {/* Dials controls */}
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            marginTop: '0.5rem'
          }}>
            {!isActive ? (
              <button
                onClick={handleStart}
                className="cyber-btn pink-fill"
                style={{
                  border: '2px solid #0f172a',
                  boxShadow: '3px 3px 0px #0f172a',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  padding: '0.6rem 1.75rem',
                  borderRadius: '12px'
                }}
              >
                START SESSION
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    onClick={handleResume}
                    className="cyber-btn"
                    style={{
                      border: '2px solid #0f172a',
                      background: '#a7f3d0',
                      boxShadow: '3px 3px 0px #0f172a',
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      padding: '0.6rem 1.25rem',
                      borderRadius: '12px'
                    }}
                  >
                    RESUME
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="cyber-btn"
                    style={{
                      border: '2px solid #0f172a',
                      background: '#fef08a',
                      boxShadow: '3px 3px 0px #0f172a',
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      padding: '0.6rem 1.25rem',
                      borderRadius: '12px'
                    }}
                  >
                    PAUSE
                  </button>
                )}

                <button
                  onClick={handleStop}
                  className="cyber-btn"
                  style={{
                    border: '2px solid #0f172a',
                    background: '#fca5a5',
                    boxShadow: '3px 3px 0px #0f172a',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '12px'
                  }}
                >
                  STOP / RECORD
                </button>
              </>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
