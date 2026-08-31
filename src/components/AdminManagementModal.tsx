import React, { useState, useEffect } from 'react';
import { AdminUser } from '../types';
import { getAdminsList, createNewAdmin, deleteAdminUser } from '../lib/auth';
import {
  getCustomOrganizations,
  saveCustomOrganization,
  updateCustomOrganization,
  deleteCustomOrganization,
} from '../lib/storage';
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
  const [activeTab, setActiveTab] = useState<'admins' | 'organizations'>('admins');
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

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAdmins = async () => {
    const list = await getAdminsList();
    setAdmins(list);
  };

  const fetchCustomOrgs = () => {
    setCustomOrgs(getCustomOrganizations());
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdmins();
      fetchCustomOrgs();
      setMsg(null);
      setEditingOrg(null);
    }

    const handleAdminsUpdated = () => {
      fetchAdmins();
    };

    window.addEventListener('pks_admins_updated', handleAdminsUpdated);
    return () => {
      window.removeEventListener('pks_admins_updated', handleAdminsUpdated);
    };
  }, [isOpen]);

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
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-xl shadow-xl relative my-auto">
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
        <div className="flex border-b border-slate-200 bg-slate-100/60 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('admins');
              setMsg(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 ${
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
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'organizations'
                ? 'border-[#F27D26] text-[#F27D26]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Organisasi Internal ({ORGANISASI_LIST.length + customOrgs.length})</span>
          </button>
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
        </div>
      </div>
    </div>
  );
};
