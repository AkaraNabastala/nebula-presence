import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, Settings, 
  LogOut, Menu, X, User, ChevronDown, Key, 
  Database, Shield, PieChart, Download, UploadCloud, 
  Users, Building2, RefreshCcw, AlertTriangle 
} from 'lucide-react';
import api from '../api/axios';

// Import Default Assets
import logoNabastala from '../assets/logo-nabastala.png'; 

const MainLayout = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentLogo, setCurrentLogo] = useState(logoNabastala);
  const [showLogoutModal, setShowLogoutModal] = useState(false); // State Modal Logout
  
  // --- STATE MENU DROPDOWN ---
  // PERBAIKAN: Set default 'master' menjadi false agar tertutup saat awal
  const [openMenus, setOpenMenus] = useState({
    master: false, 
    absensi: false, 
    database: false,
    system: false
  });
  
  // --- 1. AMBIL DATA USER (Helper) ---
  const getSafeUser = () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser || storedUser === "undefined") return null;
      return JSON.parse(storedUser);
    } catch (error) {
      localStorage.removeItem('user');
      return null;
    }
  };

  // State untuk data user agar reaktif terhadap perubahan profil
  const [userData, setUserData] = useState(getSafeUser());

  // --- 2. EFFECT: DENGARKAN PERUBAHAN & AMBIL LOGO ---
  useEffect(() => {
    // Fungsi update state saat profil diubah
    const handleUserUpdate = () => {
      setUserData(getSafeUser());
    };

    // Fungsi ambil logo instansi
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        const logo = res.data?.logo_sekolah || res.data?.logo_instansi;
        if (logo && logo.trim() !== "") {
            setCurrentLogo(logo);
        }
      } catch (error) {
        console.error("Gagal memuat pengaturan layout.");
      }
    };

    fetchSettings();
    window.addEventListener("userUpdated", handleUserUpdate);

    return () => {
      window.removeEventListener("userUpdated", handleUserUpdate);
    };
  }, []);

  // --- 3. VARIABEL DISPLAY ---
  const userDisplay = {
    name: userData?.nama || userData?.nama_admin || 'Administrator',
    role: 'Super Admin', 
    photo: userData?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.nama || 'Admin')}&background=0f172a&color=fff&size=128&bold=true`
  };

  // --- 4. STRUKTUR MENU UNIVERSAL ---
  const menuGroups = [
    {
        title: 'UTAMA',
        items: [
            { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard }
        ]
    },
    {
        title: 'DATA MASTER',
        key: 'master',
        icon: Database, 
        items: [
            { name: 'Data Anggota', path: '/admin/members', icon: Users },
            { name: 'Data Divisi', path: '/admin/divisions', icon: Building2 },
        ]
    },
    {
        title: 'PRESENSI', 
        key: 'absensi',
        icon: ClipboardList,
        items: [
            { name: 'Presensi Manual', path: '/admin/attendance-manual', icon: ClipboardList },
            { name: 'Laporan Kehadiran', path: '/admin/reports', icon: PieChart },
        ]
    },
    {
        title: 'DATABASE',
        key: 'database',
        icon: UploadCloud,
        items: [
            { name: 'Backup Data', path: '/admin/backup', icon: Download },
            { name: 'Restore Data', path: '/admin/restore', icon: RefreshCcw }, 
        ]
    },
    {
        title: 'SISTEM',
        key: 'system',
        icon: Shield,
        items: [
            { name: 'Profil Akun', path: '/admin/profile', icon: User },
            { name: 'Pengaturan', path: '/admin/settings', icon: Settings },
            { name: 'Status Lisensi', path: '/admin/license', icon: Key },
        ]
    }
  ];

  const toggleMenu = (key) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Fungsi Logout dengan Modal
  const confirmLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/'; 
  };

  const isGroupActive = (items) => {
      return items.some(item => location.pathname === item.path);
  };

  const isActiveLink = (path) => location.pathname === path;

  // Auto-Open Menu jika sedang di halaman tersebut
  useEffect(() => {
    const activeGroupKey = menuGroups.find(group => 
        group.items && group.items.some(item => item.path === location.pathname)
    )?.key;

    if (activeGroupKey) {
        setOpenMenus(prev => ({ ...prev, [activeGroupKey]: true }));
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* OVERLAY MOBILE */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 text-slate-700 shadow-2xl md:shadow-none transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:relative md:translate-x-0 flex flex-col justify-between
        `}
      >
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0 h-[80px]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center p-1 bg-blue-50 rounded-xl">
                        <img src={currentLogo} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col justify-center">
                        <span className="text-xl font-black tracking-tight text-slate-800 leading-none">SI-MAS</span>
                        <span className="text-[10px] text-blue-600 font-bold uppercase tracking-[0.2em] leading-none mt-1.5">SISTEM ABSENSI</span>
                    </div>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-red-500">
                    <X size={24} />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                {menuGroups.map((group, index) => (
                    <div key={index} className="mb-2">
                        {!group.key ? (
                            group.items.map(item => (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                                        isActiveLink(item.path)
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200 font-medium'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'
                                    }`}
                                >
                                    <item.icon size={18} />
                                    <span className="text-sm">{item.name}</span>
                                </Link>
                            ))
                        ) : (
                            <div className="mt-1">
                                <button 
                                    onClick={() => toggleMenu(group.key)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                                        isGroupActive(group.items)
                                        ? 'bg-blue-50 text-blue-700 font-semibold' 
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <group.icon size={18} className={`${isGroupActive(group.items) ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'}`}/>
                                        <span className="text-sm font-medium uppercase tracking-wide text-[11px]">{group.title}</span>
                                    </div>
                                    <ChevronDown size={14} className={`transition-transform duration-300 ${openMenus[group.key] ? 'rotate-180 text-blue-600' : 'text-gray-400'}`} />
                                </button>
                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openMenus[group.key] ? 'max-h-48 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                                    <div className="ml-3 pl-3 border-l-2 border-slate-100 space-y-1">
                                        {group.items.map(item => (
                                            <Link
                                                key={item.name}
                                                to={item.path}
                                                onClick={() => setIsSidebarOpen(false)}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                                                    isActiveLink(item.path)
                                                    ? 'text-blue-600 bg-blue-50 font-medium'
                                                    : 'text-slate-500 hover:text-slate-800 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full ${isActiveLink(item.path) ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                                                <span>{item.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
                <button 
                    onClick={() => setShowLogoutModal(true)} 
                    className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all group border border-transparent hover:border-red-100"
                >
                    <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium text-sm">Keluar Sistem</span>
                </button>
            </div>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="bg-white px-6 py-3 shadow-sm flex justify-between items-center sticky top-0 z-20 border-b border-gray-100 h-[70px]">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg md:hidden transition-colors">
                <Menu size={24} />
              </button>
            </div>
            <div className="flex items-center gap-4 pl-4 cursor-default">
                <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-gray-800 leading-tight">{userDisplay.name}</p>
                    <p className="text-[11px] text-gray-500 font-medium">Administrator</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 shadow-sm overflow-hidden border border-gray-200">
                    <img 
                        src={userDisplay.photo} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src = "https://ui-avatars.com/api/?name=User&background=random"; }}
                    />
                </div>
            </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50/50 scroll-smooth">
          <div className="max-w-7xl mx-auto w-full pb-10">
            <Outlet /> 
          </div>
        </div>
      </main>

      {/* MODAL KONFIRMASI LOGOUT */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Konfirmasi Keluar</h3>
                <p className="text-sm text-slate-500 mt-2 mb-6 leading-relaxed">
                    Apakah Anda yakin ingin mengakhiri sesi dan keluar dari sistem?
                </p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowLogoutModal(false)} 
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition text-sm"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={confirmLogout} 
                        className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition text-sm"
                    >
                        Keluar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;