import React from 'react';

interface Stat {
  name: string;
  value: number;
  max: number;
  icon: string;
  color: string;
  description: string;
}

interface StatPanelProps {
  stats: {
    intelligence: number;
    strength: number;
    discipline: number;
    creativity: number;
    communication: number;
    career: number;
  };
  level: number;
  xp: number;
  maxXp: number;
  completedQuestsCount?: number;
  totalQuestsCount?: number;
  unlockedSkillsCount?: number;
  unlockedAchievementsCount?: number;
  sessionXpEarned?: number;
}

export const StatPanel: React.FC<StatPanelProps> = ({
  stats,
  level,
  xp,
  maxXp,
  completedQuestsCount = 0,
  totalQuestsCount = 0,
  unlockedSkillsCount = 0,
  unlockedAchievementsCount = 0,
  sessionXpEarned = 0
}) => {
  const statList: Stat[] = [
    {
      name: 'Analysis & Tech',
      value: stats.intelligence,
      max: 100,
      icon: '',
      color: 'var(--accent-cyan)',
      description: 'Reflects problem solving ability, core subject proficiency, and research capabilities.'
    },
    {
      name: 'Study Consistency',
      value: stats.strength,
      max: 100,
      icon: '',
      color: 'var(--accent-pink)',
      description: 'Measures continuous learning volume, endurance, and prevention of learning fatigue.'
    },
    {
      name: 'Task Execution',
      value: stats.discipline,
      max: 100,
      icon: '',
      color: 'var(--accent-green)',
      description: 'Tracks daily objective adherence, session focus, and target completion consistency.'
    },
    {
      name: 'Innovation & Design',
      value: stats.creativity,
      max: 100,
      icon: '',
      color: 'var(--accent-purple)',
      description: 'Represents code design quality, creative solutions, and project UX enhancement.'
    },
    {
      name: 'Collaboration',
      value: stats.communication,
      max: 100,
      icon: '',
      color: 'var(--accent-gold)',
      description: 'Determines peer-to-peer engagement quality, network strength, and team communication.'
    },
    {
      name: 'Professional Prep',
      value: stats.career,
      max: 100,
      icon: '',
      color: '#a3e635',
      description: 'Indicates portfolio preparedness, application quality, and professional readiness.'
    }
  ];

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Title - No double slashes */}
      <div style={{ borderBottom: '2.5px solid #000', paddingBottom: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          ACADEMIC OVERVIEW & PROFILE
        </h2>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', fontWeight: 800, color: '#000', background: 'var(--accent-gold)', border: '2.5px solid #000', padding: '0.1rem 0.5rem', borderRadius: '8px', boxShadow: '2px 2px 0px #000' }}>
          STUDENT
        </span>
      </div>

      {/* Level Dial Bubbly Frame */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#fcfcfc', border: '3px solid #000', padding: '0.85rem', borderRadius: '20px', boxShadow: '4px 4px 0px #000' }}>
        <div style={{
          position: 'relative',
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          border: '3px solid #000',
          background: 'var(--accent-purple)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '3px 3px 0px #000',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#000', fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>LEVEL</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: '#000', lineHeight: '1' }}>{level}</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
            <span style={{ color: 'var(--text-secondary)' }}>PROGRESS SCORE MULTIPLIER</span>
            <span style={{ color: '#000' }}>{Math.round((xp / maxXp) * 100)}%</span>
          </div>
          
          <div style={{ width: '100%', height: '12px', background: '#ffffff', border: '2.5px solid #000', borderRadius: 'var(--border-radius-full)', overflow: 'hidden' }}>
            <div style={{
              width: `${(xp / maxXp) * 100}%`,
              height: '100%',
              background: 'var(--accent-pink)',
              transition: 'width 0.4s ease'
            }} />
          </div>
          
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
            {xp} / {maxXp} Progress Score (need {maxXp - xp} Progress Score to increase Academic Level)
          </span>
        </div>
      </div>

      {/* Core Stats Progress List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {statList.map(stat => (
          <div 
            key={stat.name} 
            className="stat-row" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.25rem', 
              padding: '0.6rem', 
              background: '#fcfcfc',
              border: '2.5px solid #000',
              borderRadius: '16px',
              boxShadow: '3px 3px 0px #000',
              cursor: 'help',
              transition: 'all 0.15s ease'
            }}
            title={stat.description}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {stat.name}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', fontWeight: 800, color: '#000' }}>
                {stat.value}
              </span>
            </div>
            
            {/* Stat bar */}
            <div style={{ width: '100%', height: '12px', background: '#ffffff', border: '2px solid #000', borderRadius: 'var(--border-radius-full)', overflow: 'hidden' }}>
              <div style={{
                width: `${(stat.value / stat.max) * 100}%`,
                height: '100%',
                background: stat.color,
                transition: 'width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* 📊 PROGRESS & IMPROVEMENT STATISTICS */}
      <div style={{
        marginTop: '0.5rem',
        padding: '0.85rem',
        background: '#fff3f8',
        border: '3px solid #000',
        borderRadius: '20px',
        boxShadow: '4px 4px 0px #000',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem'
      }}>
        <h3 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '0.9rem',
          fontWeight: 900,
          color: '#000',
          borderBottom: '2.5px solid #000',
          paddingBottom: '0.3rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0
        }}>
          PROGRESS & IMPROVEMENT
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          {/* Daily Quest Completion Ratio */}
          <div style={{
            background: '#ffffff',
            border: '2.5px solid #000',
            borderRadius: '12px',
            padding: '0.5rem 0.6rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            boxShadow: '2px 2px 0px #000'
          }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-secondary)' }}>TASK COMPLETION</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#000', fontFamily: 'var(--font-heading)' }}>
                {completedQuestsCount} / {totalQuestsCount}
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>completed</span>
            </div>
            {/* mini progress bar */}
            <div style={{ width: '100%', height: '8px', background: '#f0f0f0', border: '1.5px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${totalQuestsCount ? (completedQuestsCount / totalQuestsCount) * 100 : 0}%`,
                height: '100%',
                background: 'var(--accent-green)',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>

          {/* Session Focus Growth (XP) */}
          <div style={{
            background: '#ffffff',
            border: '2.5px solid #000',
            borderRadius: '12px',
            padding: '0.5rem 0.6rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            boxShadow: '2px 2px 0px #000',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-secondary)' }}>SESSION PROGRESS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontSize: '1.1rem', color: 'var(--accent-pink)', fontWeight: 900 }}>↑</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--accent-pink)', fontFamily: 'var(--font-heading)' }}>
                +{sessionXpEarned.toLocaleString()} Progress
              </span>
            </div>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)' }}>current run</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          {/* Skill Nodes Activated */}
          <div style={{
            background: '#ffffff',
            border: '2.5px solid #000',
            borderRadius: '12px',
            padding: '0.5rem 0.6rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '2px 2px 0px #000',
            justifyContent: 'center'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-secondary)' }}>LEARNING AREAS COMPLETED</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--accent-purple)', fontFamily: 'var(--font-heading)' }}>
                {unlockedSkillsCount} Areas
              </span>
            </div>
          </div>

          {/* Achievement Badges Unlocked */}
          <div style={{
            background: '#ffffff',
            border: '2.5px solid #000',
            borderRadius: '12px',
            padding: '0.5rem 0.6rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '2px 2px 0px #000',
            justifyContent: 'center'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-secondary)' }}>MILESTONES AWARDED</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)' }}>
                {unlockedAchievementsCount} Badges
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
