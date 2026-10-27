import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { io } from 'socket.io-client';
import {
  Users, CheckCircle2, AlertTriangle, Clock,
  Cloud, Cpu, ArrowUpRight,
  FileText, Calendar, Search, ArrowRight,
  MoreHorizontal, Bell, ExternalLink,
  ChevronDown, MessageSquare, ThumbsUp, CloudUpload, X, Sparkles, Database
} from 'lucide-react';
import logoNabastala from '../assets/logo-nabastala.png';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncingPortal, setSyncingPortal] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('Menyiapkan koneksi Portal...');
  const [cloudSyncStatus, setCloudSyncStatus] = useState({ enabled: false, lastStatus: 'idle', url: '' });
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [activeTab, setActiveTab] = useState('activity');
  const [searchTerm, setSearchTerm] = useState('');

  const [data, setData] = useState({
    total: 0,
    hadir: 0,
    terlambat: 0,
    sakit_izin: 0,
    alfa: 0,
    logs: []
  });

  const [appConfig, setAppConfig] = useState({
    timezone: 'Asia/Jakarta',
    nama_instansi: 'Sistem Kehadiran',
    labels: { label_pengguna: 'Siswa', label_kelompok: 'Kelas' },
    cloud_sync_active: '0'
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      const dateOptions = { timeZone: appConfig.timezone, year: 'numeric', month: '2-digit', day: '2-digit' };
      const parts = new Intl.DateTimeFormat('en-CA', dateOptions).formatToParts(new Date());
      const localDate = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;

      // Ambil data dashboard, members & daily attendance untuk akurasi optimal
      const [resMembers, resDaily, resSettings, resCloudSync] = await Promise.all([
        api.get('/members').catch(() => ({ data: [] })),
        api.get('/attendance/daily', { params: { tanggal: localDate } }).catch(() => ({ data: [] })),
        api.get('/settings').catch(() => ({ data: {} })),
        api.get('/cloud-sync/status').catch(() => ({ data: { enabled: false, lastStatus: 'idle', url: '' } }))
      ]);
      setCloudSyncStatus(resCloudSync.data || { enabled: false, lastStatus: 'idle', url: '' });

      const membersArray = Array.isArray(resMembers.data) ? resMembers.data : (resMembers.data?.data || []);
      const attendanceArray = Array.isArray(resDaily.data) ? resDaily.data : (resDaily.data?.data || []);

      const totalMembers = membersArray.length;
      let hadir = 0, terlambat = 0, sakitIzin = 0, alfa = 0;

      attendanceArray.forEach(item => {
        const st = (item.status || '').toUpperCase();
        if (st === 'HADIR') hadir++;
        else if (st === 'TERLAMBAT') terlambat++;
        else if (st === 'SAKIT' || st === 'IZIN') sakitIzin++;
        else if (st === 'ALFA') alfa++;
      });

      const totalHadir = hadir + terlambat;
      const belumScan = Math.max(0, totalMembers - (totalHadir + sakitIzin + alfa));

      setData({
        total: totalMembers,
        hadir,
        terlambat,
        sakit_izin: sakitIzin,
        alfa: alfa + belumScan,
        logs: attendanceArray.length > 0 ? attendanceArray : []
      });

      const today = new Date();
      const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: appConfig.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(today);
      const todayKey = `${todayParts.find(p => p.type === 'year')?.value}-${todayParts.find(p => p.type === 'month')?.value}-${todayParts.find(p => p.type === 'day')?.value}`;
      const mondayOffset = (today.getDay() + 6) % 7;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - mondayOffset);
      // Jangan tampilkan hari-hari mendatang sebagai nol; itu membuat grafik tampak tidak realistis.
      const elapsedDays = mondayOffset + 1;
      const weekResults = await Promise.all(Array.from({ length: elapsedDays }, async (_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: appConfig.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
        const dateKey = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
        const label = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: appConfig.timezone }).format(date).replace('.', '');
        if (dateKey > todayKey) return { label, count: null, date: dateKey };
        try {
          const response = await api.get('/attendance/daily', { params: { tanggal: dateKey } });
          const rows = Array.isArray(response.data) ? response.data : (response.data?.data || []);
          return { label, count: rows.filter(row => ['HADIR', 'TERLAMBAT'].includes(String(row.status || '').toUpperCase())).length, date: dateKey };
        } catch {
          return { label, count: null, date: dateKey };
        }
      }));
      setWeeklyStats(weekResults);

      if (resSettings.data) {
        const isEdu = (resSettings.data.app_mode || 'edukasi') === 'edukasi';
        setAppConfig({
          timezone: resSettings.data.timezone || 'Asia/Jakarta',
          nama_instansi: resSettings.data.nama_sekolah || resSettings.data.nama_instansi || 'Sistem Kehadiran',
          labels: resSettings.data.labels || {
            label_pengguna: isEdu ? 'Siswa' : 'Karyawan',
            label_kelompok: isEdu ? 'Kelas' : 'Divisi'
          },
          cloud_sync_active: resSettings.data.cloud_sync_active || '0'
        });
      }
    } catch (err) {
      console.warn("Gagal mengambil data dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [appConfig.timezone]);

  // Real-time update dengan socket.io
  useEffect(() => {
    fetchDashboardData();

    try {
      const socket = io(import.meta.env.DEV ? (import.meta.env.VITE_API_URL || 'http://localhost:6990') : window.location.origin, {
        reconnectionAttempts: 2,
        timeout: 3000
      });
      socket.on('new_scan', () => {
        fetchDashboardData();
      });
      socket.on('cloud_sync_status', status => {
        fetchDashboardData();
        if (!status || typeof status !== 'object') return;
        if (Number.isFinite(Number(status.progress))) {
          setSyncProgress(current => Math.max(current, Math.min(100, Number(status.progress))));
        }
        if (status.message) setSyncMessage(status.message);
        if (status.state === 'offline') {
          setSyncMessage(status.error || status.message || 'Portal tidak dapat dijangkau.');
        }
      });
      return () => socket.disconnect();
    } catch {
      /* ignore socket */
    }
  }, [fetchDashboardData]);

  const handlePortalSync = async () => {
    setSyncModalOpen(true);
    setSyncingPortal(true);
    setSyncProgress(8);
    setSyncMessage('Membuka jalur komunikasi dengan Portal...');
    try {
      setSyncMessage('Mengirim antrean data yang menunggu sinkronisasi...');
      const response = await api.post('/cloud-sync/trigger');
      if (response.data?.success === false) throw new Error(response.data.message || 'Portal menolak proses sinkronisasi.');
      setSyncProgress(100);
      setSyncMessage(response.data?.message || 'Permintaan sinkronisasi selesai diproses.');
      toast.success('Proses sinkronisasi Portal selesai.');
      fetchDashboardData();
    } catch (error) {
      setSyncMessage(error.response?.data?.message || error.message || 'Gagal mengirim data ke Portal. Periksa koneksi dan pengaturan sinkronisasi.');
      toast.error('Sinkronisasi Portal gagal. Periksa status koneksi.');
    } finally {
      setSyncingPortal(false);
    }
  };

  const totalEffective = data.total > 0 ? data.total : (data.hadir + data.terlambat + data.alfa || 1);
  const hadirPercent = Math.min(100, Math.round((data.hadir / totalEffective) * 100));
  const latePercent = Math.min(100, Math.round((data.terlambat / totalEffective) * 100));
  const absentPercent = Math.max(0, 100 - (hadirPercent + latePercent));
  const lastSuccessfulSync = cloudSyncStatus?.lastTime ? new Date(cloudSyncStatus.lastTime).getTime() : 0;
  const recentPortalConnection = Number.isFinite(lastSuccessfulSync) && lastSuccessfulSync > 0 && (Date.now() - lastSuccessfulSync) < 90000;
  const portalHandshakeFailed = Array.isArray(cloudSyncStatus?.lastErrors)
    && cloudSyncStatus.lastErrors.some(error => /handshake portal/i.test(String(error)));
  const portalSyncAvailable = ['synced', 'partial'].includes(cloudSyncStatus?.lastStatus) && !portalHandshakeFailed;
  const canSendToPortal = String(appConfig.cloud_sync_active) === '1'
    && cloudSyncStatus?.enabled === true
    && portalSyncAvailable
    && Boolean(cloudSyncStatus?.url)
    && recentPortalConnection;

  const filteredLogs = (data.logs || []).filter(log => {
    const name = (log.nama || log.nama_lengkap || log.full_name || '').toLowerCase();
    const div = (log.divisi || log.kelas || log.division_name || '').toLowerCase();
    const query = searchTerm.toLowerCase();
    return name.includes(query) || div.includes(query);
  });

  return (
    <div className="space-y-7 font-['Poppins'] text-[#0b1730] dark:text-slate-100">
      
      {/* 1. TOP HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0b1730] dark:text-white">
            Analytics Presensi
          </h1>
          <p className="text-xs text-stone-600 dark:text-slate-400 mt-1 font-medium">
            Pemantauan kehadiran dan aktivitas presensi harian secara real-time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Institution Selector */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-full shadow-sm border border-stone-200 dark:border-slate-700 text-xs font-semibold text-stone-700 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="truncate max-w-[160px] sm:max-w-xs">{appConfig.nama_instansi}</span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Cari ${appConfig.labels?.label_pengguna || 'Siswa'}...`}
              className="bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-full px-4 py-2.5 pl-9 text-xs text-stone-800 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-stone-400 transition-all w-48 sm:w-56 shadow-sm"
            />
            <Search size={14} className="absolute left-3.5 top-3 text-stone-400 dark:text-slate-500" />
          </div>

          {/* Action button */}
          <Link
            to="/admin/attendance-manual"
            className="bg-[#0b1730] hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2.5 rounded-full transition-all shadow-md whitespace-nowrap"
          >
            + Input Presensi
          </Link>

          {canSendToPortal && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={handlePortalSync} disabled={syncingPortal} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 disabled:opacity-60">
                <CloudUpload size={15} className={syncingPortal ? 'animate-bounce' : ''} />
                {syncingPortal ? 'Mengirim...' : 'Kirim ke Portal'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. GRID SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: 2 TOP CARDS + BOTTOM TABLE (8 COLS) */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CARD 1: VIVID CORAL-ROSE SUNSET GRADIENT CARD */}
            <div className="bg-gradient-to-br from-[#0b1730] via-[#1d4ed8] to-[#38bdf8] rounded-[2.25rem] p-7 text-white shadow-xl shadow-blue-900/20 flex flex-col justify-between relative overflow-hidden min-h-[260px]">
              
              <div className="flex items-center justify-between z-10">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Total Hadir Hari Ini
                </span>
                <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">
                  {new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>

              <div className="py-2 z-10">
                <div className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-sm font-['Poppins']">
                  {data.hadir + data.terlambat}
                  <span className="text-2xl font-bold ml-2 text-white/90">{appConfig.labels?.label_pengguna || 'Siswa'}</span>
                </div>
              </div>

              {/* Decorative Curves SVG */}
              <div className="my-2 h-14 relative z-0 opacity-80 pointer-events-none">
                <svg viewBox="0 0 400 60" className="w-full h-full" fill="none">
                  <path
                    d="M0 35 Q 70 5, 140 30 T 280 20 T 400 15"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M0 45 Q 80 15, 160 40 T 300 25 T 400 35"
                    stroke="#ffb3c1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M0 25 Q 90 45, 180 20 T 320 40 T 400 25"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </svg>
              </div>

              {/* Bottom 3 metrics */}
              <div className="grid grid-cols-3 pt-3 border-t border-dashed border-white/30 text-center z-10">
                <div className="border-r border-dashed border-white/30 pr-2">
                  <p className="text-[10px] uppercase font-semibold text-white/80">Tepat Waktu</p>
                  <p className="text-lg font-extrabold font-['Poppins']">%{hadirPercent}</p>
                </div>
                <div className="border-r border-dashed border-white/30 px-2">
                  <p className="text-[10px] uppercase font-semibold text-white/80">Terlambat</p>
                  <p className="text-lg font-extrabold font-['Poppins']">%{latePercent}</p>
                </div>
                <div className="pl-2">
                  <p className="text-[10px] uppercase font-semibold text-white/80">Kehadiran</p>
                  <p className="text-lg font-extrabold font-['Poppins']">
                    %{Math.min(100, Math.round(((data.hadir + data.terlambat) / totalEffective) * 100))}
                  </p>
                </div>
              </div>
            </div>

            {/* CARD 2: RADIAL DONUT DISTRIBUTION */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.25rem] p-7 shadow-sm border border-stone-200/70 dark:border-slate-700 flex flex-col justify-between">
              
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 dark:text-white">
                  Distribusi Kehadiran
                </span>
                <span className="text-[11px] font-semibold text-stone-400">Hari Ini</span>
              </div>

              <div className="flex items-center justify-between gap-4 py-3">
                <div className="space-y-3">
                  <div>
                    <span className="text-3xl font-extrabold text-[#0b1730] dark:text-white font-['Poppins']">
                      {data.total}
                      <span className="text-sm font-semibold text-stone-400 ml-1">Total {appConfig.labels?.label_pengguna || 'Siswa'}</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                      <span className="font-extrabold text-[#0b1730] dark:text-white">%{hadirPercent}</span>
                      <span className="text-stone-500 dark:text-slate-400 font-medium text-[11px]">Hadir</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#fbb034]" />
                      <span className="font-extrabold text-[#0b1730] dark:text-white">%{latePercent}</span>
                      <span className="text-stone-500 dark:text-slate-400 font-medium text-[11px]">Terlambat</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#64748b] dark:bg-slate-400" />
                      <span className="font-extrabold text-[#0b1730] dark:text-white">%{absentPercent}</span>
                      <span className="text-stone-500 dark:text-slate-400 font-medium text-[11px]">Belum Hadir</span>
                    </div>
                  </div>
                </div>

                {/* SVG Radial Donut */}
                <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#f1eee7"
                      strokeWidth="10"
                      fill="none"
                      className="dark:stroke-slate-700"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#f59e0b"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray="238.7"
                      strokeDashoffset={238.7 - (238.7 * hadirPercent) / 100}
                      strokeLinecap="round"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="28"
                      stroke="#fbb034"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray="175.9"
                      strokeDashoffset={175.9 - (175.9 * latePercent) / 100}
                      strokeLinecap="round"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="18"
                      stroke="#64748b"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray="113.1"
                      strokeDashoffset={113.1 - (113.1 * absentPercent) / 100}
                      strokeLinecap="round"
                      className="dark:stroke-slate-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-[#eaf2ff] dark:bg-blue-950 flex items-center justify-center text-[#f59e0b] font-black text-xs shadow-inner">
                      <Sparkles size={14} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 dark:border-slate-700 flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400">
                <span>Rasio Kehadiran</span>
                <span className="font-bold text-stone-800 dark:text-slate-200">{hadirPercent + latePercent}% Tercatat</span>
              </div>
            </div>

          </div>

          {/* BOTTOM TABLE: AKTIVITAS PRESENSI */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.25rem] p-7 shadow-sm border border-stone-200/70 dark:border-slate-700">
            <div className="flex items-center gap-6 border-b border-stone-100 dark:border-slate-700 pb-3 mb-5">
              <button
                onClick={() => setActiveTab('activity')}
                className={`text-sm font-bold pb-2 transition-all relative ${
                  activeTab === 'activity'
                    ? 'text-[#0b1730] dark:text-white'
                    : 'text-stone-400 hover:text-stone-600 dark:hover:text-slate-300'
                }`}
              >
                <span>Aktivitas Presensi Terakhir</span>
                {activeTab === 'activity' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1730] dark:bg-cyan-400 rounded-full" />
                )}
              </button>
            </div>

            <div className="space-y-3.5">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-10 text-stone-400 dark:text-slate-500 text-xs">
                  Belum ada log presensi pada hari ini.
                </div>
              ) : (
                filteredLogs.slice(0, 6).map((log, index) => {
                  const name = log.nama || log.nama_lengkap || log.full_name || 'Peserta';
                  const div = log.divisi || log.kelas || log.division_name || '-';
                  const isLate = (log.status || '').toUpperCase() === 'TERLAMBAT';
                  const timeStr = log.time_in || (log.scan_time || '').split(' ')[1]?.slice(0, 5) || '--:--';

                  const avatarBgs = [
                    'bg-[#fed7aa] text-[#c2410c]',
                    'bg-[#fbcfe8] text-[#be185d]',
                    'bg-[#e9d5ff] text-[#7e22ce]',
                    'bg-[#bbf7d0] text-[#15803d]',
                    'bg-[#bae6fd] text-[#0369a1]'
                  ];
                  const avatarColor = avatarBgs[index % avatarBgs.length];

                  return (
                    <div
                      key={log.id || index}
                      className="p-3 hover:bg-stone-50 dark:hover:bg-slate-750 rounded-2xl flex items-center justify-between gap-3 transition-colors border border-transparent hover:border-stone-100 dark:hover:border-slate-700"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl ${avatarColor} flex items-center justify-center font-bold text-sm shadow-sm shrink-0`}>
                          {name.charAt(0)}
                        </div>

                        <div className="min-w-0 truncate">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[#0b1730] dark:text-white text-xs sm:text-sm truncate">
                              {name}
                            </p>
                          </div>
                          <p className="text-[11px] text-stone-500 dark:text-slate-400 font-medium truncate mt-0.5">
                            {div} · {log.method || 'Kiosk'}
                          </p>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-slate-300">
                        <Clock size={13} className="text-stone-400" />
                        <span>{timeStr} WIB</span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                          isLate
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {isLate ? '↓ Terlambat' : '↑ Hadir'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-stone-100 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-stone-400 dark:text-slate-500">Menampilkan {Math.min(6, filteredLogs.length)} dari {filteredLogs.length} data</span>
              <Link
                to="/admin/reports"
                className="font-bold text-[#0b1730] dark:text-cyan-400 hover:text-blue-600 inline-flex items-center gap-1"
              >
                <span>Buka Seluruh Laporan</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: 3 STAT WIDGETS + BAR CHART (4 COLS) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* STAT CARD 1: COMMENTS / RASIO KEHADIRAN */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-5 shadow-sm border border-stone-200/70 dark:border-slate-700 flex items-center justify-between gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#eaf2ff] dark:bg-blue-950/50 flex flex-col items-center justify-center shrink-0">
              <span className="text-lg font-black text-[#0b1730] dark:text-white leading-none">
                {hadirPercent}%
              </span>
              <MessageSquare size={14} className="text-[#f59e0b] mt-1" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#0b1730] dark:text-white truncate">Rasio Kehadiran Hari Ini</p>
              <div className="mt-2 w-full bg-stone-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#1d4ed8] to-[#38bdf8] h-full rounded-full transition-all duration-500"
                  style={{ width: `${hadirPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* STAT CARD 2: REAL DATA WEEKLY CHART */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-bold text-slate-900 dark:text-white">Statistik Mingguan</p><p className="text-xs text-slate-500 mt-1">Jumlah hadir dan terlambat dibanding total anggota terdaftar</p></div>
              <span className="rounded-lg bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">Aktual</span>
            </div>
            <div className="grid grid-cols-7 gap-2 items-end h-40 pt-2">
              {(weeklyStats.length ? weeklyStats : ['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(label => ({ label, count: 0 }))).map((day, index) => {
                // Gunakan total anggota terdaftar sebagai skala tetap agar perbandingan antarhari tidak menyesatkan.
                const maxCount = Math.max(1, Number(data.total) || 0);
                const height = Number.isFinite(day.count) && day.count > 0 ? Math.min(112, Math.max(5, Math.round((day.count / maxCount) * 112))) : 4;
                return <div key={day.date || day.label || index} className="flex h-full flex-col items-center justify-end gap-2 min-w-0">
                  <span className="text-[10px] font-semibold text-slate-500">{Number.isFinite(day.count) ? day.count : "—"}</span>
                  <div className="w-full max-w-5 rounded-t-lg bg-gradient-to-t from-blue-800 via-blue-600 to-sky-400 transition-all duration-500" style={{ height: `${height}px` }} title={`${day.label}: ${Number.isFinite(day.count) ? `${day.count} hadir` : 'data tidak tersedia'}`} />
                  <span className="text-[10px] font-semibold text-slate-500 capitalize">{day.label}</span>
                </div>;
              })}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><Calendar size={16} /></div><div><p className="text-xs font-bold text-slate-900 dark:text-white">Presensi hari ini</p><p className="text-[10px] text-slate-500">Hadir + terlambat</p></div></div>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">{data.hadir + data.terlambat}</span>
            </div>
          </div>

          {/* STAT CARD 3: QUICK LINK KE LAPORAN */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-5 shadow-sm border border-stone-200/70 dark:border-slate-700 flex items-center justify-between gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#eaf2ff] dark:bg-blue-950/50 flex flex-col items-center justify-center shrink-0">
              <span className="text-lg font-black text-[#0b1730] dark:text-white leading-none">
                {data.logs.length}
              </span>
              <ThumbsUp size={14} className="text-[#f59e0b] mt-1" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#0b1730] dark:text-white truncate">Total Log Presensi Terkumpul</p>
              <div className="mt-2 w-full bg-stone-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div className="bg-[#0b1730] dark:bg-cyan-400 h-full rounded-full w-full" />
              </div>
            </div>
          </div>

        </div>

      </div>

      {syncModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-4" role="dialog" aria-modal="true" aria-labelledby="portal-sync-title">
          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-blue-100/70 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-950 via-blue-600 to-orange-400" />
            <button type="button" onClick={() => { if (!syncingPortal) setSyncModalOpen(false); }} disabled={syncingPortal} className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800" aria-label="Tutup dialog"><X size={18} /></button>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 via-blue-700 to-sky-400 text-white shadow-lg shadow-blue-900/20">
              {syncProgress === 100 ? <CheckCircle2 size={30} /> : <CloudUpload size={30} className={syncingPortal ? 'animate-pulse' : ''} />}
            </div>
            <div className="text-center"><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">Nebula transfer channel</p><h2 id="portal-sync-title" className="text-xl font-extrabold text-slate-900 dark:text-white">{syncingPortal ? 'Mengirim data ke Portal' : syncProgress === 100 ? 'Proses sinkronisasi selesai' : 'Status pengiriman data'}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">{syncMessage}</p></div>
            <div className="my-7 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-orange-50 p-4 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/30">
              <div className="mb-4 flex items-center justify-between text-xs"><span className="font-semibold text-slate-600 dark:text-slate-300">Kanal transfer data</span><span className="font-extrabold tabular-nums text-blue-800 dark:text-sky-300">{syncProgress}%</span></div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-sky-100 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-950 text-sky-200 shadow-md"><Database size={18} /></span>
                  <span className="text-[10px] font-extrabold tracking-wide text-slate-700 dark:text-slate-200">NEBULA</span>
                  <span className="text-[9px] text-slate-400">Data lokal</span>
                </div>
                <div className="relative flex w-14 flex-col items-center justify-center">
                  <ArrowRight size={20} className={syncingPortal ? 'animate-pulse text-blue-700 dark:text-sky-300' : 'text-slate-400'} />
                  {syncingPortal && <><span className="absolute -top-3 left-2 h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" /><span className="absolute top-1 left-5 h-1.5 w-1.5 animate-ping rounded-full bg-orange-400" /><span className="absolute -bottom-3 right-2 h-1.5 w-1.5 animate-bounce rounded-full bg-blue-700 [animation-delay:180ms]" /></>}
                </div>
                <div className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-orange-100 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-700 text-white shadow-md"><Cloud size={18} /></span>
                  <span className="text-[10px] font-extrabold tracking-wide text-slate-700 dark:text-slate-200">PORTAL</span>
                  <span className="text-[9px] text-slate-400">Server tujuan</span>
                </div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-blue-950 via-sky-500 to-orange-400 transition-all duration-500" style={{ width: `${syncProgress}%` }} /></div>
              <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${syncingPortal ? 'animate-pulse bg-orange-400' : syncProgress === 100 ? 'bg-emerald-500' : 'bg-slate-400'}`} />{syncingPortal ? 'Paket data sedang bergerak' : syncProgress === 100 ? 'Transfer selesai' : 'Kanal menunggu'}</span><span>LOCAL → CLOUD</span></div>
            </div>
            {!syncingPortal && <button type="button" onClick={() => setSyncModalOpen(false)} className="w-full rounded-xl bg-gradient-to-r from-blue-900 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:brightness-110">Tutup</button>}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;