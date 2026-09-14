import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Error capturado:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="p-6 max-w-md w-full rounded-3xl bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 text-center space-y-3 shadow-2xl">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Ocurrió un error inesperado al mostrar esta ventana</h3>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 font-mono break-words">
              {this.state.error?.message || 'Error desconocido'}
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar</span>
              </button>
              {this.props.onClose && (
                <button
                  type="button"
                  onClick={this.props.onClose}
                  className="px-4 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
