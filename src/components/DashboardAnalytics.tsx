import React, { useMemo, useState, useEffect } from 'react';
import { Member, EventItem, EventAttendance, OrganisasiType, PembinaanType, PendidikanType } from '../types';
import { calculateAge, getAgeCategory, getActivityRating, getDapilByKecamatan } from '../lib/utils';
import { ORGANISASI_LIST, PEMBINAAN_LIST, DAPIL_LIST, JENJANG_PEMBINAAN_LIST } from '../data/constants';
import { getAllOrganizations } from '../lib/storage';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  Award,
  BookOpen,
  MapPin,
  Heart,
  Sparkles,
  Filter,
  PieChart as PieIcon,
  BarChart3,
  CalendarCheck,
  UserPlus,
  Flame,
  Star,
  RefreshCw,
  Trophy,
  Target,
  Zap,
  Building2,
} from 'lucide-react';

interface DashboardAnalyticsProps {
  members: Member[];
  events?: EventItem[];
  attendances?: EventAttendance[];
  onOpenAddMember: () => void;
}

const COLORS = ['#FE5000', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  members,
  events = [],
  attendances = [],
  onOpenAddMember,
}) => {
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<OrganisasiType | 'Semua'>('Semua');
  const [selectedPembinaanFilter, setSelectedPembinaanFilter] = useState<PembinaanType | 'Semua'>('Semua');
  const [selectedPendidikanFilter, setSelectedPendidikanFilter] = useState<PendidikanType | 'Semua'>('Semua');
  const [selectedAgeRangeFilter, setSelectedAgeRangeFilter] = useState<string>('Semua');
  const [allOrgs, setAllOrgs] = useState<string[]>(getAllOrganizations());

  useEffect(() => {
    const updateOrgs = () => setAllOrgs(getAllOrganizations());
    window.addEventListener('pks_tags_updated', updateOrgs);
    return () => window.removeEventListener('pks_tags_updated', updateOrgs);
  }, []);

  // Event Analytics Calculations
  const eventStats = useMemo(() => {
    if (!events || events.length === 0) {
      return {
        totalEvents: 0,
        totalAttendances: attendances.length,
        mostAttendedEvent: null,
        topNewMemberEvent: null,
        topRepeatMemberEvent: null,
        eventLeaderboard: [],
        orgEventCounts: [],
        topActiveMembers: [],
        retentionRate: 0,
      };
    }

    const totalEvents = events.length;
    const totalAttendances = attendances.length;

    const eventMetrics = events.map(ev => {
      const evAtts = attendances.filter(a => a.eventId === ev.id);
      const totalPeserta = evAtts.length;
      const newMembers = evAtts.filter(a => !a.memberId).length;
      const repeatMembers = evAtts.filter(a => !!a.memberId).length;

      return {
        event: ev,
        totalPeserta,
        newMembers,
        repeatMembers,
      };
    });

    const sortByTotal = [...eventMetrics].sort((a, b) => b.totalPeserta - a.totalPeserta);
    const sortByNew = [...eventMetrics].sort((a, b) => b.newMembers - a.newMembers);
    const sortByRepeat = [...eventMetrics].sort((a, b) => b.repeatMembers - a.repeatMembers);

    const mostAttendedEvent = sortByTotal[0] || null;
    const topNewMemberEvent = sortByNew[0] || null;
    const topRepeatMemberEvent = sortByRepeat[0] || null;

    const orgEventMap: Record<string, { eventCount: number; participantCount: number }> = {};
    ORGANISASI_LIST.forEach(org => {
      orgEventMap[org] = { eventCount: 0, participantCount: 0 };
    });

    events.forEach(ev => {
      const org = ev.organisasiHandling || 'PKS Muda';
      if (!orgEventMap[org]) orgEventMap[org] = { eventCount: 0, participantCount: 0 };
      orgEventMap[org].eventCount += 1;
      const attsCount = attendances.filter(a => a.eventId === ev.id).length;
      orgEventMap[org].participantCount += attsCount;
    });

    const orgEventCounts = Object.entries(orgEventMap).map(([name, data]) => ({
      name,
      Events: data.eventCount,
      Peserta: data.participantCount,
    }));

    const memberAttMap = new Map<string, { member: Member; count: number }>();
    members.forEach(m => {
      const nameClean = m.nama.toLowerCase().trim();
      const count = attendances.filter(
        a => a.memberId === m.id || a.namaPeserta.toLowerCase().trim() === nameClean
      ).length;
      if (count > 0) {
        memberAttMap.set(m.id, { member: m, count });
      }
    });

    const topActiveMembers = Array.from(memberAttMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const repeatAttendersCount = Array.from(memberAttMap.values()).filter(x => x.count >= 2).length;
    const totalAttendingMembersCount = memberAttMap.size;
    const retentionRate =
      totalAttendingMembersCount > 0
        ? Math.round((repeatAttendersCount / totalAttendingMembersCount) * 100)
        : 0;

    return {
      totalEvents,
      totalAttendances,
      mostAttendedEvent,
      topNewMemberEvent,
      topRepeatMemberEvent,
      eventLeaderboard: sortByTotal,
      orgEventCounts,
      topActiveMembers,
      retentionRate,
    };
  }, [events, attendances, members]);

  // Filtered members for interactive slice analysis across all 4 filter angles
  const filteredData = useMemo(() => {
    return members.filter(m => {
      const matchOrg =
        selectedOrgFilter === 'Semua' || (m.organisasiInternal && m.organisasiInternal.includes(selectedOrgFilter));
      const matchPembinaan = selectedPembinaanFilter === 'Semua' || m.pembinaan === selectedPembinaanFilter;
      const matchEdu = selectedPendidikanFilter === 'Semua' || m.pendidikan === selectedPendidikanFilter;

      let matchAge = true;
      if (selectedAgeRangeFilter !== 'Semua') {
        const age = calculateAge(m.tglLahir);
        if (selectedAgeRangeFilter === '<18') matchAge = age < 18;
        else if (selectedAgeRangeFilter === '18-24') matchAge = age >= 18 && age <= 24;
        else if (selectedAgeRangeFilter === '25-30') matchAge = age >= 25 && age <= 30;
        else if (selectedAgeRangeFilter === '31-40') matchAge = age >= 31 && age <= 40;
        else if (selectedAgeRangeFilter === '>40') matchAge = age > 40;
      }

      return matchOrg && matchPembinaan && matchEdu && matchAge;
    });
  }, [members, selectedOrgFilter, selectedPembinaanFilter, selectedPendidikanFilter, selectedAgeRangeFilter]);

  // Key KPI Metrics
  const totalCount = filteredData.length;
  
  const avgAge = useMemo(() => {
    if (totalCount === 0) return 0;
    const sum = filteredData.reduce((acc, m) => acc + calculateAge(m.tglLahir), 0);
    return Math.round((sum / totalCount) * 10) / 10;
  }, [filteredData, totalCount]);

  const activePembinaanCount = useMemo(() => {
    return filteredData.filter(m => m.pembinaan === 'Sudah').length;
  }, [filteredData]);

  const activePembinaanPercent = totalCount > 0 ? Math.round((activePembinaanCount / totalCount) * 100) : 0;

  // 1. Age Range Distribution
  const ageDistribution = useMemo(() => {
    const counts = {
      '< 18 th': 0,
      '18 - 24 th': 0,
      '25 - 30 th': 0,
      '31 - 40 th': 0,
      '> 40 th': 0,
    };

    filteredData.forEach(m => {
      const age = calculateAge(m.tglLahir);
      if (age < 18) counts['< 18 th']++;
      else if (age <= 24) counts['18 - 24 th']++;
      else if (age <= 30) counts['25 - 30 th']++;
      else if (age <= 40) counts['31 - 40 th']++;
      else counts['> 40 th']++;
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  // 2. Internal Organization Distribution
  const orgDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    allOrgs.forEach(org => {
      counts[org] = 0;
    });

    filteredData.forEach(m => {
      (m.organisasiInternal || []).forEach(org => {
        counts[org] = (counts[org] || 0) + 1;
      });
    });

    return allOrgs.map(org => ({
      name: org,
      Jumlah: counts[org] || 0,
    }));
  }, [filteredData, allOrgs]);

  // 3. Status Pembinaan Distribution
  const pembinaanDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      Sudah: 0,
      'Belum Pernah': 0,
      'Pernah, tapi sedang tidak': 0,
    };

    filteredData.forEach(m => {
      const key = m.pembinaan || 'Belum Pernah';
      if (counts[key] !== undefined) counts[key]++;
      else counts[key] = 1;
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  // 3b. Jenjang Pembinaan Distribution (Khusus yang 'Sudah')
  const jenjangDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      Muda: 0,
      Pratama: 0,
      Madya: 0,
    };

    filteredData.forEach(m => {
      if (m.pembinaan === 'Sudah' && m.jenjangPembinaan) {
        counts[m.jenjangPembinaan] = (counts[m.jenjangPembinaan] || 0) + 1;
      }
    });

    return JENJANG_PEMBINAAN_LIST.map(j => ({
      name: `Jenjang ${j}`,
      value: counts[j] || 0,
    }));
  }, [filteredData]);

  // 3c. Dapil (Daerah Pemilihan 1 - 7) Distribution
  const dapilDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    DAPIL_LIST.forEach(d => {
      counts[d] = 0;
    });

    filteredData.forEach(m => {
      const dapil = getDapilByKecamatan(m.domisili);
      if (dapil && counts[dapil] !== undefined) {
        counts[dapil]++;
      }
    });

    return DAPIL_LIST.map(d => ({
      name: d,
      Jumlah: counts[d] || 0,
    }));
  }, [filteredData]);

  // 4. Education Distribution
  const educationDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(m => {
      const edu = m.pendidikan || 'Lainnya';
      counts[edu] = (counts[edu] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, Jumlah]) => ({ name, Jumlah }))
      .sort((a, b) => b.Jumlah - a.Jumlah);
  }, [filteredData]);

  // 5. Domicile (Kecamatan in Kab. Malang) Top 8
  const domicileDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(m => {
      const dom = m.domisili || 'Belum Diisi';
      counts[dom] = (counts[dom] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, Jumlah]) => ({ name, Jumlah }))
      .sort((a, b) => b.Jumlah - a.Jumlah)
      .slice(0, 8);
  }, [filteredData]);

  // 6. Top Skills Breakdown
  const topSkills = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(m => {
      (m.keahlian || []).forEach(skill => {
        const clean = skill.trim();
        if (clean) counts[clean] = (counts[clean] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredData]);

  // 7. Top Hobbies Breakdown
  const topHobbies = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(m => {
      (m.hobi || []).forEach(hobby => {
        const clean = hobby.trim();
        if (clean) counts[clean] = (counts[clean] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredData]);

  return (
    <div className="space-y-4 text-slate-800">
      {/* Dynamic Slicer Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F27D26]">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">
              Filter Angle Analitik
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Saring grafik berdasarkan multi-dimensi kriteria
            </p>
          </div>
        </div>

        {/* Dynamic Filter Angle Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Angle 1: Organisasi */}
          <select
            value={selectedOrgFilter}
            onChange={e => setSelectedOrgFilter(e.target.value as any)}
            className="bg-slate-50 text-slate-800 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#F27D26] font-semibold"
          >
            <option value="Semua">Semua Org</option>
            {ORGANISASI_LIST.map(org => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>

          {/* Angle 2: Pembinaan */}
          <select
            value={selectedPembinaanFilter}
            onChange={e => setSelectedPembinaanFilter(e.target.value as any)}
            className="bg-slate-50 text-slate-800 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#F27D26] font-semibold"
          >
            <option value="Semua">Semua Pembinaan</option>
            {PEMBINAAN_LIST.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Angle 3: Pendidikan */}
          <select
            value={selectedPendidikanFilter}
            onChange={e => setSelectedPendidikanFilter(e.target.value as any)}
            className="bg-slate-50 text-slate-800 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#F27D26] font-semibold"
          >
            <option value="Semua">Semua Pendidikan</option>
            <option value="SMA/SMK">SMA/SMK</option>
            <option value="D3">D3</option>
            <option value="S1">S1</option>
            <option value="S2">S2</option>
            <option value="S3">S3</option>
            <option value="Lainnya">Lainnya</option>
          </select>

          {/* Angle 4: Rentang Usia */}
          <select
            value={selectedAgeRangeFilter}
            onChange={e => setSelectedAgeRangeFilter(e.target.value)}
            className="bg-slate-50 text-slate-800 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#F27D26] font-semibold"
          >
            <option value="Semua">Semua Usia</option>
            <option value="<18">&lt; 18 Tahun</option>
            <option value="18-24">18 - 24 Tahun</option>
            <option value="25-30">25 - 30 Tahun</option>
            <option value="31-40">31 - 40 Tahun</option>
            <option value=">40">&gt; 40 Tahun</option>
          </select>

          {(selectedOrgFilter !== 'Semua' ||
            selectedPembinaanFilter !== 'Semua' ||
            selectedPendidikanFilter !== 'Semua' ||
            selectedAgeRangeFilter !== 'Semua') && (
            <button
              onClick={() => {
                setSelectedOrgFilter('Semua');
                setSelectedPembinaanFilter('Semua');
                setSelectedPendidikanFilter('Semua');
                setSelectedAgeRangeFilter('Semua');
              }}
              className="text-xs text-[#F27D26] hover:underline font-bold px-1"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Anggota</span>
            <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-100 text-[#F27D26] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
          <p className="text-[10px] text-slate-500 font-medium">Terdata dalam filter</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rata-Rata Usia</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {avgAge} <span className="text-xs font-semibold text-slate-400">th</span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">Kategori Usia Muda</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pembinaan Aktif</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{activePembinaanPercent}%</div>
          <p className="text-[10px] text-slate-500 font-medium">{activePembinaanCount} anggota sudah pembinaan</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Top Domisili</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-black text-slate-900 mt-1 truncate">
            {domicileDistribution[0]?.name || '-'}
          </div>
          <p className="text-[10px] text-slate-500 font-medium">
            {domicileDistribution[0]?.Jumlah || 0} anggota
          </p>
        </div>
      </div>

      {/* Main Visual Charts Row 1: Age & Internal Org */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Age Range Pie Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <PieIcon className="w-3.5 h-3.5 text-[#F27D26]" />
              <span>Distribusi Rentang Usia</span>
            </h3>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ageDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {ageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '11px' }}
                />
                <Legend formatter={(value) => <span className="text-[11px] text-slate-600 font-medium">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Organisasi Internal Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
              <span>Sebaran Organisasi Internal</span>
            </h3>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orgDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '11px' }}
                />
                <Bar dataKey="Jumlah" fill="#F27D26" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Visual Charts Row 2: Pembinaan & Education */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Pembinaan Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Status Pembinaan</span>
            </h3>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pembinaanDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={65}
                  dataKey="value"
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#94A3B8" />
                  <Cell fill="#F59E0B" />
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '11px' }}
                />
                <Legend formatter={(value) => <span className="text-[11px] text-slate-600 font-medium">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tingkat Pendidikan Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>Tingkat Pendidikan</span>
            </h3>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={educationDistribution} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} tickLine={false} width={65} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '11px' }}
                />
                <Bar dataKey="Jumlah" fill="#3B82F6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Visual Charts Row 2b: Sebaran Dapil & Jenjang Pembinaan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sebaran Dapil (Wilayah) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Persebaran Anggota per Dapil (Dapil 1 - 7)</span>
            </h3>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dapilDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '11px' }}
                />
                <Bar dataKey="Jumlah" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Jenjang Pembinaan Kader (Khusus yang 'Sudah') */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Sebaran Jenjang Kader Terbina</span>
            </h3>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={jenjangDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={65}
                  dataKey="value"
                >
                  <Cell fill="#3B82F6" />
                  <Cell fill="#10B981" />
                  <Cell fill="#8B5CF6" />
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '11px' }}
                />
                <Legend formatter={(value) => <span className="text-[11px] text-slate-600 font-medium">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Skills & Hobbies Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Skills Cloud/List */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Top Keahlian / Skill Anggota</span>
            </h3>
          </div>

          {topSkills.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center font-medium">Belum ada data keahlian.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {topSkills.map((s, idx) => (
                <div
                  key={s.name}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1.5 font-medium"
                >
                  <span className="font-bold text-[#F27D26]">#{idx + 1}</span>
                  <span>{s.name}</span>
                  <span className="bg-orange-50 text-[#F27D26] text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-orange-200">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Hobbies Cloud/List */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Top Hobi & Minat Anggota</span>
            </h3>
          </div>

          {topHobbies.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center font-medium">Belum ada data hobi.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {topHobbies.map((h, idx) => (
                <div
                  key={h.name}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1.5 font-medium"
                >
                  <span className="font-bold text-rose-500">#{idx + 1}</span>
                  <span>{h.name}</span>
                  <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-rose-200">
                    {h.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* EVENT ANALYTICS & INTELLIGENCE SECTION (Placed at bottom, soft eye-friendly light theme) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-orange-50 border border-orange-100 rounded-xl text-[#F27D26]">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Analitik Event & Kehadiran Anggota
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Intelijen performa event, akuisisi anggota baru, dan retensi partisipasi
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto bg-slate-100 text-slate-700 text-[11px] font-bold px-3 py-1 rounded-full border border-slate-200">
            {eventStats.totalEvents} Event • {eventStats.totalAttendances} Log Presensi
          </span>
        </div>

        {/* 4 Highlight Event KPI Cards (Soft light palette) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Event Teramai */}
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Peserta Terbanyak</span>
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <div className="font-extrabold text-xs text-slate-900 truncate">
              {eventStats.mostAttendedEvent?.event.namaEvent || 'Belum ada data'}
            </div>
            <div className="text-[11px] font-semibold text-amber-600">
              {eventStats.mostAttendedEvent
                ? `${eventStats.mostAttendedEvent.totalPeserta} Peserta Hadir`
                : '-'}
            </div>
          </div>

          {/* Card 2: Penjaring Anggota Baru Terbanyak */}
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Akuisisi Anggota Baru</span>
              <UserPlus className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="font-extrabold text-xs text-slate-900 truncate">
              {eventStats.topNewMemberEvent?.event.namaEvent || 'Belum ada data'}
            </div>
            <div className="text-[11px] font-semibold text-emerald-600">
              {eventStats.topNewMemberEvent
                ? `+${eventStats.topNewMemberEvent.newMembers} Anggota Baru`
                : '-'}
            </div>
          </div>

          {/* Card 3: Anggota Berulang / Setia Terbanyak */}
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Retensi Anggota Setia</span>
              <RefreshCw className="w-4 h-4 text-blue-500" />
            </div>
            <div className="font-extrabold text-xs text-slate-900 truncate">
              {eventStats.topRepeatMemberEvent?.event.namaEvent || 'Belum ada data'}
            </div>
            <div className="text-[11px] font-semibold text-blue-600">
              {eventStats.topRepeatMemberEvent
                ? `${eventStats.topRepeatMemberEvent.repeatMembers} Anggota Terdaftar`
                : '-'}
            </div>
          </div>

          {/* Card 4: Tingkat Retensi Total */}
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Tingkat Retensi Presensi</span>
              <Trophy className="w-4 h-4 text-[#F27D26]" />
            </div>
            <div className="font-black text-base text-[#F27D26]">{eventStats.retentionRate}%</div>
            <div className="text-[10px] font-semibold text-slate-500">
              Anggota hadir &gt;1 event
            </div>
          </div>
        </div>

        {/* Detailed Event Leaderboards & Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          {/* Leaderboard Table: Event Performance Rank */}
          <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
            <h3 className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
              <Trophy className="w-4 h-4 text-[#F27D26]" />
              <span>Peringkat Event Terpopuler & Penjaringan</span>
            </h3>

            {eventStats.eventLeaderboard.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Belum ada event tercatat.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {eventStats.eventLeaderboard.map((item, idx) => (
                  <div
                    key={item.event.id}
                    className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-md font-mono font-bold text-[10px] flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-800'
                            : idx === 2
                            ? 'bg-orange-100 text-orange-800 border border-orange-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 block truncate">
                          {item.event.namaEvent}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {item.event.organisasiHandling} • {item.event.lokasi}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 text-[10px]">
                      <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-md border border-blue-200">
                        {item.totalPeserta} Peserta
                      </span>
                      <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                        +{item.newMembers} Baru
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Active Members Champion List */}
          <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
            <h3 className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Top 5 Anggota Paling Rajin Ikut Event</span>
            </h3>

            {eventStats.topActiveMembers.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Belum ada data kehadiran.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {eventStats.topActiveMembers.map((item, idx) => {
                  const rating = getActivityRating(item.count, eventStats.totalEvents);
                  return (
                    <div
                      key={item.member.id}
                      className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-orange-100 text-[#F27D26] font-bold font-mono text-[10px] flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">
                            {item.member.nama}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Kec. {item.member.domisili}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${rating.badgeClass}`}
                        >
                          {rating.level} ({rating.score})
                        </span>
                        <span className="bg-[#F27D26] text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                          {item.count} Event
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
