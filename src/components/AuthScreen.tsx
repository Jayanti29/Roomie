import React, { useState } from 'react';
import { authService } from '../firebase';

interface AuthScreenProps {
  onLoginSuccess: (
    email: string, 
    name: string,
    course?: string,
    degree?: string,
    college?: string,
    location?: string,
    isGuest?: boolean
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
          'BCA (Bachelor of Computer Applications)',
          'Bachelor of Computer Applications',
          'Christ University, Bangalore',
          'Bangalore, Karnataka'
        );
        onLoginSuccess(
          user.email, 
          user.name, 
          user.course || 'BCA (Bachelor of Computer Applications)', 
          user.degree || 'Bachelor of Computer Applications', 
          user.college || 'Christ University, Bangalore', 
          user.location || 'Bangalore, Karnataka',
          false
        );
      } else {
        const user = await authService.signIn(email, password);
        onLoginSuccess(
          user.email, 
          user.name, 
          (user as any).course || 'BCA (Bachelor of Computer Applications)', 
          (user as any).degree || 'Bachelor of Computer Applications', 
          (user as any).college || 'Christ University, Bangalore', 
          (user as any).location || 'Bangalore, Karnataka',
          false
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
      onLoginSuccess(
        guestEmail, 
        guestName, 
        'BCA (Bachelor of Computer Applications)', 
        'Bachelor of Computer Applications', 
        'Christ University, Bangalore', 
        'Bangalore, Karnataka', 
        true
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Guest login failed.');
    } finally {
      setLoading(false);
    }
  };

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
