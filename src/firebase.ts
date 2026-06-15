import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDatabase, ref, set, get, child } from 'firebase/database';

// Double check if credentials exist in Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = !!firebaseConfig.apiKey;

let app;
export let auth: any = null;
export let db: any = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    const dbUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL || `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com`;
    db = getDatabase(app, dbUrl);
    console.log('[Firebase RTDB] successfully initialized with URL:', dbUrl);
  } catch (error) {
    console.error('[Firebase] Failed to initialize Firebase:', error);
  }
} else {
  console.log('[Firebase] Running in Offline Mock Database mode. Connect your Firebase credentials in .env to link cloud databases.');
}

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
    email: string, 
    pass: string, 
    name: string, 
    course?: string, 
    degree?: string, 
    college?: string, 
    location?: string
  ): Promise<{ email: string; name: string; course?: string; degree?: string; college?: string; location?: string }> => {
    if (isFirebaseConfigured && auth && db) {
      const start = Date.now();
      const creds = await createUserWithEmailAndPassword(auth, email, pass);
      const duration = Date.now() - start;
      if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
        console.debug('[Firebase] signUp success', { email, uid: creds.user.uid }, `took ${duration}ms`);
      }
      await set(ref(db, 'users/' + creds.user.uid), {
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
          { id: 'lvl_20', title: 'Level 20 Reached', icon: 'LVL', desc: 'Scale into a senior network status', unlocked: false, rarity: 'Epic' },
          { id: 'ml_master', title: 'ML Master', icon: 'MST', desc: 'Defeat Overfitter Prime in combat', unlocked: false, rarity: 'Legendary' }
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
        location: location || 'San Francisco, CA'
      });
      return { email, name, course, degree, college, location };
    }
    throw new Error('Realtime service unavailable (Firebase Database/Auth not configured).');
  },

  signOut: async () => {
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
    if (isFirebaseConfigured && db && auth && auth.currentUser) {
      const start = Date.now();
      const snap = await get(child(ref(db), 'users/' + auth.currentUser.uid));
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
    if (isFirebaseConfigured && db && auth && auth.currentUser) {
      const start = Date.now();
      await set(ref(db, 'users/' + auth.currentUser.uid), data);
      const duration = Date.now() - start;
      if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
        console.debug('[Firebase] saveUserData completed', { email: _email }, `took ${duration}ms`);
      }
      return;
    }
    throw new Error('Realtime service unavailable (Firebase not fully connected or active user session missing).');
  }
};
