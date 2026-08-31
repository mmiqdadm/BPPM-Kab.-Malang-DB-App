export type OrganisasiType = string;

export type PendidikanType = 'TK' | 'SD' | 'SMP' | 'SMA' | 'Diploma' | 'S1' | 'S2' | 'S3' | 'lain-lain';

export type PembinaanType = 'Sudah' | 'Belum Pernah' | 'Pernah, tapi sedang tidak';

export type JenjangPembinaanType = 'Muda' | 'Pratama' | 'Madya';

export type ActivityRatingLevel = 'Pasif' | 'Cukup Aktif' | 'Aktif' | 'Sangat Aktif';

export interface SosmedInfo {
  instagram?: string;
  tiktok?: string;
  twitter?: string;
  facebook?: string;
}

export interface Member {
  id: string;
  nama: string; // Mandatory
  nomorHp: string;
  organisasiInternal: OrganisasiType[]; // Checklist multi-select
  tglLahir: string; // YYYY-MM-DD
  sosmed: SosmedInfo;
  email: string;
  domisili: string; // Kecamatan di Kab. Malang
  alamatDetail?: string;
  aktivitas: string; // Pekerjaan/kegiatan utama
  pendidikan: PendidikanType;
  jurusan: string;
  keahlian: string[]; // List of skills
  hobi: string[]; // List of hobbies
  pembinaan: PembinaanType;
  jenjangPembinaan?: JenjangPembinaanType; // Khusus jika pembinaan === 'Sudah'
  namaPembina?: string; // Khusus jika pembinaan === 'Sudah'
  catatanTambahan: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  createdBy?: string;
}

export interface EventItem {
  id: string;
  namaEvent: string; // Mandatory
  waktu: string; // YYYY-MM-DDTHH:mm or ISO
  lokasi: string;
  organisasiHandling: OrganisasiType;
  deskripsi?: string;
  createdAt: string;
  createdBy?: string;
}

export interface EventAttendance {
  id: string;
  eventId: string;
  memberId?: string; // Optional linked member ID
  namaPeserta: string; // Mandatory
  nomorHp: string;
  domisili: string;
  sosmed: string;
  waktuPresensi: string; // ISO string
}

export type AdminRole = 'superadmin' | 'admin' | 'viewer';

export interface AdminUser {
  id: string;
  username: string; // Login ID
  name: string;
  passwordHash: string;
  role: AdminRole;
  createdAt: string;
}

export interface FilterOptions {
  search: string;
  organisasi: OrganisasiType[];
  pembinaan: PembinaanType | 'Semua';
  jenjangPembinaan?: JenjangPembinaanType | 'Semua';
  pendidikan: PendidikanType | 'Semua';
  domisili: string | 'Semua';
  dapil: string | 'Semua';
  eventId: string | 'Semua';
  keaktifan: ActivityRatingLevel | 'Semua';
  minAge: number | '';
  maxAge: number | '';
  sortBy:
    | 'nama_asc'
    | 'nama_desc'
    | 'usia_asc'
    | 'usia_desc'
    | 'terbaru'
    | 'terlama'
    | 'pendidikan'
    | 'keaktifan_desc';
}
