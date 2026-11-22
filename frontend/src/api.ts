import { VideoMetadata, Project, Clip, User, AuthResponse, ClientCredentials } from './types';

const API_BASE = '';

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem('clipcut_auth_token') || localStorage.getItem('fragflash_auth_token');
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem('clipcut_auth_token', token);
      localStorage.setItem('fragflash_auth_token', token);
    } else {
      localStorage.removeItem('clipcut_auth_token');
      localStorage.removeItem('fragflash_auth_token');
    }
  } catch {}
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('clipcut_auth_user') || localStorage.getItem('fragflash_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem('clipcut_auth_user', JSON.stringify(user));
      localStorage.setItem('fragflash_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('clipcut_auth_user');
      localStorage.removeItem('fragflash_auth_user');
    }
  } catch {}
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// -------------------------------------------------------------
// Authentication APIs
// -------------------------------------------------------------

export async function registerAccount(params: {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Failed to create account');
  }
  const data: AuthResponse = await res.json();
  setStoredAuthToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function loginAccount(params: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail || 'Invalid email or password');
  }
  const data: AuthResponse = await res.json();
  setStoredAuthToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function googleSignIn(params: {
  email?: string;
  first_name?: string;
  last_name?: string;
  google_id?: string;
  avatar_url?: string;
  credential?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Google sign-in failed' }));
    throw new Error(err.detail || 'Google authentication error');
  }
  const data: AuthResponse = await res.json();
  setStoredAuthToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function getGoogleAuthUrl(redirectUri?: string): Promise<{ auth_url: string; state: string; client_id: string }> {
  const qs = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
  const res = await fetch(`${API_BASE}/api/auth/google/url${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to generate Google login URL' }));
    throw new Error(err.detail || 'Google OAuth is not configured on this server.');
  }
  return res.json();
}

export async function exchangeGoogleCode(code: string, redirectUri: string, state?: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/google/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri, state }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Google code exchange failed' }));
    throw new Error(err.detail || 'Failed to authenticate with Google');
  }
  const data: AuthResponse = await res.json();
  setStoredAuthToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function verifyGoogleCredential(credential: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/google/credential`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Google credential verification failed' }));
    throw new Error(err.detail || 'Failed to verify Google token');
  }
  const data: AuthResponse = await res.json();
  setStoredAuthToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function getAppleAuthUrl(redirectUri?: string): Promise<{ auth_url: string; configured: boolean; message?: string }> {
  const qs = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
  const res = await fetch(`${API_BASE}/api/auth/apple/url${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to generate Apple login URL' }));
    throw new Error(err.detail || 'Apple OAuth request error');
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Not authenticated');
  const user: User = await res.json();
  setStoredUser(user);
  return user;
}

export function logoutAccount(): void {
  setStoredAuthToken(null);
  setStoredUser(null);
}

export async function fetchVideoMetadata(url: string): Promise<VideoMetadata> {
  const res = await fetch(`${API_BASE}/api/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch metadata' }));
    throw new Error(err.detail || 'Failed to fetch video metadata');
  }
  return res.json();
}

export async function createProject(params: {
  url: string;
  num_clips: number;
  clip_duration: number;
  subtitle_style: string;
  layout_mode: string;
  auto_generate_clips: boolean;
  data_saver_mode?: boolean;
  title?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
}): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create project' }));
    throw new Error(err.detail || 'Failed to start stream clipping project');
  }
  return res.json();
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load projects');
  return res.json();
}

export async function getProject(projectId: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch project details');
  return res.json();
}

export async function adjustHighlight(
  highlightId: string,
  startTime: number,
  endTime: number,
  category?: string,
  description?: string
): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/highlights/${highlightId}/adjust`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ start_time: startTime, end_time: endTime, category, description }),
  });
  if (!res.ok) throw new Error('Failed to adjust highlight');
  return res.json();
}

export async function generateClip(
  highlightId: string,
  layoutMode: string,
  subtitleStyle: string
): Promise<{ clip_id: string; clip_url: string }> {
  const res = await fetch(`${API_BASE}/api/highlights/${highlightId}/generate-clip`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ layout_mode: layoutMode, subtitle_style: subtitleStyle }),
  });
  if (!res.ok) throw new Error('Failed to render clip');
  return res.json();
}

export async function listAllClips(): Promise<Clip[]> {
  const res = await fetch(`${API_BASE}/api/clips`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load clips');
  return res.json();
}

export async function deleteProject(projectId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete project');
}

// -------------------------------------------------------------
// Autonomous Content Pipeline & YouTube Publishing APIs
// -------------------------------------------------------------

export async function fetchConnectivity(): Promise<{ is_online: boolean; status: string }> {
  const res = await fetch(`${API_BASE}/api/connectivity/status`);
  if (!res.ok) return { is_online: false, status: 'offline' };
  return res.json();
}

export async function fetchAutomationStatus(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/automation/status`);
  if (!res.ok) throw new Error('Failed to fetch automation telemetry');
  return res.json();
}

