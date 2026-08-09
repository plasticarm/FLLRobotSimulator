import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, deleteDoc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBdLKo00-5g2W_RAlC0Ms2R2ZwJ3q0P6QQ",
  authDomain: "trans-trees-281216.firebaseapp.com",
  projectId: "trans-trees-281216",
  storageBucket: "trans-trees-281216.firebasestorage.app",
  messagingSenderId: "805031285224",
  appId: "1:805031285224:web:894b2c56a576ac36ff145d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-fllrobotsim-78f50b41-3a12-4014-9933-6a052c2952f9");
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged, collection, doc, setDoc, getDocs, getDoc, deleteDoc, query, where };
