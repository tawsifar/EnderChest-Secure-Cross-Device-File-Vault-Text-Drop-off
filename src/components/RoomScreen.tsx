import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  HardDrive,
  UploadCloud,
  FileText,
  Download,
  Check,
  Copy,
  LogOut,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileCode,
  FileAudio,
  FileVideo,
  Shield,
  Loader2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { RoomData } from '../types.ts';
import { api } from '../services/api.ts';
import EnderChestLogo from './EnderChestLogo.tsx';

interface RoomScreenProps {
  roomCode: string;
  sessionToken: string;
  initialRoomData: RoomData;
  onLeaveRoom: () => void;
}

export default function RoomScreen({
  roomCode,
  sessionToken,
  initialRoomData,
  onLeaveRoom,
}: RoomScreenProps) {
  // Room state
  const [roomData, setRoomData] = useState<RoomData>({
    ...initialRoomData,
    files: initialRoomData?.files || [],
  });
  const [text, setText] = useState<string>(initialRoomData.savedText || '');
  const [lastSavedText, setLastSavedText] = useState<string>(initialRoomData.savedText || '');

  // UI state
  const [isSavingText, setIsSavingText] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // File Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // General state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dirty state
  const isTextDirty = text !== lastSavedText;

  // Periodic or manual room refresh
  const refreshRoom = async (silent: boolean = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const updated = await api.getRoomStatus(sessionToken);
      setRoomData({
        ...updated,
        files: updated.files || [],
      });
      if (!isTextDirty) {
        setText(updated.savedText || '');
        setLastSavedText(updated.savedText || '');
      }
    } catch (err: any) {
      console.error('Failed to refresh room:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      refreshRoom(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [sessionToken, isTextDirty]);

  // Handle saving text
  const handleSaveText = async () => {
    setIsSavingText(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await api.saveRoomText(sessionToken, text);
      setLastSavedText(res.savedText);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save text');
    } finally {
      setIsSavingText(false);
    }
  };

  // File Upload Handlers
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFileError(null);
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Transporting ${file.name} (${i + 1}/${files.length})...`);
        const uploadedFile = await api.uploadFile(sessionToken, file, (pct) => {
          if (pct < 100) {
            setUploadProgress(`Transporting ${file.name} (${i + 1}/${files.length}) - ${pct}%...`);
          } else {
            setUploadProgress(`Syncing ${file.name} to Secure Storage...`);
          }
        });
        setRoomData((prev) => ({
          ...prev,
          files: [uploadedFile, ...prev.files.filter((f) => f.id !== uploadedFile.id)],
        }));
      }
      setUploadProgress(null);
    } catch (err: any) {
      setFileError(err.message || 'Failed to drop off one or more files');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyTextToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recent';
    }
  };

  const getFileIcon = (fileName: string, mime?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const iconClass = "w-5 h-5 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]";
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || mime?.startsWith('image/')) {
      return <FileImage className={iconClass} />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <FileArchive className={iconClass} />;
    }
    if (['ts', 'js', 'json', 'html', 'css', 'py', 'sql', 'cpp', 'rs'].includes(ext)) {
      return <FileCode className={iconClass} />;
    }
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || mime?.startsWith('audio/')) {
      return <FileAudio className={iconClass} />;
    }
    if (['mp4', 'mov', 'webm', 'mkv'].includes(ext) || mime?.startsWith('video/')) {
      return <FileVideo className={iconClass} />;
    }
    return <FileIcon className={iconClass} />;
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-6 py-4 sm:py-6 flex gap-8 relative z-10 fadeUp">
      {/* Left Decorative Sidebar */}
      <div className="hidden xl:block relative w-[240px] shrink-0">
        <img 
          src="/enderman.png" 
          alt="Enderman" 
          className="absolute bottom-[200px] right-4 h-[400px] object-contain pointer-events-none" 
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 space-y-6">
        {/* Top Room Navigation Bar */}
        <div className="glass p-3 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-1 bg-black/40 border border-white/10 rounded-xl">
            <EnderChestLogo size="md" showGlow={true} />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold">
                VAULT CODE
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                {roomCode}
              </span>
              <button
                id="copy-room-code-btn"
                onClick={copyRoomCode}
                className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Copy room code"
              >
                {copiedCode ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
          <button
            id="refresh-room-btn"
            onClick={() => refreshRoom(false)}
            disabled={isRefreshing}
            className="p-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-lg transition-colors cursor-pointer backdrop-blur-sm shadow-sm"
            title="Sync chest inventory"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            id="leave-room-btn"
            onClick={onLeaveRoom}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#450a0a]/30 hover:bg-red-900/40 border border-red-500/30 text-red-400 font-mono text-sm font-medium rounded-lg transition-colors cursor-pointer backdrop-blur-sm shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Close Vault</span>
          </button>
        </div>
      </div>

        {/* Main Grid: Text Slate & Drive Drop-off */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ========================================================================= */}
          {/* Left Column: Shared Text Slate */}
          {/* ========================================================================= */}
          <div className="glass p-4 sm:p-6 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-slate-300" />
              <h2 className="text-[15px] font-semibold font-mono text-slate-100 uppercase tracking-widest">
                SHARED TEXT SLATE
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {isTextDirty && (
                <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-600/40">
                  Unsaved changes
                </span>
              )}
              {text && (
                <button
                  id="copy-text-btn"
                  onClick={copyTextToClipboard}
                  className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer text-xs font-mono flex items-center gap-1.5"
                  title="Copy text"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <p className="text-[13px] text-slate-400 mb-4 font-sans">
            Drop notes, instructions, or snippets here.<br/>Accessible across dimensions.
          </p>

          <div className="flex-1 flex flex-col mb-4">
            <textarea
              id="room-text-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write or paste text here to synchronize with anyone in this room..."
              rows={12}
              className="w-full flex-1 p-4 bg-[#06090d]/80 border border-white/5 rounded-xl text-emerald-400 font-mono text-[14px] leading-relaxed focus:outline-none focus:border-emerald-500/50 focus:bg-[#06090d] resize-none shadow-inner transition-all min-h-[260px]"
            />
          </div>

          {saveError && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-800/60 text-red-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-mono text-slate-500">
              {text.length} chars &bull; {text.split('\n').length} lines
            </span>

            <button
              id="save-text-btn"
              type="button"
              onClick={handleSaveText}
              disabled={isSavingText || !isTextDirty}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm transition-all cursor-pointer shadow-sm ${
                saveSuccess
                  ? 'bg-emerald-600/20 border border-emerald-500 text-emerald-300'
                  : isTextDirty
                  ? 'bg-[#052e16]/60 border border-emerald-500/40 text-emerald-400 hover:bg-[#052e16]'
                  : 'bg-white/5 border border-white/5 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isSavingText ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Text</span>
                </>
              )}
            </button>
          </div>
        </div>

          {/* ========================================================================= */}
          {/* Right Column: Secure File Storage */}
          {/* ========================================================================= */}
          <div className="glass p-5 sm:p-6 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-slate-300" />
              <h2 className="text-[15px] font-semibold font-mono text-slate-100 uppercase tracking-widest">
                SECURE VAULT STORAGE
              </h2>
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-[#052e16]/80 border border-emerald-500/30 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Linked
            </span>
          </div>

          <div className="flex-1 flex flex-col space-y-5">
            {/* Storage Status Banner */}
            <div className="p-3 sm:p-4 bg-[#06090d]/80 border border-white/5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex items-center gap-3 w-full min-w-0">
                <img 
                  src="https://art.pixilart.com/sr281c51b66f4aws3.png" 
                  alt="Server Secure Storage"
                  className="w-10 h-10 rounded-lg object-contain bg-indigo-900/40 border border-indigo-500/30"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-mono font-semibold text-slate-200 mb-0.5 truncate">
                    Server Secure Storage
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    Folder: <span className="text-indigo-300">{roomData.driveAccount?.folderName || 'EnderChest Vault'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button disabled className="px-3 py-1.5 text-[11px] font-mono text-slate-500 bg-white/5 border border-white/10 rounded-lg">
                  Unlink
                </button>
              </div>
            </div>

            {/* Drag and Drop Upload Box */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFilesSelected(e.target.files)}
              multiple
              className="hidden"
              id="hidden-file-input"
            />

            <div
              id="file-dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-400 bg-[#052e16]/40 scale-[0.99]'
                  : isUploading
                  ? 'border-slate-700 bg-black/40 cursor-wait'
                  : 'border-emerald-500/30 hover:border-emerald-500/60 bg-black/40 hover:bg-black/60 backdrop-blur-sm'
              }`}
            >
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                  <span className="text-sm font-mono font-semibold text-slate-200">
                    {uploadProgress || 'Transferring to Storage...'}
                  </span>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="text-[14px] font-mono font-semibold text-slate-200 mb-1.5">
                    Drop files here, or <span className="text-emerald-400 underline underline-offset-4 decoration-emerald-500/40 hover:decoration-emerald-400">browse</span>
                  </span>
                  <span className="text-[12px] font-mono text-slate-500">
                    Directly upload to vault's secure storage
                  </span>
                </>
              )}
            </div>

            {fileError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 text-red-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Uploaded Files Inventory */}
            <div className="flex-1 flex flex-col pt-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-mono tracking-widest text-slate-400 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span>VAULT INVENTORY ({(roomData.files || []).length})</span>
                </span>
              </div>

              {(!roomData.files || roomData.files.length === 0) ? (
                <div className="py-8 text-center text-[13px] font-mono text-slate-500 bg-black/40 border border-white/5 rounded-xl border-dashed">
                  Chest is currently empty.
                </div>
              ) : (
                <div className="max-h-[240px] overflow-y-auto space-y-2 pr-2">
                  {(roomData.files || []).map((file) => (
                    <div
                      key={file.id}
                      className="p-3 flex items-center justify-between gap-4 group rounded-xl bg-black/40 hover:bg-black/60 transition-colors border border-white/5 hover:border-purple-500/30 shadow-inner"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="p-2.5 bg-purple-950/40 border border-purple-500/20 rounded-xl shrink-0 shadow-[0_0_12px_rgba(168,85,247,0.15)]">
                          {getFileIcon(file.name, file.mimeType)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-mono font-medium text-slate-200 truncate max-w-[200px] sm:max-w-xs mb-0.5" title={file.name}>
                            {file.name}
                          </div>
                          <div className="text-[11px] font-sans text-slate-500 flex items-center gap-1.5">
                            <span>{formatBytes(file.size)}</span>
                            <span>&bull;</span>
                            <span>{formatDate(file.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <a
                        id={`download-file-${file.id}`}
                        href={`${file.downloadUrl}${file.downloadUrl.includes('?') ? '&' : '?'}token=${sessionToken}`}
                        download={file.name}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-emerald-400 hover:text-emerald-300 text-[12px] font-mono rounded-lg transition-colors cursor-pointer shrink-0 border border-emerald-500/30 hover:bg-emerald-500/10"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Download</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