export async function fetchQueueItems(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/queue`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load upload queue');
  return res.json();
}

export async function publishQueueItemNow(itemId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/queue/${itemId}/publish-now`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Failed to trigger immediate upload');
  }
  return res.json();
}

export async function approveQueueItem(itemId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/queue/${itemId}/approve`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to approve clip');
  return res.json();
}

export async function togglePauseQueueItem(itemId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/queue/${itemId}/pause`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to toggle pause status');
  return res.json();
}

export async function updateQueueItem(itemId: string, data: {
  title?: string;
  description?: string;
  hashtags?: string[];
  caption?: string;
  scheduled_time?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/queue/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update queued clip');
  return res.json();
}

export async function deleteQueueItem(itemId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/queue/${itemId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete queue item');
  return res.json();
}

export async function fetchPublishingSettings(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/settings/publishing`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load publishing settings');
  return res.json();
}

export async function updatePublishingSettings(data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/settings/publishing`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save publishing settings');
  return res.json();
}

export async function saveClientCredentials(clientId: string, clientSecret: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/youtube/client-credentials`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error('Failed to save client credentials');
  return res.json();
}

export async function fetchClientCredentials(): Promise<ClientCredentials> {
  const res = await fetch(`${API_BASE}/api/youtube/client-credentials`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return { has_credentials: false, has_secret: false, client_id: '', client_secret: '' };
  return res.json();
}

export async function getYouTubeAuthUrl(clientId: string, redirectUri: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/youtube/auth-url?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to generate Google consent URL');
  const data = await res.json();
  return data.auth_url;
}

export async function connectYouTubeAccount(params: {
  client_id: string;
  client_secret: string;
  code: string;
  redirect_uri: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/youtube/connect`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to connect YouTube channel' }));
    throw new Error(err.detail || 'Failed to authenticate YouTube channel');
  }
  return res.json();
}

export async function disconnectYouTubeAccount(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/youtube/disconnect`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to disconnect YouTube account');
  return res.json();
}

export async function fetchConnectedYouTubeAccount(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/youtube/account`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return { connected: false, account: null };
  return res.json();
}

export async function fetchChannelVideos(limit: number = 10): Promise<{
  connected: boolean;
  channel_title: string;
  channel_id?: string;
  channel_avatar?: string;
  videos: Array<{
    video_id: string;
    title: string;
    description: string;
    published_at: string;
    thumbnail_url: string;
    youtube_url: string;
    status: string;
  }>;
}> {
  const res = await fetch(`${API_BASE}/api/youtube/channel/videos?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return { connected: false, channel_title: '', videos: [] };
  return res.json();
}

// -------------------------------------------------------------
// System Diagnostics & Clip Studio Editor APIs
// -------------------------------------------------------------

export async function fetchSystemInfo(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/system/info`);
  if (!res.ok) throw new Error('Failed to retrieve system diagnostics telemetry');
  return res.json();
}

export async function fetchClipSubtitles(clipId: string): Promise<{
  clip_id: string;
  transcript_text: string;
  duration: number;
  subtitle_style: string;
  layout_type: string;
  saved_settings: any;
}> {
  const res = await fetch(`${API_BASE}/api/clips/${clipId}/subtitles`);
  if (!res.ok) throw new Error('Failed to load clip subtitle data');
  return res.json();
}

export async function renderEditedClip(clipId: string, params: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/clips/${clipId}/edit-render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Rendering failed' }));
    throw new Error(err.detail || 'Failed to render customized clip');
  }
  return res.json();
}

export async function revertClip(clipId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/clips/${clipId}/revert`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to revert clip');
  return res.json();
}

export function getClipDownloadUrl(clipId: string, version: 'edited' | 'original' = 'edited'): string {
  return `${API_BASE}/api/clips/${clipId}/download?version=${version}`;
}

export async function joinInstagramWaitlist(email: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/waitlist/instagram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to join waitlist' }));
    throw new Error(err.detail || 'Failed to join Instagram early access');
  }
  return res.json();
}
