import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  ShieldCheck, Clock, Building2, KeyRound, 
  RefreshCcw, AlertCircle, CheckCircle, Info, X, Crown, Timer, Award
} from 'lucide-react';

const License = () => {
  const [data, setData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [machineId, setMachineId] = useState('');
  
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
      if (res.data.machineId) {
          setMachineId(res.data.machineId);
      }
    } catch { 
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
      const errorMsg = e.response?.data?.message || "Terjadi kesalahan koneksi atau kode tidak valid!";
      showToast('error', errorMsg);
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Lisensi & Keamanan</h2>
          <p className="text-slate-500 text-xs mt-1 flex items-center gap-2 font-medium">
            <ShieldCheck size={14} className="text-blue-500"/> Sistem enkripsi aktif melindungi data perusahaan Anda
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            Sistem Terlindungi
        </div>
      </div>

      {/* 2. STATS CARDS (GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card Pemilik */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <Building2 size={120} className="text-slate-800" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-600 rounded-md mb-4 text-[10px] font-bold uppercase tracking-widest border border-slate-200">
              <Building2 size={12} /> Terdaftar Untuk
            </div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight mb-1 truncate">
              {data?.owner || 'Belum Terdeteksi'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Identitas Perusahaan Terverifikasi</p>
            
            {machineId && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">ID Perangkat Keras</p>
                <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center group/copy gap-2 w-full overflow-hidden">
                  <div className="flex-1 min-w-0">
                    <code className="text-[11px] md:text-xs font-mono text-slate-700 font-medium break-all whitespace-normal block">{machineId}</code>
                  </div>
                  <button 
                    onClick={() => {
                        navigator.clipboard.writeText(machineId);
                        showToast('success', 'Machine ID disalin!');
                    }}
                    className="text-blue-600 hover:text-blue-700 font-bold text-xs bg-blue-50 px-2.5 py-1.5 rounded-md opacity-0 group-hover/copy:opacity-100 transition-opacity flex-shrink-0"
                  >
                    Salin
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card Timer (Smart Countdown) */}
        <div className={`p-6 rounded-xl shadow-sm relative overflow-hidden group bg-gradient-to-br border 
            ${isUnlimited 
                ? 'from-amber-50 to-orange-50 border-amber-200 text-amber-900' // GOLD PREMIUM Terang
                : timeLeft > 86400 
                    ? 'from-emerald-50 to-teal-50 border-emerald-200 text-emerald-900' // HIJAU
                    : timeLeft > 3600 
                        ? 'from-amber-50 to-orange-50 border-amber-200 text-amber-900' // KUNING
                        : 'from-rose-50 to-red-50 border-rose-200 text-rose-900' // MERAH
            }
        `}>
            
            {/* Background Icon */}
            <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                {isUnlimited ? <Award size={120}/> : <Timer size={120} />}
            </div>

            <div className="relative z-10">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mb-4 text-[10px] font-bold uppercase tracking-widest border ${
                  isUnlimited ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                  timeLeft > 86400 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                  timeLeft > 3600 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  'bg-rose-100 text-rose-700 border-rose-200'
              }`}>
                <Clock size={12} /> {isUnlimited ? "Status Lisensi" : "Masa Aktif Tersisa"}
              </div>

              <h3 className="text-2xl font-bold tracking-tight mb-1 truncate">
                {isUnlimited ? "LIFETIME (PERMANEN)" : data?.valid_until ? (
                  new Date(data.valid_until).toLocaleDateString('id-ID', { 
                    day: 'numeric', month: 'long', year: 'numeric' 
                  })
                ) : 'Tidak Diketahui'}
              </h3>
              <p className={`text-xs font-medium ${isUnlimited ? 'text-amber-700' : 'text-slate-600'}`}>
                {isUnlimited 
                  ? "Sistem diaktifkan secara permanen tanpa batas waktu." 
                  : "Setelah masa aktif habis, sistem akan terkunci."}
              </p>

              {!isUnlimited && (
                  <div className="mt-5">
                      <div className="flex gap-3 items-end">
                          <div>
                              <div className="text-xl font-bold bg-white/60 px-3 py-1.5 rounded-lg text-center backdrop-blur-sm border border-black/5 shadow-sm">
                                  {Math.floor(timeLeft / 86400).toString().padStart(2, '0')}
                              </div>
                              <div className="text-[10px] text-center mt-1 font-bold opacity-70 uppercase tracking-widest">Hari</div>
                          </div>
                          <div className="text-xl font-bold pb-4 opacity-50">:</div>
                          <div>
                              <div className="text-xl font-bold bg-white/60 px-3 py-1.5 rounded-lg text-center backdrop-blur-sm border border-black/5 shadow-sm">
                                  {Math.floor((timeLeft % 86400) / 3600).toString().padStart(2, '0')}
                              </div>
                              <div className="text-[10px] text-center mt-1 font-bold opacity-70 uppercase tracking-widest">Jam</div>
                          </div>
                          <div className="text-xl font-bold pb-4 opacity-50">:</div>
                          <div>
                              <div className="text-xl font-bold bg-white/60 px-3 py-1.5 rounded-lg text-center backdrop-blur-sm border border-black/5 shadow-sm">
                                  {Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0')}
                              </div>
                              <div className="text-[10px] text-center mt-1 font-bold opacity-70 uppercase tracking-widest">Mnt</div>
                          </div>
                      </div>
                  </div>
              )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* 3. FORM AKTIVASI (KIRI) */}
        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-base text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
            Aktivasi Lisensi Baru
          </h3>
          
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute top-3.5 left-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <KeyRound size={18} />
              </div>
              <textarea 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-10 text-xs font-mono h-32 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none placeholder:text-slate-400" 
                placeholder="Tempelkan kode lisensi panjang yang Anda terima dari pengembang di sini..."
                value={code} 
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            
            <button 
              onClick={handleUpdate}
              disabled={loading || !code}
              className={`w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 ${loading || !code ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20'}`}
            >
              {loading ? (
                <RefreshCcw size={16} className="animate-spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              {loading ? "Memproses Verifikasi..." : "Aktifkan Sistem Sekarang"}
            </button>
          </div>
        </div>

        {/* 4. INFORMASI BANTUAN (KANAN) */}
        <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 flex flex-col justify-center text-center">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-3 text-blue-500 border border-slate-200">
                <AlertCircle size={24} />
            </div>
            <h4 className="font-bold text-sm text-slate-800 mb-1.5">Butuh Bantuan?</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                Jika lisensi Anda bermasalah atau ingin melakukan perpanjangan masa aktif, silakan hubungi tim teknis pengembang Nebula Tech Digital Solution.
            </p>
            <button 
              onClick={() => window.open('https://wa.me/6282132972773', '_blank')}
              className="bg-white text-slate-700 text-xs font-bold py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
            >
                Hubungi Pengembang
            </button>
        </div>
      </div>
    </div>
  );
};

export default License;