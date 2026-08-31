import React, { useState, useEffect } from 'react';
import { Member, AdminUser, EventItem, EventAttendance } from './types';
import { getCurrentAdminSession, logoutAdmin } from './lib/auth';
import {
  loadMembersFromLocal,
  addMemberLocal,
  updateMemberLocal,
  deleteMemberLocal,
  bulkImportMembersLocal,
  subscribeMembersFirestore,
  loadEventsFromLocal,
  addEventLocal,
  deleteEventLocal,
  subscribeEventsFirestore,
  loadAttendancesFromLocal,
  addAttendanceLocal,
  deleteAttendanceLocal,
  subscribeAttendancesFirestore,
  subscribeTagsFirestore,
} from './lib/storage';
import { HeaderBar } from './components/HeaderBar';
import { LoginForm } from './components/LoginForm';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { MemberList } from './components/MemberList';
import { EventManagement } from './components/EventManagement';
import { MemberFormModal } from './components/MemberFormModal';
import { MemberDetailModal } from './components/MemberDetailModal';
import { BulkImportModal } from './components/BulkImportModal';
import { AdminManagementModal } from './components/AdminManagementModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { AlertCircle, Trash2, CheckCircle2, Sparkles } from 'lucide-react';

export default function App() {
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendances, setAttendances] = useState<EventAttendance[]>([]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'members' | 'events'>('dashboard');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isAdminMgmtOpen, setIsAdminMgmtOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  // Search filter sync from AI Assistant
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  // Delete modal confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nama: string } | null>(null);

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // PWA Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);

  // Track Cloud Firestore Sync State
  const [isCloudSyncActive, setIsCloudSyncActive] = useState(true);

  // Check current session & load data
  useEffect(() => {
    const session = getCurrentAdminSession();
    setCurrentAdmin(session);
    setAuthChecked(true);

    // Initial load local
    setMembers(loadMembersFromLocal());
    setEvents(loadEventsFromLocal());
    setAttendances(loadAttendancesFromLocal());

    // Subscribe to Firestore realtime updates
    const unsubMembers = subscribeMembersFirestore(updatedMembers => {
      setMembers(updatedMembers);
      setIsCloudSyncActive(true);
    });

    const unsubEvents = subscribeEventsFirestore(updatedEvents => {
      setEvents(updatedEvents);
    });

    const unsubAttendances = subscribeAttendancesFirestore(updatedAtts => {
      setAttendances(updatedAtts);
    });

    const unsubTags = subscribeTagsFirestore(() => {
      // Tags updated in Firestore settings/tags
    });

    // Listen to local storage updates
    const handleStorageUpdate = () => {
      setMembers(loadMembersFromLocal());
      setEvents(loadEventsFromLocal());
      setAttendances(loadAttendancesFromLocal());
    };
    window.addEventListener('pks_members_updated', handleStorageUpdate);

    // Listen for PWA install prompt
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPwaBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Global Keyboard Shortcuts (Ctrl+K, Ctrl+J, Escape)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut if user is typing in input or textarea (except Escape)
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      if (e.key === 'Escape') {
        setIsFormOpen(false);
        setEditingMember(null);
        setViewingMember(null);
        setIsBulkImportOpen(false);
        setIsAdminMgmtOpen(false);
        setIsAIAssistantOpen(false);
        setDeleteTarget(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab('members');
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsAIAssistantOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubMembers();
      unsubEvents();
      unsubAttendances();
      unsubTags();
      window.removeEventListener('pks_members_updated', handleStorageUpdate);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleLoginSuccess = (admin: AdminUser) => {
    setCurrentAdmin(admin);
    showToast(`Selamat datang kembali, ${admin.name}!`);
  };

  const handleLogout = () => {
    logoutAdmin();
    setCurrentAdmin(null);
  };

  // Add or Update Member Handler
  const handleSaveMember = (
    data: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>,
    editId?: string
  ) => {
    if (editId) {
      updateMemberLocal(editId, data);
      showToast('Data anggota berhasil diperbarui.');
    } else {
      addMemberLocal(data, currentAdmin?.name || 'Admin');
      showToast('Anggota baru berhasil ditambahkan.');
    }
    setMembers(loadMembersFromLocal());
    setIsFormOpen(false);
    setEditingMember(null);
  };

  // Delete Member Handler
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMemberLocal(deleteTarget.id);
    setMembers(loadMembersFromLocal());
    showToast(`Data anggota "${deleteTarget.nama}" telah dihapus.`);
    setDeleteTarget(null);
  };

  // Bulk Import Handler
  const handleBulkImportConfirm = (
    newMembers: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => {
    const res = bulkImportMembersLocal(newMembers, currentAdmin?.name || 'Admin');
    setMembers(loadMembersFromLocal());
    showToast(`Berhasil mengimport ${res.count} data anggota baru.`);
  };

  // Event Management Handlers
  const handleAddEvent = (data: Omit<EventItem, 'id' | 'createdAt'>) => {
    addEventLocal(data, currentAdmin?.name || 'Admin');
    setEvents(loadEventsFromLocal());
    showToast(`Event "${data.namaEvent}" berhasil dibuat.`);
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEventLocal(eventId);
    setEvents(loadEventsFromLocal());
    showToast('Event telah dihapus.');
  };

  const handleAddAttendance = (
    data: Omit<EventAttendance, 'id' | 'waktuPresensi'>
  ) => {
    // Check matching member
    let memberIdToUse = data.memberId;
    let autoCreatedNewMember = false;

    if (!memberIdToUse) {
      const match = members.find(
        m => m.nama.toLowerCase().trim() === data.namaPeserta.toLowerCase().trim()
      );
      if (match) {
        memberIdToUse = match.id;
      } else {
        // Auto create new member if not exists
        const newMemberObj: Omit<Member, 'id' | 'createdAt' | 'updatedAt'> = {
          nama: data.namaPeserta.trim(),
          nomorHp: data.nomorHp || '',
          organisasiInternal: ['Belum'],
          tglLahir: '',
          sosmed: {
            instagram: data.sosmed || '',
          },
          email: '',
          domisili: data.domisili || 'Lainnya',
          aktivitas: 'Peserta Event',
          pendidikan: 'SMA',
          jurusan: '',
          keahlian: [],
          hobi: [],
          pembinaan: 'Belum Pernah',
          catatanTambahan: 'Diinput otomatis melalui Presensi Event',
          createdBy: currentAdmin?.name || 'Presensi Event',
        };
        const created = addMemberLocal(newMemberObj, currentAdmin?.name || 'Presensi Event');
        memberIdToUse = created.id;
        autoCreatedNewMember = true;
        setMembers(loadMembersFromLocal());
      }
    }

    addAttendanceLocal({
      ...data,
      memberId: memberIdToUse,
    });

    setAttendances(loadAttendancesFromLocal());

    if (autoCreatedNewMember) {
      showToast(
        `Presensi ${data.namaPeserta} dicatat! Data peserta otomatis ditambahkan ke Database Anggota.`,
        'info'
      );
    } else {
      showToast(`Presensi ${data.namaPeserta} berhasil dicatat.`);
    }
  };

  const handleDeleteAttendance = (attendanceId: string) => {
    deleteAttendanceLocal(attendanceId);
    setAttendances(loadAttendancesFromLocal());
    showToast('Data presensi berhasil dihapus.');
  };

  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setShowPwaBanner(false);
        }
        setDeferredPrompt(null);
      });
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-xs font-medium">
        Memuat Sistem Database...
      </div>
    );
  }

  // If not logged in, display secure admin login screen
  if (!currentAdmin) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-[#F27D26] selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-white border border-emerald-300 text-slate-900 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2.5 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-xs font-semibold">{toast.text}</span>
        </div>
      )}

      {/* Navigation Header */}
      <HeaderBar
        currentAdmin={currentAdmin}
        onLogout={handleLogout}
        onOpenAdminMgmt={() => setIsAdminMgmtOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddMember={() => {
          setEditingMember(null);
          setIsFormOpen(true);
        }}
        onOpenBulkImport={() => setIsBulkImportOpen(true)}
        isPWAInstallable={!!deferredPrompt}
        onInstallPWA={handleInstallPWA}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* PWA Install Banner */}
        {showPwaBanner && (
          <PWAInstallBanner
            onInstall={handleInstallPWA}
            onDismiss={() => setShowPwaBanner(false)}
          />
        )}

        {/* Tab 1: Dashboard Analytics */}
        {activeTab === 'dashboard' && (
          <DashboardAnalytics
            members={members}
            events={events}
            attendances={attendances}
            onOpenAddMember={() => {
              setEditingMember(null);
              setIsFormOpen(true);
            }}
          />
        )}

        {/* Tab 2: Database Members List */}
        {activeTab === 'members' && (
          <MemberList
            members={members}
            events={events}
            attendances={attendances}
            onOpenAddMember={() => {
              setEditingMember(null);
              setIsFormOpen(true);
            }}
            onOpenBulkImport={() => setIsBulkImportOpen(true)}
            onViewMember={m => setViewingMember(m)}
            onEditMember={m => {
              setEditingMember(m);
              setIsFormOpen(true);
            }}
            onDeleteMember={(id, nama) => setDeleteTarget({ id, nama })}
            externalSearchTerm={memberSearchTerm}
            canEdit={currentAdmin?.role !== 'viewer'}
          />
        )}

        {/* Tab 3: Event & Presensi Management */}
        {activeTab === 'events' && (
          <EventManagement
            events={events}
            attendances={attendances}
            members={members}
            currentAdminName={currentAdmin?.name || 'Admin'}
            onAddEvent={handleAddEvent}
            onDeleteEvent={handleDeleteEvent}
            onAddAttendance={handleAddAttendance}
            onDeleteAttendance={handleDeleteAttendance}
            canEdit={currentAdmin?.role !== 'viewer'}
          />
        )}
      </main>

      {/* Floating AI Assistant Action Widget */}
      <button
        onClick={() => setIsAIAssistantOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-[#F27D26] hover:to-orange-600 text-white w-12 h-12 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 rounded-full shadow-xl flex items-center justify-center sm:justify-start space-x-2 border border-slate-700/80 hover:border-orange-400/80 group transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer"
        title="Tanya AI Assistant Analitik"
      >
        <div className="relative flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
        </div>
        <span className="hidden sm:inline font-bold text-xs tracking-tight">Tanya AI Assistant</span>
      </button>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500 font-medium">
        <p>
          © 2026 BPPM PKS Kab.Malang.
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Aplikasi Database & Analitik BPPM
        </p>
      </footer>

      {/* Modals */}
      {/* Add / Edit Member Modal */}
      <MemberFormModal
        isOpen={isFormOpen}
        existingMembers={members}
        onClose={() => {
          setIsFormOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
        initialMember={editingMember}
        adminName={currentAdmin.name}
      />

      {/* Member Profile Detail Modal */}
      <MemberDetailModal
        member={viewingMember}
        events={events}
        attendances={attendances}
        onClose={() => setViewingMember(null)}
        onEdit={m => {
          setViewingMember(null);
          setEditingMember(m);
          setIsFormOpen(true);
        }}
        canEdit={currentAdmin?.role !== 'viewer'}
      />

      {/* Bulk Data Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        existingMembers={members}
        onClose={() => setIsBulkImportOpen(false)}
        onImportConfirm={handleBulkImportConfirm}
      />

      {/* Admin Management Modal */}
      <AdminManagementModal
        isOpen={isAdminMgmtOpen}
        onClose={() => setIsAdminMgmtOpen(false)}
        currentAdmin={currentAdmin}
      />

      {/* AI Assistant Analytics Modal */}
      <AIAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        members={members}
        events={events}
        attendances={attendances}
        onViewMember={m => setViewingMember(m)}
        onFilterMembers={term => {
          setMemberSearchTerm(term);
          setActiveTab('members');
        }}
      />

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 bg-red-50 border border-red-200 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Data</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Apakah Anda yakin ingin menghapus data anggota{' '}
                <strong className="text-slate-900">"{deleteTarget.nama}"</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

