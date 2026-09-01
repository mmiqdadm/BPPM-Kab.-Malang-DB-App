import React, { useState, useEffect, useMemo } from 'react';
import { Member, OrganisasiType, PendidikanType, PembinaanType, JenjangPembinaanType } from '../types';
import {
  KECAMATAN_MALANG,
  SUGGESTED_SKILLS,
  SUGGESTED_HOBBIES,
  ORGANISASI_LIST,
  PENDIDIKAN_LIST,
  PEMBINAAN_LIST,
  JENJANG_PEMBINAAN_LIST,
} from '../data/constants';
import { calculateAge } from '../lib/utils';
import {
  getCustomSkills,
  saveCustomSkill,
  getCustomHobbies,
  saveCustomHobby,
  loadMembersFromLocal,
  getAllOrganizations,
} from '../lib/storage';
import { parseWhatsAppFormText, WA_FORM_TEMPLATE } from '../lib/waParser';
import { X, Check, Plus, Trash2, Calendar, User, Phone, Mail, MapPin, Briefcase, GraduationCap, Award, Heart, Sparkles, MessageSquare, AlertCircle, Copy, ArrowDown } from 'lucide-react';

interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>, editId?: string) => void;
  initialMember?: Member | Partial<Member> | null;
  adminName: string;
  existingMembers?: Member[];
}

interface DuplicateMatch {
  member: Member;
  reasons: string[];
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
  const [namaPanggilan, setNamaPanggilan] = useState('');
  const [isAnakKader, setIsAnakKader] = useState(false);
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
  const [pembinaan, setPembinaan] = useState<PembinaanType>('Belum Pernah');
  const [jenjangPembinaan, setJenjangPembinaan] = useState<JenjangPembinaanType>('Muda');
  const [namaPembina, setNamaPembina] = useState('');
  const [catatanTambahan, setCatatanTambahan] = useState('');
  const [allOrgs, setAllOrgs] = useState<string[]>(getAllOrganizations());

  const [errors, setErrors] = useState<{ nama?: string }>({});
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [pendingPayload, setPendingPayload] = useState<Omit<Member, 'id' | 'createdAt' | 'updatedAt'> | null>(null);

  // Quick WA Paste Drawer State inside Form
  const [showQuickWAPaste, setShowQuickWAPaste] = useState(false);
  const [quickWAText, setQuickWAText] = useState('');
  const [quickWACopied, setQuickWACopied] = useState(false);

  useEffect(() => {
    setAllOrgs(getAllOrganizations());
    setDuplicateMatches([]);
    setPendingPayload(null);
    setShowQuickWAPaste(false);
    setQuickWAText('');
    if (initialMember) {
      setNama(initialMember.nama || '');
      setNamaPanggilan(initialMember.namaPanggilan || '');
      setIsAnakKader(!!initialMember.isAnakKader);
      setNomorHp(initialMember.nomorHp || '');
      setOrganisasiInternal(initialMember.organisasiInternal || ['PKS Muda']);
      setTglLahir(initialMember.tglLahir || '2002-01-01');
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
      setPembinaan(initialMember.pembinaan || 'Belum Pernah');
      setJenjangPembinaan(initialMember.jenjangPembinaan || 'Muda');
      setNamaPembina(initialMember.namaPembina || '');
      setCatatanTambahan(initialMember.catatanTambahan || '');
    } else {
      // Default reset
      setNama('');
      setNamaPanggilan('');
      setIsAnakKader(false);
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
      setPembinaan('Belum Pernah');
      setJenjangPembinaan('Muda');
      setNamaPembina('');
      setCatatanTambahan('');
    }
    setErrors({});
  }, [initialMember, isOpen]);

  const handleCopyWATemplate = () => {
    navigator.clipboard.writeText(WA_FORM_TEMPLATE);
    setQuickWACopied(true);
    setTimeout(() => setQuickWACopied(false), 2500);
  };

