import React, { useState, useEffect, useMemo } from 'react';
import { AdminUser, AdminRole, ActivityLog, ActivityLogCategory, ActivityLogAction } from '../types';
import { getAdminsList, createNewAdmin, deleteAdminUser } from '../lib/auth';
import {
  getCustomOrganizations,
  saveCustomOrganization,
  updateCustomOrganization,
  deleteCustomOrganization,
  loadActivityLogsFromLocal,
  subscribeActivityLogsFirestore,
  clearAllActivityLogs,
} from '../lib/storage';
import { exportActivityLogsToExcel } from '../lib/export';
import { ORGANISASI_LIST } from '../data/constants';
import { formatDateIndonesian } from '../lib/utils';
import {
  X,
  Shield,
  UserPlus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Building2,
  Plus,
  Users,
  Pencil,
  Check,
  Lock,
  History,
  Search,
  Download,
  Filter,
  Calendar,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

interface AdminManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdmin: AdminUser | null;
}

export const AdminManagementModal: React.FC<AdminManagementModalProps> = ({
  isOpen,
  onClose,
  currentAdmin,
}) => {
  const isSuperAdmin = currentAdmin?.role === 'superadmin';
  const [activeTab, setActiveTab] = useState<'admins' | 'organizations' | 'logs'>('admins');
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin');

  // Custom organizations state
  const [customOrgs, setCustomOrgs] = useState<string[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [editingOrg, setEditingOrg] = useState<string | null>(null);
  const [editingOrgName, setEditingOrgName] = useState<string>('');

  // Activity Logs state
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('all');
  const [logActionFilter, setLogActionFilter] = useState<string>('all');
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAdmins = async () => {
    const list = await getAdminsList();
    setAdmins(list);
  };

  const fetchCustomOrgs = () => {
    setCustomOrgs(getCustomOrganizations());
  };

  const fetchLogs = () => {
    setActivityLogs(loadActivityLogsFromLocal());
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdmins();
      fetchCustomOrgs();
      fetchLogs();
      setMsg(null);
      setEditingOrg(null);
    }

    const handleAdminsUpdated = () => {
      fetchAdmins();
    };

    const handleLogsUpdated = () => {
      fetchLogs();
    };

    const unsubLogs = subscribeActivityLogsFirestore(updatedLogs => {
      setActivityLogs(updatedLogs);
    });

    window.addEventListener('pks_admins_updated', handleAdminsUpdated);
    window.addEventListener('pks_activity_logs_updated', handleLogsUpdated);
    return () => {
      unsubLogs();
      window.removeEventListener('pks_admins_updated', handleAdminsUpdated);
      window.removeEventListener('pks_activity_logs_updated', handleLogsUpdated);
    };
  }, [isOpen]);

  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      if (!log) return false;
      const query = logSearchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        (log.adminName && log.adminName.toLowerCase().includes(query)) ||
        (log.targetTitle && log.targetTitle.toLowerCase().includes(query)) ||
        (log.details && log.details.toLowerCase().includes(query));

      const matchCategory = logCategoryFilter === 'all' || log.category === logCategoryFilter;
      const matchAction = logActionFilter === 'all' || log.actionType === logActionFilter;

      return matchSearch && matchCategory && matchAction;
    });
  }, [activityLogs, logSearchQuery, logCategoryFilter, logActionFilter]);

  const handleExportLogs = () => {
    exportActivityLogsToExcel(filteredLogs);
  };

  const handleClearLogs = async () => {
    if (!isSuperAdmin) {
      setMsg({ type: 'error', text: 'Hanya Super Admin yang berwenang membersihkan riwayat log!' });
      return;
    }
    await clearAllActivityLogs();
    setActivityLogs([]);
    setShowClearLogsConfirm(false);
    setMsg({ type: 'success', text: 'Seluruh riwayat log aktivitas berhasil dibersihkan.' });
  };

  if (!isOpen) return null;

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!isSuperAdmin) {
      setMsg({ type: 'error', text: 'Hanya Super Admin yang dapat menambahkan akun admin baru!' });
      return;
    }

    const res = await createNewAdmin(newUsername, newPassword, newName, newRole);
    if (res.success) {
      setMsg({ type: 'success', text: res.message });
      setNewUsername('');
      setNewName('');
      setNewPassword('');
      setNewRole('admin');
      if (res.admin) {
        setAdmins(prev => {
          const filtered = prev.filter(
            a => a.id !== res.admin!.id && a.username.toLowerCase() !== res.admin!.username.toLowerCase()
          );
          return [...filtered, res.admin!];
        });
      }
    } else {
      setMsg({ type: 'error', text: res.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isSuperAdmin) {
      setMsg({ type: 'error', text: 'Hanya Super Admin yang dapat menghapus akun admin!' });
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus akun admin "${name}"?`)) return;

    setAdmins(prev => prev.filter(a => a.id !== id));
    const res = await deleteAdminUser(id);
    if (res.success) {
      setMsg({ type: 'success', text: res.message });
    } else {
      setMsg({ type: 'error', text: res.message });
      fetchAdmins();
    }
  };

  const handleAddOrganization = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!isSuperAdmin) {
      setMsg({ type: 'error', text: 'Hanya Super Admin yang berwenang menambah organisasi internal!' });
      return;
    }

    const clean = newOrgName.trim();
    if (!clean) return;

    if (
      ORGANISASI_LIST.some(o => o.toLowerCase() === clean.toLowerCase()) ||
      customOrgs.some(o => o.toLowerCase() === clean.toLowerCase())
    ) {
      setMsg({ type: 'error', text: `Organisasi "${clean}" sudah ada dalam daftar!` });
      return;
    }

    saveCustomOrganization(clean);
    setNewOrgName('');
    fetchCustomOrgs();
    setMsg({ type: 'success', text: `Organisasi internal "${clean}" berhasil ditambahkan.` });
  };

  const handleStartEditOrg = (org: string) => {
    if (!isSuperAdmin) {
      setMsg({ type: 'error', text: 'Hanya Super Admin yang berwenang mengedit organisasi internal!' });
      return;
    }
    setEditingOrg(org);
    setEditingOrgName(org);
    setMsg(null);
  };

  const handleSaveEditOrg = (oldOrgName: string) => {
    if (!isSuperAdmin) {
      setMsg({ type: 'error', text: 'Hanya Super Admin yang berwenang mengedit organisasi internal!' });
      return;
    }

    const cleanNew = editingOrgName.trim();
    if (!cleanNew) {
      setMsg({ type: 'error', text: 'Nama organisasi tidak boleh kosong!' });
      return;
    }

    if (cleanNew.toLowerCase() !== oldOrgName.toLowerCase()) {
      const allOrgs = [...ORGANISASI_LIST, ...customOrgs];
      if (allOrgs.some(o => o.toLowerCase() === cleanNew.toLowerCase())) {
        setMsg({ type: 'error', text: `Organisasi "${cleanNew}" sudah ada dalam daftar!` });
        return;
      }
    }

    updateCustomOrganization(oldOrgName, cleanNew);
    setEditingOrg(null);
    setEditingOrgName('');
    fetchCustomOrgs();
    setMsg({ type: 'success', text: `Organisasi "${oldOrgName}" berhasil diubah menjadi "${cleanNew}".` });
  };

  const handleDeleteOrg = (org: string) => {
    if (!isSuperAdmin) {
      setMsg({ type: 'error', text: 'Hanya Super Admin yang berwenang menghapus organisasi internal!' });
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus organisasi "${org}" dari daftar pilihan?`)) return;

    deleteCustomOrganization(org);
    fetchCustomOrgs();
    setMsg({ type: 'success', text: `Organisasi "${org}" berhasil dihapus.` });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-2xl lg:max-w-3xl shadow-xl relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Pengaturan Sekretariat & Admin</h3>
              <p className="text-xs text-slate-500 font-medium">Khusus Pengurus / Super Admin BPPM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 px-5 pt-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('admins');
              setMsg(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'admins'
                ? 'border-[#F27D26] text-[#F27D26]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Akun Admin ({admins.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('organizations');
              setMsg(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'organizations'
                ? 'border-[#F27D26] text-[#F27D26]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Organisasi Internal ({ORGANISASI_LIST.length + customOrgs.length})</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('logs');
                setMsg(null);
              }}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'logs'
                  ? 'border-[#F27D26] text-[#F27D26]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-4 h-4 text-purple-600" />
              <span>Log Riwayat Aktivitas ({activityLogs.length})</span>
            </button>
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {msg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center space-x-2 border font-medium ${
                msg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          {/* TAB 1: KELOLA AKUN ADMIN */}
          {activeTab === 'admins' && (
            <div className="space-y-6">
              {/* Form Create New Admin */}
              <form onSubmit={handleAddAdmin} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-[#F27D26] uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah Admin Baru</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ID Admin / Username
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      placeholder="Username"
                      className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-xs font-medium rounded-lg p-2.5 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Lengkap Admin
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Nama Pengguna"
                      className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-xs font-medium rounded-lg p-2.5 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-xs font-medium rounded-lg p-2.5 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hak Akses Role</label>
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-xs font-medium rounded-lg p-2.5 outline-none"
                    >
                      <option value="admin">Admin Editor (Kelola Data)</option>
                      <option value="viewer">Admin Viewer (Hanya Lihat Data)</option>
                      <option value="superadmin">Super Admin (Akses Penuh)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 bg-[#F27D26] hover:bg-orange-600 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all"
                >
                  + Simpan Admin Baru
                </button>
              </form>

              {/* Admin List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Daftar Admin Terdaftar ({admins.length})
                </h4>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {admins.map(a => (
                    <div key={a.id} className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-xs">{a.name}</span>
                          <span className="text-[10px] text-[#F27D26] font-mono font-bold">
                            ({a.username})
                          </span>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              a.role === 'superadmin'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : a.role === 'viewer'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {a.role === 'viewer' ? 'Viewer' : a.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          Dibuat: {formatDateIndonesian(a.createdAt)}
                        </p>
                      </div>

                      {a.id !== 'AdminSuper' && a.id !== currentAdmin?.id && (
                        <button
                          onClick={() => handleDelete(a.id, a.name)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Admin"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KELOLA ORGANISASI INTERNAL */}
          {activeTab === 'organizations' && (
            <div className="space-y-6">
              {/* Super Admin Access Control Banner */}
              {!isSuperAdmin && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-amber-800 text-xs">
                  <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-amber-900">Akses Khusus Super Admin</h4>
                    <p className="mt-1 text-slate-600 font-medium leading-relaxed">
                      Pengelolaan Organisasi Internal (Tambah, Edit, Hapus) hanya dapat dilakukan oleh akun dengan level <strong>Super Admin</strong>. Akun Anda saat ini ({currentAdmin?.name}) berstatus <strong>{currentAdmin?.role}</strong> (hanya dapat melihat data).
                    </p>
                  </div>
                </div>
              )}

              {/* Form Create New Organization (Super Admin Only) */}
              {isSuperAdmin && (
                <form onSubmit={handleAddOrganization} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-[#F27D26] uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Tambah Organisasi Internal Baru</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Organisasi / Sayap / Komunitas
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newOrgName}
                        onChange={e => setNewOrgName(e.target.value)}
                        placeholder="Contoh: Relawan Muda, PKS Art, dsb."
                        className="flex-1 bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-xs font-medium rounded-lg p-2.5 outline-none"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-[#F27D26] hover:bg-orange-600 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all flex items-center space-x-1 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Organisasi baru otomatis muncul di formulir input anggota, filter database, dan pengelolaan event.
                    </p>
                  </div>
                </form>
              )}

              {/* List of Organizations */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Daftar Organisasi Internal ({ORGANISASI_LIST.length + customOrgs.length})</span>
                  {isSuperAdmin && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      Mode Edit Aktif
                    </span>
                  )}
                </h4>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {/* Default Orgs */}
                  {ORGANISASI_LIST.map(org => {
                    const isEditing = editingOrg === org;

                    return (
                      <div key={org} className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <input
                              type="text"
                              value={editingOrgName}
                              onChange={e => setEditingOrgName(e.target.value)}
                              className="flex-1 bg-white border border-orange-300 focus:border-[#F27D26] text-slate-900 text-xs font-bold rounded-lg p-1.5 outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditOrg(org)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs"
                              title="Simpan Perubahan"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Simpan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingOrg(null)}
                              className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs">{org}</span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-100 text-slate-600 border border-slate-200">
                              Bawaan Sistem
                            </span>
                          </div>
                        )}

                        {isSuperAdmin && !isEditing && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleStartEditOrg(org)}
                              className="p-1.5 text-slate-400 hover:text-[#F27D26] hover:bg-orange-50 rounded-lg transition-colors"
                              title="Edit Nama Organisasi"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Custom Orgs */}
                  {customOrgs.map(org => {
                    const isEditing = editingOrg === org;

                    return (
                      <div key={org} className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors bg-orange-50/30">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <input
                              type="text"
                              value={editingOrgName}
                              onChange={e => setEditingOrgName(e.target.value)}
                              className="flex-1 bg-white border border-orange-300 focus:border-[#F27D26] text-slate-900 text-xs font-bold rounded-lg p-1.5 outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditOrg(org)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs"
                              title="Simpan Perubahan"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Simpan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingOrg(null)}
                              className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs">{org}</span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-orange-100 text-[#F27D26] border border-orange-200">
                              Kustom Admin
                            </span>
                          </div>
                        )}

                        {isSuperAdmin && !isEditing && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleStartEditOrg(org)}
                              className="p-1.5 text-slate-400 hover:text-[#F27D26] hover:bg-orange-50 rounded-lg transition-colors"
                              title="Edit Nama Organisasi"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrg(org)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus Organisasi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOG RIWAYAT AKTIVITAS (AUDIT TRAIL) */}
          {activeTab === 'logs' && isSuperAdmin && (
            <div className="space-y-4">
              {/* Top Controls & Search Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={logSearchQuery}
                      onChange={e => setLogSearchQuery(e.target.value)}
                      placeholder="Cari admin, nama anggota, event, atau rincian..."
                      className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-xs rounded-lg pl-9 pr-3 py-2 outline-none"
                    />
                    {logSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setLogSearchQuery('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleExportLogs}
                      disabled={filteredLogs.length === 0}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                      title="Unduh file spreadsheet Excel"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Unduh Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowClearLogsConfirm(true)}
                      disabled={activityLogs.length === 0}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                      title="Bersihkan seluruh riwayat log"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Bersihkan</span>
                    </button>
                  </div>
                </div>

                {/* Filter Dropdowns */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-semibold mr-1">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span>Filter:</span>
                  </div>

                  {/* Filter Kategori */}
                  <select
                    value={logCategoryFilter}
                    onChange={e => setLogCategoryFilter(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#F27D26] font-medium"
                  >
                    <option value="all">Semua Kategori</option>
                    <option value="anggota">👤 Anggota</option>
                    <option value="admin">🛡️ Akun Admin</option>
                    <option value="event">📅 Event</option>
                    <option value="presensi">📋 Presensi</option>
                    <option value="organisasi">🏢 Organisasi Internal</option>
                  </select>

                  {/* Filter Aksi */}
                  <select
                    value={logActionFilter}
                    onChange={e => setLogActionFilter(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#F27D26] font-medium"
                  >
                    <option value="all">Semua Jenis Aksi</option>
                    <option value="create">🟢 Tambah / Buat</option>
                    <option value="update">🔵 Ubah / Edit</option>
                    <option value="delete">🔴 Hapus</option>
                    <option value="import">🟣 Import Massal</option>
                  </select>

                  {(logSearchQuery || logCategoryFilter !== 'all' || logActionFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogSearchQuery('');
                        setLogCategoryFilter('all');
                        setLogActionFilter('all');
                      }}
                      className="text-xs text-[#F27D26] hover:underline font-bold px-1"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              </div>

              {/* Clear Confirmation Card */}
              {showClearLogsConfirm && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-red-700 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Konfirmasi Pembersihan Riwayat Log</span>
                  </div>
                  <p className="text-xs text-red-600 font-medium leading-relaxed">
                    Apakah Anda yakin ingin menghapus seluruh {activityLogs.length} catatan riwayat log aktivitas dari database lokal dan cloud? Tindakan ini tidak dapat dibatalkan.
                  </p>
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowClearLogsConfirm(false)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleClearLogs}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs"
                    >
                      Ya, Hapus Semua Log
                    </button>
                  </div>
                </div>
              )}

              {/* Logs Counter Header */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-700">
                  Menampilkan {filteredLogs.length} dari {activityLogs.length} riwayat aktivitas
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Tersinkronisasi Realtime
                </span>
              </div>

              {/* Activity Logs Timeline List */}
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <History className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">
                    {activityLogs.length === 0
                      ? 'Belum ada catatan aktivitas perubahan data yang tercatat.'
                      : 'Tidak ada log aktivitas yang cocok dengan kriteria pencarian / filter.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredLogs.map(log => {
                    const actionBadge = (() => {
                      switch (log.actionType) {
                        case 'create':
                          return {
                            label: '+ Buat / Tambah',
                            bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          };
                        case 'update':
                          return {
                            label: '✎ Ubah / Edit',
                            bg: 'bg-blue-50 text-blue-700 border-blue-200',
                          };
                        case 'delete':
                          return {
                            label: '✕ Hapus',
                            bg: 'bg-red-50 text-red-700 border-red-200',
                          };
                        case 'import':
                          return {
                            label: '⚡ Import',
                            bg: 'bg-purple-50 text-purple-700 border-purple-200',
                          };
                        default:
                          return {
                            label: log.actionType,
                            bg: 'bg-slate-50 text-slate-700 border-slate-200',
                          };
                      }
                    })();

                    const categoryBadge = (() => {
                      switch (log.category) {
                        case 'anggota':
                          return { label: 'Anggota', bg: 'bg-slate-100 text-slate-700' };
                        case 'admin':
                          return { label: 'Admin', bg: 'bg-amber-100 text-amber-800' };
                        case 'event':
                          return { label: 'Event', bg: 'bg-indigo-100 text-indigo-800' };
                        case 'presensi':
                          return { label: 'Presensi', bg: 'bg-teal-100 text-teal-800' };
                        case 'organisasi':
                          return { label: 'Organisasi', bg: 'bg-orange-100 text-orange-800' };
                        default:
                          return { label: log.category, bg: 'bg-slate-100 text-slate-700' };
                      }
                    })();

                    const formattedTime = log.timestamp
                      ? new Date(log.timestamp).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : '-';

                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-1.5"
                      >
                        {/* Header: Action & Category Badges + Timestamp */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${actionBadge.bg}`}
                            >
                              {actionBadge.label}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${categoryBadge.bg}`}
                            >
                              {categoryBadge.label}
                            </span>
                            <span className="font-bold text-xs text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                              {log.targetTitle}
                            </span>
                          </div>

                          <span className="text-[10px] text-slate-400 font-medium shrink-0">
                            {formattedTime} WIB
                          </span>
                        </div>

                        {/* Details */}
                        <p className="text-xs text-slate-600 leading-relaxed font-normal">
                          {log.details}
                        </p>

                        {/* Footer: Admin Who Did It */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 font-medium">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-slate-400">Oleh:</span>
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                              👤 {log.adminName}
                            </span>
                            <span
                              className={`font-semibold uppercase px-1.5 py-0.2 rounded text-[9px] ${
                                log.adminRole === 'superadmin'
                                  ? 'bg-amber-100 text-amber-800'
                                  : log.adminRole === 'viewer'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-orange-100 text-[#F27D26]'
                              }`}
                            >
                              {log.adminRole}
                            </span>
                          </div>

                          <span className="font-mono text-[9px] text-slate-400">
                            ID: {log.id.slice(0, 16)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
