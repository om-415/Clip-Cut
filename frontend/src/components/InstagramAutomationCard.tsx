import React, { useState } from 'react';
import { Instagram, Bell, Check, AlertCircle } from 'lucide-react';
import { joinInstagramWaitlist } from '../api';

export const InstagramAutomationCard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await joinInstagramWaitlist(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="studio-card p-6 border-indigo-500/30 bg-gradient-to-br from-surface-primary via-surface-secondary/40 to-pink-950/10 space-y-5 relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-pink-500/20 shrink-0">
            <Instagram className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-100">
                Instagram Automation
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30">
                COMING SOON
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically prepare, schedule and publish approved clips to Instagram. This feature is currently under development.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1 relative z-10">
        <div className="p-3 bg-surface-primary/70 rounded-xl border border-border-subtle space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Target Platform</span>
          <p className="font-bold text-slate-200">Instagram Reels</p>
          <p className="text-[11px] text-slate-400">Direct publishing via Meta Graph API v20.0</p>
        </div>

        <div className="p-3 bg-surface-primary/70 rounded-xl border border-border-subtle space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Aspect Ratio</span>
          <p className="font-bold text-slate-200">9:16 Vertical Video</p>
          <p className="text-[11px] text-slate-400">1080 &times; 1920 MP4 &bull; Max 90 seconds</p>
        </div>

        <div className="p-3 bg-surface-primary/70 rounded-xl border border-border-subtle space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">AI Captioning</span>
          <p className="font-bold text-slate-200">Automated Hashtags</p>
          <p className="text-[11px] text-slate-400">Reels tag generation & creator attribution</p>
        </div>
      </div>

      {/* Real Early Access / Notify Me Signup Form */}
      <div className="pt-2 border-t border-border-subtle relative z-10">
        {submitted ? (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-300 text-xs">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Thank you! We've saved your email and will notify you as soon as Instagram Reels automation is deployed.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email to get notified when Instagram launches..."
                className="w-full bg-surface-primary border border-border-subtle focus:border-pink-500/70 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-pink-600/20 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              <span>Notify Me on Launch</span>
            </button>
          </form>
        )}

        {errorMessage && (
          <p className="text-[11px] text-red-400 pt-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMessage}</span>
          </p>
        )}
      </div>
    </div>
  );
};
