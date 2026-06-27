import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInAnonymously, setPersistence, browserLocalPersistence } from 'firebase/auth';
import * as realDb from 'firebase/database';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';

// Double check if credentials exist in Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// --- Mock Database Implementation for Local E2E Tests ---
export const useMockDb = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const isFirebaseConfigured = !!firebaseConfig.apiKey || useMockDb;

class MockAuth {
  currentUser: any = null;
  listeners: ((user: any) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('roomie_mock_auth_user');
      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
        } catch (e) {}
      }
    }
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.listeners.push(callback);
    // Fire callback with the current user asynchronously to mimic Firebase behavior
    const currentUser = this.currentUser;
    setTimeout(() => callback(currentUser), 0);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  setCurrentUser(user: any) {
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('roomie_mock_auth_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('roomie_mock_auth_user');
      }
    }
    this.listeners.forEach(l => l(user));
  }
}

let app;
export let auth: any = null;
export let db: any = null;
export let storage: any = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.error('[Firebase] Failed to configure session persistence:', err);
    });
    const dbUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL || `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com`;
    db = realDb.getDatabase(app, dbUrl);
    storage = getStorage(app);
    console.log('[Firebase RTDB] successfully initialized with URL:', dbUrl);
  } catch (error) {
    console.error('[Firebase] Failed to initialize Firebase:', error);
  }
} else {
  console.log('[Firebase] Running in Offline Mock Database mode.');
}

if (useMockDb) {
  if (!auth) {
    auth = new MockAuth();
  }
  if (!db) {
    db = {};
  }
}


class MockDatabaseRef {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

export function mockRef(_dbInstance: any, path?: string) {
  return new MockDatabaseRef(path || '');
}

export async function mockSet(refInstance: MockDatabaseRef, value: any) {
  await fetch('/api/db/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: refInstance.path, value })
  });
}

export async function mockUpdate(refInstance: MockDatabaseRef, value: any) {
  await fetch('/api/db/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: refInstance.path, value })
  });
}

export async function mockPush(refInstance: MockDatabaseRef, value: any) {
  const res = await fetch('/api/db/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: refInstance.path, value })
  });
  const json = await res.json();
  return new MockDatabaseRef(refInstance.path ? `${refInstance.path}/${json.key}` : json.key);
}

export async function mockRemove(refInstance: MockDatabaseRef) {
  await fetch('/api/db/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: refInstance.path })
  });
}

export async function mockGet(refInstance: MockDatabaseRef) {
  const res = await fetch('/api/db/get?path=' + encodeURIComponent(refInstance.path));
  const json = await res.json();
  return {
    val: () => json.data,
    exists: () => json.data !== null && json.data !== undefined
  };
}

// Wrapped database operations exported to components
export const ref = (dbInstance: any, path?: string): any => {
  return useMockDb ? mockRef(dbInstance, path) : realDb.ref(dbInstance, path);
};

export const set = (refInstance: any, value: any): Promise<void> => {
  return useMockDb ? mockSet(refInstance, value) : realDb.set(refInstance, value);
};

export const update = (refInstance: any, value: any): Promise<void> => {
  return useMockDb ? mockUpdate(refInstance, value) : realDb.update(refInstance, value);
};

export const push = (refInstance: any, value: any): any => {
  return useMockDb ? mockPush(refInstance, value) : realDb.push(refInstance, value);
};

export const remove = (refInstance: any): Promise<void> => {
  return useMockDb ? mockRemove(refInstance) : realDb.remove(refInstance);
};

export const get = (refInstance: any): Promise<any> => {
  return useMockDb ? mockGet(refInstance) : realDb.get(refInstance);
};

export const onValue = (refInstance: any, callback: (snap: any) => void): (() => void) => {
  if (!useMockDb) {
    return realDb.onValue(refInstance, callback);
  }
  
  let lastDataStr = '';
  const poll = async () => {
    try {
      const snap = await mockGet(refInstance);
      const dataStr = JSON.stringify(snap.val());
      if (dataStr !== lastDataStr) {
        lastDataStr = dataStr;
        callback(snap);
      }
    } catch (e) {}
  };
  poll();
  const intervalId = window.setInterval(poll, 150);
  return () => window.clearInterval(intervalId);
};

export const onChildAdded = (refInstance: any, callback: (snap: any) => void): (() => void) => {
  if (!useMockDb) {
    return realDb.onChildAdded(refInstance, callback);
  }
  
  const seenKeys = new Set<string>();
  const poll = async () => {
    try {
      const snap = await mockGet(refInstance);
      const val = snap.val();
      if (val && typeof val === 'object') {
        for (const key of Object.keys(val)) {
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            callback({
              key,
              val: () => val[key],
              exists: () => true
            });
          }
        }
      }
    } catch (e) {}
  };
  poll();
  const intervalId = window.setInterval(poll, 150);
  return () => window.clearInterval(intervalId);
};

