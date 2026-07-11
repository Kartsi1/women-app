import { create } from 'zustand';
import { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  isVerified: boolean;
  verificationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  // False until the first backend verification-status fetch resolves after login.
  // The verification navigator waits on this so it does not mount on a guessed
  // route (default 'none' → DocumentUpload) before the real status is known.
  verificationLoaded: boolean;
  expoPushToken: string | null;
  setUser: (user: User | null) => void;
  setVerified: (verified: boolean) => void;
  setVerificationStatus: (status: AuthState['verificationStatus'], reason?: string | null) => void;
  setVerificationLoaded: (loaded: boolean) => void;
  setExpoPushToken: (token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isVerified: false,
  verificationStatus: 'none',
  rejectionReason: null,
  verificationLoaded: false,
  expoPushToken: null,
  setUser: (user) => set({ user }),
  setVerified: (isVerified) => set({ isVerified }),
  setVerificationStatus: (verificationStatus, rejectionReason = null) =>
    set({ verificationStatus, rejectionReason }),
  setVerificationLoaded: (verificationLoaded) => set({ verificationLoaded }),
  setExpoPushToken: (expoPushToken) => set({ expoPushToken }),
  clear: () => set({
    user: null,
    isVerified: false,
    verificationStatus: 'none',
    rejectionReason: null,
    verificationLoaded: false,
    expoPushToken: null,
  }),
}));
