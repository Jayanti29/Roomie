import { useState } from 'react';

interface BossBattleProps {
  userStats: {
    intelligence: number;
    strength: number;
    discipline: number;
    creativity: number;
    communication: number;
    career: number;
  };
  onDefeatBoss: (xpReward: number, badgeName: string) => void;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  hint: string;
}

export const BossBattle: React.FC<BossBattleProps> = ({ userStats, onDefeatBoss }) => {
  const [bossHp, setBossHp] = useState(1000);
  const [userShield, setUserShield] = useState(100);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [battleLogs, setBattleLogs] = useState<string[]>([
    'Machine Learning Assessment started! (1000/1000 completion points remaining)',
    'Select correct ML answers to build your regularization model!'
  ]);
  const [shaking, setShaking] = useState(false);
  const [flashing, setFlashing] = useState(false);

  const quizQuestions: QuizQuestion[] = [
    {
      question: 'Which regularization technique adds the absolute magnitude of coefficients as a penalty to the loss function?',
      options: ['L1 Regularization (Lasso)', 'L2 Regularization (Ridge)', 'ElasticNet Regularization', 'Dropout Layer'],
      correct: 0,
      hint: 'This technique drives coefficients exactly to zero, creating sparse models.'
    },
    {
      question: 'In deep neural networks, what does the dying ReLU problem refer to?',
      options: [
        'Neurons failing to update because gradients blow up to infinity.',
        'Neurons getting stuck in the inactive state and outputting zero constantly.',
        'The loss function converging too fast during backpropagation.',
        'Thermal shutdown of server clusters due to heavy matrix math.'
      ],
      correct: 1,
      hint: 'If inputs are negative, ReLU outputs exactly 0 and its gradient is 0, stalling learning.'
    },
    {
      question: 'Which metric is most suitable for evaluating an ML classifier on highly imbalanced dataset (e.g. credit card fraud)?',
      options: ['Overall Accuracy', 'Mean Squared Error', 'F1-Score / PR-AUC', 'R-Squared value'],
      correct: 2,
      hint: 'Accuracy will be 99.9% by just predicting "no fraud". We need to balance precision and recall.'
    },
    {
      question: 'What is the primary purpose of a Validation Set during model training?',
      options: [
        'To train parameters like weights and biases directly.',
        'To run final evaluation before client deployment.',
        'To tune hyperparameters and prevent overfitting to the training set.',
        'To store backup model checkpoints on cloud databases.'
      ],
      correct: 2,
      hint: 'Used to select learning rates, model size, etc., before final testing.'
    }
  ];

  const handleAnswer = (optionIdx: number) => {
    const isCorrect = optionIdx === quizQuestions[activeQuestionIdx].correct;

    if (isCorrect) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);

      const dmg = 250;
      const newHp = Math.max(0, bossHp - dmg);
      setBossHp(newHp);

      const log = `Correct! You completed ${dmg} completion points of the assessment.`;
      setBattleLogs(prev => [log, ...prev]);

      if (newHp === 0) {
        const victoryLog = 'SUCCESS! You have successfully completed the Machine Learning Assessment!';
        setBattleLogs(prev => [victoryLog, ...prev]);
        onDefeatBoss(500, 'Machine Learning Master');
      } else {
        setActiveQuestionIdx(prev => Math.min(quizQuestions.length - 1, prev + 1));
      }
    } else {
      setFlashing(true);
      setTimeout(() => setFlashing(false), 500);

      const dmg = 25;
      const newShield = Math.max(0, userShield - dmg);
      setUserShield(newShield);

      const log = `Incorrect! Your confidence shield decreased by ${dmg} points.`;
      setBattleLogs(prev => [log, ...prev]);
    }
  };

  const handleReset = () => {
    setBossHp(1000);
    setUserShield(100);
    setActiveQuestionIdx(0);
    setBattleLogs([
      'Assessment reset! (1000/1000 completion points remaining)'
    ]);
  };

  const currentQuestion = quizQuestions[activeQuestionIdx];

  return (
    <div 
      className={`glass-panel boss-battle-container ${shaking ? 'anim-shake' : ''} ${flashing ? 'anim-flash' : ''}`} 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1.25rem',
        border: '3px solid #000',
        boxShadow: '6px 6px 0px #000',
        position: 'relative'
      }}
    >
      {/* Header - No double slashes */}
      <div style={{ borderBottom: '2.5px solid #000', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-pink)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          ACADEMIC MILESTONE: MACHINE LEARNING ASSESSMENT
        </h2>
        <span style={{ fontSize: '0.75rem', color: '#000', background: 'var(--accent-pink)', border: '1.5px solid #000', padding: '0.1rem 0.4rem', borderRadius: '6px', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
          RECOMMENDED FOR ADVANCED LEVEL
        </span>
      </div>

      {/* Boss Googly Eyes Representation */}
      {bossHp > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          background: 'var(--accent-gold)',
          border: '3px solid #000',
          borderRadius: '20px',
          padding: '1rem',
          boxShadow: '4px 4px 0px #000',
          height: '100px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Googly eyes */}
          <div style={{ display: 'flex', gap: '1rem', zIndex: 1 }}>
            <div style={{ width: '40px', height: '40px', background: '#fff', border: '3.5px solid #000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: '16px', height: '16px', background: '#000', borderRadius: '50%', position: 'absolute', left: shaking ? '15px' : '8px', top: '10px', transition: 'all 0.1s ease' }} />
            </div>
            <div style={{ width: '40px', height: '40px', background: '#fff', border: '3.5px solid #000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: '16px', height: '16px', background: '#000', borderRadius: '50%', position: 'absolute', left: shaking ? '8px' : '15px', top: '10px', transition: 'all 0.1s ease' }} />
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.1rem', zIndex: 1 }}>OVERFIT</span>
        </div>
      )}

      {/* Boss Stats Layout */}
      <div className="boss-battle-grid">
        
        {/* Left column: Boss Health HUD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: '#fcfcfc', border: '2.5px solid #000', padding: '1rem', borderRadius: '16px', boxShadow: '3px 3px 0px #000' }}>
          
          {/* Boss HP bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-pink)' }}>
              <span>ASSESSMENT COMPLETION</span>
              <span>{Math.round(((1000 - bossHp) / 1000) * 100)}%</span>
            </div>
            <div style={{ width: '100%', height: '14px', background: '#ffffff', border: '2px solid #000', borderRadius: '7px', overflow: 'hidden' }}>
              <div style={{
                width: `${((1000 - bossHp) / 1000) * 100}%`,
                height: '100%',
                background: 'var(--accent-pink)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* User Shield HP bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              <span>YOUR CONFIDENCE SHIELD</span>
              <span>{userShield}%</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: '#ffffff', border: '2px solid #000', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{
                width: `${userShield}%`,
                height: '100%',
                background: 'var(--accent-cyan)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </div>

        {/* Right column: Stat requirements */}
        <div style={{ background: '#fdfdfd', border: '2.5px solid #000', padding: '0.75rem', borderRadius: '16px', boxShadow: '3px 3px 0px #000', fontSize: '0.75rem', fontWeight: 800, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.3rem' }}>
          <h4 style={{ fontFamily: 'var(--font-heading)', color: '#000', marginBottom: '0.2rem' }}>REQUIRED ACADEMIC SKILLS:</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: userStats.intelligence >= 15 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
            <span>ANALYSIS &amp; TECH &gt;= 15</span>
            <span>{userStats.intelligence}/15</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: userStats.career >= 10 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
            <span>PROFESSIONAL PREP &gt;= 10</span>
            <span>{userStats.career}/10</span>
          </div>
        </div>
      </div>

      {/* Quiz Confrontation Area */}
      {bossHp > 0 && userShield > 0 && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#ffffff', border: '3px solid #000', boxShadow: '4px 4px 0px #000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '0.5rem', fontSize: '0.8rem', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
            <span style={{ color: 'var(--accent-purple)' }}>QUIZ ROUND {activeQuestionIdx + 1}/4</span>
            <span style={{ color: 'var(--text-muted)' }}>HINT: {currentQuestion.hint}</span>
          </div>
          
          <p style={{ fontSize: '0.9rem', fontWeight: 800, color: '#000', lineHeight: '1.4' }}>
            {currentQuestion.question}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {currentQuestion.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                className="cyber-btn"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  letterSpacing: '0',
                  padding: '0.65rem 1rem'
                }}
              >
                {String.fromCharCode(65 + idx)}. {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Victory / Defeat Overlay */}
      {(bossHp === 0 || userShield === 0) && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem 1rem',
          background: '#ffffff',
          borderRadius: '20px',
          border: '3px solid #000',
          boxShadow: '6px 6px 0px #000',
          textAlign: 'center'
        }}>
          {bossHp === 0 ? (
            <>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-pink)' }}>ASSESSMENT PASSED!</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                You successfully regularized Overfit the Code Monster and earned 500 Progress Score! Unlocked the <strong>Machine Learning Master</strong> milestone.
              </p>
            </>
          ) : (
            <>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-pink)' }}>CONFIDENCE CRASHED</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Your confidence shield collapsed. Review the concepts and try again!
              </p>
            </>
          )}

          <button onClick={handleReset} className="cyber-btn pink-fill" style={{ padding: '0.6rem 1.5rem' }}>
            RETRY ASSESSMENT
          </button>
        </div>
      )}

      {/* Combat Action Logs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>ASSESSMENT LOG:</h4>
        <div style={{
          background: '#fcfcfc',
          border: '2px solid #000',
          borderRadius: '10px',
          padding: '0.6rem',
          maxHeight: '80px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          {battleLogs.map((log, i) => (
            <div key={i} style={{ fontSize: '0.75rem', fontWeight: 700, color: log.startsWith('Correct!') ? 'var(--accent-green)' : log.startsWith('Incorrect!') ? 'var(--accent-pink)' : 'var(--text-secondary)' }}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