export const onChildChanged = (refInstance: any, callback: (snap: any) => void): (() => void) => {
  if (!useMockDb) {
    return realDb.onChildChanged(refInstance, callback);
  }
  
  const seenStates = new Map<string, string>();
  const poll = async () => {
    try {
      const snap = await mockGet(refInstance);
      const val = snap.val();
      if (val && typeof val === 'object') {
        for (const key of Object.keys(val)) {
          const stateStr = JSON.stringify(val[key]);
          if (seenStates.has(key) && seenStates.get(key) !== stateStr) {
            seenStates.set(key, stateStr);
            callback({
              key,
              val: () => val[key],
              exists: () => true
            });
          } else if (!seenStates.has(key)) {
            seenStates.set(key, stateStr);
          }
        }
      }
    } catch (e) {}
  };
  poll();
  const intervalId = window.setInterval(poll, 150);
  return () => window.clearInterval(intervalId);
};

export const onChildRemoved = (refInstance: any, callback: (snap: any) => void): (() => void) => {
  if (!useMockDb) {
    return realDb.onChildRemoved(refInstance, callback);
  }
  
  const seenKeys = new Set<string>();
  const poll = async () => {
    try {
      const snap = await mockGet(refInstance);
      const val = snap.val();
      if (val && typeof val === 'object') {
        for (const key of seenKeys) {
          if (!(key in val)) {
            seenKeys.delete(key);
            callback({
              key,
              val: () => null,
              exists: () => false
            });
          }
        }
        for (const key of Object.keys(val)) {
          seenKeys.add(key);
        }
      } else {
        for (const key of seenKeys) {
          seenKeys.delete(key);
          callback({
            key,
            val: () => null,
            exists: () => false
          });
        }
      }
    } catch (e) {}
  };
  poll();
  const intervalId = window.setInterval(poll, 150);
  return () => window.clearInterval(intervalId);
};

// ==========================================================================
// EXPORTED SERVICE METHODS (DIRECT FIREBASE ONLY - NO LOCALSTORAGE FALLBACK)
// ==========================================================================

