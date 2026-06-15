import React, { useState } from 'react';

interface SkillNode {
  id: string;
  name: string;
  desc: string;
  cost: number;
  unlocked: boolean;
  dependsOn?: string;
  statReward: {
    intelligence?: number;
    career?: number;
    creativity?: number;
  };
}

interface SkillTreeProps {
  unlockedSkills: string[];
  skillPoints: number;
  onUnlockSkill: (skillId: string, cost: number, rewards: { intelligence?: number; career?: number; creativity?: number }) => void;
}

export const SkillTree: React.FC<SkillTreeProps> = ({ unlockedSkills, skillPoints, onUnlockSkill }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('python');

  const nodes: SkillNode[] = [
    {
      id: 'python',
      name: 'Python Mastery',
      desc: 'The foundations of modern programming and data orchestration. Syntax, data structures, and packages.',
      cost: 1,
      unlocked: unlockedSkills.includes('python'),
      statReward: { intelligence: 10, career: 5 }
    },
    {
      id: 'numpy',
      name: 'NumPy Grid Vectors',
      desc: 'Scientific computing on multi-dimensional matrices. Accelerates array parsing operations.',
      cost: 1,
      unlocked: unlockedSkills.includes('numpy'),
      dependsOn: 'python',
      statReward: { intelligence: 12, career: 5 }
    },
    {
      id: 'pandas',
      name: 'Pandas Dataframes',
      desc: 'Data cleaning, tabular loading, aggregation, and querying. Prepare raw details for analytics.',
      cost: 1,
      unlocked: unlockedSkills.includes('pandas'),
      dependsOn: 'numpy',
      statReward: { intelligence: 15, career: 8 }
    },
    {
      id: 'ml',
      name: 'Machine Learning Models',
      desc: 'Regression, Decision Trees, SVMs, and Ensemble methods. Model validation and hyper-tuning.',
      cost: 2,
      unlocked: unlockedSkills.includes('ml'),
      dependsOn: 'pandas',
      statReward: { intelligence: 20, career: 15, creativity: 5 }
    },
    {
      id: 'dl',
      name: 'Deep Neural Networks',
      desc: 'Perceptrons, CNNs, RNNs, and Transformers. Optimization algorithms and gradient descent.',
      cost: 2,
      unlocked: unlockedSkills.includes('dl'),
      dependsOn: 'ml',
      statReward: { intelligence: 25, career: 20, creativity: 10 }
    },
    {
      id: 'ai_engineer',
      name: 'AI Architect / Engineer',
      desc: 'LLM agents, fine-tuning, RAG frameworks, vector storage, and scalable AI infrastructure.',
      cost: 3,
      unlocked: unlockedSkills.includes('ai_engineer'),
      dependsOn: 'dl',
      statReward: { intelligence: 35, career: 30, creativity: 20 }
    }
  ];

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];
  
  const isAvailable = (node: SkillNode) => {
    if (node.unlocked) return false;
    if (!node.dependsOn) return true;
    return unlockedSkills.includes(node.dependsOn);
  };

  const handleUnlockClick = () => {
    if (skillPoints >= selectedNode.cost && isAvailable(selectedNode)) {
      onUnlockSkill(selectedNode.id, selectedNode.cost, selectedNode.statReward);
    }
  };

  return (
    <div className="glass-panel skill-tree-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header - No double slashes */}
      <div style={{ borderBottom: '2.5px solid #000', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          SKILL TREE ARCHITECTURE
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>SKILL POINTS:</span>
          <span style={{ 
            fontFamily: 'var(--font-heading)', 
            fontSize: '0.85rem', 
            fontWeight: 800, 
            color: '#000',
            background: 'var(--accent-cyan)',
            padding: '0.1rem 0.6rem',
            borderRadius: '8px',
            border: '2.5px solid #000',
            boxShadow: '2px 2px 0px #000'
          }}>{skillPoints} SP</span>
        </div>
      </div>

      <div className="skill-tree-grid">
        {/* Node Layout View */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center', background: '#fcfcfc', border: '3px solid #000', borderRadius: '20px', padding: '1rem', overflow: 'hidden', boxShadow: '4px 4px 0px #000' }}>
          
          {/* Vertical flow layout */}
          {nodes.map((node, index) => {
            const unlocked = node.unlocked;
            const available = isAvailable(node);
            const active = selectedNodeId === node.id;
            
            let bg = '#ffffff';
            let color = '#777';
            let border = '2.5px solid #000';
            let shadow = 'none';

            if (unlocked) {
              bg = 'var(--accent-cyan)';
              color = '#000';
              shadow = active ? '4px 4px 0px #000' : '2px 2px 0px #000';
            } else if (available) {
              bg = 'var(--accent-purple)';
              color = '#000';
              shadow = active ? '4px 4px 0px #000' : '2px 2px 0px #000';
            }

            if (active) {
              border = '3.5px solid #000';
              shadow = '4px 4px 0px #000';
            }

            return (
              <React.Fragment key={node.id}>
                {/* Node connector line */}
                {index > 0 && (
                  <div style={{
                    width: '6px',
                    height: '24px',
                    background: '#000',
                    margin: '-10px 0',
                    borderRadius: '2px'
                  }} />
                )}
                
                {/* Clickable Node Button */}
                <button
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{
                    width: '180px',
                    padding: '0.65rem 0.8rem',
                    background: bg,
                    border: border,
                    borderRadius: '16px',
                    color: color,
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: shadow,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    zIndex: 2,
                    transform: active ? 'translate(-2px, -2px)' : 'none'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                    {unlocked ? '[DONE]' : available ? '[OPEN]' : '[LOCK]'} {node.name.split(' ')[0]}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#000', opacity: 0.6 }}>L.{index + 1}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Node detail display panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#fdfdfd', border: '3px solid #000', boxShadow: '4px 4px 0px #000' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, color: '#000', borderBottom: '2px solid #000', paddingBottom: '0.4rem' }}>
            {selectedNode.name}
          </h3>
          
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, lineHeight: '1.4', flexGrow: 1 }}>
            {selectedNode.desc}
          </p>

          <div style={{ background: '#f5f5f5', border: '2.5px solid #000', padding: '0.6rem', borderRadius: '10px' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontFamily: 'var(--font-heading)' }}>
              UNLOCK BONUSES
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              {selectedNode.statReward.intelligence && (
                <div style={{ color: 'var(--accent-cyan)' }}>Intelligence: +{selectedNode.statReward.intelligence} XP</div>
              )}
              {selectedNode.statReward.career && (
                <div style={{ color: 'var(--accent-pink)' }}>Career: +{selectedNode.statReward.career} XP</div>
              )}
              {selectedNode.statReward.creativity && (
                <div style={{ color: 'var(--accent-purple)' }}>Creativity: +{selectedNode.statReward.creativity} XP</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '2px solid #000', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800 }}>
              <span style={{ color: 'var(--text-muted)' }}>Required Cost:</span>
              <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-pink)', fontWeight: 800 }}>{selectedNode.cost} SP</span>
            </div>
            
            {selectedNode.unlocked ? (
              <button disabled style={{
                background: 'rgba(0,0,0,0.05)',
                border: '2px dashed #000',
                color: 'var(--text-muted)',
                padding: '0.5rem',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                cursor: 'not-allowed',
                width: '100%'
              }}>
                ✓ UNLOCKED
              </button>
            ) : isAvailable(selectedNode) ? (
              <button 
                onClick={handleUnlockClick}
                disabled={skillPoints < selectedNode.cost}
                className="cyber-btn pink-fill"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.8rem'
                }}
              >
                {skillPoints >= selectedNode.cost ? 'UNLOCK SKILL' : 'INSUFFICIENT SP'}
              </button>
            ) : (
              <button disabled style={{
                background: 'rgba(0,0,0,0.02)',
                border: '2px dashed rgba(0,0,0,0.2)',
                color: 'var(--text-muted)',
                padding: '0.5rem',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                cursor: 'not-allowed',
                width: '100%'
              }}>
                PATH LOCKED
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
