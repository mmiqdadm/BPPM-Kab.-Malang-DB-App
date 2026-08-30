import React, { useState, useMemo, useEffect } from 'react';
import { EventItem, EventAttendance, Member, OrganisasiType } from '../types';
import { ORGANISASI_LIST, KECAMATAN_MALANG } from '../data/constants';
import { getAllOrganizations } from '../lib/storage';
import { formatDateIndonesian, formatWhatsAppLink } from '../lib/utils';
import {
  Calendar,
  MapPin,
  Clock,
  Plus,
  Users,
  Search,
  UserCheck,
  UserPlus,
  Phone,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  X,
  ChevronRight,
  Building2,
  Share2,
  AlertCircle,
} from 'lucide-react';

interface EventManagementProps {
  events: EventItem[];
  attendances: EventAttendance[];
  members: Member[];
  currentAdminName: string;
  onAddEvent: (data: Omit<EventItem, 'id' | 'createdAt'>) => void;
  onDeleteEvent: (id: string, nama: string) => void;
  onAddAttendance: (
    attData: Omit<EventAttendance, 'id' | 'waktuPresensi'>,
    isNewMemberAutoCreate: boolean,
    newMemberPayload?: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onDeleteAttendance?: (id: string, nama: string) => void;
}

export const EventManagement: React.FC<EventManagementProps> = ({
  events,
  attendances,
  members,
  currentAdminName,
  onAddEvent,
  onDeleteEvent,
  onAddAttendance,
  onDeleteAttendance,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    events.length > 0 ? events[0].id : null
  );
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isAddPresensiModalOpen, setIsAddPresensiModalOpen] = useState(false);
  const [isBulkPresensiModalOpen, setIsBulkPresensiModalOpen] = useState(false);
  const [allOrgs, setAllOrgs] = useState<string[]>(getAllOrganizations());

