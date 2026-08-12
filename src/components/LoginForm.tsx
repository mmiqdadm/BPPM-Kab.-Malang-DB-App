import React, { useState } from 'react';
import { loginAdmin } from '../lib/auth';
import { AdminUser } from '../types';
import { PKSLogo } from './PKSLogo';
import { Shield, KeyRound, User, Lock, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (admin: AdminUser) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Masukkan ID Admin dan Password dengan benar.');
      return;
    }

    setLoading(true);
    try {
      const admin = await loginAdmin(username, password);
      if (admin) {
        onLoginSuccess(admin);
      } else {
        setErrorMsg('ID Admin atau Password salah. Periksa kembali credential Anda.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan saat memproses login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans text-slate-800">
      {/* Background Decorative Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-100/60 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 relative z-10">
        {/* Header Icon & Branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <PKSLogo className="w-14 h-14 shadow-md" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            BPPM PKS
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Sistem Database BPPM Kab. Malang
          </p>
        </div>

        {/* Security Info Badge */}
        <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start space-x-3">
          <Shield className="w-5 h-5 text-[#F27D26] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed">
            Aplikasi ini khusus diakses oleh <strong className="text-slate-900">Admin Sekretariat</strong>. Anggota yang terdata tidak memiliki akses langsung.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ID Admin / Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masukkan ID Admin"
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#F27D26] focus:bg-white text-slate-900 text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none transition-colors"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan Password"
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#F27D26] focus:bg-white text-slate-900 text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none transition-colors"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#F27D26] hover:bg-orange-600 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-md shadow-orange-500/10 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{loading ? 'Memverifikasi...' : 'Masuk ke Sistem Admin'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
