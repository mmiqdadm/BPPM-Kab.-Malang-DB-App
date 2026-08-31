import React, { useState, useMemo } from 'react';
import { Member, EventItem, EventAttendance } from '../types';
import { calculateAge, formatDateIndonesian, formatWhatsAppLink, getActivityRating, getDapilByKecamatan } from '../lib/utils';
import { exportSingleMemberCardPDF } from '../lib/export';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  GraduationCap,
  Award,
  Heart,
  MessageSquare,
  Printer,
  Sparkles,
  ExternalLink,
  Pencil,
  CalendarCheck,
  Star,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MemberDetailModalProps {
  member: Member | null;
  events?: EventItem[];
  attendances?: EventAttendance[];
  onClose: () => void;
  onEdit: (m: Member) => void;
  canEdit?: boolean;
}

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({
  member,
  events = [],
  attendances = [],
  onClose,
  onEdit,
  canEdit = true,
}) => {
  const [showAllEvents, setShowAllEvents] = useState(false);

  // Compute attended events for this member
  const attendedEvents = useMemo(() => {
    if (!member) return [];
    const memberNameClean = (member.nama || '').toLowerCase().trim();
    const matchedAttendances = attendances.filter(
      att =>
        att &&
        (att.memberId === member.id ||
          (att.namaPeserta && att.namaPeserta.toLowerCase().trim() === memberNameClean))
    );

    const eventMap = new Map<string, { event: EventItem; waktuPresensi: string }>();

    matchedAttendances.forEach(att => {
      const ev = events.find(e => e.id === att.eventId);
      if (ev && !eventMap.has(ev.id)) {
        eventMap.set(ev.id, { event: ev, waktuPresensi: att.waktuPresensi });
      }
    });

    return Array.from(eventMap.values());
  }, [member, events, attendances]);

  if (!member) return null;

  const age = calculateAge(member.tglLahir);
  const waLink = formatWhatsAppLink(member.nomorHp);
  const dapilName = getDapilByKecamatan(member.domisili);

  const activityRating = getActivityRating(attendedEvents.length, events.length);
  const displayedEvents = showAllEvents ? attendedEvents : attendedEvents.slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl relative my-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center space-x-2">
            <span className="bg-orange-50 text-[#F27D26] border border-orange-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
              ID: {member.id}
            </span>
            <span className="text-xs text-slate-500 font-medium">Biodata Anggota</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => exportSingleMemberCardPDF(member)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
              title="Download PDF Card"
            >
              <Printer className="w-3.5 h-3.5 text-[#F27D26]" />
              <span className="hidden sm:inline">Cetak PDF</span>
            </button>
            {canEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(member);
                }}
                className="px-3 py-1.5 bg-[#F27D26] hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center space-x-1"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Main Profile Header */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex flex-wrap items-center gap-2">
                  <span>{member.nama}</span>
                  {member.namaPanggilan && (
                    <span className="text-sm sm:text-base font-bold text-[#F27D26] bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
                      ({member.namaPanggilan})
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="bg-orange-50 text-[#F27D26] border border-orange-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                    <MapPin className="w-3 h-3" />
                    <span>Kec. {member.domisili || 'Malang'}</span>
                  </span>

                  {dapilName && (
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {dapilName}
                    </span>
                  )}

                  {age > 0 && (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      Usia {age} Tahun
                    </span>
                  )}

                  {/* Rating Keaktifan Badge */}
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center space-x-1 ${activityRating.badgeClass}`}
                  >
                    <span>{activityRating.label}</span>
                  </span>

                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      member.pembinaan === 'Sudah'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : member.pembinaan === 'Belum Pernah'
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    Pembinaan: {member.pembinaan} {member.pembinaan === 'Sudah' && member.jenjangPembinaan ? `(${member.jenjangPembinaan})` : ''}
                  </span>

                  {member.isAnakKader && (
                    <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                      <span>👑 Anak Kader PKS</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Direct WhatsApp Action Button */}
              {member.nomorHp && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex-shrink-0"
                >
                  <Phone className="w-4 h-4" />
                  <span>Kirim WhatsApp</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Organisasi Internal Tags */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center space-x-2">
              <span className="text-xs font-medium text-slate-500">Organisasi Internal:</span>
              <div className="flex flex-wrap gap-1.5">
                {(member.organisasiInternal || []).map(org => (
                  <span
                    key={org}
                    className="bg-white text-[#F27D26] border border-orange-200 text-xs font-bold px-2.5 py-0.5 rounded-full"
                  >
                    {org}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* LINKED SECTION: Kegiatan Internal Yang Pernah Diikuti (Auto Linking) */}
          <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 p-4 rounded-xl border border-orange-200 space-y-3">
            <div className="flex items-center justify-between border-b border-orange-200/80 pb-2">
              <div className="flex items-center space-x-1.5">
                <CalendarCheck className="w-4 h-4 text-[#F27D26]" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Kegiatan Internal Yang Pernah Diikuti ({attendedEvents.length})
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                Data Otomatis (Non-Editable)
              </span>
            </div>

            {attendedEvents.length === 0 ? (
              <p className="text-xs text-slate-500 font-medium italic py-2">
                Belum ada rekam kehadiran event dalam sistem. Data akan terisi otomatis saat peserta hadir dalam kegiatan.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  {displayedEvents.map(item => (
                    <div
                      key={item.event.id}
                      className="bg-white p-2.5 rounded-xl border border-orange-200/80 flex items-center justify-between text-xs shadow-2xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{item.event.namaEvent}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Lokasi: {item.event.lokasi} • Organisasi: {item.event.organisasiHandling}
                        </div>
                      </div>
                      <span className="bg-orange-50 text-[#F27D26] border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ml-2">
                        {formatDateIndonesian(item.event.waktu)}
                      </span>
                    </div>
                  ))}
                </div>

                {attendedEvents.length > 3 && (
                  <button
                    onClick={() => setShowAllEvents(!showAllEvents)}
                    className="w-full text-center text-xs font-bold text-[#F27D26] hover:underline pt-1 flex items-center justify-center space-x-1"
                  >
                    <span>
                      {showAllEvents
                        ? 'Sembunyikan Sebagian'
                        : `Lihat Selengkapnya (${attendedEvents.length - 3} Event Lainnya)`}
                    </span>
                    {showAllEvents ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Grid Info Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact & Personal */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-[#F27D26] uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
                <Phone className="w-3.5 h-3.5" />
                <span>Kontak & Personal</span>
              </div>

              <div className="text-xs space-y-2 text-slate-700 font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor HP/WA:</span>
                  <span className="font-semibold text-slate-900">{member.nomorHp || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-semibold text-slate-900">{member.email || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal Lahir:</span>
                  <span className="font-semibold text-slate-900">
                    {member.tglLahir ? formatDateIndonesian(member.tglLahir) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Alamat Lengkap:</span>
                  <span className="font-semibold text-slate-900 text-right">{member.alamatDetail || '-'}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Status Anak Kader:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-xs ${member.isAnakKader ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'}`}>
                    {member.isAnakKader ? '👑 Ya (Anak Kader PKS)' : 'Bukan Anak Kader'}
                  </span>
                </div>
              </div>
            </div>

            {/* Education & Occupation */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Pendidikan & Aktivitas</span>
              </div>

              <div className="text-xs space-y-2 text-slate-700 font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-500">Pendidikan:</span>
                  <span className="font-semibold text-slate-900">{member.pendidikan || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jurusan:</span>
                  <span className="font-semibold text-slate-900">{member.jurusan || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Aktivitas Utama:</span>
                  <span className="font-semibold text-slate-900">{member.aktivitas || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated Section: Informasi Pembinaan Kader (Jika 'Sudah') */}
          {member.pembinaan === 'Sudah' && (
            <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl space-y-3">
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center space-x-1.5 border-b border-amber-200/80 pb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Informasi Pembinaan Kader</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-amber-200/60">
                  <span className="text-slate-500 font-medium">Jenjang Pembinaan:</span>
                  <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    {member.jenjangPembinaan || 'Muda'}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-amber-200/60">
                  <span className="text-slate-500 font-medium">Nama Pembina / Mentor:</span>
                  <span className="font-bold text-slate-900">
                    {member.namaPembina || '-'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Skills & Hobbies */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div>
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
                <Award className="w-3.5 h-3.5" />
                <span>Keahlian & Skill</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(member.keahlian || []).length === 0 ? (
                  <span className="text-xs text-slate-400 font-medium">- Tidak ada data keahlian -</span>
                ) : (
                  member.keahlian.map(s => (
                    <span
                      key={s}
                      className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-lg"
                    >
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <div className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
                <Heart className="w-3.5 h-3.5" />
                <span>Hobi & Minat</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(member.hobi || []).length === 0 ? (
                  <span className="text-xs text-slate-400 font-medium">- Tidak ada data hobi -</span>
                ) : (
                  member.hobi.map(h => (
                    <span
                      key={h}
                      className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold px-2.5 py-1 rounded-lg"
                    >
                      {h}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Social Media & Admin Notes */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Media Sosial & Catatan Tambahan</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-medium">Instagram:</span>
                <span className="font-semibold text-slate-900">{member.sosmed?.instagram || '-'}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-medium">TikTok:</span>
                <span className="font-semibold text-slate-900">{member.sosmed?.tiktok || '-'}</span>
              </div>
            </div>

            {member.catatanTambahan && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-slate-500 block mb-1">Catatan Tambahan:</span>
                <p className="text-xs text-slate-700 font-medium bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                  {member.catatanTambahan}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