  useEffect(() => {
    const updateOrgs = () => setAllOrgs(getAllOrganizations());
    window.addEventListener('pks_tags_updated', updateOrgs);
    return () => window.removeEventListener('pks_tags_updated', updateOrgs);
  }, []);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'event' | 'attendance';
    id: string;
    nama: string;
  } | null>(null);

  const [eventSearch, setEventSearch] = useState('');
  const [eventOrgFilter, setEventOrgFilter] = useState<string>('Semua');
  const [eventSortBy, setEventSortBy] = useState<
    'terbaru' | 'terlama' | 'peserta_terbanyak' | 'paling_banyak_anggota_baru' | 'nama_az'
  >('terbaru');
  const [attendanceSearch, setAttendanceSearch] = useState('');

  // Bulk Presensi state
  const [bulkText, setBulkText] = useState('');
  const [isReviewingBulkPresensiDuplicates, setIsReviewingBulkPresensiDuplicates] = useState(false);
  const [bulkPresensiActions, setBulkPresensiActions] = useState<
    Record<number, 'link_existing' | 'add_new' | 'skip'>
  >({});

  // Form states for New Event
  const [newEventNama, setNewEventNama] = useState('');
  const [newEventWaktu, setNewEventWaktu] = useState('');
  const [newEventLokasi, setNewEventLokasi] = useState('');
  const [newEventOrg, setNewEventOrg] = useState<OrganisasiType>('PKS Muda');
  const [newEventDeskripsi, setNewEventDeskripsi] = useState('');

  // Form states for Presensi
  const [presensiNama, setPresensiNama] = useState('');
  const [presensiHp, setPresensiHp] = useState('');
  const [presensiDomisili, setPresensiDomisili] = useState('');
  const [presensiSosmed, setPresensiSosmed] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Selected event
  const activeEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || events[0] || null;
  }, [events, selectedEventId]);

  // Filtered and sorted events list
  const filteredEvents = useMemo(() => {
    let result = events.filter(e => {
      const q = eventSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        e.namaEvent.toLowerCase().includes(q) ||
        e.lokasi.toLowerCase().includes(q) ||
        e.organisasiHandling.toLowerCase().includes(q);

      const matchOrg =
        eventOrgFilter === 'Semua' || e.organisasiHandling === eventOrgFilter;

      return matchSearch && matchOrg;
    });

    result.sort((a, b) => {
      if (eventSortBy === 'terbaru') {
        return new Date(b.waktu).getTime() - new Date(a.waktu).getTime();
      } else if (eventSortBy === 'terlama') {
        return new Date(a.waktu).getTime() - new Date(b.waktu).getTime();
      } else if (eventSortBy === 'peserta_terbanyak') {
        const countA = attendances.filter(att => att.eventId === a.id).length;
        const countB = attendances.filter(att => att.eventId === b.id).length;
        return countB - countA;
      } else if (eventSortBy === 'paling_banyak_anggota_baru') {
        const newA = attendances.filter(att => att.eventId === a.id && !att.memberId).length;
        const newB = attendances.filter(att => att.eventId === b.id && !att.memberId).length;
        return newB - newA;
      } else if (eventSortBy === 'nama_az') {
        return a.namaEvent.localeCompare(b.namaEvent);
      }
      return 0;
    });

    return result;
  }, [events, eventSearch, eventOrgFilter, eventSortBy, attendances]);

  // Attendances for active event
  const activeEventAttendances = useMemo(() => {
    if (!activeEvent) return [];
    return attendances.filter(a => a.eventId === activeEvent.id);
  }, [attendances, activeEvent]);

  // Filtered attendances in active event list
  const filteredAttendances = useMemo(() => {
    return activeEventAttendances.filter(a => {
      const q = attendanceSearch.toLowerCase();
      return (
        a.namaPeserta.toLowerCase().includes(q) ||
        a.domisili.toLowerCase().includes(q) ||
        a.nomorHp.toLowerCase().includes(q) ||
        a.sosmed.toLowerCase().includes(q)
      );
    });
  }, [activeEventAttendances, attendanceSearch]);

  // Parse Bulk Presensi Text into structured preview rows
  const parsedBulkRows = useMemo(() => {
    if (!bulkText.trim()) return [];
    const lines = bulkText.split('\n');
    const result: Array<{
      nama: string;
      hp: string;
      domisili: string;
      sosmed: string;
      matchedMember: Member | null;
    }> = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const parts = trimmed.split(/\t|,|;|\|/).map(p => p.trim());
      if (parts.length === 0) return;

      const nama = parts[0] || '';
      if (!nama) return;

      const hp = parts[1] || '';
      const domisili = parts[2] || 'Kepanjen';
      const sosmed = parts[3] || '';

      const matchedMember =
        members.find(
          m => m.nama.toLowerCase().trim() === nama.toLowerCase().trim()
        ) || null;

      result.push({
        nama,
        hp,
        domisili,
        sosmed,
        matchedMember,
      });
    });

    return result;
  }, [bulkText, members]);

  const matchedBulkIndexes = useMemo(() => {
    return parsedBulkRows
      .map((row, idx) => ({ idx, row }))
      .filter(x => x.row.matchedMember != null);
  }, [parsedBulkRows]);

  const handleBulkPresensiSubmit = () => {
    if (!activeEvent || parsedBulkRows.length === 0) return;

    if (matchedBulkIndexes.length > 0 && !isReviewingBulkPresensiDuplicates) {
      const initial: Record<number, 'link_existing' | 'add_new' | 'skip'> = {};
      matchedBulkIndexes.forEach(x => {
        initial[x.idx] = 'link_existing';
      });
      setBulkPresensiActions(initial);
      setIsReviewingBulkPresensiDuplicates(true);
      return;
    }

    parsedBulkRows.forEach((row, idx) => {
      const action = matchedBulkIndexes.some(x => x.idx === idx)
        ? bulkPresensiActions[idx] || 'link_existing'
        : 'add_new';

      if (action === 'skip') return;

      const isNewMemberAutoCreate = action === 'add_new';
      let newMemberPayload: Omit<Member, 'id' | 'createdAt' | 'updatedAt'> | undefined;

      if (isNewMemberAutoCreate) {
        newMemberPayload = {
          nama: row.nama.trim(),
          nomorHp: row.hp.trim(),
          organisasiInternal: [activeEvent.organisasiHandling],
          tglLahir: '',
          sosmed: { instagram: row.sosmed.trim() },
          email: '',
          domisili: row.domisili || 'Kepanjen',
          alamatDetail: '',
          aktivitas: 'Peserta Event BPPM',
          pendidikan: 'S1',
          jurusan: '',
          keahlian: [],
          hobi: [],
          pembinaan: 'Belum Pernah',
          catatanTambahan: `Terdaftar otomatis via bulk import presensi: ${activeEvent.namaEvent}`,
        };
      }

      onAddAttendance(
        {
          eventId: activeEvent.id,
          memberId: (action === 'link_existing' && row.matchedMember) ? row.matchedMember.id : undefined,
          namaPeserta: row.nama.trim(),
          nomorHp: row.hp.trim(),
          domisili: row.domisili.trim() || 'Kepanjen',
          sosmed: row.sosmed.trim(),
        },
        isNewMemberAutoCreate,
        newMemberPayload
      );
    });

    setBulkText('');
    setIsReviewingBulkPresensiDuplicates(false);
    setIsBulkPresensiModalOpen(false);
  };

  // Member auto-suggest logic when typing presensiNama
  const memberSuggestions = useMemo(() => {
    if (!presensiNama || presensiNama.trim().length < 2) return [];
    const query = presensiNama.toLowerCase().trim();
    return members
      .filter(m => m.nama.toLowerCase().includes(query))
      .slice(0, 5);
  }, [presensiNama, members]);

  const handleSelectSuggestedMember = (m: Member) => {
    setPresensiNama(m.nama);
    setPresensiHp(m.nomorHp || '');
    setPresensiDomisili(m.domisili || '');
    setPresensiSosmed(m.sosmed?.instagram || m.sosmed?.tiktok || '');
    setSelectedMemberId(m.id);
  };

  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventNama.trim()) return;

    onAddEvent({
      namaEvent: newEventNama.trim(),
      waktu: newEventWaktu || new Date().toISOString(),
      lokasi: newEventLokasi.trim() || 'Kab. Malang',
      organisasiHandling: newEventOrg,
      deskripsi: newEventDeskripsi.trim(),
    });

    // Reset
    setNewEventNama('');
    setNewEventWaktu('');
    setNewEventLokasi('');
    setNewEventOrg('PKS Muda');
    setNewEventDeskripsi('');
    setIsCreateEventModalOpen(false);
  };

  const handleAddPresensiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !presensiNama.trim()) return;

    // Check if matched to existing member
    let linkedMemberId = selectedMemberId;
    let existingMatch = members.find(
      m => m.nama.toLowerCase().trim() === presensiNama.toLowerCase().trim()
    );

    if (existingMatch && !linkedMemberId) {
      linkedMemberId = existingMatch.id;
    }

    const isNewMemberAutoCreate = !linkedMemberId;

    let newMemberPayload: Omit<Member, 'id' | 'createdAt' | 'updatedAt'> | undefined;

    if (isNewMemberAutoCreate) {
      newMemberPayload = {
        nama: presensiNama.trim(),
        nomorHp: presensiHp.trim(),
        organisasiInternal: [activeEvent.organisasiHandling],
        tglLahir: '',
        sosmed: { instagram: presensiSosmed.trim() },
        email: '',
        domisili: presensiDomisili || 'Kepanjen',
        alamatDetail: '',
        aktivitas: 'Peserta Event Kepemudaan',
        pendidikan: 'S1',
        jurusan: '',
        keahlian: [],
        hobi: [],
        pembinaan: 'Belum Pernah',
        catatanTambahan: `Terdaftar otomatis via presensi event: ${activeEvent.namaEvent}`,
      };
    }

    onAddAttendance(
      {
        eventId: activeEvent.id,
        memberId: linkedMemberId || undefined,
        namaPeserta: presensiNama.trim(),
        nomorHp: presensiHp.trim(),
        domisili: presensiDomisili.trim() || 'Kepanjen',
        sosmed: presensiSosmed.trim(),
      },
      isNewMemberAutoCreate,
      newMemberPayload
    );

    // Reset presensi form
    setPresensiNama('');
    setPresensiHp('');
    setPresensiDomisili('');
    setPresensiSosmed('');
    setSelectedMemberId(null);
    setIsAddPresensiModalOpen(false);
  };

  const formatEventDateTime = (waktuStr: string) => {
    if (!waktuStr) return '-';
    try {
      const d = new Date(waktuStr);
      if (isNaN(d.getTime())) return waktuStr;
      const tgl = d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return `${tgl} • ${jam} WIB`;
    } catch {
      return waktuStr;
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#F27D26]/90 rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center space-x-1.5 bg-white/10 text-orange-200 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5" />
            <span>Sistem Presensi & Manajemen Event</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            Event & Kehadiran Anggota Youth Wing
          </h2>
          <p className="text-xs text-slate-200 max-w-xl">
            Buat kegiatan baru, catat daftar hadir secara real-time. Peserta baru otomatis
            terhubung & terdaftar ke Database Anggota.
          </p>
        </div>

        <button
          onClick={() => setIsCreateEventModalOpen(true)}
          className="bg-[#F27D26] hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center space-x-2 shrink-0 border border-orange-400/30"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Event Baru</span>
        </button>
      </div>

      {/* Main Grid: Left Event List, Right Event Detail & Presensi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Events Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-[#F27D26]" />
                <span>Daftar Event ({events.length})</span>
              </h3>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama event/lokasi..."
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#F27D26]"
              />
            </div>

            {/* Filter Organisasi & Sort Controls */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                  Filter Organisasi
                </label>
                <select
                  value={eventOrgFilter}
                  onChange={e => setEventOrgFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#F27D26]"
                >
                  <option value="Semua">Semua Org</option>
                  {ORGANISASI_LIST.map(org => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                  Urutkan Event
                </label>
                <select
                  value={eventSortBy}
                  onChange={e => setEventSortBy(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#F27D26]"
                >
                  <option value="terbaru">Terbaru</option>
                  <option value="terlama">Terlama</option>
                  <option value="peserta_terbanyak">Peserta Terbanyak</option>
                  <option value="paling_banyak_anggota_baru">Paling Banyak Anggota Baru</option>
                  <option value="nama_az">Nama A-Z</option>
                </select>
              </div>
            </div>

            {/* Event List Items */}
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                  Belum ada event ditemukan.
                </div>
              ) : (
                filteredEvents.map(item => {
                  const isSelected = activeEvent?.id === item.id;
                  const attCount = attendances.filter(a => a.eventId === item.id).length;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedEventId(item.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-orange-50/70 border-[#F27D26] shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="bg-orange-100 text-[#F27D26] border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {item.organisasiHandling}
                        </span>
                        <div className="flex items-center space-x-1 text-[11px] text-slate-500 font-semibold bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
                          <Users className="w-3 h-3 text-[#F27D26]" />
                          <span>{attCount} Hadir</span>
                        </div>
                      </div>

                      <h4 className="font-bold text-slate-900 text-xs mt-1.5 line-clamp-2">
                        {item.namaEvent}
                      </h4>

                      <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{formatEventDateTime(item.waktu)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{item.lokasi}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Event Detail & Presensi List */}
        <div className="lg:col-span-8 space-y-4">
          {!activeEvent ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold">Pilih event dari daftar untuk melihat detail presensi.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Event Header Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm relative space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="bg-orange-500 text-white font-black text-xs px-2.5 py-1 rounded-lg">
                      {activeEvent.organisasiHandling}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Diselenggarakan oleh Bidang Kepemudaan
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsBulkPresensiModalOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center space-x-1"
                      title="Bulk Import Data Presensi"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Bulk Import</span>
                    </button>

                    <button
                      onClick={() => setIsAddPresensiModalOpen(true)}
                      className="bg-[#F27D26] hover:bg-orange-600 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center space-x-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Input Presensi</span>
                    </button>

                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: 'event',
                          id: activeEvent.id,
                          nama: activeEvent.namaEvent,
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Hapus Event Ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {activeEvent.namaEvent}
                  </h3>
                  {activeEvent.deskripsi && (
                    <p className="text-xs text-slate-600 mt-1">{activeEvent.deskripsi}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80 font-medium text-slate-700">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-[#F27D26]" />
                    <span>Waktu: {formatEventDateTime(activeEvent.waktu)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-[#F27D26]" />
                    <span>Lokasi: {activeEvent.lokasi}</span>
                  </div>
                </div>
              </div>

              {/* Attendance Table Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <span>Daftar Kehadiran Event</span>
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                        {activeEventAttendances.length} Peserta
                      </span>
                    </h4>
                  </div>

                  {/* Search Attendances */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari nama peserta..."
                      value={attendanceSearch}
                      onChange={e => setAttendanceSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#F27D26]"
                    />
                  </div>
                </div>

                {/* Table View (Desktop & Responsive) */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3">Nama Peserta</th>
                        <th className="py-2.5 px-3">No. HP / WA</th>
                        <th className="py-2.5 px-3">Domisili</th>
                        <th className="py-2.5 px-3">Sosmed</th>
                        <th className="py-2.5 px-3">Waktu Presensi</th>
                        <th className="py-2.5 px-3 text-center">Status DB</th>
                        <th className="py-2.5 px-3 text-center w-12">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {filteredAttendances.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                            Belum ada presensi dicatat untuk event ini.
                          </td>
                        </tr>
                      ) : (
                        filteredAttendances.map((att, idx) => {
                          const isLinked = !!att.memberId;
                          const waLink = formatWhatsAppLink(att.nomorHp);

                          return (
                            <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {att.namaPeserta}
                              </td>
                              <td className="py-2.5 px-3">
                                {att.nomorHp ? (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center space-x-1 text-emerald-600 font-bold hover:underline"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>{att.nomorHp}</span>
                                  </a>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="py-2.5 px-3">{att.domisili || '-'}</td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {att.sosmed || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                {formatEventDateTime(att.waktuPresensi)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isLinked ? (
                                  <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Terdaftar DB</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 bg-orange-50 text-[#F27D26] border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    <UserPlus className="w-3 h-3" />
                                    <span>Anggota Baru</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'attendance',
                                      id: att.id,
                                      nama: att.namaPeserta,
                                    })
                                  }
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded"
                                  title="Hapus Presensi Peserta Ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create New Event */}
      {isCreateEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <Plus className="w-5 h-5 text-[#F27D26]" />
                <span>Buat Event Baru</span>
              </h3>
              <button
                onClick={() => setIsCreateEventModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEventSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Event <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kopi Darat Dapil 1 Kepamudaan"
                  value={newEventNama}
                  onChange={e => setNewEventNama(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F27D26] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Waktu & Tanggal
                  </label>
                  <input
                    type="datetime-local"
                    value={newEventWaktu}
                    onChange={e => setNewEventWaktu(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F27D26] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Organisasi Internal Handling
                  </label>
                  <select
                    value={newEventOrg}
                    onChange={e => setNewEventOrg(e.target.value as OrganisasiType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F27D26] focus:outline-none"
                  >
                    {allOrgs.map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Event</label>
                <input
                  type="text"
                  placeholder="Contoh: Gedung PKS Kepanjen / Kafe Ngenep"
                  value={newEventLokasi}
                  onChange={e => setNewEventLokasi(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F27D26] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deskripsi / Catatan Event
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat kegiatan..."
                  value={newEventDeskripsi}
                  onChange={e => setNewEventDeskripsi(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F27D26] focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateEventModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F27D26] hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Simpan Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Presensi */}
      {isAddPresensiModalOpen && activeEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-[#F27D26]" />
                  <span>Input Presensi Kehadiran</span>
                </h3>
                <p className="text-[11px] text-slate-500">{activeEvent.namaEvent}</p>
              </div>
              <button
                onClick={() => setIsAddPresensiModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPresensiSubmit} className="space-y-3">
              {/* Nama Input with Auto-Suggest */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Peserta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ketik nama anggota/peserta..."
                  value={presensiNama}
                  onChange={e => {
                    setPresensiNama(e.target.value);
                    setSelectedMemberId(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F27D26] focus:outline-none"
                />

                {/* Suggestions List */}
                {memberSuggestions.length > 0 && !selectedMemberId && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                    <div className="p-1.5 text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                      Pilih dari Database Anggota:
                    </div>
                    {memberSuggestions.map(m => (
                      <div
                        key={m.id}
                        onClick={() => handleSelectSuggestedMember(m)}
                        className="p-2 hover:bg-orange-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{m.nama}</div>
                          <div className="text-[10px] text-slate-500">
                            Kec. {m.domisili || '-'} • {m.nomorHp}
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                          Autofill
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedMemberId && (
                  <div className="mt-1 flex items-center justify-between bg-emerald-50 text-emerald-800 text-xs p-2 rounded-lg border border-emerald-200 font-semibold">
                    <span className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Terhubung dengan Anggota Terdaftar</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedMemberId(null)}
                      className="text-[10px] text-emerald-700 underline font-bold"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  No. HP / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="0812xxxx"
                  value={presensiHp}
                  onChange={e => setPresensiHp(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F27D26] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Domisili</label>
                  <select
                    value={presensiDomisili}
                    onChange={e => setPresensiDomisili(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F27D26] focus:outline-none"
                  >
                    <option value="">Pilih Kecamatan...</option>
                    {KECAMATAN_MALANG.map(k => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sosmed</label>
                  <input
                    type="text"
                    placeholder="@username"
                    value={presensiSosmed}
                    onChange={e => setPresensiSosmed(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F27D26] focus:outline-none"
                  />
                </div>
              </div>

              {!selectedMemberId && presensiNama.trim() && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 text-[11px] text-[#F27D26] font-medium flex items-start space-x-2">
                  <UserPlus className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Nama ini belum dipilih dari database. Menyimpan presensi akan{' '}
                    <strong>otomatis menginput data baru ini ke Database Anggota</strong>.
                  </span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddPresensiModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F27D26] hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Simpan Presensi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Presensi Modal */}
      {isBulkPresensiModalOpen && activeEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Bulk Import Presensi</h3>
                  <p className="text-xs text-slate-500">Event: {activeEvent.namaEvent}</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkPresensiModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isReviewingBulkPresensiDuplicates ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Konfirmasi {matchedBulkIndexes.length} Peserta Dengan Nama Terdaftar</span>
                  </div>
                  <p>
                    Nama-nama di bawah ini sudah ada di Database Anggota. Tentukan apakah ingin dihubungkan ke profil anggota lama atau dibuat sebagai data baru:
                  </p>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {matchedBulkIndexes.map(({ idx, row }) => {
                    const currentAction = bulkPresensiActions[idx] || 'link_existing';
                    const dbM = row.matchedMember!;

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">{row.nama}</span>
                            <span className="text-[11px] text-slate-500">
                              Data Presensi: HP {row.hp || '-'} • Kec. {row.domisili}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setBulkPresensiActions(p => ({ ...p, [idx]: 'link_existing' }))
                              }
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                currentAction === 'link_existing'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Hubungkan Ke DB
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setBulkPresensiActions(p => ({ ...p, [idx]: 'add_new' }))
                              }
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                currentAction === 'add_new'
                                  ? 'bg-[#F27D26] text-white'
                                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              + Anggota Baru
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setBulkPresensiActions(p => ({ ...p, [idx]: 'skip' }))
                              }
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                currentAction === 'skip'
                                  ? 'bg-slate-700 text-white'
                                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Lewati
                            </button>
                          </div>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-800">Profil Di DB: </span>
                          <span>{dbM.nama} ({dbM.pendidikan}) • HP: {dbM.nomorHp || '-'} • Org: {dbM.organisasiInternal.join(', ')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 space-y-1">
                  <span className="font-bold block">💡 Cara Penggunaan:</span>
                  <p>
                    Copy & paste daftar hadir (dari Excel / Word / Text). Tiap baris berisi satu peserta.
                  </p>
                  <p className="font-mono text-[11px] bg-white/80 p-1.5 rounded border border-blue-100">
                    Format: Nama [Tab/Koma] No HP [Tab/Koma] Domisili [Tab/Koma] Sosmed
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Paste Data Presensi (Satu nama per baris):
                  </label>
                  <textarea
                    rows={5}
                    placeholder={`Contoh:\nAhmad Fauzi\t08123456789\tKepanjen\t@ahmadf\nBudi Santoso\t08219876543\tSingosari\t@budi_s\nSiti Aminah, 08133344455, Kepanjen, @siti_a`}
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Live Preview of Parsed Entries */}
                {parsedBulkRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>Pratinjau Hasil Parser ({parsedBulkRows.length} Peserta)</span>
                      <span className="text-emerald-600 text-[11px]">
                        {parsedBulkRows.filter(r => r.matchedMember).length} Terdaftar |{' '}
                        {parsedBulkRows.filter(r => !r.matchedMember).length} Baru
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-1.5 px-2">No</th>
                            <th className="py-1.5 px-2">Nama</th>
                            <th className="py-1.5 px-2">No. HP</th>
                            <th className="py-1.5 px-2">Domisili</th>
                            <th className="py-1.5 px-2">Status DB</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {parsedBulkRows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="py-1.5 px-2 font-mono text-slate-400">{i + 1}</td>
                              <td className="py-1.5 px-2 font-bold text-slate-900">{row.nama}</td>
                              <td className="py-1.5 px-2 text-slate-600">{row.hp || '-'}</td>
                              <td className="py-1.5 px-2 text-slate-600">{row.domisili}</td>
                              <td className="py-1.5 px-2">
                                {row.matchedMember ? (
                                  <span className="bg-emerald-50 text-emerald-700 font-bold text-[10px] px-1.5 py-0.5 rounded border border-emerald-200">
                                    DB Matched
                                  </span>
                                ) : (
                                  <span className="bg-orange-50 text-[#F27D26] font-bold text-[10px] px-1.5 py-0.5 rounded border border-orange-200">
                                    + Input Baru
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              {isReviewingBulkPresensiDuplicates && (
                <button
                  type="button"
                  onClick={() => setIsReviewingBulkPresensiDuplicates(false)}
                  className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Kembali Edit Input
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsReviewingBulkPresensiDuplicates(false);
                  setIsBulkPresensiModalOpen(false);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={parsedBulkRows.length === 0}
                onClick={handleBulkPresensiSubmit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>
                  {isReviewingBulkPresensiDuplicates
                    ? 'Selesaikan Import Presensi'
                    : matchedBulkIndexes.length > 0
                    ? `Konfirmasi ${matchedBulkIndexes.length} Nama Duplikat & Lanjut`
                    : `Import ${parsedBulkRows.length} Presensi`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-3 bg-red-50 rounded-2xl border border-red-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Konfirmasi Hapus</h3>
                <p className="text-xs text-slate-500">
                  {deleteTarget.type === 'event' ? 'Hapus Event' : 'Hapus Presensi Peserta'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus{' '}
              {deleteTarget.type === 'event' ? 'event' : 'presensi peserta'}{' '}
              <strong className="text-slate-900 font-bold">{deleteTarget.nama}</strong>? Tindakan ini
              tidak dapat dibatalkan.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (deleteTarget.type === 'event') {
                    onDeleteEvent(deleteTarget.id, deleteTarget.nama);
                  } else if (deleteTarget.type === 'attendance') {
                    onDeleteAttendance?.(deleteTarget.id, deleteTarget.nama);
                  }
                  setDeleteTarget(null);
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Ya, Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
