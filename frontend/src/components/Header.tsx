import React, { useState, useEffect } from 'react';
import { Search, PlusCircle, Menu, Wifi, WifiOff, Youtube, LogOut } from 'lucide-react';
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
        return 'AI Stream Clipper';
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
    </header>
  );
};
