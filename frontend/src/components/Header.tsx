import React, { useState, useEffect } from 'react';
import { Search, PlusCircle, Menu, Wifi, WifiOff, Youtube, LogOut, MessageSquare, X, Send, Sparkles, ExternalLink } from 'lucide-react';
import { fetchConnectivity, fetchConnectedYouTubeAccount } from '../api';
import { User } from '../types';

interface HeaderProps {
  currentTab: string;
  onNewProject: () => void;
  onToggleSidebar?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  activeProjectTitle?: string | null;
  currentUser?: User | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNewProject,
  onToggleSidebar,
  searchQuery = '',
  onSearchChange,
  activeProjectTitle,
  currentUser,
  onLogout,
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [channelTitle, setChannelTitle] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    const checkState = async () => {
      try {
        const [conn, yt] = await Promise.all([
          fetchConnectivity(),
          fetchConnectedYouTubeAccount()
        ]);
        const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        setIsOnline(conn.is_online || browserOnline);
        if (yt && yt.connected && yt.account) {
          setChannelTitle(yt.account.channel_title);
        } else {
          setChannelTitle(null);
        }
      } catch {
        // Silent fallback
      }
    };

    checkState();
    const interval = setInterval(checkState, 15000);
    return () => clearInterval(interval);
  }, []);

  const getTabTitle = () => {
    switch (currentTab) {
      case 'new':
        return 'AI Studio';
      case 'processing':
        return 'Processing Stream';
      case 'review':
        return activeProjectTitle ? `Review: ${activeProjectTitle}` : 'Highlight Studio';
      case 'clips':
        return 'Clips Library';
      case 'projects':
        return 'Stream Projects';
      case 'automation':
        return 'Autonomous Content Pipeline';
      case 'queue':
        return 'Publishing Queue & Scheduler';
      case 'youtube_settings':
        return 'YouTube Channel & Publishing Settings';
      case 'settings':
        return 'Engine & Diagnostics';
      default:
        return 'ClipCut Studio';
    }
  };

  return (
    <header className="h-16 border-b border-border-subtle bg-surface-primary/80 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between gap-4 select-none">
      {/* Left: Mobile hamburger & breadcrumb title */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle Navigation"
            className="p-2 -ml-2 text-slate-400 hover:text-slate-200 hover:bg-surface-secondary rounded-lg transition-colors md:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse hidden sm:inline-block" />
          <h1 className="text-sm font-semibold text-slate-200 tracking-tight truncate max-w-xs md:max-w-md">
            {getTabTitle()}
          </h1>
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            BETA
          </span>
        </div>
      </div>

      {/* Center: Search input if applicable */}
      {onSearchChange && (currentTab === 'projects' || currentTab === 'clips' || currentTab === 'queue') && (
        <div className="relative max-w-xs w-full hidden sm:block">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects, clips, queue..."
            className="w-full bg-surface-secondary border border-border-subtle focus:border-indigo-500/60 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>
      )}

      {/* Right: Actions, network status & profile */}
      <div className="flex items-center gap-3">
        {/* Network Connectivity Pill */}
        <div 
          title={isOnline ? 'Internet connection active' : 'Network offline: Uploads paused safely'}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${
            isOnline 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}
        >
          {isOnline ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <Wifi className="w-3 h-3" />
              <span>Online</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <WifiOff className="w-3 h-3" />
              <span>Offline (Paused)</span>
            </>
          )}
        </div>

        {/* YouTube Channel Connected Pill */}
        {channelTitle && (
          <div 
            title={`Connected YouTube Channel: ${channelTitle}`}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[11px] text-red-400 font-medium truncate max-w-[150px]"
          >
            <Youtube className="w-3 h-3 text-red-500 shrink-0" />
            <span className="truncate">{channelTitle}</span>
          </div>
        )}

        {/* Quick New Project Button */}
        {currentTab !== 'new' && (
          <button
            onClick={onNewProject}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Stream</span>
          </button>
        )}

        {/* Beta Feedback Button */}
        <button
          type="button"
          onClick={() => setShowFeedbackModal(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle text-xs text-slate-300 hover:text-white transition-all shadow-sm"
        >
          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
          <span>Beta Feedback</span>
        </button>

        {/* User Account / Profile Pill */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-1 border-l border-border-subtle">
            <div 
              title={`Logged in as ${currentUser.first_name || ''} (${currentUser.email})`}
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-surface-secondary border border-border-subtle text-xs"
            >
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-[10px]">
                  {(currentUser.first_name?.[0] || currentUser.email[0]).toUpperCase()}
                </span>
              )}
              <span className="text-slate-200 font-medium max-w-[100px] truncate hidden md:inline">
                {currentUser.first_name || currentUser.email.split('@')[0]}
              </span>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Log out"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Studio badge */}
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600/30 to-violet-500/20 border border-indigo-500/30 text-indigo-300 font-mono text-xs font-bold flex items-center justify-center select-none shadow-sm">
          AI
        </div>
      </div>

      {/* Beta Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0D14] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => { setShowFeedbackModal(false); setFeedbackSent(false); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">ClipCut Public Beta Feedback</h3>
                <p className="text-xs text-slate-400">Help shape the future of AI Stream Clipping</p>
              </div>
            </div>

            {feedbackSent ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold">
                  ✓
                </div>
                <h4 className="text-sm font-bold text-white">Thank You for Your Feedback!</h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                  Your feedback has been logged. We're actively rolling out daily improvements for our Reddit beta community.
                </p>
                <button
                  type="button"
                  onClick={() => { setShowFeedbackModal(false); setFeedbackSent(false); setFeedbackText(''); }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Testing ClipCut from Reddit? Share your bug reports, feature ideas, or feedback below.
                </p>

                <textarea
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="What worked well? What could be improved? Any stream URL or video processing issues?"
                  className="w-full bg-[#050508] border border-white/10 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
                  <span className="text-slate-400">Join our community:</span>
                  <a
                    href="https://reddit.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold text-[11px]"
                  >
                    <span>r/ClipCut</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!feedbackText.trim()}
                    onClick={() => {
                      if (feedbackText.trim()) {
                        setFeedbackSent(true);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/25"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Feedback</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
