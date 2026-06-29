import React, { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, Check, Plus, Trash2, ShieldAlert, ThumbsUp } from 'lucide-react';
import { db, isFirebaseConfigured, ref, push, onValue, set, remove } from '../firebase';

interface RoommatePersona {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: string;
  color: string;
  borderColor: string;
  description: string;
  complaintTemplate: string;
}

interface AgreementRule {
  id: string;
  title: string;
  category: string;
  assignedTo: string;
  signedBy: string[]; // list of emails
  aiFeedback: string;
}

interface AIRoommateProps {
  userEmail: string;
  userName: string;
  onRewardXp?: (amount: number, reason: string) => void;
}

const personas: RoommatePersona[] = [
  {
    id: 'cleo',
    name: 'Cleo the Organizer',
    role: 'Cleaning & Schedule Director',
    avatar: '🧹',
    status: 'Drafting weekly chore rota',
    color: '#dbeafe',
    borderColor: '#3b82f6',
    description: 'Enforces cleanliness and structure. Loves spreadsheets and chore wheels.',
    complaintTemplate: 'The kitchen sink has been full for 12 hours. Let’s stick to our agreed chore rotation!'
  },
  {
    id: 'sam',
    name: 'Sam the Chef',
    role: 'Meal Prep & Kitchen Advisor',
    avatar: '🍳',
    status: 'Meal prepping vegan lasagne',
    color: '#fef3c7',
    borderColor: '#f59e0b',
    description: 'Handles groceries, menu planning, and kitchen organization. Anti-waste advocate.',
    complaintTemplate: 'Someone left the milk out again. It’s warm. Please remember to put shared dairy items back immediately!'
  },
  {
    id: 'alex',
    name: 'Alex the Budgeter',
    role: 'Rent & Utility Auditor',
    avatar: '💵',
    status: 'Analyzing electricity bill spike',
    color: '#dcfce7',
    borderColor: '#10b981',
    description: 'Tracks expenses, split bills, and finds energy-saving tips.',
    complaintTemplate: 'The heating was left on 24°C all night with a window open. That is going to hurt our utility split!'
  }
];

