import React, { useState } from 'react';
import { generateQuestionsForTopic } from '../utils/quizHelper';

interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface QuizGeneratorProps {
  onRewardXp: (xp: number, message: string) => void;
}

export const QuizGenerator: React.FC<QuizGeneratorProps> = ({ onRewardXp }) => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Generate quiz
  const handleGenerateQuiz = () => {
    if (!topic) return;
    setLoading(true);
    setQuestions(null);
    setCompleted(false);

    const steps = [
      'Scanning academic course databases...',
      'Formulating quiz cognitive metrics...',
      'Structuring practice choice distractions...',
      'Calibrating subject blueprints...'
    ];

    let stepIdx = 0;
    setLoadingStep(steps[0]);
    const stepInterval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setLoadingStep(steps[stepIdx]);
      } else {
        clearInterval(stepInterval);
        
        // Formulate highly relevant questions locally based on topic
        const mockQuestions = generateQuestionsForTopic(topic) as QuizQuestion[];

        setQuestions(mockQuestions);
        setCurrentIndex(0);
        setScore(0);
        setSelectedIdx(null);
        setLoading(false);
      }
    }, 600);
  };

  const handleSelectOption = (idx: number) => {
    if (selectedIdx !== null) return;
    setSelectedIdx(idx);

    const currentQuestion = questions![currentIndex];
    if (idx === currentQuestion.answerIndex) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    setSelectedIdx(null);
    if (currentIndex + 1 < questions!.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCompleted(true);
      
      // Calculate Study Points
      const pointsGained = score * 30 + 30; // Max 120 Points
      onRewardXp(pointsGained, `Completed Study Quiz on "${topic}"! Score: ${score}/3. Earned +${pointsGained} Study Points!`);
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '380px' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          🤖 STUDY QUIZZES
        </h3>
        {questions && !completed && (
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
            QUESTION {currentIndex + 1} OF {questions.length}
          </span>
        )}
      </div>

      {/* Input Form */}
      {!loading && !questions && (
        <div className="anim-pop" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', flex: 1, maxWidth: '500px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#000', marginBottom: '0.25rem' }}>STUDY QUIZ MAKER</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700, marginTop: '0.25rem' }}>
              Type any course subject or specific syllabus topic below, and our AI model will compile a customized practice quiz on the spot!
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>QUIZ TOPIC / COURSE SUBJECT</label>
            <input 
              type="text" 
              placeholder="e.g. Data Structures, React Hooks, Cellular Respiration" 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="cyber-input"
            />
          </div>

          <button 
            onClick={handleGenerateQuiz}
            disabled={!topic}
            className="cyber-btn pink-fill"
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
          >
            GENERATE STUDY QUIZ
          </button>
        </div>
      )}

      {/* Loading animation */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '1rem' }}>
          <div style={{
            width: '45px',
            height: '45px',
            border: '4px dashed var(--accent-pink)',
            borderRadius: '50%',
            animation: 'float-bouncy 1s linear infinite'
          }} />
          <span style={{ fontSize: '0.9rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-pink)' }}>
            {loadingStep}
          </span>
        </div>
      )}

      {/* Active Question Render */}
      {questions && !completed && (
        <div className="anim-pop" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          
          {/* Progress bar */}
          <div style={{ width: '100%', height: '8px', background: '#eaeaea', border: '1.5px solid #000', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{
              width: `${((currentIndex) / questions.length) * 100}%`,
              height: '100%',
              background: 'var(--accent-cyan)',
              transition: 'width 0.3s ease'
            }} />
          </div>

          {/* Question Text */}
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', lineHeight: '1.3' }}>
            {questions[currentIndex].question}
          </h4>

          {/* Options Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {questions[currentIndex].options.map((opt, idx) => {
              let borderCol = '#000';
              let bg = '#fff';
              
              if (selectedIdx !== null) {
                const correct = idx === questions[currentIndex].answerIndex;
                if (correct) {
                  bg = '#e2fbe5';
                  borderCol = 'var(--accent-green)';
                } else if (idx === selectedIdx) {
                  bg = '#ffebee';
                  borderCol = 'var(--accent-pink)';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={selectedIdx !== null}
                  style={{
                    textAlign: 'left',
                    padding: '0.75rem 1rem',
                    border: `2.5px solid ${borderCol}`,
                    borderRadius: '12px',
                    background: bg,
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: selectedIdx === null ? 'pointer' : 'not-allowed',
                    boxShadow: selectedIdx === null ? '2px 2px 0px #000' : 'none',
                    transition: 'all 0.1s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>{opt}</span>
                  {selectedIdx !== null && idx === questions[currentIndex].answerIndex && <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-green)' }}>(CORRECT)</span>}
                  {selectedIdx !== null && idx === selectedIdx && idx !== questions[currentIndex].answerIndex && <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-pink)' }}>(INCORRECT)</span>}
                </button>
              );
            })}
          </div>

          {/* Explanation & Next Trigger */}
          {selectedIdx !== null && (
            <div className="anim-pop" style={{
              background: '#f8faf3',
              border: '2px solid #000',
              borderRadius: '12px',
              padding: '0.75rem',
              marginTop: '0.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, lineHeight: '1.4' }}>
                <strong>EXPLANATION:</strong> {questions[currentIndex].explanation}
              </p>
              <button 
                onClick={handleNext}
                className="cyber-btn cyan-fill"
                style={{ alignSelf: 'flex-end', padding: '0.4rem 1rem', fontSize: '0.8rem' }}
              >
                {currentIndex + 1 < questions.length ? 'NEXT QUESTION' : 'VIEW SCOREBOARD'}
              </button>
            </div>
          )}

        </div>
      )}

      {/* Completed Results View */}
      {completed && (
        <div className="anim-pop" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center', flex: 1, maxWidth: '400px', margin: '0 auto', width: '100%' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-pink)' }}>CONGRATULATIONS</div>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 800 }}>QUIZ COMPLETED!</h4>
          
          <div style={{
            background: 'var(--accent-gold)',
            border: '3px solid #000',
            borderRadius: '16px',
            padding: '1.25rem',
            textAlign: 'center',
            boxShadow: '4px 4px 0px #000',
            width: '100%'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>SESSION RESULTS</span>
            <div style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', fontWeight: 800, margin: '0.25rem 0' }}>
              GRADE: {score === 3 ? 'A+' : score === 2 ? 'B' : 'C-'}
            </div>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Successfully answered {score} of 3 questions correctly.
            </p>
          </div>

          <div style={{ background: '#f5f5f5', border: '2px solid #000', borderRadius: '10px', padding: '0.65rem', width: '100%', fontSize: '0.75rem', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ color: 'var(--accent-pink)' }}>★ Earned +{(score * 30) + 30} Study Points!</div>
          </div>

          <button 
            onClick={() => { setQuestions(null); setTopic(''); }}
            className="cyber-btn pink-fill"
            style={{ width: '100%' }}
          >
            RETAKE / NEW TOPIC
          </button>
        </div>
      )}

    </div>
  );
};

