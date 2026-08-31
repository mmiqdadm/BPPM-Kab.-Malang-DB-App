import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends (React.Component as any) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.removeItem('pks_youth_session_v1');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="bg-white border border-red-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Terjadi Kesalahan Tampilan</h2>
                <p className="text-xs text-slate-500 font-medium">Aplikasi mendeteksi error pada komponen antarmuka</p>
              </div>
            </div>

            <div className="bg-slate-900 text-red-400 p-3.5 rounded-xl text-xs font-mono overflow-x-auto max-h-48">
              {this.state.error?.message || this.state.error?.toString() || 'Unknown runtime error'}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Muat Ulang Halaman
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-[#F27D26] hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                Reset Sesi & Muat Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
