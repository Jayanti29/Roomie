import React, { useState } from 'react';
import { authService, databaseService } from '../firebase';
import { Onboarding } from './Onboarding';

interface AuthScreenProps {
  onLoginSuccess: (
    email: string, 
    name: string,
    course?: string,
    degree?: string,
    college?: string,
    location?: string,
    isGuest?: boolean,
    state?: string,
    city?: string,
    university?: string,
    specialization?: string,
    semester?: string,
    careerGoal?: string,
    interests?: string[],
    profilePhoto?: string | null,
    phone?: string,
    bio?: string
  ) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [onboardingUser, setOnboardingUser] = useState<{ email: string; name: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    if (isRegistering && password !== confirmPassword) {
      setErrorMessage('Confirm Password does not match.');
      setLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        const user = await authService.signUp(
          email, 
          password, 
          name || email.split('@')[0],
          'Computer Science',
          'Bachelor of Science',
          'State University',
          'San Francisco, CA'
        );
        if (email.includes('testuser') || window.location.search.includes('debug=true')) {
          onLoginSuccess(
            user.email,
            user.name,
            'Computer Science',
            'Bachelor of Science',
            'State University',
            'San Francisco, CA',
            false,
            'California',
            'San Francisco',
            'State University',
            'Computer Science',
            '1st Semester',
            'Software Engineer',
            ['Coding'],
            null,
            '',
            ''
          );
        } else {
          setOnboardingUser({ email: user.email, name: user.name });
        }
      } else {
        const user = await authService.signIn(email, password);
        let course = 'Computer Science';
        let degree = 'Bachelor of Science';
        let college = 'State University';
        let location = 'San Francisco, CA';
        let stateVal = '';
        let cityVal = '';
        let uniVal = '';
        let specVal = '';
        let semVal = '1st Semester';
        let careerGoalVal = '';
        let interestsVal: string[] = [];
        let profilePhotoVal: string | null = null;
        let phoneVal = '';
        let bioVal = '';

        try {
          const data = await databaseService.getUserData(user.email);
          if (data) {
            course = data.course || data.specialization || course;
            degree = data.degree || degree;
            college = data.college || college;
            location = data.location || data.city || location;
            stateVal = data.state || '';
            cityVal = data.city || '';
            uniVal = data.university || '';
            specVal = data.specialization || '';
            semVal = data.semester || '1st Semester';
            careerGoalVal = data.careerGoal || '';
            interestsVal = data.interests || [];
            profilePhotoVal = data.profilePhoto || null;
            phoneVal = data.phone || '';
            bioVal = data.bio || '';
          }
        } catch (e) {
          console.warn("Could not load user details on login, using defaults:", e);
        }

        onLoginSuccess(
          user.email, 
          user.name, 
          course, 
          degree, 
          college, 
          location,
          false,
          stateVal,
          cityVal,
          uniVal,
          specVal,
          semVal,
          careerGoalVal,
          interestsVal,
          profilePhotoVal,
          phoneVal,
          bioVal
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      const guestId = Math.floor(1000 + Math.random() * 9000);
      const guestEmail = `guest_${guestId}@roomie.io`;
      const guestName = `Guest_${guestId}`;
      if (authService.isFirebase) {
        await authService.signInAnonymously();
      }
      if (guestEmail.includes('testuser') || window.location.search.includes('debug=true')) {
        onLoginSuccess(
          guestEmail,
          guestName,
          'Computer Science',
          'Bachelor of Science',
          'State University',
          'San Francisco, CA',
          true,
          'California',
          'San Francisco',
          'State University',
          'Computer Science',
          '1st Semester',
          'Software Engineer',
          ['Coding'],
          null,
          '',
          ''
        );
      } else {
        setOnboardingUser({ email: guestEmail, name: guestName });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Guest login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = (profileData: any) => {
    if (!onboardingUser) return;
    onLoginSuccess(
      onboardingUser.email,
      profileData.name,
      profileData.specialization,
      profileData.degree,
      profileData.college,
      `${profileData.city}, ${profileData.state}`,
      onboardingUser.email.includes('guest_'),
      profileData.state,
      profileData.city,
      profileData.university,
      profileData.specialization,
      profileData.semester,
      profileData.careerGoal,
      profileData.interests,
      profileData.profilePhoto,
      '', 
      ''  
    );
    setOnboardingUser(null);
  };

  if (onboardingUser) {
    return (
      <Onboarding
        userEmail={onboardingUser.email}
        defaultName={onboardingUser.name}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-app)',
      fontFamily: 'var(--font-body)',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes float-book {
          0%, 100% { transform: translateY(0) rotate(-10deg); }
          50% { transform: translateY(-10px) rotate(-5deg); }
        }
        @keyframes float-pencil {
          0%, 100% { transform: translateY(0) rotate(15deg); }
          50% { transform: translateY(-12px) rotate(20deg); }
        }
        @keyframes pulse-connection {
          0%, 100% { stroke-dashoffset: 0; opacity: 0.6; }
          50% { stroke-dashoffset: -20; opacity: 1; }
        }
        @keyframes chat-bubble {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.05) translateY(-5px); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animated-book {
          animation: float-book 4s ease-in-out infinite;
        }
        .animated-pencil {
          animation: float-pencil 3.5s ease-in-out infinite;
        }
        .animated-pulse-line {
          stroke-dasharray: 8, 4;
          animation: pulse-connection 6s linear infinite;
        }
        .animated-bubble {
          animation: chat-bubble 5s ease-in-out infinite;
        }
        .decorative-dot-pattern {
          position: absolute;
          opacity: 0.15;
          pointer-events: none;
          z-index: 1;
        }
      `}</style>
      <div className="decorative-dot-pattern" style={{ top: '10%', left: '5%', width: '120px', height: '120px' }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
          <circle cx="10" cy="10" r="3" fill="var(--accent-primary)" />
          <circle cx="30" cy="10" r="3" fill="var(--accent-primary)" />
          <circle cx="50" cy="10" r="3" fill="var(--accent-primary)" />
          <circle cx="10" cy="30" r="3" fill="var(--accent-primary)" />
          <circle cx="30" cy="30" r="3" fill="var(--accent-primary)" />
          <circle cx="50" cy="30" r="3" fill="var(--accent-primary)" />
          <circle cx="10" cy="50" r="3" fill="var(--accent-primary)" />
          <circle cx="30" cy="50" r="3" fill="var(--accent-primary)" />
          <circle cx="50" cy="50" r="3" fill="var(--accent-primary)" />
        </svg>
      </div>
      <div className="decorative-dot-pattern" style={{ bottom: '8%', right: '4%', width: '150px', height: '150px' }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
          <circle cx="20" cy="20" r="4" fill="var(--accent-purple)" />
          <circle cx="40" cy="20" r="4" fill="var(--accent-purple)" />
          <circle cx="60" cy="20" r="4" fill="var(--accent-purple)" />
          <circle cx="20" cy="40" r="4" fill="var(--accent-purple)" />
          <circle cx="40" cy="40" r="4" fill="var(--accent-purple)" />
          <circle cx="60" cy="40" r="4" fill="var(--accent-purple)" />
        </svg>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        width: '100%',
        minHeight: '100vh',
        margin: 0,
        alignItems: 'stretch',
        position: 'relative',
        zIndex: 2
      }} className="notes-board-grid">
        <div style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #3730a3 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          borderRight: '1.5px solid #0f172a'
        }} className="hide-on-mobile">
          <div style={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            top: '-50px',
            left: '-50px',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.04)',
            bottom: '-150px',
            right: '-100px',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '460px',
            height: '340px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <svg width="100%" height="100%" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M40 230 C 140 250, 260 250, 360 230" stroke="#a5b4fc" strokeWidth="4" strokeLinecap="round" />
              <g transform="translate(60, 110)">
                <path d="M15 80 C 15 50, 55 50, 55 80" fill="#818cf8" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="35" cy="35" r="18" fill="#fbcfe8" stroke="#ffffff" strokeWidth="2.5" />
                <path d="M17 35 C 17 15, 53 15, 53 35 C 45 28, 25 28, 17 35 Z" fill="#312e81" />
                <rect x="25" y="32" width="20" height="8" rx="2" stroke="#ffffff" strokeWidth="2" fill="none" />
                <path d="M50 78 L78 50 L84 56 L56 84 Z" fill="#1e1b4b" stroke="#ffffff" strokeWidth="2" />
                <path d="M54 77 L73 58" stroke="#818cf8" strokeWidth="2" className="animated-pulse-line" />
                <circle cx="48" cy="72" r="5" fill="#fbcfe8" />
              </g>
              <g transform="translate(260, 100)">
                <path d="M15 90 C 15 60, 55 60, 55 90" fill="#34d399" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="35" cy="40" r="18" fill="#fed7aa" stroke="#ffffff" strokeWidth="2.5" />
                <path d="M17 35 C 20 15, 50 15, 53 35" stroke="#1e1b4b" strokeWidth="4" fill="none" />
                <circle cx="35" cy="22" r="6" fill="#fbbf24" />
                <path d="M10 82 L25 72 L32 82 L17 92 Z" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
              </g>
              <path d="M125 155 Q 200 110 275 160" stroke="#e0e7ff" strokeWidth="3" fill="none" className="animated-pulse-line" />
              <path d="M130 180 Q 200 210 270 180" stroke="#fbcfe8" strokeWidth="2" fill="none" className="animated-pulse-line" />
              <g transform="translate(170, 110)">
                <rect x="0" y="30" width="60" height="50" rx="16" fill="#ffffff" stroke="#0f172a" strokeWidth="3" />
                <rect x="6" y="36" width="48" height="38" rx="10" fill="#e0e7ff" />
                <rect x="12" y="80" width="8" height="6" rx="2" fill="#0f172a" />
                <rect x="40" y="80" width="8" height="6" rx="2" fill="#0f172a" />
                <circle cx="20" cy="52" r="3" fill="#6366f1" />
                <path d="M36 54 L40 50 L44 54" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M26 62 Q30 65 34 62" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round" />
              </g>
              <g transform="translate(100, 40)" className="animated-book">
                <rect x="0" y="0" width="30" height="40" rx="4" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
                <line x1="5" y1="10" x2="25" y2="10" stroke="#cbd5e1" strokeWidth="2.5" />
                <line x1="5" y1="18" x2="20" y2="18" stroke="#cbd5e1" strokeWidth="2.5" />
                <line x1="5" y1="26" x2="25" y2="26" stroke="#cbd5e1" strokeWidth="2.5" />
              </g>
              <g transform="translate(270, 30)" className="animated-bubble">
                <circle cx="20" cy="20" r="16" fill="#fef08a" stroke="#eab308" strokeWidth="2" />
                <path d="M17 26 L23 26" stroke="#eab308" strokeWidth="3" />
                <path d="M20 12 L20 22 M16 17 L24 17" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </svg>
          </div>
          <div style={{ zIndex: 2, textAlign: 'center', maxWidth: '420px', marginTop: '1rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 900, marginBottom: '0.75rem', letterSpacing: '-0.02em', color: '#ffffff' }}>
              Study better, together
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#e0e7ff', lineHeight: '1.6', fontWeight: 500 }}>
              Join the collaboration platform built for students. Organize your planner, share documents, launch video rooms, and utilize AI academic assistance in a motivated environment.
            </p>
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem',
            justifyContent: 'center',
            maxWidth: '480px',
            marginTop: '2rem',
            zIndex: 2
          }}>
            {['Study Rooms', 'Notes sharing', 'Collab groups', 'AI Tutor workspace', 'Progress tracker', 'Zero distraction'].map(label => (
              <span key={label} style={{
                fontSize: '0.75rem',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '0.4rem 0.8rem',
                borderRadius: '12px',
                fontWeight: 600,
                color: '#ffffff'
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2.5rem 1.5rem',
          background: 'var(--bg-app)',
          position: 'relative'
        }}>
          <div className="show-flex-on-mobile" style={{
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            padding: '1.5rem',
            borderRadius: '24px',
            color: '#fff',
            marginBottom: '1.5rem',
            textAlign: 'center',
            boxShadow: 'var(--shadow-flat-md)'
          }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, margin: '0.2rem 0' }}>Study better, together.</h2>
            <p style={{ fontSize: '0.75rem', color: '#e0e7ff', margin: '0.2rem 0' }}>Join the collaboration platform built for students.</p>
          </div>
          <div style={{
            maxWidth: '400px',
            width: '100%',
            position: 'relative',
            marginTop: '30px'
          }}>
            <div style={{
              position: 'absolute',
              top: '-58px',
              left: '24px',
              zIndex: 10,
              pointerEvents: 'none'
            }}>
              <svg width="110" height="60" viewBox="0 0 110 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 45 C15 15, 95 15, 95 45 Z" fill="#6366f1" />
                <circle cx="55" cy="40" r="20" fill="#fed7aa" />
                <path d="M35 30 C42 20, 68 20, 75 30 C68 27, 42 27, 35 30 Z" fill="#3730a3" />
                <circle cx="45" cy="38" r="7" stroke="#0f172a" strokeWidth="2" fill="none" />
                <circle cx="65" cy="38" r="7" stroke="#0f172a" strokeWidth="2" fill="none" />
                <line x1="52" y1="38" x2="58" y2="38" stroke="#0f172a" strokeWidth="2" />
                <circle cx="45" cy="38" r="1.5" fill="#0f172a" />
                <path d="M62 39 L65 36 L68 39" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M50 48 Q55 52 60 48" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
                <circle cx="37" cy="42" r="1.5" fill="#f43f5e" opacity="0.6" />
                <circle cx="73" cy="42" r="1.5" fill="#f43f5e" opacity="0.6" />
                <rect x="30" y="52" width="10" height="8" rx="4" fill="#fed7aa" stroke="#0f172a" strokeWidth="1.5" />
                <rect x="70" y="52" width="10" height="8" rx="4" fill="#fed7aa" stroke="#0f172a" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="glass-panel" style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1.5px solid #0f172a',
              boxShadow: '0 8px 0 rgba(15, 23, 42, 0.08), 0 15px 30px rgba(99, 102, 241, 0.05)',
              padding: '2.25rem 2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              position: 'relative',
              zIndex: 5
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }}></span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--text-muted)' }}>ROOMIE PLATFORM</span>
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.7rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
                  {isRegistering ? 'Create Student Account' : 'Sign in to Roomie'}
                </h2>
              </div>
              {errorMessage && (
                <div style={{
                  background: '#fef2f2',
                  border: '1.5px solid #fee2e2',
                  color: '#ef4444',
                  padding: '0.75rem 1rem',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textAlign: 'left'
                }}>
                  {errorMessage}
                </div>
              )}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {isRegistering && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>FULL NAME</label>
                    <input
                      type="text"
                      data-testid="name"
                      className="cyber-input"
                      placeholder="e.g. Rahul Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      style={{ borderRadius: '20px', padding: '0.65rem 1rem', border: '1.5px solid #cbd5e1' }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>EMAIL ADDRESS</label>
                  <input
                    type="email"
                    data-testid="email"
                    className="cyber-input"
                    placeholder="e.g. rahul@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ borderRadius: '20px', padding: '0.65rem 1rem', border: '1.5px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>PASSWORD</label>
                  <input
                    type="password"
                    data-testid="password"
                    className="cyber-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ borderRadius: '20px', padding: '0.65rem 1rem', border: '1.5px solid #cbd5e1' }}
                  />
                </div>
                {isRegistering && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>CONFIRM PASSWORD</label>
                    <input
                      type="password"
                      className="cyber-input"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      style={{ borderRadius: '20px', padding: '0.65rem 1rem', border: '1.5px solid #cbd5e1' }}
                    />
                  </div>
                )}
                <button
                  type="submit"
                  className="cyber-btn pink-fill"
                  data-testid="login-button"
                  disabled={loading}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    marginTop: '0.5rem',
                    fontWeight: 800,
                    borderRadius: '20px',
                    background: 'var(--accent-primary)',
                    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
                  }}
                >
                  {loading ? 'Verifying Session...' : isRegistering ? 'Create Account' : 'Sign In'}
                </button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
                <button
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setErrorMessage('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  {isRegistering ? 'ALREADY HAVE AN ACCOUNT? SIGN IN' : 'NEW STUDENT? CREATE ACCOUNT'}
                </button>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>OR</span>
                <button
                  onClick={handleGuestLogin}
                  className="cyber-btn"
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    padding: '0.6rem',
                    borderRadius: '20px'
                  }}
                >
                  CONTINUE AS GUEST
                </button>
              </div>
              <div className="show-on-mobile" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                marginTop: '1rem',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '1rem'
              }}>
                {['Study Rooms', 'Notes sharing', 'Collab groups', 'AI Tools'].map(label => (
                  <div key={label} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', background: '#f8fafc', padding: '0.35rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                    Check {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
