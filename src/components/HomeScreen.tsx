import React, { useState } from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Lock, HardDrive, KeyRound } from 'lucide-react';
import EnderChestLogo from './EnderChestLogo.tsx';

interface HomeScreenProps {
  onEnterRoom: (code: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export default function HomeScreen({ onEnterRoom, loading, error }: HomeScreenProps) {
  const [vaultCode, setVaultCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultCode.trim() || loading) return;
    onEnterRoom(vaultCode.trim());
  };

  const handleGenerateRandom = () => {
    const endAdjectives = ['obsidian', 'void', 'ender', 'cosmic', 'shulker', 'elytra', 'astral', 'shadow', 'mystic', 'nether'];
    const endNouns = ['vault', 'chest', 'rift', 'beacon', 'gateway', 'sanctum', 'spire', 'harbor', 'domain', 'archive'];
    const num = Math.floor(100 + Math.random() * 900);
    const adj = endAdjectives[Math.floor(Math.random() * endAdjectives.length)];
    const noun = endNouns[Math.floor(Math.random() * endNouns.length)];
    const randomCode = `${adj}-${noun}-${num}`;
    setVaultCode(randomCode);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-12 flex flex-col items-center relative z-10 fadeUp">
      {/* Brand Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-black/40 border border-white/10 shadow-xl backdrop-blur-md">
          <EnderChestLogo size="xl" showGlow={true} />
        </div>
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#052e16]/80 border border-emerald-500/30 text-emerald-400 text-xs font-mono shadow-lg backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Interdimensional Drop-off</span>
          </div>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold font-pixel tracking-tight text-white mb-4 drop-shadow-lg">
          ENDERCHEST
        </h1>
        <p className="text-[15px] font-sans text-slate-300 max-w-md mx-auto leading-relaxed drop-shadow-md bg-black/20 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
          No-login text and file drop-off tool. Open your vault anywhere — each chest connects to secure cloud storage.
        </p>
      </div>

      {/* Main Chest Interface Panel */}
      <div className="w-full max-w-[560px] glass p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle top edge glow */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="vault-code-input"
              className="block text-xs font-semibold uppercase tracking-widest text-slate-300 mb-2 font-mono"
            >
              Enter or craft a vault code
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-400/70 group-focus-within:text-emerald-400 transition-colors">
                <KeyRound className="w-5 h-5" />
              </div>
              <input
                id="vault-code-input"
                type="text"
                value={vaultCode}
                onChange={(e) => setVaultCode(e.target.value)}
                placeholder="e.g. obsidian-vault-404 or quick-drop"
                autoFocus
                autoComplete="off"
                spellCheck="false"
                disabled={loading}
                className="w-full pl-12 pr-4 py-3.5 bg-[#06090d]/80 border border-white/10 focus:border-emerald-500/50 rounded-xl text-emerald-300 placeholder:text-slate-600 font-mono text-[15px] focus:outline-none focus:bg-[#06090d] transition-all shadow-inner"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 text-red-300 text-xs rounded-xl flex items-start gap-2 backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              id="submit-vault-btn"
              type="submit"
              disabled={!vaultCode.trim() || loading}
              className="silver-neon-btn flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 text-emerald-400 font-bold font-mono text-[14px] rounded-xl cursor-pointer transition-all shadow-lg"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin relative z-10" />
                  <span className="relative z-10">Opening Chest...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Open Vault</span>
                  <ArrowRight className="w-4 h-4 relative z-10" />
                </>
              )}
            </button>
            <button
              id="generate-code-btn"
              type="button"
              onClick={handleGenerateRandom}
              disabled={loading}
              className="silver-neon-btn inline-flex items-center justify-center gap-2 px-5 py-3.5 text-slate-300 hover:text-white font-mono text-[13px] rounded-xl transition-all cursor-pointer backdrop-blur-sm"
              title="Generate a random ender dimension code"
            >
              <Sparkles className="w-4 h-4 text-emerald-400 relative z-10" />
              <span className="relative z-10">Random Code</span>
            </button>
          </div>
        </form>
      </div>

      {/* Feature Badges */}
      <div className="w-full max-w-[800px] mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        <div className="glass p-5">
          <div className="flex items-center gap-2.5 text-slate-200 font-medium text-[13px] mb-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span className="font-mono">Zero Sign-in</span>
          </div>
          <p className="text-[12px] text-slate-400 leading-relaxed font-sans">
            No email or password needed. Share vault code across realms and devices.
          </p>
        </div>
        <div className="glass p-5">
          <div className="flex items-center gap-2.5 text-slate-200 font-medium text-[13px] mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-mono">SHA-256 Hashed</span>
          </div>
          <p className="text-[12px] text-slate-400 leading-relaxed font-sans">
            Vault codes are cryptographically hashed before reaching the cloud.
          </p>
        </div>

        <div className="glass p-5">
          <div className="flex items-center gap-2.5 text-slate-200 font-medium text-[13px] mb-2">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span className="font-mono">Central Vault</span>
          </div>
          <p className="text-[12px] text-slate-400 leading-relaxed font-sans">
            All files are securely dropped off into a centralized remote vault.
          </p>
        </div>
      </div>
    </div>
  );
}
