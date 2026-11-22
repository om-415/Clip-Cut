import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NewProjectView } from './components/NewProjectView';
import { ProcessingView } from './components/ProcessingView';
import { HighlightReviewView } from './components/HighlightReviewView';
import { ClipsGalleryView } from './components/ClipsGalleryView';
import { ProjectsListView } from './components/ProjectsListView';
import { SettingsView } from './components/SettingsView';
import { AutomationDashboardView } from './components/AutomationDashboardView';
import { UploadQueueView } from './components/UploadQueueView';
import { YouTubeSettingsView } from './components/YouTubeSettingsView';
import { AuthView } from './components/AuthView';
import { Project, User } from './types';
import { 
  getProject, 
  listProjects, 
  listAllClips, 
  fetchQueueItems, 
  getStoredUser, 
  setStoredUser, 
  logoutAccount,
  exchangeGoogleCode 
} from './api';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [authProcessing, setAuthProcessing] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('new');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectCount, setProjectCount] = useState<number>(0);
  const [clipsCount, setClipsCount] = useState<number>(0);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      if (typeof window === 'undefined') return;
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state') || '';

      if (!code) return;

      // Case 1: ClipCut Google User Login redirect
      if (state.startsWith('clipcut_auth_') || window.location.pathname.includes('/auth/google/callback')) {
        setAuthProcessing(true);
        setAuthError(null);
        try {
          const redirectUri = `${window.location.origin}/auth/google/callback`;
          const res = await exchangeGoogleCode(code, redirectUri, state);
          setCurrentUser(res.user);
          // Clean the browser address bar
          window.history.replaceState({}, document.title, '/');
          setCurrentTab('new');
        } catch (err: any) {
          console.error('Google OAuth exchange error:', err);
          setAuthError(err.message || 'Failed to complete Google sign-in. Please log in manually.');
        } finally {
          setAuthProcessing(false);
        }
        return;
      }

      // Case 2: YouTube channel OAuth redirect
      if (window.location.pathname.includes('oauth-callback') || state.includes('stream_clipper')) {
        setCurrentTab('youtube_settings');
      }
    };

    handleOAuthRedirect();
  }, []);

  const loadProjectData = async (id: string) => {
    try {
      const proj = await getProject(id);
      setActiveProject(proj);
      return proj;
    } catch (err) {
      console.error('Failed to load project details:', err);
      return null;
    }
  };

  const refreshCounts = async () => {
    try {
      const pList = await listProjects();
      setProjectCount(pList.length);
    } catch {
      // ignore
    }

    try {
      const cList = await listAllClips();
      setClipsCount(cList.length);
    } catch {
      // ignore
    }

    try {
      const qList = await fetchQueueItems();
      const pendingCount = qList.filter((item: any) => 
        item.status === 'scheduled' || item.status === 'ready' || item.status === 'awaiting_approval'
      ).length;
      setQueueCount(pendingCount);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshCounts();
  }, [currentTab]);

  const handleProjectCreated = (id: string) => {
    setActiveProjectId(id);
    setCurrentTab('processing');
  };

  const handleProcessingCompleted = async (id: string) => {
    setActiveProjectId(id);
    await loadProjectData(id);
    setCurrentTab('review');
    refreshCounts();
  };

  const handleSelectProjectFromList = async (id: string) => {
    setActiveProjectId(id);
    const proj = await loadProjectData(id);
    if (proj?.status === 'processing') {
      setCurrentTab('processing');
    } else {
      setCurrentTab('review');
    }
  };

  const handleLogout = () => {
    logoutAccount();
    setCurrentUser(null);
    setActiveProjectId(null);
    setActiveProject(null);
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    refreshCounts();
  };

  const handleExploreAsGuest = () => {
    const guestUser: User = {
      id: 'guest',
      email: 'guest@clipcut.ai',
      first_name: 'ClipCut',
      last_name: 'Creator',
      auth_provider: 'guest'
    };
    setStoredUser(guestUser);
    setCurrentUser(guestUser);
    refreshCounts();
  };

  // OAuth Processing Screen
  if (authProcessing) {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <span className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-white tracking-tight">Authenticating with Google...</h2>
            <p className="text-xs text-slate-400">Verifying session token and loading your ClipCut workspace</p>
          </div>
        </div>
      </div>
    );
  }

  // If user is not authenticated, render Login / Sign-up view
  if (!currentUser) {
    return (
      <AuthView
        onSuccess={handleAuthSuccess}
        onExploreAsGuest={handleExploreAsGuest}
        initialError={authError}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-slate-100 font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Redesigned Collapsible & Responsive Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeProjectCount={projectCount}
        totalClipsCount={clipsCount}
        queueCount={queueCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Studio Viewport */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Global Studio Header */}
        <Header
          currentTab={currentTab}
          onNewProject={() => setCurrentTab('new')}
          onToggleSidebar={() => setIsMobileNavOpen(!isMobileNavOpen)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeProjectTitle={activeProject?.title}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentTab === 'new' && (
            <NewProjectView onProjectCreated={handleProjectCreated} />
          )}

          {currentTab === 'processing' && activeProjectId && (
            <ProcessingView
              projectId={activeProjectId}
              onCompleted={handleProcessingCompleted}
            />
          )}

          {currentTab === 'review' && activeProject && (
            <HighlightReviewView
              project={activeProject}
              onRefreshProject={() => activeProjectId && loadProjectData(activeProjectId)}
              onBack={() => setCurrentTab('projects')}
            />
          )}

          {currentTab === 'clips' && (
            <ClipsGalleryView />
          )}

          {currentTab === 'projects' && (
            <ProjectsListView
              onSelectProject={handleSelectProjectFromList}
              onNewProject={() => setCurrentTab('new')}
            />
          )}

          {currentTab === 'automation' && (
            <AutomationDashboardView
              onOpenQueue={() => setCurrentTab('queue')}
              onOpenSettings={() => setCurrentTab('youtube_settings')}
              onNewStream={() => setCurrentTab('new')}
            />
          )}

          {currentTab === 'queue' && (
            <UploadQueueView />
          )}

          {currentTab === 'youtube_settings' && (
            <YouTubeSettingsView />
          )}

          {currentTab === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
