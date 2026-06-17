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
        // Check if test user or debug URL to bypass onboarding
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
        // Load data from DB to check if they completed onboarding before
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
      '', // phone
      ''  // bio
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
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="glass-panel anim-float" style={{
        maxWidth: '400px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        background: '#ffffff',
        border: '3.5px solid #000',
        boxShadow: '8px 8px 0px #000',
        zIndex: 10
      }}>
        {/* Title / Logo */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2.2rem',
            fontWeight: 900,
            color: '#000',
            letterSpacing: '0.05em'
          }}>
            ROOMIE
          </h1>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.8rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: 'var(--accent-pink)',
            textTransform: 'uppercase'
          }}>
            REAL-TIME COLLABORATION PLATFORM
          </span>
        </div>

        {/* Info Box */}
        <div style={{
          background: 'var(--accent-gold)',
          padding: '0.65rem 0.8rem',
          borderRadius: '12px',
          border: '2.5px solid #000',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: '#000',
          lineHeight: '1.4',
          boxShadow: '3px 3px 0px #000'
        }}>
          <span>Connect, collaborate and learn together.</span>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div style={{
            background: '#ffeef2',
            border: '2px solid #000',
            color: 'var(--accent-pink)',
            padding: '0.6rem',
            borderRadius: '10px',
            fontSize: '0.8rem',
            fontWeight: 700
          }}>
            {errorMessage}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {isRegistering && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>FULL NAME</label>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>EMAIL ADDRESS</label>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>PASSWORD</label>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>CONFIRM PASSWORD</label>
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
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.4rem', border: '3px solid #000', boxShadow: '4px 4px 0px #000' }}
          >
            {loading ? 'SYNCHRONIZING...' : isRegistering ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </button>
        </form>

        {/* Bottom Switch Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMessage('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-purple)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              textDecoration: 'underline'
            }}
          >
            {isRegistering ? 'ALREADY HAVE AN ACCOUNT? SIGN IN' : 'NEW STUDENT? CREATE ACCOUNT'}
          </button>

          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>OR</span>

          {/* Guest login action */}
          <button
            onClick={handleGuestLogin}
            className="cyber-btn"
            style={{
              width: '100%',
              background: 'var(--accent-gold)',
              border: '3px solid #000',
              boxShadow: '4px 4px 0px #000',
              fontSize: '0.85rem',
              fontWeight: 800,
              padding: '0.65rem'
            }}
          >
            CONTINUE AS GUEST
          </button>
        </div>
      </div>
    </div>
  );
};
