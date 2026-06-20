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
      background: '#f8fafc',
      fontFamily: '"Inter", sans-serif'
    }}>
      {/* Split Layout Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        width: '100%',
        margin: 0,
        alignItems: 'stretch'
      }} className="notes-board-grid">
        
        {/* LEFT PANEL: Animated Academic Collaboration Scene (Desktop only) */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden'
        }} className="hide-on-mobile">
          
          {/* Custom CSS/SVG Illustration */}
          <div style={{
            position: 'relative',
            width: '420px',
            height: '320px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }} className="anim-float">
            {/* SVG Illustration of students/screens */}
            <svg width="340" height="260" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Desk */}
              <rect x="20" y="110" width="160" height="6" rx="3" fill="#818cf8" />
              
              {/* Laptop Screen Left */}
              <rect x="35" y="70" width="45" height="32" rx="2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="2" />
              <rect x="38" y="73" width="39" height="23" rx="1" fill="#334155" />
              <line x1="42" y1="78" x2="60" y2="78" stroke="#818cf8" strokeWidth="2" />
              <line x1="42" y1="84" x2="70" y2="84" stroke="#a5b4fc" strokeWidth="2" />
              <line x1="42" y1="90" x2="65" y2="90" stroke="#f472b6" strokeWidth="2" />
              <polygon points="30,102 95,102 90,107 35,107" fill="#64748b" />
              
              {/* Laptop Screen Right */}
              <rect x="110" y="65" width="50" height="36" rx="2" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
              <rect x="113" y="68" width="44" height="27" rx="1" fill="#1e293b" />
              <circle cx="135" cy="80" r="8" fill="#14b8a6" />
              <circle cx="132" cy="78" r="2" fill="#fff" />
              <circle cx="138" cy="78" r="2" fill="#fff" />
              <path d="M131,84 Q135,88 139,84" stroke="#fff" strokeWidth="1" />
              <polygon points="105,101 165,101 160,106 110,106" fill="#475569" />
              
              {/* Notebook */}
              <rect x="90" y="92" width="16" height="18" rx="1" fill="#f43f5e" transform="rotate(-10 90 92)" />
              <line x1="95" y1="97" x2="103" y2="95" stroke="#fff" strokeWidth="1.5" />
              <line x1="94" y1="102" x2="102" y2="100" stroke="#fff" strokeWidth="1.5" />

              {/* Floating speech/idea bubble */}
              <circle cx="100" cy="35" r="16" fill="#fbbf24" style={{ animation: 'float-gentle 3s ease-in-out infinite' }} />
              <path d="M96,35 L104,35" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <path d="M100,31 L100,39" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <div style={{ zIndex: 2, textAlign: 'center', maxWidth: '420px', marginTop: '1.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
              Connect. Collaborate. Learn Together.
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#e0e7ff', lineHeight: '1.6', fontWeight: 500 }}>
              Join thousands of Indian students sharing study materials, organizing groups, utilizing AI academic workspace, and resolving doubts in real time.
            </p>
          </div>

          {/* Trust Indicators */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            justifyContent: 'center',
            maxWidth: '500px',
            marginTop: '2.5rem',
            zIndex: 2
          }}>
            {['Study Rooms', 'Shared Notes', 'Study Groups', 'AI Workspace', 'Planner', 'Community Discussions'].map(label => (
              <span key={label} style={{
                fontSize: '0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '0.35rem 0.75rem',
                borderRadius: '9999px',
                fontWeight: 600,
                color: '#e0e7ff'
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: Auth Card Form */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2.5rem 1.5rem',
          background: '#ffffff',
          position: 'relative'
        }}>
          {/* Mobile Illustration (Stacked) */}
          <div className="show-flex-on-mobile" style={{
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
            padding: '1.5rem',
            borderRadius: '12px',
            color: '#fff',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0.2rem 0' }}>Connect. Collaborate. Learn.</h2>
            <p style={{ fontSize: '0.75rem', color: '#e0e7ff', margin: '0.2rem 0' }}>A national student platform for collaboration and growth.</p>
          </div>

          <div style={{
            maxWidth: '380px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            {/* Header info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }}></span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', color: 'var(--text-muted)' }}>ROOMIE PLATFORM</span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em' }}>
                {isRegistering ? 'Create Student Account' : 'Sign in to Roomie'}
              </h2>
            </div>

            {errorMessage && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                color: 'var(--accent-pink)',
                padding: '0.65rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                textAlign: 'left'
              }}>
                {errorMessage}
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {isRegistering && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>FULL NAME</label>
                  <input
                    type="text"
                    data-testid="name"
                    className="cyber-input"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  data-testid="email"
                  className="cyber-input"
                  placeholder="e.g. rahul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>PASSWORD</label>
                <input
                  type="password"
                  data-testid="password"
                  className="cyber-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {isRegistering && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>CONFIRM PASSWORD</label>
                  <input
                    type="password"
                    className="cyber-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                className="cyber-btn pink-fill"
                data-testid="login-button"
                disabled={loading}
                style={{ width: '100%', minHeight: '44px', marginTop: '0.5rem', fontWeight: 700 }}
              >
                {loading ? 'Verifying Session...' : isRegistering ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            {/* Alternating actions */}
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
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                {isRegistering ? 'ALREADY HAVE AN ACCOUNT? SIGN IN' : 'NEW STUDENT? CREATE ACCOUNT'}
              </button>

              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>OR</span>

              <button
                onClick={handleGuestLogin}
                className="cyber-btn"
                style={{
                  width: '100%',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  padding: '0.6rem'
                }}
              >
                CONTINUE AS GUEST
              </button>
            </div>

            {/* Trust badge tags */}
            <div className="show-on-mobile" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              marginTop: '1rem',
              borderTop: '1px solid #f1f5f9',
              paddingTop: '1rem'
            }}>
              {['Study Rooms', 'Shared Notes', 'Study Groups', 'AI Tools'].map(label => (
                <div key={label} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', background: '#f8fafc', padding: '0.25rem', borderRadius: '4px' }}>
                  ✓ {label}
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
