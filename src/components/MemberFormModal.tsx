import React, { useState, useEffect, useMemo } from 'react';
import { Member, OrganisasiType, PendidikanType, PembinaanType } from '../types';
import {
  KECAMATAN_MALANG,
  SUGGESTED_SKILLS,
  SUGGESTED_HOBBIES,
  ORGANISASI_LIST,
  PENDIDIKAN_LIST,
  PEMBINAAN_LIST,
} from '../data/constants';
import { calculateAge } from '../lib/utils';
import {
  getCustomSkills,
  saveCustomSkill,
  getCustomHobbies,
  saveCustomHobby,
  loadMembersFromLocal,
} from '../lib/storage';
import { X, Check, Plus, Trash2, Calendar, User, Phone, Mail, MapPin, Briefcase, GraduationCap, Award, Heart, Sparkles, MessageSquare } from 'lucide-react';

interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>, editId?: string) => void;
  initialMember?: Member | null;
  adminName: string;
  existingMembers?: Member[];
}

export const MemberFormModal: React.FC<MemberFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMember,
  adminName,
  existingMembers,
}) => {
  const [nama, setNama] = useState('');
  const [nomorHp, setNomorHp] = useState('');
  const [organisasiInternal, setOrganisasiInternal] = useState<OrganisasiType[]>([]);
  const [tglLahir, setTglLahir] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [twitter, setTwitter] = useState('');
  const [facebook, setFacebook] = useState('');
  const [email, setEmail] = useState('');
  const [domisili, setDomisili] = useState('');
  const [alamatDetail, setAlamatDetail] = useState('');
  const [aktivitas, setAktivitas] = useState('');
  const [pendidikan, setPendidikan] = useState<PendidikanType>('S1');
  const [jurusan, setJurusan] = useState('');
  const [keahlian, setKeahlian] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [hobi, setHobi] = useState<string[]>([]);
  const [hobiInput, setHobiInput] = useState('');
  const [pembinaan, setPembinaan] = useState<PembinaanType>('Sudah');
  const [catatanTambahan, setCatatanTambahan] = useState('');

  const [errors, setErrors] = useState<{ nama?: string }>({});

  useEffect(() => {
    if (initialMember) {
      setNama(initialMember.nama || '');
      setNomorHp(initialMember.nomorHp || '');
      setOrganisasiInternal(initialMember.organisasiInternal || []);
      setTglLahir(initialMember.tglLahir || '');
      setInstagram(initialMember.sosmed?.instagram || '');
      setTiktok(initialMember.sosmed?.tiktok || '');
      setTwitter(initialMember.sosmed?.twitter || '');
      setFacebook(initialMember.sosmed?.facebook || '');
      setEmail(initialMember.email || '');
      setDomisili(initialMember.domisili || 'Kepanjen');
      setAlamatDetail(initialMember.alamatDetail || '');
      setAktivitas(initialMember.aktivitas || '');
      setPendidikan(initialMember.pendidikan || 'S1');
      setJurusan(initialMember.jurusan || '');
      setKeahlian(initialMember.keahlian || []);
      setHobi(initialMember.hobi || []);
      setPembinaan(initialMember.pembinaan || 'Sudah');
      setCatatanTambahan(initialMember.catatanTambahan || '');
    } else {
      // Default reset
      setNama('');
      setNomorHp('');
      setOrganisasiInternal(['PKS Muda']);
      setTglLahir('2002-01-01');
      setInstagram('');
      setTiktok('');
      setTwitter('');
      setFacebook('');
      setEmail('');
      setDomisili('Kepanjen');
      setAlamatDetail('');
      setAktivitas('');
      setPendidikan('S1');
      setJurusan('');
      setKeahlian([]);
      setHobi([]);
      setPembinaan('Sudah');
      setCatatanTambahan('');
    }
    setErrors({});
  }, [initialMember, isOpen]);

  // Combined Skills & Hobbies list (Defaults + Cloud Custom recommendations + Member data)
  const allSkillsList = useMemo(() => {
    const custom = getCustomSkills();
    const fromMembers = (existingMembers || loadMembersFromLocal()).flatMap(m => m.keahlian || []);
    const combined = Array.from(new Set([...SUGGESTED_SKILLS, ...custom, ...fromMembers])).filter(Boolean);
    return combined;
  }, [isOpen, skillInput, existingMembers]);

  const allHobbiesList = useMemo(() => {
    const custom = getCustomHobbies();
    const fromMembers = (existingMembers || loadMembersFromLocal()).flatMap(m => m.hobi || []);
    const combined = Array.from(new Set([...SUGGESTED_HOBBIES, ...custom, ...fromMembers])).filter(Boolean);
    return combined;
  }, [isOpen, hobiInput, existingMembers]);

  if (!isOpen) return null;

  // Age calculation display
  const calculatedAge = calculateAge(tglLahir);

  // Toggle internal org checklist
  const handleOrgToggle = (org: OrganisasiType) => {
    if (organisasiInternal.includes(org)) {
      setOrganisasiInternal(organisasiInternal.filter(o => o !== org));
    } else {
      setOrganisasiInternal([...organisasiInternal, org]);
    }
  };

  // Skill suggestion & tags management
  const filteredSkillSuggestions = allSkillsList.filter(
    s =>
      s.toLowerCase().includes(skillInput.trim().toLowerCase()) &&
      !keahlian.includes(s)
  ).slice(0, 6);

  const addSkill = (skillToAdd: string) => {
    const clean = skillToAdd.trim();
    if (clean && !keahlian.some(s => s.toLowerCase() === clean.toLowerCase())) {
      setKeahlian([...keahlian, clean]);
      saveCustomSkill(clean);
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setKeahlian(keahlian.filter(s => s !== skillToRemove));
  };

  // Hobi suggestion & tags management
  const filteredHobiSuggestions = allHobbiesList.filter(
    h =>
      h.toLowerCase().includes(hobiInput.trim().toLowerCase()) &&
      !hobi.includes(h)
  ).slice(0, 6);

  const addHobi = (hobiToAdd: string) => {
    const clean = hobiToAdd.trim();
    if (clean && !hobi.some(h => h.toLowerCase() === clean.toLowerCase())) {
      setHobi([...hobi, clean]);
      saveCustomHobby(clean);
      setHobiInput('');
    }
  };

  const removeHobi = (hobiToRemove: string) => {
    setHobi(hobi.filter(h => h !== hobiToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      setErrors({ nama: 'Nama Anggota wajib diisi!' });
      return;
    }

    const payload: Omit<Member, 'id' | 'createdAt' | 'updatedAt'> = {
      nama: nama.trim(),
      nomorHp: nomorHp.trim(),
      organisasiInternal,
      tglLahir,
      sosmed: {
        instagram: instagram.trim(),
        tiktok: tiktok.trim(),
        twitter: twitter.trim(),
        facebook: facebook.trim(),
      },
      email: email.trim(),
      domisili: domisili || 'Kepanjen',
      alamatDetail: alamatDetail.trim(),
      aktivitas: aktivitas.trim(),
      pendidikan,
      jurusan: jurusan.trim(),
      keahlian,
      hobi,
      pembinaan,
      catatanTambahan: catatanTambahan.trim(),
      createdBy: initialMember?.createdBy || adminName,
    };

    onSave(payload, initialMember?.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl relative my-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <User className="w-5 h-5 text-[#F27D26]" />
              <span>{initialMember ? 'Edit Data Anggota' : 'Input Anggota Baru'}</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              BPPM PKS Kab. Malang
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: Data Identitas Utama */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-[#F27D26] uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
              <User className="w-4 h-4" />
              <span>Identitas Utama</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nama (Wajib) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={e => {
                    setNama(e.target.value);
                    if (errors.nama) setErrors({});
                  }}
                  placeholder="Contoh: Ahmad Fauzi"
                  className={`w-full bg-white border ${
                    errors.nama ? 'border-red-500' : 'border-slate-200'
                  } focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium`}
                  required
                />
                {errors.nama && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.nama}</p>}
              </div>

              {/* Nomor HP */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  value={nomorHp}
                  onChange={e => setNomorHp(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>

              {/* Tanggal Lahir & Age Indicator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Tanggal Lahir
                  </label>
                  {calculatedAge > 0 && (
                    <span className="bg-orange-50 text-[#F27D26] border border-orange-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                      Usia: {calculatedAge} Tahun
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={tglLahir}
                  onChange={e => setTglLahir(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contoh@gmail.com"
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Organisasi Internal & Pembinaan */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
              <Sparkles className="w-4 h-4" />
              <span>Organisasi Internal & Pembinaan</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Checklist Organisasi Internal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Organisasi Internal (Bisa Pilih Banyak)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ORGANISASI_LIST.map(org => {
                    const isChecked = organisasiInternal.includes(org);
                    return (
                      <button
                        type="button"
                        key={org}
                        onClick={() => handleOrgToggle(org)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          isChecked
                            ? 'bg-orange-50 border-orange-200 text-[#F27D26] shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span>{org}</span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isChecked
                              ? 'bg-[#F27D26] border-[#F27D26] text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Pembinaan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Status Pembinaan
                </label>
                <div className="space-y-2">
                  {PEMBINAAN_LIST.map(p => {
                    const isSelected = pembinaan === p;
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPembinaan(p)}
                        className={`w-full flex items-center space-x-2.5 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span>{p}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Domisili & Pendidikan */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
              <MapPin className="w-4 h-4" />
              <span>Domisili & Pendidikan</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Domisili Kecamatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kecamatan (Kab. Malang)
                </label>
                <select
                  value={domisili}
                  onChange={e => setDomisili(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                >
                  <option value="">-- Pilih Kecamatan --</option>
                  {KECAMATAN_MALANG.map(k => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              {/* Alamat Detail */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Detail (Jalan / Desa / RT / RW)
                </label>
                <input
                  type="text"
                  value={alamatDetail}
                  onChange={e => setAlamatDetail(e.target.value)}
                  placeholder="Contoh: Jl. Raya Kepanjen No. 10"
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>

              {/* Pendidikan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tingkat Pendidikan Terakhir
                </label>
                <select
                  value={pendidikan}
                  onChange={e => setPendidikan(e.target.value as PendidikanType)}
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                >
                  {PENDIDIKAN_LIST.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Jurusan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jurusan / Program Studi
                </label>
                <input
                  type="text"
                  value={jurusan}
                  onChange={e => setJurusan(e.target.value)}
                  placeholder="Contoh: Teknik Informatika / Manajemen"
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>

              {/* Aktivitas Utama */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Aktivitas Utama / Kesibukan Saat Ini
                </label>
                <input
                  type="text"
                  value={aktivitas}
                  onChange={e => setAktivitas(e.target.value)}
                  placeholder="Contoh: Mahasiswa, Wirausaha, Karyawan, Freelancer"
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Keahlian & Hobi (With Live Auto-Suggestions) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
              <Award className="w-4 h-4" />
              <span>Keahlian & Hobi</span>
            </div>

            {/* Keahlian Tags & Auto-suggest Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Keahlian / Skill (Pilih dari saran atau ketik bebas lalu tekan Enter)
              </label>

              {/* Selected Tags */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {keahlian.map(s => (
                  <span
                    key={s}
                    className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1.5 font-semibold"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      className="hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (skillInput.trim()) addSkill(skillInput);
                    }
                  }}
                  placeholder="Ketik keahlian (misal: Videografi, MC, UI/UX)..."
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>

              {/* Suggestions Dropdown / Chips */}
              <div className="mt-2">
                <p className="text-[11px] text-slate-500 font-medium mb-1">Rekomendasi Keahlian:</p>
                <div className="flex flex-wrap gap-1.5">
                  {filteredSkillSuggestions.map(s => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => addSkill(s)}
                      className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs px-2 py-1 rounded-md transition-colors flex items-center space-x-1 font-medium"
                    >
                      <Plus className="w-3 h-3 text-emerald-600" />
                      <span>{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Hobi Tags & Auto-suggest Input */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Hobi & Minat (Pilih dari saran atau ketik bebas)
              </label>

              {/* Selected Hobi Tags */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {hobi.map(h => (
                  <span
                    key={h}
                    className="bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1.5 font-semibold"
                  >
                    <span>{h}</span>
                    <button
                      type="button"
                      onClick={() => removeHobi(h)}
                      className="hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={hobiInput}
                  onChange={e => setHobiInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (hobiInput.trim()) addHobi(hobiInput);
                    }
                  }}
                  placeholder="Ketik hobi (misal: Futsal, Hiking, Membaca)..."
                  className="w-full bg-white border border-slate-200 focus:border-rose-500 text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>

              {/* Hobi Suggestions */}
              <div className="mt-2">
                <p className="text-[11px] text-slate-500 font-medium mb-1">Rekomendasi Hobi:</p>
                <div className="flex flex-wrap gap-1.5">
                  {filteredHobiSuggestions.map(h => (
                    <button
                      type="button"
                      key={h}
                      onClick={() => addHobi(h)}
                      className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs px-2 py-1 rounded-md transition-colors flex items-center space-x-1 font-medium"
                    >
                      <Plus className="w-3 h-3 text-rose-600" />
                      <span>{h}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Sosial Media & Catatan */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
              <MessageSquare className="w-4 h-4" />
              <span>Media Sosial & Catatan Tambahan</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Instagram</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={e => setInstagram(e.target.value)}
                  placeholder="@username"
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">TikTok</label>
                <input
                  type="text"
                  value={tiktok}
                  onChange={e => setTiktok(e.target.value)}
                  placeholder="@username"
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Tambahan (Potensi / Rekomendasi / Keterangan Sekretariat)
              </label>
              <textarea
                value={catatanTambahan}
                onChange={e => setCatatanTambahan(e.target.value)}
                rows={3}
                placeholder="Catatan keaktifan, kesediaan penugasan, dll."
                className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none resize-none font-medium"
              />
            </div>
          </div>

          {/* Footer Submit Bar */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#F27D26] hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              {initialMember ? 'Simpan Perubahan' : 'Simpan Anggota Baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
