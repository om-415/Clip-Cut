import React, { useEffect, useState, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Terminal, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Copy, 
  Check 
} from 'lucide-react';
import { getProject } from '../api';
import { Project } from '../types';

interface ProcessingViewProps {
  projectId: string;
  onCompleted: (projectId: string) => void;
}

interface LogEntry {
  time: string;
  step: string;
  message: string;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({ projectId, onCompleted }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Initializing');
  const [status, setStatus] = useState<'queued' | 'processing' | 'completed' | 'failed'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const stages = [
    { id: 1, name: 'Video Import', desc: 'Connecting & audio-first range prep', keywords: ['download', 'stream', 'saver', 'import', 'retrieval'] },
    { id: 2, name: 'Audio Analysis', desc: 'Volume surges, loudness peaks & screams', keywords: ['audio', 'extraction', 'energy'] },
    { id: 3, name: 'Speech Recognition', desc: 'OpenAI Whisper commentary transcription', keywords: ['speech', 'whisper', 'transcribing', 'dialogue'] },
    { id: 4, name: 'Visual Analysis', desc: 'Streamer FaceCam localization & action', keywords: ['visual', 'facecam', 'motion', 'fusion', 'signal'] },
    { id: 5, name: 'Highlight Detection', desc: 'Multi-signal scoring & Non-Max Suppression', keywords: ['highlight', 'ranking', 'detection', 'scoring'] },
    { id: 6, name: 'Clip Generation', desc: 'Range section download & 9:16 layout', keywords: ['clip generation', 'rendering', 'slice', 'composing'] },
    { id: 7, name: 'Subtitle Rendering', desc: 'Synchronized ASS karaoke burning', keywords: ['subtitle', 'ass', 'captions'] },
    { id: 8, name: 'Export', desc: 'Finalizing 1080x1920 MP4 packages', keywords: ['completed', 'export', 'final'] },
  ];

  const getStageStatus = (stageIndex: number) => {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';

    const cur = currentStep.toLowerCase();
    const stage = stages[stageIndex];
    const isCurrent = stage.keywords.some(k => cur.includes(k));

    // Calculate approximate active stage from progress percentage
    const targetStageIndex = Math.min(stages.length - 1, Math.floor((progress / 100) * stages.length));

    if (isCurrent || targetStageIndex === stageIndex) return 'processing';
    if (stageIndex < targetStageIndex) return 'completed';
    return 'pending';
  };

  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollInterval: any = null;

    const addLog = (step: string, message: string) => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      setLogs((prev) => [
        ...prev.slice(-40),
        { time: timeStr, step, message: message || `Processing stage: ${step}` },
      ]);
    };

    // Load initial project metadata
    getProject(projectId).then(setProject).catch(() => {});

    // 1. Try WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${projectId}`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.progress !== undefined) setProgress(data.progress);
          if (data.step) {
            setCurrentStep(data.step);
            addLog(data.step, data.message || '');
          }
          if (data.status) {
            setStatus(data.status);
            if (data.status === 'completed') {
              setTimeout(() => onCompleted(projectId), 1200);
            }
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onerror = () => {
        startPolling();
      };
    } catch {
      startPolling();
    }

