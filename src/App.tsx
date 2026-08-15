import React, { useState, useEffect } from 'react';
import { Database, Info, Sparkles, ShieldCheck } from 'lucide-react';
import HomeScreen from './components/HomeScreen.tsx';
import RoomScreen from './components/RoomScreen.tsx';
import SupabaseInfoModal from './components/SupabaseInfoModal.tsx';
import EnderChestLogo from './components/EnderChestLogo.tsx';
import EnderParticles from './components/EnderParticles.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { api } from './services/api.ts';
import { RoomData, RoomSession } from './types.ts';

const SESSION_KEY = 'enderchest_room_session_v1';

export default function App() {
  const [session, setSession] = useState<RoomSession | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  // Initial session restoration
  useEffect(() => {
    async function init() {
      try {
        const health = await api.checkHealth();
        setIsSupabaseConnected(health.db.isSupabaseConnected);

        const savedSessionJson = sessionStorage.getItem(SESSION_KEY);
        if (savedSessionJson) {
          const parsed: RoomSession = JSON.parse(savedSessionJson);
          if (parsed.token) {
            const data = await api.getRoomStatus(parsed.token);
            setSession(parsed);
            setRoomData({
              ...data,
              files: data.files || [],
            });
          }
        }
      } catch (err) {
        console.warn('Session restoration failed or expired:', err);
        sessionStorage.removeItem(SESSION_KEY);
      } finally {
        setInitialLoading(false);
      }
    }
    init();
  }, []);

  const handleEnterRoom = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const enterRes = await api.enterRoom(code);
      const sessionToken = enterRes.sessionToken;
      const data = enterRes.room || (await api.getRoomStatus(sessionToken));

      const newSession: RoomSession = {
        token: sessionToken,
        roomCode: code,
        roomId: data.id,
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
      setRoomData({
        ...data,
        files: data.files || [],
      });
    } catch (err: any) {
      console.error('Enter room error:', err);
      setError(err.message || 'Failed to open Ender Chest. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRoomData(null);
    setError(null);
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#090d14] flex items-center justify-center relative">
        <EnderParticles />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <EnderChestLogo size="lg" showGlow={true} />
          <span className="text-xs font-mono tracking-widest uppercase text-teal-400 animate-pulse">
            Summoning EnderChest...
          </span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
        {/* Fixed Background Image */}
        <div className="fixed inset-0 bg-[#04080f] bg-cover bg-[70%_center] md:bg-center z-[-1]" style={{ backgroundImage: 'url("https://plain-apac-prod-public.komododecks.com/202608/14/VygexfQp8GP1eWKJIoHX/image.png")' }}></div>

        {/* Dark overlay for readability */}
        <div className="fixed inset-0 bg-[#04080f]/30 z-0 pointer-events-none"></div>

        {/* Chest emissive glow overlay (bottom left, behind UI, over dark overlay) */}
        <div className="fixed bottom-[10%] left-[15%] w-64 h-64 bg-[#c084fc]/10 rounded-full blur-[80px] z-0 animate-pulse pointer-events-none" style={{ animationDuration: '4s' }}></div>
        <div className="fixed bottom-[12%] left-[17%] w-32 h-32 bg-[#2dd4bf]/10 rounded-full blur-[60px] z-0 animate-pulse pointer-events-none" style={{ animationDuration: '5s' }}></div>

        {/* Subtle Background Floating Particles */}
        <div className="relative z-10 pointer-events-none">
          <EnderParticles />
        </div>

        {/* Global Navigation Header */}
        <header className="bg-black/20 backdrop-blur-md border-b border-white/5 sticky top-0 z-30">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between">
            <div
              onClick={session ? handleLeaveRoom : undefined}
              className={`flex items-center gap-4 ${session ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            >
              <EnderChestLogo size="md" showGlow={true} />
              <div className="flex items-center gap-3">
                <span className="font-bold font-pixel tracking-wider text-white text-xl">
                  ENDERCHEST
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                id="supabase-status-btn"
                onClick={() => setIsSupabaseModalOpen(true)}
                className="silver-neon-btn inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono text-slate-200 transition-colors cursor-pointer backdrop-blur-sm"
                title="View Tutorial"
              >
                <span className="hidden md:inline">Tutorial</span>
                <Info className="w-4 h-4 text-slate-300 relative z-10" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col justify-center py-8 relative z-20">
          {!session || !roomData ? (
            <HomeScreen
              onEnterRoom={handleEnterRoom}
              loading={loading}
              error={error}
            />
          ) : (
            <RoomScreen
              roomCode={session.roomCode}
              sessionToken={session.token}
              initialRoomData={roomData}
              onLeaveRoom={handleLeaveRoom}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="py-6 border-t border-white/5 text-center text-[11px] font-mono text-slate-500 relative z-20 bg-black/20 backdrop-blur-sm">
          <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <EnderChestLogo size="sm" showGlow={false} />
              <span>EnderChest &bull; Minecraft-inspired cross-realm drop-off</span>
            </div>
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Server-side SHA-256 rune protection & session tokens
            </span>
          </div>
        </footer>

        {/* Supabase Schema & Architecture Modal */}
        <SupabaseInfoModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
        />
      </div>
    </ErrorBoundary>
  );
}
