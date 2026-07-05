import { create } from 'zustand';

/**
 * Profile data returned from GET /api/users/:uid.
 * Includes the public projection fields plus isVerified for badge rendering.
 */
export interface Profile {
  uid?: string;
  displayName?: string;
  photoURL?: string | null;
  bio?: string;
  homeCity?: string;
  isVerified?: boolean;
  hostsCount: number;
  tripsCount: number;
}

interface ProfileState {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  clear: () => void;
}

/**
 * Zustand store for the current user's own profile data.
 *
 * Populated by ProfileScreen and EditProfileScreen on mount / after save.
 * Cleared on sign-out (called from useFirebaseAuth clear path if desired).
 */
export const useProfileStore = create<ProfileState>()((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  clear: () => set({ profile: null }),
}));
