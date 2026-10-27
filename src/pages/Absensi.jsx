import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import attendanceService from '../services/attendanceService';
import {
  Clock, Scan, CheckCircle2,
  AlertCircle, Sparkles, UserCheck, ShieldCheck,
  Radio, LogIn, Calendar, Eye, ArrowRight, Sun, Moon
} from 'lucide-react';
import logoDefault from '../assets/logo-nabastala.png';
import bgDefault from '../assets/gedung.jpg';

const Absensi = () => {
  const navigate = useNavigate();

  // --- STATE ---
  const [time, setTime] = useState(new Date());
  const [lastScanResult, setLastScanResult] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentLogs, setRecentLogs] = useState([]);
  
  // App Config
  const [appConfig, setAppConfig] = useState({
    nama_instansi: 'SMK Negeri 1 Nebula',
    alamat_instansi: 'Jl. Raya Pendidikan No. 42, Surabaya',
    metode_absensi: 'RFID',
    timezone: 'Asia/Jakarta',
    logo_instansi: '',
    background_absensi: '',
    jam_masuk: '07:00',
    jam_pulang: '16:00',
  });

  const inputRef = useRef(null);

  // Web Audio chime feedback
  const playChime = useCallback((isSuccess = true) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.32);
      }
    } catch {
      /* ignore audio error */
    }
  }, []);

  // 1. Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      const setRes = await api.get('/settings');
      if (setRes.data) {
        setAppConfig(prev => ({
          ...prev,
          nama_instansi: setRes.data.nama_sekolah || setRes.data.nama_instansi || prev.nama_instansi,
          alamat_instansi: setRes.data.alamat_sekolah || prev.alamat_instansi,
          logo_instansi: setRes.data.logo_sekolah || setRes.data.logo_instansi || '',
          background_absensi: setRes.data.background_absensi || '',
          jam_masuk: setRes.data.jam_masuk || prev.jam_masuk,
          jam_pulang: setRes.data.jam_pulang || prev.jam_pulang,
        }));
      }

      const dashRes = await api.get('/dashboard');
      if (dashRes.data && Array.isArray(dashRes.data.logs)) {
        setRecentLogs(dashRes.data.logs.slice(0, 8));
      }
    } catch {
      /* Handled by local fallback adapter */
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Real-Time Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Keep Input Focused
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    return () => clearTimeout(focusTimer);
  }, [lastScanResult]);

  // Process Attendance Scan
  const handleProcessScan = useCallback(async (codeToScan) => {
    const cleanCode = String(codeToScan || manualCode || '').trim();
    if (!cleanCode || isLoading) return;

    setIsLoading(true);
    try {
      const res = await attendanceService.scan(cleanCode);

      if (res.data?.success) {
        playChime(true);
        const scanPayload = res.data.data || res.data;
        
        const newLog = {
          id: Date.now(),
          nama_lengkap: scanPayload.nama || scanPayload.nama_lengkap || 'Siswa',
          kelas: scanPayload.kelas || scanPayload.divisi || '-',
          status: scanPayload.status || 'HADIR',
          scan_time: new Date().toISOString().replace('T', ' ').slice(0, 19),
          method: 'RFID/BARCODE'
        };

        setLastScanResult({
          success: true,
          status: newLog.status,
          nama: newLog.nama_lengkap,
          kelas: newLog.kelas,
          nisn: scanPayload.nisn || scanPayload.identity_number || cleanCode,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          foto: scanPayload.foto || null,
          message: res.data.message || 'Presensi berhasil dicatat.'
        });

        setRecentLogs(prev => [newLog, ...prev.filter(item => item.id !== newLog.id)].slice(0, 8));
      } else {
        playChime(false);
        setLastScanResult({
          success: false,
          message: res.data?.message || 'Identitas kartu tidak dikenali atau tidak terdaftar.'
        });
      }
    } catch (err) {
      playChime(false);
      setLastScanResult({
        success: false,
        message: err.response?.data?.message || 'Gagal memproses absensi. Cek koneksi lokal.'
      });
    } finally {
      setIsLoading(false);
      setManualCode('');
      setTimeout(() => {
        setLastScanResult(null);
      }, 5000);
    }
  }, [manualCode, isLoading, playChime]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleProcessScan(manualCode);
    }
  };

  const formattedDate = time.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedHours = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const formattedSeconds = time.toLocaleTimeString('id-ID', {
    second: '2-digit'
  });

  const activeLogo = appConfig.logo_instansi || logoDefault;
  const activeBg = appConfig.background_absensi || bgDefault;

  return (
    <div className="sky-time-canvas h-screen w-screen bg-transparent text-[#111827] flex flex-col justify-between font-['Poppins'] selection:bg-amber-400/30 relative overflow-hidden p-3 md:p-5">
      
      {/* 1. ATMOSPHERIC WATERMARK DENGAN WARM AMBER GLOW */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={activeBg}
          alt="Latar Belakang Sekolah"
          className="w-full h-full object-cover scale-105 opacity-[0.05] filter blur-[1px] mix-blend-multiply"
        />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] sky-kiosk-glow rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 right-1/3 w-[500px] h-[500px] sky-kiosk-glow rounded-full blur-[140px]" />
      </div>

      <div className="nebula-kiosk-sky" aria-hidden="true">
        <Sun className="nebula-kiosk-sun" strokeWidth={1} />
        <Moon className="nebula-kiosk-moon" strokeWidth={1} />
        <div className="nebula-kiosk-stars" />
      </div>

      {/* 2. TOP BRANDING SECTION */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between z-10 shrink-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-white p-1.5 shadow-sm border border-amber-200/80 flex items-center justify-center shrink-0">
            <img src={activeLogo} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-[#111827] text-sm md:text-base tracking-tight">
                {appConfig.nama_instansi}
              </span>
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full sky-kiosk-action"></span>
              <span className="hidden sm:inline-block text-[11px] font-bold sky-kiosk-accent-text uppercase tracking-wider">
                Presensi Mandiri
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate max-w-xs sm:max-w-md">
              {appConfig.alamat_instansi || 'Nebula Smart Presence System'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-100/70 border border-amber-300/60 rounded-full text-[11px] text-amber-900 font-bold shadow-sm">
            <Radio size={12} className="text-amber-600 animate-pulse" />
            <span>Kiosk Siaga Offline</span>
          </div>

          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-xs font-bold text-white sky-kiosk-action sky-kiosk-action-hover px-4 py-2 rounded-full transition-all shadow-md shadow-blue-500/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            title="Masuk ke Konsol Operator"
          >
            <span>Konsol Operator</span>
            <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center sky-kiosk-accent-text">
              <LogIn size={10} />
            </div>
          </button>
        </div>
      </header>

      {/* 3. MAIN SPLIT STAGE (FULL SCREEN FIT, NO SCROLL) */}
      <main className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-stretch min-h-0 z-10 py-1">
        
        {/* LEFT COLUMN: HERO CLOCK + SCANNER */}
        <section className="lg:col-span-7 flex flex-col gap-4 justify-between min-h-0">
          
          {/* HERO CLOCK CARD */}
          <div className="sky-kiosk-hero rounded-[2rem] p-5 md:p-6 text-[#111827] shadow-lg shadow-amber-500/15 relative overflow-hidden flex flex-col justify-between shrink-0 border border-amber-300/40">
            <div className="flex items-center justify-between gap-2 z-10">
              <div className="flex items-center gap-2 text-[#111827]">
                <Calendar size={15} className="sky-kiosk-accent-text" />
                <span className="text-xs md:text-sm font-extrabold">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-white sky-kiosk-action px-3 py-1 rounded-full shadow-sm">
                <Clock size={12} />
                <span>Masuk: {appConfig.jam_masuk}</span>
                <span className="opacity-60">·</span>
                <span>Pulang: {appConfig.jam_pulang}</span>
              </div>
            </div>

            {/* TABULAR CLOCK */}
            <div className="text-center py-1 select-none z-10">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-[#111827] drop-shadow-sm tabular-nums font-['Poppins']">
                  {formattedHours}
                </span>
                <span className="text-xl sm:text-2xl md:text-3xl font-black sky-kiosk-accent-text font-mono tabular-nums">
                  :{formattedSeconds}
                </span>
              </div>
              <p className="text-[11px] text-[#111827]/80 font-bold">
                Waktu Indonesia Barat (WIB) · Sinkronisasi Mesin Lokal
              </p>
            </div>

            {/* Bottom 3 metrics */}
            <div className="grid grid-cols-3 pt-2.5 border-t border-dashed border-[#111827]/20 text-center z-10">
              <div className="border-r border-dashed border-[#111827]/20 pr-1">
                <p className="text-[9px] uppercase font-bold text-[#111827]/70">Batas Masuk</p>
                <p className="text-sm font-black font-['Poppins']">{appConfig.jam_masuk} WIB</p>
              </div>
              <div className="border-r border-dashed border-[#111827]/20 px-1">
                <p className="text-[9px] uppercase font-bold text-[#111827]/70">Toleransi</p>
                <p className="text-sm font-black font-['Poppins']">15 Menit</p>
              </div>
              <div className="pl-1">
                <p className="text-[9px] uppercase font-bold text-[#111827]/70">Status</p>
                <p className="text-sm font-black font-['Poppins'] sky-kiosk-accent-text">Siaga Scan</p>
              </div>
            </div>
          </div>

          {/* SCANNER CONSOLE CARD */}
          <div className="flex-1 sky-kiosk-panel rounded-[2rem] p-5 md:p-6 shadow-sm border flex flex-col justify-between min-h-0">
            {lastScanResult ? (
              <div className={`p-4 md:p-5 rounded-2xl border transition-all animate-in fade-in zoom-in-95 duration-200 my-auto ${
                lastScanResult.success
                  ? lastScanResult.status === 'TERLAMBAT'
                    ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-sm'
                    : 'bg-blue-50 border-blue-200 text-blue-900 shadow-sm'
                  : 'bg-rose-50 border-rose-200 text-rose-900 shadow-sm'
              }`}>
                {lastScanResult.success ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-md">
                      {lastScanResult.foto ? (
                        <img src={lastScanResult.foto} alt="Siswa" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#ffc837] text-[#111827] font-black text-2xl flex items-center justify-center">
                          {lastScanResult.nama.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                        <span className={`px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm ${
                          lastScanResult.status === 'TERLAMBAT'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'sky-kiosk-action text-white'
                        }`}>
                          {lastScanResult.status === 'TERLAMBAT' ? 'Terlambat' : 'Hadir Tepat Waktu'}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">
                          Pukul {lastScanResult.time} WIB
                        </span>
                      </div>

                      <h2 className="text-xl font-black text-[#111827] truncate tracking-tight">
                        {lastScanResult.nama}
                      </h2>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">
                        {lastScanResult.kelas} <span className="text-slate-300 mx-1.5">·</span> NISN: <span className="font-bold text-[#111827]">{lastScanResult.nisn}</span>
                      </p>
                    </div>

                    <div className="shrink-0 hidden sm:block">
                      <CheckCircle2 size={36} className={lastScanResult.status === 'TERLAMBAT' ? 'text-amber-500' : 'sky-kiosk-accent-text'} />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3.5 text-rose-800">
                    <AlertCircle size={32} className="shrink-0 text-rose-500" />
                    <div>
                      <p className="font-bold text-sm text-rose-900">Presensi Ditolak</p>
                      <p className="text-xs text-rose-700 font-medium">{lastScanResult.message}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2 text-center my-auto">
                <div className="relative mb-2.5">
                  <div className="w-16 h-16 rounded-full bg-[#fef3c7] border-2 border-amber-300 flex items-center justify-center sky-kiosk-accent-text shadow-sm">
                    <Scan size={30} className={isLoading ? 'animate-spin' : 'animate-pulse'} />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 sky-kiosk-action rounded-full border-2 border-white animate-ping" />
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 sky-kiosk-action rounded-full border-2 border-white" />
                </div>
                <h3 className="text-base font-black text-[#111827] tracking-tight">Sensor Presensi Siaga</h3>
                <p className="text-[11px] text-slate-500 max-w-sm mt-0.5 font-medium">
                  Tempelkan kartu RFID pada scanner atau arahkan barcode kartu identitas
                </p>
              </div>
            )}

            {/* SCAN INPUT & DEMO BUTTONS */}
            <div className="pt-2 border-t border-slate-100 shrink-0">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Scan kartu atau ketik NISN manual..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:border-[#1b5bf5] focus:bg-white transition-all font-['Poppins'] shadow-sm"
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !manualCode.trim()}
                  className="sky-kiosk-action sky-kiosk-action-hover disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-full transition-all shadow-md shadow-blue-500/20 cursor-pointer whitespace-nowrap active:scale-[0.98]"
                >
                  {isLoading ? 'Memproses...' : 'Proses Tap'}
                </button>
              </form>

              {/* DEMO TAP CHIPS */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500 text-[10px] font-bold mr-1 flex items-center gap-1">
                  <Sparkles size={11} className="text-[#f59e0b]" />
                  Uji Coba:
                </span>
                <button
                  type="button"
                  onClick={() => handleProcessScan('1234567890')}
                  className="bg-[#fef3c7] hover:bg-[#fde68a] text-[#92400e] px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors border border-amber-200 cursor-pointer"
                >
                  Ahmad (1234567890)
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessScan('9876543210')}
                  className="bg-[#fef3c7] hover:bg-[#fde68a] text-[#92400e] px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors border border-amber-200 cursor-pointer"
                >
                  Siti (9876543210)
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessScan('5566778899')}
                  className="bg-[#fef3c7] hover:bg-[#fde68a] text-[#92400e] px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors border border-amber-200 cursor-pointer"
                >
                  Dewi (5566778899)
                </button>
              </div>
            </div>

          </div>

        </section>

        {/* RIGHT COLUMN: PRESENSI TERKINI */}
        <section className="lg:col-span-5 sky-kiosk-panel rounded-[2rem] p-5 md:p-6 shadow-sm border flex flex-col justify-between min-h-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#fef3c7] flex items-center justify-center text-[#d97706]">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="font-black text-[#111827] text-sm tracking-tight">Presensi Terkini</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Log aktivitas masuk siswa hari ini</p>
                </div>
              </div>
              <span className="text-[11px] text-[#92400e] font-black bg-[#fef3c7] border border-amber-200 px-3 py-1 rounded-full">
                {recentLogs.length} Terdata
              </span>
            </div>

            {/* Attendance Logs List (Scrollable inside card only if needed) */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0 custom-scrollbar">
              {recentLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-6">
                  <Clock size={28} className="opacity-30 mb-1.5" />
                  <p className="text-xs font-medium">Belum ada rekaman kehadiran hari ini</p>
                </div>
              ) : (
                recentLogs.map((log, idx) => {
                  const name = log.nama_lengkap || log.full_name || 'Siswa';
                  const divName = log.kelas || log.division_name || '-';
                  const timeStr = (log.scan_time || '').split(' ')[1]?.slice(0, 5) || '07:00';
                  const isLate = log.status === 'TERLAMBAT';

                  const avatarBgs = [
                    'bg-[#fde68a] text-[#92400e]',
                    'bg-[#dbeafe] text-[#1e40af]',
                    'bg-[#fbcfe8] text-[#be185d]',
                    'bg-[#bbf7d0] text-[#15803d]',
                    'bg-[#fed7aa] text-[#c2410c]'
                  ];
                  const avatarColor = avatarBgs[idx % avatarBgs.length];

                  return (
                    <div
                      key={log.id || idx}
                      className="p-2.5 hover:bg-amber-50/40 rounded-xl flex items-center justify-between gap-2.5 transition-colors border border-transparent hover:border-amber-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl ${avatarColor} flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}>
                          {name.charAt(0)}
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="font-bold text-[#111827] text-xs truncate">
                            {name}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">
                            {divName}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isLate
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 sky-kiosk-accent-text'
                        }`}>
                          {isLate ? '↓ Terlambat' : '↑ Hadir'}
                        </span>
                        <p className="text-[11px] font-bold text-slate-700 mt-0.5 tabular-nums">
                          {timeStr} WIB
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Card Helper */}
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck size={13} className="sky-kiosk-accent-text" />
              Tervalidasi Lokal & Terproteksi
            </span>
            <span className="font-bold text-[#111827]">v2.6 Kiosk</span>
          </div>
        </section>

      </main>

      {/* 4. FOOTER MINIMALIS */}
      <footer className="w-full text-center py-1 text-[11px] text-slate-500 z-10 font-medium shrink-0">
        Nebula Presence · Sistem Absensi Mandiri Offline Terpadu
      </footer>

    </div>
  );
};

export default Absensi;
