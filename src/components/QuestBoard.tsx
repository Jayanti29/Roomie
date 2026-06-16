import React, { useState } from 'react';

export interface Quest {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Heroic';
  xpReward: number;
  statReward: {
    intelligence?: number;
    strength?: number;
    discipline?: number;
    creativity?: number;
    communication?: number;
    career?: number;
  };
  completed: boolean;
  category: 'Study' | 'Fitness' | 'Productivity' | 'Networking' | 'Coding';
}

interface QuestBoardProps {
  quests: Quest[];
  onCompleteQuest: (questId: string) => void;
  onAddQuest: (quest: Omit<Quest, 'id' | 'completed'>) => void;
  storyLog: string[];
}

export const QuestBoard: React.FC<QuestBoardProps> = ({ quests, onCompleteQuest, onAddQuest, storyLog }) => {
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [newQuestCategory, setNewQuestCategory] = useState<'Study' | 'Fitness' | 'Productivity' | 'Networking' | 'Coding'>('Study');
  const [newQuestDifficulty, setNewQuestDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Heroic'>('Easy');
  const [showAddForm, setShowAddForm] = useState(false);

  const getDifficultyColor = (diff: Quest['difficulty']) => {
    switch (diff) {
      case 'Medium': return 'var(--accent-cyan)';
      case 'Hard': return 'var(--accent-purple)';
      case 'Heroic': return 'var(--accent-gold)';
      case 'Easy':
      default: return 'var(--accent-green)';
    }
  };

  const handleCreateQuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestTitle.trim()) return;

    let xpReward = 50;
    if (newQuestDifficulty === 'Medium') xpReward = 100;
    else if (newQuestDifficulty === 'Hard') xpReward = 150;
    else if (newQuestDifficulty === 'Heroic') xpReward = 250;

    const statAmt = newQuestDifficulty === 'Easy' ? 5 : newQuestDifficulty === 'Medium' ? 10 : newQuestDifficulty === 'Hard' ? 15 : 25;
    
    const statReward: Quest['statReward'] = {};
    if (newQuestCategory === 'Study') statReward.intelligence = statAmt;
    else if (newQuestCategory === 'Fitness') statReward.strength = statAmt;
    else if (newQuestCategory === 'Productivity') statReward.discipline = statAmt;
    else if (newQuestCategory === 'Networking') statReward.communication = statAmt;
    else if (newQuestCategory === 'Coding') statReward.career = statAmt;

    onAddQuest({
      title: newQuestTitle,
      category: newQuestCategory,
      difficulty: newQuestDifficulty,
      xpReward,
      statReward
    });

    setNewQuestTitle('');
    setShowAddForm(false);
  };

  return (
    <div className="glass-panel quest-board-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* DM Story Mode Panel - Cartoon Scroll style */}
      <div style={{ background: '#fcfcfc', border: '3px solid #000', borderRadius: '20px', padding: '1rem', position: 'relative', boxShadow: '4px 4px 0px #000' }}>
        <div style={{ position: 'absolute', top: '0.4rem', right: '0.6rem', fontSize: '0.65rem', color: '#000', fontFamily: 'var(--font-heading)', fontWeight: 800, background: 'var(--accent-cyan)', border: '1.5px solid #000', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>
          ACADEMIC ASSISTANT
        </div>
        
        {/* No double slashes */}
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 800, color: '#000', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>◈</span> ASSISTANT LOG
        </h3>
        <div style={{ maxHeight: '90px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '0.25rem' }}>
          {storyLog.map((log, i) => (
            <p key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, color: i === storyLog.length - 1 ? '#000' : 'var(--text-muted)', borderLeft: i === storyLog.length - 1 ? '3px solid var(--accent-pink)' : '3px solid transparent', paddingLeft: '0.4rem', lineHeight: '1.3' }}>
              {log}
            </p>
          ))}
        </div>
      </div>

      {/* Quests Header - No double slashes */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.75rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ACTIVE OBJECTIVES
        </h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="cyber-btn"
          style={{
            padding: '0.3rem 0.75rem',
            fontSize: '0.75rem'
          }}
        >
          {showAddForm ? '✕ CANCEL' : '+ NEW OBJECTIVE'}
        </button>
      </div>

      {/* Add Custom Quest Form */}
      {showAddForm && (
        <form onSubmit={handleCreateQuest} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#fdfdfd', border: '3px dashed #000', boxShadow: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>OBJECTIVE DESCRIPTION</label>
            <input
              type="text"
              className="cyber-input"
              placeholder="e.g. Clean the database dataset..."
              value={newQuestTitle}
              onChange={(e) => setNewQuestTitle(e.target.value)}
              required
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>CATEGORY</label>
              <select 
                value={newQuestCategory} 
                onChange={(e: any) => setNewQuestCategory(e.target.value)}
                style={{
                  background: '#ffffff',
                  color: '#000',
                  border: '2px solid #000',
                  padding: '0.5rem',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  borderRadius: '10px',
                  fontSize: '0.8rem'
                }}
              >
                <option value="Study">Study (Analysis & Tech)</option>
                <option value="Fitness">Health (Consistency)</option>
                <option value="Productivity">Focus (Task Execution)</option>
                <option value="Networking">Networking (Collaboration)</option>
                <option value="Coding">Projects (Career Prep)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>DIFFICULTY</label>
              <select 
                value={newQuestDifficulty} 
                onChange={(e: any) => setNewQuestDifficulty(e.target.value)}
                style={{
                  background: '#ffffff',
                  color: '#000',
                  border: '2px solid #000',
                  padding: '0.5rem',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  borderRadius: '10px',
                  fontSize: '0.8rem'
                }}
              >
                <option value="Easy">Easy (+50 Progress)</option>
                <option value="Medium">Medium (+100 Progress)</option>
                <option value="Hard">Hard (+150 Progress)</option>
                <option value="Heroic">Expert (+250 Progress)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="cyber-btn pink-fill" style={{ width: '100%', padding: '0.55rem' }}>
            CREATE OBJECTIVE
          </button>
        </form>
      )}

      {/* Quest Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '0.25rem' }}>
        {quests.filter(q => !q.completed).length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', border: '3.5px dashed #000', borderRadius: '20px', gap: '0.5rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>ALL DAILY OBJECTIVES COMPLETED!</p>
          </div>
        ) : (
          quests.map(quest => {
            const diffColor = getDifficultyColor(quest.difficulty);
            return (
              <div 
                key={quest.id} 
                className="glass-panel" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '0.75rem 1rem', 
                  background: '#ffffff',
                  border: '3px solid #000',
                  boxShadow: '4px 4px 0px #000',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ 
                      fontSize: '0.65rem', 
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 800, 
                      color: '#000', 
                      background: diffColor,
                      border: '1.5px solid #000', 
                      padding: '0.05rem 0.4rem', 
                      borderRadius: '6px',
                      textTransform: 'uppercase'
                    }}>
                      {quest.difficulty === 'Heroic' ? 'Expert' : quest.difficulty}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>{quest.category}</span>
                  </div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#000' }}>{quest.title}</h4>
                  
                  {/* Rewards preview */}
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--accent-pink)' }}>
                    <span>+{quest.xpReward} Progress</span>
                    {Object.entries(quest.statReward).map(([statName, val]) => {
                      const displayStatName = statName === 'intelligence' ? 'Analysis' : statName === 'strength' ? 'Consistency' : statName === 'discipline' ? 'Execution' : statName === 'creativity' ? 'Innovation' : statName === 'communication' ? 'Collaboration' : 'Prep';
                      return (
                        <span key={statName} style={{ color: 'var(--accent-purple)' }}>
                          +{val} {displayStatName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <button 
                  onClick={() => onCompleteQuest(quest.id)}
                  disabled={quest.completed}
                  style={{
                    background: 'var(--accent-gold)',
                    border: '2.5px solid #000',
                    color: '#000',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    fontWeight: 900,
                    transition: 'all 0.15s ease',
                    boxShadow: '2px 2px 0px #000',
                    flexShrink: 0
                  }}
                  title="Complete Objective"
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translate(1px, 1px)';
                    e.currentTarget.style.boxShadow = '1px 1px 0px #000';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '2px 2px 0px #000';
                  }}
                >
                  ✓
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
