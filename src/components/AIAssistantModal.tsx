import React, { useState, useRef, useEffect } from 'react';
import { Member, EventItem, EventAttendance } from '../types';
import {
  Sparkles,
  X,
  Send,
  User,
  Bot,
  RefreshCw,
  ExternalLink,
  Phone,
  MapPin,
  Copy,
  Check,
  Zap,
  Filter,
} from 'lucide-react';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  events: EventItem[];
  attendances: EventAttendance[];
  onViewMember: (member: Member) => void;
  onFilterMembers?: (searchTerm: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  matchedMemberIds?: string[];
}

const QUICK_PROMPTS = [
  {
    icon: '🎯',
    label: 'Cari Keahlian Videografi / Desain',
    prompt: 'Siapa saja anggota yang memiliki keahlian Desain Grafis, Videografi, atau Media Sosial?',
  },
  {
    icon: '⚽',
    label: 'Cari Hobi Olahraga / Futsal',
    prompt: 'Tampilkan daftar anggota yang hobi Futsal, Bulutangkis, atau Olahraga.',
  },
  {
    icon: '📍',
    label: 'Persebaran Kecamatan',
    prompt: 'Sebutkan 5 kecamatan dengan jumlah anggota terbanyak beserta nama anggotanya.',
  },
  {
    icon: '🎓',
    label: 'Pendidikan S1 & S2',
    prompt: 'Siapa saja anggota dengan tingkat pendidikan S1 atau S2 dan jurusan apa saja?',
  },
  {
    icon: '👥',
    label: 'Analisis Organisasi',
    prompt: 'Ringkas jumlah anggota per organisasi internal (Garuda, IPNU, Gema, PKS Muda, dll).',
  },
  {
    icon: '📊',
    label: 'Keaktifan Event Presensi',
    prompt: 'Berapa rata-rata keaktifan anggota dalam menghadiri event presensi?',
  },
];

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  members,
  events,
  attendances,
  onViewMember,
  onFilterMembers,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Halo! Saya **Asisten AI Analitis Database Anggota BPPM PKS Kab. Malang**.\n\nSaya dapat membantu Anda mencari data spesifik, menganalisis keahlian & hobi, memetakan domisili, atau mengecek kualifikasi anggota.\n\nContoh pertanyaan:\n- *"Siapa saja anggota yang punya keahlian Videografi atau Public Speaking?"*\n- *"Cari anggota di Kecamatan Kepanjen yang berpendidikan S1"*\n- *"Tampilkan daftar anggota dari organisasi IPNU"*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  // Find matching member objects based on IDs or names mentioned in answer
  const findMatchedMembers = (text: string, userPrompt: string): Member[] => {
    const matched: Member[] = [];
    const textLower = (text + ' ' + userPrompt).toLowerCase();

    members.forEach(member => {
      const nameLower = member.nama.toLowerCase();
      // Match if exact name is in text or if user searched specifically for member
      if (
        nameLower.length > 3 &&
        (textLower.includes(nameLower) ||
          member.keahlian.some(k => k.toLowerCase().length > 3 && textLower.includes(k.toLowerCase())))
      ) {
        if (!matched.some(m => m.id === member.id)) {
          matched.push(member);
        }
      }
    });

    return matched.slice(0, 8); // Max 8 top matches to keep UI clean
  };

  const handleSendMessage = async (textToSend?: string) => {
    const promptText = (textToSend || inputPrompt).trim();
    if (!promptText || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptText,
          history: messages.map(m => ({ sender: m.sender, text: m.text })),
          membersContext: members,
          eventsContext: events,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghubungi server AI.');
      }

      const answerText = data.text || 'Tidak ada tanggapan dari AI.';
      const detectedMembers = findMatchedMembers(answerText, promptText);

      const aiMsg: ChatMessage = {
        id: 'ai_' + Date.now(),
        sender: 'ai',
        text: answerText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        matchedMemberIds: detectedMembers.map(m => m.id),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Error in AI Assistant modal:', err);
      const errorMsg: ChatMessage = {
        id: 'err_' + Date.now(),
        sender: 'ai',
        text: `⚠️ **Gagal memproses analisis AI**\n\n${
          err.message || 'Terjadi gangguan jaringan atau API key belum diset.'
        }\n\n*Petunjuk:* Pastikan Anda telah mengatur \`GEMINI_API_KEY\` pada menu Settings > Secrets AI Studio.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Simple Markdown text renderer with bolding, lists, and line breaks
  const renderFormattedMarkdown = (content: string) => {
    const lines = content.split('\n');

    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1.5" />;

          // Header line
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-slate-900 text-sm mt-2 mb-1">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h3 key={idx} className="font-bold text-slate-900 text-base mt-2 mb-1">
                {line.replace('## ', '')}
              </h3>
            );
          }

          // Bullet point
          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            const rawText = line.trim().substring(2);
            return (
              <div key={idx} className="flex items-start space-x-2 pl-1 my-0.5">
                <span className="text-[#F27D26] font-bold shrink-0">•</span>
                <div>{parseBoldText(rawText)}</div>
              </div>
            );
          }

          // Numbered list
          if (/^\d+\.\s/.test(line.trim())) {
            const match = line.trim().match(/^(\d+)\.\s(.*)/);
            if (match) {
              return (
                <div key={idx} className="flex items-start space-x-2 pl-1 my-0.5">
                  <span className="font-bold text-slate-600 shrink-0">{match[1]}.</span>
                  <div>{parseBoldText(match[2])}</div>
                </div>
              );
            }
          }

          return <p key={idx}>{parseBoldText(line)}</p>;
        })}
      </div>
    );
  };

  // Helper to convert **bold** and *italic* in strings
  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-slate-900 bg-amber-50/80 px-1 py-0.5 rounded">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic text-slate-700">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-slate-100 font-mono text-[11px] text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full h-[90vh] sm:h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F27D26] to-amber-400 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm sm:text-base tracking-tight">AI Assistant Analitik</h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Gemini 2.0 Flash
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Pencarian cerdas keahlian, hobi & analitik {members.length} anggota
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setMessages([
                  {
                    id: 'welcome_' + Date.now(),
                    sender: 'ai',
                    text: 'Riwayat obrolan dibersihkan. Ada yang ingin Anda tanyakan mengenai data anggota?',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ]);
              }}
              title="Bersihkan Obrolan"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center space-x-1"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto shrink-0 flex items-center space-x-2 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5 text-[#F27D26]" />
            <span>Prompt Cepat:</span>
          </span>
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={isLoading}
              className="whitespace-nowrap px-3 py-1 bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-slate-700 hover:text-[#F27D26] text-xs rounded-full font-medium transition-all shadow-2xs flex items-center space-x-1.5 shrink-0 disabled:opacity-50"
            >
              <span>{qp.icon}</span>
              <span>{qp.label}</span>
            </button>
          ))}
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map(msg => {
            const isAi = msg.sender === 'ai';
            const matchedMembers = (msg.matchedMemberIds || [])
              .map(id => members.find(m => m.id === id))
              .filter((m): m is Member => Boolean(m));

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isAi ? 'items-start' : 'items-end'} space-y-1`}
              >
                <div className="flex items-center space-x-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {isAi ? 'AI Assistant' : 'Anda'}
                  </span>
                  <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                </div>

                <div
                  className={`relative max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 shadow-2xs ${
                    isAi
                      ? 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs'
                      : 'bg-[#F27D26] text-white rounded-tr-xs font-medium text-xs'
                  }`}
                >
                  {isAi ? (
                    <div>
                      {renderFormattedMarkdown(msg.text)}

                      {/* Copy button */}
                      <div className="flex items-center justify-between border-t border-slate-100 mt-3 pt-2">
                        <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                          <Bot className="w-3 h-3 text-[#F27D26]" />
                          <span>Dianalisis dari Database Anggota</span>
                        </span>
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center space-x-1 font-medium px-2 py-0.5 rounded hover:bg-slate-100 transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600">Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Salin Jawaban</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Matched Member Cards Attachment */}
                      {matchedMembers.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span className="flex items-center space-x-1">
                              <User className="w-3.5 h-3.5 text-[#F27D26]" />
                              <span>Kartu Anggota Terkait ({matchedMembers.length})</span>
                            </span>
                            {onFilterMembers && (
                              <button
                                onClick={() => {
                                  onFilterMembers(matchedMembers[0]?.nama || '');
                                  onClose();
                                }}
                                className="text-[11px] text-[#F27D26] hover:underline flex items-center space-x-1 font-bold"
                              >
                                <Filter className="w-3 h-3" />
                                <span>Tampilkan Semua di Tabel</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {matchedMembers.map(m => (
                              <div
                                key={m.id}
                                className="p-2.5 bg-slate-50 border border-slate-200 hover:border-orange-300 rounded-xl space-y-1.5 text-xs transition-all hover:shadow-sm"
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <span className="font-bold text-slate-900 block">{m.nama}</span>
                                    <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>Kec. {m.domisili}</span>
                                    </span>
                                  </div>
                                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                                    {m.pendidikan}
                                  </span>
                                </div>

                                <div className="text-[11px] text-slate-600 flex flex-wrap gap-1">
                                  {m.keahlian.slice(0, 3).map((k, idx) => (
                                    <span
                                      key={idx}
                                      className="bg-amber-100 text-amber-900 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                    >
                                      {k}
                                    </span>
                                  ))}
                                  {m.hobi.slice(0, 2).map((h, idx) => (
                                    <span
                                      key={idx}
                                      className="bg-emerald-100 text-emerald-900 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                    >
                                      {h}
                                    </span>
                                  ))}
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                                  {m.nomorHp ? (
                                    <a
                                      href={`https://wa.me/${m.nomorHp.replace(/[^0-9]/g, '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-emerald-700 font-bold flex items-center space-x-1 hover:underline"
                                    >
                                      <Phone className="w-3 h-3" />
                                      <span>WA: {m.nomorHp}</span>
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">No HP -</span>
                                  )}
                                  <button
                                    onClick={() => {
                                      onViewMember(m);
                                      onClose();
                                    }}
                                    className="text-[11px] bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-lg flex items-center space-x-1 transition-colors"
                                  >
                                    <span>Detail</span>
                                    <ExternalLink className="w-3 h-3 text-slate-500" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>{msg.text}</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-start space-x-2 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#F27D26] to-amber-400 flex items-center justify-center text-white shrink-0 shadow-xs">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2 max-w-xs">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                  <Sparkles className="w-4 h-4 text-[#F27D26] animate-bounce" />
                  <span>Menganalisis Database Anggota...</span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 bg-slate-200 rounded-full w-48" />
                  <div className="h-2 bg-slate-200 rounded-full w-36" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={e => setInputPrompt(e.target.value)}
              placeholder="Ketik pertanyaan analitik (contoh: Siapa saja anggota yang bisa Videografi?)..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F27D26] focus:bg-white text-slate-900 placeholder:text-slate-400 transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="px-5 py-2.5 bg-[#F27D26] hover:bg-orange-600 disabled:opacity-40 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm flex items-center space-x-1.5 shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mt-1.5">
            <span>
              💡 <strong>Tip:</strong> Anda bisa menanyakan nama spesifik, keahlian, hobi, domisili, atau organisasi.
            </span>
            <span>{members.length} Anggota Terdaftar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
