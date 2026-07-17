import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Clock, AlertTriangle, XCircle, Activity, Calendar, Building2, ShieldCheck } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../api/axios';
import { io } from 'socket.io-client';

const Dashboard = () => {
  // --- 1. STATE MANAGEMENT ---
  const [data, setData] = useState({
    total_user: 0, hadir: 0, terlambat: 0, sakit_izin: 0, alfa: 0, logs: [] 
  });
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());
  const [appConfig, setAppConfig] = useState({ 
      timezone: 'Asia/Jakarta',
      nama_instansi: 'Sistem Kehadiran Pusat',
      labels: { label_pengguna: 'Pengguna', label_kelompok: 'Kelompok' }
  });

  // --- 2. LOAD INITIAL CONFIG & TIME ---
  useEffect(() => {
    const fetchConfig = async () => {
        try {
            const res = await api.get('/settings');
            if (res.data) {
                setAppConfig({
                    timezone: res.data.timezone || 'Asia/Jakarta',
                    nama_instansi: res.data.nama_sekolah || res.data.nama_instansi || 'Sistem Kehadiran Pusat',
                    labels: res.data.labels || { label_pengguna: 'Pengguna', label_kelompok: 'Kelompok' }
                });
            }
        } catch { console.error("Gagal load config"); }
    };
    fetchConfig();

    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- 3. AUTO FETCH DATA (VIA WEBSOCKET) ---
  useEffect(() => {
    fetchDashboardData();
    
    // Connect to backend Socket.io
    const socket = io(import.meta.env.DEV ? (import.meta.env.VITE_API_URL || 'http://localhost:6990') : window.location.origin);
    
    socket.on('new_scan', () => {
        // Automatically fetch fresh dashboard data when a scan occurs
        fetchDashboardData();
    });

    return () => {
        socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appConfig.timezone]);

  const fetchDashboardData = async () => {
    try {
      const dateOptions = { timeZone: appConfig.timezone, year: 'numeric', month: '2-digit', day: '2-digit' };
      const parts = new Intl.DateTimeFormat('en-CA', dateOptions).formatToParts(new Date());
      const localDate = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;

      const [resMembers, resDaily] = await Promise.all([
        api.get('/members'), 
        api.get('/attendance/daily', { params: { tanggal: localDate } })
      ]);

      const membersArray = Array.isArray(resMembers.data) ? resMembers.data : (resMembers.data.data || []);
      const attendanceArray = Array.isArray(resDaily.data) ? resDaily.data : (resDaily.data.data || []);

      const totalMembers = membersArray.length;
      let hadir = 0, terlambat = 0, sakitIzin = 0, alfa = 0;
      
      const presentMembers = attendanceArray.filter(s => s.status);

      presentMembers.forEach(s => {
        if (s.status === 'HADIR') hadir++;
        else if (s.status === 'TERLAMBAT') terlambat++;
        else if (s.status === 'SAKIT' || s.status === 'IZIN') sakitIzin++;
        else if (s.status === 'ALFA') alfa++;
      });

      const belumAbsen = Math.max(0, totalMembers - presentMembers.length); 
      const totalAlfaDisplay = alfa + belumAbsen;

      const logs = presentMembers
        .filter(s => s.scan_time)
        .sort((a, b) => new Date(b.scan_time) - new Date(a.scan_time))
        .slice(0, 10)
        .map(log => {
          const m = membersArray.find(item => item.id === log.id);
          return {
            ...log,
            foto: m ? (m.photo || m.foto) : log.foto
          };
        });

      setData({ total_user: totalMembers, hadir, terlambat, sakit_izin: sakitIzin, alfa: totalAlfaDisplay, logs });
      setLoading(false);
    } catch (error) { console.error("Gagal ambil data dashboard:", error); }
  };

  // --- 4. FORMATTERS & HELPERS ---
  const formatTimeLog = (timeString) => {
      if (!timeString) return '-';
      try {
        return new Date(timeString).toLocaleTimeString('id-ID', { 
            timeZone: appConfig.timezone, hour: '2-digit', minute: '2-digit', hour12: false 
        }).replace('.', ':');
      } catch {
          return timeString.slice(0, 5);
      }
  };

  const getStatusBadge = (status) => {
    switch(status) {
        case 'HADIR': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'TERLAMBAT': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'SAKIT': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'IZIN': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        case 'ALFA': return 'bg-rose-100 text-rose-700 border-rose-200';
        default: return 'bg-gray-100 text-gray-600';
    }
  };

  // --- 5. UI CONFIGURATIONS ---
  const chartData = [
    { name: 'Hadir', value: data.hadir, color: '#10b981' }, 
    { name: 'Telat', value: data.terlambat, color: '#f59e0b' },
    { name: 'Izin/Sakit', value: data.sakit_izin, color: '#6366f1' }, 
    { name: 'Belum/Absen', value: Math.max(0, data.alfa), color: '#ef4444' }, 
  ];
  const isDataEmpty = chartData.every(item => item.value === 0);
  const finalChartData = isDataEmpty ? [{ name: 'Belum Ada Data', value: 1, color: '#e2e8f0' }] : chartData;

  // KEMBALI KE DESAIN GRADASI YANG LEBIH MENARIK
  const statsCards = [
    { title: `Total ${appConfig.labels.label_pengguna}`, count: data.total_user, bg: 'bg-gradient-to-br from-slate-700 to-slate-900', icon: Users, text: 'text-slate-300' },
    { title: 'Hadir Tepat', count: data.hadir, bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', icon: UserCheck, text: 'text-emerald-100' },
    { title: 'Terlambat', count: data.terlambat, bg: 'bg-gradient-to-br from-amber-400 to-amber-500', icon: Clock, text: 'text-amber-100' },
    { title: 'Izin / Sakit', count: data.sakit_izin, bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600', icon: AlertTriangle, text: 'text-indigo-100' },
    { title: 'Belum Hadir', count: data.alfa, bg: 'bg-gradient-to-br from-rose-500 to-rose-600', icon: XCircle, text: 'text-rose-100' },
  ];

  if (loading) return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-400 font-bold animate-pulse">Menyiapkan Dashboard...</span>
      </div>
  );

  const totalCheckIn = data.hadir + data.terlambat;
  const presencePercentage = data.total_user > 0 ? Math.round((totalCheckIn / data.total_user) * 100) : 0;

  return (
    <div className="space-y-6 pb-12 font-sans bg-transparent min-h-full animate-in fade-in duration-500">
      
      {/* --- HEADER TANGGAL & JAM --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700">
        <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                Ringkasan Statistik Hari Ini
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-2">
                <p className="text-slate-500 text-[13px] flex items-center gap-2 font-medium">
                    <Calendar size={16} className="text-slate-400"/> 
                    {time.toLocaleDateString('id-ID', { timeZone: appConfig.timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-600 tracking-wide">
                    <Building2 size={14} className="text-slate-500"/> 
                    {appConfig.nama_instansi}
                </div>
            </div>
        </div>

        <div className="text-left md:text-right w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
            <div className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white font-mono tracking-tighter tabular-nums">
                {time.toLocaleTimeString('id-ID', { timeZone: appConfig.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')}
            </div>
            <div className="flex items-center md:justify-end gap-2 mt-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{appConfig.timezone.split('/')[1] || 'WIB'}</span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-100">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    Live Sync
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold border border-blue-100" title="Status Sistem: Online & Aman">
                    <ShieldCheck size={12} />
                    Sistem Aman
                </span>
            </div>
        </div>
      </div>
      
      {/* --- KARTU STATISTIK (GRADIENT & BACKGROUND ICON) --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statsCards.map((item, index) => (
          <div key={index} className={`${item.bg} p-5 rounded-[1.5rem] shadow-lg shadow-slate-200/50 relative overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
            {/* Siluet Ikon di Background */}
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-25 transition-opacity transform group-hover:rotate-12 duration-500">
                <item.icon size={100} className="text-white" />
            </div>
            <div className="relative z-10 text-white">
                <div className="flex items-center gap-2 mb-3 opacity-90">
                    <item.icon size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">{item.title}</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-black tracking-tight tabular-nums">{item.count}</h3>
                <p className={`text-[11px] mt-1 font-medium opacity-90 ${item.text}`}>Data Realtime</p>
            </div>
          </div>
        ))}
      </div>

      {/* --- CHARTS & LOGS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHART SECTION */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col h-[400px]">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <div className="w-2 h-6 bg-blue-500 rounded-md"></div>
            Rasio Kehadiran
          </h3>
          
          <div className="w-full flex-1 relative min-h-[250px]">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie 
                  data={finalChartData} cx="50%" cy="50%" 
                  innerRadius={70} outerRadius={90} 
                  paddingAngle={isDataEmpty ? 0 : 5}
                  dataKey="value" cornerRadius={6} stroke="none"
                >
                  {finalChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => isDataEmpty ? '' : `${value} Orang`} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }} 
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '600', color: '#475569' }} />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                <span className="text-3xl font-black text-slate-800 dark:text-white">{isDataEmpty ? '0%' : `${presencePercentage}%`}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Kehadiran</span>
            </div>
          </div>
        </div>

        {/* LOGS SECTION */}
        <div className="bg-white dark:bg-slate-800 p-0 rounded-[1.5rem] shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 col-span-1 lg:col-span-2 flex flex-col h-[400px] overflow-hidden">
            <div className="p-6 pb-4 border-b border-slate-50 flex justify-between items-center bg-white z-10">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
                    <div className="w-2 h-6 bg-purple-500 rounded-md"></div>
                    Aktivitas Terbaru
                </h3>
            </div>
          
            <div className="overflow-y-auto p-4 space-y-2 bg-white dark:bg-slate-800 flex-1 custom-scrollbar">
                {data.logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-full mb-3"><Clock size={32} className="opacity-40"/></div>
                        <p className="text-sm font-semibold">Belum ada aktivitas scan hari ini.</p>
                    </div>
                ) : (
                    data.logs.map((log, i) => {
                        const nama = log.full_name || log.nama_lengkap || 'Tanpa Nama';
                        const divisi = log.division_name || log.kelas || 'Pengguna';
                        const idNomor = log.identity_number || log.nisn || log.nip || '-';

                        return (
                        <div key={i} className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                            <div className="flex items-center gap-4 min-w-0">
                                {log.foto ? (
                                    <div className="w-11 h-11 rounded-[12px] overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                                        <img src={log.foto} className="w-full h-full object-cover" alt="Profile" />
                                    </div>
                                ) : (
                                    <div className={`w-11 h-11 rounded-[12px] flex items-center justify-center font-black text-lg shadow-sm shrink-0 ${
                                        log.status === 'HADIR' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50' :
                                        log.status === 'TERLAMBAT' ? 'bg-amber-50 text-amber-600 border border-amber-200/50' :
                                        log.status === 'SAKIT' ? 'bg-blue-50 text-blue-600 border border-blue-200/50' :
                                        log.status === 'IZIN' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200/50' :
                                        'bg-rose-50 text-rose-600 border border-rose-200/50'
                                    }`}>
                                        {nama.charAt(0).toUpperCase()}
                                    </div>
                                )/* Permasalahan tambahan 3 */}
                                <div className="min-w-0 truncate">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-[14.5px] truncate">{nama}</p>
                                    <p className="text-[12px] text-slate-400 font-semibold truncate mt-0.5">
                                        {divisi} <span className="mx-1.5 text-slate-300 dark:text-slate-600">•</span> {idNomor}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="text-right shrink-0 ml-3">
                                <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border mb-1.5 ${getStatusBadge(log.status)}`}>
                                    {log.status}
                                </span>
                                <p className="text-[11.5px] text-slate-400 font-mono font-bold flex items-center justify-end gap-1.5">
                                    <Clock size={12} className="text-slate-300" />
                                    {formatTimeLog(log.scan_time)}
                                </p>
                            </div>
                        </div>
                    )})
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;