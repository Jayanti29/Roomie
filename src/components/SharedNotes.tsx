// src/components/SharedNotes.tsx
import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, set, update, get, onChildAdded, onChildChanged, onChildRemoved } from '../firebase';
import { uploadPdf } from '../firebase';

interface StudyNote {
  id: string;
  title: string;
  content: string;
  course: string;
  author: string;
  authorEmail: string;
  likes: number;
  date: string;
  comments?: Comment[];
  pdfAttachment?: {
    name: string;
    size: string;
    url: string;
  };
}

interface Comment {
  id: string;
  author: string;
  authorEmail: string;
  text: string;
  timestamp: number;
}

interface SharedNotesProps {
  userName: string;
  userEmail: string;
  userCourse: string;
  onRewardXp: (amount: number, reason: string) => void;
  isGuest?: boolean;
  isAdmin?: boolean;
}

export const SharedNotes: React.FC<SharedNotesProps> = ({
  userName,
  userEmail,
  userCourse,
  onRewardXp,
  isGuest,
  isAdmin
}) => {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  
  // Note Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [course, setCourse] = useState(userCourse || 'General');
  const [pdfFile, setPdfFile] = useState<{ name: string; size: string; dataUrl: string } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');
  const [filterType, setFilterType] = useState<'all' | 'bookmarks' | 'my-notes'>('all');
  
  // Note details modal state
  const [activeNote, setActiveNote] = useState<StudyNote | null>(null);
  const [commentText, setCommentText] = useState('');

  // Course options
  const courseOptions = ['All', 'Computer Science', 'Mathematics', 'BCA', 'MCA', 'Engineering', 'Medical', 'Commerce', 'Management', 'Law', 'Design', 'Science', 'Agriculture', 'Education', 'Government Exams', 'General'];

  // Subscribe to Notes from RTDB
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    const notesRef = ref(db, 'shared_notes');
    
    const onNoteAdded = onChildAdded(notesRef, (snap) => {
      const val = snap.val();
      if (val) {
        setNotes(prev => {
          if (prev.some(n => n.id === val.id)) return prev;
          return [val, ...prev].sort((a, b) => b.date.localeCompare(a.date));
        });
      }
    });

    const onNoteChanged = onChildChanged(notesRef, (snap) => {
      const val = snap.val();
      if (val) {
        setNotes(prev => prev.map(n => n.id === val.id ? val : n));
        setActiveNote(current => current && current.id === val.id ? val : current);
      }
    });

    const onNoteRemoved = onChildRemoved(notesRef, (snap) => {
      const val = snap.val();
      if (val) {
        setNotes(prev => prev.filter(n => n.id !== val.id));
        setActiveNote(current => current && current.id === val.id ? null : current);
      }
    });

    // Fetch Bookmarks
    const userKey = userEmail.replace(/\./g, '_');
    get(ref(db, 'bookmarks/' + userKey)).then((snap) => {
      if (snap.exists()) {
        setBookmarks(snap.val() || []);
      }
    });

    return () => {
      onNoteAdded();
      onNoteChanged();
      onNoteRemoved();
    };
  }, [isFirebaseConfigured, userEmail]);

  // PDF Change Handler
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError('');
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported.');
      setPdfFile(null);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('PDF exceeds 2MB limit.');
      setPdfFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPdfFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        dataUrl: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  // Create Note
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot publish shared notes.");
      return;
    }
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    let pdfUrl = '';
    
    if (pdfFile) {
      try {
        pdfUrl = await uploadPdf(pdfFile.name, pdfFile.dataUrl, userEmail);
      } catch (err) {
        console.error('PDF upload failed:', err);
      }
    }

    const newNote: StudyNote = {
      id: noteId,
      title,
      content,
      course,
      author: userName,
      authorEmail: userEmail,
      likes: 0,
      date: new Date().toISOString().split('T')[0],
      comments: [],
      pdfAttachment: pdfFile ? { name: pdfFile.name, size: pdfFile.size, url: pdfUrl } : undefined
    };

    if (isFirebaseConfigured && db) {
      try {
        await set(ref(db, 'shared_notes/' + noteId), newNote);
        onRewardXp(50, `Published shared notes: "${title}" (+50 Study Points)`);
      } catch (err) {
        console.error('Database save note error:', err);
      }
    }

    setTitle('');
    setContent('');
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsSubmitting(false);
  };

  // Toggle Bookmark
  const handleToggleBookmark = async (noteId: string) => {
    let updated;
    if (bookmarks.includes(noteId)) {
      updated = bookmarks.filter(id => id !== noteId);
    } else {
      updated = [...bookmarks, noteId];
    }
    setBookmarks(updated);
    if (isFirebaseConfigured && db) {
      const userKey = userEmail.replace(/\./g, '_');
      await set(ref(db, 'bookmarks/' + userKey), updated);
    }
  };

  // Like Note
  const handleLikeNote = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    if (isFirebaseConfigured && db) {
      try {
        const noteRef = ref(db, 'shared_notes/' + noteId);
        await update(noteRef, {
          likes: (note.likes || 0) + 1
        });
      } catch (err) {
        console.error('Error liking note:', err);
      }
    }
  };

  // Add Comment
  const handleAddComment = async (noteId: string) => {
    if (!commentText.trim()) return;

    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      author: userName,
      authorEmail: userEmail,
      text: commentText,
      timestamp: Date.now()
    };

    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const updatedComments = [...(note.comments || []), newComment];

    if (isFirebaseConfigured && db) {
      try {
        await update(ref(db, 'shared_notes/' + noteId), {
          comments: updatedComments
        });
      } catch (err) {
        console.error('Error saving comment:', err);
      }
    }

    setCommentText('');
  };

  // Delete Note
  const handleDeleteNote = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    if (note.authorEmail !== userEmail && !isAdmin) {
      alert("You do not have permission to delete this note.");
      return;
    }

    if (!confirm("Are you sure you want to delete this note?")) return;

    if (isFirebaseConfigured && db) {
      try {
        await set(ref(db, 'shared_notes/' + noteId), null);
        setActiveNote(null);
      } catch (err) {
        console.error('Error deleting note:', err);
      }
    }
  };

  // Filters logic
  const filteredNotes = notes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourseFilter === 'All' || n.course === selectedCourseFilter;
    
    let matchesType = true;
    if (filterType === 'bookmarks') {
      matchesType = bookmarks.includes(n.id);
    } else if (filterType === 'my-notes') {
      matchesType = n.authorEmail === userEmail;
    }

    return matchesSearch && matchesCourse && matchesType;
  });

  return (
    <div className="notes-board-grid" style={{ paddingBottom: '2rem' }}>
      
      {/* LEFT PANEL: Create & Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Create Note Section */}
        <div className="glass-panel" style={{ background: '#fff' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, borderBottom: '2.5px solid #000', paddingBottom: '0.4rem', marginBottom: '1rem' }}>
            ✏️ SHARE STUDY MATERIAL
          </h3>
          <form onSubmit={handleCreateNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>NOTE TITLE</label>
              <input
                type="text"
                className="cyber-input"
                placeholder="e.g. DBMS Normalization Tricks"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>SUBJECT / COURSE</label>
              <select
                className="cyber-input"
                style={{ appearance: 'auto', cursor: 'pointer' }}
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              >
                {courseOptions.filter(o => o !== 'All').map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>CONTENT SUMMARY</label>
              <textarea
                className="cyber-input"
                style={{ minHeight: '120px', resize: 'vertical' }}
                placeholder="Summarize the core topics covered, key formulas, or questions here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>ATTACH STUDY PDF (MAX 2MB)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="cyber-btn"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minHeight: '36px', background: '#eae8e8' }}
                >
                  SELECT FILE
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pdfFile ? pdfFile.name : 'No file chosen'}
                </span>
              </div>
              {uploadError && <span style={{ fontSize: '0.7rem', color: 'var(--accent-pink)', fontWeight: 800 }}>{uploadError}</span>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="cyber-btn pink-fill"
              style={{ width: '100%', marginTop: '0.5rem', border: '3.5px solid #000', boxShadow: '4px 4px 0px #000' }}
            >
              {isSubmitting ? 'UPLOADING...' : 'PUBLISH RESOURCE'}
            </button>
          </form>
        </div>

        {/* Filter Notes Section */}
        <div className="glass-panel" style={{ background: '#fff' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, borderBottom: '2.5px solid #000', paddingBottom: '0.4rem', marginBottom: '1rem' }}>
            🔍 SEARCH & FILTER
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <input
              type="text"
              className="cyber-input"
              placeholder="Search title, content, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800 }}>SUBJECT TAG</label>
              <select
                className="cyber-input"
                style={{ appearance: 'auto', cursor: 'pointer' }}
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
              >
                {courseOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', border: '2px solid #000', borderRadius: '10px', overflow: 'hidden' }}>
              {(['all', 'bookmarks', 'my-notes'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  style={{
                    flex: 1,
                    background: filterType === type ? 'var(--accent-cyan)' : '#fff',
                    border: 'none',
                    borderRight: type !== 'my-notes' ? '2px solid #000' : 'none',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '0.5rem 0',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {type === 'all' ? 'ALL' : type === 'bookmarks' ? 'SAVED' : 'MINE'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Shared Resources List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="glass-panel" style={{ background: '#fff', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 900, borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
            📚 ACADEMIC STUDY SHELF
          </h3>

          {filteredNotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontWeight: 800 }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
              No study materials found matching the filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', overflowY: 'auto', maxHeight: '700px', paddingRight: '0.25rem' }}>
              {filteredNotes.map(note => (
                <div
                  key={note.id}
                  className="anim-pop"
                  style={{
                    border: '3px solid #000',
                    borderRadius: '16px',
                    padding: '1rem',
                    background: '#fffcf5',
                    boxShadow: '3px 3px 0px #000',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveNote(note)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      background: 'var(--accent-purple)',
                      border: '1.5px solid #000',
                      borderRadius: '4px',
                      padding: '0.1rem 0.4rem'
                    }}>
                      {note.course.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                      {note.date}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, color: '#000', marginBottom: '0.2rem' }}>
                      {note.title}
                    </h4>
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.4',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {note.content}
                    </p>
                  </div>

                  {note.pdfAttachment && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1.5px solid #000', background: '#eaeaea', padding: '0.35rem 0.5rem', borderRadius: '6px', width: 'fit-content' }}>
                      <span style={{ fontSize: '0.9rem' }}>📄</span>
                      <strong style={{ fontSize: '0.7rem', color: '#000' }}>{note.pdfAttachment.name}</strong>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>({note.pdfAttachment.size})</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1.5px solid #eee', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                      ✍️ By: {note.author}
                    </span>
                    
                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleLikeNote(note.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 800 }}
                      >
                        👍 {note.likes || 0}
                      </button>
                      <button
                        onClick={() => handleToggleBookmark(note.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                      >
                        {bookmarks.includes(note.id) ? '⭐' : '☆'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DETAIL MODAL DISPLAY */}
      {activeNote && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setActiveNote(null)}>
          
          <div className="glass-panel anim-pop" style={{
            maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
            background: '#fff', border: '3.5px solid #000', borderRadius: '20px',
            padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
            textAlign: 'left'
          }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #000', paddingBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.65rem', background: 'var(--accent-gold)', border: '1.5px solid #000', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 900, marginRight: '0.5rem' }}>
                  {activeNote.course.toUpperCase()}
                </span>
                <strong style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)', color: '#000', display: 'block', marginTop: '0.25rem' }}>{activeNote.title}</strong>
              </div>
              <button
                onClick={() => setActiveNote(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 900 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
              {activeNote.content}
            </div>

            {activeNote.pdfAttachment && (
              <div style={{
                border: '2.5px solid #000', background: '#fffcf0', padding: '0.75rem',
                borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>📄</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontSize: '0.8rem' }}>{activeNote.pdfAttachment.name}</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>PDF Size: {activeNote.pdfAttachment.size}</span>
                  </div>
                </div>
                <a
                  href={activeNote.pdfAttachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="cyber-btn"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'var(--accent-cyan)' }}
                >
                  DOWNLOAD
                </a>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #000', paddingTop: '0.6rem', fontSize: '0.75rem', fontWeight: 800 }}>
              <span>✍️ Posted by: {activeNote.author} ({activeNote.authorEmail})</span>
              {(activeNote.authorEmail === userEmail || isAdmin) && (
                <button
                  onClick={() => handleDeleteNote(activeNote.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', fontWeight: 900 }}
                >
                  DELETE NOTE
                </button>
              )}
            </div>

            {/* Comments Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 900 }}>COMMENTS ({(activeNote.comments || []).length})</h5>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto' }}>
                {!(activeNote.comments) || activeNote.comments.length === 0 ? (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No comments yet. Write the first one!</span>
                ) : (
                  activeNote.comments.map(c => (
                    <div key={c.id} style={{ background: '#f8f9fa', border: '1.5px solid #000', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: '2px', fontSize: '0.65rem' }}>
                        <span>{c.author}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{new Date(c.timestamp).toLocaleDateString()}</span>
                      </div>
                      <span style={{ color: '#333' }}>{c.text}</span>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="text"
                  className="cyber-input"
                  style={{ flex: 1 }}
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button
                  onClick={() => handleAddComment(activeNote.id)}
                  className="cyber-btn purple-fill"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minHeight: '38px' }}
                >
                  POST
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
