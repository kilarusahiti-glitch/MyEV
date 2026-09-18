// Authentication Context with Demo Mode and Firebase Support
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, isFirebaseConfigured } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

const AuthContext = createContext(null);

const DEMO_USER = {
  uid: 'demo-operator-001',
  email: 'operator@smartcharge.grid',
  displayName: 'Grid Operator (Demo)',
  isDemo: true,
  role: 'Facility Manager'
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    // Check if user was previously in Demo Mode
    const savedDemo = localStorage.getItem('smartcharge_demo_user');
    if (savedDemo) {
      try {
        return JSON.parse(savedDemo);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setCurrentUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            isDemo: false,
            role: 'Building Administrator'
          });
          localStorage.removeItem('smartcharge_demo_user');
        } else if (!localStorage.getItem('smartcharge_demo_user')) {
          setCurrentUser(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    } else {
      setLoading(false);
    }
  }, []);

  const loginWithEmail = async (email, password) => {
    if (!isFirebaseConfigured || !auth) {
      // Automatic fallback to demo session
      return loginDemo();
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const registerWithEmail = async (email, password) => {
    if (!isFirebaseConfigured || !auth) {
      return loginDemo();
    }
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const loginDemo = () => {
    localStorage.setItem('smartcharge_demo_user', JSON.stringify(DEMO_USER));
    setCurrentUser(DEMO_USER);
    return DEMO_USER;
  };

  const logout = async () => {
    localStorage.removeItem('smartcharge_demo_user');
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('Sign out warning:', err);
      }
    }
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    isDemoUser: Boolean(currentUser?.isDemo),
    isFirebaseConfigured,
    loading,
    loginWithEmail,
    registerWithEmail,
    loginDemo,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
