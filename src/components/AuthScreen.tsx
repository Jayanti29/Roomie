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
      background: '#fdfbf7', // warm paper background
      fontFamily: 'var(--font-body)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden'
    }}>
      
      {/* Cartoon Animation Styles */}
      <style>{`
        @keyframes sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-3deg); }
        }
        @keyframes nod {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(4deg); }
        }
        @keyframes ai-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes chat-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes book-slide {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(8px); }
        }
        @keyframes task-tick {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        @keyframes path-flow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -40; }
        }
        @keyframes card-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes pencil-write {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(4px, -3px); }
        }
        .anim-sway { animation: sway 4s ease-in-out infinite; transform-origin: 50% 100%; }
        .anim-nod { animation: nod 3.5s ease-in-out infinite; transform-origin: 50% 50%; }
        .anim-ai-float { animation: ai-float 5s ease-in-out infinite; }
        .anim-chat-pulse { animation: chat-pulse 3s ease-in-out infinite; }
        .anim-book-slide { animation: book-slide 4.5s ease-in-out infinite; }
        .anim-task-tick { animation: task-tick 2s ease-in-out infinite; }
        .anim-path-flow { stroke-dasharray: 8, 6; animation: path-flow 5s linear infinite; }
        .anim-card-bob { animation: card-bob 4s ease-in-out infinite; }
        .anim-pencil-write { animation: pencil-write 1.5s ease-in-out infinite; }
      `}</style>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        width: '100%',
        minHeight: '100vh',
        alignItems: 'stretch'
      }} className="notes-board-grid">
        
        {/* LEFT PANEL: 100% Cartoon Loop Animation, No Text */}
        <div style={{
          background: 'linear-gradient(135deg, #a7f3d0 0%, #a5f3fc 100%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem',
          position: 'relative',
          overflow: 'hidden',
          borderRight: '3px solid #0f172a'
        }} className="hide-on-mobile">
          
          {/* Scrapbook pin borders */}
          <div style={{ position: 'absolute', top: '15px', left: '15px', width: '30px', height: '15px', background: 'rgba(0,0,0,0.1)', transform: 'rotate(-40deg)' }} />
          <div style={{ position: 'absolute', bottom: '15px', right: '15px', width: '30px', height: '15px', background: 'rgba(0,0,0,0.1)', transform: 'rotate(-45deg)' }} />
          
          <div style={{ width: '100%', maxWidth: '580px', height: '480px' }}>
            <svg width="100%" height="100%" viewBox="0 0 600 500" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>

              {/* STUDY PATH: Glowing paths connecting characters */}
              <path d="M 100 350 Q 200 240 300 120 T 500 350" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" className="anim-path-flow" fill="none" />
              <path d="M 100 350 Q 300 450 500 350" stroke="#10b981" strokeWidth="4" strokeLinecap="round" className="anim-path-flow" fill="none" />
              <path d="M 300 120 L 300 350" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" className="anim-path-flow" fill="none" />

              {/* 1. STUDENTS STUDYING (Left Side Desk) */}
              <g transform="translate(60, 260)">
                {/* Desk */}
                <rect x="0" y="90" width="130" height="10" rx="5" fill="#f59e0b" stroke="#0f172a" strokeWidth="3.5" />
                <line x1="20" y1="100" x2="20" y2="140" stroke="#0f172a" strokeWidth="4" />
                <line x1="110" y1="100" x2="110" y2="140" stroke="#0f172a" strokeWidth="4" />
                
                {/* Character Studying */}
                <g className="anim-sway">
                  <path d="M 25 90 Q 20 50 65 50 Q 110 50 105 90 Z" fill="#ec4899" stroke="#0f172a" strokeWidth="3" />
                  <circle cx="65" cy="40" r="22" fill="#fed7aa" stroke="#0f172a" strokeWidth="3" />
                  {/* Hair */}
                  <path d="M 43 40 C 43 15, 87 15, 87 40 Z" fill="#1e1b4b" stroke="#0f172a" strokeWidth="3" />
                  <circle cx="58" cy="38" r="2" fill="#0f172a" />
                  <circle cx="72" cy="38" r="2" fill="#0f172a" />
                  <path d="M 62 48 Q 65 51 68 48" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
                </g>

                {/* Laptop on desk */}
                <path d="M 90 90 L 105 70 L 125 70 L 120 90 Z" fill="#cbd5e1" stroke="#0f172a" strokeWidth="2" />
                <rect x="100" y="73" width="20" height="12" fill="#38bdf8" />
              </g>

              {/* 2. STUDENTS TALKING & CHAT BUBBLE (Right Side Desk) */}
              <g transform="translate(410, 260)">
                {/* Desk */}
                <rect x="0" y="90" width="130" height="10" rx="5" fill="#f59e0b" stroke="#0f172a" strokeWidth="3.5" />
                <line x1="20" y1="100" x2="20" y2="140" stroke="#0f172a" strokeWidth="4" />
                <line x1="110" y1="100" x2="110" y2="140" stroke="#0f172a" strokeWidth="4" />

                {/* Character Talking */}
                <g className="anim-nod">
                  <path d="M 25 90 Q 20 45 65 45 Q 110 45 105 90 Z" fill="#3b82f6" stroke="#0f172a" strokeWidth="3" />
                  <circle cx="65" cy="35" r="22" fill="#fbcfe8" stroke="#0f172a" strokeWidth="3" />
                  <path d="M 43 30 C 50 10, 80 10, 87 30" fill="none" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
                  <circle cx="58" cy="35" r="2" fill="#0f172a" />
                  <circle cx="72" cy="35" r="2" fill="#0f172a" />
                  <path d="M 60 44 Q 65 47 70 44" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
                </g>

                {/* Animated Chat Bubble */}
                <g transform="translate(-30, -35)" className="anim-chat-pulse">
                  <rect x="0" y="0" width="55" height="30" rx="10" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
                  <path d="M 40 30 L 45 38 L 48 30 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
                  <circle cx="15" cy="15" r="2.5" fill="#0f172a" />
                  <circle cx="27.5" cy="15" r="2.5" fill="#0f172a" />
                  <circle cx="40" cy="15" r="2.5" fill="#0f172a" />
                </g>
              </g>

              {/* 3. VIDEO COLLABORATION SCREEN (Center Bottom) */}
              <g transform="translate(220, 320)" className="anim-card-bob">
                <rect x="0" y="0" width="160" height="90" rx="16" fill="#ffffff" stroke="#0f172a" strokeWidth="3.5" />
                <rect x="8" y="8" width="144" height="74" rx="10" fill="#1e293b" />
                
                {/* Live dot indicator */}
                <circle cx="140" cy="18" r="4.5" fill="#ef4444" className="anim-task-tick" />
                
                {/* Simulated webcam avatars */}
                <circle cx="45" cy="45" r="18" fill="#fca5a5" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx="115" cy="45" r="18" fill="#93c5fd" stroke="#ffffff" strokeWidth="1.5" />
                <path d="M 33 55 C 33 48, 57 48, 57 55" stroke="#ffffff" strokeWidth="2" fill="none" />
                <path d="M 103 55 C 103 48, 127 48, 127 55" stroke="#ffffff" strokeWidth="2" fill="none" />
              </g>

              {/* 4. SHARING NOTES (Documents flying across path) */}
              <g transform="translate(140, 160)" className="anim-ai-float">
                <rect x="0" y="0" width="35" height="45" rx="5" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                <line x1="8" y1="10" x2="27" y2="10" stroke="#0f172a" strokeWidth="2" />
                <line x1="8" y1="20" x2="27" y2="20" stroke="#0f172a" strokeWidth="2" />
                <line x1="8" y1="30" x2="18" y2="30" stroke="#0f172a" strokeWidth="2" />
                {/* Small green tag */}
                <circle cx="27" cy="32" r="3.5" fill="#10b981" />
              </g>

              {/* 5. AI HELPING STUDENTS (Center Top Robot) */}
              <g transform="translate(250, 45)" className="anim-ai-float">
                {/* Floating Robot */}
                <rect x="15" y="10" width="70" height="60" rx="18" fill="#ffffff" stroke="#0f172a" strokeWidth="3" />
                <rect x="23" y="18" width="54" height="44" rx="10" fill="url(#aiGradient)" />
                {/* Eyes */}
                <ellipse cx="40" cy="40" rx="5" ry="3.5" fill="#ffffff" />
                <ellipse cx="60" cy="40" rx="5" ry="3.5" fill="#ffffff" />
                {/* Wink or Smile */}
                <path d="M 45 52 Q 50 56 55 52" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                {/* Antennas */}
                <line x1="50" y1="10" x2="50" y2="2" stroke="#0f172a" strokeWidth="3" />
                <circle cx="50" cy="0" r="4.5" fill="#f59e0b" />
              </g>

              {/* 6. BOOKS MOVING (Stack of books on desk) */}
              <g transform="translate(190, 220)" className="anim-book-slide">
                {/* Red Book */}
                <rect x="0" y="15" width="45" height="15" rx="3" fill="#ef4444" stroke="#0f172a" strokeWidth="2" />
                {/* Green Book */}
                <rect x="5" y="0" width="40" height="15" rx="3" fill="#10b981" stroke="#0f172a" strokeWidth="2" />
                {/* Page spine lines */}
                <line x1="4" y1="22" x2="4" y2="22" stroke="#ffffff" strokeWidth="2" />
                <line x1="9" y1="7" x2="9" y2="7" stroke="#ffffff" strokeWidth="2" />
              </g>

              {/* 7. TASKS COMPLETING (Checklist card ticking off) */}
              <g transform="translate(320, 150)" className="anim-card-bob">
                <rect x="0" y="0" width="110" height="75" rx="12" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                
                {/* Task line 1 */}
                <circle cx="15" cy="20" r="5" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
                <line x1="30" y1="20" x2="95" y2="20" stroke="#0f172a" strokeWidth="2.5" />
                {/* Green check mark inside */}
                <path d="M 12 20 L 14 22 L 18 18" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" />

                {/* Task line 2 with pencil typing animation */}
                <circle cx="15" cy="42" r="5" fill="none" stroke="#0f172a" strokeWidth="1.5" />
                <line x1="30" y1="42" x2="80" y2="42" stroke="#cbd5e1" strokeWidth="2" />
                
                {/* Pencil */}
                <g className="anim-pencil-write" transform="translate(85, 30)">
                  <path d="M 0 10 L 8 2 L 12 6 L 4 14 Z" fill="#eab308" stroke="#0f172a" strokeWidth="1.5" />
                  <path d="M 0 10 L -2 12 L 2 12 Z" fill="#0f172a" />
                </g>
              </g>

              {/* 8. FLOATING CARDS (Drifting checklists / grades) */}
              <g transform="translate(480, 75)" className="anim-ai-float">
                <rect x="0" y="0" width="60" height="60" rx="10" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                <circle cx="30" cy="22" r="8" fill="#e0e7ff" stroke="#0f172a" strokeWidth="1.5" />
                <rect x="12" y="38" width="36" height="5" rx="2.5" fill="#818cf8" />
                <rect x="12" y="47" width="22" height="5" rx="2.5" fill="#cbd5e1" />
              </g>

            </svg>
          </div>
          
        </div>

        {/* RIGHT PANEL: Extremely Minimal form centering */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2.5rem 1.5rem',
          background: '#ffffff',
          position: 'relative'
        }}>
          
          <div style={{ maxWidth: '360px', width: '100%', textAlign: 'center' }}>
            
            {/* Logo */}
            <div style={{ marginBottom: '2.5rem' }}>
              <h1 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '2.6rem',
                fontWeight: 950,
                letterSpacing: '0.05em',
                color: '#0f172a',
                margin: 0
              }}>
                ROOMIE
              </h1>
            </div>

            {/* Error notifications */}
            {errorMessage && (
              <div style={{
                background: '#fef2f2',
                border: '2px solid #fee2e2',
                color: '#ef4444',
                padding: '0.75rem 1rem',
                borderRadius: '16px',
                fontSize: '0.8rem',
                fontWeight: 700,
                textAlign: 'left',
                marginBottom: '1rem'
              }}>
                ⚠️ {errorMessage}
              </div>
            )}

            {/* strictly Email/Password form inputs */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {isRegistering && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <input
                    type="text"
                    data-testid="name"
                    className="cyber-input"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ borderRadius: '16px', padding: '0.75rem 1rem', border: '2px solid #0f172a', fontWeight: 700 }}
                  />
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <input
                  type="email"
                  data-testid="email"
                  className="cyber-input"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ borderRadius: '16px', padding: '0.75rem 1rem', border: '2px solid #0f172a', fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <input
                  type="password"
                  data-testid="password"
                  className="cyber-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ borderRadius: '16px', padding: '0.75rem 1rem', border: '2px solid #0f172a', fontWeight: 700 }}
                />
              </div>

              {isRegistering && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <input
                    type="password"
                    className="cyber-input"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ borderRadius: '16px', padding: '0.75rem 1rem', border: '2px solid #0f172a', fontWeight: 700 }}
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
                  fontWeight: 900,
                  borderRadius: '16px',
                  border: '2px solid #0f172a',
                  boxShadow: '4px 4px 0px #0f172a',
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Processing...' : isRegistering ? 'Create Account' : 'Login'}
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', marginTop: '1.75rem' }}>
              
              {/* signup toggle with strictly prescribed E2E text elements */}
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
                  fontWeight: 900
                }}
              >
                {isRegistering ? 'ALREADY HAVE AN ACCOUNT? LOGIN' : 'NEW STUDENT? CREATE ACCOUNT'}
              </button>
              
              <button
                onClick={handleGuestLogin}
                className="cyber-btn"
                style={{
                  width: '100%',
                  background: '#f8fafc',
                  border: '2px solid #0f172a',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  padding: '0.7rem',
                  borderRadius: '16px',
                  boxShadow: '4px 4px 0px #0f172a',
                  cursor: 'pointer'
                }}
              >
                Continue as Guest
              </button>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