    // Fallback polling
    function startPolling() {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        try {
          const proj = await getProject(projectId);
          setProject(proj);
          setProgress(proj.progress);
          setCurrentStep(proj.current_step);
          setStatus(proj.status);
          if (proj.status === 'failed') {
            setErrorMessage(proj.error_message || 'Pipeline failed');
            clearInterval(pollInterval);
          } else if (proj.status === 'completed') {
            clearInterval(pollInterval);
            setTimeout(() => onCompleted(projectId), 1200);
          }
        } catch {
          // ignore
        }
      }, 1500);
    }

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [projectId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.time}] [${l.step}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-6 space-y-8">
      {/* Top Banner & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
              Active AI Processing Workspace
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">
            {project?.title || 'Analyzing Video Stream'}
          </h2>
          {project?.channel && (
            <p className="text-xs text-slate-400">
              Channel: <span className="text-slate-200 font-medium">{project.channel}</span> &bull; Duration: {formatDuration(project.duration || 0)}
            </p>
          )}
        </div>

        {/* Progress Pill */}
        <div className="flex items-center gap-4 bg-surface-secondary border border-border-subtle rounded-2xl px-5 py-3 shrink-0">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Overall Progress</p>
            <p className="text-2xl font-black font-mono text-slate-100">{Math.round(progress)}%</p>
          </div>
          <div className="w-12 h-12 relative flex items-center justify-center">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-surface-tertiary"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-indigo-500 transition-all duration-300"
                strokeDasharray={`${Math.round(progress)}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <Sparkles className="w-4 h-4 text-indigo-400 absolute" />
          </div>
        </div>
      </div>

      {/* Error state if failed */}
      {status === 'failed' && (
        <div className="p-5 bg-red-950/40 border border-red-500/40 rounded-2xl text-red-300 text-sm flex items-start gap-3 shadow-studio">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-slate-100">Processing Interrupted</p>
            <p className="text-xs text-red-300/90">{errorMessage || 'An error occurred during pipeline execution.'}</p>
          </div>
        </div>
      )}

      {/* Progress Bar Strip */}
      <div className="studio-card p-6 space-y-4 shadow-studio">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="font-semibold text-slate-200">Current Phase:</span>
            <span className="font-mono text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              {currentStep}
            </span>
          </div>
          <span className="font-mono text-slate-400 text-xs">
            {progress < 100 ? 'Running neural models on 12th Gen CPU' : 'Complete'}
          </span>
        </div>

        <div className="w-full h-2.5 bg-surface-primary rounded-full overflow-hidden border border-border-subtle">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-violet-500 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 8-Stage Progress Timeline */}
      <div className="studio-card p-6 shadow-studio space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          Multi-Signal Analysis Pipeline
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {stages.map((st, idx) => {
            const stStatus = getStageStatus(idx);
            const isProcessing = stStatus === 'processing';
            const isDone = stStatus === 'completed';
            const isPending = stStatus === 'pending';

            return (
              <div
                key={st.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isProcessing
                    ? 'bg-indigo-600/15 border-indigo-500/80 shadow-md shadow-indigo-600/10'
                    : isDone
                    ? 'bg-surface-primary border-emerald-500/30'
                    : 'bg-surface-primary/60 border-border-subtle opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-500">0{st.id}</span>
                  {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {isProcessing && (
                    <span className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  {isPending && <span className="w-2 h-2 rounded-full bg-slate-700" />}
                </div>

                <p className={`text-xs font-bold ${isProcessing ? 'text-indigo-300' : isDone ? 'text-slate-200' : 'text-slate-400'}`}>
                  {st.name}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                  {st.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable Real-Time Execution Terminal / Logs */}
      <div className="studio-card shadow-studio overflow-hidden">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full px-6 py-4 flex items-center justify-between border-b border-border-subtle text-xs font-semibold text-slate-300 hover:bg-surface-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>Execution Telemetry & Neural Logs</span>
            <span className="text-[10px] font-mono text-slate-500 bg-surface-tertiary px-2 py-0.5 rounded">
              {logs.length} events
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500">{showLogs ? 'Hide Logs' : 'Show Logs'}</span>
            {showLogs ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {showLogs && (
          <div className="p-4 bg-black/90 font-mono text-[11px] space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-white/5 text-slate-500 text-[10px]">
              <span>LOCAL PROCESS: D:\yt\ai-stream-clipper</span>
              <button
                onClick={handleCopyLogs}
                className="flex items-center gap-1 hover:text-slate-300 transition-colors"
              >
                {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
              {logs.length === 0 ? (
                <p className="text-slate-600 italic">Initializing neural sub-processes and audio models...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                    <span className="text-indigo-400 shrink-0">[{log.step}]</span>
                    <span className="text-slate-300">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
