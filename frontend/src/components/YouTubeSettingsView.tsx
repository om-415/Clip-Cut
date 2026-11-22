import React, { useState, useEffect } from 'react';
import {
  Youtube,
  ShieldCheck,
  Key,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Save,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  Info,
  FileText,
  Hash,
  Globe,
  Wifi
} from 'lucide-react';
import {
  fetchPublishingSettings,
  updatePublishingSettings,
  getYouTubeAuthUrl,
  connectYouTubeAccount,
  disconnectYouTubeAccount,
  fetchConnectedYouTubeAccount,
  saveClientCredentials,
  fetchClientCredentials
} from '../api';
import { YouTubeAccountInfo, PublishingSettingsData } from '../types';

export const YouTubeSettingsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Connected channel state
  const [account, setAccount] = useState<YouTubeAccountInfo | null>(null);

  // OAuth form inputs - Initialize from localStorage if available
  const [clientId, setClientId] = useState(() => localStorage.getItem('yt_oauth_client_id') || '');
  const [clientSecret, setClientSecret] = useState(() => localStorage.getItem('yt_oauth_client_secret') || '');
  const [authCode, setAuthCode] = useState('');
  const [redirectUri, setRedirectUri] = useState('http://localhost:3000/oauth-callback');
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  // Publishing settings state
  const [settings, setSettings] = useState<PublishingSettingsData>({
    publishing_mode: 'full_auto',
    frequency: 'daily',
    preferred_hour: 18,
    privacy_status: 'public',
    default_title_template: '{title} #Shorts',
    default_desc_template: 'Epic highlights and funniest gaming moments from {channel}! 🎮🔥\n\nOriginal Stream: {source_url}\n\nSubscribe for daily clips and gaming shorts!\n\n#Shorts #Gaming #Highlights',
    default_tags: ['Shorts', 'Gaming', 'StreamHighlights', 'Clips', 'FunnyMoments'],
    auto_schedule_enabled: true
  });

  const [tagsInput, setTagsInput] = useState('Shorts, Gaming, StreamHighlights, Clips, FunnyMoments');

  const updateClientId = (val: string) => {
    setClientId(val);
    try {
      localStorage.setItem('yt_oauth_client_id', val);
    } catch {}
  };

  const updateClientSecret = (val: string) => {
    setClientSecret(val);
    try {
      localStorage.setItem('yt_oauth_client_secret', val);
    } catch {}
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setLoading(true);
    try {
      const [accRes, setRes, credRes] = await Promise.all([
        fetchConnectedYouTubeAccount(),
        fetchPublishingSettings(),
        fetchClientCredentials().catch(() => ({ has_credentials: false, has_secret: false, client_id: '', client_secret: '' }))
      ]);

      if (accRes && accRes.connected && accRes.account) {
        setAccount(accRes.account);
      } else {
        setAccount(null);
      }

      // Restore credentials from backend if not in localStorage
      let effectiveClientId = clientId || localStorage.getItem('yt_oauth_client_id') || '';
      let effectiveClientSecret = clientSecret || localStorage.getItem('yt_oauth_client_secret') || '';

      if (!effectiveClientId && credRes?.client_id) {
        effectiveClientId = credRes.client_id;
        setClientId(effectiveClientId);
        localStorage.setItem('yt_oauth_client_id', effectiveClientId);
      }
      if (!effectiveClientSecret && credRes?.client_secret) {
        effectiveClientSecret = credRes.client_secret;
        setClientSecret(effectiveClientSecret);
        localStorage.setItem('yt_oauth_client_secret', effectiveClientSecret);
      }

      if (setRes) {
        setSettings({
          publishing_mode: setRes.publishing_mode || 'full_auto',
          frequency: setRes.frequency || 'daily',
          preferred_hour: typeof setRes.preferred_hour === 'number' ? setRes.preferred_hour : 18,
          privacy_status: setRes.privacy_status || 'public',
          default_title_template: setRes.default_title_template || '{title} | Epic Gaming Moment #{index}',
          default_desc_template: setRes.default_desc_template || 'Highlights from {channel}! 🎮\n\nOriginal: {source_url}',
          default_tags: setRes.default_tags || ['Shorts', 'Gaming'],
          auto_schedule_enabled: setRes.auto_schedule_enabled ?? true
        });
        if (setRes.default_tags) {
          setTagsInput(setRes.default_tags.join(', '));
        }
      }

      // Check URL for OAuth code redirect (e.g. /oauth-callback?code=4/0A...)
      const urlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = urlParams.get('code');
      if (codeFromUrl) {
        setAuthCode(codeFromUrl);
        // If we have credentials (locally or stored on server), automatically complete connection!
        if (effectiveClientId && (effectiveClientSecret || credRes?.has_secret)) {
          await triggerConnectWithCode(effectiveClientId, effectiveClientSecret || '', codeFromUrl);
        } else {
          setStatusMessage({
            type: 'info',
            text: 'Google Authorization Code detected from sign-in! Enter your Client ID and Client Secret above, then click Connect Channel.'
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerConnectWithCode = async (cId: string, cSec: string, code: string) => {
    setConnecting(true);
    setStatusMessage({ type: 'info', text: 'Connecting your YouTube channel using Google authorization code...' });
    try {
      const res = await connectYouTubeAccount({
        client_id: cId.trim(),
        client_secret: cSec.trim(),
        code: code.trim(),
        redirect_uri: redirectUri.trim()
      });

      setAccount({
        channel_id: res.channel_id,
        channel_title: res.channel_title,
        channel_avatar: res.channel_avatar || '',
        is_active: true
      });
      setAuthCode('');
      setStatusMessage({ type: 'success', text: `Successfully connected YouTube channel: ${res.channel_title}!` });

      // Clean the URL query parameters so code is not reused
      if (window.history && window.history.replaceState) {
        const cleanPath = window.location.pathname === '/oauth-callback' ? '/' : window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
      }
    } catch (err: any) {
      setStatusMessage({ 
        type: 'error', 
        text: `OAuth connection error: ${err.message || 'Failed to exchange authorization code. Verify credentials.'}` 
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleCopyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  const handleOpenAuthUrl = async () => {
    if (!clientId.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your Google Cloud OAuth Client ID first.' });
      return;
    }
    try {
      // Save credentials first so they persist when redirected back
      localStorage.setItem('yt_oauth_client_id', clientId.trim());
      if (clientSecret.trim()) {
        localStorage.setItem('yt_oauth_client_secret', clientSecret.trim());
        await saveClientCredentials(clientId.trim(), clientSecret.trim()).catch(() => {});
      }

      let url = '';
      try {
        url = await getYouTubeAuthUrl(clientId.trim(), redirectUri.trim());
      } catch (apiErr) {
        // Resilient fallback: direct client-side generation ensures Google Auth dialog always opens
        const scopes = [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube.readonly'
        ];
        const params = new URLSearchParams({
          client_id: clientId.trim(),
          redirect_uri: redirectUri.trim(),
          response_type: 'code',
          scope: scopes.join(' '),
          access_type: 'offline',
          prompt: 'consent',
          state: 'state_stream_clipper'
        });
        url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      }

      // Open auth in new tab
      window.open(url, '_blank');
      setStatusMessage({ 
        type: 'info', 
        text: 'Google Sign-in opened in a new tab. Select your account, click Allow, and upon returning you will be connected automatically!' 
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to open Google consent screen.' });
    }
  };

  const handleConnectChannel = async () => {
    if (!clientId.trim() || !clientSecret.trim() || !authCode.trim()) {
      setStatusMessage({ type: 'error', text: 'Client ID, Client Secret, and Authorization Code are required.' });
      return;
    }
    await triggerConnectWithCode(clientId, clientSecret, authCode);
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this YouTube channel? Scheduled uploads will pause.')) {
      return;
    }
    try {
      await disconnectYouTubeAccount();
      setAccount(null);
      setStatusMessage({ type: 'success', text: 'YouTube channel disconnected.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to disconnect channel.' });
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const cleanTags = tagsInput
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const payload = {
        ...settings,
        default_tags: cleanTags
      };

      if (clientId.trim() && clientSecret.trim()) {
        await saveClientCredentials(clientId.trim(), clientSecret.trim()).catch(() => {});
      }

      await updatePublishingSettings(payload);
      setSettings(payload);
      setStatusMessage({ type: 'success', text: 'Autonomous publishing settings saved successfully.' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-secondary border border-border-subtle rounded-full text-xs text-slate-300 font-medium">
          <Youtube className="w-3.5 h-3.5 text-red-500" />
          <span>YouTube API & Automation Policy</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
          YouTube Channel & Publishing Configuration
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
          Manage your verified YouTube Data API v3 OAuth integration, autonomous upload scheduling, and default viral metadata templates.
        </p>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 animate-in fade-in ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
            : statusMessage.type === 'info'
            ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
            : 'bg-red-950/40 border-red-500/40 text-red-200'
        }`}>
          {statusMessage.type === 'success' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : statusMessage.type === 'info' ? (
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <span className="font-medium leading-relaxed">{statusMessage.text}</span>
        </div>
      )}

      {/* SECTION 1: YouTube Channel Connection */}
      <div className="studio-card p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-500" />
              <span>Official YouTube Channel Integration</span>
            </h2>
            <p className="text-xs text-slate-400">
              Uses Google YouTube Data API v3 with Resumable Upload protocol for maximum reliability.
            </p>
          </div>
          {account && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          )}
        </div>

        {account ? (
          /* Connected Channel Card */
          <div className="p-5 rounded-2xl bg-surface-primary border border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {account.channel_avatar ? (
                <img 
                  src={account.channel_avatar} 
                  alt={account.channel_title} 
                  className="w-14 h-14 rounded-full border border-border-strong object-cover" 
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-xl">
                  {account.channel_title.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-100">{account.channel_title}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                    Channel Owner
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-400 mt-0.5">ID: {account.channel_id}</p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>OAuth 2.0 Token Valid &bull; Ready for Resumable Uploads</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              className="px-4 py-2.5 rounded-xl border border-red-500/30 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-xs font-semibold flex items-center gap-2 transition-all self-end sm:self-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Disconnect Channel</span>
            </button>
          </div>
        ) : (
          /* OAuth 2.0 Setup Guide & Form */
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold">
                <Info className="w-4 h-4" />
                <span>Google Cloud Console OAuth Instructions:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed pl-1">
                <li>Create a project in <strong className="text-slate-200">Google Cloud Console</strong> and enable the <strong className="text-slate-200">YouTube Data API v3</strong>.</li>
                <li>Go to <strong className="text-slate-200">Credentials</strong> &gt; <strong className="text-slate-200">Create Credentials</strong> &gt; <strong className="text-slate-200">OAuth Client ID</strong> (Web Application).</li>
                <li>Add Authorized Redirect URI: <code className="text-indigo-300 bg-surface-tertiary px-1 py-0.5 rounded">{redirectUri}</code>.</li>
                <li>Enter your Client ID and Client Secret below, click <strong className="text-slate-200">Authorize with Google</strong>, and sign in. You will be connected automatically!</li>
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Google OAuth Client ID</span>
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => updateClientId(e.target.value)}
                  placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com"
                  className="w-full bg-surface-primary border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Google OAuth Client Secret</span>
                </label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => updateClientSecret(e.target.value)}
                  placeholder="GOCSPX-xxxxxxxxxxxxxxxx"
                  className="w-full bg-surface-primary border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Redirect URI (Add this exact URI to Google Console)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  className="flex-1 bg-surface-primary border border-border-subtle rounded-xl px-3.5 py-2 text-xs text-slate-400 font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleCopyRedirect}
                  className="px-3 py-2 rounded-xl bg-surface-secondary border border-border-subtle hover:bg-surface-tertiary text-slate-300 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {copiedRedirect ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRedirect ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleOpenAuthUrl}
                  disabled={!clientId.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all disabled:opacity-40"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Authorize with Google</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-border-subtle space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Authorization Code (Auto-populated from redirect or manual entry)
                </label>
                {authCode && (
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Code ready for exchange
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Paste authorization code (e.g. 4/0AbCd...)"
                  className="flex-1 bg-surface-primary border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  onClick={handleConnectChannel}
                  disabled={connecting || !authCode.trim() || !clientId.trim() || !clientSecret.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 disabled:opacity-40 shrink-0"
                >
                  {connecting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Youtube className="w-4 h-4" />
                      <span>Connect Channel</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Publishing Policy & Frequency */}
      <div className="studio-card p-6 space-y-6">
        <div className="border-b border-border-subtle pb-4 space-y-1">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <span>Autonomous Publishing Cadence & Privacy</span>
          </h2>
          <p className="text-xs text-slate-400">
            Define how often clips are published and whether approval is required.
          </p>
        </div>

        {/* Publishing Mode */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300">Publishing Mode</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'full_auto',
                title: 'Full Autonomous',
                desc: 'Auto-schedule and publish to YouTube without waiting for manual confirmation.',
                tag: 'Hands-Free'
              },
              {
                id: 'review_before_publish',
                title: 'Review First',
                desc: 'Generate clips and metadata, but require a 1-click approval before uploading.',
                tag: 'Recommended'
              },
              {
                id: 'generate_only',
                title: 'Generate Only',
                desc: 'Save clips and metadata to disk only. Keep upload queue in paused state.',
                tag: 'Offline'
              }
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSettings({ ...settings, publishing_mode: mode.id as any })}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  settings.publishing_mode === mode.id
                    ? 'bg-indigo-600/10 border-indigo-500 shadow-sm'
                    : 'bg-surface-primary border-border-subtle hover:border-border-strong'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-100">{mode.title}</span>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                      settings.publishing_mode === mode.id
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-surface-secondary text-slate-500'
                    }`}>
                      {mode.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{mode.desc}</p>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    settings.publishing_mode === mode.id ? 'border-indigo-400' : 'border-slate-600'
                  }`}>
                    {settings.publishing_mode === mode.id && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                  </div>
                  <span>{settings.publishing_mode === mode.id ? 'Active' : 'Select'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cadence & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Publishing Cadence</span>
            </label>
            <select
              value={settings.frequency}
              onChange={(e) => setSettings({ ...settings, frequency: e.target.value as any })}
              className="w-full bg-surface-primary border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="daily">1 Short per Day</option>
              <option value="every_12h">2 Shorts per Day (Every 12 Hours)</option>
              <option value="every_2_days">1 Short every 2 Days</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Preferred Hour (Local Time)</span>
            </label>
            <select
              value={settings.preferred_hour}
              onChange={(e) => setSettings({ ...settings, preferred_hour: parseInt(e.target.value) })}
              className="w-full bg-surface-primary border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {h.toString().padStart(2, '0')}:00 ({h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>Default YouTube Privacy</span>
            </label>
            <select
              value={settings.privacy_status}
              onChange={(e) => setSettings({ ...settings, privacy_status: e.target.value as any })}
              className="w-full bg-surface-primary border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="public">Public (Instant Discovery on Shorts Feed)</option>
              <option value="unlisted">Unlisted (Shareable Link Only)</option>
              <option value="private">Private (Only You Can View)</option>
            </select>
          </div>
        </div>

        {/* Auto schedule toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-surface-primary border border-border-subtle">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-200">Auto-Enforce Sequential Spacing</span>
            <p className="text-[11px] text-slate-400">
              When multiple clips are extracted from one stream, automatically space them across distinct days to prevent spamming the YouTube Shorts algorithm.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.auto_schedule_enabled}
            onClick={() => setSettings({ ...settings, auto_schedule_enabled: !settings.auto_schedule_enabled })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.auto_schedule_enabled ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.auto_schedule_enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* SECTION 3: Smart AI Metadata Templates */}
      <div className="studio-card p-6 space-y-6">
        <div className="border-b border-border-subtle pb-4 space-y-1">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>AI Metadata Generation Templates</span>
          </h2>
          <p className="text-xs text-slate-400">
            Variables supported: <code className="text-indigo-300">{"{title}"}</code>, <code className="text-indigo-300">{"{channel}"}</code>, <code className="text-indigo-300">{"{category}"}</code>, <code className="text-indigo-300">{"{index}"}</code>, <code className="text-indigo-300">{"{source_url}"}</code>.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Default Shorts Title Format (Includes #Shorts)</span>
              </span>
              <span className="text-[10px] text-amber-400 font-mono">Required by YouTube for Shorts shelf</span>
            </label>
            <input
              type="text"
              value={settings.default_title_template}
              onChange={(e) => setSettings({ ...settings, default_title_template: e.target.value })}
              placeholder="{title} #Shorts"
              className="w-full bg-surface-primary border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Default Shorts Description Template</span>
            </label>
            <textarea
              rows={4}
              value={settings.default_desc_template}
              onChange={(e) => setSettings({ ...settings, default_desc_template: e.target.value })}
              className="w-full bg-surface-primary border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-indigo-400" />
              <span>Default Viral Hashtags (Comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Shorts, Gaming, StreamMoments, Viral, Clutch"
              className="w-full bg-surface-primary border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: Resilience & Network Handling */}
      <div className="p-4 rounded-xl bg-surface-secondary border border-border-subtle flex items-start gap-3.5">
        <Wifi className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <span className="font-bold text-slate-200">Zero-Loss Offline Auto-Recovery</span>
          <p className="text-slate-400 leading-relaxed">
            The daemon continuously tests connectivity. If your internet drops or encounters connection errors, queued uploads are instantly placed in <code className="text-amber-300">paused</code> state with zero corrupted bytes. As soon as connectivity returns, the pipeline resumes sequentially from the exact byte offset.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Publishing Policy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