export const authService = {
  _log: (msg: string, data?: any) => {
    if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
      console.debug('[Firebase DEBUG]', msg, data);
    }
  },
  isFirebase: isFirebaseConfigured,

  signIn: async (email: string, pass: string): Promise<{ email: string; name: string }> => {
    authService._log('signIn called', { email });
    if (useMockDb && auth && typeof auth.setCurrentUser === 'function') {
      const uid = email.replace(/[^a-zA-Z0-9]/g, '_');
      const mockUserData = await mockGet(new MockDatabaseRef('users/' + uid));
      let displayName = email.split('@')[0];
      if (mockUserData.exists()) {
        const val = mockUserData.val();
        displayName = val.name || val.profile?.fullName || displayName;
      }
      const userObj = {
        uid,
        email,
        displayName,
        isAnonymous: false,
        getIdTokenResult: async () => ({ claims: { admin: email === 'admin@roomie.io' || (mockUserData.exists() && !!mockUserData.val().isAdmin) } })
      };
      auth.setCurrentUser(userObj);
      return { email, name: displayName };
    }
    if (isFirebaseConfigured && auth) {
      const start = Date.now();
      const creds = await signInWithEmailAndPassword(auth, email, pass);
      const duration = Date.now() - start;
      if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
        console.debug('[Firebase] signIn success', { email }, `took ${duration}ms`);
      }
      return { email: creds.user.email || email, name: creds.user.displayName || email.split('@')[0] };
    }
    throw new Error('Realtime service unavailable (Firebase Authentication not configured).');
  },

  signInAnonymously: async (): Promise<{ uid: string }> => {
    authService._log('signInAnonymously called');
    if (useMockDb && auth && typeof auth.setCurrentUser === 'function') {
      const uid = 'local_guest_' + Math.floor(1000 + Math.random() * 9000);
      const email = `guest_${uid}@roomie.io`;
      const name = `Guest_${uid.substring(0, 5)}`;
      const userObj = {
        uid,
        email,
        displayName: name,
        isAnonymous: true,
        getIdTokenResult: async () => ({ claims: { admin: false } })
      };
      // Pre-populate guest profile so onboarding flows cleanly
      await mockSet(new MockDatabaseRef('users/' + uid), {
        email,
        name,
        profile: {
          fullName: name,
          email,
          onboardingCompleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });
      auth.setCurrentUser(userObj);
      return { uid };
    }
    if (isFirebaseConfigured && auth) {
      const start = Date.now();
      const creds = await signInAnonymously(auth);
      const duration = Date.now() - start;
      if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
        console.debug('[Firebase] signInAnonymously success', { uid: creds.user.uid }, `took ${duration}ms`);
      }
      // Ensure guest user exists in the Realtime Database
      const email = `guest_${creds.user.uid}@roomie.io`;
      const name = `Guest_${creds.user.uid.substring(0, 5)}`;
      const userRef = ref(db, 'users/' + creds.user.uid);
      const snap = await get(userRef);
      if (!snap.exists()) {
        await set(userRef, {
          email,
          name,
          profile: {
            fullName: name,
            email,
            onboardingCompleted: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        });
      }
      return { uid: creds.user.uid };
    }

    throw new Error('Guest login is unavailable because Firebase Authentication is not configured.');
  },

  signUp: async (
    email: string,
    pass: string,
    name: string,
    course?: string,
    degree?: string,
    college?: string,
    location?: string,
  ): Promise<{ email: string; name: string; course?: string; degree?: string; college?: string; location?: string }> => {
    if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
      console.debug('[Firebase] signUp called', { email, name });
    }
    const uid = email.replace(/[^a-zA-Z0-9]/g, '_');
    const profileData = {
      email,
      name,
      level: 1,
      xp: 0,
      maxXp: 1000,
      stats: { intelligence: 5, strength: 5, discipline: 5, creativity: 5, communication: 5, career: 5 },
      unlockedSkills: [],
      quests: [
        { id: 'q1', title: 'Complete Python Challenge', category: 'Study', difficulty: 'Medium', xpReward: 100, statReward: { intelligence: 10 }, completed: false },
        { id: 'q2', title: 'Read 20 Pages', category: 'Productivity', difficulty: 'Easy', xpReward: 50, statReward: { discipline: 5 }, completed: false }
      ],
      achievements: [
        { id: 'first_proj', title: 'First Project Done', icon: 'PRJ', desc: 'Finish your first developer deployment', unlocked: false, rarity: 'Common' },
        { id: 'streak_30', title: '30-Day Streak', icon: 'STK', desc: 'Keep consistency alive for 30 cycles', unlocked: false, rarity: 'Rare' },
        { id: 'lvl_20', title: 'Level 20 Reached', icon: 'LVL', desc: 'Achieve Academic Level 20', unlocked: false, rarity: 'Epic' },
        { id: 'ml_master', title: 'ML Master', icon: 'MST', desc: 'Successfully complete the Machine Learning Milestone Assessment', unlocked: false, rarity: 'Legendary' }
      ],
      customization: {
        avatarTier: 1,
        showVisor: false,
        showDrone: false,
        showHalo: false,
        showMatrix: false,
        accentHue: 195,
        saturation: 100,
        brightness: 100,
        autoSync: true,
        hasScanned: false,
        faceCut: 'round',
        hairStyle: 'curly',
        eyeColor: 'green',
        hairAccessory: 'none'
      },
      course: course || 'Computer Science',
      degree: degree || 'Bachelor of Science',
      college: college || 'State University',
      location: location || 'San Francisco, CA',
      profile: {
        fullName: name,
        email: email,
        phone: '',
        bio: '',
        degree: degree || 'Bachelor of Science',
        specialization: course || 'Computer Science',
        semester: 'Semester 1',
        college: college || 'State University',
        university: 'State University System',
        state: location ? location.split(',')[1]?.trim() || '' : 'CA',
        city: location ? location.split(',')[0]?.trim() || '' : 'San Francisco',
        careerGoal: 'Software Engineer',
        academicInterests: 'Computer Science, Software Engineering',
        profilePhoto: null,
        onboardingCompleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };

    if (useMockDb && auth && typeof auth.setCurrentUser === 'function') {
      await mockSet(new MockDatabaseRef('users/' + uid), profileData);
      const userObj = {
        uid,
        email,
        displayName: name,
        isAnonymous: false,
        getIdTokenResult: async () => ({ claims: { admin: email === 'admin@roomie.io' } })
      };
      auth.setCurrentUser(userObj);
      return { email, name, course, degree, college, location };
    }

    if (isFirebaseConfigured && auth && db) {
      const start = Date.now();
      const creds = await createUserWithEmailAndPassword(auth, email, pass);
      const duration = Date.now() - start;
      if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
        console.debug('[Firebase] signUp success', { email, uid: creds.user.uid }, `took ${duration}ms`);
      }
      await set(ref(db, 'users/' + creds.user.uid), profileData);
      return { email, name, course, degree, college, location };
    }
    throw new Error('Realtime service unavailable (Firebase Database/Auth not configured).');
  },

  signOut: async () => {
    if (useMockDb && auth && typeof auth.setCurrentUser === 'function') {
      auth.setCurrentUser(null);
      return;
    }
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
  }
};

