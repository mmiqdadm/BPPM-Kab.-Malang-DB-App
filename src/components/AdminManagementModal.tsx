import React, { useState, useEffect } from 'react';
import { AdminUser } from '../types';
import { getAdminsList, createNewAdmin, deleteAdminUser } from '../lib/auth';
import {
  getCustomOrganizations,
  saveCustomOrganization,
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
  const [activeTab, setActiveTab] = useState<'admins' | 'organizations'>('admins');
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'superadmin'>('admin');

  // Custom organizations state
  const [customOrgs, setCustomOrgs] = useState<string[]>([]);
  const [newOrgName, setNewOrgName] = useState('');

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
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const res = await createNewAdmin(newUsername, newPassword, newName, newRole);
    if (res.success) {
      setMsg({ type: 'success', text: res.message });
      setNewUsername('');
      setNewName('');
      setNewPassword('');
      fetchAdmins();
    } else {
      setMsg({ type: 'error', text: res.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun admin "${name}"?`)) return;

    const res = await deleteAdminUser(id);
    if (res.success) {
      setMsg({ type: 'success', text: res.message });
      fetchAdmins();
    } else {
      setMsg({ type: 'error', text: res.message });
    }
  };

  const handleAddOrganization = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
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

  const handleDeleteOrg = (org: string) => {
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
                      <option value="admin">Admin Biasa</option>
                      <option value="superadmin">Super Admin</option>
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
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {a.role}
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
              {/* Form Create New Organization */}
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

              {/* List of Organizations */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Daftar Organisasi Internal ({ORGANISASI_LIST.length + customOrgs.length})
                </h4>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {/* Default Orgs */}
                  {ORGANISASI_LIST.map(org => (
                    <div key={org} className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-xs">{org}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-100 text-slate-600 border border-slate-200">
                          Bawaan Sistem
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Custom Orgs */}
                  {customOrgs.map(org => (
                    <div key={org} className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors bg-orange-50/30">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-xs">{org}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-orange-100 text-[#F27D26] border border-orange-200">
                          Kustom Admin
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteOrg(org)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus Organisasi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
