import React from 'react';
import { 
  PlusCircle, 
  FolderGit2, 
  Video, 
  Cpu, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Zap,
  Clock,
  Youtube,
  LogOut
} from 'lucide-react';
import { User } from '../types';

interface NavItem {
  id: string;
  label: string;
  icon: any;
  highlight?: boolean;
  badge?: number;
}

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  activeProjectCount: number;
  totalClipsCount?: number;
  queueCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  activeProjectCount,
  totalClipsCount = 0,
  queueCount = 0,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  currentUser,
  onLogout,
}) => {
  const workspaceItems: NavItem[] = [
    { 
      id: 'new', 
      label: 'New Clip Project', 
      icon: PlusCircle, 
      highlight: true 
    },
    { 
      id: 'projects', 
      label: 'My Streams', 
      icon: FolderGit2, 
      badge: activeProjectCount > 0 ? activeProjectCount : undefined 
    },
    { 
      id: 'clips', 
      label: 'Generated Clips', 
      icon: Video,
      badge: totalClipsCount > 0 ? totalClipsCount : undefined
    },
  ];

  const automationItems: NavItem[] = [
    {
      id: 'automation',
      label: 'Automation Studio',
      icon: Zap,
    },
    {
      id: 'queue',
      label: 'Publishing Queue',
      icon: Clock,
      badge: queueCount > 0 ? queueCount : undefined,
    },
    {
      id: 'youtube_settings',
      label: 'YouTube & Publishing',
      icon: Youtube,
    },
  ];

  const systemItems: NavItem[] = [
    { 
      id: 'settings', 
      label: 'System & Engine', 
      icon: Cpu 
    },
  ];

  const handleNavClick = (id: string) => {
    setCurrentTab(id);
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  const renderNavGroup = (title: string, items: NavItem[]) => (
    <div className="mb-3">
      {!isCollapsed && (
        <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {title}
        </p>
      )}
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 relative group ${
                active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-secondary'
              } ${isCollapsed ? 'justify-center px-0' : 'justify-between'}`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 shrink-0 transition-transform duration-150 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {!isCollapsed && <span>{item.label}</span>}
              </div>

              {!isCollapsed && item.badge !== undefined && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  active ? 'bg-indigo-800 text-indigo-100' : 'bg-surface-tertiary text-slate-400'
                }`}>
                  {item.badge}
                </span>
              )}

              {/* Active indicator bar */}
              {active && (
                <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-indigo-400" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );

  const sidebarContent = (
    <aside
      className={`bg-surface-primary border-r border-border-subtle flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none transition-all duration-300 ease-in-out z-40 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="overflow-y-auto">
        {/* Brand Header */}
        <div className={`p-5 border-b border-border-subtle flex items-center justify-between ${isCollapsed ? 'justify-center px-3' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-red-600/20 shrink-0 overflow-hidden border border-red-500/30">
              <img src="/clipcut-hero.jpg" alt="ClipCut" className="w-full h-full object-cover" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white bg-gradient-to-r from-white via-slate-100 to-red-300 bg-clip-text text-transparent">ClipCut</span>
                  <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                    AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">Autonomous Video Engine</p>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-surface-secondary rounded-lg md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="p-3">
          {renderNavGroup('Workspace', workspaceItems)}
          {renderNavGroup('Autonomous Pipeline', automationItems)}
          {renderNavGroup('Settings', systemItems)}
        </div>
      </div>

      {/* Footer Area: Collapse Button & Engine Status */}
      <div className="p-3 space-y-2 border-t border-border-subtle shrink-0">
        {/* Collapse toggle (Desktop only) */}
        <div className="hidden md:flex justify-end">
          <button
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="w-full py-1.5 flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 hover:bg-surface-secondary rounded-lg text-xs transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[11px] font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>

        {/* Engine Diagnostics Card */}
        {!isCollapsed ? (
          <div className="p-3 bg-surface-secondary border border-border-subtle rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Engine Active</span>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">12th Gen Intel (10 Cores)</p>
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-border-subtle">
              <span>Whisper &bull; FFmpeg</span>
              <span className="font-mono text-emerald-400">Ready</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center p-2" title="Engine Active: 12th Gen Intel CPU">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          </div>
        )}

        {/* User Account / Logout Card */}
        {currentUser && !isCollapsed && (
          <div className="p-2.5 bg-surface-secondary/70 border border-border-subtle rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
                  {(currentUser.first_name?.[0] || currentUser.email[0]).toUpperCase()}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-200 truncate leading-tight">
                  {currentUser.first_name || currentUser.email.split('@')[0]}
                </p>
                <p className="text-[10px] text-slate-400 truncate leading-tight">
                  {currentUser.email}
                </p>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Log out"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Version info */}
        {!isCollapsed && (
          <div className="flex items-center justify-between px-2 pt-1 text-[10px] text-slate-600 font-mono">
            <span>v2.0 Autonomous</span>
            <span>Local Engine</span>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            onClick={onCloseMobile} 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
          />
          <div className="relative z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
