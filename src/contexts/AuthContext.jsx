// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);

      if (u) {
        // Load user profile from Firestore
        setProfileLoading(true);
        try {
          const docRef = doc(db, "users", u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          } else {
            // User exists in Firebase Auth but has no profile (needs username)
            setUserProfile(null);
          }
        } catch (err) {
          console.error("Failed to load user profile:", err);
          setUserProfile(null);
        }
        setProfileLoading(false);
      } else {
        setUserProfile(null);
        setProfileLoading(false);
      }

      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // User is authenticated but hasn't created a username yet
  const needsUsername = user && !profileLoading && !userProfile?.username;

  // Function to refresh profile (call after setting username)
  const refreshProfile = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
    } catch (err) {
      console.error("Failed to refresh profile:", err);
    }
  };

  const value = useMemo(
    () => ({ user, userProfile, authReady, profileLoading, needsUsername, refreshProfile }),
    [user, userProfile, authReady, profileLoading, needsUsername]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
