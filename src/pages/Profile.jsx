import React, { useState, useEffect } from 'react';
import { User, Lock, Save, Shield, Key, AlertCircle, CheckCircle, X, Building2, BadgeCheck } from 'lucide-react';
import api from '../api/axios';

// Default Assets
import defaultLogo from '../assets/logo-nabastala.png';

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
        } catch { console.error("Gagal load user"); }
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
        } catch {
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

        <div className="max-w-4xl mx-auto space-y-4">
            
            {/* === MODERN MINIMALIST HEADER === */}
            <div className="flex flex-row items-center gap-4 mt-2 mb-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div className="w-16 h-16 rounded-full bg-slate-50 p-1 shadow-sm border border-slate-100 relative group">
                    <img 
                        src={appConfig.logo_instansi || defaultLogo} 
                        className="w-full h-full object-contain rounded-full" 
                        alt="Logo"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-blue-500 p-1 rounded-full text-white border-2 border-white shadow-sm">
                        <BadgeCheck size={12} />
                    </div>
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800">{appConfig.nama_instansi}</h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Administrator System &bull; Pengelola Utama</p>
                </div>
            </div>

            {/* === FORM SECTION === */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* DATA AKUN */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <User size={18}/>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Informasi Dasar</h4>
                                <p className="text-[11px] text-slate-500">Nama dan akses identitas Anda.</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="profile-nama" className="text-xs font-bold text-slate-700 mb-1.5 block">Nama Lengkap</label>
                                <input 
                                    id="profile-nama"
                                    name="nama" 
                                    value={formData.nama} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-800" 
                                    placeholder="Nama Lengkap Admin"
                                    required 
                                />
                            </div>
                            <div>
                                <label htmlFor="profile-username" className="text-xs font-bold text-slate-700 mb-1.5 block">Username Login</label>
                                <input 
                                    id="profile-username"
                                    name="username" 
                                    autoComplete="username"
                                    value={formData.username} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-800" 
                                    placeholder="Username"
                                    required 
                                />
                            </div>
                        </div>
                    </div>

                    {/* KEAMANAN */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                            <div className="p-2 bg-rose-50 text-rose-500 rounded-lg">
                                <Lock size={18}/>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Keamanan Akun</h4>
                                <p className="text-[11px] text-slate-500">Ubah kata sandi secara berkala.</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="profile-password" className="text-xs font-bold text-slate-700 mb-1.5 block">Password Baru</label>
                                <input 
                                    id="profile-password"
                                    type="password" 
                                    name="password" 
                                    autoComplete="new-password"
                                    value={formData.password} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all text-sm font-medium text-slate-800" 
                                    placeholder="Kosongkan jika tidak diubah" 
                                />
                            </div>
                            <div>
                                <label htmlFor="profile-confirm-password" className="text-xs font-bold text-slate-700 mb-1.5 block">Konfirmasi Password</label>
                                <input 
                                    id="profile-confirm-password"
                                    type="password" 
                                    name="confirmPassword" 
                                    autoComplete="new-password"
                                    value={formData.confirmPassword} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all text-sm font-medium text-slate-800" 
                                    placeholder="Ulangi kata sandi baru" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* === FOOTER BUTTON === */}
                    <div className="pt-4 flex justify-end">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all disabled:opacity-70"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Simpan Perubahan
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