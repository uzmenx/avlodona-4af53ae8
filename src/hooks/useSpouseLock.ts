import { useState, useCallback, useEffect } from 'react';

// Spouse lock state management
// By default, ALL spouse pairs are LOCKED (move together)
// Users can unlock specific pairs to move them independently
export const useSpouseLock = () => {
  // Store UNLOCKED pairs (inverted logic - locked by default)
  const [unlockedPairs, setUnlockedPairs] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('spouse-unlocked-pairs');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        setUnlockedPairs(new Set(parsed));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('spouse-unlocked-pairs', JSON.stringify([...unlockedPairs]));
  }, [unlockedPairs]);

  // Create a consistent key for a spouse pair
  const getPairKey = useCallback((id1: string, id2: string): string => {
    return [id1, id2].sort().join('::');
  }, []);

  // Check if a pair is locked (default: true)
  const isPairLocked = useCallback((id1: string, id2?: string): boolean => {
    if (!id2) return false;
    // Return TRUE if NOT in unlocked set (locked by default)
    return !unlockedPairs.has(getPairKey(id1, id2));
  }, [unlockedPairs, getPairKey]);

  // Toggle lock for a pair
  const toggleLock = useCallback((id1: string, id2?: string) => {
    if (!id2) return;
    const key = getPairKey(id1, id2);
    setUnlockedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Currently unlocked, make it locked (remove from unlocked set)
        next.delete(key);
      } else {
        // Currently locked, make it unlocked (add to unlocked set)
        next.add(key);
      }
      return next;
    });
  }, [getPairKey]);

  // Set lock state explicitly
  const setLock = useCallback((id1: string, id2: string | undefined, locked: boolean) => {
    if (!id2) return;
    const key = getPairKey(id1, id2);
    setUnlockedPairs((prev) => {
      const next = new Set(prev);
      if (locked) {
        // Lock it = remove from unlocked set
        next.delete(key);
      } else {
        // Unlock it = add to unlocked set
        next.add(key);
      }
      return next;
    });
  }, [getPairKey]);

  // Get spouse ID from the pair if locked
  const getLockedSpouseId = useCallback((memberId: string, spouseId?: string): string | null => {
    if (!spouseId) return null;
    if (isPairLocked(memberId, spouseId)) {
      return spouseId;
    }
    return null;
  }, [isPairLocked]);

  return {
    isPairLocked,
    toggleLock,
    setLock,
    getLockedSpouseId,
  };
};
