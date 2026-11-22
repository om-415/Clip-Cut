import React, { useEffect, useState, useMemo } from 'react';
import { 
  Video, 
  Download, 
  Play, 
  RefreshCw, 
  Search, 
  Copy, 
  Check,
  Scissors
} from 'lucide-react';
import { Clip } from '../types';
import { listAllClips, getClipDownloadUrl } from '../api';
import { VideoEditorModal } from './VideoEditorModal';

export const ClipsGalleryView: React.FC = () => {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const [editingClip, setEditingClip] = useState<Clip | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutFilter, setLayoutFilter] = useState('all');
  const [copiedClipId, setCopiedClipId] = useState<string | null>(null);

  const fetchClips = async () => {
    setLoading(true);
    try {
      const data = await listAllClips();
      setClips(data);
      if (data.length > 0 && !activeClip) {
        setActiveClip(data[0]);
      }
    } catch (err) {
      console.error('Failed to load clips:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClips();
  }, []);

  const filteredClips = useMemo(() => {
    return clips.filter((c) => {
      const matchesSearch = !searchQuery.trim() || 
        c.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.layout_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.subtitle_style.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLayout = layoutFilter === 'all' || c.layout_type.toLowerCase() === layoutFilter.toLowerCase();
      return matchesSearch && matchesLayout;
    });
  }, [clips, searchQuery, layoutFilter]);

  const handleCopyLink = (clip: Clip) => {
    const fullUrl = `${window.location.origin}${clip.clip_url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedClipId(clip.id);
    setTimeout(() => setCopiedClipId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-6 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
              Exported Shorts Library
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 mt-1">
            Generated Vertical Clips ({clips.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            1080 &times; 1920 MP4 clips ready for YouTube Shorts, Instagram Reels, and TikTok
          </p>
        </div>

        <button
          onClick={fetchClips}
          disabled={loading}
          className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary active:scale-95 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 border border-border-subtle transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Library</span>
        </button>
      </div>

      {clips.length === 0 ? (
        <div className="studio-card p-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/15 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
            <Video className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-100">No Exported Clips Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Inspect and analyze a stream in the New Project tab to automatically detect viral moments and render vertical clips.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-primary border border-border-subtle p-3 rounded-2xl">
            {/* Layout Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {[
                { id: 'all', label: 'All Layouts' },
                { id: 'split_stack', label: 'Split Stack' },
                { id: 'overlay_pip', label: 'Floating PiP' },
                { id: 'blurred_fill', label: 'Blurred Canvas' },
              ].map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLayoutFilter(l.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    layoutFilter === l.id
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-surface-secondary'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clips..."
                className="w-full sm:w-56 bg-surface-secondary border border-border-subtle focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Main 2-Column Content: Left Active Player / Right Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Active Preview Player Card (Sticky) */}
            <div className="lg:col-span-5 studio-card p-6 shadow-studio space-y-4 sticky top-24">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  Active 9:16 Preview
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-md">
                  1080 &times; 1920
                </span>
              </div>

              {activeClip ? (
                <div className="space-y-4">
                  <div className="relative w-full aspect-[9/16] bg-black rounded-2xl overflow-hidden border border-border-strong shadow-2xl">
                    <video
                      key={activeClip.clip_url}
                      src={activeClip.clip_url}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-100 truncate">{activeClip.file_name}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <span className="bg-surface-primary px-2 py-0.5 rounded border border-border-subtle">
                        {activeClip.duration}s
                      </span>
                      <span className="bg-surface-primary px-2 py-0.5 rounded border border-border-subtle">
                        {(activeClip.file_size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                      <span className="bg-indigo-950/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800/60 font-semibold font-sans capitalize">
                        {activeClip.layout_type.replace('_', ' ')}
                      </span>
                      <span className="bg-surface-primary px-2 py-0.5 rounded border border-border-subtle font-sans capitalize">
                        Sub: {activeClip.subtitle_style.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="pt-2 space-y-2">
                      {/* DUAL ACTION WORKFLOW: OPTION A vs OPTION B */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* OPTION A: EDIT CLIP */}
                        <button
                          onClick={() => setEditingClip(activeClip)}
                          className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          <span>Option A: Edit Clip</span>
                        </button>

                        {/* OPTION B: DOWNLOAD DIRECTLY */}
                        <a
                          href={getClipDownloadUrl(activeClip.id, activeClip.is_edited ? 'edited' : 'original')}
                          download={activeClip.file_name}
                          className="py-2.5 px-3 bg-surface-secondary hover:bg-surface-tertiary active:scale-95 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-border-subtle transition-all"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-400" />
                          <span>Option B: Download</span>
                        </a>
                      </div>

                      {/* Direct original backup download & copy link */}
                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={getClipDownloadUrl(activeClip.id, 'original')}
                          download={`original_${activeClip.file_name}`}
                          className="flex-1 py-1.5 px-3 bg-surface-primary hover:bg-surface-secondary text-slate-400 hover:text-slate-200 rounded-lg text-[11px] font-mono flex items-center justify-center gap-1.5 border border-border-subtle transition-colors"
                          title="Download original unedited version"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download Original (Pristine)</span>
                        </a>
                        <button
                          onClick={() => handleCopyLink(activeClip)}
                          title="Copy direct video URL"
                          className="p-1.5 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 rounded-lg border border-border-subtle transition-colors"
                        >
                          {copiedClipId === activeClip.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500 text-xs">
                  Select a clip on the right to preview.
                </div>
              )}
            </div>

            {/* Grid of Vertical Clip Cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredClips.map((clip) => {
                const isActive = activeClip?.id === clip.id;

                return (
                  <div
                    key={clip.id}
                    onClick={() => setActiveClip(clip)}
                    className={`studio-card p-3.5 cursor-pointer transition-all space-y-3 group ${
                      isActive ? 'border-indigo-500/80 bg-indigo-950/15 shadow-accent-glow' : ''
                    }`}
                  >
                    {/* Thumbnail preview */}
                    <div className="relative w-full aspect-[9/16] bg-black rounded-xl overflow-hidden border border-border-subtle shadow-inner">
                      {clip.thumbnail_url ? (
                        <img src={clip.thumbnail_url} alt={clip.file_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-mono">
                          9:16 Video
                        </div>
                      )}

                      {/* Play overlay button */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <Play className="w-4 h-4 ml-0.5" />
                        </div>
                      </div>

                      {/* Duration & Size Badges */}
                      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/80 text-[10px] font-mono font-bold text-white rounded">
                        {clip.duration}s
                      </div>
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] font-mono text-slate-300 rounded">
                        {(clip.file_size / (1024 * 1024)).toFixed(1)} MB
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-200 truncate">{clip.file_name}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 capitalize">
                        <span>{clip.layout_type.replace('_', ' ')}</span>
                        <span>{clip.subtitle_style.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Interactive Clip Studio Editor Modal */}
      {editingClip && (
        <VideoEditorModal
          clip={editingClip}
          onClose={() => setEditingClip(null)}
          onClipUpdated={(updated) => {
            setClips((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            if (activeClip?.id === updated.id) {
              setActiveClip(updated);
            }
          }}
        />
      )}
    </div>
  );
};
