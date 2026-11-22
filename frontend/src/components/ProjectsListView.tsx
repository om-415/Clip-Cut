import React, { useEffect, useState, useMemo } from 'react';
import { 
  FolderGit2, 
  Trash2, 
  ArrowRight, 
  Video, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  PlusCircle, 
  Search, 
  Sparkles 
} from 'lucide-react';
import { Project } from '../types';
import { listProjects, deleteProject } from '../api';

interface ProjectsListViewProps {
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
}

export const ProjectsListView: React.FC<ProjectsListViewProps> = ({ onSelectProject, onNewProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project and all its clips?')) return;
    setDeletingId(id);
    try {
      await deleteProject(id);
      fetchProjects();
    } catch (err) {
      alert('Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.channel.toLowerCase().includes(q);
    });
  }, [projects, searchQuery]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
              Stream Archive
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 mt-1">
            My Stream Projects ({projects.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            History of processed gaming livestreams, detected highlight moments, and rendered vertical reels
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchProjects}
            disabled={loading}
            className="p-2.5 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 rounded-xl border border-border-subtle transition-all"
            title="Refresh stream list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onNewProject}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Stream Project</span>
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="studio-card p-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/15 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-100">No Stream Projects Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You haven't processed any streams yet. Start by pasting a YouTube video URL to automatically discover viral clips.
            </p>
          </div>
          <button
            onClick={onNewProject}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 transition-all inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Start First Project</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search Box */}
          <div className="flex items-center justify-between gap-4 bg-surface-primary border border-border-subtle p-3 rounded-2xl">
            <div className="relative max-w-sm w-full">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stream title or channel..."
                className="w-full bg-surface-secondary border border-border-subtle focus:border-indigo-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
              Showing {filteredProjects.length} of {projects.length}
            </span>
          </div>

          {/* Stream Cards Grid */}
          <div className="space-y-3">
            {filteredProjects.map((proj) => {
              const isCompleted = proj.status === 'completed';
              const isProcessing = proj.status === 'processing';
              const isFailed = proj.status === 'failed';

              return (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj.id)}
                  className="studio-card p-4 sm:p-5 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between cursor-pointer transition-all hover:border-border-strong group"
                >
                  <div className="flex items-start gap-4 flex-1 overflow-hidden">
                    {/* Thumbnail */}
                    <div className="relative w-28 sm:w-36 aspect-video bg-black rounded-xl overflow-hidden shrink-0 border border-border-subtle shadow-inner">
                      {proj.thumbnail_url ? (
                        <img src={proj.thumbnail_url} alt={proj.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-mono">
                          Stream
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-[9px] font-mono font-bold text-white rounded">
                        {formatDuration(proj.duration)}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="space-y-1.5 overflow-hidden flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400 truncate">{proj.channel}</span>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-[10px] font-mono text-slate-500">ID: {proj.id}</span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                        {proj.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono text-[11px]">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>{proj.highlight_count || 0} Highlights</span>
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Video className="w-3 h-3 text-indigo-400" />
                          <span>{proj.clip_count || 0} Clips</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Status & Actions */}
                  <div className="flex items-center gap-4 self-end md:self-center shrink-0">
                    {/* Status Pill */}
                    {isCompleted && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ready</span>
                      </span>
                    )}
                    {isProcessing && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-xl border border-indigo-500/20">
                        <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <span>{Math.round(proj.progress)}%</span>
                      </span>
                    )}
                    {isFailed && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-xl border border-red-500/20">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Failed</span>
                      </span>
                    )}

                    {/* Open Button */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(proj.id);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-surface-tertiary rounded-xl transition-colors"
                        title="Open Stream Studio"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDelete(e, proj.id)}
                        disabled={deletingId === proj.id}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
