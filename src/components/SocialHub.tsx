import React, { useState } from 'react';

interface LeaderboardUser {
  rank: number;
  name: string;
  level: number;
  totalXp: number;
  guild: string;
  avatar: string;
}

interface SocialHubProps {
  userName: string;
  userLevel: number;
  userXp: number;
}

export const SocialHub: React.FC<SocialHubProps> = ({ userName, userLevel, userXp }) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'guilds' | 'duels' | 'friends'>('leaderboard');
  const [activeGuild, setActiveGuild] = useState('Data Science Group');

  // Interactive study buddies / friends lists
  const [friends, setFriends] = useState([
    { name: 'Alex Carter', level: 14, college: 'Stanford University', online: true, avatar: 'AC' },
    { name: 'Chloe Chen', level: 12, college: 'Delhi University (DU)', online: true, avatar: 'CC' },
    { name: 'Devin Cole', level: 18, college: 'IISc Bangalore', online: false, avatar: 'DC' }
  ]);

  const [incomingRequests, setIncomingRequests] = useState([
    { id: 'req_1', name: 'Rahul Sharma', level: 15, college: 'Christ University, Bangalore', avatar: 'RS' }
  ]);

  const [friendSearch, setFriendSearch] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendSearch.trim()) return;
    setFeedback(`Friend request sent to ${friendSearch}!`);
    setFriendSearch('');
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleAcceptRequest = (req: typeof incomingRequests[0]) => {
    setFriends(prev => [
      ...prev,
      { name: req.name, level: req.level, college: req.college, online: true, avatar: req.avatar }
    ]);
    setIncomingRequests(prev => prev.filter(r => r.id !== req.id));
  };

  const handleDeclineRequest = (id: string) => {
    setIncomingRequests(prev => prev.filter(r => r.id !== id));
  };

  const leaderboardUsers: LeaderboardUser[] = [
    { rank: 1, name: 'Siddharth Nair', level: 88, totalXp: 432000, guild: 'AI Group', avatar: 'SN' },
    { rank: 2, name: 'Anya Sharma', level: 56, totalXp: 275000, guild: 'Startup Group', avatar: 'AS' },
    { rank: 3, name: 'Rohan Mehta', level: 42, totalXp: 205000, guild: 'Data Science Group', avatar: 'RM' },
    { rank: 4, name: `${userName} (You)`, level: userLevel, totalXp: (userLevel * 5000) + userXp, guild: activeGuild, avatar: userName.substring(0, 2).toUpperCase() },
    { rank: 5, name: 'Neha Gupta', level: 21, totalXp: 92000, guild: 'Data Science Group', avatar: 'NG' },
    { rank: 6, name: 'Vikram Rao', level: 18, totalXp: 78000, guild: 'AI Group', avatar: 'VR' }
  ].sort((a, b) => b.totalXp - a.totalXp);

  leaderboardUsers.forEach((user, index) => {
    user.rank = index + 1;
  });

  const guildsList = [
    {
      name: 'Data Science Group',
      motto: 'Refining correlations, conquering noise.',
      members: 142,
      weeklyGoal: 'Reach 20,000 Progress Score in analytics tasks.',
      progress: 74,
      buff: '+15% Analysis & Tech Progress Score multiplier'
    },
    {
      name: 'AI Group',
      motto: 'Training networks, driving agency.',
      members: 98,
      weeklyGoal: 'Solve 10 Neural Node configurations.',
      progress: 45,
      buff: '+10% Professional Prep Progress Score & +10% Innovation & Design'
    },
    {
      name: 'Startup Group',
      motto: 'Build fast, break limits, scale out.',
      members: 76,
      weeklyGoal: 'Build 5 portfolio code projects.',
      progress: 60,
      buff: '+15% Collaboration Progress Score'
    }
  ];

  return (
    <div className="glass-panel social-hub-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Navigation tabs */}
      <div style={{ display: 'flex', borderBottom: '2.5px solid #000', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
        {(['leaderboard', 'guilds', 'duels', 'friends'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === tab ? 'var(--accent-pink)' : 'var(--text-muted)',
              fontFamily: 'var(--font-heading)',
              fontSize: '0.8rem',
              fontWeight: 800,
              padding: '0.4rem 0.15rem',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '3px solid var(--accent-pink)' : '3px solid transparent',
              textTransform: 'uppercase',
              transition: 'all 0.2s ease',
              flex: 1,
              minWidth: '70px',
              whiteSpace: 'nowrap'
            }}
          >
            {tab === 'guilds' ? 'Groups' : tab === 'duels' ? 'Challenges' : tab === 'friends' ? 'Buddies' : 'Rank'}
          </button>
        ))}
      </div>

      {/* Content Render */}
      <div style={{ minHeight: '220px' }}>
        
        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1.4fr 1fr 1fr', padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
              <span>RANK</span>
              <span>USER</span>
              <span>GROUP</span>
              <span style={{ textAlign: 'right' }}>TOTAL SCORE</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
              {leaderboardUsers.map(user => {
                const isMe = user.name.includes('(You)');
                return (
                  <div
                    key={user.name}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1.4fr 1fr 1fr',
                      padding: '0.5rem',
                      background: isMe ? 'var(--accent-gold)' : '#ffffff',
                      border: '2.5px solid #000',
                      boxShadow: isMe ? '2px 2px 0px #000' : 'none',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      alignItems: 'center',
                      fontWeight: 700
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#000' }}>
                      #{user.rank}
                    </span>
                    <span style={{ color: '#000', display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: '2px solid #000',
                        background: 'var(--accent-purple)',
                        color: '#000',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        marginRight: '6px',
                        fontFamily: 'var(--font-heading)',
                        boxShadow: '1px 1px 0px #000'
                      }}>{user.avatar}</span>
                      {user.name.replace(' (You)', '')} <span style={{ color: 'var(--accent-pink)', fontSize: '0.7rem', fontWeight: 800, marginLeft: '4px' }}>Level {user.level}</span>
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{user.guild.split(' ')[0]}</span>
                    <span style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', color: '#000', fontWeight: 800 }}>
                      {user.totalXp.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Guilds Tab */}
        {activeTab === 'guilds' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {guildsList.map(guild => {
              const active = activeGuild === guild.name;
              return (
                <div
                  key={guild.name}
                  style={{
                    padding: '0.75rem',
                    background: active ? 'var(--accent-gold)' : '#ffffff',
                    border: '2.5px solid #000',
                    boxShadow: active ? '3px 3px 0px #000' : 'none',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', fontWeight: 800, color: '#000' }}>
                      {guild.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>({guild.members} students)</span>
                    </h4>
                    {!active ? (
                      <button
                        onClick={() => setActiveGuild(guild.name)}
                        className="cyber-btn"
                        style={{
                          fontSize: '0.65rem',
                          padding: '0.15rem 0.5rem',
                          background: 'var(--accent-cyan)'
                        }}
                      >
                        JOIN
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#000', background: '#fff', border: '1.5px solid #000', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>
                        JOINED
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{guild.motto}"</p>
                  
                  {/* Guild Goal progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.7rem', fontWeight: 700 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>GOAL: {guild.weeklyGoal}</span>
                      <span>{guild.progress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#ffffff', border: '1.5px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${guild.progress}%`, height: '100%', background: 'var(--accent-pink)' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-pink)' }}>
                    BENEFIT: {guild.buff}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Duels Tab */}
        {activeTab === 'duels' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center', minHeight: '180px' }}>
            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, color: '#000' }}>COLLABORATIVE CHALLENGES</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, maxWidth: '280px', lineHeight: '1.3' }}>
              Challenge study buddies to productivity streaks. Win and complete goals together!
            </p>
            <button className="cyber-btn pink-fill" style={{ fontSize: '0.75rem', padding: '0.4rem 1rem' }}>
              START CHALLENGE
            </button>
          </div>
        )}

        {/* Study Buddies Tab */}
        {activeTab === 'friends' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            
            {/* Search Form */}
            <form onSubmit={handleSendRequest} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Enter classmate name or ID..." 
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                className="cyber-input"
                style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
              />
              <button 
                type="submit" 
                className="cyber-btn"
                style={{ background: 'var(--accent-purple)', fontSize: '0.75rem', padding: '0 1rem' }}
              >
                ADD
              </button>
            </form>

            {/* Feedback message */}
            {feedback && (
              <div style={{
                background: '#e0f2f1',
                border: '2px solid #000',
                borderRadius: '8px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#00695c'
              }}>
                {feedback}
              </div>
            )}

            {/* Incoming Requests */}
            {incomingRequests.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-pink)', letterSpacing: '0.05em' }}>
                  PENDING INVITES ({incomingRequests.length})
                </span>
                {incomingRequests.map(req => (
                  <div 
                    key={req.id}
                    style={{
                      background: '#fff3f8',
                      border: '2.5px solid #000',
                      borderRadius: '12px',
                      padding: '0.6rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '2px 2px 0px #000',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <span style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        border: '2px solid #000',
                        background: 'var(--accent-cyan)',
                        color: '#000',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-heading)',
                        boxShadow: '1px 1px 0px #000',
                        flexShrink: 0
                      }}>{req.avatar}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#000' }}>
                          {req.name} <span style={{ color: 'var(--accent-pink)' }}>Level {req.level}</span>
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {req.college}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                      <button 
                        onClick={() => handleAcceptRequest(req)}
                        style={{
                          background: 'var(--accent-green)',
                          border: '2px solid #000',
                          borderRadius: '8px',
                          padding: '0.2rem 0.45rem',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '1px 1px 0px #000'
                        }}
                      >
                        ACCEPT
                      </button>
                      <button 
                        onClick={() => handleDeclineRequest(req.id)}
                        style={{
                          background: '#fff',
                          border: '2px solid #000',
                          borderRadius: '8px',
                          padding: '0.2rem 0.45rem',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '1px 1px 0px #000'
                        }}
                      >
                        DECLINE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Friends list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-purple)', letterSpacing: '0.05em' }}>
                ACTIVE STUDY BUDDIES ({friends.length})
              </span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {friends.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
                    No buddies online. Invite some friends!
                  </div>
                ) : (
                  friends.map((friend, i) => (
                    <div
                      key={i}
                      style={{
                        background: '#ffffff',
                        border: '2px solid #000',
                        borderRadius: '12px',
                        padding: '0.5rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '2px 2px 0px #000'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                        {/* Online/Offline status dot */}
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: friend.online ? 'var(--accent-green)' : 'var(--text-muted)',
                          border: '1.5px solid #000',
                          flexShrink: 0
                        }} />
                        <span style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          border: '2px solid #000',
                          background: 'var(--accent-purple)',
                          color: '#000',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-heading)',
                          boxShadow: '1px 1px 0px #000',
                          flexShrink: 0
                        }}>{friend.avatar}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#000' }}>
                            {friend.name} <span style={{ color: 'var(--accent-purple)', fontSize: '0.7rem' }}>Level {friend.level}</span>
                          </span>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                            {friend.college}
                          </span>
                        </div>
                      </div>

                      {friend.online ? (
                        <button 
                          style={{
                            background: 'var(--accent-cyan)',
                            border: '2.0px solid #000',
                            borderRadius: '8px',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '1.5px 1.5px 0px #000',
                            flexShrink: 0
                          }}
                          onClick={() => alert(`Invite sent to ${friend.name} for study video room!`)}
                        >
                          INVITE
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>OFFLINE</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
