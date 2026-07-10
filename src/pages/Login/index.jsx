import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Lock, User, ArrowRight, CheckCircle, AlertCircle, X, ScanLine, Eye, EyeOff } from 'lucide-react';

// --- IMPORT GAMBAR ---
import backgroundSekolah from '../../assets/gedung.jpg'; 
import logoNabastala from '../../assets/logo-nabastala.png'; 

const Login = () => {
  const navigate = useNavigate();
  
  // State Login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // State untuk mata password
  const [loading, setLoading] = useState(false);
  
  // State Tampilan
  const [schoolLogo, setSchoolLogo] = useState(logoNabastala); // Default logo
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // --- 1. AMBIL LOGO SEKOLAH SAAT LOAD ---
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        // Jika ada logo sekolah di DB, pakai itu. Jika tidak, tetap logoNabastala
        if (res.data && res.data.logo_sekolah && res.data.logo_sekolah.trim() !== "") {
            setSchoolLogo(res.data.logo_sekolah);
        }
      } catch (error) {
        // Silent error, pakai default
      }
    };
    fetchSettings();
  }, []);

  const showToast = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
        const response = await api.post('/login', {
            username: username,
            password: password
        });

        if (response.data.success) {
            localStorage.setItem('user', JSON.stringify(response.data.user));
            showToast('success', "Login Berhasil! Mengalihkan...");
            setTimeout(() => {
                navigate('/admin/dashboard');
            }, 1000);
        }
    } catch (error) {
        console.error("Error Login:", error); 
        const msg = error.response?.data?.message || "Login Gagal. Cek Username/Password.";
        showToast('error', msg);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 relative overflow-hidden font-sans">
      
      {/* --- 1. BRANDING NABASTALA (POJOK KIRI ATAS) --- */}
      <div className="absolute top-6 left-6 md:top-8 md:left-8 z-30 flex items-center gap-3 animate-in fade-in slide-in-from-top duration-700">
          {/* LOGO LEBIH BESAR & TANPA BACKGROUND */}
          <div className="w-14 h-14 flex items-center justify-center drop-shadow-xl hover:scale-105 transition-transform duration-300">
              <img 
                src={logoNabastala} 
                alt="Nabastala" 
                className="w-full h-full object-contain"
              />
          </div>
          
          <div className="flex flex-col justify-center">
              <span className="text-white font-bold text-xl leading-none tracking-wide text-shadow-md">Nabastala</span>
              <span className="text-blue-200 text-[10px] uppercase tracking-[0.25em] font-medium opacity-80 mt-1">Digital Solution</span>
          </div>
      </div>

      {/* --- 2. NOTIFIKASI TOAST --- */}
      {notification.show && (
        <div className={`fixed top-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl animate-in slide-in-from-top fade-in duration-300 border ${
            notification.type === 'success' ? 'bg-white border-green-200 text-green-700' : 'bg-white border-red-200 text-red-700'
        }`}>
            {notification.type === 'success' ? <CheckCircle size={22} className="text-green-500"/> : <AlertCircle size={22} className="text-red-500"/>}
            <div>
                <h4 className="font-bold text-sm">{notification.type === 'success' ? 'Akses Diterima' : 'Akses Ditolak'}</h4>
                <p className="text-xs text-gray-500">{notification.message}</p>
            </div>
            <button onClick={() => setNotification({ ...notification, show: false })}><X size={18} className="text-gray-400 hover:text-gray-600"/></button>
        </div>
      )}

      {/* --- 3. BACKGROUND --- */}
      <div className="absolute inset-0 z-0">
        <img 
            src={backgroundSekolah} 
            onError={(e) => e.target.style.display='none'} 
            alt="Background" 
            className="w-full h-full object-cover opacity-60 blur-[3px] scale-105" 
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-blue-900/50" />
      </div>

      {/* --- 4. CARD LOGIN --- */}
      <div className="relative z-10 w-full max-w-[400px] px-6 flex flex-col items-center animate-in fade-in zoom-in duration-500">
        
        <div className="w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-2xl shadow-black/50 relative overflow-hidden">
          
          {/* Header Card (LOGO SEKOLAH) */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 border border-white/10 text-white shadow-inner mb-4 p-2">
                {/* Menampilkan Logo Sekolah (Dinamis) */}
                <img 
                    src={schoolLogo} 
                    alt="School Logo" 
                    className="w-full h-full object-contain drop-shadow-md" 
                />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Login</h1>
            <p className="text-white/50 text-xs mt-1 tracking-wide">Silakan masuk untuk mengelola sistem</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all text-sm"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input 
                  // Logic Toggle Password
                  type={showPassword ? "text" : "password"} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                
                {/* Tombol Mata (Toggle Visibility) */}
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors cursor-pointer"
                >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-500 transition-all active:scale-95 mt-6 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs uppercase tracking-wider">Memproses...</span>
                  </>
              ) : (
                  <>
                    <span className="text-xs uppercase tracking-wider">Masuk Dashboard</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/>
                  </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 border-t border-white/5 w-2/3 mx-auto"></div>

          {/* Link Kembali */}
          <div>
             <button 
                onClick={() => navigate('/')} 
                className="w-full group flex items-center justify-center gap-3 py-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-300"
             >
               <ScanLine size={16} className="text-blue-400 group-hover:text-blue-300"/>
               <span className="text-xs font-medium tracking-wide">Mode Absensi Siswa</span>
             </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;