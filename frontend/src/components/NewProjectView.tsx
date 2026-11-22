import React, { useState } from 'react';
import { 
  Youtube, 
  Search, 
  Sparkles, 
  Clock, 
  Eye, 
  Wand2, 
  Layers, 
  Type, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Wifi, 
  Clipboard, 
  X, 
  Check, 
  Film,
  Zap
} from 'lucide-react';
import { VideoMetadata, ProjectSettings } from '../types';
import { fetchVideoMetadata, createProject } from '../api';

interface NewProjectViewProps {
  onProjectCreated: (projectId: string) => void;
}

export const NewProjectView: React.FC<NewProjectViewProps> = ({ onProjectCreated }) => {
  const [url, setUrl] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  // Settings
  const [settings, setSettings] = useState<ProjectSettings>({
    num_clips: 3,
    clip_duration: 35,
    subtitle_style: 'gaming_bold',
    layout_mode: 'split_stack',
    auto_generate_clips: true,
    data_saver_mode: true,
    highlight_types: ['Epic Gameplay', 'Funny Moments', 'Reactions'],
  });

  const availableHighlightTypes = [
    'All Highlights',
    'Epic Gameplay',
    'Funny Moments',
    'Reactions',
    'Clutch Moments',
    'Rage Moments',
    'Interesting Conversations',
  ];

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrl(text.trim());
        setError(null);
      }
    } catch {
      // Clipboard read permission might be blocked
    }
  };

  const handleClearUrl = () => {
    setUrl('');
    setMetadata(null);
    setError(null);
  };

  const handleFetchMetadata = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube video or stream URL.');
      return;
    }
    setError(null);
    setLoadingMeta(true);
    try {
      const meta = await fetchVideoMetadata(url.trim());
      setMetadata(meta);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve video metadata. Verify the URL is public or accessible.');
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleToggleHighlightType = (type: string) => {
    const current = settings.highlight_types || [];
    if (type === 'All Highlights') {
      if (current.includes('All Highlights')) {
        setSettings({ ...settings, highlight_types: ['Epic Gameplay', 'Funny Moments'] });
      } else {
        setSettings({ ...settings, highlight_types: ['All Highlights', ...availableHighlightTypes.filter(t => t !== 'All Highlights')] });
      }
      return;
    }

    if (current.includes(type)) {
      const updated = current.filter(t => t !== type && t !== 'All Highlights');
      setSettings({ ...settings, highlight_types: updated.length ? updated : ['All Highlights'] });
    } else {
      setSettings({ ...settings, highlight_types: [...current.filter(t => t !== 'All Highlights'), type] });
    }
  };

  const handleStartAnalysis = async () => {
    if (!url.trim()) return;
    setError(null);
    setCreatingProject(true);
    try {
      const proj = await createProject({
        url: url.trim(),
        num_clips: settings.num_clips,
        clip_duration: settings.clip_duration,
        subtitle_style: settings.subtitle_style,
        layout_mode: settings.layout_mode,
        auto_generate_clips: settings.auto_generate_clips,
        data_saver_mode: settings.data_saver_mode,
        title: metadata?.title,
        channel: metadata?.channel,
        duration: metadata?.duration,
        thumbnail: metadata?.thumbnail,
      });
      onProjectCreated(proj.id);
    } catch (err: any) {
      setError(err.message || 'Failed to launch stream clipping pipeline.');
      setCreatingProject(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-6 space-y-10">
      {/* Hero Section */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-secondary border border-border-subtle rounded-full text-xs text-slate-300 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Autonomous AI Video Studio</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-100">
          Turn long streams into <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">viral moments.</span>
        </h2>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
          AI finds the moments worth sharing and transforms them into vertical clips with streamer facecam tracking and synchronized subtitles.
        </p>
      </div>

      {/* URL Input Bar Card */}
      <div className="studio-card p-4 space-y-3 shadow-studio">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2 flex-1 bg-surface-primary border border-border-subtle focus-within:border-indigo-500/80 rounded-xl px-3.5 py-2.5 transition-all">
            <Youtube className="w-5 h-5 text-red-500 shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetchMetadata()}
              placeholder="Paste a YouTube video or livestream URL (e.g. https://www.youtube.com/watch?v=...)"
              className="w-full bg-transparent border-none text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none"
            />
            {url && (
              <button
                onClick={handleClearUrl}
                aria-label="Clear URL"
                className="p-1 text-slate-500 hover:text-slate-300 rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handlePasteClipboard}
              type="button"
              title="Paste from clipboard"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-surface-secondary rounded-lg text-xs transition-colors hidden sm:flex items-center gap-1 shrink-0"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">Paste</span>
            </button>
          </div>

          <button
            onClick={handleFetchMetadata}
            disabled={loadingMeta || !url.trim()}
            className="px-6 py-3 bg-surface-secondary hover:bg-surface-tertiary active:scale-95 text-slate-200 text-xs font-semibold rounded-xl border border-border-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            {loadingMeta ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span>Inspecting Stream...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Inspect Video</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span>Supports YouTube videos, premieres, VODs, and accessible livestreams.</span>
          <span className="text-slate-600 hidden sm:inline">Permission required to process video.</span>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-200">Unable to inspect video stream</p>
            <p className="text-red-300/90">{error}</p>
          </div>
        </div>
      )}

      {/* Video Import Card */}
      {metadata && (
        <div className="studio-card p-6 shadow-studio animate-in fade-in duration-200 flex flex-col md:flex-row gap-6 items-start">
          <div className="relative w-full md:w-64 aspect-video bg-black rounded-xl overflow-hidden shrink-0 border border-border-subtle shadow-inner">
            {metadata.thumbnail ? (
              <img src={metadata.thumbnail} alt={metadata.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">No Preview</div>
            )}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/85 text-[10px] font-mono font-bold text-white rounded">
              {formatDuration(metadata.duration)}
            </div>
            {metadata.is_live && (
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 text-[10px] font-bold text-white rounded uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Live Stream
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Verified Stream
              </span>
              <span className="text-xs text-slate-400">&bull;</span>
              <span className="text-xs text-slate-400">{metadata.channel}</span>
            </div>

            <h3 className="font-bold text-base text-slate-100 leading-snug line-clamp-2">
              {metadata.title}
            </h3>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{formatDuration(metadata.duration)}</span>
              </div>
              {metadata.view_count > 0 && (
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>{metadata.view_count.toLocaleString()} views</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Multi-signal neural pipeline ready (Whisper transcription, loudness spike detection, FaceCam tracking)</span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Data Saver Mode Banner */}
      <div className={`studio-card p-5 transition-all ${settings.data_saver_mode ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/20 via-surface-secondary to-surface-primary' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${settings.data_saver_mode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-surface-tertiary text-slate-400'}`}>
              <Wifi className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-sm font-bold text-slate-100">Mobile Data Saver Mode</span>
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full ${settings.data_saver_mode ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-surface-tertiary text-slate-500'}`}>
                  {settings.data_saver_mode ? '97% Data Saved (~140MB vs 5GB)' : 'Off (Full Stream Download)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                Downloads lightweight stream audio first to pinpoint peak hype moments with Whisper, then fetches <strong className="text-slate-200">only the exact 35s 1080p video clips</strong> via HTTP range slicing. Saves over 5 GB of mobile data on long livestreams.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.data_saver_mode}
            onClick={() => setSettings({ ...settings, data_saver_mode: !settings.data_saver_mode })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-end sm:self-center ${settings.data_saver_mode ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.data_saver_mode ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>

      {/* Analysis & Output Configuration Panel */}
      <div className="studio-card p-6 space-y-8 shadow-studio">
        <div className="border-b border-border-subtle pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-indigo-400" />
              AI Clipping & Studio Configuration
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Customize clip target length, vertical layout, subtitle styles, and highlight filters</p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider hidden sm:inline">
            Config 1.2
          </span>
        </div>

        {/* Number of Clips & Duration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Target Clip Duration */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-200">Target Clip Duration</span>
              <span className="font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20">
                {settings.clip_duration}s
              </span>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '15–30s', desc: 'Punchy Shorts', val: 25 },
                { label: '30–45s', desc: 'Standard Story', val: 35 },
                { label: '45–60s', desc: 'Deep Dive', val: 50 },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setSettings({ ...settings, clip_duration: p.val })}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    settings.clip_duration === p.val
                      ? 'bg-indigo-600/20 border-indigo-500/80 text-indigo-300'
                      : 'bg-surface-primary border-border-subtle text-slate-400 hover:border-border-strong'
                  }`}
                >
                  <p className="text-xs font-bold">{p.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>

            {/* Fine Slider */}
            <input
              type="range"
              min="15"
              max="60"
              step="5"
              value={settings.clip_duration}
              onChange={(e) => setSettings({ ...settings, clip_duration: Number(e.target.value) })}
              className="w-full accent-indigo-500 bg-surface-tertiary rounded-lg cursor-pointer h-1.5"
            />
          </div>

          {/* Number of Clips */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-200">Clips to Extract</span>
              <span className="font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20">
                {settings.num_clips} Highlights
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[3, 5, 10, 15].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSettings({ ...settings, num_clips: n })}
                  className={`py-3 text-xs font-semibold rounded-xl border transition-all ${
                    settings.num_clips === n
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25 font-bold'
                      : 'bg-surface-primary border-border-subtle text-slate-400 hover:bg-surface-secondary'
                  }`}
                >
                  {n} Clips
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              The AI ranks candidates and eliminates overlapping duplicates with Non-Maximum Suppression.
            </p>
          </div>
        </div>

        {/* Highlight Types Multi-Selector */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Target Highlight Categories
            </span>
            <span className="text-[11px] text-slate-500">Multi-Signal Filtering</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {availableHighlightTypes.map((t) => {
              const isSelected = settings.highlight_types?.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleToggleHighlightType(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600/25 border-indigo-500 text-indigo-300'
                      : 'bg-surface-primary border-border-subtle text-slate-400 hover:bg-surface-secondary'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-indigo-400" />}
                  <span>{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 9:16 Vertical Layout Selector */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            9:16 Vertical Composition Layout
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: 'split_stack',
                title: 'Facecam Top + Gameplay Bottom',
                badge: 'Recommended',
                desc: 'Streamer FaceCam isolated at top (1080x720) + centered gameplay on bottom (1080x1200).',
              },
              {
                id: 'overlay_pip',
                title: 'Floating Facecam Overlay',
                badge: 'PiP',
                desc: 'Full-bleed gameplay in center with streamer FaceCam framed in crisp picture-in-picture box.',
              },
              {
                id: 'blurred_fill',
                title: 'Auto Layout (Blurred Canvas)',
                badge: 'Universal',
                desc: 'Original 16:9 gameplay framed over dynamic real-time blurred 9:16 background.',
              },
            ].map((layout) => (
              <button
                key={layout.id}
                type="button"
                onClick={() => setSettings({ ...settings, layout_mode: layout.id })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  settings.layout_mode === layout.id
                    ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-600/10'
                    : 'bg-surface-primary border-border-subtle hover:border-border-strong'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-bold ${settings.layout_mode === layout.id ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {layout.title}
                  </p>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-tertiary text-slate-400">
                    {layout.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{layout.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Subtitle Style Selector */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <Type className="w-3.5 h-3.5 text-amber-400" />
            Synchronized Subtitle Style
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'gaming_bold', name: 'Gaming Bold', preview: 'YELLOW BOLD', textCol: 'text-yellow-400 font-extrabold' },
              { id: 'animated_highlight', name: 'Animated Karaoke', preview: 'HYPE WORD', textCol: 'text-cyan-400 font-bold' },
              { id: 'minimal_white', name: 'Clean Minimal', preview: 'Clean White', textCol: 'text-white font-medium' },
              { id: 'professional_captions', name: 'Pro Box', preview: 'Captions', textCol: 'text-slate-100 font-semibold' },
            ].map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSettings({ ...settings, subtitle_style: sub.id })}
                className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  settings.subtitle_style === sub.id
                    ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-600/10'
                    : 'bg-surface-primary border-border-subtle hover:border-border-strong'
                }`}
              >
                <div className="w-full py-2 px-3 rounded-lg bg-black/60 border border-border-subtle flex items-center justify-center">
                  <span className={`text-xs tracking-wider ${sub.textCol}`}>{sub.preview}</span>
                </div>
                <span className="text-[11px] font-medium text-slate-300">{sub.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Output Standards Strip */}
        <div className="p-3 bg-surface-primary border border-border-subtle rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            <span>Output Standard:</span>
            <span className="font-bold text-slate-200">1080 &times; 1920 (9:16)</span>
            <span>&bull;</span>
            <span className="font-bold text-slate-200">H.264 / AAC MP4</span>
            <span>&bull;</span>
            <span className="font-bold text-slate-200">TikTok &bull; Reels &bull; Shorts</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
            <Zap className="w-3 h-3" />
            <span>Hardware Accelerated FFmpeg</span>
          </div>
        </div>
      </div>

      {/* Launch CTA Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <p className="text-xs text-slate-500">
          Analysis operates fully locally on your machine with offline AI weights.
        </p>

        <button
          onClick={handleStartAnalysis}
          disabled={creatingProject || !url.trim()}
          className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creatingProject ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Launching AI Pipeline...</span>
            </>
          ) : (
            <>
              <span>Start AI Highlight Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
