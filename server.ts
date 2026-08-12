import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Endpoint for AI Analytics Assistant
  app.post('/api/ai/analytics', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY tidak dikonfigurasi. Silakan atur GEMINI_API_KEY pada Settings > Secrets.',
        });
      }

      const { prompt, history, membersContext, eventsContext } = req.body;

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
        nama: m.nama,
        nomorHp: m.nomorHp || '-',
        domisili: m.domisili,
        pendidikan: m.pendidikan,
        jurusan: m.jurusan || '-',
        organisasi: (m.organisasiInternal || []).join(', '),
        aktivitas: m.aktivitas,
        keahlian: (m.keahlian || []).join(', '),
        hobi: (m.hobi || []).join(', '),
        pembinaan: m.pembinaan,
      }));

      const systemInstruction = `Anda adalah Asisten AI Analitis khusus untuk Database Anggota BPPM PKS Kabupaten Malang.
Tugas Anda adalah membantu pengurus/admin menganalisis data anggota, mencari anggota dengan keahlian/hobi tertentu, melihat persebaran wilayah/pendidikan, serta memberikan ringkasan statistik yang akurat dan bermanfaat.

Panduan Jawaban:
1. Jawab dalam Bahasa Indonesia yang ramah, sopan, dan profesional.
2. Manfaatkan data ringkas anggota yang diberikan di bawah ini.
3. Saat menyebutkan nama anggota yang sesuai kriteria (misalnya mencari keahlian/hobi/wilayah tertentu), sebutkan Nama Lengkap, Kecamatan Domisili, Organisasi (IPNU/Garuda/Gema/dll), Nomor HP (bila ada), dan Keahlian/Hobi mereka.
4. Gunakan format Markdown yang rapi (Gunakan **bold**, tabel, atau poin-poin bullet).
5. Jika hasil pencarian menemukan anggota tertentu, sertakan ringkasan jumlahnya di awal jawaban.

DATA ANGGOTA TERSEDIA SAAT INI (${membersCompact.length} Anggota):
${JSON.stringify(membersCompact, null, 2)}
`;

      // Build contents array including previous history if provided
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

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      const answerText = response.text || 'Maaf, tidak dapat menghasilkan jawaban saat ini.';

      res.json({ text: answerText });
    } catch (err: any) {
      console.error('Error handling AI analytics:', err);
      res.status(500).json({
        error: err?.message || 'Terjadi kesalahan saat memproses permintaan AI.',
      });
    }
  });

  // Vite middleware for dev / static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
