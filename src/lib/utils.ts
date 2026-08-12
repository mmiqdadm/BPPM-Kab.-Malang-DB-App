export function calculateAge(tglLahir: string): number {
  if (!tglLahir) return 0;
  const birthDate = new Date(tglLahir);
  if (isNaN(birthDate.getTime())) return 0;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

export function formatWhatsAppLink(nomorHp: string): string {
  if (!nomorHp) return '#';
  // Remove non-digit characters
  let cleanNumber = nomorHp.replace(/\D/g, '');
  if (cleanNumber.startsWith('0')) {
    cleanNumber = '62' + cleanNumber.substring(1);
  } else if (!cleanNumber.startsWith('62')) {
    cleanNumber = '62' + cleanNumber;
  }
  return `https://wa.me/${cleanNumber}`;
}

export function formatDateIndonesian(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getAgeCategory(age: number): string {
  if (age < 18) return '< 18 th (Remaja)';
  if (age <= 24) return '18 - 24 th (Pemula)';
  if (age <= 30) return '25 - 30 th (Muda Utama)';
  if (age <= 40) return '31 - 40 th (Dewasa Muda)';
  return '> 40 th';
}

// Simple browser-safe string hash for auth session check
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_pks_malang_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface ActivityRatingResult {
  score: number; // 0 - 100
  stars: number; // 0.0 - 5.0
  level: 'Pasif' | 'Kurang Aktif' | 'Cukup Aktif' | 'Aktif' | 'Sangat Aktif';
  label: string;
  badgeClass: string;
  barColor: string;
  starColor: string;
}

export function getActivityRating(eventCount: number, totalEvents: number = 0): ActivityRatingResult {
  let score = 0;
  if (eventCount <= 0) {
    score = 0;
  } else if (totalEvents <= 0) {
    if (eventCount >= 5) score = 100;
    else if (eventCount >= 3) score = 80;
    else if (eventCount >= 2) score = 60;
    else score = 40;
  } else {
    const rawRatio = eventCount / totalEvents;
    const ratioScore = Math.round(rawRatio * 100);
    if (eventCount >= 5) score = Math.max(90, ratioScore);
    else if (eventCount >= 3) score = Math.max(75, ratioScore);
    else if (eventCount >= 2) score = Math.max(55, ratioScore);
    else score = Math.max(35, ratioScore);
  }

  score = Math.min(100, Math.max(0, score));
  const stars = Math.min(5, Math.round((score / 20) * 10) / 10);

  if (score >= 80) {
    return {
      score,
      stars,
      level: 'Sangat Aktif',
      label: `Sangat Aktif (${score}/100)`,
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold',
      barColor: 'bg-emerald-500',
      starColor: 'text-amber-400 fill-amber-400',
    };
  } else if (score >= 50) {
    return {
      score,
      stars,
      level: 'Aktif',
      label: `Aktif (${score}/100)`,
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-300 font-bold',
      barColor: 'bg-blue-500',
      starColor: 'text-amber-400 fill-amber-400',
    };
  } else if (score >= 25) {
    return {
      score,
      stars,
      level: 'Cukup Aktif',
      label: `Cukup Aktif (${score}/100)`,
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-300 font-bold',
      barColor: 'bg-amber-500',
      starColor: 'text-amber-400 fill-amber-400',
    };
  } else if (score > 0) {
    return {
      score,
      stars,
      level: 'Kurang Aktif',
      label: `Kurang Aktif (${score}/100)`,
      badgeClass: 'bg-orange-50 text-[#F27D26] border-orange-300 font-bold',
      barColor: 'bg-orange-500',
      starColor: 'text-amber-400 fill-amber-400',
    };
  }

  return {
    score: 0,
    stars: 0,
    level: 'Pasif',
    label: 'Pasif (0/100)',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200 font-medium',
    barColor: 'bg-slate-300',
    starColor: 'text-slate-300',
  };
}
