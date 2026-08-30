import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Member, OrganisasiType, PendidikanType, PembinaanType, JenjangPembinaanType } from '../types';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Download, Sparkles, ArrowRight } from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportConfirm: (membersToImport: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
  existingMembers?: Member[];
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImportConfirm,
  existingMembers = [],
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [pastedText, setPastedText] = useState('');
  const [parsedItems, setParsedItems] = useState<Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Duplicate name confirmation step
  const [isReviewingDuplicates, setIsReviewingDuplicates] = useState(false);
  const [duplicateActions, setDuplicateActions] = useState<Record<number, 'add_new' | 'skip'>>({});

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
      'PKS Muda, GK',
      '2002-08-17',
      'budi.santoso@gmail.com',
      'Kepanjen',
      'Jl. Merdeka No. 12',
      'Mahasiswa UB',
      'S1',
      'Informatika',
      'Web Development; Design Grafis',
      'Futsal; Gowes',
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
      'Public Speaking; MC',
      'Membaca; Writing',
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

  // Helper function to map raw row array/object into Member object
  const mapRowToMember = (
    nama: string,
    hp: string,
    orgStr: string,
    tgl: string,
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
      .split(/[,;/]+/)
      .map(o => o.trim())
      .filter(Boolean);

    const validOrgs: OrganisasiType[] = [];
    rawOrgs.forEach(o => {
      const upper = o.toUpperCase();
      if (upper.includes('BPPM')) validOrgs.push('BPPM');
      else if (upper.includes('GK')) validOrgs.push('GK');
      else if (upper.includes('PKS') || upper.includes('MUDA')) validOrgs.push('PKS Muda');
      else if (upper.includes('GEMA')) validOrgs.push('Gema');
      else if (upper.includes('NGOPI')) validOrgs.push('Ngopi');
      else if (o) validOrgs.push(o as OrganisasiType);
    });

    if (validOrgs.length === 0) validOrgs.push('PKS Muda');

    // Parse education
    let cleanEdu: PendidikanType = 'S1';
    const eduUpper = (edu || '').toUpperCase();
    if (eduUpper.includes('TK')) cleanEdu = 'TK';
    else if (eduUpper.includes('SD')) cleanEdu = 'SD';
    else if (eduUpper.includes('SMP')) cleanEdu = 'SMP';
    else if (eduUpper.includes('SMA') || eduUpper.includes('SMK')) cleanEdu = 'SMA';
    else if (eduUpper.includes('DIPLOMA') || eduUpper.includes('D3')) cleanEdu = 'Diploma';
    else if (eduUpper.includes('S2') || eduUpper.includes('MAGISTER')) cleanEdu = 'S2';
    else if (eduUpper.includes('S3') || eduUpper.includes('DOKTOR')) cleanEdu = 'S3';
    else if (eduUpper.includes('LAIN')) cleanEdu = 'lain-lain';

    // Parse Pembinaan
    let cleanPem: PembinaanType = 'Sudah';
    const pemUpper = (pem || '').toLowerCase();
    if (pemUpper.includes('belum')) cleanPem = 'Belum Pernah';
    else if (pemUpper.includes('pernah') && pemUpper.includes('tidak')) cleanPem = 'Pernah, tapi sedang tidak';

    let cleanJenjang: JenjangPembinaanType | undefined = undefined;
    let cleanPembina: string | undefined = undefined;

    if (cleanPem === 'Sudah') {
      const jUpper = (jenjangStr || '').toUpperCase();
      if (jUpper.includes('PRATAMA')) cleanJenjang = 'Pratama';
      else if (jUpper.includes('MADYA')) cleanJenjang = 'Madya';
      else cleanJenjang = 'Muda';

      if (pembinaStr && pembinaStr.trim()) {
        cleanPembina = pembinaStr.trim();
      }
    }

    // Parse skills & hobbies
    const skillsList = (skillStr || '')
      .split(/[,;/]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const hobbiesList = (hobiStr || '')
      .split(/[,;/]+/)
      .map(h => h.trim())
      .filter(Boolean);

    // Date formatting (YYYY-MM-DD)
    let cleanDate = '2002-01-01';
    if (tgl) {
      const parsedD = new Date(tgl);
      if (!isNaN(parsedD.getTime())) {
        cleanDate = parsedD.toISOString().slice(0, 10);
      }
    }

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
  const parsePastedText = () => {
    setParseErrors([]);
    if (!pastedText.trim()) {
      setParseErrors(['Teks import masih kosong. Tempelkan baris data terlebih dahulu.']);
      return;
    }

    const lines = pastedText.trim().split('\n');
    const results: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      if (!line.trim()) return;

      // Split by tab or comma
      const cols = line.includes('\t') ? line.split('\t') : line.split(',');

      // If line is header, skip
      if (index === 0 && cols[0].toLowerCase().includes('nama')) return;

      const [nama, hp, org, tgl, email, dom, alamat, akt, edu, jur, skills, hobi, pem, jenjangOrCatatan, pembinaOrCatatan, catatanExtra] = cols;

      // Support dynamic order if template has Jenjang & Pembina or old template
      let jenjang = '';
      let pembina = '';
      let catatan = '';

      if (catatanExtra !== undefined) {
        jenjang = jenjangOrCatatan;
        pembina = pembinaOrCatatan;
        catatan = catatanExtra;
      } else if (pembinaOrCatatan !== undefined) {
        jenjang = jenjangOrCatatan;
        catatan = pembinaOrCatatan;
      } else {
        catatan = jenjangOrCatatan || '';
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
        errors.push(`Baris ${index + 1}: Nama tidak terdeteksi.`);
      }
    });

    setParsedItems(results);
    setParseErrors(errors);
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
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const results: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[] = [];
        const errors: string[] = [];

        rawData.forEach((row, index) => {
          if (!row || row.length === 0) return;

          // Header check
          const firstCol = String(row[0] || '').toLowerCase();
          if (index === 0 && (firstCol.includes('nama') || firstCol === 'no')) return;

          // Check column positioning
          const offset = firstCol.match(/^\d+$/) ? 1 : 0; // If first col is number 'No'

          const nama = String(row[offset] || '');
          const hp = String(row[offset + 1] || '');
          const org = String(row[offset + 2] || '');
          const tgl = String(row[offset + 3] || '');
          const email = String(row[offset + 4] || '');
          const dom = String(row[offset + 5] || '');
          const alamat = String(row[offset + 6] || '');
          const akt = String(row[offset + 7] || '');
          const edu = String(row[offset + 8] || '');
          const jur = String(row[offset + 9] || '');
          const skills = String(row[offset + 10] || '');
          const hobi = String(row[offset + 11] || '');
          const pem = String(row[offset + 12] || '');
          const col13 = String(row[offset + 13] || '');
          const col14 = String(row[offset + 14] || '');
          const col15 = String(row[offset + 15] || '');

          let jenjang = '';
          let pembina = '';
          let catatan = '';

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
            errors.push(`Baris ${index + 1}: Nama tidak valid.`);
          }
        });

        setParsedItems(results);
        setParseErrors(errors);
      } catch (err) {
        console.error(err);
        setParseErrors(['Gagal membaca file Excel/CSV. Pastikan format file sesuai.']);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Check duplicate items against existing database
  const duplicateIndexes = useMemo(() => {
    const map = new Map<number, Member>();
    parsedItems.forEach((item, idx) => {
      const matched = existingMembers.find(
        m => m.nama.toLowerCase().trim() === item.nama.toLowerCase().trim()
      );
      if (matched) {
        map.set(idx, matched);
      }
    });
    return map;
  }, [parsedItems, existingMembers]);

  const handleConfirmImport = () => {
    if (parsedItems.length === 0) return;

    // If duplicates exist and haven't been reviewed yet, enter review step
    if (duplicateIndexes.size > 0 && !isReviewingDuplicates) {
      // Initialize actions: default to 'add_new' for all
      const initialActions: Record<number, 'add_new' | 'skip'> = {};
      duplicateIndexes.forEach((_, idx) => {
        initialActions[idx] = 'add_new';
      });
      setDuplicateActions(initialActions);
      setIsReviewingDuplicates(true);
      return;
    }

    // Process final list
    const finalItems = parsedItems.filter((_, idx) => {
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
              {/* Download Template Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-slate-800 block">Belum punya format kolom data?</span>
              <p className="text-slate-500 font-medium">Unduh template CSV agar susunan data rapi dan presisi.</p>
            </div>
            <button
              onClick={downloadSampleCSV}
              className="bg-white hover:bg-slate-100 text-amber-700 border border-amber-300 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download Template CSV</span>
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('text')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'text'
                  ? 'bg-[#F27D26] text-white'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tempel Teks (CSV / Tab)
            </button>
            <button
              onClick={() => setActiveTab('file')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'file'
                  ? 'bg-[#F27D26] text-white'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Upload File (Excel / CSV)
            </button>
          </div>

          {/* Tab 1: Paste Text */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                rows={6}
                placeholder={`Tempelkan baris data di sini (pisahkan dengan koma atau tab):\n\nAhmad Fauzi, 081234567890, PKS Muda, 2001-05-14, fauzi@gmail.com, Kepanjen, Jl. Penarukan, Freelance, S1, Informatika, Design Grafis, Sepakbola, Sudah, Aktif dapil 1\nSiti Nurhaliza, 082198765432, BPPM, 2003-09-22, sitinur@gmail.com, Singosari, Jl. Tumapel, Mahasiswi, S1, Inggris, Public Speaking, Membaca, Sudah, Fasilitator`}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono rounded-xl p-3.5 outline-none focus:border-[#F27D26] focus:bg-white resize-none leading-relaxed font-medium"
              />
              <button
                onClick={parsePastedText}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center space-x-1.5"
              >
                <span>Proses & Pratinjau Teks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tab 2: Upload File */}
          {activeTab === 'file' && (
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
          )}

          {/* Errors view */}
          {parseErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-700 text-xs space-y-1 font-medium">
              {parseErrors.map((err, i) => (
                <div key={i} className="flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {/* Preview Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Hasil Deteksi: {parsedItems.length} Data Siap Diimport</span>
                </span>
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
              onClick={() => setIsReviewingDuplicates(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Kembali ke Edit Import
            </button>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            disabled={parsedItems.length === 0}
            onClick={handleConfirmImport}
            className="px-6 py-2.5 bg-[#F27D26] hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-40"
          >
            {isReviewingDuplicates
              ? 'Selesaikan Import Sekarang'
              : duplicateIndexes.size > 0
              ? `Tinjau ${duplicateIndexes.size} Nama Duplikat & Lanjut`
              : `Import ${parsedItems.length} Data Sekarang`}
          </button>
        </div>
      </div>
    </div>
  );
};
