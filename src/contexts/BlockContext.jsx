// src/contexts/BlockContext.jsx
// Provides block state throughout the app for two-way blocking
// Users I've blocked AND users who have blocked me are all invisible

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import {
  blockUser as blockUserService,
  unblockUser as unblockUserService,
} from "../services/blockService";

const BlockContext = createContext(null);

export function BlockProvider({ children }) {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedByUserIds, setBlockedByUserIds] = useState(new Set());
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Subscribe to user document for real-time block updates
  useEffect(() => {
    if (!user?.uid) {
      setBlockedUsers([]);
      setBlockedByUserIds(new Set());
      setBlockedUserIds(new Set());
      setLoading(false);
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          // Users I've blocked
          const blocked = (data.blockedUsers || []).map((u) => ({
            ...u,
            blockedAt: u.blockedAt?.toDate?.() || new Date(u.blockedAt),
          }));
          setBlockedUsers(blocked);

          // Users who have blocked me
          const blockedBy = (data.blockedBy || []).map((u) => u.id);
          setBlockedByUserIds(new Set(blockedBy));

          // Combined set for filtering
          const allBlocked = new Set();
          blocked.forEach((u) => allBlocked.add(u.id));
          blockedBy.forEach((id) => allBlocked.add(id));
          setBlockedUserIds(allBlocked);
        } else {
          setBlockedUsers([]);
          setBlockedByUserIds(new Set());
          setBlockedUserIds(new Set());
        }
        setLoading(false);
      },
      (error) => {
        console.error("[BlockContext] Error subscribing to blocks:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Check if a user should be hidden (either direction)
  const isUserHidden = useCallback(
    (userId) => {
      if (!userId) return false;
      return blockedUserIds.has(userId);
    },
    [blockedUserIds]
  );

  // Check if I blocked them
  const didIBlock = useCallback(
    (userId) => {
      if (!userId) return false;
      return blockedUsers.some((u) => u.id === userId);
    },
    [blockedUsers]
  );

  // Check if they blocked me
  const didTheyBlockMe = useCallback(
    (userId) => {
      if (!userId) return false;
      return blockedByUserIds.has(userId);
    },
    [blockedByUserIds]
  );

  // Block a user
  const blockUser = useCallback(
    async (userId) => {
      if (!user?.uid) throw new Error("Not authenticated");
      await blockUserService(user.uid, userId);
      // State will update via snapshot listener
    },
    [user?.uid]
  );

  // Unblock a user
  const unblockUser = useCallback(
    async (userId) => {
      if (!user?.uid) throw new Error("Not authenticated");
      await unblockUserService(user.uid, userId);
      // State will update via snapshot listener
    },
    [user?.uid]
  );

  const value = useMemo(
    () => ({
      blockedUserIds,
      blockedUsers,
      isUserHidden,
      didIBlock,
      didTheyBlockMe,
      blockUser,
      unblockUser,
      loading,
    }),
    [blockedUserIds, blockedUsers, isUserHidden, didIBlock, didTheyBlockMe, blockUser, unblockUser, loading]
  );

  return (
    <BlockContext.Provider value={value}>
      {children}
    </BlockContext.Provider>
  );
}

export function useBlock() {
  const context = useContext(BlockContext);
  if (!context) {
    throw new Error("useBlock must be used within a BlockProvider");
  }
  return context;
}