export const AIRoommate: React.FC<AIRoommateProps> = ({ userEmail, userName, onRewardXp }) => {
  const [selectedPersona, setSelectedPersona] = useState<RoommatePersona>(personas[0]);
  const [agreements, setAgreements] = useState<AgreementRule[]>([]);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('Cleaning');
  const [newRuleAssignee, setNewRuleAssignee] = useState('All');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; time: string; isAi: boolean }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Load agreements from mock/real database
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      // Load fallback local mock state
      setAgreements([
        {
          id: 'rule_1',
          title: 'Quiet hours start at 10 PM on weekdays and 12 AM on weekends.',
          category: 'Noise',
          assignedTo: 'All',
          signedBy: [userEmail],
          aiFeedback: 'Cleo: "Excellent. Sleep is crucial for academic performance!"'
        },
        {
          id: 'rule_2',
          title: 'Every roommate washes their own dishes within 2 hours of cooking.',
          category: 'Kitchen',
          assignedTo: 'All',
          signedBy: [],
          aiFeedback: 'Sam: "A clean kitchen makes cooking much more enjoyable. Highly recommended!"'
        }
      ]);
      return;
    }

    const agreementsRef = ref(db, 'roommate_agreements');
    const unsub = onValue(agreementsRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        setAgreements(list);
      } else {
        setAgreements([]);
      }
    });

    return () => unsub();
  }, [userEmail]);

  // Load roommate-specific initial welcome message
  useEffect(() => {
    setChatMessages([
      {
        sender: selectedPersona.name,
        text: `Hey ${userName}! I'm ${selectedPersona.name}, your virtual AI roommate. Current status: ${selectedPersona.status}. How can I help you keep our flat running smoothly today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAi: true
      }
    ]);
  }, [selectedPersona, userName]);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleTitle.trim()) return;

    // Generate AI feedback from the selected roommate persona
    let feedback = '';
    if (selectedPersona.id === 'cleo') {
      feedback = `Cleo: "I support this rule. Let's make sure we log all updates in the flat journal."`;
    } else if (selectedPersona.id === 'sam') {
      feedback = `Sam: "Sounds good, but let's ensure we don't block access to shared kitchen appliances!"`;
    } else {
      feedback = `Alex: "A good guideline. Let's make sure it doesn't incur hidden financial or utility costs."`;
    }

    const newRule: Omit<AgreementRule, 'id'> = {
      title: newRuleTitle,
      category: newRuleCategory,
      assignedTo: newRuleAssignee,
      signedBy: [userEmail], // Creator signs automatically
      aiFeedback: feedback
    };

    if (isFirebaseConfigured && db) {
      const agreementsRef = ref(db, 'roommate_agreements');
      await push(agreementsRef, newRule);
    } else {
      setAgreements(prev => [...prev, { id: 'rule_' + Date.now(), ...newRule }]);
    }

    setNewRuleTitle('');
    if (onRewardXp) {
      onRewardXp(15, 'Created Roommate Agreement Rule');
    }
  };

  const handleToggleSign = async (ruleId: string) => {
    const targetRule = agreements.find(r => r.id === ruleId);
    if (!targetRule) return;

    let updatedSignatures = [...targetRule.signedBy];
    if (updatedSignatures.includes(userEmail)) {
      updatedSignatures = updatedSignatures.filter(email => email !== userEmail);
    } else {
      updatedSignatures.push(userEmail);
      if (onRewardXp) {
        onRewardXp(10, 'Signed Roommate Agreement Rule');
      }
    }

    if (isFirebaseConfigured && db) {
      await set(ref(db, `roommate_agreements/${ruleId}/signedBy`), updatedSignatures);
    } else {
      setAgreements(prev => prev.map(r => r.id === ruleId ? { ...r, signedBy: updatedSignatures } : r));
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (isFirebaseConfigured && db) {
      await remove(ref(db, `roommate_agreements/${ruleId}`));
    } else {
      setAgreements(prev => prev.filter(r => r.id !== ruleId));
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMsg = {
      sender: userName,
      text: inputMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAi: false
    };

    setChatMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response after short delay
    setTimeout(() => {
      let aiText = '';
      const textLower = userMsg.text.toLowerCase();

      if (selectedPersona.id === 'cleo') {
        if (textLower.includes('dirty') || textLower.includes('clean') || textLower.includes('sink')) {
          aiText = `Cleo: "I completely agree. Cleaning needs to be addressed immediately. We have a shared responsibility to keep common spaces pristine. I've flagged this in our flat logs!"`;
        } else if (textLower.includes('noise') || textLower.includes('loud') || textLower.includes('sleep')) {
          aiText = `Cleo: "Quiet hours should be strictly enforced. If a roommate is breaking this rule, it’s best to raise it calmly in our next flat meeting."`;
        } else {
          aiText = `Cleo: "Understood. Maintaining organization and clear structures is key. Let's make sure all flatmates sign the house agreement."`;
        }
      } else if (selectedPersona.id === 'sam') {
        if (textLower.includes('food') || textLower.includes('cook') || textLower.includes('kitchen') || textLower.includes('eat')) {
          aiText = `Sam: "Cooking is life! I highly recommend a weekly shared meal prep session. It saves money and keeps the kitchen tidy in one go."`;
        } else if (textLower.includes('grocery') || textLower.includes('groceries') || textLower.includes('fridge')) {
          aiText = `Sam: "Organizing fridge shelves is critical. I suggest labelling own items and having a clearly marked shelf for shared basics (milk, butter, oil)."`;
        } else {
          aiText = `Sam: "Good point! A happy stomach makes a happy home. Let me know if you need healthy recipe suggestions for the flat."`;
        }
      } else { // alex
        if (textLower.includes('money') || textLower.includes('rent') || textLower.includes('bill') || textLower.includes('split')) {
          aiText = `Alex: "A transparent split is a fair split. I suggest using flat utility apps or spreadsheets to log expenses instantly. Never let small debts pile up."`;
        } else if (textLower.includes('electricity') || textLower.includes('heat') || textLower.includes('power')) {
          aiText = `Alex: "Power usage is a major flat expense. Turning off unused lights and keeping thermostats at 20°C can save us up to 15% on bills!"`;
        } else {
          aiText = `Alex: "I've logged that suggestion. Let's run a monthly budget check to make sure everyone is financially aligned."`;
        }
      }

      setChatMessages(prev => [...prev, {
        sender: selectedPersona.name,
        text: aiText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAi: true
      }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
      
      {/* Header card with glassmorphism */}
      <div className="card-flat" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)', border: '3px solid #0f172a', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} /> AI Roommate Dashboard
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '700px', fontWeight: 600 }}>
            Collaborate with specialized AI roommate roommates to draft clean rules, sign agreements, and solve household disputes efficiently.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', flex: 1 }}>
        
        {/* Left Side: Roommate Personas & Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Personas Picker */}
          <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem' }}>AI Roommate Personas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {personas.map((p) => {
                const isSelected = selectedPersona.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPersona(p)}
                    style={{
                      background: p.color,
                      border: isSelected ? `3px solid #0f172a` : `2px solid var(--outline-thin)`,
                      borderRadius: '8px',
                      padding: '0.8rem',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '3px 3px 0px #0f172a' : 'none',
                      transition: 'transform 0.1s ease',
                      transform: isSelected ? 'translateY(-2px)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.8rem' }}>{p.avatar}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{p.name}</span>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 900,
                            background: '#0f172a',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {p.role}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>
                          {p.description}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '4px', fontSize: '0.7rem', color: '#0f766e', fontWeight: 800 }}>
                          <span className="pulse-dot"></span> Status: {p.status}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Persona Chat Card */}
          <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '2px solid #0f172a', paddingBottom: '0.6rem', marginBottom: '0.8rem' }}>
              <MessageSquare size={18} />
              <span style={{ fontWeight: 900, fontSize: '1rem' }}>Consult {selectedPersona.name}</span>
            </div>
            
            {/* Messages Display */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingRight: '4px', marginBottom: '0.8rem' }}>
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: msg.isAi ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    background: msg.isAi ? '#f1f5f9' : 'var(--accent-primary-light)',
                    color: '#0f172a',
                    border: '2px solid #0f172a',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem',
                    boxShadow: '2px 2px 0px #0f172a',
                    fontSize: '0.8rem',
                    lineHeight: '1.3'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', justifyItems: 'space-between', marginBottom: '2px' }}>
                    <span>{msg.sender}</span>
                    <span style={{ marginLeft: 'auto', paddingLeft: '8px', fontWeight: 500 }}>{msg.time}</span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{msg.text}</div>
                </div>
              ))}
              {isTyping && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, paddingLeft: '4px' }}>
                  {selectedPersona.name} is thinking...
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                placeholder={`Ask ${selectedPersona.name.split(' ')[0]} anything...`}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  border: '2px solid #0f172a',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
              >
                Send
              </button>
            </form>
          </div>

        </div>

        {/* Right Side: Flatmate Agreement and Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Create Agreement Rule Form */}
          <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={18} /> Propose Flatmate Rule
            </h3>
            <form onSubmit={handleAddRule} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Rule / Agreement Description</label>
                <input
                  type="text"
                  value={newRuleTitle}
                  onChange={e => setNewRuleTitle(e.target.value)}
                  placeholder="e.g. Clean the microwave after heating spaghetti..."
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
                    value={newRuleCategory}
                    onChange={e => setNewRuleCategory(e.target.value)}
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
                    <option value="Cleaning">Cleaning</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Noise">Noise & Guests</option>
                    <option value="Finance">Bills & Finance</option>
                    <option value="General">General Etiquette</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '3px' }}>Assignee</label>
                  <select
                    value={newRuleAssignee}
                    onChange={e => setNewRuleAssignee(e.target.value)}
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
                    <option value="All">All Flatmates</option>
                    <option value="Cleo">Cleo</option>
                    <option value="Sam">Sam</option>
                    <option value="Alex">Alex</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0.6rem', marginTop: '0.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                Propose & Sign Rule
              </button>
            </form>
          </div>

          {/* Active Agreements List */}
          <div className="card-flat" style={{ border: '3px solid #0f172a', padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Check size={18} /> Flatmate Agreements
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', flex: 1 }}>
              {agreements.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '2rem 1rem', border: '2px dashed var(--outline-thin)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                  <ShieldAlert size={28} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>No roommate agreements drafted yet.</span>
                </div>
              ) : (
                agreements.map((rule) => {
                  const hasSigned = rule.signedBy.includes(userEmail);
                  return (
                    <div
                      key={rule.id}
                      style={{
                        border: '2px solid #0f172a',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        background: '#fff',
                        boxShadow: '2px 2px 0px #0f172a',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div>
                          <span style={{
                            fontSize: '0.6rem',
                            fontWeight: 900,
                            background: 'var(--accent-secondary-light)',
                            border: '1px solid #0f172a',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            marginRight: '0.4rem'
                          }}>
                            {rule.category}
                          </span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                            {rule.title}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '2px'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* AI Roommate Review commentary */}
                      {rule.aiFeedback && (
                        <div style={{
                          background: '#f8fafc',
                          borderLeft: '3px solid #64748b',
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          fontStyle: 'italic'
                        }}>
                          {rule.aiFeedback}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                          Assigned: <strong style={{ color: '#0f172a' }}>{rule.assignedTo}</strong>
                        </span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: hasSigned ? '#10b981' : '#f59e0b' }}>
                            {hasSigned ? '✓ Signed' : '⚠ Action Required'}
                          </span>
                          <button
                            onClick={() => handleToggleSign(rule.id)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.65rem',
                              fontWeight: 900,
                              background: hasSigned ? '#fee2e2' : '#dcfce7',
                              border: '1px solid #0f172a',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <ThumbsUp size={10} />
                            {hasSigned ? 'Un-sign' : 'Sign'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
