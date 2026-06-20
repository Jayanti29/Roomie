import React, { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, ref, get, set, update, onChildAdded, onChildChanged, onChildRemoved, uploadFile } from '../firebase';

interface Comment {
  id: string;
  author: string;
  authorEmail: string;
  text: string;
  timestamp: number;
}

interface StudyNote {
  id: string;
  title: string;
  content: string;
  course: string;
  author: string;
  authorEmail: string;
  likes: number;
  date: string;
  comments: Comment[];
  pdfAttachment?: {
    name: string;
    size: string;
    url: string;
  };
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
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [course, setCourse] = useState(userCourse || 'Computer Science');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');
  const [filterType, setFilterType] = useState<'all' | 'bookmarks' | 'my-notes' | 'shared-with-me'>('all');
  
  // Note details modal state
  const [activeNote, setActiveNote] = useState<StudyNote | null>(null);
  const [commentText, setCommentText] = useState('');

  // Personal Note Sharing States
  const [sharedWithMeNotes, setSharedWithMeNotes] = useState<StudyNote[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [noteToShare, setNoteToShare] = useState<StudyNote | null>(null);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<{ email: string; name: string }[]>([]);
  const [selectedClassmate, setSelectedClassmate] = useState<{ email: string; name: string } | null>(null);
  const [sharingError, setSharingError] = useState('');
  const [sharingSuccess, setSharingSuccess] = useState(false);

  // Preview DataURL loader for mock/local files
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeNote && activeNote.pdfAttachment) {
      const url = activeNote.pdfAttachment.url;
      if (url.startsWith('mock-file-url:')) {
        const mockId = url.split(':')[1];
        if (isFirebaseConfigured && db) {
          get(ref(db, 'pdf_contents/' + mockId)).then(snap => {
            if (snap.exists()) {
              setPreviewDataUrl(snap.val());
            }
          });
        }
      } else {
        setPreviewDataUrl(url);
      }
    } else {
      setPreviewDataUrl(null);
    }
  }, [activeNote]);

  const isImageFile = (name: string) => {
    const ext = name.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');
  };

  const isPdfFile = (name: string) => {
    return name.toLowerCase().endsWith('.pdf');
  };

  const loadUsers = async () => {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await get(ref(db, 'users'));
        if (snap.exists()) {
          const val = snap.val();
          const list = Object.values(val).map((u: any) => ({
            email: u.email,
            name: u.name
          }));
          setAllUsers(list);
        }
      } catch (err) {
        console.error('Error loading users:', err);
      }
    }
  };

  const handleOpenShareModal = (note: StudyNote) => {
    setNoteToShare(note);
    setShareModalOpen(true);
    setShareSearchQuery('');
    setSelectedClassmate(null);
    setSharingError('');
    setSharingSuccess(false);
    loadUsers();
  };

  const handleShareNoteSubmit = async () => {
    if (!noteToShare || !selectedClassmate) return;
    if (isGuest) {
      alert("Guest accounts cannot share notes.");
      return;
    }

    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const receiverKey = selectedClassmate.email.replace(/\./g, '_');
    
    // Store reference pointer pointing to the original shared note instead of duplicating
    const sharedData = {
      ...noteToShare,
      id: shareId,
      originalNoteId: noteToShare.id,
      receiverEmail: selectedClassmate.email,
      receiverName: selectedClassmate.name,
      date: new Date().toISOString().split('T')[0]
    };

    if (isFirebaseConfigured && db) {
      try {
        await set(ref(db, `note_shares/${receiverKey}/${shareId}`), sharedData);
        setSharingSuccess(true);
        setTimeout(() => {
          setShareModalOpen(false);
          setNoteToShare(null);
        }, 1500);
      } catch (err) {
        console.error('Error sharing note:', err);
        setSharingError('Failed to share note.');
      }
    }
  };

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

    // Subscribe to note shares
    const myShareKey = userEmail.replace(/\./g, '_');
    const sharesRef = ref(db, `note_shares/${myShareKey}`);
    const onShareAdded = onChildAdded(sharesRef, (snap) => {
      const val = snap.val();
      if (val) {
        setSharedWithMeNotes(prev => {
          if (prev.some(n => n.id === val.id)) return prev;
          return [val, ...prev].sort((a, b) => b.date.localeCompare(a.date));
        });
      }
    });

    const onShareChanged = onChildChanged(sharesRef, (snap) => {
      const val = snap.val();
      if (val) {
        setSharedWithMeNotes(prev => prev.map(n => n.id === val.id ? val : n));
        setActiveNote(current => current && current.id === val.id ? val : current);
      }
    });

    const onShareRemoved = onChildRemoved(sharesRef, (snap) => {
      const val = snap.val();
      if (val) {
        setSharedWithMeNotes(prev => prev.filter(n => n.id !== val.id));
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
      onShareAdded();
      onShareChanged();
      onShareRemoved();
    };
  }, [isFirebaseConfigured, userEmail]);

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError('');
    if (!file) return;

    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const lowerName = file.name.toLowerCase();
    const isAllowedType = allowedExtensions.some(ext => lowerName.endsWith(ext)) || 
      file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
      file.type === 'text/plain' || 
      file.type.startsWith('image/');

    if (!isAllowedType) {
      setUploadError('File type not supported. Supported formats: PDF, DOCX, PPTX, TXT, and Images.');
      setPdfFile(null);
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setUploadError('File exceeds 100MB limit.');
      setPdfFile(null);
      return;
    }

    setPdfFile(file);
  };

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
        pdfUrl = await uploadFile(pdfFile, pdfFile.name, userEmail);
      } catch (err) {
        console.error('File upload failed:', err);
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
      pdfAttachment: pdfFile ? { 
        name: pdfFile.name, 
        size: pdfFile.size > 1024 * 1024 ? (pdfFile.size / (1024 * 1024)).toFixed(1) + ' MB' : (pdfFile.size / 1024).toFixed(1) + ' KB', 
        url: pdfUrl 
      } : undefined
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

  const handleDownloadFile = async (attachment: { name: string; url: string }) => {
    if (!attachment || !attachment.url) return;
    const url = attachment.url;
    const fileName = attachment.name;

    if (url.startsWith('mock-file-url:')) {
      const mockId = url.split(':')[1];
      if (isFirebaseConfigured && db) {
        try {
          const snap = await get(ref(db, 'pdf_contents/' + mockId));
          if (snap.exists()) {
            const dataUrl = snap.val();
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = fileName;
            link.click();
          } else {
            alert("File content not found in mock database.");
          }
        } catch (e) {
          console.error("Error downloading mock file:", e);
        }
      }
    } else {
      // Secure download handler: open cleanly in a new window or silent anchor element without router intercepts
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const sourceNotes = filterType === 'shared-with-me' ? sharedWithMeNotes : notes;
  const filteredNotes = sourceNotes.filter(n => {
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
    <div className="notes-board-grid" style={{ paddingBottom: '2rem', textAlign: 'left' }}>
      
      {/* LEFT PANEL: Create & Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Create Note Section */}
        <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#0f172a' }}>
            Share Study Material
          </h3>
          <form onSubmit={handleCreateNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Note Title</label>
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
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Subject / Course</label>
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
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Content Summary</label>
              <textarea
                className="cyber-input"
                style={{ minHeight: '100px', resize: 'vertical' }}
                placeholder="Summarize the core topics covered, key formulas, or questions here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Attach Study Resource (PDF/Images/Docx up to 100MB)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="cyber-btn"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minHeight: '36px', background: '#eae8e8' }}
                >
                  Select File
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={handlePdfUpload}
                />
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pdfFile ? pdfFile.name : 'No file chosen'}
                </span>
              </div>
              {uploadError && <span style={{ fontSize: '0.7rem', color: 'var(--accent-pink)', fontWeight: 700 }}>{uploadError}</span>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="cyber-btn pink-fill"
              style={{ width: '100%', marginTop: '0.5rem', fontWeight: 700 }}
            >
              {isSubmitting ? 'Uploading resource...' : 'Publish Study Material'}
            </button>
          </form>
        </div>

        {/* Filter Notes Section */}
        <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#0f172a' }}>
            Filter Shelf
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <input
              type="text"
              className="cyber-input"
              placeholder="Search title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Subject Filter</label>
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

            <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', flexWrap: 'wrap' }}>
              {(['all', 'bookmarks', 'my-notes', 'shared-with-me'] as const).map((type, idx) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  style={{
                    flex: 1,
                    minWidth: '50px',
                    background: filterType === type ? 'var(--accent-primary-light)' : '#fff',
                    border: 'none',
                    borderRight: idx !== 3 ? '1px solid #e2e8f0' : 'none',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: filterType === type ? 'var(--accent-primary)' : 'var(--text-muted)',
                    padding: '0.5rem 0.25rem',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {type === 'all' ? 'All' : type === 'bookmarks' ? 'Saved' : type === 'my-notes' ? 'Mine' : 'Shared'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Shared Resources List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="glass-panel" style={{ background: '#fff', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', color: '#0f172a' }}>
            Academic Study Shelf
          </h3>

          {filteredNotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              No study materials found matching the filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', overflowY: 'auto', maxHeight: '700px', paddingRight: '0.25rem' }}>
              {filteredNotes.map(note => (
                <div
                  key={note.id}
                  className="anim-pop"
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1rem',
                    background: '#ffffff',
                    boxShadow: 'var(--shadow-flat-sm)',
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
                      fontWeight: 800,
                      background: 'var(--accent-primary-light)',
                      color: 'var(--accent-primary)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px'
                    }}>
                      {note.course.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {note.date}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem' }}>
                      {note.title}
                    </h4>
                    <p style={{
                      fontSize: '0.8rem',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #cbd5e1', background: '#f8fafc', padding: '0.35rem 0.5rem', borderRadius: '6px', width: 'fit-content' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{note.pdfAttachment.name}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({note.pdfAttachment.size})</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      By: {note.author}
                    </span>
                    
                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleLikeNote(note.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}
                      >
                        Like {note.likes || 0}
                      </button>
                      <button
                        onClick={() => handleToggleBookmark(note.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                      >
                        {bookmarks.includes(note.id) ? 'Saved' : 'Save'}
                      </button>
                      <button
                        onClick={() => handleOpenShareModal(note)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                        title="Share Note"
                      >
                        Share
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
          background: 'rgba(15,23,42,0.4)', zIndex: 999999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setActiveNote(null)}>
          
          <div className="glass-panel anim-pop" style={{
            maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
            background: '#fff', border: '1px solid #cbd5e1', borderRadius: '16px',
            padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
            textAlign: 'left', boxShadow: 'var(--shadow-flat-lg)'
          }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.65rem', background: 'var(--accent-primary-light)', color: 'var(--accent-primary)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700, marginRight: '0.5rem' }}>
                  {activeNote.course.toUpperCase()}
                </span>
                <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-heading)', color: '#0f172a', display: 'block', marginTop: '0.25rem' }}>{activeNote.title}</strong>
              </div>
              <button
                onClick={() => setActiveNote(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 900 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
              {activeNote.content}
            </div>

            {activeNote.pdfAttachment && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid #cbd5e1', padding: '1rem', borderRadius: '8px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block' }}>{activeNote.pdfAttachment.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Size: {activeNote.pdfAttachment.size}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleDownloadFile(activeNote.pdfAttachment!)}
                      className="cyber-btn cyan-fill"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', minHeight: 'auto' }}
                    >
                      Download
                    </button>
                  </div>
                </div>

                {/* Inline Previewer */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                  {isImageFile(activeNote.pdfAttachment.name) ? (
                    <img 
                      src={previewDataUrl || ''} 
                      alt="Attachment Preview" 
                      style={{ maxWidth: '100%', maxHeight: '240px', objectFit: 'contain', display: 'block', margin: '0 auto', borderRadius: '6px' }} 
                    />
                  ) : isPdfFile(activeNote.pdfAttachment.name) ? (
                    <iframe 
                      src={previewDataUrl || ''} 
                      title="PDF Preview"
                      style={{ width: '100%', height: '240px', border: '1px solid #e2e8f0', borderRadius: '6px' }} 
                    />
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem', textAlign: 'center' }}>
                      No preview available for this document type (DOCX/PPTX). Click Download to open.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '0.6rem', fontSize: '0.75rem', fontWeight: 600 }}>
              <span>Posted by: {activeNote.author} ({activeNote.authorEmail})</span>
              {(activeNote.authorEmail === userEmail || isAdmin) && (
                <button
                  onClick={() => handleDeleteNote(activeNote.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', fontWeight: 700 }}
                >
                  Delete Note
                </button>
              )}
            </div>

            {/* Comments Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 800 }}>Comments ({(activeNote.comments || []).length})</h5>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto' }}>
                {!(activeNote.comments) || activeNote.comments.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No comments yet.</span>
                ) : (
                  activeNote.comments.map(c => (
                    <div key={c.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '2px', fontSize: '0.65rem' }}>
                        <span>{c.author}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{new Date(c.timestamp).toLocaleDateString()}</span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)' }}>{c.text}</span>
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
                  Post
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SHARE NOTE MODAL */}
      {shareModalOpen && noteToShare && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,23,42,0.4)', zIndex: 999999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="glass-panel anim-pop" style={{
            maxWidth: '450px', width: '100%',
            background: '#fff', border: '1px solid #cbd5e1', borderRadius: '16px',
            padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <strong style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)', color: '#0f172a' }}>Share Note</strong>
              <button onClick={() => setShareModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 900 }}>✕</button>
            </div>
            
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
              Sharing note: <strong>{noteToShare.title}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Search Classmate</label>
              <input
                type="text"
                className="cyber-input"
                placeholder="Type name or email..."
                value={shareSearchQuery}
                onChange={(e) => setShareSearchQuery(e.target.value)}
              />
            </div>

            {/* Classmates Results */}
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', padding: '0.25rem' }}>
              {allUsers
                .filter(u => u.email !== userEmail && (u.name.toLowerCase().includes(shareSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(shareSearchQuery.toLowerCase())))
                .slice(0, 10)
                .map(u => (
                  <div
                    key={u.email}
                    onClick={() => setSelectedClassmate(u)}
                    style={{
                      padding: '0.4rem 0.5rem',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: selectedClassmate?.email === u.email ? 'var(--accent-primary-light)' : 'transparent',
                      border: selectedClassmate?.email === u.email ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      marginBottom: '0.2rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: selectedClassmate?.email === u.email ? 'var(--accent-primary)' : 'var(--text-primary)'
                    }}
                  >
                    <span>{u.name}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{u.email}</span>
                  </div>
                ))}
              {allUsers.length === 0 && (
                <div style={{ padding: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>No classmates found.</div>
              )}
            </div>

            {selectedClassmate && (
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0d9488', background: '#f0fdfa', border: '1px solid #5eead4', borderRadius: '8px', padding: '0.5rem' }}>
                Selected: {selectedClassmate.name} ({selectedClassmate.email})
              </div>
            )}

            {sharingError && (
              <div style={{ fontSize: '0.75rem', color: 'red', fontWeight: 600 }}>{sharingError}</div>
            )}

            {sharingSuccess && (
              <div style={{ fontSize: '0.75rem', color: 'green', fontWeight: 600 }}>Note shared successfully!</div>
            )}

            <button
              onClick={handleShareNoteSubmit}
              disabled={!selectedClassmate || sharingSuccess}
              className="cyber-btn cyan-fill"
              style={{ width: '100%', padding: '0.6rem' }}
            >
              Confirm Share
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
