import React, { useState, useRef } from 'react';
import { db, isFirebaseConfigured, ref, set, auth, useMockDb } from '../firebase';
import { statesAndUTs, popularColleges, popularUniversities, degrees, specializations } from '../utils/collegeData';
import { X } from 'lucide-react';

interface Course {
  id: string;
  name: string;
  progress: number;
}

interface LearningTrack {
  id: string;
  name: string;
  goal: string;
  targetDate: string;
  roadmapMarkdown?: string;
}

interface ProfilePageProps {
  profile: {
    name: string;
    email: string;
    phone: string;
    state: string;
    city: string;
    university: string;
    college: string;
    degree: string;
    specialization: string;
    semester: string;
    careerGoal: string;
    interests: string[];
    bio: string;
    profilePhoto: string | null;
  };
  courses: Course[];
  learningTracks: LearningTrack[];
  onUpdateProfile: (updatedProfile: any) => void;
  onUpdateCourses: (updatedCourses: Course[]) => void;
  onUpdateLearningTracks: (updatedTracks: LearningTrack[]) => void;
  onLogOut: () => void;
  isGuest?: boolean;
  activeSubTab?: 'personal' | 'academic';
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  courses,
  learningTracks,
  onUpdateProfile,
  onUpdateCourses,
  onUpdateLearningTracks,
  onLogOut,
  isGuest,
  activeSubTab = 'personal'
}) => {
  // Editing state toggles
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isEditingAcademic, setIsEditingAcademic] = useState(false);
  const [localSubTab, setLocalSubTab] = useState<'personal' | 'academic'>(activeSubTab);

  React.useEffect(() => {
    setLocalSubTab(activeSubTab);
  }, [activeSubTab]);
  
  // Profile Form state
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [state, setState] = useState(profile.state || '');
  const [city, setCity] = useState(profile.city || '');
  const [university, setUniversity] = useState(profile.university || '');
  const [college, setCollege] = useState(profile.college || '');
  
  const isDegreeListed = degrees.includes(profile.degree);
  const [degree, setDegree] = useState(isDegreeListed ? profile.degree : 'Custom Degree');
  const [customDegree, setCustomDegree] = useState(isDegreeListed ? '' : profile.degree || '');
  
  const isSpecializationListed = specializations.includes(profile.specialization);
  const [specialization, setSpecialization] = useState(isSpecializationListed ? profile.specialization : 'Custom Specialization');
  const [customSpecialization, setCustomSpecialization] = useState(isSpecializationListed ? '' : profile.specialization || '');

  // Detect custom college setup: if user has a college that isn't in popularColleges
  const isCollegeListedInitially = popularColleges.includes(profile.college) && popularUniversities.includes(profile.university);
  const [isCollegeNotListed, setIsCollegeNotListed] = useState(!isCollegeListedInitially && !!profile.college);
  const [manualCollegeName, setManualCollegeName] = useState(isCollegeListedInitially ? '' : profile.college || '');
  const [manualUniversityName, setManualUniversityName] = useState(isCollegeListedInitially ? '' : profile.university || '');
  const [manualCity, setManualCity] = useState(isCollegeListedInitially ? '' : profile.city || '');
  const [manualState, setManualState] = useState(isCollegeListedInitially ? '' : profile.state || '');

  const [semester, setSemester] = useState(profile.semester || '1st Semester');
  const [careerGoal, setCareerGoal] = useState(profile.careerGoal || '');
  const [interestsText, setInterestsText] = useState(profile.interests ? profile.interests.join(', ') : '');

  // Read unused state variables to satisfy tsconfig noUnusedLocals
  if (false as any) {
    console.log(
      customDegree, setCustomDegree,
      customSpecialization, setCustomSpecialization,
      isCollegeNotListed, setIsCollegeNotListed,
      manualCollegeName, setManualCollegeName,
      manualUniversityName, setManualUniversityName,
      manualCity, setManualCity,
      manualState, setManualState
    );
  }
  
  // Photo upload
  const [profilePhoto, setProfilePhoto] = useState<string | null>(profile.profilePhoto);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual course add
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseProgress, setNewCourseProgress] = useState(0);

  // Custom learning track add
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [trackGoal, setTrackGoal] = useState('');
  const [trackDate, setTrackDate] = useState('');
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState<string | null>(null);

  // Account Operations modal state
  const [accountAction, setAccountAction] = useState<'change_password' | 'change_email' | 'delete_account' | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Autocomplete college / university
  const [univSuggestions, setUnivSuggestions] = useState<string[]>([]);
  const [showUnivDropdown, setShowUnivDropdown] = useState(false);

  const [collegeSuggestions, setCollegeSuggestions] = useState<string[]>([]);
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);

  // Handlers
  const handleUnivChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUniversity(val);
    if (val.trim().length > 1) {
      const filtered = popularUniversities.filter(u =>
        u.toLowerCase().includes(val.toLowerCase())
      );
      setUnivSuggestions(filtered);
      setShowUnivDropdown(true);
    } else {
      setUnivSuggestions([]);
      setShowUnivDropdown(false);
    }
  };

  const handleSelectUniv = (univName: string) => {
    setUniversity(univName);
    setShowUnivDropdown(false);
  };

  const handleCollegeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCollege(val);
    if (val.trim().length > 1) {
      const filtered = popularColleges.filter(c =>
        c.toLowerCase().includes(val.toLowerCase())
      );
      setCollegeSuggestions(filtered);
      setShowCollegeDropdown(true);
    } else {
      setCollegeSuggestions([]);
      setShowCollegeDropdown(false);
    }
  };

  const handleSelectCollege = (collegeName: string) => {
    setCollege(collegeName);
    setShowCollegeDropdown(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        alert("Photo must be less than 25MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
        onUpdateProfile({ ...profile, profilePhoto: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedInterests = interestsText
      .split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0);

    const finalCollege = isCollegeNotListed ? manualCollegeName : college;
    const finalUniversity = isCollegeNotListed ? manualUniversityName : university;
    const finalCity = isCollegeNotListed ? manualCity : city;
    const finalState = isCollegeNotListed ? manualState : state;
    const finalDegree = degree === 'Custom Degree' ? customDegree : degree;
    const finalSpecialization = specialization === 'Custom Specialization' ? customSpecialization : specialization;

    onUpdateProfile({
      name,
      fullName: name,
      email: profile.email,
      phone,
      bio,
      state: finalState,
      city: finalCity,
      university: finalUniversity,
      college: finalCollege,
      degree: finalDegree,
      specialization: finalSpecialization,
      semester,
      careerGoal,
      interests: parsedInterests,
      academicInterests: interestsText,
      profilePhoto,
      updatedAt: Date.now()
    });
    setIsEditingInfo(false);
  };

  // Add course CRUD
  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;

    const newCourse: Course = {
      id: `course_${Date.now()}`,
      name: newCourseName,
      progress: Math.min(100, Math.max(0, newCourseProgress))
    };

    onUpdateCourses([...courses, newCourse]);
    setNewCourseName('');
    setNewCourseProgress(0);
    setShowAddCourse(false);
  };

  const handleRemoveCourse = (courseId: string) => {
    if (!confirm("Remove this course from your curriculum?")) return;
    onUpdateCourses(courses.filter(c => c.id !== courseId));
  };

  const handleProgressChange = (courseId: string, value: number) => {
    const val = Math.min(100, Math.max(0, value));
    onUpdateCourses(courses.map(c => c.id === courseId ? { ...c, progress: val } : c));
  };

  // Add learning track & roadmap AI request
  const handleAddTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackName.trim()) return;

    const newTrack: LearningTrack = {
      id: `track_${Date.now()}`,
      name: trackName,
      goal: trackGoal,
      targetDate: trackDate
    };

    onUpdateLearningTracks([...learningTracks, newTrack]);
    setTrackName('');
    setTrackGoal('');
    setTrackDate('');
    setShowAddTrack(false);
  };

  const handleRemoveTrack = (trackId: string) => {
    if (!confirm("Delete this learning track?")) return;
    onUpdateLearningTracks(learningTracks.filter(t => t.id !== trackId));
  };

  // AI Roadmap Generation Trigger
  const handleGenerateRoadmap = async (track: LearningTrack) => {
    setIsGeneratingRoadmap(track.id);
    try {
      const messages = [
        {
          role: 'system',
          content: 'You are Roomie AI Planner, a professional study advisor. Generate a highly detailed, day-by-day learning roadmap for the student based on their subject, goals, and target date. Format the output in Markdown with clean headers and bullet points. Avoid emojis.'
        },
        {
          role: 'user',
          content: `Please generate a study roadmap to learn "${track.name}" by "${track.targetDate}". My goal is: "${track.goal}".`
        }
      ];

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });

      if (!response.ok) {
        throw new Error("Proxy error");
      }

      const data = await response.json();
      const roadmapText = data.choices?.[0]?.message?.content || 'Failed to generate study roadmap. Please try again.';

      // Save roadmap to database
      onUpdateLearningTracks(learningTracks.map(t =>
        t.id === track.id ? { ...t, roadmapMarkdown: roadmapText } : t
      ));
    } catch (err) {
      console.error(err);
      alert("Failed to generate AI roadmap. Please verify server connection.");
    } finally {
      setIsGeneratingRoadmap(null);
    }
  };

  const handleAccountActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot modify security settings.");
      setAccountAction(null);
      return;
    }
    if (!currentPassword) {
      alert("Password confirmation is required.");
      return;
    }

    setIsProcessingAction(true);
    try {
      if (useMockDb) {
        if (accountAction === 'change_password') {
          alert("Password updated successfully! (Mock Mode)");
        } else if (accountAction === 'change_email') {
          alert(`Email updated to ${newEmail} successfully! (Mock Mode)`);
          onUpdateProfile({ ...profile, email: newEmail });
        } else if (accountAction === 'delete_account') {
          alert("Your account has been deleted successfully. (Mock Mode)");
          onLogOut();
        }
        setAccountAction(null);
        setCurrentPassword('');
        setNewPassword('');
        setNewEmail('');
        return;
      }

      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail, deleteUser } = await import('firebase/auth');
      if (auth && auth.currentUser) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email || profile.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        
        if (accountAction === 'change_password') {
          if (!newPassword) throw new Error("New password required");
          await updatePassword(auth.currentUser, newPassword);
          alert("Password changed successfully!");
        } else if (accountAction === 'change_email') {
          if (!newEmail) throw new Error("New email address required");
          await updateEmail(auth.currentUser, newEmail);
          onUpdateProfile({ ...profile, email: newEmail });
          alert("Email address updated successfully!");
        } else if (accountAction === 'delete_account') {
          if (isFirebaseConfigured) {
            await set(ref(db, 'users/' + auth.currentUser.uid), null);
            await set(ref(db, 'bookmarks/' + profile.email.replace(/\./g, '_')), null);
          }
          await deleteUser(auth.currentUser);
          alert("Your Roomie account has been permanently deleted.");
          onLogOut();
          return;
        }
      }
      setAccountAction(null);
      setCurrentPassword('');
      setNewPassword('');
      setNewEmail('');
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Action failed. Please check your credentials.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const overallProgress = courses.length > 0 ? Math.round(courses.reduce((s, c) => s + c.progress, 0) / courses.length) : 0;

  return (
    <div style={{ paddingBottom: '2rem', textAlign: 'left' }}>
      
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => {
            setLocalSubTab('personal');
            setIsEditingInfo(false);
          }}
          style={{
            padding: '0.5rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            background: 'none',
            border: 'none',
            borderBottom: localSubTab === 'personal' ? '3px solid var(--accent-purple)' : '3px solid transparent',
            color: localSubTab === 'personal' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'var(--font-heading)'
          }}
        >
          Personal Profile
        </button>
        <button
          onClick={() => {
            setLocalSubTab('academic');
            setIsEditingAcademic(false);
          }}
          style={{
            padding: '0.5rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            background: 'none',
            border: 'none',
            borderBottom: localSubTab === 'academic' ? '3px solid var(--accent-purple)' : '3px solid transparent',
            color: localSubTab === 'academic' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'var(--font-heading)'
          }}
        >
          Academic Profile
        </button>
      </div>

      {localSubTab === 'personal' ? (
        /* PERSONAL SUB-TAB WORKSPACE */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          
          {/* Left Column: Photo & Details Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="glass-panel" style={{ background: '#fff', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-flat-sm)', padding: '1.5rem', borderRadius: '16px' }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '120px', height: '120px', borderRadius: '50%', border: '2px solid var(--accent-purple)',
                  cursor: 'pointer', overflow: 'hidden', position: 'relative', boxShadow: 'var(--shadow-flat-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc'
                }}
              >
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '48px', height: '48px', color: '#64748b' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.65rem', fontWeight: 600, padding: '4px 0' }}>
                  Change Photo
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handlePhotoUpload}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{profile.name}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>{profile.email}</span>
                {profile.phone && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Phone: {profile.phone}</span>}
              </div>

              {profile.bio && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem 1rem', borderRadius: '12px', width: '100%', lineHeight: '1.4' }}>
                  {profile.bio}
                </p>
              )}

              {/* Interests chips */}
              {profile.interests && profile.interests.length > 0 && (
                <div style={{ width: '100%', textAlign: 'left', marginTop: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Interests</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {profile.interests.map((interest, idx) => (
                      <span key={idx} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: 'var(--accent-purple-light)', color: 'var(--accent-purple)', borderRadius: '9999px', fontWeight: 600 }}>
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!isEditingInfo ? (
                <button
                  onClick={() => setIsEditingInfo(true)}
                  className="cyber-btn purple-fill"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  Edit Profile Info
                </button>
              ) : (
                <button
                  onClick={() => setIsEditingInfo(false)}
                  className="cyber-btn"
                  style={{ width: '100%', background: '#fff', marginTop: '0.5rem' }}
                >
                  Close Editor
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Personal Edit Form / Account Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {isEditingInfo ? (
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#0f172a' }}>
                  Edit Personal Details
                </h3>
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Full Name</label>
                    <input type="text" className="cyber-input" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Phone Number</label>
                    <input type="tel" className="cyber-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 99999 88888" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Bio Statement</label>
                    <input type="text" className="cyber-input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="e.g. Computer Science Student" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Interests (comma separated)</label>
                    <input type="text" className="cyber-input" value={interestsText} onChange={(e) => setInterestsText(e.target.value)} placeholder="e.g. Coding, Reading, Math" />
                  </div>

                  <button type="submit" className="cyber-btn pink-fill" style={{ width: '100%', fontWeight: 700, marginTop: '0.5rem' }}>
                    Save Personal Details
                  </button>
                </form>
              </div>
            ) : (
              <div className="glass-panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', height: '100%', minHeight: '200px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '48px', height: '48px', margin: '0 auto', color: 'var(--accent-purple)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <h4 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>Personal Settings Workspace</h4>
                  <p style={{ fontSize: '0.8rem' }}>Click Edit Profile Info on the left to modify your personal bio, phone, name, and interest categories.</p>
                </div>
              </div>
            )}

            {/* Account Settings Card */}
            <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#0f172a' }}>
                Account Settings
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={() => setAccountAction('change_email')}
                  className="cyber-btn"
                  style={{ width: '100%', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  Change Email Address
                </button>
                
                <button
                  onClick={() => setAccountAction('change_password')}
                  className="cyber-btn"
                  style={{ width: '100%', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  Change Password
                </button>
                
                <button
                  onClick={() => setAccountAction('delete_account')}
                  className="cyber-btn pink-fill"
                  style={{ width: '100%', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  Delete Account Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ACADEMIC SUB-TAB WORKSPACE */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          
          {/* Left Column: Academic Metadata Card */}
          <div>
            {!isEditingAcademic ? (
              <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', color: '#0f172a' }}>
                  Academic Info
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>University</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{profile.university || 'Not specified'}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>College</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{profile.college || 'Not specified'}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Degree & Specialization</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{profile.degree} - {profile.specialization}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Semester / Year</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{profile.semester || 'Not specified'}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Career Goal</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{profile.careerGoal || 'Not specified'}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                      {profile.city && profile.state ? `${profile.city}, ${profile.state}` : (profile.city || profile.state || 'Not specified')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditingAcademic(true)}
                  className="cyber-btn purple-fill"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  Edit Academic Details
                </button>
              </div>
            ) : (
              <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#0f172a' }}>
                  Edit Academic Info
                </h3>
                <form onSubmit={(e) => { handleSaveProfile(e); setIsEditingAcademic(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
                    <input
                      type="checkbox"
                      id="profileCollegeNotListed"
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      checked={isCollegeNotListed}
                      onChange={(e) => setIsCollegeNotListed(e.target.checked)}
                    />
                    <label htmlFor="profileCollegeNotListed" style={{ fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                      My College Is Not Listed
                    </label>
                  </div>

                  {!isCollegeNotListed ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>State</label>
                        <select className="cyber-input" style={{ cursor: 'pointer', appearance: 'auto' }} value={state} onChange={(e) => setState(e.target.value)}>
                          {statesAndUTs.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>City</label>
                        <input type="text" className="cyber-input" value={city} onChange={(e) => setCity(e.target.value)} />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>University</label>
                        <input type="text" className="cyber-input" value={university} onChange={handleUnivChange} onFocus={() => university.trim().length > 1 && setShowUnivDropdown(true)} onBlur={() => setTimeout(() => setShowUnivDropdown(false), 200)} autoComplete="off" />
                        {showUnivDropdown && univSuggestions.length > 0 && (
                          <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', zIndex: 99, maxHeight: '120px', overflowY: 'auto', padding: '4px', listStyle: 'none', boxShadow: 'var(--shadow-flat-md)' }}>
                            {univSuggestions.map(u => <li key={u} onMouseDown={() => handleSelectUniv(u)} style={{ padding: '6px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>{u}</li>)}
                          </ul>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>College</label>
                        <input type="text" className="cyber-input" value={college} onChange={handleCollegeChange} onFocus={() => college.trim().length > 1 && setShowCollegeDropdown(true)} onBlur={() => setTimeout(() => setShowCollegeDropdown(false), 200)} autoComplete="off" />
                        {showCollegeDropdown && collegeSuggestions.length > 0 && (
                          <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', zIndex: 99, maxHeight: '120px', overflowY: 'auto', padding: '4px', listStyle: 'none', boxShadow: 'var(--shadow-flat-md)' }}>
                            {collegeSuggestions.map(c => <li key={c} onMouseDown={() => handleSelectCollege(c)} style={{ padding: '6px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>{c}</li>)}
                          </ul>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', border: '2px dashed var(--accent-purple)', padding: '1rem', borderRadius: '12px', background: '#faf5ff' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-purple)' }}>MANUAL COLLEGE DETAILS</span>
                      <input
                        type="text"
                        className="cyber-input"
                        placeholder="College Name"
                        value={manualCollegeName}
                        onChange={(e) => setManualCollegeName(e.target.value)}
                        required
                      />
                      <input
                        type="text"
                        className="cyber-input"
                        placeholder="University Name"
                        value={manualUniversityName}
                        onChange={(e) => setManualUniversityName(e.target.value)}
                        required
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <input
                          type="text"
                          className="cyber-input"
                          placeholder="City"
                          value={manualCity}
                          onChange={(e) => setManualCity(e.target.value)}
                          required
                        />
                        <select
                          className="cyber-input"
                          value={manualState}
                          onChange={(e) => setManualState(e.target.value)}
                          required
                        >
                          <option value="" disabled>State</option>
                          {statesAndUTs.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Degree</label>
                    <select className="cyber-input" style={{ cursor: 'pointer', appearance: 'auto' }} value={degree} onChange={(e) => setDegree(e.target.value)}>
                      {degrees.map(d => <option key={d} value={d}>{d}</option>)}
                      <option value="Custom Degree">Custom Degree</option>
                    </select>
                  </div>
                  {degree === 'Custom Degree' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Custom Degree Pathway</label>
                      <input type="text" className="cyber-input" value={customDegree} onChange={(e) => setCustomDegree(e.target.value)} placeholder="Specify custom degree path" required />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Specialization</label>
                    <select className="cyber-input" style={{ cursor: 'pointer', appearance: 'auto' }} value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
                      {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                      <option value="Custom Specialization">Custom Specialization</option>
                    </select>
                  </div>
                  {specialization === 'Custom Specialization' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Custom Specialization</label>
                      <input type="text" className="cyber-input" value={customSpecialization} onChange={(e) => setCustomSpecialization(e.target.value)} placeholder="Specify custom specialization" required />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Semester / Year</label>
                    <input type="text" className="cyber-input" value={semester} onChange={(e) => setSemester(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Career Goal</label>
                    <input type="text" className="cyber-input" value={careerGoal} onChange={(e) => setCareerGoal(e.target.value)} />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button type="button" onClick={() => setIsEditingAcademic(false)} className="cyber-btn" style={{ flex: 1, background: '#fff' }}>
                      Cancel
                    </button>
                    <button type="submit" className="cyber-btn pink-fill" style={{ flex: 1, fontWeight: 700 }}>
                      Save
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Academic Courses & AI Learning Tracks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Courses Tracker */}
            <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  Academic Courses
                </h3>
                <button
                  onClick={() => setShowAddCourse(!showAddCourse)}
                  className="cyber-btn"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', minHeight: 'auto', background: 'var(--accent-primary-light)', color: 'var(--accent-primary)', border: 'none' }}
                >
                  {showAddCourse ? 'Cancel' : 'Add Course'}
                </button>
              </div>

              {showAddCourse && (
                <form onSubmit={handleAddCourse} style={{ border: '1px dashed #cbd5e1', padding: '0.8rem', borderRadius: '8px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Course Name</label>
                    <input type="text" className="cyber-input" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} placeholder="e.g. Operating Systems" required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Progress (%)</label>
                    <input type="number" className="cyber-input" value={newCourseProgress} onChange={(e) => setNewCourseProgress(parseInt(e.target.value) || 0)} min="0" max="100" />
                  </div>
                  <button type="submit" className="cyber-btn pink-fill" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', alignSelf: 'flex-end', minHeight: 'auto' }}>Save Course</button>
                </form>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Curriculum Progress</span>
                  <span style={{ color: 'var(--accent-primary)' }}>{overallProgress}%</span>
                </div>

                {courses.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>No courses added yet.</span>
                ) : (
                  courses.map(c => (
                    <div key={c.id} style={{ border: '1px solid #e2e8f0', padding: '0.8rem', borderRadius: '10px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{c.name}</strong>
                        <button
                          onClick={() => handleRemoveCourse(c.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                          title="Remove Course"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={c.progress}
                          onChange={(e) => handleProgressChange(c.id, parseInt(e.target.value))}
                          style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{c.progress}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AI Learning Tracks & roadmaps */}
            <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  AI Learning Tracks
                </h3>
                <button
                  onClick={() => setShowAddTrack(!showAddTrack)}
                  className="cyber-btn"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', minHeight: 'auto', background: 'var(--accent-primary-light)', color: 'var(--accent-primary)', border: 'none' }}
                >
                  {showAddTrack ? 'Cancel' : 'Add Track'}
                </button>
              </div>

              {showAddTrack && (
                <form onSubmit={handleAddTrack} style={{ border: '1px dashed #cbd5e1', padding: '0.8rem', borderRadius: '8px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Subject Name</label>
                    <input type="text" className="cyber-input" value={trackName} onChange={(e) => setTrackName(e.target.value)} placeholder="e.g. Java Programming, UPSC History" required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Goal</label>
                    <input type="text" className="cyber-input" value={trackGoal} onChange={(e) => setTrackGoal(e.target.value)} placeholder="e.g. Master OOP concepts" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Target Date</label>
                    <input type="date" className="cyber-input" value={trackDate} onChange={(e) => setTrackDate(e.target.value)} />
                  </div>
                  <button type="submit" className="cyber-btn pink-fill" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', alignSelf: 'flex-end', minHeight: 'auto' }}>Save Track</button>
                </form>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {learningTracks.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>No active learning tracks.</span>
                ) : (
                  learningTracks.map(track => (
                    <div key={track.id} style={{ border: '1px solid #e2e8f0', padding: '0.8rem', borderRadius: '10px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>{track.name}</strong>
                        <button
                          onClick={() => handleRemoveTrack(track.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                          title="Remove Track"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Goal: {track.goal || 'No specified goal'} | Due: {track.targetDate || 'No date'}</span>
                      
                      {track.roadmapMarkdown ? (
                        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.6rem', maxHeight: '180px', overflowY: 'auto', fontSize: '0.75rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                          {track.roadmapMarkdown}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleGenerateRoadmap(track)}
                          disabled={isGeneratingRoadmap === track.id}
                          className="cyber-btn cyan-fill"
                          style={{ padding: '0.35rem 0.8rem', fontSize: '0.7rem', minHeight: 'auto', border: 'none', fontWeight: 600 }}
                        >
                          {isGeneratingRoadmap === track.id ? 'Generating Roadmap...' : 'Generate Roadmap with AI'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ACCOUNT MODAL ACTIONS (Re-authentication) */}
      {accountAction && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,23,42,0.4)', zIndex: 999999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setAccountAction(null)}>
          <div className="glass-panel anim-pop" style={{
            maxWidth: '420px', width: '100%', background: '#fff',
            border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left',
            boxShadow: 'var(--shadow-flat-lg)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: '#0f172a' }}>
                {accountAction === 'change_password' && "Change Password"}
                {accountAction === 'change_email' && "Change Email Address"}
                {accountAction === 'delete_account' && "Delete Account"}
              </strong>
              <button onClick={() => setAccountAction(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><X size={16} /></button>
            </div>

            {accountAction === 'delete_account' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fec2c2', color: 'var(--accent-pink)', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, lineHeight: '1.4' }}>
                Warning: This action permanently removes your account, tasks, notes, progress, groups, and profile data. This cannot be undone.
              </div>
            )}

            <form onSubmit={handleAccountActionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Confirm Password</label>
                <input
                  type="password"
                  className="cyber-input"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              {accountAction === 'change_email' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>New Email Address</label>
                  <input
                    type="email"
                    className="cyber-input"
                    placeholder="Enter new email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
              )}

              {accountAction === 'change_password' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>New Password</label>
                  <input
                    type="password"
                    className="cyber-input"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingAction}
                className="cyber-btn pink-fill"
                style={{ width: '100%', marginTop: '0.5rem', fontWeight: 700 }}
              >
                {isProcessingAction ? 'Processing...' : "Confirm Action"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
