'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Clear errors when switching modes
  useEffect(() => {
    setError(null);
    setName('');
    setEmail('');
    setPassword('');
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Authentication failed');
      }

      // Success - redirect to board
      router.push('/board');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#0a051b] overflow-hidden font-sans">
      {/* Decorative background blobs */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-[#8a2be2]/40 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-[#00f5ff]/20 to-transparent blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="relative w-full max-w-md p-8 mx-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl transition-all duration-300">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-[#00f5ff] via-[#8a2be2] to-[#ff007f] bg-clip-text text-transparent">
            Sprintly
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {isLogin ? 'Sign in to manage your sprint board' : 'Create an account to join your team'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-sm flex items-center gap-2">
            <span className="shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#00f5ff] focus:ring-1 focus:ring-[#00f5ff]/30 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@sprintly.com"
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#00f5ff] focus:ring-1 focus:ring-[#00f5ff]/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#00f5ff] focus:ring-1 focus:ring-[#00f5ff]/30 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="relative w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-[#8a2be2] to-[#00f5ff] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 cursor-pointer shadow-lg shadow-[#8a2be2]/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {isLogin ? 'Signing In...' : 'Registering...'}
              </span>
            ) : (
              <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center text-sm text-slate-400">
          {isLogin ? (
            <span>
              Don't have an account?{' '}
              <button
                onClick={() => setIsLogin(false)}
                className="font-medium text-[#00f5ff] hover:underline bg-transparent border-0 cursor-pointer focus:outline-none"
              >
                Sign up free
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                onClick={() => setIsLogin(true)}
                className="font-medium text-[#00f5ff] hover:underline bg-transparent border-0 cursor-pointer focus:outline-none"
              >
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
