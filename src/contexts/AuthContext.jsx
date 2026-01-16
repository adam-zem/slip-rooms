// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

// Admin email addresses
const ADMIN_EMAILS = ["brothamode1@gmail.com"];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
            const profileData = docSnap.data();
            setUserProfile(profileData);

            // Check if user should be admin based on email
            const shouldBeAdmin = ADMIN_EMAILS.includes(u.email?.toLowerCase());

            // If isAdmin field doesn't match what it should be, update it
            if (profileData.isAdmin !== shouldBeAdmin) {
              await updateDoc(docRef, { isAdmin: shouldBeAdmin });
              setIsAdmin(shouldBeAdmin);
            } else {
              setIsAdmin(profileData.isAdmin === true);
            }
          } else {
            // User exists in Firebase Auth but has no profile (needs username)
            setUserProfile(null);
            // Check admin status even for new users
            setIsAdmin(ADMIN_EMAILS.includes(u.email?.toLowerCase()));
          }
        } catch (err) {
          console.error("Failed to load user profile:", err);
          setUserProfile(null);
          setIsAdmin(false);
        }
        setProfileLoading(false);
      } else {
        setUserProfile(null);
        setIsAdmin(false);
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
        const profileData = docSnap.data();
        setUserProfile(profileData);
        setIsAdmin(profileData.isAdmin === true);
      }
    } catch (err) {
      console.error("Failed to refresh profile:", err);
    }
  };

  const value = useMemo(
    () => ({
      user,
      userProfile,
      authReady,
      profileLoading,
      needsUsername,
      isAdmin,
      refreshProfile,
    }),
    [user, userProfile, authReady, profileLoading, needsUsername, isAdmin]
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
