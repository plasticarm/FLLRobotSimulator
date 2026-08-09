import React, { useEffect, useState } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from '../lib/firebase';
import { User } from 'firebase/auth';

export function Auth() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (user) {
    return (
      <div className="flex items-center space-x-3">
        <img src={user.photoURL || ''} alt="User avatar" className="w-6 h-6 rounded-full border border-slate-700" />
        <span className="text-xs font-medium text-slate-300 hidden sm:inline-block">{user.displayName}</span>
        <button onClick={handleLogout} className="text-xs font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors">
          Logout
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleLogin} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded uppercase tracking-widest transition-colors">
      Login with Google
    </button>
  );
}
