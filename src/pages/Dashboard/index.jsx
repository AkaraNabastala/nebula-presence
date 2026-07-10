import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Clock, AlertTriangle, XCircle, Activity, Calendar, Building2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../api/axios';

const Dashboard = () => {
  // State Data
  const [data, setData] = useState({
    total_user: 0,
    hadir: 0,
    terlambat: 0,
    sakit_izin: 0,
    alfa: 0,
    logs: [] 
  });
  const [loading, setLoading] = useState(true);
  
  // State User & Config
  const [time, setTime] = useState(new Date());
  const [userName, setUserName] = useState('Admin'); // Default jika nama tidak ditemukan
  const [appConfig, setAppConfig] = useState({ 
      timezone: 'Asia/Jakarta',
      nama_instansi: 'Nama Instansi' // Default text netral
  });

  // --- 1. LOAD USER, CONFIG & JAM ---
  useEffect(() => {
    // A. Ambil Nama Admin dari LocalStorage (Hasil Login)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            // Cek berbagai kemungkinan nama field dari database
            const realName = parsedUser.nama_admin || parsedUser.nama_lengkap || parsedUser.nama || parsedUser.username;
            if (realName) setUserName(realName);
        } catch (e) {
            console.error("Gagal parse user data");
        }
    }

    // B. Ambil Konfigurasi Instansi (Logo, Nama, Timezone)
    const fetchConfig = async () => {
        try {
            const res = await api.get('/settings');
            if (res.data) {
                setAppConfig({
                    timezone: res.data.timezone || 'Asia/Jakarta',
                    // Ambil 'nama_sekolah' dari DB tapi simpan sebagai 'nama_instansi' agar netral di frontend
                    nama_instansi: res.data.nama_sekolah || res.data.nama_instansi || 'Nama Instansi Anda'
                });
            }
        } catch (e) {
            console.error("Gagal load config settings");
        }
    };
    fetchConfig();

    // C. Jalankan Jam
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- 2. AUTO REFRESH DATA ---
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000); 
    return () => clearInterval(interval);
  }, [appConfig.timezone]);

  // --- FUNGSI UTAMA: AMBIL DATA ---
  const fetchDashboardData = async () => {
    try {
      // 1. Tanggal Hari Ini (Timezone Safe)
      const dateOptions = { timeZone: appConfig.timezone, year: 'numeric', month: '2-digit', day: '2-digit' };
      const parts = new Intl.DateTimeFormat('en-CA', dateOptions).formatToParts(new Date());
      const localDate = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;

      // 2. Request Data
      const [resMembers, resDaily] = await Promise.all([
        api.get('/members'), 
        api.get('/attendance/daily', { 
            params: { tanggal: localDate } 
        })
      ]);

      const totalMembers = resMembers.data.length;
      const attendanceData = resDaily.data;

      // 3. Hitung Statistik
      let hadir = 0, terlambat = 0, sakitIzin = 0, alfa = 0;
      
      const presentMembers = attendanceData.filter(s => s.status);

      presentMembers.forEach(s => {
        if (s.status === 'HADIR') hadir++;
        else if (s.status === 'TERLAMBAT') terlambat++;
        else if (s.status === 'SAKIT' || s.status === 'IZIN') sakitIzin++;
        else if (s.status === 'ALFA') alfa++;
      });

      const belumAbsen = Math.max(0, totalMembers - presentMembers.length); 
      // Kita masukkan "Belum Absen" ke kategori Alfa/Pending untuk display grafik
      const totalAlfaDisplay = alfa + belumAbsen;

      // 4. Log Aktivitas
      const logs = presentMembers
        .filter(s => s.scan_time)
        .sort((a, b) => b.scan_time.localeCompare(a.scan_time))
        .slice(0, 10);

      setData({
        total_user: totalMembers,
        hadir: hadir,
        terlambat: terlambat,
        sakit_izin: sakitIzin,
        alfa: totalAlfaDisplay,
        logs: logs
      });
      setLoading(false);

    } catch (error) {
      console.error("Gagal ambil data dashboard:", error);
    }
  };

  // --- HELPER: SAPAAN ---
  const getGreeting = () => {
    const hourStr = time.toLocaleTimeString('en-GB', { timeZone: appConfig.timezone, hour: '2-digit', hour12: false });
    const hour = parseInt(hourStr);
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  // --- HELPER: FORMAT JAM ---
  const formatTimeLog = (timeString) => {
      if (!timeString) return '-';
      if (timeString.includes('T') || timeString.includes('-')) {
          return new Date(timeString).toLocaleTimeString('id-ID', { 
            timeZone: appConfig.timezone, 
            hour: '2-digit', minute: '2-digit', hour12: false 
          }).replace('.', ':');
      }
      return timeString.slice(0, 5);
  };

  // Setup Grafik & Kartu
  const chartData = [
    { name: 'Hadir', value: data.hadir, color: '#10b981' }, 
    { name: 'Telat', value: data.terlambat, color: '#f59e0b' },
    { name: 'Sakit/Izin', value: data.sakit_izin, color: '#6366f1' }, 
    { name: 'Belum/Absen', value: Math.max(0, data.alfa), color: '#ef4444' }, 
  ];
  const isDataEmpty = chartData.every(item => item.value === 0);
  const finalChartData = isDataEmpty ? [{ name: 'Belum Ada Data', value: 1, color: '#e5e7eb' }] : chartData;

  // Setup Kartu Statistik (Istilah Netral)
  const statsCards = [
    { title: 'Total Anggota', count: data.total_user, bg: 'bg-gradient-to-br from-blue-500 to-blue-600', icon: Users, text: 'text-blue-50' },
    { title: 'Hadir Tepat', count: data.hadir, bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', icon: UserCheck, text: 'text-emerald-50' },
    { title: 'Terlambat', count: data.terlambat, bg: 'bg-gradient-to-br from-amber-400 to-amber-500', icon: Clock, text: 'text-amber-50' },
    { title: 'Izin / Sakit', count: data.sakit_izin, bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600', icon: AlertTriangle, text: 'text-indigo-50' },
    { title: 'Belum Hadir', count: data.alfa, bg: 'bg-gradient-to-br from-rose-500 to-rose-600', icon: XCircle, text: 'text-rose-50' },
  ];

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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 font-medium animate-pulse">Memuat Dashboard...</div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-24 md:pb-10 font-sans">
      
      {/* HEADER: SAPAAN PERSONAL & NAMA INSTANSI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
            {/* SAPAAN DINAMIS SESUAI NAMA LOGIN */}
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight capitalize">
                {getGreeting()}, <span className="text-blue-600">{userName}</span>!
            </h2>
            
            <div className="flex flex-wrap items-center gap-3 mt-1">
                {/* TANGGAL */}
                <p className="text-gray-500 text-sm flex items-center gap-2">
                    <Calendar size={14}/> 
                    {time.toLocaleDateString('id-ID', { 
                        timeZone: appConfig.timezone, 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    })}
                </p>
                
                {/* NAMA INSTANSI/PERUSAHAAN (BUKAN SEKOLAH) */}
                <div className="hidden md:flex items-center gap-1.5 px-3 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold border border-gray-200 uppercase tracking-wide">
                    <Building2 size={12} className="text-blue-500"/> 
                    {appConfig.nama_instansi}
                </div>
            </div>
        </div>

        {/* JAM DIGITAL KANAN */}
        <div className="text-right w-full md:w-auto flex flex-row md:flex-col justify-between md:justify-end items-center md:items-end">
            <div className="text-3xl md:text-4xl font-black text-gray-800 font-mono tracking-tight leading-none">
                {time.toLocaleTimeString('id-ID', { 
                    timeZone: appConfig.timezone, 
                    hour: '2-digit', minute: '2-digit', second: '2-digit' 
                }).replace(/\./g, ':')}
            </div>
            <div className="flex items-center justify-end gap-2 mt-1">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                    {appConfig.timezone.split('/')[1] || 'WIB'}
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-bold border border-green-200 animate-pulse">
                    <Activity size={10}/> System Live
                </span>
            </div>
        </div>
      </div>
      
      {/* 1. KARTU STATISTIK */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {statsCards.map((item, index) => (
          <div key={index} className={`${item.bg} p-4 rounded-2xl shadow-lg shadow-gray-200/50 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity transform rotate-12">
                <item.icon size={80} className="text-white" />
            </div>
            
            <div className="relative z-10 text-white">
                <div className="flex items-center gap-2 mb-2 opacity-90">
                    <item.icon size={16} className="md:w-[18px]" />
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">{item.title}</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black tracking-tight">{item.count}</h3>
                <p className={`text-[10px] mt-1 font-medium opacity-80 ${item.text}`}>
                    Orang
                </p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. CHART & LOGS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRAFIK LINGKARAN */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 min-w-0 flex flex-col justify-between h-[350px] md:h-[450px] lg:h-auto">
          <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
            Statistik Kehadiran
          </h3>
          
          <div className="w-full flex-1 relative min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={finalChartData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60} 
                  outerRadius={80} 
                  paddingAngle={isDataEmpty ? 0 : 4}
                  dataKey="value"
                  cornerRadius={4}
                >
                  {finalChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => isDataEmpty ? '' : `${value} Orang`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                <span className="text-2xl md:text-3xl font-bold text-gray-800">{isDataEmpty ? 0 : data.hadir + data.terlambat}</span>
                <span className="text-xs text-gray-400 font-medium">Check-In</span>
            </div>
          </div>
        </div>

        {/* LOG AKTIVITAS TERAKHIR */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 lg:col-span-2 min-w-0 flex flex-col h-[450px]">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                    Aktivitas Terbaru
                </h3>
            </div>
          
            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {data.logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                        <div className="p-4 bg-gray-50 rounded-full mb-3">
                            <Clock size={32} className="opacity-20"/>
                        </div>
                        <p className="text-sm">Belum ada aktivitas scan hari ini.</p>
                    </div>
                ) : (
                    data.logs.map((log, i) => (
                    <div key={i} className="flex items-center justify-between p-3 md:p-4 bg-white hover:bg-gray-50 transition-all rounded-xl border border-gray-100 hover:border-blue-100 group shadow-sm hover:shadow-md">
                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-sm md:text-lg shadow-sm shrink-0 transition-transform group-hover:scale-110 ${
                                log.status === 'HADIR' ? 'bg-emerald-100 text-emerald-600' :
                                log.status === 'TERLAMBAT' ? 'bg-amber-100 text-amber-600' :
                                log.status === 'SAKIT' ? 'bg-blue-100 text-blue-600' :
                                log.status === 'IZIN' ? 'bg-indigo-100 text-indigo-600' :
                                'bg-rose-100 text-rose-600'
                            }`}>
                                {log.nama_lengkap.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-gray-800 text-sm md:text-base truncate">{log.nama_lengkap}</p>
                                <p className="text-[10px] md:text-xs text-gray-500 font-medium truncate">
                                    {/* MENGGUNAKAN ISTILAH UMUM */}
                                    {log.kelas || log.jabatan || log.divisi || 'Anggota'} • {log.nisn || log.nip || log.nik || 'ID'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="text-right shrink-0 ml-2">
                            <span className={`inline-block px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[9px] md:text-[10px] font-bold border mb-1 ${getStatusBadge(log.status)}`}>
                                {log.status}
                            </span>
                            <p className="text-[10px] text-gray-400 font-mono flex items-center justify-end gap-1">
                                <Clock size={10} className="md:w-3 md:h-3" />
                                {formatTimeLog(log.scan_time)}
                            </p>
                        </div>
                    </div>
                    ))
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;