// src/components/Onboarding.tsx
import React, { useState, useRef } from 'react';
import { User } from 'lucide-react';
import { statesAndUTs, popularColleges, popularUniversities, degrees, specializations, citiesByState } from '../utils/collegeData';

interface OnboardingProps {
  userEmail: string;
  defaultName: string;
  onComplete: (profileData: {
    name: string;
    state: string;
    city: string;
    university: string;
    college: string;
    degree: string;
    specialization: string;
    semester: string;
    careerGoal: string;
    interests: string[];
    profilePhoto: string | null;
  }) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ defaultName, onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, _setName] = useState(defaultName);
  
  // 10 Onboarding states
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [college, setCollege] = useState('');
  const [university, setUniversity] = useState('');
  const [degree, setDegree] = useState('BTech');
  const [customDegree, setCustomDegree] = useState('');
  const [specialization, setSpecialization] = useState('Computer Science');
  const [customSpecialization, setCustomSpecialization] = useState('');
  const [semester, setSemester] = useState('1st Semester');
  const [careerGoal, setCareerGoal] = useState('');
  const [interestsText, setInterestsText] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Manual entry for College Not Listed
  const [isCollegeNotListed, setIsCollegeNotListed] = useState(false);
  const [manualCollegeName, setManualCollegeName] = useState('');
  const [manualUniversityName, setManualUniversityName] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualState, setManualState] = useState('');

  // Dropdown states for search autocompletes
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const [collegeSuggestions, setCollegeSuggestions] = useState<string[]>([]);
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);

  const [univSuggestions, setUnivSuggestions] = useState<string[]>([]);
  const [showUnivDropdown, setShowUnivDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete change handlers
  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCity(val);
    const stateCities = citiesByState[state] || [];
    if (val.trim()) {
      const filtered = stateCities.filter(c => c.toLowerCase().includes(val.toLowerCase()));
      setCitySuggestions(filtered.slice(0, 8));
      setShowCityDropdown(filtered.length > 0);
    } else {
      setCitySuggestions(stateCities.slice(0, 8));
      setShowCityDropdown(stateCities.length > 0);
    }
  };

  const handleCollegeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCollege(val);
    if (val.trim().length > 1) {
      const filtered = popularColleges.filter(c => c.toLowerCase().includes(val.toLowerCase()));
      setCollegeSuggestions(filtered.slice(0, 8));
      setShowCollegeDropdown(true);
    } else {
      setCollegeSuggestions([]);
      setShowCollegeDropdown(false);
    }
  };

  const handleUnivChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUniversity(val);
    if (val.trim().length > 1) {
      const filtered = popularUniversities.filter(u => u.toLowerCase().includes(val.toLowerCase()));
      setUnivSuggestions(filtered.slice(0, 8));
      setShowUnivDropdown(true);
    } else {
      setUnivSuggestions([]);
      setShowUnivDropdown(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Photo must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Step Validation Logic
  const validateStep = () => {
    switch (step) {
      case 1:
        if (!state) {
          alert("Please select your State");
          return false;
        }
        return true;
      case 2:
        if (!city.trim()) {
          alert("Please specify your City");
          return false;
        }
        return true;
      case 3:
        if (isCollegeNotListed) {
          if (!manualCollegeName.trim() || !manualUniversityName.trim() || !manualCity.trim() || !manualState) {
            alert("Please fill in all manual college fields");
            return false;
          }
        } else if (!college.trim()) {
          alert("Please select or enter your College");
          return false;
        }
        return true;
      case 4:
        if (!isCollegeNotListed && !university.trim()) {
          alert("Please select or enter your University");
          return false;
        }
        return true;
      case 5:
        if (degree === 'Custom Degree' && !customDegree.trim()) {
          alert("Please enter your Custom Degree");
          return false;
        }
        return true;
      case 6:
        if (specialization === 'Custom Specialization' && !customSpecialization.trim()) {
          alert("Please enter your Custom Specialization");
          return false;
        }
        return true;
      case 7:
        if (!semester) {
          alert("Please select your Semester/Year");
          return false;
        }
        return true;
      case 8:
        if (!careerGoal.trim()) {
          alert("Please enter your Career Goal");
          return false;
        }
        return true;
      case 9:
        if (!interestsText.trim()) {
          alert("Please share at least one interest");
          return false;
        }
        return true;
      case 10:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step === 3 && isCollegeNotListed) {
      // If college is not listed, we already collect university, city, and state manually in step 3.
      // So we skip Step 4 (University) and go straight to Step 5 (Degree)
      setStep(5);
    } else {
      setStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (step === 5 && isCollegeNotListed) {
      setStep(3);
    } else {
      setStep(prev => Math.max(1, prev - 1));
    }
  };

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;

    const finalCollege = isCollegeNotListed ? manualCollegeName : college;
    const finalUniversity = isCollegeNotListed ? manualUniversityName : university;
    const finalCity = isCollegeNotListed ? manualCity : city;
    const finalState = isCollegeNotListed ? manualState : state;
    const finalDegree = degree === 'Custom Degree' ? customDegree : degree;
    const finalSpecialization = specialization === 'Custom Specialization' ? customSpecialization : specialization;

    const interestsArray = interestsText
      .split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0);

    onComplete({
      name,
      state: finalState,
      city: finalCity,
      university: finalUniversity,
      college: finalCollege,
      degree: finalDegree,
      specialization: finalSpecialization,
      semester,
      careerGoal,
      interests: interestsArray,
      profilePhoto
    });
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return "Select your State";
      case 2: return "Which City do you live in?";
      case 3: return "Find your College";
      case 4: return "What is your University?";
      case 5: return "Select your Degree";
      case 6: return "Select your Specialization";
      case 7: return "Current Semester / Year";
      case 8: return "What is your Career Goal?";
      case 9: return "Add your Interests";
      case 10: return "Choose a Profile Photo";
      default: return "";
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      background: 'linear-gradient(135deg, #fef08a 0%, #fbcfe8 100%)',
      fontFamily: 'var(--font-body)'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '520px',
        width: '100%',
        background: '#ffffff',
        border: '3px solid #0f172a',
        borderRadius: '24px',
        boxShadow: '8px 8px 0px #0f172a',
        padding: '2.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        textAlign: 'left'
      }}>
        {/* Header progression */}
        <div style={{ borderBottom: '2.5px solid #0f172a', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Academic setup</span>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', margin: 0 }}>
              {getStepTitle()}
            </h2>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-primary)', background: 'var(--accent-primary-light)', padding: '0.3rem 0.6rem', borderRadius: '12px', border: '1.5px solid #0f172a' }}>
            {step}/10
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ background: '#f1f5f9', height: '12px', borderRadius: '6px', border: '2.5px solid #0f172a', overflow: 'hidden' }}>
          <div style={{
            background: 'var(--accent-cyan)',
            width: `${(step / 10) * 100}%`,
            height: '100%',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>

        {/* Dynamic Wizard Steps Form */}
        <div style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>STATE / UNION TERRITORY</label>
              <select
                className="cyber-input"
                style={{ appearance: 'auto', cursor: 'pointer', borderRadius: '14px', border: '2px solid #0f172a' }}
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setCity('');
                  setShowCityDropdown(false);
                }}
              >
                <option value="" disabled>Select state</option>
                {statesAndUTs.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', position: 'relative' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>CITY</label>
              <input
                type="text"
                className="cyber-input"
                placeholder={state ? `Type city in ${state}...` : "Select State first"}
                value={city}
                onChange={handleCityChange}
                onFocus={() => {
                  const stateCities = citiesByState[state] || [];
                  if (stateCities.length > 0) {
                    setCitySuggestions(stateCities.slice(0, 8));
                    setShowCityDropdown(true);
                  }
                }}
                onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                autoComplete="off"
                style={{ borderRadius: '14px', border: '2px solid #0f172a' }}
              />
              {showCityDropdown && citySuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#fff', border: '2px solid #0f172a', borderRadius: '12px',
                  boxShadow: '4px 4px 0px #0f172a', maxHeight: '180px', overflowY: 'auto'
                }}>
                  {citySuggestions.map(c => (
                    <div
                      key={c}
                      onMouseDown={() => { setCity(c); setShowCityDropdown(false); }}
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', borderBottom: '1px solid #eee' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', border: '2px solid #0f172a', padding: '0.65rem 0.75rem', borderRadius: '14px' }}>
                <input
                  type="checkbox"
                  id="onboardNotListed"
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  checked={isCollegeNotListed}
                  onChange={(e) => setIsCollegeNotListed(e.target.checked)}
                />
                <label htmlFor="onboardNotListed" style={{ fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}>
                  My College Is Not Listed
                </label>
              </div>

              {!isCollegeNotListed ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>SEARCH COLLEGE</label>
                  <input
                    type="text"
                    className="cyber-input"
                    placeholder="e.g. IIT Delhi, VIT, Presidency"
                    value={college}
                    onChange={handleCollegeChange}
                    onFocus={() => college.trim().length > 1 && setShowCollegeDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCollegeDropdown(false), 200)}
                    autoComplete="off"
                    style={{ borderRadius: '14px', border: '2px solid #0f172a' }}
                  />
                  {showCollegeDropdown && collegeSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: '#fff', border: '2px solid #0f172a', borderRadius: '12px',
                      boxShadow: '4px 4px 0px #0f172a', maxHeight: '180px', overflowY: 'auto'
                    }}>
                      {collegeSuggestions.map(c => (
                        <div
                          key={c}
                          onMouseDown={() => { setCollege(c); setShowCollegeDropdown(false); }}
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', borderBottom: '1px solid #eee' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', border: '2px dashed #0f172a', padding: '1rem', borderRadius: '16px', background: '#fffbeb' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--accent-gold)' }}>MANUAL DETAILS REGISTER</span>
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
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', position: 'relative' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>UNIVERSITY</label>
              <input
                type="text"
                className="cyber-input"
                placeholder="e.g. Delhi University, VTU, Mumbai University"
                value={university}
                onChange={handleUnivChange}
                onFocus={() => university.trim().length > 1 && setShowUnivDropdown(true)}
                onBlur={() => setTimeout(() => setShowUnivDropdown(false), 200)}
                autoComplete="off"
                style={{ borderRadius: '14px', border: '2px solid #0f172a' }}
              />
              {showUnivDropdown && univSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#fff', border: '2px solid #0f172a', borderRadius: '12px',
                  boxShadow: '4px 4px 0px #0f172a', maxHeight: '180px', overflowY: 'auto'
                }}>
                  {univSuggestions.map(u => (
                    <div
                      key={u}
                      onMouseDown={() => { setUniversity(u); setShowUnivDropdown(false); }}
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', borderBottom: '1px solid #eee' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      {u}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>DEGREE / COURSE PATHWAY</label>
                <select
                  className="cyber-input"
                  style={{ appearance: 'auto', cursor: 'pointer', borderRadius: '14px', border: '2px solid #0f172a' }}
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                >
                  {degrees.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {degree === 'Custom Degree' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>SPECIFY CUSTOM DEGREE</label>
                  <input
                    type="text"
                    className="cyber-input"
                    placeholder="Enter custom degree path"
                    value={customDegree}
                    onChange={(e) => setCustomDegree(e.target.value)}
                    style={{ borderRadius: '14px', border: '2px solid #0f172a' }}
                  />
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>SPECIALIZATION</label>
                <select
                  className="cyber-input"
                  style={{ appearance: 'auto', cursor: 'pointer', borderRadius: '14px', border: '2px solid #0f172a' }}
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                >
                  {specializations.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {specialization === 'Custom Specialization' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>SPECIFY CUSTOM SPECIALIZATION</label>
                  <input
                    type="text"
                    className="cyber-input"
                    placeholder="Enter custom specialization"
                    value={customSpecialization}
                    onChange={(e) => setCustomSpecialization(e.target.value)}
                    style={{ borderRadius: '14px', border: '2px solid #0f172a' }}
                  />
                </div>
              )}
            </div>
          )}

          {step === 7 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>SEMESTER / YEAR</label>
              <select
                className="cyber-input"
                style={{ appearance: 'auto', cursor: 'pointer', borderRadius: '14px', border: '2px solid #0f172a' }}
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
                <option value="1st Semester">1st Semester</option>
                <option value="2nd Semester">2nd Semester</option>
                <option value="3rd Semester">3rd Semester</option>
                <option value="4th Semester">4th Semester</option>
                <option value="5th Semester">5th Semester</option>
                <option value="6th Semester">6th Semester</option>
                <option value="7th Semester">7th Semester</option>
                <option value="8th Semester">8th Semester</option>
                <option value="1st Year (Govt Prep)">1st Year (Govt Prep)</option>
                <option value="2nd Year (Govt Prep)">2nd Year (Govt Prep)</option>
                <option value="3rd Year+ (Govt Prep)">3rd Year+ (Govt Prep)</option>
                <option value="Other">Other / Non-Semester</option>
              </select>
            </div>
          )}

          {step === 8 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>CAREER GOAL</label>
              <input
                type="text"
                className="cyber-input"
                placeholder="e.g. Software Engineer, Clear UPSC, Data Scientist"
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                style={{ borderRadius: '14px', border: '2px solid #0f172a' }}
              />
            </div>
          )}

          {step === 9 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>INTERESTS (COMMA SEPARATED)</label>
              <input
                type="text"
                className="cyber-input"
                placeholder="e.g. Coding, Machine Learning, Chess, Public Speaking"
                value={interestsText}
                onChange={(e) => setInterestsText(e.target.value)}
                style={{ borderRadius: '14px', border: '2px solid #0f172a' }}
              />
            </div>
          )}

          {step === 10 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <div style={{
                width: '90px', height: '90px', borderRadius: '50%',
                border: '3px solid #0f172a', background: '#f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '4px 4px 0px #0f172a', overflow: 'hidden'
              }}>
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Upload preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={40} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <button
                type="button"
                className="cyber-btn purple-fill"
                onClick={() => fileInputRef.current?.click()}
                style={{ minHeight: '40px', padding: '0.5rem 1.25rem', fontWeight: 800 }}
              >
                UPLOAD PHOTO
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handlePhotoUpload}
              />
            </div>
          )}
        </div>

        {/* Navigation Actions */}
        <div style={{ display: 'flex', gap: '1rem', borderTop: '2px dashed #e2e8f0', paddingTop: '1.25rem' }}>
          {step > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="cyber-btn"
              style={{ flex: 1, border: '2.5px solid #0f172a', background: '#fff', boxShadow: '4px 4px 0px #0f172a', fontWeight: 800 }}
            >
              BACK
            </button>
          )}

          {step < 10 ? (
            <button
              type="button"
              onClick={handleNext}
              className="cyber-btn pink-fill"
              style={{ flex: 2, border: '2.5px solid #0f172a', boxShadow: '4px 4px 0px #0f172a', fontWeight: 800 }}
            >
              CONTINUE
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="cyber-btn pink-fill"
              style={{ flex: 2, border: '2.5px solid #0f172a', boxShadow: '4px 4px 0px #0f172a', fontWeight: 800 }}
            >
              ENTER ROOMIE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
