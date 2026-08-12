import React from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface PWAInstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ onInstall, onDismiss }) => {
  return (
    <div className="bg-white text-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm border border-orange-200 flex items-center justify-between gap-3 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#F27D26]" />
      <div className="flex items-center space-x-3 pl-2">
        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-[#F27D26]" />
        </div>
        <div>
          <h4 className="text-xs font-bold leading-tight text-slate-900">Install Aplikasi BPPM PKS</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Tambahkan ke Layar Utama HP untuk akses cepat & lancar layaknya aplikasi Android/iOS.
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 flex-shrink-0">
        <button
          onClick={onInstall}
          className="bg-[#F27D26] hover:bg-orange-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-sm transition-colors flex items-center space-x-1"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>
        <button
          onClick={onDismiss}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
