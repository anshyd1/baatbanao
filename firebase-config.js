/* ===========================================================
   BaatBanao Firebase Config v1.0.9
   =========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  onDisconnect,
  serverTimestamp as rtdbServerTimestamp,
  off
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-4eqPP8FlEAzM-onnAqZ1quWspj12cpI",
  authDomain: "baatbanao.firebaseapp.com",
  projectId: "baatbanao",
  storageBucket: "baatbanao.firebasestorage.app",
  messagingSenderId: "338450369503",
  appId: "1:338450369503:web:8fa2f2f1a71ddd538d526a",
  databaseURL: "https://baatbanao-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Expose globally for chat-app.js
window.BB_Firebase = {
  app, auth, db, rtdb,
  signInAnonymously, updateProfile, onAuthStateChanged,
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove, increment, writeBatch,
  ref, set, onValue, onDisconnect, rtdbServerTimestamp, off
};

// Dispatch ready event
window.dispatchEvent(new CustomEvent('bb-firebase-ready'));
console.log('[BB] Firebase initialized ✅');