export const databaseService = {
  getUserData: async (_email: string): Promise<any> => {
    if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
      console.debug('[Firebase] getUserData called', { email: _email });
    }
    if (db && auth && auth.currentUser) {
      const start = Date.now();
      const snap = await get(ref(db, 'users/' + auth.currentUser.uid));
      const duration = Date.now() - start;
      if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
        console.debug('[Firebase] getUserData result', { exists: snap.exists() }, `took ${duration}ms`);
      }
      if (snap.exists()) {
        return snap.val();
      }
      return null;
    }
    throw new Error('Realtime service unavailable (Firebase not fully connected or active user session missing).');
  },

  saveUserData: async (_email: string, data: any): Promise<void> => {
    if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
      console.debug('[Firebase] saveUserData called', { email: _email, data });
    }
    if (db && auth && auth.currentUser) {
      const start = Date.now();
      await update(ref(db, 'users/' + auth.currentUser.uid), data);
      const duration = Date.now() - start;
      if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
        console.debug('[Firebase] saveUserData completed', { email: _email }, `took ${duration}ms`);
      }
      return;
    }
    throw new Error('Realtime service unavailable (Firebase not fully connected or active user session missing).');
  }
};

if (typeof window !== 'undefined') {
  (window as any).firebase = {
    database: () => {
      return {
        ref: (path: string) => {
          return {
            once: async (eventType: string) => {
              if (eventType !== 'value') {
                throw new Error('Only "value" event type is supported in e2e compat layer');
              }
              let targetPath = path;
              if (path.startsWith('rooms/')) {
                const roomTitle = path.substring(6);
                const roomId = 'room_' + roomTitle.toLowerCase().replace(/\s+/g, '-');
                targetPath = 'study_rooms/' + roomId;
              }
              let snap = await get(ref(db, targetPath));
              if (useMockDb && !snap.exists()) {
                for (let i = 0; i < 8; i++) {
                  await new Promise(r => setTimeout(r, 200));
                  snap = await get(ref(db, targetPath));
                  if (snap.exists()) break;
                }
              }
              return {
                val: () => snap.val()
              };
            }
          };
        }
      };
    }
  };
}

export async function uploadFile(file: File | Blob, fileName: string, ownerEmail: string): Promise<string> {
  console.log('[UPLOAD] Starting upload of', fileName, 'for', ownerEmail);
  // 100MB Limit: 100 * 1024 * 1024 = 104,857,600 bytes
  if (file.size > 104857600) {
    console.error('[UPLOAD FAILED] File size exceeds 100MB limit.');
    throw new Error('File size exceeds 100MB limit.');
  }

  const uploadToLocalMockDb = (): Promise<string> => {
    const mockId = 'file_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          await set(ref(db, 'pdf_contents/' + mockId), reader.result as string);
          console.log('[UPLOAD SUCCESS (Local Mock DB)]');
          resolve(`mock-file-url:${mockId}`);
        } catch (e) {
          console.error('[UPLOAD FAILED (Local Mock DB)]', e);
          reject(e);
        }
      };
      reader.onerror = (e) => {
        console.error('[UPLOAD FAILED] FileReader error', e);
        reject(e);
      };
      reader.readAsDataURL(file);
    });
  };

  if (useMockDb) {
    return uploadToLocalMockDb();
  }

  if (!storage) {
    throw new Error('Firebase Storage is not initialized.');
  }

  if (!auth?.currentUser?.uid) {
    throw new Error('You must be signed in before uploading files.');
  }

  try {
    const uid = auth.currentUser.uid;
    const path = `notes/${uid}/${fileName}`;
    const storageRefInstance = sRef(storage, path);
    const metadata = {
      contentDisposition: `attachment; filename="${fileName}"`,
      contentType: file.type || 'application/octet-stream'
    };
    
    const uploadPromise = uploadBytes(storageRefInstance, file, metadata);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Upload request timed out after 15 seconds.')), 15000)
    );
    
    await Promise.race([uploadPromise, timeoutPromise]);
    
    const downloadUrl = await getDownloadURL(storageRefInstance);
    console.log('[UPLOAD SUCCESS (Firebase Storage)]');
    return downloadUrl;
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Firebase Storage upload failed: ${err.message}`);
    }
    throw new Error('Firebase Storage upload failed.');
  }
}


