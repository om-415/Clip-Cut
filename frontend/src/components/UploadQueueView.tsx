import React, { useEffect, useState, useMemo } from 'react';
import { 
  Clock, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  Youtube, 
  Check, 
  X 
} from 'lucide-react';
import { QueueItem } from '../types';
import { 
  fetchQueueItems, 
  publishQueueItemNow, 
  approveQueueItem, 
  togglePauseQueueItem, 
  deleteQueueItem, 
  updateQueueItem 
} from '../api';

export const UploadQueueView: React.FC = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  
  // Metadata edit modal
  const [editingItem, setEditingItem] = useState<QueueItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editScheduledTime, setEditScheduledTime] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await fetchQueueItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSearch = !searchQuery.trim() || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [items, statusFilter, searchQuery]);

  const handlePublishNow = async (itemId: string) => {
    setActionInProgressId(itemId);
    try {
      await publishQueueItemNow(itemId);
      await loadQueue();
    } catch (err: any) {
      alert(err.message || 'Immediate publish failed');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleApprove = async (itemId: string) => {
    setActionInProgressId(itemId);
    try {
      await approveQueueItem(itemId);
      await loadQueue();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleTogglePause = async (itemId: string) => {
    setActionInProgressId(itemId);
    try {
      await togglePauseQueueItem(itemId);
      await loadQueue();
    } catch (err: any) {
      alert(err.message || 'Toggle pause failed');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Remove this clip from the upload queue?')) return;
    setActionInProgressId(itemId);
    try {
      await deleteQueueItem(itemId);
      await loadQueue();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setActionInProgressId(null);
    }
  };

  const getShortsUrl = (rawUrl?: string | null, videoId?: string | null) => {
    if (videoId) return `https://www.youtube.com/shorts/${videoId}`;
    if (!rawUrl) return '#';
    return rawUrl.replace('/watch?v=', '/shorts/');
  };

  const handleStartEdit = (item: QueueItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDesc(item.description);
    setEditTags(item.hashtags.join(', '));
    setEditScheduledTime(item.scheduled_time ? item.scheduled_time.slice(0, 16) : '');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      let finalTitle = editTitle.trim();
      if (!finalTitle.toLowerCase().includes('#shorts')) {
        finalTitle = `${finalTitle} #Shorts`;
      }
      const tagList = editTags.split(',').map(t => t.trim()).filter(Boolean);
      await updateQueueItem(editingItem.id, {
        title: finalTitle,
        description: editDesc,
        hashtags: tagList,
        scheduled_time: editScheduledTime ? new Date(editScheduledTime).toISOString() : undefined,
      });
      setEditingItem(null);
      await loadQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to save metadata');
    } finally {
      setSavingEdit(false);
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Unscheduled';
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Published</span>
          </span>
        );
      case 'uploading':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span>Uploading...</span>
          </span>
        );
      case 'scheduled':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-indigo-300 bg-indigo-600/15 border border-indigo-500/30 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled</span>
          </span>
        );
      case 'awaiting_approval':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Awaiting Approval</span>
          </span>
        );
      case 'paused':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-slate-400 bg-surface-tertiary border border-border-subtle flex items-center gap-1.5">
            <Pause className="w-3.5 h-3.5" />
            <span>Paused</span>
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-slate-400 bg-surface-tertiary border border-border-subtle">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
              Publishing Queue
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 mt-1">
            Sequential YouTube Upload Queue ({items.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Clips queued for scheduled publishing &bull; uploaded one at a time with automatic offline pause & recovery
          </p>
        </div>

        <button
          onClick={loadQueue}
          disabled={loading}
          className="p-2.5 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 rounded-xl border border-border-subtle transition-all self-start sm:self-auto"
          title="Refresh queue"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-primary border border-border-subtle p-3 rounded-2xl">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'scheduled', label: 'Scheduled' },
            { id: 'awaiting_approval', label: 'Awaiting Approval' },
            { id: 'published', label: 'Published' },
            { id: 'failed', label: 'Failed' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === st.id
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-secondary'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search queued Shorts..."
            className="w-full sm:w-56 bg-surface-secondary border border-border-subtle focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Queue Items List */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="studio-card p-16 text-center text-slate-400 space-y-2">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-200">No clips found in this queue state.</p>
            <p className="text-xs text-slate-500">
              When projects finish rendering, their generated clips are automatically placed into this queue.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isActing = actionInProgressId === item.id;
            const clip = item.clip;

            return (
              <div
                key={item.id}
                className="studio-card p-5 flex flex-col md:flex-row gap-5 items-start justify-between transition-all"
              >
                {/* Thumbnail & Timing */}
                <div className="flex items-start gap-4 w-full md:w-auto">
                  <div className="relative w-24 sm:w-28 aspect-[9/16] bg-black rounded-xl overflow-hidden shrink-0 border border-border-subtle shadow-inner">
                    {clip?.thumbnail_url ? (
                      <img src={clip.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-mono">
                        Short
                      </div>
                    )}
                    {clip && (
                      <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 text-[9px] font-mono font-bold text-white rounded">
                        {clip.duration}s
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(item.status)}
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-red-950/60 text-red-400 border border-red-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Shorts (9:16)
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {formatDate(item.scheduled_time)}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100 leading-snug">
                      {item.title}
                    </h4>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description || 'No description'}
                    </p>

                    {item.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.hashtags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-tertiary text-slate-300 border border-border-subtle"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.last_error && (
                      <p className="text-[11px] text-red-400 font-mono pt-1">
                        Notice: {item.last_error}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                  {item.status === 'awaiting_approval' && (
                    <button
                      onClick={() => handleApprove(item.id)}
                      disabled={isActing}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  )}

                  {item.status !== 'published' && (
                    <button
                      onClick={() => handlePublishNow(item.id)}
                      disabled={isActing}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/25 disabled:opacity-50"
                    >
                      {isActing ? (
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      <span>Publish Now</span>
                    </button>
                  )}

                  {item.published_url && (
                    <a
                      href={getShortsUrl(item.published_url, item.youtube_video_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Youtube className="w-3.5 h-3.5 text-red-500" />
                      <span>Watch Short</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {item.status !== 'published' && (
                    <button
                      onClick={() => handleTogglePause(item.id)}
                      disabled={isActing}
                      className="p-2 text-slate-400 hover:text-slate-200 hover:bg-surface-tertiary rounded-xl border border-border-subtle transition-colors"
                      title={item.status === 'paused' ? 'Resume item' : 'Pause item'}
                    >
                      {item.status === 'paused' ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  <button
                    onClick={() => handleStartEdit(item)}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-surface-tertiary rounded-xl border border-border-subtle transition-colors"
                    title="Edit Metadata"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={isActing}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    title="Delete from Queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Metadata Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-primary border border-border-strong rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border-subtle">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                Edit Shorts Metadata
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Short Title (max 75 chars)</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-surface-secondary border border-border-subtle rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Description</label>
                <textarea
                  rows={4}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-surface-secondary border border-border-subtle rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Hashtags (comma-separated)</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="#Shorts, #Gaming, #Clip"
                  className="w-full bg-surface-secondary border border-border-subtle rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Scheduled Date & Time (Local)</label>
                <input
                  type="datetime-local"
                  value={editScheduledTime}
                  onChange={(e) => setEditScheduledTime(e.target.value)}
                  className="w-full bg-surface-secondary border border-border-subtle rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                {savingEdit ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
