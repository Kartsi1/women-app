import { auth } from '../config/firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Mirror the currently signed-in Firebase user into MongoDB.
 * Called once immediately after createUserWithEmailAndPassword succeeds.
 */
export async function registerUser(): Promise<unknown> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, { method: 'POST', headers });
  return res.json();
}

/**
 * Upload ID document and selfie photos to the backend for verification review.
 * Do NOT set Content-Type manually — let FormData set the boundary (RESEARCH Pitfall 5).
 */
export async function uploadVerificationDocs(idUri: string, selfieUri: string): Promise<unknown> {
  const token = await auth.currentUser?.getIdToken();
  const formData = new FormData();
  formData.append('idDocument', { uri: idUri, type: 'image/jpeg', name: 'id.jpg' } as unknown as Blob);
  formData.append('selfie', { uri: selfieUri, type: 'image/jpeg', name: 'selfie.jpg' } as unknown as Blob);
  const res = await fetch(`${API_BASE_URL}/api/users/verification-docs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
}

/**
 * Register (or update) the Expo push token for the authenticated user.
 * Called after the user grants notification permission (Plan 04 sends
 * approval/rejection notifications to this token).
 */
export async function savePushToken(token: string): Promise<unknown> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/push-token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ expoPushToken: token }),
  });
  return res.json();
}
