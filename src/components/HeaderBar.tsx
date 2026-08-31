import React from 'react';
import { AdminUser } from '../types';
import { UserCheck, LogOut, Database, Users, Download, Sparkles, CalendarCheck, Plus } from 'lucide-react';
import { PKSLogo } from './PKSLogo';

interface HeaderBarProps {
  currentAdmin: AdminUser | null;
  onLogout: () => void;
  onOpenAdminMgmt: () => void;
  activeTab: 'dashboard' | 'members' | 'events';
  setActiveTab: (tab: 'dashboard' | 'members' | 'events') => void;
  onOpenAddMember: () => void;
  onOpenBulkImport: () => void;
  isPWAInstallable: boolean;
  onInstallPWA: () => void;
  isCloudSyncActive?: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentAdmin,
  onLogout,
  onOpenAdminMgmt,
  activeTab,
  setActiveTab,
  onOpenAddMember,
  onOpenBulkImport,
  isPWAInstallable,
  onInstallPWA,
  isCloudSyncActive = true,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center space-x-2 cursor-pointer select-none group"
            >
              <PKSLogo className="w-8 h-8 group-hover:scale-105 transition-transform" />
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                    BPPM
                  </span>
                  <span className="bg-orange-50 text-[#F27D26] border border-orange-200 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                    Kab. Malang
                  </span>
                </div>
              </div>
            </div>

            {/* Cloud Sync Status Indicator */}
            <div
              className="hidden lg:flex items-center space-x-1.5 bg-slate-100/90 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-600"
              title="Status Sinkronisasi Realtime Cloud Firestore"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Cloud Sync</span>
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <div className="hidden md:flex items-center p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-[#F27D26] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Analitik</span>
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'members'
                  ? 'bg-[#F27D26] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Database Anggota</span>
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'events'
                  ? 'bg-[#F27D26] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Event & Presensi</span>
            </button>
          </div>

          {/* Right Action Buttons & Admin Profile */}
          <div className="flex items-center space-x-1.5">
            {isPWAInstallable && (
              <button
                onClick={onInstallPWA}
                className="hidden lg:flex items-center space-x-1 bg-orange-50 hover:bg-orange-100 text-[#F27D26] border border-orange-200/80 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
                title="Install PWA"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PWA</span>
              </button>
            )}

            {currentAdmin?.role !== 'viewer' && (
              <>
                <button
                  onClick={onOpenBulkImport}
                  className="hidden sm:flex items-center space-x-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Import</span>
                </button>

                <button
                  onClick={onOpenAddMember}
                  className="bg-[#F27D26] hover:bg-orange-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs transition-all flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Input</span>
                </button>
              </>
            )}

            {/* Admin User Control */}
            {currentAdmin && (
              <div className="flex items-center space-x-1 pl-1.5 border-l border-slate-200">
                <div className="flex items-center space-x-1 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/80">
                  <div className="px-1.5 text-left hidden sm:block">
                    <span className="text-[11px] font-bold text-slate-800 block leading-tight">
                      {currentAdmin.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase block leading-tight ${
                        currentAdmin.role === 'superadmin'
                          ? 'text-amber-600'
                          : currentAdmin.role === 'viewer'
                          ? 'text-purple-600'
                          : 'text-[#F27D26]'
                      }`}
                    >
                      {currentAdmin.role === 'viewer' ? 'Viewer (Lihat)' : currentAdmin.role}
                    </span>
                  </div>

                  {currentAdmin.role === 'superadmin' && (
                    <button
                      onClick={onOpenAdminMgmt}
                      className="p-1 text-slate-500 hover:text-[#F27D26] hover:bg-white rounded transition-colors"
                      title="Kelola Akun Admin & Organisasi"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={onLogout}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                    title="Keluar / Logout"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Tab Navigation Bar */}
      <div className="md:hidden flex border-t border-slate-200 bg-slate-50 px-1.5 py-1 space-x-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
            activeTab === 'dashboard'
              ? 'bg-white text-[#F27D26] border border-orange-200 shadow-2xs'
              : 'text-slate-600'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Analitik</span>
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
            activeTab === 'members'
              ? 'bg-white text-[#F27D26] border border-orange-200 shadow-2xs'
              : 'text-slate-600'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Database</span>
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
            activeTab === 'events'
              ? 'bg-white text-[#F27D26] border border-orange-200 shadow-2xs'
              : 'text-slate-600'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          <span>Event</span>
        </button>
      </div>
    </header>
  );
};
