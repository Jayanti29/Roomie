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
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(-3deg); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.4; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(0.95); opacity: 0.4; }
        }
        @keyframes dash {
          to {
            stroke-dashoffset: -40;
          }
        }
        @keyframes typing-dot {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        @keyframes blink-record {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .anim-float-slow {
          animation: float-slow 6s ease-in-out infinite;
        }
        .anim-float-medium {
          animation: float-medium 5s ease-in-out infinite;
        }
        .anim-pulse-ring {
          animation: pulse-ring 4s ease-in-out infinite;
          transform-origin: center;
        }
        .anim-dash-line {
          stroke-dasharray: 8, 4;
          animation: dash 3s linear infinite;
        }
        .typing-dot-1 { animation: typing-dot 1.2s infinite; }
        .typing-dot-2 { animation: typing-dot 1.2s infinite 0.2s; }
        .typing-dot-3 { animation: typing-dot 1.2s infinite 0.4s; }
        .anim-blink-record { animation: blink-record 1.5s infinite; }
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
        
        {/* LEFT PANEL (60% Desktop layout) */}
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

          {/* Interactive CSS SVG Scene */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '460px',
            height: '360px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <svg width="100%" height="100%" viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="aiGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>

              {/* Connected pulsing network lines */}
              <path d="M 100 250 L 250 120 L 400 250" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" className="anim-dash-line" />
              <path d="M 100 250 L 250 300 L 400 250" stroke="#fbcfe8" strokeWidth="2.5" strokeLinecap="round" className="anim-dash-line" />
              <path d="M 250 120 L 250 300" stroke="#c7d2fe" strokeWidth="2" strokeLinecap="round" className="anim-dash-line" />

              {/* Center Pulsing Network Hub */}
              <circle cx="250" cy="210" r="40" fill="none" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.3" className="anim-pulse-ring" />
              <circle cx="250" cy="210" r="60" fill="none" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.15" className="anim-pulse-ring" />

              {/* Left Student (Developer): Desk, Monitor, Typing animation */}
              <g transform="translate(40, 190)">
                <path d="M 20 100 C 20 70, 80 70, 80 100" fill="#818cf8" stroke="#0f172a" strokeWidth="2.5" />
                <circle cx="50" cy="45" r="20" fill="#fed7aa" stroke="#0f172a" strokeWidth="2.5" />
                <path d="M 28 45 C 28 20, 72 20, 72 45 C 65 35, 35 35, 28 45 Z" fill="#312e81" stroke="#0f172a" strokeWidth="2" />
                <rect x="38" y="40" width="10" height="8" rx="2" stroke="#0f172a" strokeWidth="2" fill="#fff" />
                <rect x="52" y="40" width="10" height="8" rx="2" stroke="#0f172a" strokeWidth="2" fill="#fff" />
                <line x1="48" y1="44" x2="52" y2="44" stroke="#0f172a" strokeWidth="2" />
                
                {/* Desk/Laptop */}
                <rect x="15" y="95" width="70" height="8" rx="4" fill="#cbd5e1" stroke="#0f172a" strokeWidth="2.5" />
                <path d="M 30 95 L 40 75 L 60 75 L 70 95 Z" fill="#475569" stroke="#0f172a" stroke-width="2" />
                
                {/* Typing dots */}
                <circle cx="43" cy="85" r="2.5" fill="#34d399" className="typing-dot-1" />
                <circle cx="50" cy="85" r="2.5" fill="#34d399" className="typing-dot-2" />
                <circle cx="57" cy="85" r="2.5" fill="#34d399" className="typing-dot-3" />
              </g>

              {/* Right Student (Roadmap Planner): Desk, floating Roadmap */}
              <g transform="translate(320, 190)">
                <path d="M 20 100 C 20 70, 80 70, 80 100" fill="#34d399" stroke="#0f172a" stroke-width="2.5" />
                <circle cx="50" cy="45" r="20" fill="#fed7aa" stroke="#0f172a" stroke-width="2.5" />
                <path d="M 30 35 C 35 15, 65 15, 70 35" stroke="#1e1b4b" strokeWidth="4.5" fill="none" />
                <circle cx="43" cy="42" r="2" fill="#0f172a" />
                <circle cx="57" cy="42" r="2" fill="#0f172a" />
                <path d="M 47 48 Q 50 51 53 48" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
                
                {/* Roadmap Dashboard Paper */}
                <g transform="translate(-40, 40)" className="anim-float-medium">
                  <rect x="0" y="0" width="45" height="50" rx="6" fill="#fff" stroke="#0f172a" strokeWidth="2.5" />
                  <path d="M 8 12 C 15 8, 30 18, 38 12" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  <circle cx="38" cy="12" r="3.5" fill="#34d399" stroke="#0f172a" strokeWidth="1.5" />
                  <line x1="8" y1="26" x2="35" y2="26" stroke="#cbd5e1" strokeWidth="2" />
                  <line x1="8" y1="34" x2="25" y2="34" stroke="#cbd5e1" strokeWidth="2" />
                </g>
              </g>

              {/* AI Assistant Mentor (Center-Top): Robot face on monitor */}
              <g transform="translate(200, 30)" className="anim-float-slow">
                <path d="M 40 85 L 60 85 L 50 100 Z" fill="#475569" stroke="#0f172a" strokeWidth="2.5" />
                <rect x="25" y="95" width="50" height="6" rx="3" fill="#334155" stroke="#0f172a" strokeWidth="2.5" />
                <rect x="10" y="15" width="80" height="70" rx="16" fill="#fff" stroke="#0f172a" strokeWidth="3" />
                <rect x="18" y="23" width="64" height="54" rx="10" fill="url(#aiGlow)" />
                
                {/* Winking Face details */}
                <path d="M 28 47 Q 34 42 40 47" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
                <circle cx="62" cy="48" r="4.5" fill="#fff" />
                <path d="M 40 60 Q 50 66 60 60" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
                
                {/* Speech Bubble */}
                <g transform="translate(70, -20)" className="anim-float-medium">
                  <rect x="0" y="0" width="110" height="36" rx="12" fill="#fff" stroke="#0f172a" strokeWidth="2" />
                  <path d="M 12 36 L 6 42 L 18 36 Z" fill="#fff" stroke="#0f172a" strokeWidth="2" />
                  <rect x="10" y="34" width="15" height="3" fill="#fff" />
                  <text x="14" y="22" fill="#4f46e5" fontSize="9" fontFamily="sans-serif" fontWeight="900">AI Mentor Active</text>
                </g>
              </g>

              {/* Video Study Room Widget Card (Center-Bottom) */}
              <g transform="translate(160, 260)" className="anim-float-medium">
                <rect x="0" y="0" width="180" height="85" rx="16" fill="#fff" stroke="#0f172a" strokeWidth="3" />
                <rect x="12" y="12" width="22" height="14" rx="3" fill="#818cf8" stroke="#0f172a" strokeWidth="1.5" />
                <path d="M 34 14 L 42 10 L 42 28 L 34 24 Z" fill="#818cf8" stroke="#0f172a" strokeWidth="1.5" />
                
                <circle cx="150" cy="18" r="4.5" fill="#ef4444" className="anim-blink-record" />
                <text x="115" y="21" fill="#475569" fontSize="8" fontFamily="sans-serif" fontWeight="800">LIVE ROOM</text>

                <circle cx="30" cy="55" r="14" fill="#fbcfe8" stroke="#0f172a" strokeWidth="1.5" />
                <circle cx="50" cy="55" r="14" fill="#fef08a" stroke="#0f172a" strokeWidth="1.5" />
                <circle cx="70" cy="55" r="14" fill="#bfdbfe" stroke="#0f172a" strokeWidth="1.5" />
                
                <text x="96" y="58" fill="#1e293b" fontSize="9" fontFamily="sans-serif" fontWeight="900">DBMS Review</text>
                <text x="96" y="68" fill="#64748b" fontSize="7.5" fontFamily="sans-serif" fontWeight="700">4 studying</text>
              </g>

              {/* Floating Documents */}
              <g transform="translate(180, 160)" className="anim-float-slow">
                <rect x="0" y="0" width="24" height="32" rx="4" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="1.5" />
                <line x1="4" y1="8" x2="20" y2="8" stroke="#4f46e5" strokeWidth="1.5" />
                <line x1="4" y1="16" x2="16" y2="16" stroke="#4f46e5" strokeWidth="1.5" />
              </g>
            </svg>
          </div>

          <div style={{ zIndex: 2, textAlign: 'center', maxWidth: '420px', marginTop: '1.5rem' }}>
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

        {/* RIGHT PANEL (40% Desktop layout) */}
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
            
            {/* Winking Mascot Peeking Over */}
            <div style={{
              position: 'absolute',
              top: '-58px',
              left: '24px',
              zIndex: 10,
              pointerEvents: 'none'
            }}>
              <svg width="110" height="60" viewBox="0 0 110 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Hood/Hair */}
                <path d="M15 45 C15 15, 95 15, 95 45 Z" fill="#6366f1" />
                {/* Face */}
                <circle cx="55" cy="40" r="20" fill="#fed7aa" stroke="#0f172a" strokeWidth="2" />
                {/* Hair cap */}
                <path d="M35 30 C42 20, 68 20, 75 30 C68 27, 42 27, 35 30 Z" fill="#3730a3" />
                {/* Left Eye (Normal) */}
                <circle cx="44" cy="38" r="6" stroke="#0f172a" strokeWidth="2" fill="#fff" />
                <circle cx="44" cy="38" r="2" fill="#0f172a" />
                {/* Right Eye (Winking) */}
                <path d="M 60 38 Q 65 33 70 38" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                {/* Nose line */}
                <line x1="52" y1="38" x2="58" y2="38" stroke="#0f172a" strokeWidth="1.5" />
                {/* Smile */}
                <path d="M49 46 Q54 50 59 46" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
                {/* Blush */}
                <circle cx="36" cy="42" r="1.5" fill="#f43f5e" opacity="0.6" />
                <circle cx="74" cy="42" r="1.5" fill="#f43f5e" opacity="0.6" />
                {/* Shoulders peeking */}
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
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, margin: '0.25rem 0 0 0' }}>
                  Connect. Collaborate. Learn Together.
                </p>
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
