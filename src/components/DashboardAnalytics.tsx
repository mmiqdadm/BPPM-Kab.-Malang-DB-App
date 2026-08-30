import React, { useMemo, useState, useEffect } from 'react';
import { Member, EventItem, EventAttendance, OrganisasiType, PembinaanType, PendidikanType, JenjangPembinaanType } from '../types';
import { calculateAge, getActivityRating, getDapilByKecamatan } from '../lib/utils';
import { KECAMATAN_MALANG, ORGANISASI_LIST, PEMBINAAN_LIST, DAPIL_MALANG, DAPIL_LIST, JENJANG_PEMBINAAN_LIST, PENDIDIKAN_LIST } from '../data/constants';
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
  Briefcase,
  Share2,
  Smartphone,
  Compass,
  CheckCircle2,
  AlertCircle,
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
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string | 'Semua'>('Semua');
  const [selectedDapilFilter, setSelectedDapilFilter] = useState<string | 'Semua'>('Semua');
  const [selectedPembinaanFilter, setSelectedPembinaanFilter] = useState<PembinaanType | 'Semua'>('Semua');
  const [selectedJenjangFilter, setSelectedJenjangFilter] = useState<JenjangPembinaanType | 'Semua'>('Semua');
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
    allOrgs.forEach(org => {
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
  }, [events, attendances, members, allOrgs]);

  // Filtered members for interactive slice analysis across all filter angles
  const filteredData = useMemo(() => {
    return members.filter(m => {
      const matchOrg =
        selectedOrgFilter === 'Semua' || (m.organisasiInternal && m.organisasiInternal.includes(selectedOrgFilter));
      
      let matchDapil = true;
      if (selectedDapilFilter !== 'Semua') {
        const dapilKecamatans = DAPIL_MALANG[selectedDapilFilter] || [];
        matchDapil = dapilKecamatans.some(
          k => k.toLowerCase() === (m.domisili || '').toLowerCase().trim()
        );
      }

      const matchPembinaan = selectedPembinaanFilter === 'Semua' || m.pembinaan === selectedPembinaanFilter;
      const matchJenjang =
        selectedJenjangFilter === 'Semua' ||
        (m.pembinaan === 'Sudah' && (m.jenjangPembinaan || 'Muda') === selectedJenjangFilter);
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

      return matchOrg && matchDapil && matchPembinaan && matchJenjang && matchEdu && matchAge;
    });
  }, [
    members,
    selectedOrgFilter,
    selectedDapilFilter,
    selectedPembinaanFilter,
    selectedJenjangFilter,
    selectedPendidikanFilter,
    selectedAgeRangeFilter,
  ]);

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

  // 1. Age Range & Generation Distribution
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
      if (m.pembinaan === 'Sudah') {
        const j = m.jenjangPembinaan || 'Muda';
        counts[j] = (counts[j] || 0) + 1;
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

  // 5b. Geographic Coverage of Kab. Malang (33 Kecamatan)
  const geographicCoverage = useMemo(() => {
    const coveredSet = new Set<string>();
    filteredData.forEach(m => {
      if (m.domisili) coveredSet.add(m.domisili.toLowerCase().trim());
    });
    const totalMalangKecamatans = KECAMATAN_MALANG.length; // 33 Kecamatan
    const activeCount = coveredSet.size;
    const percent = Math.round((activeCount / totalMalangKecamatans) * 100);

    const unrepresented = KECAMATAN_MALANG.filter(
      k => !coveredSet.has(k.toLowerCase().trim())
    );

    return {
      totalKecamatans: totalMalangKecamatans,
      activeCount,
      percent,
      unrepresentedCount: unrepresented.length,
      unrepresentedList: unrepresented.slice(0, 8),
    };
  }, [filteredData]);

  // 6. Activity / Profession Distribution
  const activityDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(m => {
      const raw = (m.aktivitas || 'Belum Diisi').trim();
      if (!raw) return;
      
      let cat = raw;
      const lower = raw.toLowerCase();
      if (lower.includes('mahasiswa') || lower.includes('kuliah') || lower.includes('kampus') || lower.includes('ub') || lower.includes('um') || lower.includes('uin')) {
        cat = 'Mahasiswa';
      } else if (lower.includes('pelajar') || lower.includes('siswa') || lower.includes('sma') || lower.includes('smk') || lower.includes('sekolah') || lower.includes('santri')) {
        cat = 'Pelajar / Santri';
      } else if (lower.includes('wirausaha') || lower.includes('bisnis') || lower.includes('usaha') || lower.includes('owner') || lower.includes('toko') || lower.includes('dagang')) {
        cat = 'Wirausaha / Bisnis';
      } else if (lower.includes('karyawan') || lower.includes('pegawai') || lower.includes('swasta') || lower.includes('staf') || lower.includes('buruh') || lower.includes('pabrik')) {
        cat = 'Karyawan Swasta';
      } else if (lower.includes('guru') || lower.includes('dosen') || lower.includes('pengajar') || lower.includes('ustadz') || lower.includes('pendidik')) {
        cat = 'Guru / Pengajar';
      } else if (lower.includes('freelance') || lower.includes('designer') || lower.includes('programmer') || lower.includes('digital') || lower.includes('konten') || lower.includes('creator')) {
        cat = 'Freelance / Digital';
      } else if (lower.includes('pns') || lower.includes('asn') || lower.includes('honorer') || lower.includes('aparat')) {
        cat = 'PNS / ASN';
      } else if (lower.includes('pencari') || lower.includes('belum') || lower.includes('fresh')) {
        cat = 'Pencari Kerja';
      }
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, Jumlah]) => ({ name, Jumlah }))
      .sort((a, b) => b.Jumlah - a.Jumlah)
      .slice(0, 6);
  }, [filteredData]);

  // 7. Social Media Reach & Digital Readiness
  const socialMediaReach = useMemo(() => {
    let instagram = 0;
    let tiktok = 0;
    let twitter = 0;
    let facebook = 0;
    let hasWhatsApp = 0;

    filteredData.forEach(m => {
      if (m.sosmed?.instagram && m.sosmed.instagram.trim() !== '-' && m.sosmed.instagram.trim().length > 1) instagram++;
      if (m.sosmed?.tiktok && m.sosmed.tiktok.trim() !== '-' && m.sosmed.tiktok.trim().length > 1) tiktok++;
      if (m.sosmed?.twitter && m.sosmed.twitter.trim() !== '-' && m.sosmed.twitter.trim().length > 1) twitter++;
      if (m.sosmed?.facebook && m.sosmed.facebook.trim() !== '-' && m.sosmed.facebook.trim().length > 1) facebook++;
      if (m.nomorHp && m.nomorHp.trim().replace(/\D/g, '').length >= 8) hasWhatsApp++;
    });

    return [
      { name: 'WhatsApp', Jumlah: hasWhatsApp, fill: '#10B981' },
      { name: 'Instagram', Jumlah: instagram, fill: '#E1306C' },
      { name: 'TikTok', Jumlah: tiktok, fill: '#0F172A' },
      { name: 'Facebook', Jumlah: facebook, fill: '#1877F2' },
      { name: 'Twitter/X', Jumlah: twitter, fill: '#0284C7' },
    ];
  }, [filteredData]);

  // 8. Top Pembina / Mentor Leaderboard
  const topMentors = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(m => {
      if (m.pembinaan === 'Sudah') {
        const mentor = (m.namaPembina || '').trim();
        if (mentor && mentor !== '-') {
          counts[mentor] = (counts[mentor] || 0) + 1;
        }
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredData]);

  // 9. Multi-Organisasi Engagement
  const multiOrgEngagement = useMemo(() => {
    let single = 0;
    let multi = 0;
    let none = 0;

    filteredData.forEach(m => {
      const orgs = (m.organisasiInternal || []).filter(o => o && o !== 'Belum');
      if (orgs.length === 0) none++;
      else if (orgs.length === 1) single++;
      else multi++;
    });

    return [
      { name: '1 Sayap Org', value: single, color: '#F27D26' },
      { name: '2+ Sayap (Multi-Aktif)', value: multi, color: '#10B981' },
      { name: 'Belum Terdaftar di Sayap', value: none, color: '#94A3B8' },
    ];
  }, [filteredData]);

  // 10. Top Skills Breakdown
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

  // 11. Top Hobbies Breakdown
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

  const hasActiveFilters =
    selectedOrgFilter !== 'Semua' ||
    selectedDapilFilter !== 'Semua' ||
    selectedPembinaanFilter !== 'Semua' ||
    selectedJenjangFilter !== 'Semua' ||
    selectedPendidikanFilter !== 'Semua' ||
    selectedAgeRangeFilter !== 'Semua';

  const handleResetFilters = () => {
    setSelectedOrgFilter('Semua');
    setSelectedDapilFilter('Semua');
    setSelectedPembinaanFilter('Semua');
    setSelectedJenjangFilter('Semua');
    setSelectedPendidikanFilter('Semua');
    setSelectedAgeRangeFilter('Semua');
  };

  return (
    <div className="space-y-5 text-slate-800">
      {/* Dynamic Slicer Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F27D26]">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight flex items-center space-x-2">
              <span>Filter Multi-Dimensi Analitik</span>
              {hasActiveFilters && (
                <span className="text-[10px] bg-orange-100 text-[#F27D26] font-bold px-2 py-0.5 rounded-full border border-orange-200">
                  Filter Aktif
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Saring dan telaah visualisasi berdasarkan irisan kriteria keanggotaan
            </p>
          </div>
        </div>

        {/* Dynamic Filter Angle Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Angle 1: Organisasi */}
          <select
            value={selectedOrgFilter}
            onChange={e => setSelectedOrgFilter(e.target.value)}
            className="bg-slate-50 text-slate-800 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#F27D26] font-semibold"
          >
            <option value="Semua">Semua Org</option>
            {allOrgs.map(org => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>

          {/* Angle 2: Dapil */}
          <select
            value={selectedDapilFilter}
            onChange={e => setSelectedDapilFilter(e.target.value)}
            className="bg-slate-50 text-slate-800 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#F27D26] font-semibold"
          >
            <option value="Semua">Semua Dapil</option>
            {DAPIL_LIST.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Angle 3: Pembinaan */}
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

          {/* Angle 4: Jenjang */}
          <select
            value={selectedJenjangFilter}
            onChange={e => setSelectedJenjangFilter(e.target.value as any)}
            className="bg-slate-50 text-slate-800 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#F27D26] font-semibold"
          >
            <option value="Semua">Semua Jenjang</option>
            {JENJANG_PEMBINAAN_LIST.map(j => (
              <option key={j} value={j}>
                Jenjang {j}
              </option>
            ))}
          </select>

          {/* Angle 5: Pendidikan */}
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

          {/* Angle 6: Rentang Usia */}
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

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-[#F27D26] hover:underline font-bold px-1 py-1"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Strategic Executive KPI Cards (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Anggota */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Anggota</span>
            <div className="w-6 h-6 rounded-lg bg-orange-50 border border-orange-100 text-[#F27D26] flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">{totalCount}</div>
          <p className="text-[10px] text-slate-500 font-medium truncate">Dalam filter aktif</p>
        </div>

        {/* Card 2: Tingkat Keterbinaan */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keterbinaan</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 mt-1">{activePembinaanPercent}%</div>
          <p className="text-[10px] text-slate-500 font-medium truncate">{activePembinaanCount} kader terbina</p>
        </div>

        {/* Card 3: Rata-Rata Usia */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rata-Rata Usia</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {avgAge} <span className="text-xs font-semibold text-slate-400">th</span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium truncate">Dominan Gen-Z & Muda</p>
        </div>

        {/* Card 4: Cakupan Kecamatan */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cakupan Wilayah</span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-blue-600 mt-1">{geographicCoverage.percent}%</div>
          <p className="text-[10px] text-slate-500 font-medium truncate">{geographicCoverage.activeCount}/33 Kecamatan</p>
        </div>

        {/* Card 5: Konektivitas WhatsApp */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Koneksi WA</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {totalCount > 0 ? Math.round((socialMediaReach[0].Jumlah / totalCount) * 100) : 0}%
          </div>
          <p className="text-[10px] text-slate-500 font-medium truncate">{socialMediaReach[0].Jumlah} nomor valid</p>
        </div>

        {/* Card 6: Multi-Organisasi */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Multi-Sayap</span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-purple-600 mt-1">
            {totalCount > 0 ? Math.round((multiOrgEngagement[1].value / totalCount) * 100) : 0}%
          </div>
          <p className="text-[10px] text-slate-500 font-medium truncate">{multiOrgEngagement[1].value} kader multi-aktif</p>
        </div>
      </div>

      {/* ROW 1: DEMOGRAFI & SAYAP ORGANISASI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Age Range Donut Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <PieIcon className="w-3.5 h-3.5 text-[#F27D26]" />
              <span>Distribusi Rentang Usia & Generasi</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Segmentasi Pemuda</span>
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
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
              <span>Sebaran Organisasi & Sayap Internal</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Partisipasi Sayap</span>
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

      {/* ROW 2: EKOSISTEM WILAYAH & DAPIL MALANG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sebaran Dapil (Wilayah 1 - 7) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Persebaran Anggota per Dapil (Dapil 1 - 7)</span>
            </h3>
            <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              7 Daerah Pemilihan
            </span>
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

        {/* Analisis Wilayah Kecamatan (Basis Terkuat vs Target Ekspansi) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Compass className="w-3.5 h-3.5 text-emerald-600" />
                <span>Peta Kekuatan & Potensi Kecamatan Malang</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">33 Kecamatan</span>
            </div>

            {/* Top 4 Kecamatan Terbanyak */}
            <div className="mb-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                🏆 Top Basis Wilayah Terbanyak
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {domicileDistribution.slice(0, 4).map((d, idx) => (
                  <div key={d.name} className="p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] text-slate-400 font-bold">#{idx + 1}</div>
                    <div className="font-bold text-xs text-slate-900 truncate">{d.name}</div>
                    <div className="text-[11px] font-extrabold text-blue-600">{d.Jumlah} Kader</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Wilayah Belum Terjangkau / Potensi Rekrutmen */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>🎯 Target Ekspansi Wilayah ({geographicCoverage.unrepresentedCount} Kecamatan Kosong/Minim)</span>
              </p>
              {geographicCoverage.unrepresentedList.length === 0 ? (
                <p className="text-xs text-emerald-600 font-semibold">🎉 Luar biasa! Seluruh 33 kecamatan telah memiliki kader terdaftar.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {geographicCoverage.unrepresentedList.map(k => (
                    <span
                      key={k}
                      className="text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md"
                    >
                      Kec. {k}
                    </span>
                  ))}
                  {geographicCoverage.unrepresentedCount > 8 && (
                    <span className="text-[10px] font-semibold text-slate-400 self-center">
                      +{geographicCoverage.unrepresentedCount - 8} lainnya
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 mt-2 font-medium">
            💡 Gunakan data ini untuk menentukan lokasi pelaksanaan program kepemudaan atau pelatihan berikutnya.
          </p>
        </div>
      </div>

      {/* ROW 3: EKOSISTEM KADERISASI & PEMBINAAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status & Jenjang Pembinaan Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Komposisi Status & Jenjang Pembinaan</span>
            </h3>
            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {activePembinaanPercent}% Terbina
            </span>
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

        {/* Leaderboard Pembina / Mentor */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Distribusi Mentor / Pembina Kader</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">Beban Binaan</span>
          </div>

          {topMentors.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-medium">
              Belum ada data nama pembina yang tercatat pada kader berstatus &quot;Sudah&quot;.
            </div>
          ) : (
            <div className="space-y-2">
              {topMentors.map((mentor, idx) => (
                <div
                  key={mentor.name}
                  className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 font-bold font-mono text-[10px] flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {mentor.name}
                    </span>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                    {mentor.count} Binaan
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 4: AKTIVITAS/PROFESI & LATAR BELAKANG PENDIDIKAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aktivitas / Profesi Anggota */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Briefcase className="w-3.5 h-3.5 text-[#F27D26]" />
              <span>Aktivitas & Profesi Utama Anggota</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Potensi Karir</span>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '11px' }}
                />
                <Bar dataKey="Jumlah" fill="#F27D26" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tingkat Pendidikan Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>Jenjang Pendidikan Terakhir</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Latar Belakang Akademik</span>
          </div>

          <div className="h-52">
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

      {/* ROW 5: KESIAPAN MEDIA SOSIAL, SKILLS & HOBI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Kesiapan Media Sosial (Digital Reach) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Share2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Kesiapan Jangkauan Media Sosial</span>
            </h3>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={socialMediaReach} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '11px' }}
                />
                <Bar dataKey="Jumlah" radius={[6, 6, 0, 0]}>
                  {socialMediaReach.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Skills */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Top Keahlian / Skill Anggota</span>
            </h3>
          </div>

          {topSkills.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center font-medium">Belum ada data keahlian.</p>
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

        {/* Top Hobbies */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Top Hobi & Minat Anggota</span>
            </h3>
          </div>

          {topHobbies.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center font-medium">Belum ada data hobi.</p>
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

      {/* ROW 6: EVENT ANALYTICS & INTELLIGENCE SECTION */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
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

        {/* 4 Highlight Event KPI Cards */}
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

        {/* Detailed Event Leaderboards */}
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
