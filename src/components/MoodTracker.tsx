import React, { useState, useEffect } from 'react';
import { Smile, Heart, Users, MessageSquare, Trash2, Send, ShieldAlert } from 'lucide-react';
import { db, isFirebaseConfigured, ref, push, onValue, remove } from '../firebase';

interface MoodItem {
  id: string;
  sender: string;
  senderEmail: string;
  emoji: string;
  label: string;
  note: string;
  timestamp: number;
}

interface MoodTrackerProps {
  userEmail: string;
  userName: string;
  onRewardXp?: (amount: number, reason: string) => void;
}

const MOOD_OPTIONS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '😩', label: 'Stressed' },
  { emoji: '🧠', label: 'Focused' },
  { emoji: '🍕', label: 'Hungry' },
  { emoji: '☕', label: 'Chill' }
];

export const MoodTracker: React.FC<MoodTrackerProps> = ({ userEmail, userName, onRewardXp }) => {
  const [moodList, setMoodList] = useState<MoodItem[]>([]);
  const [selectedMood, setSelectedMood] = useState(MOOD_OPTIONS[0]);
  const [moodNote, setMoodNote] = useState('');

  // Load moods
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      // Fallback mock flatmate moods
      setMoodList([
        {
          id: 'mood_1',
          sender: 'Cleo the Organizer',
          senderEmail: 'cleo@roomie.com',
          emoji: '🧠',
          label: 'Focused',
          note: 'Polishing up the semester project, do not disturb!',
          timestamp: Date.now() - 3600 * 1000
        },
        {
          id: 'mood_2',
          sender: 'Sam the Chef',
          senderEmail: 'sam@roomie.com',
          emoji: '🍕',
          label: 'Hungry',
          note: 'Making pizza dough in 30 mins, who wants in?',
          timestamp: Date.now() - 1800 * 1000
        }
      ]);
      return;
    }

    const moodsRef = ref(db, 'roommate_moods');
    const unsub = onValue(moodsRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        // Sort by timestamp descending
        list.sort((a, b) => b.timestamp - a.timestamp);
        setMoodList(list);
      } else {
        setMoodList([]);
      }
    });

    return () => unsub();
  }, []);

  const handlePostMood = async (e: React.FormEvent) => {
    e.preventDefault();

    const newMood: Omit<MoodItem, 'id'> = {
      sender: userName || userEmail.split('@')[0],
      senderEmail: userEmail,
      emoji: selectedMood.emoji,
      label: selectedMood.label,
      note: moodNote.trim(),
      timestamp: Date.now()
    };

    if (isFirebaseConfigured && db) {
      const moodsRef = ref(db, 'roommate_moods');
      await push(moodsRef, newMood);
    } else {
      setMoodList(prev => [
        {
          id: 'mood_' + Date.now(),
          ...newMood
        },
        ...prev
      ]);
    }

    setMoodNote('');
    if (onRewardXp) {
      onRewardXp(10, 'Updated Flat Mood Vibe');
    }
  };

  const handleDeleteMood = async (id: string) => {
    if (isFirebaseConfigured && db) {
      await remove(ref(db, `roommate_moods/${id}`));
    } else {
      setMoodList(prev => prev.filter(m => m.id !== id));
    }
  };

  // Calculate flat vibe index
  const getFlatVibeMessage = () => {
    if (moodList.length === 0) return 'No vibes logged yet!';
    const stressedCount = moodList.filter(m => m.label === 'Stressed').length;
    const tiredCount = moodList.filter(m => m.label === 'Tired').length;
    const happyCount = moodList.filter(m => m.label === 'Happy' || m.label === 'Chill').length;
    const focusedCount = moodList.filter(m => m.label === 'Focused').length;

    if (stressedCount > moodList.length / 2) return 'Flat Status: Stressed but trying! Send cookies.';
    if (tiredCount > moodList.length / 2) return 'Flat Status: In hibernation mode. Low energy.';
    if (focusedCount > moodList.length / 2) return 'Flat Status: High academic grind. Silence in halls!';
    if (happyCount > moodList.length / 2) return 'Flat Status: Positive vibes! Great time for flat dinner.';
    return 'Flat Status: Harmonious blend of study and chill.';
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
      
      {/* Vibe banner */}
      <div className="card-flat" style={{ background: 'linear-gradient(135deg, #fdf2f8 0%, #ede9fe 100%)', border: '3px solid #0f172a', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Smile size={24} style={{ color: 'var(--accent-pink)' }} /> Flatmate Vibe Check & Moods
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '750px', fontWeight: 600 }}>
          Let your roommates know how you are feeling without sending long messages. Check flat aggregate vibe levels, support stressed mates, or join focused study sessions.
        </p>
        
        {/* Collective Flat Vibe Indicator */}
        <div style={{
          marginTop: '0.8rem',
          background: '#fff',
          border: '2px solid #0f172a',
          padding: '0.4rem 0.8rem',
          borderRadius: '6px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.8rem',
          fontWeight: 900,
          color: '#0f172a',
          boxShadow: '2px 2px 0px #0f172a'
        }}>
          <Users size={14} /> {getFlatVibeMessage()}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left: Log Vibe Card */}
        <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Heart size={18} style={{ color: 'var(--accent-pink)' }} /> Set Current Vibe
          </h3>

          <form onSubmit={handlePostMood} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            
            {/* Emoji Grid Selector */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '5px' }}>How are you feeling?</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {MOOD_OPTIONS.map((opt) => {
                  const isSelected = selectedMood.label === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setSelectedMood(opt)}
                      style={{
                        padding: '0.6rem 0.4rem',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #0f172a' : '2px solid var(--outline-thin)',
                        background: isSelected ? 'var(--accent-primary-light)' : '#fff',
                        boxShadow: isSelected ? '2px 2px 0px #0f172a' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{opt.emoji}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900 }}>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Optional Vibe Note</label>
              <input
                type="text"
                value={moodNote}
                onChange={e => setMoodNote(e.target.value)}
                placeholder="e.g. Prepping for bio quiz / Needs flat dinner soon..."
                maxLength={80}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '2px solid #0f172a',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '0.6rem', fontWeight: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <Send size={14} /> Update Vibe
            </button>
          </form>
        </div>

        {/* Right: Mood/Vibes Feed */}
        <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Users size={18} /> Flatmate Mood Board
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', flex: 1 }}>
            {moodList.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '3rem 1rem', border: '2px dashed var(--outline-thin)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                <ShieldAlert size={28} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Nobody has shared their vibe yet today.</span>
              </div>
            ) : (
              moodList.map((mood) => {
                const isUserMood = mood.senderEmail === userEmail;
                return (
                  <div
                    key={mood.id}
                    style={{
                      border: '2px solid #0f172a',
                      borderRadius: '8px',
                      padding: '0.6rem 0.8rem',
                      background: '#fff',
                      boxShadow: '2px 2px 0px #0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      position: 'relative'
                    }}
                  >
                    <div style={{
                      fontSize: '2rem',
                      background: 'var(--bg-main)',
                      padding: '0.2rem',
                      borderRadius: '6px',
                      border: '1.5px solid #0f172a'
                    }}>
                      {mood.emoji}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a' }}>{mood.sender}</span>
                        <span style={{
                          fontSize: '0.6rem',
                          fontWeight: 900,
                          background: '#e2e8f0',
                          border: '1px solid #0f172a',
                          padding: '1px 5px',
                          borderRadius: '3px'
                        }}>
                          {mood.label}
                        </span>
                      </div>
                      
                      {mood.note && (
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MessageSquare size={10} /> "{mood.note}"
                        </p>
                      )}
                      
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, marginTop: '2px' }}>
                        {new Date(mood.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {isUserMood && (
                      <button
                        onClick={() => handleDeleteMood(mood.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          alignSelf: 'flex-start'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
