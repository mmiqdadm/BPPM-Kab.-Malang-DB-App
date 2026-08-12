import React, { useState, useMemo } from 'react';
import { Member, FilterOptions, OrganisasiType, PembinaanType, PendidikanType, ActivityRatingLevel, EventItem, EventAttendance } from '../types';
import { calculateAge, formatWhatsAppLink, formatDateIndonesian, getActivityRating } from '../lib/utils';
import { KECAMATAN_MALANG, ORGANISASI_LIST, PENDIDIKAN_LIST, PEMBINAAN_LIST } from '../data/constants';
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
}) => {
  const [search, setSearch] = useState(externalSearchTerm || '');

  React.useEffect(() => {
    if (externalSearchTerm !== undefined) {
      setSearch(externalSearchTerm);
    }
  }, [externalSearchTerm]);
  const [selectedOrgs, setSelectedOrgs] = useState<OrganisasiType[]>([]);
  const [selectedPembinaan, setSelectedPembinaan] = useState<PembinaanType | 'Semua'>('Semua');
  const [selectedPendidikan, setSelectedPendidikan] = useState<PendidikanType | 'Semua'>('Semua');
  const [selectedKeaktifan, setSelectedKeaktifan] = useState<ActivityRatingLevel | 'Semua'>('Semua');
  const [selectedDomisili, setSelectedDomisili] = useState<string>('Semua');
  const [minAge, setMinAge] = useState<number | ''>('');
  const [maxAge, setMaxAge] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<FilterOptions['sortBy']>('terbaru');

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

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
    setSelectedPendidikan('Semua');
    setSelectedKeaktifan('Semua');
    setSelectedDomisili('Semua');
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
          const matchHp = m.nomorHp.toLowerCase().includes(q);
          const matchDom = m.domisili.toLowerCase().includes(q);
          const matchEdu = m.pendidikan.toLowerCase().includes(q);
          const matchJur = m.jurusan.toLowerCase().includes(q);
          const matchAkt = m.aktivitas.toLowerCase().includes(q);
          const matchSkills = (m.keahlian || []).some(s => s.toLowerCase().includes(q));
          const matchHobbies = (m.hobi || []).some(h => h.toLowerCase().includes(q));
          if (
            !matchName &&
            !matchHp &&
            !matchDom &&
            !matchEdu &&
            !matchJur &&
            !matchAkt &&
            !matchSkills &&
            !matchHobbies
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

        // Domisili filter
        if (selectedDomisili !== 'Semua' && m.domisili !== selectedDomisili) {
          return false;
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
    selectedPendidikan,
    selectedKeaktifan,
    selectedDomisili,
    minAge,
    maxAge,
    sortBy,
    memberEventCounts,
  ]);

  // Reset to page 1 on filter/search change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedOrgs, selectedPembinaan, selectedPendidikan, selectedKeaktifan, selectedDomisili, minAge, maxAge, sortBy, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedMembers.length / pageSize) || 1;
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedMembers.slice(start, start + pageSize);
  }, [filteredAndSortedMembers, currentPage, pageSize]);

  const activeFilterCount =
    selectedOrgs.length +
    (selectedPembinaan !== 'Semua' ? 1 : 0) +
    (selectedPendidikan !== 'Semua' ? 1 : 0) +
    (selectedKeaktifan !== 'Semua' ? 1 : 0) +
    (selectedDomisili !== 'Semua' ? 1 : 0) +
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
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-50 text-slate-800 border border-slate-200 text-xs rounded-xl px-2.5 py-2 outline-none focus:border-[#F27D26] font-medium shrink-0"
            >
              <option value="terbaru">Sort: Input Terbaru</option>
              <option value="keaktifan_desc">Sort: Keaktifan Event</option>
              <option value="nama_asc">Sort: Nama (A - Z)</option>
              <option value="nama_desc">Sort: Nama (Z - A)</option>
              <option value="usia_asc">Sort: Usia (Muda → Tua)</option>
              <option value="usia_desc">Sort: Usia (Tua → Muda)</option>
            </select>

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
          </div>
        </div>

        {/* Expanded Filter Panel */}
        {showFilterDrawer && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 pt-3 mt-1">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-[#F27D26] uppercase tracking-wider">
                Filter Multi Angle
              </span>
              <button onClick={resetFilters} className="text-[11px] text-slate-500 hover:text-slate-800 font-medium">
                Reset Semua
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Organisasi Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organisasi Internal
                </label>
                <div className="flex flex-wrap gap-1">
                  {ORGANISASI_LIST.map(org => {
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

              {/* Status Keaktifan Event */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keaktifan Event
                </label>
                <select
                  value={selectedKeaktifan}
                  onChange={e => setSelectedKeaktifan(e.target.value as any)}
                  className="w-full bg-white text-slate-800 border border-slate-200 text-xs rounded-lg p-1.5 outline-none font-medium"
                >
                  <option value="Semua">Semua Keaktifan</option>
                  <option value="Sangat Aktif">⭐ Sangat Aktif (6+ Event)</option>
                  <option value="Aktif">⭐ Aktif (3-5 Event)</option>
                  <option value="Cukup Aktif">⭐ Cukup Aktif (1-2 Event)</option>
                  <option value="Pasif">⚪ Pasif (0 Event)</option>
                </select>
              </div>

              {/* Status Pembinaan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pembinaan
                </label>
                <select
                  value={selectedPembinaan}
                  onChange={e => setSelectedPembinaan(e.target.value as any)}
                  className="w-full bg-white text-slate-800 border border-slate-200 text-xs rounded-lg p-1.5 outline-none font-medium"
                >
                  <option value="Semua">Semua Pembinaan</option>
                  {PEMBINAAN_LIST.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Domisili Kecamatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kecamatan
                </label>
                <select
                  value={selectedDomisili}
                  onChange={e => setSelectedDomisili(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 text-xs rounded-lg p-1.5 outline-none font-medium"
                >
                  <option value="Semua">Semua Kecamatan</option>
                  {KECAMATAN_MALANG.map(k => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
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
                          className="font-bold text-slate-900 hover:text-[#F27D26] cursor-pointer text-xs"
                        >
                          {m.nama}
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
                        <div className="font-semibold text-slate-800">Kec. {m.domisili || '-'}</div>
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
                          <button
                            onClick={() => onEditMember(m)}
                            className="p-1 text-slate-400 hover:text-[#F27D26] hover:bg-slate-100 rounded"
                            title="Edit Data"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => exportSingleMemberCardPDF(m)}
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded"
                            title="Download PDF Card"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteMember(m.id, m.nama)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                        className="font-extrabold text-slate-900 text-xs sm:text-sm hover:text-[#F27D26] cursor-pointer truncate"
                      >
                        {m.nama}
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
                      <span className="font-bold text-slate-900">
                        Kec. {m.domisili || '-'} {age > 0 ? `(${age} th)` : ''}
                      </span>
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
