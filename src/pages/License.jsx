import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  ShieldCheck, Clock, Building2, KeyRound, 
  RefreshCcw, AlertCircle, CheckCircle, Info, X, Crown 
} from 'lucide-react';

const License = () => {
  const [data, setData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Deteksi Unlimited (> 5 Tahun)
  const isUnlimited = timeLeft > 157788000;
  
  // State Notifikasi (Toast)
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // Ambil data status lisensi saat load
  const fetchStatus = async () => {
    try {
      const res = await api.get('/license-status');
      setData(res.data);
      setTimeLeft(res.data.remainingSeconds);
    } catch (err) { 
      console.error("Gagal memuat status lisensi"); 
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  // Timer Mundur
  useEffect(() => {
    if (timeLeft <= 0) return;
    // Jika unlimited, tidak perlu countdown real-time (hemat resource)
    if (isUnlimited) return;

    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isUnlimited]);

  // Helper Toast
  const showToast = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 4000);
  };

  // --- LOGIKA SMART COUNTDOWN ---
  const formatSmartTime = (totalSeconds) => {
    if (!totalSeconds || totalSeconds <= 0) return "Habis";
    
    // Jika lebih dari 5 tahun (157.788.000 detik), return teks Unlimited
    if (totalSeconds > 157788000) { 
        return "UNLIMITED"; 
    }

    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days} Hari ${hours} Jam`;
    if (hours > 0) return `${hours} Jam ${minutes} Menit`;
    return `${minutes} Menit ${seconds} Detik`;
  };

  // Handle Aktivasi
  const handleUpdate = async () => {
    if (!code) return;
    setLoading(true);
    try {
      const res = await api.post('/activation', { code });
      if (res.data.success) {
          showToast('success', res.data.message || "Aktivasi Berhasil!");
          setTimeout(() => window.location.reload(), 2000);
      } else {
          showToast('error', res.data.message || "Gagal mengaktifkan lisensi.");
      }
    } catch (e) {
      showToast('error', "Terjadi kesalahan koneksi atau kode tidak valid!");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-8 pb-24 md:pb-10 font-sans">
      
      {/* TOAST NOTIFICATION */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-[99] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right border bg-white ${notification.type === 'success' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`}>
            {notification.type === 'success' ? <CheckCircle size={22}/> : <AlertCircle size={22}/>}
            <div><h4 className="font-bold text-sm">{notification.type === 'success' ? 'Berhasil' : 'Gagal'}</h4><p className="text-xs text-gray-500">{notification.message}</p></div>
            <button onClick={() => setNotification({ show: false })}><X size={18} className="text-gray-400"/></button>
        </div>
      )}

      {/* 1. HEADER SIMPLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">Status Lisensi</h2>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
            <ShieldCheck size={14} className="text-blue-500"/> Kelola aktivasi sistem dan masa berlaku aplikasi
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
            <Info size={14}/> Sistem Terlindungi
        </div>
      </div>

      {/* 2. STATS CARDS (GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card Pemilik */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group transition-all duration-300 hover:-translate-y-1">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity transform rotate-12">
              <Building2 size={100} className="text-white" />
          </div>
          <div className="relative z-10 text-white">
            <div className="flex items-center gap-2 mb-4 opacity-80 text-[10px] font-bold uppercase tracking-widest">
              <Building2 size={16} /> Terdaftar Untuk
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-1 truncate">
              {data?.owner || 'Belum Terdeteksi'}
            </h3>
            <p className="text-xs text-blue-300 font-medium">Identitas Terverifikasi</p>
          </div>
        </div>

        {/* Card Timer (Smart Countdown) */}
        {/* LOGIKA WARNA: Jika Unlimited = GOLD, Jika tidak = Warna Indikator Waktu */}
        <div className={`p-6 rounded-[2rem] shadow-xl relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br 
            ${isUnlimited 
                ? 'from-amber-500 via-yellow-500 to-amber-600 shadow-amber-500/40 text-white' // GOLD PREMIUM
                : timeLeft > 86400 
                    ? 'from-emerald-500 to-emerald-600 shadow-emerald-200/50 text-white' // HIJAU
                    : timeLeft > 3600 
                        ? 'from-amber-500 to-amber-600 shadow-amber-200/50 text-white' // KUNING
                        : 'from-rose-500 to-rose-600 shadow-rose-200/50 text-white' // MERAH
            }`}>
            
            {/* Background Icon */}
            <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:opacity-30 transition-opacity transform rotate-12">
                {/* Gunakan Crown/Mahkota jika Unlimited */}
                {isUnlimited ? <Crown size={110} className="text-white mix-blend-overlay" /> : <Clock size={100} className="text-white" />}
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4 opacity-90 text-[10px] font-bold uppercase tracking-widest">
                    {isUnlimited ? <Crown size={16} /> : <Clock size={16} />} 
                    {isUnlimited ? "Status Lisensi" : "Masa Aktif Tersisa"}
                </div>
                
                {/* TULISAN BESAR */}
                <h3 className={`font-mono font-black tracking-tighter drop-shadow-sm ${isUnlimited ? 'text-4xl' : 'text-4xl'}`}>
                    {formatSmartTime(timeLeft)}
                </h3>

                <p className={`text-xs mt-2 font-bold ${isUnlimited ? 'text-yellow-100' : 'text-white/80'}`}>
                    {timeLeft <= 0 ? 'Masa Berlaku Habis' : 
                    isUnlimited ? 'Lisensi Permanen (Lifetime)' : 'Sistem Beroperasi Normal'}
                </p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 3. FORM AKTIVASI (KIRI) */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
          <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
            Aktivasi Lisensi Baru
          </h3>
          
          <div className="space-y-6">
            <div className="relative group">
              <div className="absolute top-4 left-4 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                <KeyRound size={20} />
              </div>
              <textarea 
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 pl-12 text-sm font-mono h-44 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all resize-none placeholder:text-gray-300 shadow-inner" 
                placeholder="Tempelkan kode lisensi panjang yang Anda terima dari pengembang di sini..."
                value={code} 
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            
            <button 
              onClick={handleUpdate}
              disabled={loading || !code}
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${loading || !code ? 'bg-gray-200 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 hover:shadow-blue-300'}`}
            >
              {loading ? (
                <RefreshCcw size={20} className="animate-spin" />
              ) : (
                <ShieldCheck size={20} />
              )}
              {loading ? "Memproses Verifikasi..." : "Aktifkan Sistem Sekarang"}
            </button>
          </div>
        </div>

        {/* 4. INFORMASI BANTUAN (KANAN) */}
        <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col justify-center text-center">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-blue-500">
                <AlertCircle size={32} />
            </div>
            <h4 className="font-bold text-slate-800 mb-2">Butuh Bantuan?</h4>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Jika lisensi Anda bermasalah atau ingin melakukan perpanjangan masa aktif, silakan hubungi tim teknis pengembang Nabastala Digital Solution.
            </p>
            <button 
              onClick={() => window.open('https://wa.me/6285183382128', '_blank')}
              className="bg-white text-slate-700 text-xs font-bold py-3 px-6 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
            >
                Hubungi Pengembang
            </button>
        </div>
      </div>
    </div>
  );
};

export default License;