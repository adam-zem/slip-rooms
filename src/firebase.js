// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDQXCKVagyRi1OhhgjyPgZxoBuPVRD_R8Y",
  authDomain: "sliprooms-279e3.firebaseapp.com",
  projectId: "sliprooms-279e3",
  databaseURL: "https://sliprooms-279e3-default-rtdb.firebaseio.com",
  storageBucket: "sliprooms-279e3.firebasestorage.app",
  messagingSenderId: "646844776858",
  appId: "1:646844776858:web:f2ed004f7205318742fa23",
  measurementId: "G-QZVL3D0F1Q",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
