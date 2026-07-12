import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, Settings, 
  LogOut, Menu, X, ChevronDown, 
  Database, UploadCloud, Users, Building2, 
  AlertTriangle, ShieldCheck, Sun, CloudSun, Sunrise, Moon
} from 'lucide-react';
import api from '../api/axios';

import logoNabastala from '../assets/logo-nabastala.png'; 

const MainLayout = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentLogo, setCurrentLogo] = useState(logoNabastala);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const [greeting, setGreeting] = useState({ text: '', icon: Sun, color: 'text-amber-500' });
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  
  const getSafeUser = () => {
    try {
      const storedUser = localStorage.getItem('user');
      return (!storedUser || storedUser === "undefined") ? null : JSON.parse(storedUser);
    } catch (error) {
      return null;
    }
  };

  const [userData, setUserData] = useState(getSafeUser());

  const [labels, setLabels] = useState({ label_anggota: 'Anggota', label_unit: 'Divisi' });

  // Handle Dark Mode Class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Set Sapaan berdasarkan waktu
    const hour = new Date().getHours();
    if (hour < 11) setGreeting({ text: 'Selamat Pagi', icon: Sunrise, color: 'text-amber-500' });
    else if (hour < 15) setGreeting({ text: 'Selamat Siang', icon: Sun, color: 'text-amber-500' });
    else if (hour < 18) setGreeting({ text: 'Selamat Sore', icon: CloudSun, color: 'text-orange-500' });
    else setGreeting({ text: 'Selamat Malam', icon: Moon, color: 'text-indigo-500' });

  // Handle Dark Mode Class is moved outside

    const handleUserUpdate = () => setUserData(getSafeUser());
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        const logo = res.data?.logo_sekolah || res.data?.logo_instansi;
        if (logo && logo.trim() !== "") setCurrentLogo(logo);
        if (res.data?.labels) setLabels(res.data.labels);
      } catch (error) {}
    };

    fetchSettings();
    window.addEventListener("userUpdated", handleUserUpdate);
    return () => window.removeEventListener("userUpdated", handleUserUpdate);
  }, []);

  const userDisplay = {
    name: userData?.nama || userData?.nama_admin || 'Administrator',
    role: 'Sistem Admin', 
    photo: userData?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.nama || 'Admin')}&background=c7d2fe&color=3730a3&bold=true`
  };

  // --- MENU DENGAN WARNA IDENTITAS (VIBRANT) ---
  const menuItems = [
    { 
        name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, 
        color: 'text-blue-500', activeBg: 'bg-blue-50', activeText: 'text-blue-700' 
    },
    {
        name: 'Data Master', key: 'master', icon: Database, 
        color: 'text-violet-500', activeBg: 'bg-violet-50', activeText: 'text-violet-700',
        subMenu: [
            { name: `Direktori ${labels.label_anggota}`, path: '/admin/members' },
            { name: `Struktur ${labels.label_unit}`, path: '/admin/divisions' },
            { name: `Kalender Libur`, path: '/admin/holidays' },
        ]
    },
    {
        name: 'Presensi', key: 'absensi', icon: ClipboardList, 
        color: 'text-emerald-500', activeBg: 'bg-emerald-50', activeText: 'text-emerald-700',
        subMenu: [
            { name: 'Log Kehadiran', path: '/admin/attendance-manual' },
            { name: 'Laporan Rekap', path: '/admin/reports' },
        ]
    },
    {
        name: 'Pengaturan', key: 'system', icon: Settings, 
        color: 'text-slate-500', activeBg: 'bg-slate-100', activeText: 'text-slate-800',
        role: 'SuperAdmin',
        subMenu: [
            { name: 'Profil Akun', path: '/admin/profile' },
            { name: 'Sistem Aplikasi', path: '/admin/settings' },
            { name: 'Manajemen Database', path: '/admin/database' },
            { name: 'Lisensi & Aktivasi', path: '/admin/license' },
            { name: 'Mesin Kehadiran', path: '/admin/devices' },
            { name: 'Log Aktivitas', path: '/admin/audit-logs' },
        ]
    }
  ].filter(menu => !menu.role || menu.role === (userData?.role || 'SuperAdmin'));

  const toggleMenu = (key) => setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  const confirmLogout = () => { localStorage.removeItem('user'); window.location.href = '/'; };
  const isActive = (path) => location.pathname === path;
  const isGroupActive = (subMenu) => subMenu?.some(item => location.pathname === item.path);

  useEffect(() => {
    const activeMenu = menuItems.find(menu => menu.subMenu && isGroupActive(menu.subMenu));
    if (activeMenu) setOpenMenus(prev => ({ ...prev, [activeMenu.key]: true }));
  }, [location.pathname]);

  return (
    // Background lebih modern dan cerah, menggunakan slate-100 agar beda dengan sidebar putih
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden text-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* OVERLAY MOBILE */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* --- SIDEBAR PUTIH BERSIH DENGAN BORDER --- */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-slate-200 shadow-xl shadow-slate-200/50 dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50
          transform transition-transform duration-300 ease-in-out flex flex-col h-full
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:relative'} 
        `}
      >
        {/* LOGO AREA (Sangat Clean) */}
        <div className="pt-8 pb-6 px-8 flex items-center gap-3.5 shrink-0">
            <img src={currentLogo} alt="Logo" className="w-11 h-11 object-contain drop-shadow-sm" />
            <div className="flex flex-col">
                <span className="text-[22px] font-black text-slate-800 tracking-tight leading-none dark:text-white text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">Nebula Tech</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 dark:text-slate-500">Smart Presence</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={24} />
            </button>
        </div>

        {/* NAVIGATION DENGAN COLOR CODING */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-5 space-y-1.5 pb-4">
            {menuItems.map((menu) => {
                const groupActive = isGroupActive(menu.subMenu);
                
                return (
                <div key={menu.name}>
                    {!menu.subMenu ? (
                        <Link
                            to={menu.path} onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 font-bold text-[14.5px] ${
                                isActive(menu.path)
                                ? `${menu.activeBg} ${menu.activeText} dark:bg-slate-700/50 dark:text-slate-200`
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200'
                            }`}
                        >
                            <menu.icon size={22} className={menu.color} />
                            {menu.name}
                        </Link>
                    ) : (
                        <div className="mb-2">
                            <button 
                                onClick={() => toggleMenu(menu.key)}
                                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-200 font-bold text-[14.5px] ${
                                    groupActive
                                    ? `${menu.activeBg} ${menu.activeText}` 
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <menu.icon size={22} className={menu.color}/>
                                    <span>{menu.name}</span>
                                </div>
                                <ChevronDown size={18} className={`transition-transform duration-300 ${openMenus[menu.key] ? 'rotate-180' : ''} ${groupActive ? menu.activeText : 'text-slate-400'}`} />
                            </button>
                            
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openMenus[menu.key] ? 'max-h-56 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                                <div className="ml-6 pl-5 border-l-2 border-slate-100 space-y-1 py-1">
                                    {menu.subMenu.map(sub => (
                                        <Link
                                            key={sub.name} to={sub.path} onClick={() => setIsSidebarOpen(false)}
                                            className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-[13.5px] font-semibold ${
                                                isActive(sub.path)
                                                ? `${menu.activeText} bg-white shadow-sm ring-1 ring-slate-100`
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className={`w-2 h-2 rounded-full transition-all ${isActive(sub.path) ? `scale-110 ${menu.color.replace('text-', 'bg-')}` : 'bg-slate-200'}`}></div>
                                            {sub.name}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )})}
        </nav>

        {/* STATUS WIDGET & LOGOUT (Tampilan Baru) */}
        <div className="px-5 pb-6 pt-4 mt-auto">


            <button 
                onClick={() => setShowLogoutModal(true)} 
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 w-full rounded-2xl bg-white border-2 border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all font-bold text-[14.5px]"
            >
                <LogOut size={18} />
                Keluar Aplikasi
            </button>
        </div>
      </aside>

      {/* --- KONTEN UTAMA --- */}
      <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
        
        {/* HEADER TRANSPARAN TAPI PUNYA BATAS JELAS */}
        <header className="px-6 md:px-10 py-5 flex justify-between items-center shrink-0 h-[85px] border-b border-slate-200/50 bg-slate-100/50 backdrop-blur-md dark:bg-slate-900/50 dark:border-slate-800/50">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-white shadow-sm text-slate-600 rounded-xl md:hidden transition-colors dark:bg-slate-800 dark:text-slate-300">
                <Menu size={22} />
              </button>
              
              <div className="hidden md:flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-white shadow-sm border border-slate-100 ${greeting.color} dark:bg-slate-800 dark:border-slate-700`}>
                      <greeting.icon size={24} />
                  </div>
                  <div>
                      <h1 className="text-[22px] font-extrabold text-slate-800 tracking-tight leading-none dark:text-white">{greeting.text}</h1>
                      <p className="text-[12px] text-slate-500 font-medium mt-1 dark:text-slate-400">Pantau dan kelola data operasional Anda.</p>
                  </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white pl-4 pr-1.5 py-1.5 rounded-full shadow-sm border border-slate-200/60 dark:bg-slate-800 dark:border-slate-700">
                
                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)} 
                  className="p-2 text-slate-400 hover:text-amber-500 transition-colors"
                  title="Toggle Dark Mode"
                >
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div className="text-right hidden sm:block border-l border-slate-100 pl-4 dark:border-slate-700">
                    <p className="text-[13.5px] font-extrabold text-slate-800 leading-none capitalize">{userDisplay.name}</p>
                    <p className="text-[11px] text-blue-500 font-bold mt-1.5">{userDisplay.role}</p>
                </div>
                <Link to="/admin/profile" className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-100 bg-slate-100 hover:scale-105 transition-transform duration-300">
                    <img src={userDisplay.photo} alt="Profile" className="w-full h-full object-cover" />
                </Link>
            </div>
        </header>

        {/* AREA KONTEN */}
        <div className="flex-1 overflow-auto px-4 md:px-10 pb-10 scroll-smooth custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full fade-in pt-2">
            <Outlet /> 
          </div>
        </div>
      </main>

      {/* --- MODAL LOGOUT --- */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center transform animate-in zoom-in-95 duration-200">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
                    <AlertTriangle size={36} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Keluar Sekarang?</h3>
                <p className="text-[14px] text-slate-500 mt-3 mb-8 font-medium leading-relaxed">
                    Pastikan pekerjaan Anda sudah tersimpan. Anda akan diarahkan ke halaman login.
                </p>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setShowLogoutModal(false)} 
                        className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={confirmLogout} 
                        className="flex-1 py-3.5 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 shadow-md shadow-rose-200 transition-all active:scale-95"
                    >
                        Ya, Keluar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;