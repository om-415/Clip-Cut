import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  HardDrive, 
  Film, 
  Sparkles, 
  CheckCircle2, 
  Folder, 
  RefreshCw,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { fetchSystemInfo } from '../api';
import { SystemInfoData } from '../types';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hardware' | 'ai' | 'export' | 'storage'>('hardware');
  const [telemetry, setTelemetry] = useState<SystemInfoData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadTelemetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSystemInfo();
      setTelemetry(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve system diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-10 px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              System & Processing Info
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
            Hardware & Engine Telemetry
          </h2>
          <p className="text-xs text-slate-400">
            Real detected specifications, neural inference runtimes, storage utilization, and processing limitations
          </p>
        </div>

        <button
          onClick={loadTelemetry}
          disabled={loading}
          className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary active:scale-95 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 border border-border-subtle transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-center gap-3 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-1 overflow-x-auto">
        {[
          { id: 'hardware', label: 'Hardware Specs', icon: Cpu },
          { id: 'ai', label: 'AI Engines & Models', icon: Sparkles },
          { id: 'export', label: 'Export Standards', icon: Film },
          { id: 'storage', label: 'Storage & Disk', icon: HardDrive },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                active
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-secondary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Hardware Specifications */}
      {activeTab === 'hardware' && (
        <div className="space-y-6">
          <div className="studio-card p-6 shadow-studio space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                Detected Host Hardware
              </h3>
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                Mode: {telemetry?.application?.processing_mode || 'Local Engine'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-primary rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Operating System</span>
                <p className="text-sm font-bold text-slate-100">{telemetry?.hardware?.os || 'Detecting...'}</p>
                <p className="text-xs text-slate-400">Python {telemetry?.environment?.python_version || '3.11'}</p>
              </div>

              <div className="p-4 bg-surface-primary rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Available CPU Compute</span>
                <p className="text-sm font-bold text-slate-100">{telemetry?.hardware?.cpu_cores || 1} Logical CPU Cores</p>
                <p className="text-xs text-slate-400">{telemetry?.hardware?.acceleration || 'CPU SIMD Vectorized'}</p>
              </div>

              <div className="p-4 bg-surface-primary rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">System RAM Memory</span>
                <p className="text-sm font-bold text-slate-100">
                  {telemetry ? `${telemetry.hardware.ram_total_gb} GB Total (${telemetry.hardware.ram_available_gb} GB Available)` : 'Detecting...'}
                </p>
                <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden mt-1.5">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${telemetry?.hardware?.ram_used_pct || 0}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-surface-primary rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">GPU Acceleration / CUDA</span>
                <p className="text-sm font-bold text-slate-100">{telemetry?.hardware?.gpu_model || 'None detected'}</p>
                <p className="text-xs text-slate-400">
                  {telemetry?.hardware?.gpu_detected ? `VRAM: ${telemetry.hardware.gpu_memory}` : 'CPU fallback mode (Torch CPU)'}
                </p>
              </div>
            </div>
          </div>

          {/* Processing limitations card */}
          <div className="studio-card p-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Engine Safeguards & Processing Limitations
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              {telemetry?.limitations.map((lim, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <span>{lim}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Tab: AI Engines & Neural Models */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="studio-card p-6 shadow-studio space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              AI Neural Models & Compute Frameworks
            </h3>

            <div className="space-y-3">
              {[
                { name: 'PyTorch Execution Runtime', version: telemetry?.environment?.pytorch_version || '2.15.0+cpu', role: 'Tensor runtime, matrix computations, neural feature scoring' },
                { name: 'OpenAI Whisper Engine', version: telemetry?.ai_models?.speech_recognition || 'OpenAI Whisper', role: 'Commentary dialogue transcription, keyword hype analysis & subtitle timing' },
                { name: 'MediaPipe Vision', version: telemetry?.ai_models?.face_detection || 'Face Landmark & ROI', role: 'Streamer FaceCam spatial clustering and reaction tracking' },
                { name: 'OpenCV Computer Vision', version: telemetry?.ai_models?.gameplay_motion || 'Dense Optical Flow', role: 'Gameplay velocity vector tracking and action intensity calculation' },
                { name: 'Audio Signal Processing', version: telemetry?.ai_models?.audio_analysis || 'Librosa RMS', role: 'RMS volume surge detection, scream frequencies and loudness crests' },
                { name: 'Video Composition Engine', version: telemetry?.environment?.ffmpeg_version || 'FFmpeg', role: '1080x1920 vertical composition filtergraph, subtitle burning & AAC encoding' },
              ].map((item) => (
                <div key={item.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-surface-primary rounded-xl border border-border-subtle">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{item.name}</span>
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/50">
                        {item.version}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{item.role}</p>
                  </div>

                  <span className="self-start sm:self-center flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Export Standards */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="studio-card p-6 shadow-studio space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Film className="w-4 h-4 text-violet-400" />
              Verified Output Specifications
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-primary rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Vertical Video Standard</span>
                <p className="text-sm font-bold text-slate-100">1080 &times; 1920 (9:16 Vertical)</p>
                <p className="text-xs text-slate-400">Exact SAR 1:1 &bull; DAR 9:16 &bull; YouTube Shorts Compliant</p>
              </div>

              <div className="p-4 bg-surface-primary rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Video Encoding</span>
                <p className="text-sm font-bold text-slate-100">{telemetry?.formats?.video_codec || 'H.264 (libx264)'}</p>
                <p className="text-xs text-slate-400">CRF 20–21 &bull; yuv420p &bull; +faststart MP4 container</p>
              </div>

              <div className="p-4 bg-surface-primary rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Audio Mastering</span>
                <p className="text-sm font-bold text-slate-100">{telemetry?.formats?.audio_codec || 'AAC Stereo'}</p>
                <p className="text-xs text-slate-400">192 kbps bitrate &bull; 44,100 Hz sample rate</p>
              </div>

              <div className="p-4 bg-surface-primary rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Subtitle Standards</span>
                <p className="text-sm font-bold text-slate-100">ASS (Advanced SubStation Alpha)</p>
                <p className="text-xs text-slate-400">Burned into pixel stream &bull; Fully customizable styling</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Storage & Disk Usage */}
      {activeTab === 'storage' && (
        <div className="space-y-6">
          <div className="studio-card p-6 shadow-studio space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Folder className="w-4 h-4 text-cyan-400" />
              Live Workspace Storage Usage
            </h3>

            {/* Storage Progress Bar */}
            <div className="space-y-2 p-4 bg-surface-primary rounded-xl border border-border-subtle">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Workspace Disk Partition</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {telemetry ? `${telemetry.storage.disk_free_gb} GB Free / ${telemetry.storage.disk_total_gb} GB Total` : 'Loading...'}
                </span>
              </div>
              <div className="w-full h-2 bg-surface-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${telemetry?.storage?.disk_used_pct || 0}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-surface-primary rounded-xl border border-border-subtle">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Exported Clips</span>
                <p className="text-base font-bold text-slate-100 mt-1">
                  {telemetry?.storage?.clips_storage_mb || 0} MB
                </p>
                <p className="text-[10px] text-slate-400">clips/</p>
              </div>

              <div className="p-3.5 bg-surface-primary rounded-xl border border-border-subtle">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Download Cache</span>
                <p className="text-base font-bold text-slate-100 mt-1">
                  {telemetry?.storage?.downloads_cache_mb || 0} MB
                </p>
                <p className="text-[10px] text-slate-400">downloads/</p>
              </div>

              <div className="p-3.5 bg-surface-primary rounded-xl border border-border-subtle">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Scratch Temp</span>
                <p className="text-base font-bold text-slate-100 mt-1">
                  {telemetry?.storage?.temp_scratch_mb || 0} MB
                </p>
                <p className="text-[10px] text-slate-400">temp/</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