  const handleApplyQuickWAPaste = () => {
    if (!quickWAText.trim()) return;
    const parsed = parseWhatsAppFormText(quickWAText);
    if (parsed.nama) setNama(parsed.nama);
    if (parsed.namaPanggilan) setNamaPanggilan(parsed.namaPanggilan);
    if (parsed.nomorHp) setNomorHp(parsed.nomorHp);
    if (parsed.tglLahir) setTglLahir(parsed.tglLahir);
    if (parsed.alamatDetail) setAlamatDetail(parsed.alamatDetail);
    if (parsed.domisili) setDomisili(parsed.domisili);
    if (parsed.pendidikan) setPendidikan(parsed.pendidikan);
    if (parsed.jurusan) setJurusan(parsed.jurusan);
    if (parsed.aktivitas) setAktivitas(parsed.aktivitas);
    if (parsed.keahlian && parsed.keahlian.length > 0) setKeahlian(parsed.keahlian);
    if (parsed.hobi && parsed.hobi.length > 0) setHobi(parsed.hobi);
    if (parsed.sosmed?.instagram) setInstagram(parsed.sosmed.instagram);
    if (parsed.sosmed?.tiktok) setTiktok(parsed.sosmed.tiktok);
    if (parsed.email) setEmail(parsed.email);
    if (parsed.organisasiInternal && parsed.organisasiInternal.length > 0) setOrganisasiInternal(parsed.organisasiInternal);
    if (parsed.pembinaan) setPembinaan(parsed.pembinaan);
    if (parsed.jenjangPembinaan) setJenjangPembinaan(parsed.jenjangPembinaan);
    if (parsed.namaPembina) setNamaPembina(parsed.namaPembina);
    if (parsed.catatanTambahan) setCatatanTambahan(parsed.catatanTambahan);
    setShowQuickWAPaste(false);
    setQuickWAText('');
  };

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
      namaPanggilan: namaPanggilan.trim() || undefined,
      isAnakKader,
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
      jenjangPembinaan: pembinaan === 'Sudah' ? jenjangPembinaan : undefined,
      namaPembina: pembinaan === 'Sudah' && namaPembina.trim() ? namaPembina.trim() : undefined,
      catatanTambahan: catatanTambahan.trim(),
      createdBy: initialMember?.createdBy || adminName,
    };

    // Check duplicate Nama Lengkap or Nomor HP
    const membersList = existingMembers || loadMembersFromLocal();
    const cleanCurrentName = nama.trim().toLowerCase();
    const cleanCurrentHp = nomorHp.replace(/\D/g, '');

    const matches: DuplicateMatch[] = [];

    membersList.forEach(m => {
      if (initialMember && m.id === initialMember.id) return;

      const reasons: string[] = [];
      const mName = (m.nama || '').trim().toLowerCase();
      const mHp = (m.nomorHp || '').replace(/\D/g, '');

      if (cleanCurrentName && mName === cleanCurrentName) {
        reasons.push('Nama Lengkap sama persis');
      }

      if (cleanCurrentHp.length >= 8 && mHp.length >= 8) {
        if (cleanCurrentHp === mHp || cleanCurrentHp.slice(-8) === mHp.slice(-8)) {
          reasons.push('Nomor HP / WhatsApp terdeteksi sama');
        }
      }

      if (reasons.length > 0) {
        matches.push({ member: m, reasons });
      }
    });

    if (matches.length > 0) {
      setDuplicateMatches(matches);
      setPendingPayload(payload);
      return;
    }

    try {
      onSave(payload, initialMember && 'id' in initialMember ? initialMember.id : undefined);
    } catch (err) {
      console.error('Error saving member:', err);
    } finally {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl relative my-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <User className="w-5 h-5 text-[#F27D26]" />
              <span>
                {initialMember && 'id' in initialMember && initialMember.id
                  ? 'Edit Data Anggota'
                  : initialMember?.nama
                  ? 'Review & Lengkapi Data Anggota (Dari Form WA)'
                  : 'Input Anggota Baru'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              BPPM PKS Kab. Malang
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowQuickWAPaste(!showQuickWAPaste)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center space-x-1.5 ${
                showQuickWAPaste
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white border-orange-200 text-[#F27D26] hover:bg-orange-50'
              }`}
              title="Tempel teks formulir WhatsApp untuk mengisi form secara otomatis"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Isi Cepat dari Teks WA</span>
              <span className="sm:hidden">Format WA</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Collapsible Quick WA Paste Panel */}
          {showQuickWAPaste && (
            <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border border-orange-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-orange-200/80 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#F27D26]" />
                  <span>Tempel Teks Balasan WA Calon Anggota</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyWATemplate}
                  className="text-[11px] font-semibold text-[#F27D26] hover:underline flex items-center space-x-1"
                >
                  {quickWACopied ? (
                    <span className="text-emerald-700 font-bold">✓ Template Tersalin</span>
                  ) : (
                    <span>Salin Format Template</span>
                  )}
                </button>
              </div>

              <textarea
                value={quickWAText}
                onChange={e => setQuickWAText(e.target.value)}
                rows={5}
                placeholder={`Tempel teks balasan WA anggota di sini...\n\nNama Lengkap : Ahmad Fauzi\nNo. HP (WA) : 081234567890\nEmail : fauzi@gmail.com\nTgl Lahir : 14/05/2001\nAlamat lengkap : Kepanjen, Malang\nPendidikan Terakhir/saat ini : S1`}
                className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-xs font-mono rounded-xl p-3 outline-none resize-none font-medium"
              />

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickWAPaste(false);
                    setQuickWAText('');
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={!quickWAText.trim()}
                  onClick={handleApplyQuickWAPaste}
                  className="px-4 py-1.5 bg-[#F27D26] hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center space-x-1.5"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Terapkan ke Form di Bawah</span>
                </button>
              </div>
            </div>
          )}

          {/* Section 1: Data Identitas Utama */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-[#F27D26] uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
              <User className="w-4 h-4" />
              <span>Identitas Utama</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nama Lengkap (Wajib) */}
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
                  placeholder="Contoh: Ahmad Fauzi Pratama"
                  className={`w-full bg-white border ${
                    errors.nama ? 'border-red-500' : 'border-slate-200'
                  } focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium`}
                  required
                />
                {errors.nama && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.nama}</p>}
              </div>

              {/* Nama Panggilan (Opsional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Panggilan
                </label>
                <input
                  type="text"
                  value={namaPanggilan}
                  onChange={e => setNamaPanggilan(e.target.value)}
                  placeholder="Contoh: Fauzi"
                  className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-sm rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
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

              {/* Checkbox: Anak Kader */}
              <div className="md:col-span-2 pt-1">
                <label className="flex items-center space-x-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-orange-300 transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={isAnakKader}
                    onChange={e => setIsAnakKader(e.target.checked)}
                    className="w-4 h-4 text-[#F27D26] rounded border-slate-300 focus:ring-[#F27D26] accent-[#F27D26]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <span>👑 Anak Kader (Putra / Putri dari Kader PKS)</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Centang opsi ini jika anggota merupakan anak atau keluarga inti dari kader PKS
                    </span>
                  </div>
                </label>
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
                  {allOrgs.map(org => {
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
                        <span className="truncate mr-1">{org}</span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
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

                {/* Inputan Bersyarat Khusus Status Pembinaan "Sudah" */}
                {pembinaan === 'Sudah' && (
                  <div className="mt-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3 animate-in fade-in duration-200">
                    <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center space-x-1.5 border-b border-amber-200/80 pb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Detail Pembinaan Kader</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Jenjang <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={jenjangPembinaan}
                          onChange={e => setJenjangPembinaan(e.target.value as JenjangPembinaanType)}
                          className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-xs font-medium rounded-lg p-2.5 outline-none"
                        >
                          {JENJANG_PEMBINAAN_LIST.map(j => (
                            <option key={j} value={j}>
                              {j}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nama Pembina
                        </label>
                        <input
                          type="text"
                          value={namaPembina}
                          onChange={e => setNamaPembina(e.target.value)}
                          placeholder="Nama Pembina / Mentor"
                          className="w-full bg-white border border-slate-200 focus:border-[#F27D26] text-slate-900 text-xs font-medium rounded-lg p-2.5 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
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
              {initialMember && 'id' in initialMember && initialMember.id
                ? 'Simpan Perubahan'
                : 'Simpan Anggota Baru'}
            </button>
          </div>
        </form>

        {/* Duplicate Data Warning Confirmation Modal */}
        {duplicateMatches.length > 0 && (
          <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 my-auto">
              <div className="flex items-start space-x-3 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-slate-900 text-base">
                    Peringatan: Kemungkinan Duplikat!
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Sistem mendeteksi ada anggota dengan Nama atau Nomor HP yang sama di database:
                  </p>
                </div>
              </div>

              {/* List of Matched Duplicates */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {duplicateMatches.map((dm, idx) => (
                  <div
                    key={idx}
                    className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {dm.member.nama} {dm.member.namaPanggilan ? `(${dm.member.namaPanggilan})` : ''}
                      </span>
                      <span className="text-[10px] bg-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                        Kec. {dm.member.domisili}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <p>📱 HP / WA: <span className="font-semibold text-slate-800">{dm.member.nomorHp || '-'}</span></p>
                      <p>🏷️ Organisasi: <span className="font-semibold text-slate-800">{(dm.member.organisasiInternal || []).join(', ')}</span></p>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1 border-t border-amber-200/60">
                      {dm.reasons.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="bg-red-100 text-red-700 font-bold text-[10px] px-2 py-0.5 rounded-md"
                        >
                          ⚠️ {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-600 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                Apakah Anda yakin ingin tetap menyimpan data anggota ini ke dalam database?
              </p>

              <div className="flex items-center justify-end space-x-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateMatches([]);
                    setPendingPayload(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  Batal & Periksa Kembali
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingPayload) {
                      try {
                        onSave(pendingPayload, initialMember && 'id' in initialMember ? initialMember.id : undefined);
                      } catch (err) {
                        console.error('Error saving member payload:', err);
                      }
                    }
                    setDuplicateMatches([]);
                    setPendingPayload(null);
                    onClose();
                  }}
                  className="px-5 py-2 bg-[#F27D26] hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  Ya, Tetap Simpan Data Ini
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
