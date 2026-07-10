import React, { useState, useEffect } from 'react';
import { User, Lock, Save, Shield, Key, AlertCircle, CheckCircle, X, Building2, BadgeCheck } from 'lucide-react';
import api from '../../api/axios';

// Default Assets
import defaultBg from '../../assets/gedung.jpg'; 
import defaultLogo from '../../assets/logo-nabastala.png';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // State Config (Universal)
  const [appConfig, setAppConfig] = useState({
      nama_instansi: 'Memuat...',
      logo_instansi: '',
      background_absensi: ''
  });

  // State Notifikasi
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  // 1. Load Data User & Settings
  useEffect(() => {
    // Load User dari LocalStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setFormData({
                nama: parsedUser.nama_admin || parsedUser.nama || '',
                username: parsedUser.username || '',
                password: '', 
                confirmPassword: ''
            });
        } catch (e) { console.error("Gagal load user"); }
    }

    // Load Data Instansi (Visual Header)
    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings');
            if (res.data) {
                setAppConfig({
                    nama_instansi: res.data.nama_sekolah || res.data.nama_instansi || 'Instansi',
                    logo_instansi: res.data.logo_sekolah || res.data.logo_instansi || '',
                    background_absensi: res.data.background_absensi || ''
                });
            }
        } catch (e) {
            console.error("Gagal load settings");
        }
    };
    fetchSettings();
  }, []);

  const showToast = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password && formData.password !== formData.confirmPassword) {
        showToast('error', "Konfirmasi password tidak cocok!");
        return;
    }

    setLoading(true);
    try {
        const payload = {
            id: user.id,
            nama: formData.nama,
            username: formData.username,
            password: formData.password 
        };

        const res = await api.put('/profile', payload);
        
        if (res.data.success) {
            // 1. Update LocalStorage
            localStorage.setItem('user', JSON.stringify(res.data.user));
            
            // 2. Beri Notifikasi Sukses
            showToast('success', "Profil berhasil diperbarui!");
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
            
            // 3. KIRIM SINYAL KE SIDEBAR/HEADER (TANPA REFRESH)
            window.dispatchEvent(new Event("userUpdated")); 
            
            // Hapus baris reload di bawah ini
            // setTimeout(() => { window.location.reload(); }, 1500);
        }
    } catch (error) {
        showToast('error', error.response?.data?.message || "Gagal update profil.");
    } finally {
        setLoading(false);
    }
  };

  if (!user) return <div className="p-10 text-center text-gray-500 animate-pulse">Memuat Profil...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20 font-sans">
        
        {/* --- NOTIFIKASI TOAST --- */}
        {notification.show && (
            <div className={`fixed top-4 right-4 z-[99] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right fade-in duration-300 border bg-white ${
                notification.type === 'success' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'
            }`}>
                {notification.type === 'success' ? <CheckCircle size={24} className="text-green-500"/> : <AlertCircle size={24} className="text-red-500"/>}
                <div>
                    <h4 className="font-bold text-sm">{notification.type === 'success' ? 'Berhasil' : 'Gagal'}</h4>
                    <p className="text-xs text-gray-500">{notification.message}</p>
                </div>
                <button onClick={() => setNotification({ ...notification, show: false })}><X size={18} className="text-gray-400 hover:text-gray-600"/></button>
            </div>
        )}

        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
            
            {/* === HEADER VISUAL (IDENTITY) === */}
            <div className="relative h-48 md:h-64 bg-slate-900 group">
                {/* Background Instansi */}
                <img 
                    src={appConfig.background_absensi || defaultBg} 
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" 
                    alt="Cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                
                {/* Info Overlay */}
                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex items-end justify-between">
                    <div className="flex items-center gap-4 md:gap-6 translate-y-12 md:translate-y-14">
                        {/* Logo Instansi sebagai Avatar */}
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-white p-2 shadow-2xl ring-4 ring-white/20 backdrop-blur-sm">
                            <img 
                                src={appConfig.logo_instansi || defaultLogo} 
                                className="w-full h-full object-contain" 
                                alt="Logo"
                            />
                        </div>
                        <div className="pb-2 md:pb-0 text-white">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight shadow-black drop-shadow-md">{appConfig.nama_instansi}</h1>
                            <div className="flex items-center gap-2 text-blue-200 text-xs md:text-sm font-medium uppercase tracking-widest mt-1">
                                <BadgeCheck size={16} className="text-blue-400" />
                                Administrator System
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* === FORM SECTION === */}
            <div className="pt-20 px-6 md:px-10 pb-10">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    
                    {/* KOLOM KIRI: DATA AKUN */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <User size={20}/>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">Profil Admin</h4>
                                <p className="text-xs text-gray-400">Informasi akun pengelola sistem.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Nama Lengkap</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                                    <input 
                                        name="nama" 
                                        value={formData.nama} 
                                        onChange={handleChange} 
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium text-gray-700 bg-gray-50 focus:bg-white" 
                                        placeholder="Nama Lengkap Admin"
                                        required 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Username Login</label>
                                <div className="relative">
                                    <Shield className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                                    <input 
                                        name="username" 
                                        value={formData.username} 
                                        onChange={handleChange} 
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium text-gray-700 bg-gray-50 focus:bg-white" 
                                        placeholder="Username"
                                        required 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KOLOM KANAN: KEAMANAN */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                    <Lock size={20}/>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800">Keamanan</h4>
                                    <p className="text-xs text-gray-400">Ganti kata sandi akun.</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded border">Opsional</span>
                        </div>

                        <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 flex gap-3 items-start">
                            <AlertCircle size={18} className="text-orange-500 mt-0.5 shrink-0"/>
                            <p className="text-xs text-orange-700 leading-relaxed">
                                Kosongkan kolom di bawah jika Anda <b>tidak ingin mengubah</b> password saat ini.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Password Baru</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                                    <input 
                                        type="password" 
                                        name="password" 
                                        value={formData.password} 
                                        onChange={handleChange} 
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-gray-50 focus:bg-white" 
                                        placeholder="******" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Konfirmasi Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                                    <input 
                                        type="password" 
                                        name="confirmPassword" 
                                        value={formData.confirmPassword} 
                                        onChange={handleChange} 
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-gray-50 focus:bg-white" 
                                        placeholder="******" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FOOTER ACTIONS */}
                    <div className="lg:col-span-2 pt-6 border-t border-gray-100 flex justify-end">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className={`
                                flex items-center gap-2 bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-xl shadow-blue-200 
                                transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed hover:bg-blue-700
                            `}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={20} />
                                    <span>Simpan Perubahan</span>
                                </>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    </div>
  );
};

export default Profile;