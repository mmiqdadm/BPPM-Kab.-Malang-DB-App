import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  // Allow CORS / preflight if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY tidak dikonfigurasi. Silakan atur GEMINI_API_KEY pada Environment Variables di Vercel.',
      });
    }

    const { prompt, history, membersContext } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt pesan tidak boleh kosong.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Format compact summary of database for AI context
    const membersCompact = (membersContext || []).map((m: any) => ({
      id: m.id,
      n: m.nama,
      hp: m.nomorHp || '',
      dom: m.domisili,
      edu: m.pendidikan + (m.jurusan ? ` ${m.jurusan}` : ''),
      org: (m.organisasiInternal || []).join(','),
      akt: m.aktivitas,
      kh: (m.keahlian || []).join(','),
      hb: (m.hobi || []).join(','),
      pb: m.pembinaan,
    }));

    const systemInstruction = `Anda adalah Asisten AI Analitis khusus untuk Database Anggota BPPM PKS Kabupaten Malang.
Tugas Anda adalah membantu pengurus/admin menganalisis data anggota, mencari anggota dengan keahlian/hobi tertentu, melihat persebaran wilayah/pendidikan, serta memberikan ringkasan statistik yang akurat dan bermanfaat.

Panduan Jawaban:
1. Jawab dalam Bahasa Indonesia yang ramah, sopan, dan profesional.
2. Manfaatkan data ringkas anggota yang diberikan di bawah ini.
3. Saat menyebutkan nama anggota yang sesuai kriteria, sebutkan Nama Lengkap (n), Domisili (dom), Organisasi (org), Nomor HP (hp), serta Keahlian (kh) / Hobi (hb).
4. Gunakan format Markdown yang rapi (**bold**, poin-poin bullet).
5. Jika hasil pencarian menemukan anggota tertentu, sertakan ringkasan jumlahnya di awal jawaban.

DATA ANGGOTA TERSEDIA SAAT INI (${membersCompact.length} Anggota):
${JSON.stringify(membersCompact)}
`;

    const contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      history.slice(-6).forEach((msg: { sender: string; text: string }) => {
        contents.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    // Candidate models list in order of preference
    const CANDIDATE_MODELS = [
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ];

    let answerText = '';
    let lastErr = null;

    for (const modelCandidate of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelCandidate,
          contents,
          config: {
            systemInstruction,
            temperature: 0.3,
          },
        });
        if (response && response.text) {
          answerText = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`Vercel Model candidate ${modelCandidate} failed:`, err?.message || err);
        lastErr = err;
      }
    }

    if (!answerText) {
      throw lastErr || new Error('Tidak ada model Gemini yang dapat memproses permintaan.');
    }
    return res.status(200).json({ text: answerText });
  } catch (err: any) {
    console.error('Error handling Vercel AI analytics:', err);
    return res.status(500).json({
      error: err?.message || 'Terjadi kesalahan saat memproses permintaan AI.',
    });
  }
}
