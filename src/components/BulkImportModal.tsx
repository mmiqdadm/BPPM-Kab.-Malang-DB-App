import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Member, OrganisasiType, PendidikanType, PembinaanType, JenjangPembinaanType } from '../types';
import { WA_FORM_TEMPLATE, parseWhatsAppFormText, parsePendidikanLevel, ParsedWAMember } from '../lib/waParser';
import { calculateAge, getDapilByKecamatan } from '../lib/utils';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  MessageSquare,
  User,
  Phone,
  MapPin,
  GraduationCap,
  Briefcase,
  Award,
  Heart,
  ExternalLink,
} from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportConfirm: (membersToImport: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
  existingMembers?: Member[];
  onOpenInForm?: (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

// Robust CSV/TSV single-line parser respecting quotes
function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Auto detect delimiter
function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0] || '';
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';') && !firstLine.includes(',')) return ';';
  return ',';
}

// Build dynamic column index mapping from detected headers
function buildHeaderColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, idx) => {
    const clean = String(h || '').toLowerCase().trim();
    if (clean.includes('nama pembina') || clean.includes('nama_pembina') || clean.includes('pembina')) {
      map['pembina'] = idx;
    } else if (clean.includes('jenjang')) {
      map['jenjang'] = idx;
    } else if (clean === 'nama' || clean.includes('nama lengkap') || clean.includes('nama_lengkap') || (clean.includes('nama') && !clean.includes('pembina'))) {
      map['nama'] = idx;
    } else if (clean.includes('hp') || clean.includes('telp') || clean.includes('wa') || clean.includes('telepon') || clean.includes('handphone')) {
      map['hp'] = idx;
    } else if (clean.includes('organisasi') || clean.includes('sayap') || clean.includes('org')) {
      map['org'] = idx;
    } else if (clean.includes('lahir') || clean.includes('tgl') || clean.includes('birth')) {
      map['tgl'] = idx;
    } else if (clean.includes('email') || clean.includes('surel')) {
      map['email'] = idx;
    } else if (clean.includes('domisili') || clean.includes('kecamatan') || clean.includes('wilayah') || clean.includes('kota')) {
      map['dom'] = idx;
    } else if (clean.includes('alamat')) {
      map['alamat'] = idx;
    } else if (clean.includes('aktivitas') || clean.includes('pekerjaan') || clean.includes('profesi') || clean.includes('kegiatan')) {
      map['akt'] = idx;
    } else if (clean.includes('pendidikan') || clean.includes('edu')) {
      map['edu'] = idx;
    } else if (clean.includes('jurusan') || clean.includes('prodi')) {
      map['jur'] = idx;
    } else if (clean.includes('keahlian') || clean.includes('skill')) {
      map['skill'] = idx;
    } else if (clean.includes('hobi') || clean.includes('minat')) {
      map['hobi'] = idx;
    } else if (clean.includes('pembinaan') || clean.includes('status pembinaan')) {
      map['pem'] = idx;
    } else if (clean.includes('catatan') || clean.includes('keterangan') || clean.includes('note')) {
      map['catatan'] = idx;
    }
  });
  return map;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImportConfirm,
  existingMembers = [],
  onOpenInForm,
}) => {
  const [activeTab, setActiveTab] = useState<'wa' | 'text' | 'file'>('wa');
  const [waPastedText, setWaPastedText] = useState('');
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const [pastedText, setPastedText] = useState('');
  const [parsedItems, setParsedItems] = useState<Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Live parse WhatsApp response text
  const parsedWAMember: ParsedWAMember = useMemo(() => {
    return parseWhatsAppFormText(waPastedText);
  }, [waPastedText]);

  // Check if parsed WA member has duplicate in existing database
  const isWADuplicate = useMemo(() => {
    if (!parsedWAMember.nama && !parsedWAMember.nomorHp) return false;
    const cleanName = parsedWAMember.nama.toLowerCase().trim();
    const cleanHp = parsedWAMember.nomorHp.replace(/\D/g, '');

    return (existingMembers || []).some(m => {
      const mName = (m.nama || '').toLowerCase().trim();
      const mHp = (m.nomorHp || '').replace(/\D/g, '');
      if (cleanName && mName === cleanName) return true;
      if (cleanHp.length >= 8 && mHp.length >= 8 && (cleanHp === mHp || cleanHp.slice(-8) === mHp.slice(-8))) {
        return true;
      }
      return false;
    });
  }, [parsedWAMember, existingMembers]);

  // Duplicate name confirmation step for bulk items
  const [isReviewingDuplicates, setIsReviewingDuplicates] = useState(false);
  const [duplicateActions, setDuplicateActions] = useState<Record<number, 'add_new' | 'skip'>>({});

  // Check duplicate items against existing database (Hook must always run before early return!)
  const duplicateIndexes = useMemo(() => {
    const map = new Map<number, Member>();
    parsedItems.forEach((item, idx) => {
      const matched = (existingMembers || []).find(
        m => m && m.nama && item && item.nama && m.nama.toLowerCase().trim() === item.nama.toLowerCase().trim()
      );
      if (matched) {
        map.set(idx, matched);
      }
    });
    return map;
  }, [parsedItems, existingMembers]);

  // Reset internal states on open
  React.useEffect(() => {
    if (isOpen) {
      setWaPastedText('');
      setCopiedTemplate(false);
      setPastedText('');
      setParsedItems([]);
      setParseErrors([]);
      setIsProcessing(false);
      setIsReviewingDuplicates(false);
      setDuplicateActions({});
    }
  }, [isOpen]);

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(WA_FORM_TEMPLATE);
    setCopiedTemplate(true);
    setTimeout(() => {
      setCopiedTemplate(false);
    }, 2500);
  };

  const handleOpenWAInForm = () => {
    if (!parsedWAMember.nama.trim()) {
      setParseErrors(['Nama Lengkap tidak terdeteksi dari teks WA. Pastikan format mengandung "Nama Lengkap : "']);
      return;
    }
    if (onOpenInForm) {
      onOpenInForm(parsedWAMember);
      onClose();
    }
  };

  const handleAddWAToBulkList = () => {
    if (!parsedWAMember.nama.trim()) {
      setParseErrors(['Nama Lengkap tidak terdeteksi dari teks WA.']);
      return;
    }
    setParsedItems(prev => [...prev, parsedWAMember]);
    setWaPastedText('');
    setParseErrors([]);
  };

  if (!isOpen) return null;

  // Sample CSV template generator
  const downloadSampleCSV = () => {
    const sampleHeaders = [
      'Nama',
      'Nomor HP',
      'Organisasi Internal',
      'Tanggal Lahir',
      'Email',
      'Domisili',
      'Alamat Detail',
      'Aktivitas',
      'Pendidikan',
      'Jurusan',
      'Keahlian',
      'Hobi',
      'Pembinaan',
      'Jenjang Pembinaan',
      'Nama Pembina',
      'Catatan',
    ];

    const sampleRow1 = [
      'Budi Santoso',
      '081234567890',
      '"PKS Muda, GK"',
      '2002-08-17',
      'budi.santoso@gmail.com',
      'Kepanjen',
      'Jl. Merdeka No. 12',
      'Mahasiswa UB',
      'S1',
      'Informatika',
      '"Web Development; Design Grafis"',
      '"Futsal; Gowes"',
      'Sudah',
      'Pratama',
      'Ust. Ahmad',
      'Kader aktif dapil 1',
    ];

    const sampleRow2 = [
      'Dewi Saraswati',
      '082198765432',
      'BPPM',
      '2004-03-25',
      'dewi.saras@yahoo.com',
      'Singosari',
      'Jl. Tumapel No. 5',
      'Mahasiswi UM',
      'S1',
      'Pendidikan Inggris',
      '"Public Speaking; MC"',
      '"Membaca; Writing"',
      'Belum Pernah',
      '',
      '',
      'Berminat jadi MC kegiatan',
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [sampleHeaders.join(','), sampleRow1.join(','), sampleRow2.join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Template_Import_Anggota_PKS_Muda.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper function to format date strings safely
  const formatBirthDate = (rawDate: any): string => {
    if (!rawDate) return '2002-01-01';
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      return rawDate.toISOString().slice(0, 10);
    }
    const str = String(rawDate).trim();
    if (!str) return '2002-01-01';

    // Handle DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return '2002-01-01';
  };

  // Helper function to map raw row array/object into Member object
  const mapRowToMember = (
    nama: string,
    hp: string,
    orgStr: string,
    tgl: any,
    email: string,
    dom: string,
    alamat: string,
    akt: string,
    edu: string,
    jur: string,
    skillStr: string,
    hobiStr: string,
    pem: string,
    catatan: string,
    jenjangStr?: string,
    pembinaStr?: string
  ): Omit<Member, 'id' | 'createdAt' | 'updatedAt'> | null => {
    const cleanNama = (nama || '').trim();
    if (!cleanNama) return null;

    // Parse internal org checklist (delimited by comma, semicolon, or slash)
    const rawOrgs = (orgStr || '')
      .replace(/["']/g, '')
      .split(/[,;/]+/)
      .map(o => o.trim())
      .filter(Boolean);

    const validOrgs: OrganisasiType[] = [];
    rawOrgs.forEach(o => {
      const upper = o.toUpperCase();
      if (upper.includes('BPPM')) validOrgs.push('BPPM');
      else if (upper.includes('GK') || upper.includes('GARUDA')) validOrgs.push('GK');
      else if (upper.includes('PKS') || upper.includes('MUDA')) validOrgs.push('PKS Muda');
      else if (upper.includes('GEMA')) validOrgs.push('Gema');
      else if (upper.includes('NGOPI')) validOrgs.push('Ngopi');
      else if (upper.includes('BELUM')) validOrgs.push('Belum');
      else if (o) validOrgs.push(o as OrganisasiType);
    });

    if (validOrgs.length === 0) validOrgs.push('PKS Muda');

    // Parse education
    const cleanEdu: PendidikanType = parsePendidikanLevel(edu);

    // Parse Pembinaan (Default: Belum Pernah)
    let cleanPem: PembinaanType = 'Belum Pernah';
    const pemUpper = (pem || '').toLowerCase();
    if (pemUpper.includes('sudah') || pemUpper.includes('aktif') || pemUpper.includes('ya')) cleanPem = 'Sudah';
    else if (pemUpper.includes('pernah') && (pemUpper.includes('tidak') || pemUpper.includes('bukan') || pemUpper.includes('sedang'))) cleanPem = 'Pernah, tapi sedang tidak';
    else if (pemUpper.includes('belum')) cleanPem = 'Belum Pernah';

    let cleanJenjang: JenjangPembinaanType | undefined = undefined;
    let cleanPembina: string | undefined = undefined;

    if (cleanPem === 'Sudah') {
      const jUpper = (jenjangStr || '').toUpperCase();
      if (jUpper.includes('PRATAMA')) cleanJenjang = 'Pratama';
      else if (jUpper.includes('MADYA')) cleanJenjang = 'Madya';
      else cleanJenjang = 'Muda';

      if (pembinaStr && pembinaStr.trim() && pembinaStr.trim() !== '-') {
        cleanPembina = pembinaStr.trim();
      }
    }

    // Parse skills & hobbies
    const skillsList = (skillStr || '')
      .replace(/["']/g, '')
      .split(/[,;/]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const hobbiesList = (hobiStr || '')
      .replace(/["']/g, '')
      .split(/[,;/]+/)
      .map(h => h.trim())
      .filter(Boolean);

    const cleanDate = formatBirthDate(tgl);

    return {
      nama: cleanNama,
      nomorHp: (hp || '').trim(),
      organisasiInternal: Array.from(new Set(validOrgs)),
      tglLahir: cleanDate,
      sosmed: {},
      email: (email || '').trim(),
      domisili: (dom || '').trim() || 'Kepanjen',
      alamatDetail: (alamat || '').trim(),
      aktivitas: (akt || '').trim(),
      pendidikan: cleanEdu,
      jurusan: (jur || '').trim(),
      keahlian: skillsList,
      hobi: hobbiesList,
      pembinaan: cleanPem,
      jenjangPembinaan: cleanJenjang,
      namaPembina: cleanPembina,
      catatanTambahan: (catatan || '').trim(),
      createdBy: 'Import Bulk',
    };
  };

  // Parse Text Input (CSV or Tab-separated format)
  const parsePastedText = (): Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[] => {
    setParseErrors([]);
    if (!pastedText.trim()) {
      setParseErrors(['Teks import masih kosong. Tempelkan baris data terlebih dahulu.']);
      return [];
    }

    const lines = pastedText.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];

    const delimiter = detectDelimiter(pastedText);
    const results: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const errors: string[] = [];

    // Check first line for headers
    const firstLineCols = parseDelimitedLine(lines[0], delimiter);
    const isHeaderRow = firstLineCols.some(c => {
      const lower = c.toLowerCase();
      return lower.includes('nama') || lower.includes('telepon') || lower.includes('email') || lower.includes('domisili');
    });

    const headerMap = isHeaderRow ? buildHeaderColumnMap(firstLineCols) : {};
    const startIndex = isHeaderRow ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const cols = parseDelimitedLine(line, delimiter);
      if (cols.length === 0 || !cols.some(c => c.length > 0)) continue;

      let nama = '';
      let hp = '';
      let org = '';
      let tgl: any = '';
      let email = '';
      let dom = '';
      let alamat = '';
      let akt = '';
      let edu = '';
      let jur = '';
      let skills = '';
      let hobi = '';
      let pem = '';
      let jenjang = '';
      let pembina = '';
      let catatan = '';

      if (isHeaderRow && Object.keys(headerMap).length > 0) {
        nama = headerMap['nama'] !== undefined ? cols[headerMap['nama']] : cols[0] || '';
        hp = headerMap['hp'] !== undefined ? cols[headerMap['hp']] : cols[1] || '';
        org = headerMap['org'] !== undefined ? cols[headerMap['org']] : cols[2] || '';
        tgl = headerMap['tgl'] !== undefined ? cols[headerMap['tgl']] : cols[3] || '';
        email = headerMap['email'] !== undefined ? cols[headerMap['email']] : cols[4] || '';
        dom = headerMap['dom'] !== undefined ? cols[headerMap['dom']] : cols[5] || '';
        alamat = headerMap['alamat'] !== undefined ? cols[headerMap['alamat']] : cols[6] || '';
        akt = headerMap['akt'] !== undefined ? cols[headerMap['akt']] : cols[7] || '';
        edu = headerMap['edu'] !== undefined ? cols[headerMap['edu']] : cols[8] || '';
        jur = headerMap['jur'] !== undefined ? cols[headerMap['jur']] : cols[9] || '';
        skills = headerMap['skill'] !== undefined ? cols[headerMap['skill']] : cols[10] || '';
        hobi = headerMap['hobi'] !== undefined ? cols[headerMap['hobi']] : cols[11] || '';
        pem = headerMap['pem'] !== undefined ? cols[headerMap['pem']] : cols[12] || '';
        jenjang = headerMap['jenjang'] !== undefined ? cols[headerMap['jenjang']] : '';
        pembina = headerMap['pembina'] !== undefined ? cols[headerMap['pembina']] : '';
        catatan = headerMap['catatan'] !== undefined ? cols[headerMap['catatan']] : '';
      } else {
        // Positional parsing
        [nama, hp, org, tgl, email, dom, alamat, akt, edu, jur, skills, hobi, pem] = cols;
        const col13 = cols[13] || '';
        const col14 = cols[14] || '';
        const col15 = cols[15] || '';

        if (cols.length >= 16) {
          jenjang = col13;
          pembina = col14;
          catatan = col15;
        } else if (cols.length === 15) {
          jenjang = col13;
          pembina = col14;
        } else {
          catatan = col13;
        }
      }

      const mapped = mapRowToMember(
        nama,
        hp,
        org,
        tgl,
        email,
        dom,
        alamat,
        akt,
        edu,
        jur,
        skills,
        hobi,
        pem,
        catatan,
        jenjang,
        pembina
      );

      if (mapped) {
        results.push(mapped);
      } else {
        errors.push(`Baris ${i + 1}: Nama anggota tidak terdeteksi.`);
      }
    }

    setParsedItems(results);
    setParseErrors(errors);
    return results;
  };

  // Parse Excel / CSV File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

        if (!rawData || rawData.length === 0) {
          setParseErrors(['File Excel/CSV kosong.']);
          setIsProcessing(false);
          return;
        }

        const results: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[] = [];
        const errors: string[] = [];

        // Check header row
        const firstRow = rawData[0] || [];
        const firstRowStr = firstRow.map(c => String(c || '').toLowerCase().trim());
        const isHeaderRow = firstRowStr.some(c => c.includes('nama') || c.includes('hp') || c.includes('domisili') || c.includes('telepon') || c === 'no');

        const headerMap = isHeaderRow ? buildHeaderColumnMap(firstRowStr) : {};
        const startIndex = isHeaderRow ? 1 : 0;

        for (let i = startIndex; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          // Check if row has at least 1 non-empty cell
          const hasData = row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
          if (!hasData) continue;

          // Detect if column 0 is a number (No index)
          const firstCol = String(row[0] || '').trim();
          const offset = !isHeaderRow && firstCol.match(/^\d+$/) ? 1 : 0;

          let nama = '';
          let hp = '';
          let org = '';
          let tgl: any = '';
          let email = '';
          let dom = '';
          let alamat = '';
          let akt = '';
          let edu = '';
          let jur = '';
          let skills = '';
          let hobi = '';
          let pem = '';
          let jenjang = '';
          let pembina = '';
          let catatan = '';

          if (isHeaderRow && Object.keys(headerMap).length > 0) {
            nama = headerMap['nama'] !== undefined ? String(row[headerMap['nama']] || '') : String(row[0] || '');
            hp = headerMap['hp'] !== undefined ? String(row[headerMap['hp']] || '') : String(row[1] || '');
            org = headerMap['org'] !== undefined ? String(row[headerMap['org']] || '') : String(row[2] || '');
            tgl = headerMap['tgl'] !== undefined ? row[headerMap['tgl']] : row[3];
            email = headerMap['email'] !== undefined ? String(row[headerMap['email']] || '') : String(row[4] || '');
            dom = headerMap['dom'] !== undefined ? String(row[headerMap['dom']] || '') : String(row[5] || '');
            alamat = headerMap['alamat'] !== undefined ? String(row[headerMap['alamat']] || '') : String(row[6] || '');
            akt = headerMap['akt'] !== undefined ? String(row[headerMap['akt']] || '') : String(row[7] || '');
            edu = headerMap['edu'] !== undefined ? String(row[headerMap['edu']] || '') : String(row[8] || '');
            jur = headerMap['jur'] !== undefined ? String(row[headerMap['jur']] || '') : String(row[9] || '');
            skills = headerMap['skill'] !== undefined ? String(row[headerMap['skill']] || '') : String(row[10] || '');
            hobi = headerMap['hobi'] !== undefined ? String(row[headerMap['hobi']] || '') : String(row[11] || '');
            pem = headerMap['pem'] !== undefined ? String(row[headerMap['pem']] || '') : String(row[12] || '');
            jenjang = headerMap['jenjang'] !== undefined ? String(row[headerMap['jenjang']] || '') : '';
            pembina = headerMap['pembina'] !== undefined ? String(row[headerMap['pembina']] || '') : '';
            catatan = headerMap['catatan'] !== undefined ? String(row[headerMap['catatan']] || '') : '';
          } else {
            nama = String(row[offset] || '');
            hp = String(row[offset + 1] || '');
            org = String(row[offset + 2] || '');
            tgl = row[offset + 3];
            email = String(row[offset + 4] || '');
            dom = String(row[offset + 5] || '');
            alamat = String(row[offset + 6] || '');
            akt = String(row[offset + 7] || '');
            edu = String(row[offset + 8] || '');
            jur = String(row[offset + 9] || '');
            skills = String(row[offset + 10] || '');
            hobi = String(row[offset + 11] || '');
            pem = String(row[offset + 12] || '');
            const col13 = String(row[offset + 13] || '');
            const col14 = String(row[offset + 14] || '');
            const col15 = String(row[offset + 15] || '');

            if (row[offset + 15] !== undefined) {
              jenjang = col13;
              pembina = col14;
              catatan = col15;
            } else if (row[offset + 14] !== undefined) {
              jenjang = col13;
              catatan = col14;
            } else {
              catatan = col13;
            }
          }

          const mapped = mapRowToMember(
            nama,
            hp,
            org,
            tgl,
            email,
            dom,
            alamat,
            akt,
            edu,
            jur,
            skills,
            hobi,
            pem,
            catatan,
            jenjang,
            pembina
          );

          if (mapped) {
            results.push(mapped);
          } else if (nama.trim()) {
            errors.push(`Baris ${i + 1}: Data nama "${nama}" tidak lengkap/valid.`);
          }
        }

        setParsedItems(results);
        setParseErrors(errors);
      } catch (err: any) {
        console.error('Error reading Excel/CSV file:', err);
        setParseErrors([`Gagal membaca file: ${err?.message || 'Pastikan format file .xlsx atau .csv valid.'}`]);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setParseErrors(['Gagal membuka file dari perangkat.']);
      setIsProcessing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = () => {
    let itemsToProcess = parsedItems;

    // If on text tab and no items parsed yet, auto-parse first
    if (activeTab === 'text' && itemsToProcess.length === 0 && pastedText.trim()) {
      itemsToProcess = parsePastedText();
    }

    if (itemsToProcess.length === 0) return;

    // If duplicates exist and haven't been reviewed yet, enter review step
    if (duplicateIndexes.size > 0 && !isReviewingDuplicates) {
      const initialActions: Record<number, 'add_new' | 'skip'> = {};
      duplicateIndexes.forEach((_, idx) => {
        initialActions[idx] = 'add_new';
      });
      setDuplicateActions(initialActions);
      setIsReviewingDuplicates(true);
      return;
    }

    // Process final list
    const finalItems = itemsToProcess.filter((_, idx) => {
      if (duplicateIndexes.has(idx)) {
        return duplicateActions[idx] !== 'skip';
      }
      return true;
    });

    if (finalItems.length > 0) {
      onImportConfirm(finalItems);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl relative my-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Import Bulk Data Anggota</h3>
              <p className="text-xs text-slate-500 font-medium">
                Masukkan banyak data sekaligus dari Excel, CSV, atau Tempel Teks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* If Duplicate Review Step is active */}
          {isReviewingDuplicates ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-1">
                <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>
                    Konfirmasi {duplicateIndexes.size} Nama Yang Sama Di Database Anggota
                  </span>
                </div>
                <p className="text-amber-700 font-medium">
                  Beberapa nama dalam file import ditemukan sudah terdaftar di database anggota. Pilih tindakan untuk setiap data:
                </p>
                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allSkip: Record<number, 'add_new' | 'skip'> = {};
                      duplicateIndexes.forEach((_, idx) => (allSkip[idx] = 'skip'));
                      setDuplicateActions(allSkip);
                    }}
                    className="px-3 py-1 bg-white border border-amber-300 text-amber-800 rounded-lg font-bold text-[11px] hover:bg-amber-100"
                  >
                    Abaikan Semua Duplikat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allNew: Record<number, 'add_new' | 'skip'> = {};
                      duplicateIndexes.forEach((_, idx) => (allNew[idx] = 'add_new'));
                      setDuplicateActions(allNew);
                    }}
                    className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px] hover:bg-amber-700"
                  >
                    Import Semua Sebagai Baru
                  </button>
                </div>
              </div>

              {/* Duplicate Cards List */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {Array.from(duplicateIndexes.entries()).map(([idx, dbMember]) => {
                  const importItem = parsedItems[idx];
                  const currentAction = duplicateActions[idx] || 'add_new';

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div>
                          <span className="font-bold text-slate-900 text-sm block">
                            {importItem.nama}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Data Import: HP {importItem.nomorHp || '-'}, Kec. {importItem.domisili}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setDuplicateActions(prev => ({ ...prev, [idx]: 'add_new' }))
                            }
                            className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                              currentAction === 'add_new'
                                ? 'bg-[#F27D26] text-white'
                                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Import Sbg Baru
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDuplicateActions(prev => ({ ...prev, [idx]: 'skip' }))
                            }
                            className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                              currentAction === 'skip'
                                ? 'bg-slate-700 text-white'
                                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Abaikan (Lewati)
                          </button>
                        </div>
                      </div>

                      {/* Matched DB Member comparison info */}
                      <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">Sudah Ada Di Database: </span>
                          <span>{dbMember.nama} ({dbMember.pendidikan}) • HP: {dbMember.nomorHp || '-'} • Kec. {dbMember.domisili}</span>
                        </div>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-500">
                          {dbMember.organisasiInternal.join(', ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Mode Tabs */}
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('wa')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeTab === 'wa'
                      ? 'bg-[#F27D26] text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Form WhatsApp (Japri)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeTab === 'text'
                      ? 'bg-[#F27D26] text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Tempel CSV / Tab</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('file')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeTab === 'file'
                      ? 'bg-[#F27D26] text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File Excel / CSV</span>
                </button>
              </div>

              {/* Tab 1: WhatsApp Japri Form Text */}
              {activeTab === 'wa' && (
                <div className="space-y-4">
                  {/* Template Copy Banner */}
                  <div className="bg-gradient-to-r from-orange-50/90 via-amber-50/70 to-orange-50/90 border border-orange-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                        <Sparkles className="w-4 h-4 text-[#F27D26]" />
                        <span>Format Formulir Japri WhatsApp</span>
                      </span>
                      <p className="text-slate-600 font-medium text-[11px]">
                        Kirimkan template pertanyaan ke calon anggota, lalu salin-tempel balasan mereka ke kotak di bawah.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyTemplate}
                      className="bg-white hover:bg-orange-50 text-[#F27D26] border border-orange-300 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 shadow-2xs"
                    >
                      {copiedTemplate ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Tersalin ke Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Format Teks WA</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Textarea Paste */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Tempel Teks Balasan WA Anggota di Sini:
                    </label>
                    <textarea
                      value={waPastedText}
                      onChange={e => {
                        setWaPastedText(e.target.value);
                        if (parseErrors.length > 0) setParseErrors([]);
                      }}
                      rows={7}
                      placeholder={`Nama Lengkap : Ahmad Fauzi Pratama\nNama Panggilan : Fauzi\nNo. HP (WA) : 081234567890\nEmail : fauzi.pratama@gmail.com\nTgl Lahir : 14/05/2001\nAlamat lengkap : Jl. Penarukan No. 12, RT 02/03, Kepanjen, Malang\nPendidikan Terakhir/saat ini : S1\nJurusan : Informatika\nAktivitas Utama : Freelance Web Designer\nKeahlian : Desain Grafis, Web Development, Public Speaking\nHobi : Sepakbola, Membaca Buku\nInstagram : @fauzi_pratama\nTiktok : @fauzipro`}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono rounded-xl p-3.5 outline-none focus:border-[#F27D26] focus:bg-white resize-none leading-relaxed font-medium"
                    />
                  </div>

                  {/* Live Parsed Preview */}
                  {parsedWAMember.detectedFieldsCount > 0 && (
                    <div className="space-y-3 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                        <span className="text-xs font-bold text-emerald-800 flex items-center space-x-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Hasil Deteksi Cerdas ({parsedWAMember.detectedFieldsCount} Kolom Ditemukan)</span>
                        </span>
                        {isWADuplicate && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded-full">
                            ⚠️ Kemungkinan Duplikat
                          </span>
                        )}
                      </div>

                      {/* Member summary card */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {parsedWAMember.nama || '(Nama belum terisi)'}
                            </span>
                            {parsedWAMember.namaPanggilan && (
                              <span className="bg-orange-50 text-[#F27D26] border border-orange-200 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                {parsedWAMember.namaPanggilan}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            🎂 {parsedWAMember.tglLahir}{' '}
                            {calculateAge(parsedWAMember.tglLahir) > 0 && (
                              <span className="text-amber-600 font-semibold">
                                ({calculateAge(parsedWAMember.tglLahir)} Tahun)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                          <div className="flex items-center space-x-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>HP/WA: <strong className="text-slate-800">{parsedWAMember.nomorHp || '-'}</strong></span>
                          </div>
                          {parsedWAMember.email && (
                            <div className="flex items-center space-x-1.5">
                              <Mail className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span>Email: <strong className="text-slate-800">{parsedWAMember.email}</strong></span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1.5">
                            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>
                              Domisili: <strong className="text-slate-800">Kec. {parsedWAMember.domisili}</strong>{' '}
                              {getDapilByKecamatan(parsedWAMember.domisili) && (
                                <span className="text-[9px] bg-blue-50 text-blue-700 px-1 rounded font-bold">
                                  {getDapilByKecamatan(parsedWAMember.domisili)}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>
                              Pendidikan: <strong className="text-slate-800">{parsedWAMember.pendidikan}</strong>{' '}
                              {parsedWAMember.jurusan ? `(${parsedWAMember.jurusan})` : ''}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Aktivitas: <strong className="text-slate-800">{parsedWAMember.aktivitas || '-'}</strong></span>
                          </div>
                        </div>

                        {parsedWAMember.alamatDetail && (
                          <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <strong>Alamat Lengkap:</strong> {parsedWAMember.alamatDetail}
                          </div>
                        )}

                        {/* Skills & Hobbies */}
                        <div className="space-y-1 pt-1 border-t border-slate-100">
                          {parsedWAMember.keahlian.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-500 mr-1">Keahlian:</span>
                              {parsedWAMember.keahlian.map((k, idx) => (
                                <span
                                  key={idx}
                                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.2 rounded-md"
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          )}

                          {parsedWAMember.hobi.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-500 mr-1">Hobi:</span>
                              {parsedWAMember.hobi.map((h, idx) => (
                                <span
                                  key={idx}
                                  className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold px-2 py-0.2 rounded-md"
                                >
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}

                          {(parsedWAMember.sosmed.instagram || parsedWAMember.sosmed.tiktok) && (
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                              {parsedWAMember.sosmed.instagram && (
                                <span className="text-purple-700 font-semibold">
                                  📷 IG: {parsedWAMember.sosmed.instagram}
                                </span>
                              )}
                              {parsedWAMember.sosmed.tiktok && (
                                <span className="text-slate-800 font-semibold">
                                  🎵 TikTok: {parsedWAMember.sosmed.tiktok}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Fast Action in WA tab */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleAddWAToBulkList}
                          className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl transition-all"
                        >
                          + Tambahkan ke Antrean Bulk
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenWAInForm}
                          className="px-5 py-2 bg-[#F27D26] hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1.5"
                        >
                          <span>Buka di Form Input (Review & Simpan)</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: CSV / Tab Separated Text */}
              {activeTab === 'text' && (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-xs space-y-0.5">
                      <span className="font-semibold text-slate-800 block">Belum punya format kolom data CSV?</span>
                      <p className="text-slate-500 font-medium">Unduh template CSV agar susunan kolom rapi dan presisi.</p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadSampleCSV}
                      className="bg-white hover:bg-slate-100 text-amber-700 border border-amber-300 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Template CSV</span>
                    </button>
                  </div>

                  <textarea
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    rows={6}
                    placeholder={`Tempelkan baris data CSV/Tab di sini:\n\nAhmad Fauzi, 081234567890, PKS Muda, 2001-05-14, fauzi@gmail.com, Kepanjen, Jl. Penarukan, Freelance, S1, Informatika, Design Grafis, Sepakbola, Sudah, Aktif dapil 1\nSiti Nurhaliza, 082198765432, BPPM, 2003-09-22, sitinur@gmail.com, Singosari, Jl. Tumapel, Mahasiswi, S1, Inggris, Public Speaking, Membaca, Sudah, Fasilitator`}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono rounded-xl p-3.5 outline-none focus:border-[#F27D26] focus:bg-white resize-none leading-relaxed font-medium"
                  />
                  <button
                    type="button"
                    onClick={parsePastedText}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center space-x-1.5"
                  >
                    <span>Proses & Pratinjau Teks CSV</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Tab 3: Upload File Excel / CSV */}
              {activeTab === 'file' && (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-xs space-y-0.5">
                      <span className="font-semibold text-slate-800 block">Template Excel / Spreadsheet</span>
                      <p className="text-slate-500 font-medium">Unduh template CSV/Excel untuk mempermudah penyusunan data.</p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadSampleCSV}
                      className="bg-white hover:bg-slate-100 text-amber-700 border border-amber-300 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Template</span>
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 hover:border-[#F27D26] rounded-2xl p-8 text-center bg-slate-50/50 transition-colors">
                    <Upload className="w-8 h-8 text-[#F27D26] mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-800 mb-1">
                      Pilih atau seret file `.xlsx` / `.csv` Anda ke sini
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mb-4">Mendukung format Microsoft Excel & CSV</p>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-import-input"
                    />
                    <label
                      htmlFor="file-import-input"
                      className="cursor-pointer inline-flex items-center space-x-2 px-5 py-2.5 bg-[#F27D26] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                    >
                      <span>{isProcessing ? 'Membaca File...' : 'Pilih File dari Perangkat'}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Errors view */}
              {parseErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-700 text-xs space-y-1 font-medium">
                  {parseErrors.map((err, i) => (
                    <div key={i} className="flex items-center space-x-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview Table for Bulk Items */}
              {parsedItems.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Hasil Deteksi: {parsedItems.length} Data Siap Diimport</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setParsedItems([])}
                      className="text-[11px] text-slate-400 hover:text-red-500"
                    >
                      Kosongkan Daftar
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">No</th>
                          <th className="p-2">Nama</th>
                          <th className="p-2">Nomor HP</th>
                          <th className="p-2">Organisasi</th>
                          <th className="p-2">Domisili</th>
                          <th className="p-2">Pembinaan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {parsedItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="p-2 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-semibold text-slate-900">{item.nama}</td>
                            <td className="p-2">{item.nomorHp || '-'}</td>
                            <td className="p-2 text-[#F27D26] font-bold">
                              {(item.organisasiInternal || []).join(', ')}
                            </td>
                            <td className="p-2">{item.domisili}</td>
                            <td className="p-2">{item.pembinaan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50/80 rounded-b-2xl flex items-center justify-end space-x-3">
          {isReviewingDuplicates && (
            <button
              type="button"
              onClick={() => setIsReviewingDuplicates(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Kembali ke Edit Import
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Batal
          </button>

          {activeTab === 'wa' && parsedWAMember.nama.trim() && parsedItems.length === 0 ? (
            <button
              type="button"
              onClick={handleOpenWAInForm}
              className="px-6 py-2.5 bg-[#F27D26] hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
            >
              <span>Buka di Form Input (Review & Simpan)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={parsedItems.length === 0 && (activeTab !== 'text' || !pastedText.trim())}
              onClick={handleConfirmImport}
              className="px-6 py-2.5 bg-[#F27D26] hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-40"
            >
              {isReviewingDuplicates
                ? 'Selesaikan Import Sekarang'
                : duplicateIndexes.size > 0
                ? `Tinjau ${duplicateIndexes.size} Nama Duplikat & Lanjut`
                : `Import ${parsedItems.length || 1} Data Sekarang`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
