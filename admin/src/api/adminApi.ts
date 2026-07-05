/**
 * Admin API client — plain fetch, no axios (RESEARCH alternatives table).
 * Session token is stored in module scope; set it via setSessionToken after login.
 */

const API_BASE_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? '';
// Empty string falls through to Vite proxy ('/api' -> 'http://localhost:3000/api')

let sessionToken: string | null = null;

export function setSessionToken(token: string): void {
  sessionToken = token;
}

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${sessionToken ?? ''}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export interface LoginResponse {
  token?: string;
  error?: string;
}

export async function adminLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json() as Promise<LoginResponse>;
}

export interface PendingUser {
  uid: string;
  email: string;
  docUrl: string | null;
  selfieUrl: string | null;
  createdAt: string;
}

export interface QueueResponse {
  queue?: PendingUser[];
  error?: string;
}

export async function getVerificationQueue(): Promise<QueueResponse> {
  const res = await authedFetch('/api/admin/verification-queue');
  return res.json() as Promise<QueueResponse>;
}

export interface ActionResponse {
  status?: string;
  error?: string;
}

export async function approveUser(uid: string): Promise<ActionResponse> {
  const res = await authedFetch(`/api/admin/approve/${uid}`, { method: 'POST' });
  return res.json() as Promise<ActionResponse>;
}

export async function rejectUser(uid: string, reason: string): Promise<ActionResponse> {
  const res = await authedFetch(`/api/admin/reject/${uid}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return res.json() as Promise<ActionResponse>;
}
