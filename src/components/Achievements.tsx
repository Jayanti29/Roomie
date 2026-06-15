import React, { useState } from 'react';

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  desc: string;
  unlocked: boolean;
  unlockedAt?: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
}

interface AchievementsProps {
  achievements: Achievement[];
  userName: string;
  userLevel: number;
}

export const Achievements: React.FC<AchievementsProps> = ({ achievements, userName, userLevel }) => {
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null);
  const [copied, setCopied] = useState(false);

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'Rare': return 'var(--accent-cyan)';
      case 'Epic': return 'var(--accent-purple)';
      case 'Legendary': return 'var(--accent-gold)';
      case 'Common':
      default: return 'var(--accent-green)';
    }
  };

  const getShareTemplate = (badge: Achievement) => {
    return `LEVEL UP IN REAL LIFE!

I just unlocked the "${badge.title}" (${badge.rarity}) badge on LifeQuest! 
Level: ${userLevel}
Achievement: "${badge.desc}"

Transforming real-world goals, study, and coding. Evolving daily!

#LifeQuest #GrowthMindset #PersonalDevelopment #AI`;
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel achievements-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header - No double slashes */}
      <div style={{ borderBottom: '2.5px solid #000', paddingBottom: '0.75rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          UNLOCKED ACHIEVEMENTS
        </h2>
      </div>

      {/* Grid of badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
        {achievements.map(badge => {
          const color = getRarityColor(badge.rarity);
          return (
            <div
              key={badge.id}
              onClick={() => badge.unlocked && setSelectedBadge(badge)}
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '1rem 0.5rem',
                cursor: badge.unlocked ? 'pointer' : 'not-allowed',
                background: badge.unlocked ? 'rgba(255,255,255,1)' : '#f0f0f0',
                opacity: badge.unlocked ? 1 : 0.5,
                border: '3px solid #000',
                boxShadow: badge.unlocked ? '4px 4px 0px #000' : 'none',
                transition: 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                position: 'relative'
              }}
              title={badge.unlocked ? 'Click to share on LinkedIn' : 'Locked Achievement'}
            >
              {/* Rarity tag */}
              <span style={{
                position: 'absolute',
                top: '0.4rem',
                fontSize: '0.6rem',
                color: '#000',
                background: color,
                border: '1.5px solid #000',
                padding: '0.05rem 0.35rem',
                borderRadius: '6px',
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                textTransform: 'uppercase'
              }}>
                {badge.rarity}
              </span>

              <span style={{ 
                fontSize: '0.8rem', 
                margin: '1.25rem 0 0.4rem 0',
                fontWeight: 900,
                background: '#000',
                color: '#fff',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontFamily: 'var(--font-heading)',
                boxShadow: '1.5px 1.5px 0px var(--accent-pink)',
                display: 'inline-block'
              }}>
                {badge.icon}
              </span>
              
              <h4 style={{ 
                fontSize: '0.8rem', 
                fontWeight: 800, 
                color: '#000',
                fontFamily: 'var(--font-heading)',
                marginBottom: '0.2rem',
                lineHeight: '1.2'
              }}>
                {badge.title}
              </h4>
              
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {badge.unlocked ? 'UNLOCKED' : 'LOCKED'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Share Modal Dialog */}
      {selectedBadge && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(228, 249, 184, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-panel anim-pop" style={{
            maxWidth: '460px',
            width: '100%',
            background: '#ffffff',
            border: '3px solid #000',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '8px 8px 0px #000'
          }}>
            {/* Modal Header - No double slashes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#000', fontSize: '0.95rem' }}>
                SHARE ACHIEVEMENT CARD
              </span>
              <button 
                onClick={() => setSelectedBadge(null)}
                style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            {/* Poster Card (Looks like a shareable graphic card) */}
            <div style={{
              background: 'var(--accent-gold)',
              border: '3px solid #000',
              borderRadius: '20px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: '4px 4px 0px #000',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Background grid */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: 'radial-gradient(rgba(0,0,0,0.08) 1.5px, transparent 1.5px)',
                backgroundSize: '16px 16px',
                opacity: 0.5,
                zIndex: 0
              }} />

              <span style={{ zIndex: 1, fontSize: '0.75rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#000', background: '#fff', border: '2px solid #000', padding: '0.15rem 0.5rem', borderRadius: '8px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                {selectedBadge.rarity}
              </span>

              <span style={{ 
                zIndex: 1, 
                fontSize: '1.2rem', 
                margin: '0.75rem 0',
                fontWeight: 900,
                background: '#000',
                color: '#fff',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                fontFamily: 'var(--font-heading)',
                boxShadow: '2.5px 2.5px 0px var(--accent-pink)'
              }}>
                {selectedBadge.icon}
              </span>

              <h3 style={{ zIndex: 1, fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 900, color: '#000', margin: '0.4rem 0' }}>
                {selectedBadge.title}
              </h3>
              
              <p style={{ zIndex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', maxWidth: '300px', lineHeight: '1.4', marginBottom: '1rem' }}>
                "{selectedBadge.desc}"
              </p>

              <div style={{ zIndex: 1, borderTop: '2.5px solid #000', width: '100%', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--text-secondary)' }}>
                <span>OPERATOR: {userName}</span>
                <span>LEVEL {userLevel}</span>
              </div>
            </div>

            {/* Share Text area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>PRE-COMPOSED POST TEXT</label>
              <textarea
                readOnly
                value={getShareTemplate(selectedBadge)}
                style={{
                  width: '100%',
                  height: '110px',
                  background: '#f8f8f8',
                  border: '2px solid #000',
                  borderRadius: '10px',
                  color: '#000',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  padding: '0.5rem',
                  resize: 'none'
                }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => handleCopyText(getShareTemplate(selectedBadge))}
                className="cyber-btn"
                style={{ flex: 1 }}
              >
                {copied ? 'COPIED!' : 'COPY POST TEXT'}
              </button>
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="cyber-btn pink-fill"
                style={{ flex: 1, textDecoration: 'none', textAlign: 'center', display: 'flex', justifyContent: 'center' }}
              >
                POST TO LINKEDIN
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
