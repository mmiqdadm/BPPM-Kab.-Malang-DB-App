import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Member } from '../types';
import { calculateAge, formatDateIndonesian } from './utils';

export function exportMembersToExcel(members: Member[], filenamePrefix = 'Database_Anggota_PKS_Muda_Kab_Malang'): void {
  const dataForExcel = members.map((m, index) => {
    const age = calculateAge(m.tglLahir);
    return {
      No: index + 1,
      'Nama Lengkap': m.nama,
      'Nomor HP / WA': m.nomorHp || '-',
      'Organisasi Internal': (m.organisasiInternal || []).join(', ') || '-',
      'Tanggal Lahir': m.tglLahir ? formatDateIndonesian(m.tglLahir) : '-',
      'Usia (Tahun)': age > 0 ? age : '-',
      'Status Pembinaan': m.pembinaan || '-',
      Pendidikan: m.pendidikan || '-',
      Jurusan: m.jurusan || '-',
      Domisili: m.domisili || '-',
      'Alamat Detail': m.alamatDetail || '-',
      'Aktivitas / Pekerjaan': m.aktivitas || '-',
      Keahlian: (m.keahlian || []).join(', ') || '-',
      Hobi: (m.hobi || []).join(', ') || '-',
      Instagram: m.sosmed?.instagram || '-',
      TikTok: m.sosmed?.tiktok || '-',
      Twitter: m.sosmed?.twitter || '-',
      Facebook: m.sosmed?.facebook || '-',
      Email: m.email || '-',
      'Catatan Tambahan': m.catatanTambahan || '-',
      'Diinput Pada': m.createdAt ? formatDateIndonesian(m.createdAt) : '-',
      'Diinput Oleh': m.createdBy || 'Admin',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);

  // Set column widths
  const colWidths = [
    { wch: 5 },  // No
    { wch: 25 }, // Nama
    { wch: 16 }, // HP
    { wch: 20 }, // Org
    { wch: 18 }, // Tgl Lahir
    { wch: 12 }, // Usia
    { wch: 22 }, // Pembinaan
    { wch: 12 }, // Pendidikan
    { wch: 20 }, // Jurusan
    { wch: 18 }, // Domisili
    { wch: 30 }, // Alamat
    { wch: 25 }, // Aktivitas
    { wch: 30 }, // Keahlian
    { wch: 30 }, // Hobi
    { wch: 18 }, // IG
    { wch: 18 }, // TikTok
    { wch: 18 }, // Twitter
    { wch: 18 }, // FB
    { wch: 25 }, // Email
    { wch: 30 }, // Catatan
    { wch: 18 }, // Tgl Input
    { wch: 15 }, // Admin
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Anggota');

  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}_${dateStamp}.xlsx`);
}

export function exportMembersToPDF(members: Member[], reportTitle = 'LAPORAN DATABASE ANGGOTA BPPM PKS KAB. MALANG'): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header banner / Brand Title
  doc.setFillColor(254, 80, 0); // PKS Orange
  doc.rect(0, 0, 297, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('BPPM PARTAI KEADILAN SEJAHTERA KABUPATEN MALANG', 14, 12);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.text(reportTitle, 14, 26);

  const totalAge = members.reduce((sum, m) => sum + calculateAge(m.tglLahir), 0);
  const avgAge = members.length > 0 ? (totalAge / members.length).toFixed(1) : '0';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tanggal Cetak: ${formatDateIndonesian(new Date().toISOString())} | Total Data: ${members.length} Anggota | Rata-rata Usia: ${avgAge} Tahun`, 14, 32);

  const tableBody = members.map((m, idx) => {
    const age = calculateAge(m.tglLahir);
    return [
      (idx + 1).toString(),
      m.nama,
      m.nomorHp || '-',
      (m.organisasiInternal || []).join(', '),
      age > 0 ? `${age} th` : '-',
      m.domisili || '-',
      m.pendidikan || '-',
      m.pembinaan || '-',
      (m.keahlian || []).slice(0, 3).join(', '),
      (m.hobi || []).slice(0, 3).join(', '),
    ];
  });

  autoTable(doc, {
    startY: 36,
    head: [['No', 'Nama Lengkap', 'No HP/WA', 'Organisasi', 'Usia', 'Domisili', 'Pendidikan', 'Pembinaan', 'Keahlian Utama', 'Hobi']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 42 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 28 },
      6: { cellWidth: 20 },
      7: { cellWidth: 32 },
      8: { cellWidth: 35 },
      9: { cellWidth: 30 },
    },
    margin: { left: 14, right: 14 },
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan_Anggota_PKS_Muda_Kab_Malang_${dateStamp}.pdf`);
}

export function exportSingleMemberCardPDF(m: Member): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const age = calculateAge(m.tglLahir);

  // Top header bar
  doc.setFillColor(254, 80, 0);
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('BIODATA ANGGOTA BPPM PKS KAB. MALANG', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`ID Register: ${m.id}`, 14, 18);

  // Profile Card Header
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 30, 182, 32, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 30, 182, 32, 3, 3, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(m.nama, 20, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Kecamatan: ${m.domisili || '-'} | Usia: ${age > 0 ? age + ' Tahun' : '-'} | Pembinaan: ${m.pembinaan || '-'}`, 20, 50);
  doc.text(`Organisasi Internal: ${(m.organisasiInternal || []).join(', ') || '-'}`, 20, 56);

  // Details Table
  autoTable(doc, {
    startY: 68,
    head: [['Bidang Informasi', 'Detail Keterangan']],
    body: [
      ['Nomor HP / WhatsApp', m.nomorHp || '-'],
      ['Email', m.email || '-'],
      ['Tanggal Lahir', m.tglLahir ? formatDateIndonesian(m.tglLahir) : '-'],
      ['Pendidikan Terakhir', `${m.pendidikan || '-'} ${m.jurusan ? '(' + m.jurusan + ')' : ''}`],
      ['Domisili (Kecamatan)', m.domisili || '-'],
      ['Alamat Lengkap', m.alamatDetail || '-'],
      ['Aktivitas / Pekerjaan', m.aktivitas || '-'],
      ['Status Pembinaan', m.pembinaan || '-'],
      ['Keahlian / Keterampilan', (m.keahlian || []).join(', ') || '-'],
      ['Hobi & Minat', (m.hobi || []).join(', ') || '-'],
      ['Media Sosial', `IG: ${m.sosmed?.instagram || '-'} | TikTok: ${m.sosmed?.tiktok || '-'} | Twitter: ${m.sosmed?.twitter || '-'}`],
      ['Catatan Tambahan', m.catatanTambahan || '-'],
      ['Tanggal Terdaftar', m.createdAt ? formatDateIndonesian(m.createdAt) : '-'],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 132 },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dokumen resmi Sekretariat BPPM PKS Kab. Malang - Dicetak ${new Date().toLocaleString('id-ID')}`, 14, 285);

  const cleanName = m.nama.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Biodata_${cleanName}_PKS_Muda.pdf`);
}
