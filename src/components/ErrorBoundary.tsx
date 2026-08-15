import React, { ErrorInfo, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import EnderChestLogo from './EnderChestLogo.tsx';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in EnderChest component:', error, errorInfo);
  }

  private handleReset = () => {
    sessionStorage.clear();
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090d14] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="mc-panel max-w-md w-full p-8 rounded-xl space-y-5">
            <div className="flex justify-center">
              <EnderChestLogo size="lg" showGlow={true} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold font-pixel text-slate-100">
                Rift Disturbance Detected
              </h2>
              <p className="text-xs font-mono text-slate-400">
                {this.state.error?.message || 'An unexpected disturbance occurred while rendering the chest.'}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 w-full py-3 mc-btn-primary font-mono font-bold text-xs text-slate-950 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset & Reopen EnderChest</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
