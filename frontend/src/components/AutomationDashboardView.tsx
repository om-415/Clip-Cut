import React, { useEffect, useState } from 'react';
import { 
  Zap, 
  Wifi, 
  WifiOff, 
  Youtube, 
  Clock, 
  CheckCircle2, 
  Play, 
  RefreshCw, 
  Sparkles, 
  ShieldCheck 
} from 'lucide-react';
import { AutomationStatusData } from '../types';
import { fetchAutomationStatus, publishQueueItemNow, updatePublishingSettings } from '../api';
import { InstagramAutomationCard } from './InstagramAutomationCard';

interface AutomationDashboardViewProps {
  onOpenQueue: () => void;
  onOpenSettings: () => void;
  onNewStream: () => void;
}

export const AutomationDashboardView: React.FC<AutomationDashboardViewProps> = ({
  onOpenQueue,
  onOpenSettings,
  onNewStream,
}) => {
  const [data, setData] = useState<AutomationStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishingNow, setPublishingNow] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetchAutomationStatus();
      setData(res);
    } catch (err) {
      console.error('Failed to load automation status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handlePublishNextNow = async () => {
    if (!data?.next_scheduled_item?.id) return;
    setPublishingNow(true);
    try {
      await publishQueueItemNow(data.next_scheduled_item.id);
      await loadStatus();
    } catch (err: any) {
      alert(err.message || 'Immediate publish failed');
    } finally {
      setPublishingNow(false);
    }
  };

  const handleModeChange = async (mode: string) => {
    setModeSaving(true);
    try {
      await updatePublishingSettings({
        publishing_mode: mode,
        frequency: data?.frequency || 'daily',
        preferred_hour: data?.preferred_hour || 18,
        privacy_status: data?.privacy_status || 'public',
      });
      await loadStatus();
    } catch (err: any) {
      alert(err.message || 'Failed to update publishing mode');
    } finally {
      setModeSaving(false);
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Not scheduled';
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
              Autonomous Pipeline Daemon
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 mt-1">
            Automated YouTube Shorts Studio
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end automation: AI stream analysis &bull; vertical composition &bull; metadata generation &bull; scheduled YouTube publishing
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadStatus}
            disabled={loading}
            className="p-2.5 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 rounded-xl border border-border-subtle transition-all"
            title="Refresh pipeline telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onNewStream}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            <span>Process New Stream</span>
          </button>
        </div>
      </div>

      {/* Connectivity & Auto-Recovery Banner */}
      <div className={`studio-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
        data?.is_online 
          ? 'border-emerald-500/30 bg-emerald-950/10' 
          : 'border-red-500/40 bg-red-950/20'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl shrink-0 ${
            data?.is_online 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {data?.is_online ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">
                Network Status: {data?.is_online ? 'Connected & Online' : 'Offline / Waiting for Connectivity'}
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                data?.is_online ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
              }`}>
                {data?.is_online ? 'Auto-Publishing Active' : 'Queue Paused Safe'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {data?.is_online
                ? 'Persistent background worker is running. Ready to upload on schedule.'
                : 'Upload attempts are safely paused. When your internet connection returns, the queue will resume automatically with exponential backoff.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-[11px] font-mono text-slate-500">
            Checks every 25s
          </span>
        </div>
      </div>

      {/* Telemetry Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Connected Channel Card */}
        <div className="studio-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Channel Account</span>
            <Youtube className="w-4 h-4 text-red-500" />
          </div>

          {data?.connected_account ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {data.connected_account.channel_avatar ? (
                  <img
                    src={data.connected_account.channel_avatar}
                    alt={data.connected_account.channel_title}
                    className="w-10 h-10 rounded-full border border-border-strong object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold">
                    YT
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-slate-100 truncate">
                    {data.connected_account.channel_title}
                  </p>
                  <p className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>OAuth Connected</span>
                  </p>
                </div>
              </div>
              <button
                onClick={onOpenSettings}
                className="text-[11px] text-slate-400 hover:text-indigo-300 font-semibold transition-colors block"
              >
                Manage Channel &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">No YouTube channel linked yet.</p>
              <button
                onClick={onOpenSettings}
                className="w-full py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-lg text-xs font-bold transition-colors"
              >
                Connect YouTube
              </button>
            </div>
          )}
        </div>

        {/* Queued Shorts Card */}
        <div className="studio-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Upload Queue</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-3xl font-black font-mono text-slate-100">
              {data?.counts?.scheduled ?? 0}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Shorts Scheduled &bull; {data?.counts?.awaiting_approval ?? 0} Awaiting Approval
            </p>
          </div>
          <button
            onClick={onOpenQueue}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors block"
          >
            View Full Queue &rarr;
          </button>
        </div>

        {/* Published Shorts Card */}
        <div className="studio-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Published Shorts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-3xl font-black font-mono text-emerald-400">
              {data?.counts?.published ?? 0}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Live on YouTube Shorts
            </p>
          </div>
          <button
            onClick={onOpenQueue}
            className="text-[11px] text-slate-400 hover:text-slate-200 font-semibold transition-colors block"
          >
            Review Upload History &rarr;
          </button>
        </div>

        {/* Next Scheduled Upload Card */}
        <div className="studio-card p-5 space-y-3 border-indigo-500/30 bg-indigo-950/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-wider">Next In Queue</span>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>

          {data?.next_scheduled_item ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-100 truncate">
                {data.next_scheduled_item.title}
              </p>
              <p className="text-[11px] font-mono text-indigo-300">
                {formatDate(data.next_scheduled_item.scheduled_time)}
              </p>
              <button
                onClick={handlePublishNextNow}
                disabled={publishingNow || !data.is_online}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg text-xs font-bold shadow transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {publishingNow ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                <span>Publish Now</span>
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-400">Queue is currently empty.</p>
              <p className="text-[10px] text-slate-500 mt-1">Submit a video to generate clips.</p>
            </div>
          )}
        </div>
      </div>

      {/* Autonomous Publishing Mode Selection Panel */}
      <div className="studio-card p-6 shadow-studio space-y-4">
        <div className="border-b border-border-subtle pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Autonomous Publishing Policy
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Control whether generated Shorts are uploaded automatically or queued for your manual review
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 uppercase">
            Mode: {data?.publishing_mode || 'full_auto'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              id: 'full_auto',
              title: 'Mode A: Full Autonomous',
              badge: 'Recommended',
              desc: 'Clips are automatically generated, metadata is crafted, and Shorts are published sequentially on your schedule.',
            },
            {
              id: 'review_before_publish',
              title: 'Mode B: Review Before Publish',
              badge: 'Safe Review',
              desc: 'Clips are generated and placed into the queue with status "Awaiting Approval". You approve each Short before upload.',
            },
            {
              id: 'generate_only',
              title: 'Mode C: Generate Only',
              badge: 'Local Studio',
              desc: 'Generates 1080x1920 vertical MP4 clips, subtitles, and titles locally without scheduling or uploading to YouTube.',
            },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={modeSaving}
              onClick={() => handleModeChange(mode.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                data?.publishing_mode === mode.id
                  ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-600/10'
                  : 'bg-surface-primary border-border-subtle hover:border-border-strong opacity-75'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-xs font-bold ${data?.publishing_mode === mode.id ? 'text-indigo-300' : 'text-slate-200'}`}>
                  {mode.title}
                </p>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-tertiary text-slate-400">
                  {mode.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{mode.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Instagram Reels & Stories Automation (Roadmap & Waitlist) */}
      <InstagramAutomationCard />
    </div>
  );
};
