import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Play, 
  Clock, 
  Edit3, 
  Wand2, 
  Volume2, 
  MessageSquare, 
  Video, 
  Smile, 
  Gamepad2, 
  ArrowLeft, 
  ArrowUpDown, 
  CheckSquare, 
  Square, 
  Search
} from 'lucide-react';
import { Highlight, Project } from '../types';
import { adjustHighlight, generateClip } from '../api';
import { VideoEditorModal } from './VideoEditorModal';

interface HighlightReviewViewProps {
  project: Project;
  onRefreshProject: () => void;
  onBack: () => void;
}

export const HighlightReviewView: React.FC<HighlightReviewViewProps> = ({
  project,
  onRefreshProject,
  onBack,
}) => {
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'timestamp'>('score');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeEditorHighlight, setActiveEditorHighlight] = useState<Highlight | null>(null);
  const [bulkRendering, setBulkRendering] = useState<boolean>(false);
  const [renderingClipId, setRenderingClipId] = useState<string | null>(null);

  const highlights = project.highlights || [];
  const clips = project.clips || [];

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    highlights.forEach((h) => {
      if (h.category) set.add(h.category);
    });
    return ['all', ...Array.from(set)];
  }, [highlights]);

  // Filtered & Sorted Highlights
  const filteredHighlights = useMemo(() => {
    return highlights
      .filter((h) => {
        const matchesCategory = categoryFilter === 'all' || h.category.toLowerCase() === categoryFilter.toLowerCase();
        const matchesSearch = !searchQuery.trim() || 
          h.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.transcript.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.category.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'score') return b.score - a.score;
        return a.start_time - b.start_time;
      });
  }, [highlights, categoryFilter, sortBy, searchQuery]);

  const handleToggleSelect = (id: string) => {
    setSelectedHighlightIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedHighlightIds.length === filteredHighlights.length) {
      setSelectedHighlightIds([]);
    } else {
      setSelectedHighlightIds(filteredHighlights.map((h) => h.id));
    }
  };

  const handleBulkGenerate = async () => {
    if (selectedHighlightIds.length === 0) return;
    setBulkRendering(true);
    try {
      for (const id of selectedHighlightIds) {
        await generateClip(
          id, 
          project.settings?.layout_mode || 'split_stack', 
          project.settings?.subtitle_style || 'gaming_bold'
        );
      }
      onRefreshProject();
      setSelectedHighlightIds([]);
    } catch (err: any) {
      alert(err.message || 'Failed to complete bulk generation');
    } finally {
      setBulkRendering(false);
    }
  };

  const handleSingleGenerate = async (hl: Highlight) => {
    setRenderingClipId(hl.id);
    try {
      await generateClip(
        hl.id, 
        project.settings?.layout_mode || 'split_stack', 
        project.settings?.subtitle_style || 'gaming_bold'
      );
      onRefreshProject();
    } catch (err: any) {
      alert(err.message || 'Failed to render vertical clip');
    } finally {
      setRenderingClipId(null);
    }
  };

  const handleSaveAdjustments = async (hlId: string, start: number, end: number) => {
    await adjustHighlight(hlId, start, end);
    onRefreshProject();
  };

  const handleRenderFromEditor = async (hlId: string, layout: string, subStyle: string) => {
    await generateClip(hlId, layout, subStyle);
    onRefreshProject();
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const dec = Math.floor((sec - Math.floor(sec)) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${dec}`;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    if (score >= 70) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    return 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10';
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 space-y-8">
      {/* Top Header & Summary Stats */}
      <div className="space-y-4 border-b border-border-subtle pb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Streams</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                Analysis Complete
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 mt-1">
              Your highlights are ready.
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {project.title} &bull; <span className="text-slate-300 font-medium">{project.channel}</span>
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-3 bg-surface-secondary border border-border-subtle rounded-xl text-xs space-y-0.5">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Detected</span>
              <p className="font-bold text-slate-100 font-mono text-sm">{highlights.length} Moments</p>
            </div>
            <div className="p-3 bg-surface-secondary border border-border-subtle rounded-xl text-xs space-y-0.5">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Rendered Clips</span>
              <p className="font-bold text-indigo-400 font-mono text-sm">{clips.length} Vertical 9:16</p>
            </div>
            <div className="p-3 bg-surface-secondary border border-border-subtle rounded-xl text-xs space-y-0.5">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Stream Duration</span>
              <p className="font-bold text-slate-100 font-mono text-sm">{formatDuration(project.duration || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter, Search & Bulk Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-primary border border-border-subtle p-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Select all checkbox button */}
          <button
            onClick={handleSelectAll}
            className="px-3 py-1.5 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 text-xs font-semibold rounded-xl border border-border-subtle flex items-center gap-2 transition-colors"
          >
            {selectedHighlightIds.length === filteredHighlights.length && filteredHighlights.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-indigo-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-500" />
            )}
            <span>Select All ({selectedHighlightIds.length})</span>
          </button>

          {/* Category Dropdown/Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                  categoryFilter === c
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-secondary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort By Toggle */}
          <button
            onClick={() => setSortBy(sortBy === 'score' ? 'timestamp' : 'score')}
            className="px-3 py-1.5 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 text-xs font-semibold rounded-xl border border-border-subtle flex items-center gap-1.5 transition-colors shrink-0"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Sort: {sortBy === 'score' ? 'AI Score' : 'Timeline'}</span>
          </button>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter highlights..."
              className="w-36 sm:w-44 bg-surface-secondary border border-border-subtle focus:border-indigo-500 rounded-xl pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar when selections exist */}
      {selectedHighlightIds.length > 0 && (
        <div className="bg-indigo-950/70 border border-indigo-500/40 rounded-2xl p-4 flex items-center justify-between shadow-studio animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-bold text-indigo-200">
              {selectedHighlightIds.length} highlight{selectedHighlightIds.length > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedHighlightIds([])}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Deselect All
            </button>
            <button
              onClick={handleBulkGenerate}
              disabled={bulkRendering}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50"
            >
              {bulkRendering ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Rendering Selected...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Generate Selected ({selectedHighlightIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Highlights Grid */}
      <div className="space-y-4">
        {filteredHighlights.length === 0 ? (
          <div className="studio-card p-16 text-center text-slate-400 space-y-2">
            <p className="text-sm font-semibold text-slate-300">No highlights found matching your filter.</p>
            <p className="text-xs text-slate-500">Try adjusting your category filter or search keywords.</p>
          </div>
        ) : (
          filteredHighlights.map((hl, index) => {
            const isSelected = selectedHighlightIds.includes(hl.id);
            const associatedClip = clips.find((c) => c.highlight_id === hl.id);

            return (
              <div
                key={hl.id}
                className={`studio-card p-5 transition-all flex flex-col md:flex-row gap-6 items-start ${
                  isSelected ? 'border-indigo-500/60 bg-indigo-950/10' : ''
                }`}
              >
                {/* Checkbox & Thumbnail */}
                <div className="flex items-start gap-3 w-full md:w-auto">
                  <button
                    onClick={() => handleToggleSelect(hl.id)}
                    aria-label="Select highlight"
                    className="p-1 mt-1 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                    )}
                  </button>

                  <div className="relative w-full md:w-60 aspect-video bg-black rounded-xl overflow-hidden shrink-0 border border-border-subtle group shadow-inner">
                    {hl.thumbnail_url ? (
                      <img src={hl.thumbnail_url} alt={hl.category} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                        Frame Preview
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/85 text-[10px] font-mono font-bold text-white rounded flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span>{formatSeconds(hl.start_time)} - {formatSeconds(hl.end_time)}</span>
                    </div>

                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-indigo-600/90 text-[10px] font-mono font-bold text-white rounded">
                      {hl.duration}s
                    </div>
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500">#{index + 1}</span>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {hl.category}
                      </span>
                    </div>

                    {/* AI Score Badge */}
                    <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${getScoreColor(hl.score)}`}>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Score: {hl.score}</span>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-slate-200 leading-snug">
                    {hl.description}
                  </p>

                  {/* Transcript quote */}
                  {hl.transcript && (
                    <div className="p-2.5 bg-surface-primary rounded-xl border border-border-subtle text-xs text-slate-300 italic flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">"{hl.transcript}"</span>
                    </div>
                  )}

                  {/* Sub-Score Breakdown Pills */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 bg-surface-primary px-2 py-1 rounded-md border border-border-subtle">
                      <Volume2 className="w-3 h-3 text-amber-400" />
                      Audio: {Math.round(hl.audio_score)}%
                    </span>
                    <span className="flex items-center gap-1 bg-surface-primary px-2 py-1 rounded-md border border-border-subtle">
                      <MessageSquare className="w-3 h-3 text-cyan-400" />
                      Speech: {Math.round(hl.speech_score)}%
                    </span>
                    <span className="flex items-center gap-1 bg-surface-primary px-2 py-1 rounded-md border border-border-subtle">
                      <Video className="w-3 h-3 text-emerald-400" />
                      Motion: {Math.round(hl.visual_score)}%
                    </span>
                    <span className="flex items-center gap-1 bg-surface-primary px-2 py-1 rounded-md border border-border-subtle">
                      <Smile className="w-3 h-3 text-violet-400" />
                      Reaction: {Math.round(hl.face_score)}%
                    </span>
                    <span className="flex items-center gap-1 bg-surface-primary px-2 py-1 rounded-md border border-border-subtle">
                      <Gamepad2 className="w-3 h-3 text-pink-400" />
                      Action: {Math.round(hl.gameplay_score)}%
                    </span>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle">
                    <button
                      onClick={() => setActiveEditorHighlight(hl)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Open in Clip Editor Studio</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {associatedClip && (
                        <button
                          onClick={() => setActiveEditorHighlight(hl)}
                          className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Preview 9:16 Clip</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleSingleGenerate(hl)}
                        disabled={renderingClipId === hl.id}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                      >
                        {renderingClipId === hl.id ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Rendering...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>{associatedClip ? 'Re-render 9:16' : 'Generate 9:16 Clip'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dedicated Video Editor Modal Studio */}
      {activeEditorHighlight && (
        <VideoEditorModal
          highlight={activeEditorHighlight}
          clip={clips.find((c) => c.highlight_id === activeEditorHighlight.id)}
          project={project}
          onClose={() => setActiveEditorHighlight(null)}
          onSaveAdjustments={handleSaveAdjustments}
          onRenderClip={handleRenderFromEditor}
        />
      )}
    </div>
  );
};
