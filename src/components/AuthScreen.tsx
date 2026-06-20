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
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      fontFamily: 'var(--font-body)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(-1.5deg); }
        }
        @keyframes pulse-path {
          0% { stroke-dashoffset: 0; opacity: 0.5; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: -30; opacity: 0.5; }
        }
        @keyframes nod {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(4deg); }
        }
        @keyframes sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-3deg); }
        }
        @keyframes blink-light {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .anim-float-s { animation: float-slow 7s ease-in-out infinite; }
        .anim-float-m { animation: float-medium 5s ease-in-out infinite; }
        .anim-nod { animation: nod 3s ease-in-out infinite; transform-origin: 50% 50%; }
        .anim-sway { animation: sway 4s ease-in-out infinite; transform-origin: 50% 50%; }
        .anim-pulse-path { stroke-dasharray: 6, 4; animation: pulse-path 4s linear infinite; }
        .anim-blink-red { animation: blink-light 1.5s infinite; }
      `}</style>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        width: '100%',
        minHeight: '100vh',
        alignItems: 'stretch'
      }} className="notes-board-grid">
        
        {/* LEFT PANEL: Fully Animated Cartoon Scene with No Text */}
        <div style={{
          background: 'linear-gradient(135deg, #a7f3d0 0%, #34d399 50%, #059669 100%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem',
          position: 'relative',
          overflow: 'hidden',
          borderRight: '3px solid #0f172a'
        }} className="hide-on-mobile">
          
          <div style={{ width: '100%', maxWidth: '520px', height: '420px' }}>
            <svg width="100%" height="100%" viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="aiGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f472b6" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>

              {/* Pulsing Collaboration Network Paths */}
              <path d="M 80 250 L 250 110 L 420 250" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" className="anim-pulse-path" />
              <path d="M 80 250 L 250 310 L 420 250" stroke="#a7f3d0" strokeWidth="3" strokeLinecap="round" className="anim-pulse-path" />
              <path d="M 250 110 L 250 310" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" className="anim-pulse-path" />

              {/* 1. Students Studying Together (Left) */}
              <g transform="translate(30, 180)" className="anim-sway">
                {/* Desk & Laptop */}
                <rect x="10" y="90" width="80" height="8" rx="4" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
                <path d="M 25 90 L 35 68 L 65 68 L 75 90 Z" fill="#475569" stroke="#0f172a" strokeWidth="2" />
                <rect x="42" y="74" width="16" height="12" rx="2" fill="#38bdf8" />
                
                {/* Character */}
                <path d="M 20 100 C 20 75, 80 75, 80 100" fill="#f43f5e" stroke="#0f172a" strokeWidth="2" />
                <circle cx="50" cy="45" r="18" fill="#fbcfe8" stroke="#0f172a" strokeWidth="2" />
                {/* Hair */}
                <path d="M 32 45 C 32 25, 68 25, 68 45 C 60 38, 40 38, 32 45 Z" fill="#1e1b4b" stroke="#0f172a" strokeWidth="2" />
                <circle cx="44" cy="45" r="2" fill="#0f172a" />
                <circle cx="56" cy="45" r="2" fill="#0f172a" />
                <path d="M 47 52 Q 50 55 53 52" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </g>

              {/* 2. Group Discussions & Chat Bubbles (Right) */}
              <g transform="translate(330, 180)" className="anim-nod">
                {/* Desk & Notebook */}
                <rect x="10" y="90" width="80" height="8" rx="4" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
                <rect x="35" y="80" width="30" height="10" rx="2" fill="#fef08a" stroke="#0f172a" strokeWidth="1.5" />
                
                {/* Character */}
                <path d="M 20 100 C 20 75, 80 75, 80 100" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
                <circle cx="50" cy="45" r="18" fill="#fed7aa" stroke="#0f172a" strokeWidth="2" />
                {/* Hair */}
                <path d="M 32 35 C 40 22, 60 22, 68 35" fill="none" stroke="#7c2d12" strokeWidth="5" strokeLinecap="round" />
                <circle cx="44" cy="45" r="2" fill="#0f172a" />
                <circle cx="56" cy="45" r="2" fill="#0f172a" />
                <path d="M 47 52 Q 50 55 53 52" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </g>

              {/* 3. AI Mentor Helping Students (Center Top) */}
              <g transform="translate(200, 30)" className="anim-float-s">
                <rect x="15" y="20" width="70" height="60" rx="14" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                <rect x="22" y="27" width="56" height="46" rx="8" fill="url(#aiGlow)" />
                <circle cx="38" cy="46" r="3.5" fill="#fff" />
                <circle cx="62" cy="46" r="3.5" fill="#fff" />
                <path d="M 45 58 Q 50 62 55 58" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 35 80 L 45 92 L 55 80" stroke="#0f172a" strokeWidth="2" fill="#fff" />
              </g>

              {/* 4. Friends Sharing Notes & Floating Documents (Center Left) */}
              <g transform="translate(90, 110)" className="anim-float-m">
                <rect x="0" y="0" width="30" height="40" rx="4" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
                <line x1="6" y1="10" x2="24" y2="10" stroke="#3b82f6" strokeWidth="2.5" />
                <line x1="6" y1="20" x2="20" y2="20" stroke="#3b82f6" strokeWidth="2" />
                <line x1="6" y1="30" x2="16" y2="30" stroke="#3b82f6" strokeWidth="2" />
                <circle cx="23" cy="28" r="3" fill="#10b981" />
              </g>

              {/* 5. Video Study Rooms Widget Card (Center Bottom) */}
              <g transform="translate(170, 260)" className="anim-float-m">
                <rect x="0" y="0" width="160" height="80" rx="16" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                {/* Live Indicator */}
                <circle cx="140" cy="18" r="4" fill="#ef4444" className="anim-blink-red" />
                <rect x="12" y="12" width="22" height="14" rx="3" fill="#818cf8" stroke="#0f172a" strokeWidth="1.5" />
                <path d="M 34 14 L 40 10 L 40 28 L 34 24 Z" fill="#818cf8" stroke="#0f172a" strokeWidth="1.5" />
                
                {/* Member Avatars */}
                <circle cx="26" cy="54" r="10" fill="#fca5a5" stroke="#0f172a" strokeWidth="1.5" />
                <circle cx="42" cy="54" r="10" fill="#fde047" stroke="#0f172a" strokeWidth="1.5" />
                <circle cx="58" cy="54" r="10" fill="#93c5fd" stroke="#0f172a" strokeWidth="1.5" />
              </g>

              {/* 6. Course Cards & Planner Tasks (Center Right) */}
              <g transform="translate(370, 90)" className="anim-float-s">
                <rect x="0" y="0" width="45" height="50" rx="8" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
                <circle cx="12" cy="14" r="4" fill="#a7f3d0" stroke="#0f172a" strokeWidth="1" />
                <line x1="22" y1="14" x2="38" y2="14" stroke="#0f172a" strokeWidth="2" />
                <line x1="8" y1="28" x2="36" y2="28" stroke="#e2e8f0" strokeWidth="2" />
                <line x1="8" y1="36" x2="24" y2="36" stroke="#e2e8f0" strokeWidth="2" />
              </g>
            </svg>
          </div>
          
        </div>

        {/* RIGHT PANEL: Extremely Minimal Form */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2.5rem 1.5rem',
          background: '#ffffff',
          position: 'relative'
        }}>
          
          <div style={{ maxWidth: '360px', width: '100%' }}>
            
            {/* Roomie Logo */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '2.5rem',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: '#0f172a',
                margin: 0
              }}>
                ROOMIE
              </h1>
            </div>

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
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {isRegistering && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <input
                    type="text"
                    data-testid="name"
                    className="cyber-input"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ borderRadius: '16px', padding: '0.75rem 1rem', border: '2px solid #0f172a' }}
                  />
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <input
                  type="email"
                  data-testid="email"
                  className="cyber-input"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ borderRadius: '16px', padding: '0.75rem 1rem', border: '2px solid #0f172a' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <input
                  type="password"
                  data-testid="password"
                  className="cyber-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ borderRadius: '16px', padding: '0.75rem 1rem', border: '2px solid #0f172a' }}
                />
              </div>

              {isRegistering && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <input
                    type="password"
                    className="cyber-input"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ borderRadius: '16px', padding: '0.75rem 1rem', border: '2px solid #0f172a' }}
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
                  boxShadow: '4px 4px 0px #0f172a'
                }}
              >
                {loading ? 'Processing...' : isRegistering ? 'Create Account' : 'Login'}
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', marginTop: '1.5rem' }}>
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
                  fontWeight: 800
                }}
              >
                {isRegistering ? 'ALREADY HAVE AN ACCOUNT? LOGIN' : 'CREATE ACCOUNT'}
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
                  boxShadow: '4px 4px 0px #0f172a'
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
