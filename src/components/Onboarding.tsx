// src/components/Onboarding.tsx
import React, { useState, useRef } from 'react';
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
  const [name, setName] = useState(defaultName);
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  
  // Autocomplete college / university
  const [university, setUniversity] = useState('');
  const [univSuggestions, setUnivSuggestions] = useState<string[]>([]);
  const [showUnivDropdown, setShowUnivDropdown] = useState(false);

  const [college, setCollege] = useState('');
  const [collegeSuggestions, setCollegeSuggestions] = useState<string[]>([]);
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);

  // City autocomplete based on selected state
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Manual entry overrides
  const [isCollegeNotListed, setIsCollegeNotListed] = useState(false);
  const [manualCollegeName, setManualCollegeName] = useState('');
  const [manualUniversityName, setManualUniversityName] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualState, setManualState] = useState('');

  // Course registry
  const [degree, setDegree] = useState(degrees[0]);
  const [specialization, setSpecialization] = useState(specializations[0]);
  const [customSpecialization, setCustomSpecialization] = useState('');
  const [isCustomSpecialization, setIsCustomSpecialization] = useState(false);
  
  // Academics & Goals
  const [semester, setSemester] = useState('1st Semester');
  const [careerGoal, setCareerGoal] = useState('');
  const [interestsText, setInterestsText] = useState('');
  
  // Profile Photo
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCity(val);
    const stateCities = citiesByState[state] || [];
    if (val.trim().length > 0) {
      const filtered = stateCities.filter(c => c.toLowerCase().includes(val.toLowerCase()));
      setCitySuggestions(filtered.slice(0, 8));
      setShowCityDropdown(filtered.length > 0);
    } else {
      // Show all cities for state when empty
      setCitySuggestions(stateCities.slice(0, 8));
      setShowCityDropdown(stateCities.length > 0);
    }
  };

  const handleCityFocus = () => {
    const stateCities = citiesByState[state] || [];
    if (stateCities.length > 0 && !city) {
      setCitySuggestions(stateCities.slice(0, 8));
      setShowCityDropdown(true);
    }
  };

  const handleSelectCity = (cityName: string) => {
    setCity(cityName);
    setShowCityDropdown(false);
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
      if (file.size > 2 * 1024 * 1024) {
        alert("Photo must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep1 = () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return false;
    }
    if (!state) {
      alert("Please select your state");
      return false;
    }
    if (!city.trim()) {
      alert("Please enter your city");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (isCollegeNotListed) {
      if (!manualCollegeName.trim()) {
        alert("Please enter your college name");
        return false;
      }
      if (!manualUniversityName.trim()) {
        alert("Please enter your university name");
        return false;
      }
      if (!manualCity.trim()) {
        alert("Please enter the city");
        return false;
      }
      if (!manualState) {
        alert("Please select the state");
        return false;
      }
    } else {
      if (!university.trim()) {
        alert("Please select or enter your university");
        return false;
      }
      if (!college.trim()) {
        alert("Please select or enter your college");
        return false;
      }
    }
    return true;
  };

  const validateStep3 = () => {
    if (isCustomSpecialization && !customSpecialization.trim()) {
      alert("Please enter your custom specialization");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Assemble final profile data
    const finalCollegeName = isCollegeNotListed ? manualCollegeName : college;
    const finalUniversityName = isCollegeNotListed ? manualUniversityName : university;
    const finalCity = isCollegeNotListed ? manualCity : city;
    const finalState = isCollegeNotListed ? manualState : state;
    const finalSpec = isCustomSpecialization ? customSpecialization : specialization;

    const parsedInterests = interestsText
      .split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0);

    onComplete({
      name,
      state: finalState,
      city: finalCity,
      university: finalUniversityName,
      college: finalCollegeName,
      degree,
      specialization: finalSpec,
      semester,
      careerGoal: careerGoal || 'Self-improvement',
      interests: parsedInterests.length > 0 ? parsedInterests : ['Learning', 'Coding'],
      profilePhoto
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      fontFamily: 'var(--font-body)'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '500px',
        width: '100%',
        background: '#ffffff',
        border: '3.5px solid #000',
        boxShadow: '8px 8px 0px #000',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', borderBottom: '3px solid #000', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 900 }}>
            Setup Your Profile
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '0.2rem' }}>
            Step {step} of 4: {
              step === 1 ? "Personal Info" :
              step === 2 ? "College Details" :
              step === 3 ? "Course Details" : "Career & Photo"
            }
          </p>
        </div>

        {/* Step Progress Bar */}
        <div style={{
          display: 'flex',
          background: '#eaeaea',
          height: '10px',
          borderRadius: '5px',
          border: '1.5px solid #000',
          overflow: 'hidden'
        }}>
          <div style={{
            background: 'var(--accent-pink)',
            width: `${(step / 4) * 100}%`,
            transition: 'width 0.3s ease'
          }} />
        </div>

        <form onSubmit={handleFinish} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* STEP 1: Personal Info */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>YOUR FULL NAME</label>
                <input
                  type="text"
                  className="cyber-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>STATE / UNION TERRITORY</label>
                <select
                  className="cyber-input"
                  style={{ cursor: 'pointer', appearance: 'auto' }}
                  value={state}
                  onChange={(e) => { setState(e.target.value); setCity(''); setShowCityDropdown(false); }}
                  required
                >
                  <option value="" disabled>Select your state</option>
                  {statesAndUTs.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>CITY</label>
                <input
                  type="text"
                  className="cyber-input"
                  value={city}
                  onChange={handleCityChange}
                  onFocus={handleCityFocus}
                  onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                  placeholder={state ? `Type city in ${state}...` : 'Select state first'}
                  autoComplete="off"
                  required
                />
                {showCityDropdown && citySuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: '#fff', border: '2.5px solid #000', borderRadius: '10px',
                    boxShadow: '3px 3px 0px #000', maxHeight: '200px', overflowY: 'auto'
                  }}>
                    {citySuggestions.map(c => (
                      <div
                        key={c}
                        onMouseDown={() => handleSelectCity(c)}
                        style={{
                          padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 700,
                          cursor: 'pointer', borderBottom: '1px solid #eee'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: College Search & Autocomplete */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8f9fa', border: '2.5px solid #000', padding: '0.6rem', borderRadius: '10px' }}>
                <input
                  type="checkbox"
                  id="notlisted"
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  checked={isCollegeNotListed}
                  onChange={(e) => setIsCollegeNotListed(e.target.checked)}
                />
                <label htmlFor="notlisted" style={{ fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}>
                  My College Is Not Listed
                </label>
              </div>

              {!isCollegeNotListed ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>UNIVERSITY NAME</label>
                    <input
                      type="text"
                      className="cyber-input"
                      value={university}
                      onChange={handleUnivChange}
                      onFocus={() => university.trim().length > 1 && setShowUnivDropdown(true)}
                      onBlur={() => setTimeout(() => setShowUnivDropdown(false), 200)}
                      placeholder="Type to search university... (e.g. DU, VTU)"
                      autoComplete="off"
                    />
                    {showUnivDropdown && univSuggestions.length > 0 && (
                      <ul style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        background: '#fff', border: '2.5px solid #000', borderRadius: '8px',
                        zIndex: 999, maxHeight: '150px', overflowY: 'auto', listStyle: 'none',
                        boxShadow: '3px 3px 0px #000', padding: '0.25rem'
                      }}>
                        {univSuggestions.map(u => (
                          <li
                            key={u}
                            onMouseDown={() => handleSelectUniv(u)}
                            style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid #eee' }}
                            onMouseOver={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                            onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            {u}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>COLLEGE / INSTITUTION</label>
                    <input
                      type="text"
                      className="cyber-input"
                      value={college}
                      onChange={handleCollegeChange}
                      onFocus={() => college.trim().length > 1 && setShowCollegeDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCollegeDropdown(false), 200)}
                      placeholder="Type to search college... (e.g. IIT, VIT, Christ)"
                      autoComplete="off"
                    />
                    {showCollegeDropdown && collegeSuggestions.length > 0 && (
                      <ul style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        background: '#fff', border: '2.5px solid #000', borderRadius: '8px',
                        zIndex: 999, maxHeight: '150px', overflowY: 'auto', listStyle: 'none',
                        boxShadow: '3px 3px 0px #000', padding: '0.25rem'
                      }}>
                        {collegeSuggestions.map(c => (
                          <li
                            key={c}
                            onMouseDown={() => handleSelectCollege(c)}
                            style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid #eee' }}
                            onMouseOver={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                            onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                // MANUAL COLLEGE ENTRY FIELDS
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '0.8rem', border: '2.5px dashed #000', borderRadius: '12px', background: '#fffcf0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>MANUAL COLLEGE NAME</label>
                    <input
                      type="text"
                      className="cyber-input"
                      value={manualCollegeName}
                      onChange={(e) => setManualCollegeName(e.target.value)}
                      placeholder="Enter full college name"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>MANUAL UNIVERSITY NAME</label>
                    <input
                      type="text"
                      className="cyber-input"
                      value={manualUniversityName}
                      onChange={(e) => setManualUniversityName(e.target.value)}
                      placeholder="Enter affiliating university"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>CITY</label>
                    <input
                      type="text"
                      className="cyber-input"
                      value={manualCity}
                      onChange={(e) => setManualCity(e.target.value)}
                      placeholder="College City"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>STATE</label>
                    <select
                      className="cyber-input"
                      style={{ cursor: 'pointer', appearance: 'auto' }}
                      value={manualState}
                      onChange={(e) => setManualState(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select state</option>
                      {statesAndUTs.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Degree & Specialization */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>DEGREE / PATHWAY</label>
                <select
                  className="cyber-input"
                  style={{ cursor: 'pointer', appearance: 'auto' }}
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                >
                  {degrees.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8f9fa', border: '2.5px solid #000', padding: '0.6rem', borderRadius: '10px' }}>
                <input
                  type="checkbox"
                  id="customSpecCheck"
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  checked={isCustomSpecialization}
                  onChange={(e) => setIsCustomSpecialization(e.target.checked)}
                />
                <label htmlFor="customSpecCheck" style={{ fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}>
                  My Specialization Is Not Listed / Custom
                </label>
              </div>

              {!isCustomSpecialization ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>SPECIALIZATION</label>
                  <select
                    className="cyber-input"
                    style={{ cursor: 'pointer', appearance: 'auto' }}
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                  >
                    {specializations.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>CUSTOM SPECIALIZATION</label>
                  <input
                    type="text"
                    className="cyber-input"
                    value={customSpecialization}
                    onChange={(e) => setCustomSpecialization(e.target.value)}
                    placeholder="e.g. Space Technology, Quantitative Finance"
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>SEMESTER / YEAR</label>
                <select
                  className="cyber-input"
                  style={{ cursor: 'pointer', appearance: 'auto' }}
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
                  <option value="Other">Other / Non-Semester</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 4: Career Goals, Interests & Profile Photo */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>CAREER GOAL</label>
                <input
                  type="text"
                  className="cyber-input"
                  value={careerGoal}
                  onChange={(e) => setCareerGoal(e.target.value)}
                  placeholder="e.g. Software Engineer at Google, Clear UPSC, IAS Officer"
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>INTERESTS (COMMA SEPARATED)</label>
                <input
                  type="text"
                  className="cyber-input"
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  placeholder="e.g. Web Development, AI, Chess, UPSC, Public Speaking"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, alignSelf: 'flex-start' }}>PROFILE PICTURE</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%' }}>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      border: '2.5px solid #000',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      flexShrink: 0,
                      boxShadow: '2px 2px 0px #000',
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                  >
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>👤</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="cyber-btn"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', height: '36px' }}
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
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="cyber-btn"
                style={{ flex: 1, background: '#fff', border: '3px solid #000', boxShadow: '4px 4px 0px #000' }}
              >
                BACK
              </button>
            )}
            
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="cyber-btn pink-fill"
                style={{ flex: 2, border: '3px solid #000', boxShadow: '4px 4px 0px #000' }}
              >
                CONTINUE
              </button>
            ) : (
              <button
                type="submit"
                className="cyber-btn pink-fill"
                style={{ flex: 2, border: '3px solid #000', boxShadow: '4px 4px 0px #000' }}
              >
                ENTER ROOMIE
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
