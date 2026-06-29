import React, { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Plus, Trash2, Calendar, Smile, ShieldAlert } from 'lucide-react';
import { db, isFirebaseConfigured, ref, push, onValue, remove } from '../firebase';

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  date: string;
  imageUrl?: string;
  likes: number;
  author: string;
}

interface MemoriesProps {
  userEmail: string;
  userName: string;
  onRewardXp?: (amount: number, reason: string) => void;
}

const CATEGORIES = ['All', 'Flat Dinner', 'Outing', 'Meme', 'Meeting', 'Milestone'];

export const Memories: React.FC<MemoriesProps> = ({ userEmail, userName, onRewardXp }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  
  // New entry form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Flat Dinner');
  const [imageFile, setImageFile] = useState<string | null>(null);

  // Load journal entries
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      // Mock fallback state
      setEntries([
        {
          id: 'mem_1',
          title: 'First Flat Dinner!',
          content: 'We made homemade pizzas from scratch. Burned the first one, but the rest were delicious! Clean up duty was fun too.',
          category: 'Flat Dinner',
          date: '2026-06-25',
          likes: 4,
          author: 'Cleo the Organizer',
          imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23fee2e2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%23ef4444">🍕 Homemade Pizza Night</text></svg>'
        },
        {
          id: 'mem_2',
          title: 'Sunday Hiking Outing',
          content: 'Hiked up to the peak. Absolute windstorm but the view was breathtaking. Sam lost his beanie to the wind!',
          category: 'Outing',
          date: '2026-06-28',
          likes: 3,
          author: 'Sam the Chef',
          imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23dcfce7"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%2310b981">⛰ Windy Mountain Hike</text></svg>'
        }
      ]);
      return;
    }

    const journalRef = ref(db, 'roommate_journal');
    const unsub = onValue(journalRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        // Sort by date descending
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEntries(list);
      } else {
        setEntries([]);
      }
    });

    return () => unsub();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert file to Base64 to support instant local rendering & database sync
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageFile(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newEntry: Omit<JournalEntry, 'id' | 'likes'> = {
      title,
      content,
      category,
      date: new Date().toISOString().split('T')[0],
      author: userName || userEmail.split('@')[0],
      imageUrl: imageFile || undefined
    };

    if (isFirebaseConfigured && db) {
      const journalRef = ref(db, 'roommate_journal');
      await push(journalRef, {
        ...newEntry,
        likes: 0
      });
    } else {
      setEntries(prev => [
        {
          id: 'mem_' + Date.now(),
          ...newEntry,
          likes: 0
        },
        ...prev
      ]);
    }

    // Reset Form
    setTitle('');
    setContent('');
    setImageFile(null);

    if (onRewardXp) {
      onRewardXp(20, 'Logged a new Flat Memory');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (isFirebaseConfigured && db) {
      await remove(ref(db, `roommate_journal/${id}`));
    } else {
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  // Filter entries
  const filteredEntries = activeCategory === 'All'
    ? entries
    : entries.filter(e => e.category === activeCategory);

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
      
      {/* Banner */}
      <div className="card-flat" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fee2e2 100%)', border: '3px solid #0f172a', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Smile size={24} style={{ color: 'var(--accent-pink)' }} /> Flatmate Journal & Memories
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '750px', fontWeight: 600 }}>
          Capture the best moments of your shared living space. Share cooking mishaps, flat outing snapshots, cute quotes, and track memories together.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left: Memory Form */}
        <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={18} /> Log a Flat Memory
          </h3>
          <form onSubmit={handleAddEntry} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Memory Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Board Game Night Showdown..."
                required
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
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '2px solid #0f172a',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: '#fff'
                  }}
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Photo (Optional)</label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  background: '#f8fafc',
                  border: '2px dashed #94a3b8',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textAlign: 'center'
                }}>
                  <Camera size={14} /> Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {imageFile && (
              <div style={{ position: 'relative', marginTop: '0.4rem' }}>
                <img
                  src={imageFile}
                  alt="Preview"
                  style={{
                    width: '100%',
                    maxHeight: '150px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    border: '2px solid #0f172a'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setImageFile(null)}
                  style={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    background: '#ef4444',
                    color: '#fff',
                    border: '2px solid #0f172a',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900
                  }}
                >
                  X
                </button>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Description / Story</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Tell the story behind this memory. What happened? Who said what?"
                required
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '2px solid #0f172a',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  resize: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '0.6rem', fontWeight: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <ImageIcon size={16} /> Save Memory
            </button>
          </form>
        </div>

        {/* Right: Memories List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '20px',
                  border: '2px solid #0f172a',
                  fontSize: '0.75rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  background: activeCategory === cat ? 'var(--accent-secondary-light)' : '#fff',
                  boxShadow: activeCategory === cat ? '2px 2px 0px #0f172a' : 'none',
                  transform: activeCategory === cat ? 'translateY(-1px)' : 'none'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Polaroid/Journal Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredEntries.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '3rem 1rem', border: '2px dashed var(--outline-thin)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                <ShieldAlert size={28} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>No memories logged in this category.</span>
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="card-flat"
                  style={{
                    border: '3px solid #0f172a',
                    padding: '1rem',
                    background: '#fff',
                    boxShadow: '4px 4px 0px #0f172a',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.8rem',
                    position: 'relative'
                  }}
                >
                  
                  {/* Polaroid Photo Style container */}
                  {entry.imageUrl && (
                    <div style={{
                      background: '#f8fafc',
                      border: '2px solid #0f172a',
                      padding: '0.5rem 0.5rem 1.5rem 0.5rem',
                      boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.1)'
                    }}>
                      <img
                        src={entry.imageUrl}
                        alt={entry.title}
                        style={{
                          width: '100%',
                          maxHeight: '220px',
                          objectFit: 'cover',
                          border: '1px solid #cbd5e1'
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 900,
                        background: 'var(--accent-primary-light)',
                        border: '1px solid #0f172a',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {entry.category}
                      </span>
                      
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <h4 style={{ fontSize: '1.1rem', fontWeight: 900, marginTop: '0.4rem', color: '#0f172a' }}>
                      {entry.title}
                    </h4>

                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: '1.4' }}>
                      {entry.content}
                    </p>
                  </div>

                  {/* Polaroid text signature */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '2px solid #f1f5f9',
                    paddingTop: '0.6rem',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={12} /> {entry.date}
                    </span>
                    <span>
                      Logged by: <strong style={{ color: '#0f172a' }}>{entry.author}</strong>
                    </span>
                  </div>

                </div>
              ))
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
