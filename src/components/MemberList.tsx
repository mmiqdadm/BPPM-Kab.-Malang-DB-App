import React, { useState, useMemo, useEffect } from 'react';
import { Member, FilterOptions, OrganisasiType, PembinaanType, PendidikanType, ActivityRatingLevel, EventItem, EventAttendance, JenjangPembinaanType } from '../types';
import { calculateAge, formatWhatsAppLink, formatDateIndonesian, getActivityRating, getDapilByKecamatan } from '../lib/utils';
import { KECAMATAN_MALANG, ORGANISASI_LIST, PENDIDIKAN_LIST, PEMBINAAN_LIST, DAPIL_MALANG, DAPIL_LIST, JENJANG_PEMBINAAN_LIST } from '../data/constants';
import { getAllOrganizations } from '../lib/storage';
import { exportMembersToExcel, exportMembersToPDF, exportSingleMemberCardPDF } from '../lib/export';
import {
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  UserPlus,
  Phone,
  Eye,
  Pencil,
  Trash2,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  Sparkles,
  ExternalLink,
  Star,
  CalendarCheck,
  ArrowUpDown,
} from 'lucide-react';

interface MemberListProps {
  members: Member[];
  events?: EventItem[];
  attendances?: EventAttendance[];
  onOpenAddMember: () => void;
  onOpenBulkImport: () => void;
  onViewMember: (m: Member) => void;
  onEditMember: (m: Member) => void;
  onDeleteMember: (id: string, nama: string) => void;
  externalSearchTerm?: string;
  canEdit?: boolean;
}

