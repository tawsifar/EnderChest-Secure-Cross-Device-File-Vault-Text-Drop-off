import React, { useState, useEffect } from 'react';
import { X, Database, Check, Copy, Shield, Server, Lock } from 'lucide-react';
import { api } from '../services/api.ts';
import EnderChestLogo from './EnderChestLogo.tsx';

interface SupabaseInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupabaseInfoModal({ isOpen, onClose }: SupabaseInfoModalProps) {
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getSchema().then((data) => {
        setSchemaSql(data.schemaSql);
        setIsConfigured(data.isConfigured);
      }).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copySql = () => {
    navigator.clipboard.writeText(schemaSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="mc-panel rounded-2xl max-w-2xl w-full border border-teal-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#232e42] flex items-center justify-between bg-[#0e1520]">
          <div className="flex items-center gap-3">
            <EnderChestLogo size="sm" showGlow={false} />
            <div>
              <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
                How to use EnderChest
              </h3>
              <p className="text-xs font-mono text-slate-400">
                A simple guide to secure interdimensional drops
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-[13px] text-slate-300 leading-relaxed bg-[#0b1017]">
          
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-emerald-900/50 border border-emerald-500/50 text-emerald-400 flex items-center justify-center font-bold shrink-0">1</div>
            <div>
              <h4 className="text-emerald-400 font-bold mb-1 font-mono">Create or Enter a Vault</h4>
              <p>Type any secret code word into the main input box or click the "Random Code" button. If the vault does not exist, it will be instantly created for you.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-emerald-900/50 border border-emerald-500/50 text-emerald-400 flex items-center justify-center font-bold shrink-0">2</div>
            <div>
              <h4 className="text-emerald-400 font-bold mb-1 font-mono">Drop Text and Files</h4>
              <p>Once inside, you can type notes into the shared text slate on the left. On the right, you can drag and drop files directly into the secure cloud storage block.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-emerald-900/50 border border-emerald-500/50 text-emerald-400 flex items-center justify-center font-bold shrink-0">3</div>
            <div>
              <h4 className="text-emerald-400 font-bold mb-1 font-mono">Access Anywhere</h4>
              <p>Go to any other device or browser, type in the exact same vault code, and your text and files will be right there waiting for you. Close the vault when you are done to clear your session.</p>
            </div>
          </div>

          <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-center text-[11px] font-mono text-slate-500/70">
            Credit: Tawsif Azam Rahin, CS undergrad at CUET
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0e1520] border-t border-[#232e42] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 mc-btn-secondary text-slate-200 font-mono text-xs rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
