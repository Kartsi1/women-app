import { create } from 'zustand';
import { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  isVerified: boolean;
  verificationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  expoPushToken: string | null;
  setUser: (user: User | null) => void;
  setVerified: (verified: boolean) => void;
  setVerificationStatus: (status: AuthState['verificationStatus'], reason?: string | null) => void;
  setExpoPushToken: (token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isVerified: false,
  verificationStatus: 'none',
  rejectionReason: null,
  expoPushToken: null,
  setUser: (user) => set({ user }),
  setVerified: (isVerified) => set({ isVerified }),
  setVerificationStatus: (verificationStatus, rejectionReason = null) =>
    set({ verificationStatus, rejectionReason }),
  setExpoPushToken: (expoPushToken) => set({ expoPushToken }),
  clear: () => set({
    user: null,
    isVerified: false,
    verificationStatus: 'none',
    rejectionReason: null,
    expoPushToken: null,
  }),
}));