export const MemberList: React.FC<MemberListProps> = ({
  members,
  events = [],
  attendances = [],
  onOpenAddMember,
  onOpenBulkImport,
  onViewMember,
  onEditMember,
  onDeleteMember,
  externalSearchTerm,
  canEdit = true,
}) => {
  const [search, setSearch] = useState(externalSearchTerm || '');

  React.useEffect(() => {
    if (externalSearchTerm !== undefined) {
      setSearch(externalSearchTerm);
    }
  }, [externalSearchTerm]);
  const [selectedOrgs, setSelectedOrgs] = useState<OrganisasiType[]>([]);
  const [selectedPembinaan, setSelectedPembinaan] = useState<PembinaanType | 'Semua'>('Semua');
  const [selectedJenjang, setSelectedJenjang] = useState<JenjangPembinaanType | 'Semua'>('Semua');
  const [selectedPendidikan, setSelectedPendidikan] = useState<PendidikanType | 'Semua'>('Semua');
  const [selectedKeaktifan, setSelectedKeaktifan] = useState<ActivityRatingLevel | 'Semua'>('Semua');
  const [selectedAnakKader, setSelectedAnakKader] = useState<'Semua' | 'ya' | 'bukan'>('Semua');
  const [selectedDapil, setSelectedDapil] = useState<string>('Semua');
  const [selectedDomisili, setSelectedDomisili] = useState<string>('Semua');
  const [selectedEventId, setSelectedEventId] = useState<string>('Semua');
  const [minAge, setMinAge] = useState<number | ''>('');
  const [maxAge, setMaxAge] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<FilterOptions['sortBy']>('terbaru');

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [allOrgs, setAllOrgs] = useState<string[]>(getAllOrganizations());

  useEffect(() => {
    const updateOrgs = () => setAllOrgs(getAllOrganizations());
    window.addEventListener('pks_tags_updated', updateOrgs);
    return () => window.removeEventListener('pks_tags_updated', updateOrgs);
  }, []);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Calculate event count per member name / member ID
  const memberEventCounts = useMemo(() => {
    const counts = new Map<string, number>();

    attendances.forEach(att => {
      if (att.memberId) {
        counts.set(att.memberId, (counts.get(att.memberId) || 0) + 1);
      }
      const nameKey = att.namaPeserta.toLowerCase().trim();
      counts.set(`name_${nameKey}`, (counts.get(`name_${nameKey}`) || 0) + 1);
    });

    return counts;
  }, [attendances]);

  const getMemberAttendanceCount = (m: Member): number => {
    const idCount = memberEventCounts.get(m.id) || 0;
    const nameCount = memberEventCounts.get(`name_${m.nama.toLowerCase().trim()}`) || 0;
    return Math.max(idCount, nameCount);
  };

  // Toggle Org filter
  const handleToggleOrg = (org: OrganisasiType) => {
    if (selectedOrgs.includes(org)) {
      setSelectedOrgs(selectedOrgs.filter(o => o !== org));
    } else {
      setSelectedOrgs([...selectedOrgs, org]);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedOrgs([]);
    setSelectedPembinaan('Semua');
    setSelectedJenjang('Semua');
    setSelectedPendidikan('Semua');
    setSelectedKeaktifan('Semua');
    setSelectedAnakKader('Semua');
    setSelectedDapil('Semua');
    setSelectedDomisili('Semua');
    setSelectedEventId('Semua');
    setMinAge('');
    setMaxAge('');
    setSortBy('terbaru');
    setCurrentPage(1);
  };

  // Filter & Sort Logic
  const filteredAndSortedMembers = useMemo(() => {
    return members
      .filter(m => {
        // Search term matching
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = m.nama.toLowerCase().includes(q);
          const matchNickname = (m.namaPanggilan || '').toLowerCase().includes(q);
          const matchHp = m.nomorHp.toLowerCase().includes(q);
          const matchDom = m.domisili.toLowerCase().includes(q);
          const matchEdu = m.pendidikan.toLowerCase().includes(q);
          const matchJur = m.jurusan.toLowerCase().includes(q);
          const matchAkt = m.aktivitas.toLowerCase().includes(q);
          const matchSkills = (m.keahlian || []).some(s => s.toLowerCase().includes(q));
          const matchHobbies = (m.hobi || []).some(h => h.toLowerCase().includes(q));
          const matchPembina = (m.namaPembina || '').toLowerCase().includes(q);
          if (
            !matchName &&
            !matchNickname &&
            !matchHp &&
            !matchDom &&
            !matchEdu &&
            !matchJur &&
            !matchAkt &&
            !matchSkills &&
            !matchHobbies &&
            !matchPembina
          ) {
            return false;
          }
        }

        // Organisasi filter
        if (selectedOrgs.length > 0) {
          const hasOrg = (m.organisasiInternal || []).some(o => selectedOrgs.includes(o));
          if (!hasOrg) return false;
        }

        // Pembinaan filter
        if (selectedPembinaan !== 'Semua' && m.pembinaan !== selectedPembinaan) {
          return false;
        }

        // Jenjang Pembinaan filter (Hanya relevan jika pembinaan 'Sudah')
        if (selectedJenjang !== 'Semua') {
          if (m.pembinaan !== 'Sudah' || (m.jenjangPembinaan || 'Muda') !== selectedJenjang) {
            return false;
          }
        }

        // Pendidikan filter
        if (selectedPendidikan !== 'Semua' && m.pendidikan !== selectedPendidikan) {
          return false;
        }

        // Keaktifan filter
        if (selectedKeaktifan !== 'Semua') {
          const count = getMemberAttendanceCount(m);
          const rating = getActivityRating(count);
          if (rating.level !== selectedKeaktifan) return false;
        }

        // Dapil filter
        if (selectedDapil !== 'Semua') {
          const dapilKecamatans = DAPIL_MALANG[selectedDapil] || [];
          const matchDapil = dapilKecamatans.some(
            k => k.toLowerCase() === (m.domisili || '').toLowerCase().trim()
          );
          if (!matchDapil) return false;
        }

        // Domisili filter
        if (selectedDomisili !== 'Semua' && m.domisili !== selectedDomisili) {
          return false;
        }

        // Anak Kader filter
        if (selectedAnakKader !== 'Semua') {
          if (selectedAnakKader === 'ya' && !m.isAnakKader) return false;
          if (selectedAnakKader === 'bukan' && m.isAnakKader) return false;
        }

        // Event filter (Pernah mengikuti event tertentu)
        if (selectedEventId !== 'Semua') {
          const memberNameClean = m.nama.toLowerCase().trim();
          const hasAttended = attendances.some(
            att =>
              att.eventId === selectedEventId &&
              (att.memberId === m.id || att.namaPeserta.toLowerCase().trim() === memberNameClean)
          );
          if (!hasAttended) return false;
        }

        // Age Filter
        const age = calculateAge(m.tglLahir);
        if (minAge !== '' && age < Number(minAge)) return false;
        if (maxAge !== '' && age > Number(maxAge)) return false;

        return true;
      })
      .sort((a, b) => {
        const ageA = calculateAge(a.tglLahir);
        const ageB = calculateAge(b.tglLahir);
        const countA = getMemberAttendanceCount(a);
        const countB = getMemberAttendanceCount(b);

        if (sortBy === 'keaktifan_desc') return countB - countA;
        if (sortBy === 'nama_asc') return a.nama.localeCompare(b.nama);
        if (sortBy === 'nama_desc') return b.nama.localeCompare(a.nama);
        if (sortBy === 'usia_asc') return ageA - ageB;
        if (sortBy === 'usia_desc') return ageB - ageA;
        if (sortBy === 'terlama') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'pendidikan') {
          const order = PENDIDIKAN_LIST;
          return order.indexOf(a.pendidikan) - order.indexOf(b.pendidikan);
        }
        // Default: terbaru
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [
    members,
    search,
    selectedOrgs,
    selectedPembinaan,
    selectedJenjang,
    selectedPendidikan,
    selectedKeaktifan,
    selectedAnakKader,
    selectedDapil,
    selectedDomisili,
    selectedEventId,
    minAge,
    maxAge,
    sortBy,
    memberEventCounts,
    attendances,
  ]);

  // Reset to page 1 on filter/search change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    selectedOrgs,
    selectedPembinaan,
    selectedJenjang,
    selectedPendidikan,
    selectedKeaktifan,
    selectedAnakKader,
    selectedDapil,
    selectedDomisili,
    selectedEventId,
    minAge,
    maxAge,
    sortBy,
    pageSize,
  ]);

  const totalPages = Math.ceil(filteredAndSortedMembers.length / pageSize) || 1;
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedMembers.slice(start, start + pageSize);
  }, [filteredAndSortedMembers, currentPage, pageSize]);

  const activeFilterCount =
    selectedOrgs.length +
    (selectedPembinaan !== 'Semua' ? 1 : 0) +
    (selectedJenjang !== 'Semua' ? 1 : 0) +
    (selectedPendidikan !== 'Semua' ? 1 : 0) +
    (selectedKeaktifan !== 'Semua' ? 1 : 0) +
    (selectedAnakKader !== 'Semua' ? 1 : 0) +
    (selectedDapil !== 'Semua' ? 1 : 0) +
    (selectedDomisili !== 'Semua' ? 1 : 0) +
    (selectedEventId !== 'Semua' ? 1 : 0) +
    (minAge !== '' ? 1 : 0) +
    (maxAge !== '' ? 1 : 0);

  return (
    <div className="space-y-4 text-slate-800">
      {/* Search & Actions Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Main Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, nomor HP, keahlian, hobi, domisili..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#F27D26] focus:bg-white text-slate-900 text-xs sm:text-sm rounded-xl pl-9 pr-9 py-2 outline-none transition-colors font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort & Filter Controls */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shrink-0 focus-within:border-[#F27D26]">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#F27D26] shrink-0" />
              <label htmlFor="member-sort-select" className="text-xs font-bold text-slate-700 hidden sm:inline">
                Sort:
              </label>
              <select
                id="member-sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-800 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="terbaru">🕒 Input Terbaru</option>
                <option value="terlama">⌛ Input Terlama</option>
                <option value="nama_asc">🔤 Nama (A → Z)</option>
                <option value="nama_desc">🔤 Nama (Z → A)</option>
                <option value="usia_asc">👶 Usia (Termuda → Tertua)</option>
                <option value="usia_desc">👴 Usia (Tertua → Termuda)</option>
                <option value="keaktifan_desc">⭐ Keaktifan Event Terbanyak</option>
                <option value="pendidikan">🎓 Tingkat Pendidikan</option>
              </select>
            </div>

            <button
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className={`flex items-center space-x-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
                activeFilterCount > 0
                  ? 'bg-orange-50 border-orange-200 text-[#F27D26]'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="bg-[#F27D26] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Export & Primary Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
            <span>
              Tampil <strong className="text-slate-900">{filteredAndSortedMembers.length}</strong> /{' '}
              <strong className="text-slate-900">{members.length}</strong> Anggota
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-[#F27D26] hover:underline text-xs ml-1 font-bold"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => exportMembersToExcel(filteredAndSortedMembers)}
              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1"
              title="Download Excel Spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>

            <button
              onClick={() => exportMembersToPDF(filteredAndSortedMembers)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1"
              title="Download Laporan PDF"
            >
              <FileText className="w-3.5 h-3.5 text-[#F27D26]" />
              <span>PDF</span>
            </button>

            {canEdit && (
              <>
                <button
                  onClick={onOpenBulkImport}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Import</span>
                </button>

                <button
                  onClick={onOpenAddMember}
                  className="bg-[#F27D26] hover:bg-orange-600 text-white text-[11px] font-bold px-3 py-1 rounded-lg shadow-xs transition-all flex items-center space-x-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Input</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Expanded Filter Panel */}
        {showFilterDrawer && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 pt-3 mt-1">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-[#F27D26] uppercase tracking-wider">
                Filter Multi Angle Database
              </span>
              <button onClick={resetFilters} className="text-[11px] text-slate-500 hover:text-slate-800 font-medium">
                Reset Semua Filter
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
              {/* 1. Organisasi Filter */}
              <div className="sm:col-span-2 md:col-span-3 lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organisasi Internal
                </label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {allOrgs.map(org => {
                    const active = selectedOrgs.includes(org);
                    return (
                      <button
                        key={org}
                        type="button"
                        onClick={() => handleToggleOrg(org)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                          active
                            ? 'bg-[#F27D26] border-[#F27D26] text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {org}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Filter Dapil (Daerah Pemilihan) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dapil (Wilayah)
                </label>
                <select
                  value={selectedDapil}
                  onChange={e => {
                    setSelectedDapil(e.target.value);
                    setSelectedDomisili('Semua'); // reset specific kecamatan when dapil changes
                  }}
                  className="w-full bg-white text-slate-800 border border-slate-200 text-xs rounded-lg p-2 outline-none font-medium focus:border-[#F27D26]"
                >
                  <option value="Semua">Semua Dapil (1 - 7)</option>
                  {DAPIL_LIST.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Domisili Kecamatan (Filtered by selected Dapil) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kecamatan {selectedDapil !== 'Semua' ? `(${selectedDapil})` : ''}
                </label>
                <select
                  value={selectedDomisili}
                  onChange={e => setSelectedDomisili(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 text-xs rounded-lg p-2 outline-none font-medium focus:border-[#F27D26]"
                >
                  <option value="Semua">
                    {selectedDapil !== 'Semua' ? `Semua di ${selectedDapil}` : 'Semua Kecamatan'}
                  </option>
                  {(selectedDapil !== 'Semua' ? DAPIL_MALANG[selectedDapil] || [] : KECAMATAN_MALANG).map(k => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Filter Event Yang Pernah Diikuti */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Event Diikuti
                </label>
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 text-xs rounded-lg p-2 outline-none font-medium focus:border-[#F27D26]"
                >
                  <option value="Semua">Semua Event</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.namaEvent}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Status Pembinaan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Pembinaan
                </label>
                <select
                  value={selectedPembinaan}
                  onChange={e => setSelectedPembinaan(e.target.value as any)}
                  className="w-full bg-white text-slate-800 border border-slate-200 text-xs rounded-lg p-2 outline-none font-medium focus:border-[#F27D26]"
                >
                  <option value="Semua">Semua Pembinaan</option>
                  {PEMBINAAN_LIST.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Filter Jenjang Pembinaan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenjang Pembinaan
                </label>
                <select
                  value={selectedJenjang}
                  onChange={e => setSelectedJenjang(e.target.value as any)}
                  className="w-full bg-white text-slate-800 border border-slate-200 text-xs rounded-lg p-2 outline-none font-medium focus:border-[#F27D26]"
                >
                  <option value="Semua">Semua Jenjang</option>
                  {JENJANG_PEMBINAAN_LIST.map(j => (
                    <option key={j} value={j}>
                      Jenjang {j}
                    </option>
                  ))}
                </select>
              </div>

              {/* 7. Status Keaktifan Event */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keaktifan Presensi
                </label>
                <select
                  value={selectedKeaktifan}
                  onChange={e => setSelectedKeaktifan(e.target.value as any)}
                  className="w-full bg-white text-slate-800 border border-slate-200 text-xs rounded-lg p-2 outline-none font-medium focus:border-[#F27D26]"
                >
                  <option value="Semua">Semua Keaktifan</option>
                  <option value="Sangat Aktif">⭐ Sangat Aktif (6+)</option>
                  <option value="Aktif">⭐ Aktif (3-5)</option>
                  <option value="Cukup Aktif">⭐ Cukup Aktif (1-2)</option>
                  <option value="Pasif">⚪ Pasif (0)</option>
                </select>
              </div>

              {/* 8. Status Anak Kader */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Anak Kader
                </label>
                <select
                  value={selectedAnakKader}
                  onChange={e => setSelectedAnakKader(e.target.value as any)}
                  className="w-full bg-white text-slate-800 border border-slate-200 text-xs rounded-lg p-2 outline-none font-medium focus:border-[#F27D26]"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="ya">👑 Anak Kader</option>
                  <option value="bukan">Bukan Anak Kader</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Database Table & Mobile Compact List */}
      {filteredAndSortedMembers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 space-y-2 shadow-xs">
          <p className="text-sm font-semibold text-slate-800">Tidak ada anggota yang cocok dengan filter.</p>
          <button
            onClick={resetFilters}
            className="mt-1 inline-flex items-center px-3 py-1.5 bg-slate-100 text-[#F27D26] text-xs font-bold rounded-xl"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">Nama Lengkap & Usia</th>
                  <th className="py-2.5 px-3">Keaktifan Event</th>
                  <th className="py-2.5 px-3">Organisasi Internal</th>
                  <th className="py-2.5 px-3">No HP / WA</th>
                  <th className="py-2.5 px-3">Domisili & Pendidikan</th>
                  <th className="py-2.5 px-3">Aktivitas Utama</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {paginatedMembers.map((m, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const age = calculateAge(m.tglLahir);
                  const waLink = formatWhatsAppLink(m.nomorHp);
                  const attCount = getMemberAttendanceCount(m);
                  const rating = getActivityRating(attCount, events.length);

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        {globalIdx}
                      </td>

                      <td className="py-2.5 px-3">
                        <div
                          onClick={() => onViewMember(m)}
                          className="font-bold text-slate-900 hover:text-[#F27D26] cursor-pointer text-xs flex items-center gap-1.5 flex-wrap"
                        >
                          <span>{m.nama}</span>
                          {m.namaPanggilan && (
                            <span className="text-[10px] font-semibold text-[#F27D26] bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200">
                              {m.namaPanggilan}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {m.tglLahir ? formatDateIndonesian(m.tglLahir) : '-'}{' '}
                          {age > 0 && <span className="text-amber-600 font-semibold">({age} th)</span>}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center space-x-1 border text-[10px] font-bold px-2 py-0.5 rounded-full ${rating.badgeClass}`}
                          >
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{rating.level}</span>
                          </span>
                          <div className="text-[10px] font-semibold text-slate-500 flex items-center space-x-1">
                            <span>Score: {rating.score}/100</span>
                            <span className="text-slate-300">•</span>
                            <span>{attCount} Event</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(m.organisasiInternal || []).map(org => (
                            <span
                              key={org}
                              className="bg-orange-50 text-[#F27D26] border border-orange-200 text-[10px] font-bold px-1.5 py-0.2 rounded-md"
                            >
                              {org}
                            </span>
                          ))}
                          {m.isAnakKader && (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                              👑 Anak Kader
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        {m.nomorHp ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-emerald-600 font-semibold"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{m.nomorHp}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span>Kec. {m.domisili || '-'}</span>
                          {getDapilByKecamatan(m.domisili) && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0">
                              {getDapilByKecamatan(m.domisili)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {m.pendidikan} {m.jurusan ? `(${m.jurusan})` : ''}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 max-w-[150px]">
                        <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold px-2 py-0.5 rounded-md truncate max-w-full">
                          {m.aktivitas || 'Belum Diisi'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => onViewMember(m)}
                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="Lihat Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => onEditMember(m)}
                              className="p-1 text-slate-400 hover:text-[#F27D26] hover:bg-slate-100 rounded"
                              title="Edit Data"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => exportSingleMemberCardPDF(m)}
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded"
                            title="Download PDF Card"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => onDeleteMember(m.id, m.nama)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Distinct Card Layout with Clear Separators */}
          <div className="md:hidden space-y-3 p-2 bg-slate-50/80 rounded-2xl text-xs">
            {paginatedMembers.map((m, idx) => {
              const globalIdx = (currentPage - 1) * pageSize + idx + 1;
              const age = calculateAge(m.tglLahir);
              const waLink = formatWhatsAppLink(m.nomorHp);
              const attCount = getMemberAttendanceCount(m);
              const rating = getActivityRating(attCount, events.length);
              const dapil = getDapilByKecamatan(m.domisili);

              return (
                <div
                  key={m.id}
                  className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5 transition-all hover:border-orange-300 relative"
                >
                  {/* Top Bar: Name + Score Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                        {globalIdx}
                      </span>
                      <h4
                        onClick={() => onViewMember(m)}
                        className="font-extrabold text-slate-900 text-xs sm:text-sm hover:text-[#F27D26] cursor-pointer truncate flex items-center gap-1.5"
                      >
                        <span>{m.nama}</span>
                        {m.namaPanggilan && (
                          <span className="text-[10px] font-semibold text-[#F27D26] bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200 shrink-0">
                            {m.namaPanggilan}
                          </span>
                        )}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center space-x-1 ${rating.badgeClass}`}
                      >
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        <span>{rating.level} ({rating.score})</span>
                      </span>
                    </div>
                  </div>

                  {/* Grid Details */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80 text-[11px] font-medium text-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Domisili & Usia</span>
                      <span className="font-bold text-slate-900 block">
                        Kec. {m.domisili || '-'} {dapil ? `(${dapil})` : ''}
                      </span>
                      {age > 0 && <span className="text-[10px] text-amber-600 font-semibold">{age} Tahun</span>}
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Aktivitas Utama</span>
                      <span className="font-bold text-blue-700 truncate block">
                        {m.aktivitas || 'Belum Diisi'}
                      </span>
                    </div>
                  </div>

                  {/* Organisasi Badges + Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex flex-wrap gap-1">
                      {(m.organisasiInternal || []).map(org => (
                        <span
                          key={org}
                          className="bg-orange-50 text-[#F27D26] border border-orange-200 text-[10px] font-bold px-1.5 py-0.2 rounded-md"
                        >
                          {org}
                        </span>
                      ))}
                      {m.isAnakKader && (
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                          👑 Anak Kader
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {m.nomorHp && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-lg flex items-center space-x-1 transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          <span>WA</span>
                        </a>
                      )}

                      <button
                        onClick={() => onViewMember(m)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        Detail
                      </button>

                      {canEdit && (
                        <>
                          <button
                            onClick={() => onEditMember(m)}
                            className="px-2 py-1 bg-[#F27D26] hover:bg-orange-600 text-white text-[10px] font-bold rounded-lg transition-colors"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => onDeleteMember(m.id, m.nama)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus Anggota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium">
            <div className="flex items-center space-x-2">
              <span>Tampilkan</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2 py-1 font-bold outline-none"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>baris per halaman</span>
              <span className="text-slate-400">|</span>
              <span>
                Menampilkan <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedMembers.length)}</strong> -{' '}
                <strong>{Math.min(currentPage * pageSize, filteredAndSortedMembers.length)}</strong> dari{' '}
                <strong>{filteredAndSortedMembers.length}</strong> anggota
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-300 rounded-lg font-bold flex items-center space-x-1 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center space-x-1 px-1 font-bold text-slate-800">
                <span>Halaman {currentPage}</span>
                <span className="text-slate-400">/</span>
                <span>{totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-300 rounded-lg font-bold flex items-center space-x-1 transition-colors"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
