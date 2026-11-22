import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Check, AlertCircle, Play, X } from 'lucide-react';
import { registerAccount, loginAccount, getGoogleAuthUrl, getAppleAuthUrl } from '../api';
import { User } from '../types';

interface AuthViewProps {
  onSuccess: (user: User) => void;
  onExploreAsGuest?: () => void;
  initialError?: string | null;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess, onExploreAsGuest, initialError }) => {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showAppleModal, setShowAppleModal] = useState(false);

  const slides = [
    {
      title: 'Capturing Moments,',
      subtitle: 'Creating Memories',
      desc: 'AI neural highlight analysis transforms long streams into viral 9:16 vertical shorts.',
    },
    {
      title: 'Multi-Signal AI,',
      subtitle: 'Zero Data Waste',
      desc: 'Audio energy, Whisper speech sentiment & facecam detection extract high-retention clips.',
    },
    {
      title: 'Autonomous Publishing,',
      subtitle: 'Direct to YouTube',
      desc: 'Scheduled automated uploads keep your channel growing while you sleep.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && !agreeTerms) {
      setError('Please agree to the Terms & Conditions to create an account.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const res = await registerAccount({
          email: email.trim(),
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });
        onSuccess(res.user);
      } else {
        const res = await loginAccount({
          email: email.trim(),
          password,
        });
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/auth/google/callback`;
      const res = await getGoogleAuthUrl(redirectUri);
      if (res && res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        throw new Error('Could not generate Google authorization link.');
      }
    } catch (err: any) {
      setError(
        err.message || 
        'Google OAuth is not configured on this server. Please sign in with Email & Password or use One-Click Demo Login.'
      );
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    try {
      const redirectUri = `${window.location.origin}/auth/apple/callback`;
      const res = await getAppleAuthUrl(redirectUri);
      if (res.configured && res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        setShowAppleModal(true);
      }
    } catch (err: any) {
      setShowAppleModal(true);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await loginAccount({
        email: 'demo@clipcut.ai',
        password: 'Demo1234!',
      });
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Demo login failed. Please register a new account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center p-3 sm:p-6 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Main Glassmorphic Container matching Reference UI */}
      <div className="w-full max-w-5xl bg-[#050508] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[640px]">
        
        {/* Left Visual Hero Showcase Panel */}
        <div className="md:w-1/2 relative bg-[#050508] p-8 flex flex-col justify-between overflow-hidden border-b md:border-b-0 md:border-r border-white/[0.08]">
          {/* Background 3D Hero Render */}
          <div className="absolute inset-0">
            <img 
              src="/clipcut-hero.jpg" 
              alt="ClipCut 3D Showcase" 
              className="w-full h-full object-cover object-center opacity-85 transition-transform duration-700 hover:scale-105"
            />
            {/* Soft dark vignette gradients for readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#050508]/90 via-[#050508]/25 to-[#050508]/95" />
          </div>

          {/* Top Bar: Brand Logo & Back to Website Link */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl overflow-hidden border border-red-500/40 shadow-lg shadow-red-600/30 shrink-0">
                <img src="/clipcut-hero.jpg" alt="ClipCut" className="w-full h-full object-cover" />
              </span>
              <span className="font-extrabold tracking-wider text-lg uppercase bg-gradient-to-r from-white via-slate-100 to-red-400 bg-clip-text text-transparent">
                ClipCut
              </span>
            </div>

            {onExploreAsGuest && (
              <button
                type="button"
                onClick={onExploreAsGuest}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-200 bg-black/60 hover:bg-black/80 border border-white/20 backdrop-blur-md transition-all flex items-center gap-1.5 hover:text-white"
              >
                <span>Back to website</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bottom Showcase Slogan & Carousel Indicators */}
          <div className="relative z-10 mt-auto pt-16 space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug drop-shadow-lg">
                {slides[activeSlide].title}
                <br />
                <span className="bg-gradient-to-r from-red-400 via-rose-300 to-indigo-300 bg-clip-text text-transparent">
                  {slides[activeSlide].subtitle}
                </span>
              </h2>
              <p className="text-xs text-slate-300 max-w-sm leading-relaxed pt-1 drop-shadow-md">
                {slides[activeSlide].desc}
              </p>
            </div>

            {/* Carousel Navigation Dots */}
            <div className="flex items-center gap-2 pt-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  className={`h-1.5 transition-all rounded-full ${
                    activeSlide === idx ? 'w-7 bg-red-500 shadow-sm shadow-red-500/50' : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Authentication Form Panel */}
        <div className="md:w-1/2 p-8 sm:p-10 flex flex-col justify-center bg-[#050508]">
          <div className="max-w-md w-full mx-auto space-y-6">
            
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {mode === 'signup' ? 'Create an account' : 'Welcome back'}
              </h1>
              <p className="text-xs text-slate-400 mt-1.5">
                {mode === 'signup' ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setError(null); }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 transition-colors"
                    >
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('signup'); setError(null); }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 transition-colors"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Name Fields (Sign-up only) */}
              {mode === 'signup' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="clipcut-auth-fname" className="block text-[11px] font-semibold text-slate-400 mb-1.5">First name</label>
                    <input
                      id="clipcut-auth-fname"
                      name="given-name"
                      type="text"
                      autoComplete="given-name"
                      placeholder="Fletcher"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D14] border border-white/[0.08] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="clipcut-auth-lname" className="block text-[11px] font-semibold text-slate-400 mb-1.5">Last name</label>
                    <input
                      id="clipcut-auth-lname"
                      name="family-name"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Creator"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D14] border border-white/[0.08] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div>
                <label htmlFor="clipcut-auth-email" className="block text-[11px] font-semibold text-slate-400 mb-1.5">Email</label>
                <input
                  id="clipcut-auth-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D14] border border-white/[0.08] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="clipcut-auth-password" className="block text-[11px] font-semibold text-slate-400">
                    {mode === 'signup' ? 'Enter your password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <span className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                      Forgot password?
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="clipcut-auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#0B0D14] border border-white/[0.08] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Terms Checkbox */}
              {mode === 'signup' && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAgreeTerms(!agreeTerms)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      agreeTerms ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-[#121624]'
                    }`}
                  >
                    {agreeTerms && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>
                  <label className="text-[11px] text-slate-400 select-none cursor-pointer" onClick={() => setAgreeTerms(!agreeTerms)}>
                    I agree to the <span className="text-slate-200 underline">Terms & Conditions</span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.99] text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>{mode === 'signup' ? 'Create account' : 'Sign in'}</span>
                )}
              </button>
            </form>

            {/* Social Divider */}
            <div className="relative flex items-center justify-center pt-2">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-[#090C14] px-3 text-[11px] text-slate-500 uppercase tracking-wider font-mono">
                {mode === 'signup' ? 'Or register with' : 'Or sign in with'}
              </span>
              <div className="border-t border-slate-800 w-full" />
            </div>

            {/* Social Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="py-2.5 px-4 rounded-xl bg-[#0B0D14] hover:bg-[#141824] border border-white/[0.08] text-xs font-semibold text-slate-200 flex items-center justify-center gap-2.5 transition-all hover:border-white/20 active:scale-95 shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google</span>
              </button>

              {/* Apple Button */}
              <button
                type="button"
                onClick={handleAppleSignIn}
                disabled={loading}
                className="py-2.5 px-4 rounded-xl bg-[#0B0D14] hover:bg-[#141824] border border-white/[0.08] text-xs font-semibold text-slate-200 flex items-center justify-center gap-2.5 transition-all hover:border-white/20 active:scale-95 shadow-sm"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.67-.82 1.13-1.96 1-3.11-1 .04-2.19.67-2.88 1.48-.61.71-1.14 1.87-.99 2.99 1.11.09 2.2-.54 2.87-1.36z" />
                </svg>
                <span>Apple</span>
              </button>
            </div>

            {/* Quick Demo Test Access */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleDemoLogin}
                className="text-[11px] text-slate-400 hover:text-indigo-300 font-mono flex items-center justify-center gap-1.5 mx-auto transition-colors"
              >
                <Play className="w-3 h-3 text-indigo-400" />
                <span>One-Click Instant Demo Login (demo@clipcut.ai)</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Sign in with Apple Configuration Modal */}
      {showAppleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0D14] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => setShowAppleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.67-.82 1.13-1.96 1-3.11-1 .04-2.19.67-2.88 1.48-.61.71-1.14 1.87-.99 2.99 1.11.09 2.2-.54 2.87-1.36z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Sign in with Apple Setup</h3>
                <p className="text-xs text-slate-400">OAuth 2.0 / OpenID Connect Provider</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                ClipCut includes full backend endpoints and token exchange architecture for <strong className="text-white">Sign in with Apple</strong>.
              </p>
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1.5 font-mono text-[11px]">
                <div className="text-indigo-300 font-semibold">Required Environment Variables:</div>
                <div>APPLE_CLIENT_ID=ai.clipcut.web</div>
                <div>APPLE_TEAM_ID=XXXXXXXXXX</div>
                <div>APPLE_KEY_ID=YYYYYYYYYY</div>
                <div>APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY...-----"</div>
              </div>
              <p className="text-slate-400">
                To enable Apple Login in production, register a Services ID in your paid Apple Developer Account ($99/yr) and add your production domain and redirect URL (<code className="text-indigo-300 font-mono">https://yourdomain.com/auth/apple/callback</code>).
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAppleModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
