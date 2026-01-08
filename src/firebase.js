// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD9XCKVagyRi10hhgjyPgZxoBuPVRD_R8Y",
  authDomain: "sliprooms-279e3.firebaseapp.com",
  projectId: "sliprooms-279e3",
  storageBucket: "sliprooms-279e3.firebasestorage.app",
  messagingSenderId: "646844776858",
  appId: "1:646844776858:web:f2ed004f7205318742fa23",
  measurementId: "G-QZVL3D0F1Q",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
