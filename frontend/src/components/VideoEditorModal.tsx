import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Layers, 
  Type, 
  Wand2, 
  Check, 
  Download, 
  Video, 
  RotateCcw,
  Scissors
} from 'lucide-react';
import { Clip, Highlight, Project } from '../types';
import { renderEditedClip, revertClip, fetchClipSubtitles, getClipDownloadUrl } from '../api';

interface VideoEditorModalProps {
  clip?: Clip;
  highlight?: Highlight;
  project?: Project;
  onClose: () => void;
  onClipUpdated?: (updatedClip: Clip) => void;
  onSaveAdjustments?: (hlId: string, start: number, end: number) => Promise<void>;
  onRenderClip?: (hlId: string, layout: string, subStyle: string) => Promise<void>;
}

export const VideoEditorModal: React.FC<VideoEditorModalProps> = ({
  clip,
  highlight,
  project,
  onClose,
  onClipUpdated,
  onSaveAdjustments,
  onRenderClip,
}) => {
  const effectiveClip: Clip = clip || {
    id: highlight?.id || 'candidate',
    project_id: project?.id || '',
    highlight_id: highlight?.id || null,
    file_name: `clip_${highlight?.category || 'highlight'}.mp4`,
    clip_url: highlight?.thumbnail_url || '',
    thumbnail_url: highlight?.thumbnail_url || null,
    duration: highlight?.duration || 30.0,
    file_size: 0,
    resolution: '1080x1920',
    subtitle_style: 'gaming_bold',
    layout_type: 'split_stack',
    created_at: null,
  };

  // Trimming State
  const [startTrim, setStartTrim] = useState<number>(0);
  const [endTrim, setEndTrim] = useState<number>(effectiveClip.duration || 30.0);
  
  // Title
  const [clipTitle, setClipTitle] = useState<string>(
    effectiveClip.file_name.replace(/\.[^/.]+$/, '').replace(/clip_[a-z0-9]+_/i, '')
  );

  // Aspect Ratio & Layout
  const [aspectRatio, setAspectRatio] = useState<'9:16' | 'original_16:9' | '1:1'>('9:16');
  const [layoutMode, setLayoutMode] = useState<'split_stack' | 'overlay_pip' | 'blurred_fill' | 'fit_center'>(
    (effectiveClip.layout_type as any) || 'split_stack'
  );

  // Audio Boost / Attenuation
  const [volumeLevel, setVolumeLevel] = useState<number>(1.0); // 0.0 to 2.0

  // Subtitle Controls
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);
  const [subtitleText, setSubtitleText] = useState<string>(highlight?.transcript || '');
  const [subtitleFont, setSubtitleFont] = useState<string>('Impact');
  const [subtitleFontSize, setSubtitleFontSize] = useState<number>(50);
  const [primaryColor, setPrimaryColor] = useState<string>('#FFFF00'); // Yellow default
  const [outlineColor, setOutlineColor] = useState<string>('#000000');
  const [hasBoxBg, setHasBoxBg] = useState<boolean>(false);
  const [subtitlePosition, setSubtitlePosition] = useState<'bottom' | 'middle' | 'top'>('bottom');

  // Player state
  const [activeVideoSrc, setActiveVideoSrc] = useState<string>(effectiveClip.clip_url);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [isReverting, setIsReverting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Load existing transcript or saved settings if available
  useEffect(() => {
    if (clip?.id) {
      fetchClipSubtitles(clip.id)
        .then((data) => {
          if (data.transcript_text && !subtitleText) {
            setSubtitleText(data.transcript_text);
          }
          if (data.saved_settings) {
            const s = data.saved_settings;
            if (s.start_trim !== undefined) setStartTrim(s.start_trim);
            if (s.end_trim !== undefined) setEndTrim(s.end_trim);
            if (s.aspect_ratio) setAspectRatio(s.aspect_ratio);
            if (s.layout_mode) setLayoutMode(s.layout_mode);
            if (s.volume_multiplier !== undefined) setVolumeLevel(s.volume_multiplier);
            if (s.subtitles_enabled !== undefined) setSubtitlesEnabled(s.subtitles_enabled);
            if (s.subtitle_text) setSubtitleText(s.subtitle_text);
            if (s.subtitle_font) setSubtitleFont(s.subtitle_font);
            if (s.subtitle_font_size) setSubtitleFontSize(s.subtitle_font_size);
            if (s.subtitle_primary_color) setPrimaryColor(s.subtitle_primary_color);
            if (s.subtitle_outline_color) setOutlineColor(s.subtitle_outline_color);
            if (s.subtitle_has_box_bg !== undefined) setHasBoxBg(s.subtitle_has_box_bg);
            if (s.subtitle_position) setSubtitlePosition(s.subtitle_position);
          }
        })
        .catch(() => {});
    }
  }, [clip?.id]);

  const targetDuration = Math.max(0.5, endTrim - startTrim);

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      // Loop or stop if passed endTrim
      if (endTrim > 0 && videoRef.current.currentTime >= endTrim) {
        videoRef.current.currentTime = startTrim;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Render Edits (Option A export)
  const handleRenderEdits = async () => {
    setIsRendering(true);
    try {
      if (!clip && onRenderClip && highlight) {
        if (onSaveAdjustments) {
          await onSaveAdjustments(highlight.id, startTrim, endTrim);
        }
        await onRenderClip(highlight.id, layoutMode, subtitleFont);
        showToast('Vertical clip rendered!');
        return;
      }

      if (!clip) {
        throw new Error('No clip available to edit');
      }

      const res = await renderEditedClip(clip.id, {
        title: clipTitle,
        start_trim: startTrim,
        end_trim: endTrim,
        aspect_ratio: aspectRatio,
        layout_mode: layoutMode,
        volume_multiplier: volumeLevel,
        subtitles_enabled: subtitlesEnabled,
        subtitle_text: subtitleText,
        subtitle_font: subtitleFont,
        subtitle_font_size: subtitleFontSize,
        subtitle_primary_color: primaryColor,
        subtitle_outline_color: outlineColor,
        subtitle_has_box_bg: hasBoxBg,
        subtitle_position: subtitlePosition,
      });

      setActiveVideoSrc(`${res.active_clip_url}?t=${Date.now()}`);
      showToast('Customized clip successfully rendered!');

      if (onClipUpdated) {
        onClipUpdated({
          ...effectiveClip,
          is_edited: true,
          clip_url: res.active_clip_url,
          duration: res.duration,
          file_size: res.file_size,
          resolution: res.resolution,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Rendering failed');
    } finally {
      setIsRendering(false);
    }
  };

  // Revert Edits
  const handleRevert = async () => {
    if (!effectiveClip.id) return;
    if (!confirm('Revert all customizations back to original pristine generated clip?')) return;
    setIsReverting(true);
    try {
      const res = await revertClip(effectiveClip.id);
      setActiveVideoSrc(`${res.active_clip_url}?t=${Date.now()}`);
      setStartTrim(0);
      setEndTrim(res.duration || effectiveClip.duration);
      showToast('Reverted to original generated clip.');
      if (onClipUpdated) {
        onClipUpdated({
          ...effectiveClip,
          is_edited: false,
          clip_url: res.active_clip_url,
          duration: res.duration,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Revert failed');
    } finally {
      setIsReverting(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const dec = Math.floor((sec - Math.floor(sec)) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${dec}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-border-strong rounded-3xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-secondary/70">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Scissors className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  Clip Studio & Precision Editor
                </h3>
                {effectiveClip.is_edited ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Edited Version Active
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-tertiary text-slate-400 border border-border-subtle">
                    Original AI Clip
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Trim boundaries, customize typography, fine-tune framing, and download original or edited versions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {toastMessage && (
              <span className="text-xs font-semibold text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                {toastMessage}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-surface-tertiary rounded-xl transition-colors border border-border-subtle"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Body: Left Settings / Center Player / Right Subtitles & Audio */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Left Column: Trimming & Framing */}
          <div className="lg:col-span-4 space-y-4">
            {/* Title Editing */}
            <div className="studio-card p-4 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Clip Title
              </label>
              <input
                type="text"
                value={clipTitle}
                onChange={(e) => setClipTitle(e.target.value)}
                placeholder="Clip title"
                className="w-full bg-surface-secondary border border-border-subtle rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Trimming Controls */}
            <div className="studio-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-indigo-400" />
                  Trim Clip Range
                </h4>
                <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60">
                  {targetDuration.toFixed(1)}s
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Start Trim (sec)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={endTrim - 0.5}
                    value={startTrim}
                    onChange={(e) => setStartTrim(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-surface-secondary border border-border-subtle rounded-xl px-3 py-1.5 font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">End Trim (sec)</label>
                  <input
                    type="number"
                    step="0.5"
                    min={startTrim + 0.5}
                    max={effectiveClip.duration || 60}
                    value={endTrim}
                    onChange={(e) => setEndTrim(Math.max(startTrim + 0.5, parseFloat(e.target.value) || startTrim + 0.5))}
                    className="w-full bg-surface-secondary border border-border-subtle rounded-xl px-3 py-1.5 font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="studio-card p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Aspect Ratio Format
              </h4>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '9:16', label: '9:16 Shorts', desc: 'Vertical' },
                  { id: 'original_16:9', label: '16:9 Full', desc: 'Landscape' },
                  { id: '1:1', label: '1:1 Square', desc: 'Square' },
                ].map((ar) => (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setAspectRatio(ar.id as any)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      aspectRatio === ar.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                        : 'bg-surface-secondary border-border-subtle text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <p className="text-xs font-bold">{ar.label}</p>
                    <p className="text-[10px] text-slate-500">{ar.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Mode */}
            {aspectRatio === '9:16' && (
              <div className="studio-card p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-indigo-400" />
                  Framing & Layout
                </h4>

                <div className="space-y-2">
                  {[
                    { id: 'fit_center', label: 'Crisp Centered 9:16', desc: 'Clean vertical framing' },
                    { id: 'split_stack', label: 'Facecam Top + Gameplay Bottom', desc: 'Stacked stream format' },
                    { id: 'blurred_fill', label: 'Blurred Canvas Background', desc: 'Preserves full landscape' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLayoutMode(l.id as any)}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all ${
                        layoutMode === l.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                          : 'bg-surface-secondary border-border-subtle text-slate-400 hover:border-border-strong'
                      }`}
                    >
                      <p className="font-bold">{l.label}</p>
                      <p className="text-[10px] text-slate-500">{l.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center Column: Live Video Player & Download Actions */}
          <div className="lg:col-span-4 flex flex-col items-center justify-start space-y-4">
            <div className={`w-full max-w-[310px] ${aspectRatio === 'original_16:9' ? 'aspect-[16/9]' : aspectRatio === '1:1' ? 'aspect-square' : 'aspect-[9/16]'} bg-black rounded-2xl overflow-hidden border border-border-strong shadow-studio relative group flex flex-col justify-between`}>
              <video
                ref={videoRef}
                src={activeVideoSrc}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
              />

              {/* Player Overlay Controls */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-between pointer-events-none">
                <div className="flex justify-between items-center text-[10px] text-white/90 font-mono">
                  <span>{aspectRatio}</span>
                  <span>{formatSeconds(currentTime)} / {formatSeconds(effectiveClip.duration)}</span>
                </div>

                <div className="space-y-3 pointer-events-auto">
                  <input
                    type="range"
                    min="0"
                    max={effectiveClip.duration || 60}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-indigo-500 h-1.5 bg-white/30 rounded cursor-pointer"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTogglePlay}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={handleToggleMute}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>

                    <span className="text-[10px] font-mono text-slate-300">
                      Trim: {formatSeconds(startTrim)} - {formatSeconds(endTrim)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Dual Download Options (Phase 2 Requirement) */}
            <div className="w-full max-w-[310px] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={getClipDownloadUrl(effectiveClip.id, 'original')}
                  download={`original_${effectiveClip.file_name}`}
                  className="py-2.5 px-3 bg-surface-secondary hover:bg-surface-tertiary text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-border-subtle transition-all shadow-sm"
                  title="Download pristine AI generated clip without any edits"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Download Original</span>
                </a>

                <a
                  href={getClipDownloadUrl(effectiveClip.id, 'edited')}
                  download={`edited_${effectiveClip.file_name}`}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/25"
                  title="Download customized / rendered clip"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Edited</span>
                </a>
              </div>

              {effectiveClip.is_edited && (
                <button
                  onClick={handleRevert}
                  disabled={isReverting}
                  className="w-full py-2 bg-surface-secondary hover:bg-red-500/10 hover:text-red-300 text-slate-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-border-subtle transition-all"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Revert to Original Clip</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Subtitles, Audio Volume & Render Trigger */}
          <div className="lg:col-span-4 space-y-4">
            {/* Audio Volume Controls */}
            <div className="studio-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  Audio Volume Boost
                </h4>
                <span className="font-mono text-xs font-bold text-slate-200">
                  {Math.round(volumeLevel * 100)}%
                </span>
              </div>

              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.05"
                value={volumeLevel}
                onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-surface-secondary rounded cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>Quiet (50%)</span>
                <span>Normal (100%)</span>
                <span>Boosted (200%)</span>
              </div>
            </div>

            {/* Subtitles & Typography */}
            <div className="studio-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-amber-400" />
                  Captions & Subtitles
                </h4>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subtitlesEnabled}
                    onChange={(e) => setSubtitlesEnabled(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span className="text-xs text-slate-300 font-semibold">Enabled</span>
                </label>
              </div>

              {subtitlesEnabled && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Edit Dialogue / Captions Text
                    </label>
                    <textarea
                      rows={3}
                      value={subtitleText}
                      onChange={(e) => setSubtitleText(e.target.value)}
                      placeholder="Spoken stream dialogue for subtitles..."
                      className="w-full bg-surface-secondary border border-border-subtle rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Font & Size */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Font Family</label>
                      <select
                        value={subtitleFont}
                        onChange={(e) => setSubtitleFont(e.target.value)}
                        className="w-full bg-surface-secondary border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-slate-200"
                      >
                        <option value="Impact">Impact (Gaming)</option>
                        <option value="Arial">Arial (Clean)</option>
                        <option value="Trebuchet MS">Trebuchet MS (Karaoke)</option>
                        <option value="Helvetica">Helvetica (Modern)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Font Size ({subtitleFontSize}px)</label>
                      <input
                        type="range"
                        min="32"
                        max="68"
                        step="2"
                        value={subtitleFontSize}
                        onChange={(e) => setSubtitleFontSize(parseInt(e.target.value))}
                        className="w-full accent-indigo-500 h-1.5 bg-surface-secondary rounded mt-2 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Colors & Positioning */}
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Text Color</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-7 h-7 rounded border border-border-subtle bg-transparent cursor-pointer p-0"
                        />
                        <span className="font-mono text-[10px] text-slate-300">{primaryColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Outline Color</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={outlineColor}
                          onChange={(e) => setOutlineColor(e.target.value)}
                          className="w-7 h-7 rounded border border-border-subtle bg-transparent cursor-pointer p-0"
                        />
                        <span className="font-mono text-[10px] text-slate-300">{outlineColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Vertical Position</label>
                      <select
                        value={subtitlePosition}
                        onChange={(e) => setSubtitlePosition(e.target.value as any)}
                        className="w-full bg-surface-secondary border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-slate-200"
                      >
                        <option value="bottom">Bottom</option>
                        <option value="middle">Middle</option>
                        <option value="top">Top</option>
                      </select>
                    </div>
                  </div>

                  {/* Background Box */}
                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium">
                      <input
                        type="checkbox"
                        checked={hasBoxBg}
                        onChange={(e) => setHasBoxBg(e.target.checked)}
                        className="accent-indigo-500 rounded"
                      />
                      <span>Translucent Background Box</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Render Custom Edits CTA */}
            <button
              onClick={handleRenderEdits}
              disabled={isRendering}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isRendering ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Rendering Customized Clip...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Apply Edits & Render Clip</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
