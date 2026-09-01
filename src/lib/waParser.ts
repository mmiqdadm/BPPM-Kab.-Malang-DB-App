import { Member, PendidikanType, PembinaanType, JenjangPembinaanType } from '../types';
import { KECAMATAN_MALANG } from '../data/constants';

export const WA_FORM_TEMPLATE = `Nama Lengkap : 
Nama Panggilan : 
No. HP (WA) : 
Email : 
Tgl Lahir : dd/mm/yyyy
Alamat lengkap : 
Pendidikan Terakhir/saat ini : 
Jurusan : 
Aktivitas Utama : 
Keahlian : 
Hobi : 
Instagram : 
Tiktok : `;

const INDONESIAN_MONTHS: Record<string, string> = {
  januari: '01',
  jan: '01',
  februari: '02',
  feb: '02',
  maret: '03',
  mar: '03',
  april: '04',
  apr: '04',
  mei: '05',
  juni: '06',
  jun: '06',
  juli: '07',
  jul: '07',
  agustus: '08',
  agu: '08',
  ags: '08',
  september: '09',
  sep: '09',
  oktober: '10',
  okt: '10',
  november: '11',
  nov: '11',
  desember: '12',
  des: '12',
};

// Clean empty / placeholder values and strip markdown wrapper symbols
function cleanValue(val: string): string {
  if (!val) return '';
  // Remove markdown bold/italic asterisks, underscores, quotes, leading hyphens/colons
  const trimmed = val
    .trim()
    .replace(/^[*_~'`"“”:\-=\s]+|[*_~'`"“”:\-=\s]+$/g, '')
    .trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === '-' ||
    lower === '--' ||
    lower === '---' ||
    lower === 'tidak ada' ||
    lower === 'tidak punya' ||
    lower === 'belum ada' ||
    lower === 'belum' ||
    lower === 'none' ||
    lower === 'null' ||
    lower === 'n/a' ||
    lower === 'kosong' ||
    lower === 'tdk ada'
  ) {
    return '';
  }
  return trimmed;
}

// Clean and normalize phone number
function normalizePhoneNumber(raw: string): string {
  const cleaned = cleanValue(raw);
  if (!cleaned) return '';
  // Remove non-digit characters except leading plus
  let digits = cleaned.replace(/[^\d+]/g, '');
  if (digits.startsWith('+62')) {
    digits = '0' + digits.substring(3);
  } else if (digits.startsWith('62')) {
    digits = '0' + digits.substring(2);
  }
  return digits;
}

// Parse date string into YYYY-MM-DD
export function parseDateFlexible(raw: string): string {
  const cleaned = cleanValue(raw);
  if (!cleaned) return '2002-01-01';

  // Format 1: dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  const dmyMatch = cleaned.match(/^(\d{1,2})[./\s-](\d{1,2})[./\s-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Format 2: yyyy-mm-dd or yyyy/mm/dd
  const ymdMatch = cleaned.match(/^(\d{4})[./\s-](\d{1,2})[./\s-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Format 3: dd [MonthName] yyyy (e.g. 14 Mei 2001 or 25 Agustus 1999)
  const indonesianMatch = cleaned.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (indonesianMatch) {
    const day = indonesianMatch[1].padStart(2, '0');
    const monthName = indonesianMatch[2].toLowerCase();
    const year = indonesianMatch[3];
    const monthNum = INDONESIAN_MONTHS[monthName];
    if (monthNum) {
      return `${year}-${monthNum}-${day}`;
    }
  }

  // Format 4: Standard Date parsing fallback
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return '2002-01-01';
}

// Parse Education Level
export function parsePendidikanLevel(raw: string): PendidikanType {
  const clean = cleanValue(raw);
  if (!clean) return 'S1';
  const upper = clean.toUpperCase().trim();

  // Check specific degrees with regex word boundaries to avoid substring confusion (e.g. DIPLOMA containing 'MA')
  if (/\b(S3|S-3|DOKTOR|STRATA\s*3)\b/i.test(upper)) return 'S3';
  if (/\b(S2|S-2|MAGISTER|MASTER|STRATA\s*2)\b/i.test(upper)) return 'S2';
  if (/\b(DIPLOMA|D3|D-3|D4|D-4|D1|D-1|D2|D-2|AKADEMI)\b/i.test(upper)) return 'Diploma';
  if (/\b(S1|S-1|SARJANA|STRATA\s*1)\b/i.test(upper)) return 'S1';
  if (/\b(SMA|SMK|SLTA|STM|SMEA|ALIYAH)\b/i.test(upper) || /\bMA\b/.test(upper)) return 'SMA';
  if (/\b(SMP|MTS|SLTP|TSANAWIYAH)\b/i.test(upper)) return 'SMP';
  if (/\b(SD|MI|IBTIDAIYAH|SEKOLAH\s*DASAR)\b/i.test(upper)) return 'SD';
  if (/\b(TK|PAUD|TAMAN\s*KANAK[- ]?KANAK)\b/i.test(upper)) return 'TK';
  if (upper.includes('LAIN')) return 'lain-lain';

  return 'S1'; // Default
}

// Auto-detect Domicile (Kecamatan di Kab. Malang) from text
export function detectKecamatan(text: string): string {
  if (!text) return 'Kepanjen';
  const clean = text.toLowerCase();

  // Exact / word match against KECAMATAN_MALANG
  for (const kec of KECAMATAN_MALANG) {
    const kLower = kec.toLowerCase();
    // Use regex word boundary to avoid false substring matches
    const regex = new RegExp(`\\b${kLower}\\b`, 'i');
    if (regex.test(clean)) {
      return kec;
    }
  }

  return 'Kepanjen';
}

// Clean Social Media Handle
function cleanSocialHandle(raw: string): string {
  const cleaned = cleanValue(raw);
  if (!cleaned) return '';

  // Extract from URL (e.g. https://instagram.com/username or instagram.com/username)
  const urlMatch = cleaned.match(/(?:instagram\.com|tiktok\.com|twitter\.com|x\.com)\/([a-zA-Z0-9._-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return `@${urlMatch[1]}`;
  }

  // If already starts with @, keep it
  if (cleaned.startsWith('@')) {
    return cleaned;
  }

  // If pure username, add @
  if (/^[a-zA-Z0-9._-]+$/.test(cleaned)) {
    return `@${cleaned}`;
  }

  return cleaned;
}

// Parse comma/semicolon/bullet-separated list
function parseListItems(raw: string): string[] {
  const cleaned = cleanValue(raw);
  if (!cleaned) return [];

  return cleaned
    .replace(/^[-*•\d+.)\s]+/gm, '') // remove leading bullets from multiline
    .split(/[,;\n/]+/)
    .map(s => cleanValue(s.replace(/^[-*•\d+.)\s]+/, '')))
    .filter(s => s.length > 0);
}

export interface ParsedWAMember extends Omit<Member, 'id' | 'createdAt' | 'updatedAt'> {
  detectedFieldsCount: number;
  rawPastedText: string;
}

/**
 * Main parser for WhatsApp Form text
 */
export function parseWhatsAppFormText(text: string): ParsedWAMember {
  if (!text || !text.trim()) {
    return {
      nama: '',
      namaPanggilan: '',
      isAnakKader: false,
      nomorHp: '',
      organisasiInternal: ['Belum'],
      tglLahir: '2002-01-01',
      sosmed: {},
      email: '',
      domisili: 'Kepanjen',
      alamatDetail: '',
      aktivitas: '',
      pendidikan: 'S1',
      jurusan: '',
      keahlian: [],
      hobi: [],
      pembinaan: 'Belum Pernah',
      jenjangPembinaan: undefined,
      namaPembina: '',
      catatanTambahan: '',
      createdBy: 'Import Form WA',
      detectedFieldsCount: 0,
      rawPastedText: '',
    };
  }

  const lines = text.split('\n');
  const kvMap: Record<string, string> = {};
  let currentKey = '';
  let currentValue = '';

  // Patterns for keys supporting markdown *bold* and _italic_
  const KEY_PATTERNS: { key: string; regex: RegExp }[] = [
    { key: 'nama_lengkap', regex: /^[*_~#\s\d.)-]*nama\s+lengkap\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'nama_panggilan', regex: /^[*_~#\s\d.)-]*nama\s+panggilan\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'nama', regex: /^[*_~#\s\d.)-]*nama\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'nomor_hp', regex: /^[*_~#\s\d.)-]*(?:no\.?\s*hp|nomor\s*hp|wa|whatsapp|no\.?\s*wa|telepon|handphone|telp)\s*(?:\(wa\)|\(whatsapp\))?\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'tgl_lahir', regex: /^[*_~#\s\d.)-]*(?:tgl\.?\s*lahir|tanggal\s*lahir|ttl|tgl\s*lahir)\s*(?:\(dd\/mm\/yyyy\)|\(dd-mm-yyyy\))?\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'alamat', regex: /^[*_~#\s\d.)-]*(?:alamat\s*lengkap|alamat|domisili|tempat\s*tinggal|lokasi)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'pendidikan', regex: /^[*_~#\s\d.)-]*(?:pendidikan\s*terakhir\/saat\s*ini|pendidikan\s*terakhir|pendidikan\s*saat\s*ini|pendidikan|jenjang\s*pendidikan)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'jurusan', regex: /^[*_~#\s\d.)-]*(?:jurusan|program\s*studi|prodi)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'aktivitas', regex: /^[*_~#\s\d.)-]*(?:aktivitas\s*utama|aktivitas|pekerjaan|kesibukan|profesi|kegiatan)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'keahlian', regex: /^[*_~#\s\d.)-]*(?:keahlian|skill|keterampilan|potensi)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'hobi', regex: /^[*_~#\s\d.)-]*(?:hobi|minat|kegemaran)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'instagram', regex: /^[*_~#\s\d.)-]*(?:instagram|ig)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'tiktok', regex: /^[*_~#\s\d.)-]*(?:tiktok|tt|tik\s*tok)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'email', regex: /^[*_~#\s\d.)-]*(?:email|surel)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'organisasi', regex: /^[*_~#\s\d.)-]*(?:organisasi\s*internal|organisasi|sayap)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'pembinaan', regex: /^[*_~#\s\d.)-]*(?:status\s*pembinaan|pembinaan|liqo|halaqah)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'jenjang_pembinaan', regex: /^[*_~#\s\d.)-]*(?:jenjang\s*pembinaan|jenjang)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'nama_pembina', regex: /^[*_~#\s\d.)-]*(?:nama\s*pembina|pembina|murabbi|mentor)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
    { key: 'catatan', regex: /^[*_~#\s\d.)-]*(?:catatan\s*tambahan|catatan|keterangan|notes?)\s*[*_~]*\s*[:=\-]\s*[*_~]*/i },
  ];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    let matchedKey: string | null = null;
    let matchedPrefix = '';

    for (const p of KEY_PATTERNS) {
      const match = trimmed.match(p.regex);
      if (match) {
        matchedKey = p.key;
        matchedPrefix = match[0];
        break;
      }
    }

    if (matchedKey) {
      // Save previous key-value
      if (currentKey) {
        kvMap[currentKey] = currentValue.trim();
      }
      currentKey = matchedKey;
      currentValue = trimmed.substring(matchedPrefix.length).trim();
    } else {
      // Continuation of previous key's multiline value (e.g. address or bulleted skills)
      if (currentKey) {
        currentValue += '\n' + trimmed;
      }
    }
  }

  // Save the last key
  if (currentKey) {
    kvMap[currentKey] = currentValue.trim();
  }

  // Extract individual fields
  const rawNamaLengkap = kvMap['nama_lengkap'] || kvMap['nama'] || '';
  const rawNamaPanggilan = kvMap['nama_panggilan'] || '';
  const rawNomorHp = kvMap['nomor_hp'] || '';
  const rawTglLahir = kvMap['tgl_lahir'] || '';
  const rawAlamat = kvMap['alamat'] || '';
  const rawPendidikan = kvMap['pendidikan'] || '';
  const rawJurusan = kvMap['jurusan'] || '';
  const rawAktivitas = kvMap['aktivitas'] || '';
  const rawKeahlian = kvMap['keahlian'] || '';
  const rawHobi = kvMap['hobi'] || '';
  const rawInstagram = kvMap['instagram'] || '';
  const rawTiktok = kvMap['tiktok'] || '';
  const rawEmail = kvMap['email'] || '';
  const rawOrganisasi = kvMap['organisasi'] || '';
  const rawPembinaan = kvMap['pembinaan'] || '';
  const rawJenjang = kvMap['jenjang_pembinaan'] || '';
  const rawPembina = kvMap['nama_pembina'] || '';
  const rawCatatan = kvMap['catatan'] || '';

  // Clean values
  const nama = cleanValue(rawNamaLengkap);
  const namaPanggilan = cleanValue(rawNamaPanggilan) || undefined;
  const nomorHp = normalizePhoneNumber(rawNomorHp);
  const tglLahir = parseDateFlexible(rawTglLahir);
  const alamatDetail = cleanValue(rawAlamat);
  const domisili = detectKecamatan(alamatDetail);
  const pendidikan = parsePendidikanLevel(rawPendidikan);
  
  let jurusan = cleanValue(rawJurusan);
  // If jurusan is blank but pendidikan contains major (e.g. "S1 Teknik Informatika")
  if (!jurusan && rawPendidikan) {
    const eduCleaned = rawPendidikan.replace(/^(S1|S2|S3|SMA|SMK|D3|Diploma|Sarjana)\s*[-/:]?\s*/i, '').trim();
    if (eduCleaned.length > 2 && eduCleaned.toLowerCase() !== rawPendidikan.toLowerCase()) {
      jurusan = eduCleaned;
    }
  }

  const aktivitas = cleanValue(rawAktivitas);
  const keahlian = parseListItems(rawKeahlian);
  const hobi = parseListItems(rawHobi);

  const instagram = cleanSocialHandle(rawInstagram);
  const tiktok = cleanSocialHandle(rawTiktok);

  // Parse Pembinaan if provided (Default: Belum Pernah)
  let pembinaan: PembinaanType = 'Belum Pernah';
  if (rawPembinaan) {
    const pLow = rawPembinaan.toLowerCase();
    if (pLow.includes('sudah') || pLow.includes('aktif') || pLow.includes('ikut') || pLow.includes('halaqah') || pLow.includes('liqo')) pembinaan = 'Sudah';
    else if (pLow.includes('pernah') && (pLow.includes('tidak') || pLow.includes('sedang'))) pembinaan = 'Pernah, tapi sedang tidak';
    else if (pLow.includes('belum')) pembinaan = 'Belum Pernah';
  }

  let jenjangPembinaan: JenjangPembinaanType | undefined = undefined;
  if (pembinaan === 'Sudah') {
    const jUpper = (rawJenjang || '').toUpperCase();
    if (jUpper.includes('PRATAMA')) jenjangPembinaan = 'Pratama';
    else if (jUpper.includes('MADYA')) jenjangPembinaan = 'Madya';
    else jenjangPembinaan = 'Muda';
  }

  const namaPembina = cleanValue(rawPembina) || undefined;

  // Organisasi internal default
  let organisasiInternal = ['Belum'];
  if (rawOrganisasi) {
    const orgItems = parseListItems(rawOrganisasi);
    if (orgItems.length > 0) {
      organisasiInternal = orgItems;
    }
  }

  // Count how many actual fields were detected
  let detectedFieldsCount = 0;
  if (nama) detectedFieldsCount++;
  if (namaPanggilan) detectedFieldsCount++;
  if (nomorHp) detectedFieldsCount++;
  if (cleanValue(rawEmail)) detectedFieldsCount++;
  if (rawTglLahir && cleanValue(rawTglLahir)) detectedFieldsCount++;
  if (alamatDetail) detectedFieldsCount++;
  if (rawPendidikan && cleanValue(rawPendidikan)) detectedFieldsCount++;
  if (jurusan) detectedFieldsCount++;
  if (aktivitas) detectedFieldsCount++;
  if (keahlian.length > 0) detectedFieldsCount++;
  if (hobi.length > 0) detectedFieldsCount++;
  if (instagram) detectedFieldsCount++;
  if (tiktok) detectedFieldsCount++;

  return {
    nama,
    namaPanggilan,
    isAnakKader: false,
    nomorHp,
    organisasiInternal,
    tglLahir,
    sosmed: {
      instagram: instagram || undefined,
      tiktok: tiktok || undefined,
    },
    email: cleanValue(rawEmail),
    domisili,
    alamatDetail,
    aktivitas,
    pendidikan,
    jurusan,
    keahlian,
    hobi,
    pembinaan,
    jenjangPembinaan,
    namaPembina,
    catatanTambahan: cleanValue(rawCatatan),
    createdBy: 'Import Form WA',
    detectedFieldsCount,
    rawPastedText: text,
  };
}
