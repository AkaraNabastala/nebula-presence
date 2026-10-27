import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Settings,
  LogOut, Menu, X, ArrowLeft,
  Clock, ChevronDown, ChevronRight,
  Database, HardDrive, Calendar, BookOpen,
  Award, Key, Activity, User, Laptop,
  Bell, AlertTriangle, Cloud, CloudOff, RefreshCw, Sun, Moon, Maximize, Minimize
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../api/axios';
import logoNabastala from '../assets/logo-nabastala.png';

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [headerVisible, setHeaderVisible] = useState(true);
  const scrollTimer = useRef(null);
  const lastScrollTop = useRef(0);
  const [openSections, setOpenSections] = useState({
    kegiatan: true,
    master: true,
    presensi: true,
    perangkat: true,
  });

  const [institutionName, setInstitutionName] = useState('SMK Negeri 1 Nebula');
  const [institutionLogo, setInstitutionLogo] = useState(logoNabastala);
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Status Sinkronisasi Cloud
  const [cloudSyncStatus, setCloudSyncStatus] = useState({
    enabled: false,
    pendingCount: 0,
    lastStatus: 'idle'
  });

  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  const getSafeUser = () => {
    try {
      const storedUser = localStorage.getItem('user');
      return (!storedUser || storedUser === "undefined") ? null : JSON.parse(storedUser);
    } catch {
      return null;
    }
  };

  const [userData, setUserData] = useState(getSafeUser() || {
    nama_admin: 'Operator Nebula',
    username: 'administrator',
    role: 'SuperAdmin'
  });
  const [appMode, setAppMode] = useState('edukasi');
  const [labels, setLabels] = useState({ label_pengguna: 'Siswa', label_kelompok: 'Kelas' });

  const [clearedNotifIds, setClearedNotifIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('clearedNotifIds') || '[]');
    } catch {
      return [];
    }
  });

  // 1. Fetch Notifikasi Peringatan Kehadiran
  useEffect(() => {
    setShowNotifDropdown(false);
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/attendance/unclosed-notifications');
        const rawNotifs = res.data?.data || [];
        const savedCleared = JSON.parse(localStorage.getItem('clearedNotifIds') || '[]');
        const filtered = rawNotifs.filter(n => !savedCleared.includes(`${n.id}_${n.date_log}`));
        setNotifications(filtered);
      } catch {
        /* ignore error */
      }
    };
    fetchNotifications();
  }, [location.pathname]);

  const handleClearNotifItem = (itemKey) => {
    const updatedCleared = [...clearedNotifIds, itemKey];
    setClearedNotifIds(updatedCleared);
    localStorage.setItem('clearedNotifIds', JSON.stringify(updatedCleared));
    setNotifications(prev => prev.filter(n => `${n.id}_${n.date_log}` !== itemKey));
  };

  const handleClearAllNotifs = () => {
    const currentKeys = notifications.map(n => `${n.id}_${n.date_log}`);
    const updatedCleared = Array.from(new Set([...clearedNotifIds, ...currentKeys]));
    setClearedNotifIds(updatedCleared);
    localStorage.setItem('clearedNotifIds', JSON.stringify(updatedCleared));
    setNotifications([]);
  };

  // 2. Fetch Pengaturan Branding & Sinkronisasi Cloud
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data) {
          const isEdu = (res.data.app_mode || 'edukasi') === 'edukasi';
          setAppMode(res.data.app_mode || 'edukasi');
          setLabels({
            label_pengguna: res.data.labels?.label_pengguna || (isEdu ? 'Siswa' : 'Karyawan'),
            label_kelompok: res.data.labels?.label_kelompok || (isEdu ? 'Kelas' : 'Divisi')
          });
          if (res.data.nama_sekolah || res.data.nama_instansi) {
            setInstitutionName(res.data.nama_sekolah || res.data.nama_instansi);
          }
          if (res.data.logo_sekolah || res.data.logo_instansi) {
            setInstitutionLogo(res.data.logo_sekolah || res.data.logo_instansi);
          }
        }
      } catch {
        /* ignore */
      }
    };

    const fetchSyncStatus = async () => {
      try {
        const res = await api.get('/cloud-sync/status');
        if (res.data?.success && res.data?.data) {
          setCloudSyncStatus(res.data.data);
        }
      } catch {
        /* ignore */
      }
    };

    fetchSettings();
    fetchSyncStatus();

    // Socket.IO Listener
    try {
      const socket = io(import.meta.env.DEV ? (import.meta.env.VITE_API_URL || 'http://localhost:6990') : window.location.origin, {
        reconnectionAttempts: 2,
        timeout: 3000
      });
      socket.on('cloud_sync_status', (data) => {
        setCloudSyncStatus(prev => ({
          ...prev,
          pendingCount: data.pendingCount ?? prev.pendingCount,
          lastStatus: data.state || prev.lastStatus
        }));
      });
      return () => socket.disconnect();
    } catch {
      /* ignore socket */
    }
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  // Warna langit bergerak kontinu mengikuti jam lokal perangkat, bukan berganti mendadak per fase.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDarkMode);
    const lightStops = [
      { minute: 0, canvas: '#18243b', accent: '#607da8', warm: '#25324a' },
      { minute: 300, canvas: '#263b58', accent: '#83aaca', warm: '#bd9b8f' },
      { minute: 420, canvas: '#c8e7fb', accent: '#55a9df', warm: '#ffe0b0' },
      { minute: 600, canvas: '#e6f6ff', accent: '#269bd3', warm: '#f8fcff' },
      { minute: 900, canvas: '#d7edfb', accent: '#318fc4', warm: '#d7f0ff' },
      { minute: 1020, canvas: '#ffd0b2', accent: '#e47d57', warm: '#ffc18f' },
      { minute: 1140, canvas: '#6a6077', accent: '#ba8a8c', warm: '#514359' },
      { minute: 1260, canvas: '#263650', accent: '#708bb8', warm: '#2a354e' },
      { minute: 1440, canvas: '#18243b', accent: '#607da8', warm: '#25324a' }
    ];
    const darkStops = [
      { minute: 0, canvas: '#090f1e', accent: '#526b9d', warm: '#151d30' },
      { minute: 300, canvas: '#101827', accent: '#58799f', warm: '#202a3d' },
      { minute: 420, canvas: '#101f33', accent: '#4c83a8', warm: '#243447' },
      { minute: 600, canvas: '#0e2233', accent: '#3d8cb9', warm: '#1a3040' },
      { minute: 900, canvas: '#112438', accent: '#397ba2', warm: '#192c3d' },
      { minute: 1020, canvas: '#281c25', accent: '#bb755b', warm: '#3c2b32' },
      { minute: 1140, canvas: '#1b1727', accent: '#8e667c', warm: '#2a2130' },
      { minute: 1260, canvas: '#090f1e', accent: '#526b9d', warm: '#151d30' },
      { minute: 1440, canvas: '#090f1e', accent: '#526b9d', warm: '#151d30' }
    ];
    const stops = isDarkMode ? darkStops : lightStops;
    const rgb = hex => hex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16));
    const hex = values => '#' + values.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
    const blend = (a, b, t) => {
      const first = rgb(a), second = rgb(b);
      return hex(first.map((value, index) => value + (second[index] - value) * t));
    };
    const updateSky = () => {
      const now = new Date();
      const minute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      const hour = minute / 60;
      root.dataset.skyPhase = hour >= 5 && hour < 10 ? 'morning' : hour >= 10 && hour < 16 ? 'day' : hour >= 16 && hour < 19 ? 'sunset' : 'night';
      let index = stops.findIndex((stop, i) => i < stops.length - 1 && minute >= stop.minute && minute <= stops[i + 1].minute);
      if (index < 0) index = stops.length - 2;
      const from = stops[index], to = stops[index + 1];
      const progress = Math.max(0, Math.min(1, (minute - from.minute) / (to.minute - from.minute)));
      root.style.setProperty('--nebula-sky-canvas', blend(from.canvas, to.canvas, progress));
      root.style.setProperty('--nebula-sky-accent', blend(from.accent, to.accent, progress));
      root.style.setProperty('--nebula-sky-warm', blend(from.warm, to.warm, progress));
      // Gerakkan matahari/bulan mengikuti busur langit sesuai jam lokal.
      const daylight = Math.max(0, Math.min(1, (hour - 5.5) / 12.5));
      const arcY = 9 + Math.sin(daylight * Math.PI) * 30;
      const arcX = 7 + daylight * 78;
      root.style.setProperty('--nebula-sky-object-x', `${arcX}%`);
      root.style.setProperty('--nebula-sky-object-y', `${arcY}%`);
    };
    updateSky();
    const timer = window.setInterval(updateSky, 15_000);
    return () => window.clearInterval(timer);
  }, [isDarkMode]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // Fullscreen can be blocked by the browser; F11 remains available as a fallback.
    }
  };

  const handleContentScroll = (event) => {
    const current = event.currentTarget.scrollTop;
    if (current > lastScrollTop.current && current > 90) setHeaderVisible(false);
    if (current < lastScrollTop.current) setHeaderVisible(true);
    lastScrollTop.current = current;
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => setHeaderVisible(true), 220);
  };

  const toggleDarkMode = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch {
      /* ignore */
    }
    localStorage.removeItem('user');
    navigate('/login');
  };

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const memberLabel = labels.label_pengguna || (appMode === 'edukasi' ? 'Siswa' : 'Karyawan');
  const divisionLabel = labels.label_kelompok || (appMode === 'edukasi' ? 'Kelas' : 'Divisi');

  // STRUKTUR LENGKAP MENU YANG TELAH DISEPAKATI (100% UTUH)
  const menuGroups = [
    {
      groupTitle: 'Kegiatan & Akademik',
      groupKey: 'kegiatan',
      items: [
        { name: 'Monitoring Ekskul', path: '/admin/extracurricular', icon: Award },
        { name: 'Jadwal Pembelajaran', path: '/admin/jadwal-pembelajaran', icon: Calendar },
        { name: 'Mata Pelajaran', path: '/admin/mata-pelajaran', icon: BookOpen },
      ]
    },
    {
      groupTitle: 'Data Master',
      groupKey: 'master',
      items: [
        { name: `${memberLabel} & Guru`, path: '/admin/members', icon: Users },
        { name: divisionLabel, path: '/admin/divisions', icon: Database },
        { name: 'Kalender Libur', path: '/admin/holidays', icon: Calendar },
      ]
    },
    {
      groupTitle: 'Presensi',
      groupKey: 'presensi',
      items: [
        { name: 'Log Kehadiran', path: '/admin/attendance-manual', icon: FileText },
        { name: 'Laporan Harian', path: '/admin/reports', icon: Calendar },
        { name: 'Laporan Bulanan', path: '/admin/reports-monthly', icon: FileText },
        { name: 'Monitoring Jurnal & Mapel', path: '/admin/monitoring-akademik', icon: BookOpen },
      ]
    },
    {
      groupTitle: 'Pengaturan Sistem',
      groupKey: 'perangkat',
      role: 'SuperAdmin',
      items: [
        { name: 'Sistem Aplikasi', path: '/admin/settings', icon: Settings },
        { name: 'Perangkat Kehadiran', path: '/admin/devices', icon: Laptop },
        { name: 'Manajemen Database', path: '/admin/database', icon: HardDrive },
        { name: 'Log Aktivitas', path: '/admin/audit-logs', icon: Activity },
        { name: 'Profil Akun', path: '/admin/profile', icon: User },
        { name: 'Lisensi & Aktivasi', path: '/admin/license', icon: Key },
      ]
    }
  ].filter(group => !group.role || group.role === (userData?.role || 'SuperAdmin'));

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return { title: 'Dashboard Ringkasan', category: 'Beranda' };
    if (path.includes('/members')) return { title: `Direktori ${memberLabel}`, category: 'Data Master' };
    if (path.includes('/divisions')) return { title: `Daftar ${divisionLabel}`, category: 'Data Master' };
    if (path.includes('/holidays')) return { title: 'Kalender Libur', category: 'Data Master' };
    if (path.includes('/attendance-manual')) return { title: 'Log & Koreksi Kehadiran', category: 'Presensi' };
    if (path.includes('/reports-monthly')) return { title: 'Laporan Presensi Bulanan', category: 'Presensi' };
    if (path.includes('/reports')) return { title: 'Laporan Presensi Harian', category: 'Presensi' };
    if (path.includes('/monitoring-akademik')) return { title: 'Monitoring Jurnal & Mapel', category: 'Kegiatan' };
    if (path.includes('/jadwal-pembelajaran')) return { title: 'Jadwal Pembelajaran', category: 'Kegiatan' };
    if (path.includes('/mata-pelajaran')) return { title: 'Mata Pelajaran', category: 'Kegiatan' };
    if (path.includes('/extracurricular')) return { title: 'Monitoring Ekstrakurikuler', category: 'Kegiatan' };
    if (path.includes('/settings')) return { title: 'Pengaturan Sistem', category: 'Pengaturan' };
    if (path.includes('/backup')) return { title: 'Backup Database', category: 'Pengaturan' };
    if (path.includes('/restore')) return { title: 'Pulihkan Database', category: 'Pengaturan' };
    if (path.includes('/database')) return { title: 'Manajemen Database', category: 'Pengaturan' };
    if (path.includes('/license')) return { title: 'Lisensi & Aktivasi', category: 'Pengaturan' };
    if (path.includes('/devices')) return { title: 'Mesin Kehadiran', category: 'Pengaturan' };
    if (path.includes('/audit-logs')) return { title: 'Log Aktivitas Sistem', category: 'Pengaturan' };
    if (path.includes('/profile')) return { title: 'Profil Akun', category: 'Pengaturan' };
    return { title: 'Presensi Terpadu', category: 'Sistem' };
  };

  const pageInfo = getPageTitle();

  return (
    <div className="sky-time-canvas relative min-h-screen bg-slate-50 dark:bg-slate-950 text-[#111625] dark:text-slate-100 flex font-['Poppins']">
      <div className="nebula-sky-decor" aria-hidden="true">
        <Sun className="nebula-sky-orb nebula-sky-sun" strokeWidth={1} />
        <Moon className="nebula-sky-orb nebula-sky-moon" strokeWidth={1} />
        <div className="nebula-sky-stars" />
      </div>

      {/* 1. DISTINCTIVE DARK OBSIDIAN SIDEBAR */}
      <aside className={`
        fixed lg:sticky top-0 inset-y-0 left-0 z-40 w-64 bg-[#101626] text-white flex flex-col justify-between transition-transform duration-200 ease-in-out h-screen shadow-2xl
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-5">
          
          {/* Top Logo Mark */}
          <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-4">
            <Link to="/admin/dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <img src={institutionLogo} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm text-white tracking-tight block truncate">Nebula Presence</span>
                <span className="text-[10px] text-cyan-400 font-medium tracking-wide uppercase block truncate">{institutionName}</span>
              </div>
            </Link>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Nav: Dashboard & Kiosk */}
          <div className="space-y-1 mb-4">
            <Link
              to="/admin/dashboard"
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                location.pathname === '/admin/dashboard'
                  ? 'bg-white/15 text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={16} className={location.pathname === '/admin/dashboard' ? 'text-cyan-400' : 'text-slate-400'} />
                <span>Dashboard</span>
              </div>
              {location.pathname === '/admin/dashboard' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
            </Link>

            <Link
              to="/"
              className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <div className="flex items-center gap-3">
                <ArrowLeft size={16} className="text-slate-400" />
                <span>Kiosk Absensi</span>
              </div>
            </Link>
          </div>

          {/* Structured Menu Groups */}
          <div className="space-y-3.5">
            {menuGroups.map((group) => {
              const isOpen = openSections[group.groupKey] ?? true;

              return (
                <div key={group.groupKey} className="space-y-1">
                  <button
                    onClick={() => toggleSection(group.groupKey)}
                    className="w-full flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <span>{group.groupTitle}</span>
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>

                  {isOpen && (
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setIsSidebarOpen(false)}
                              className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                                active
                                  ? 'bg-white/15 text-white font-semibold shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0"><Icon size={14} className={active ? 'text-cyan-400' : 'text-slate-400'} /><span className="truncate">{item.name}</span></div>
                              {active && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                            </Link>
                          );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Bottom Profile & Logout Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0c1220] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 p-0.5 shadow-md shrink-0">
              <div className="w-full h-full rounded-full bg-[#101626] flex items-center justify-center font-bold text-xs text-white">
                {userData.nama_admin ? userData.nama_admin.charAt(0) : 'A'}
              </div>
            </div>
            <div className="min-w-0 truncate">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {userData.nama_admin || userData.username || 'Administrator'}
              </p>
              <p className="text-[10px] text-slate-400 font-normal">
                {userData.role || 'Operator'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowLogoutModal(true)}
            className="text-slate-400 hover:text-rose-400 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            title="Keluar dari Konsol"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT VIEWPORT */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-y-auto" onScroll={handleContentScroll}>
        
        {/* TOPBAR HEADER */}
        <header className={`sky-time-header min-h-16 bg-gradient-to-r from-[#101c30] via-[#172943] to-[#174a70] border-b border-sky-400/40 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 backdrop-blur-xl shadow-[0_8px_28px_rgba(11,23,48,0.08)] transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-sky-100 hover:bg-white/10 rounded-xl"
            >
              <Menu size={20} />
            </button>
            <div>
              <span className="text-[10px] uppercase font-bold text-sky-300 tracking-wider">
                {pageInfo.category}
              </span>
              <h2 className="text-sm md:text-base font-bold text-white leading-tight">
                {pageInfo.title}
              </h2>
            </div>
          </div>

          {/* Topbar Actions: Cloud Sync, Notifications, Dark Mode, Kiosk Button */}
          <div className="flex items-center gap-2">
            
            {/* Status Cloud Sync */}
            {cloudSyncStatus.enabled && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                {cloudSyncStatus.lastStatus === 'syncing' ? (
                  <>
                    <RefreshCw size={13} className="text-blue-500 animate-spin" />
                    <span className="text-blue-600 dark:text-blue-400 font-medium">Sinkronisasi...</span>
                  </>
                ) : cloudSyncStatus.lastStatus === 'offline' ? (
                  <>
                    <CloudOff size={13} className="text-rose-500" />
                    <span className="text-rose-600 dark:text-rose-400 font-medium">Portal offline</span>
                  </>
                ) : cloudSyncStatus.lastStatus === 'partial' ? (
                  <>
                    <CloudOff size={13} className="text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Sinkron parsial</span>
                  </>
                ) : cloudSyncStatus.pendingCount > 0 ? (
                  <>
                    <CloudOff size={13} className="text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400 font-medium">{cloudSyncStatus.pendingCount} antrean</span>
                  </>
                ) : cloudSyncStatus.lastStatus === 'synced' ? (
                  <>
                    <Cloud size={13} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Cloud Sinkron</span>
                  </>
                ) : (
                  <>
                    <Cloud size={13} className="text-slate-400" />
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Belum tersinkron</span>
                  </>
                )}
              </div>
            )}

            {/* Dropdown Notifikasi */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2 rounded-xl bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
                title="Notifikasi"
              >
                <Bell size={16} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-stone-200 dark:border-slate-700 p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-slate-700">
                    <span className="text-xs font-bold text-stone-800 dark:text-white">Pemberitahuan Presensi</span>
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearAllNotifs}
                        className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        Bersihkan Semua
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-stone-100 dark:divide-slate-700 py-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-stone-500 dark:text-slate-400 py-3 text-center">Tidak ada peringatan baru.</p>
                    ) : (
                      notifications.map(n => {
                        const itemKey = `${n.id}_${n.date_log}`;
                        return (
                          <div key={itemKey} className="py-2 flex items-start justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <p className="font-semibold text-stone-800 dark:text-white truncate">{n.nama_siswa || n.name}</p>
                              <p className="text-[11px] text-stone-500 dark:text-slate-400">{n.message || `Belum tap pulang pada ${n.date_log}`}</p>
                            </div>
                            <button
                              onClick={() => handleClearNotifItem(itemKey)}
                              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-700 transition-colors"
              title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Tampilan layar penuh browser; gunakan Escape untuk keluar jika browser mendukungnya */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0b1730] via-[#1749a5] to-[#2563eb] px-3 py-2 text-xs font-semibold text-white shadow-md shadow-blue-900/15 hover:brightness-110"
              title={isFullscreen ? 'Keluar dari layar penuh (Esc)' : 'Tampilan layar penuh (seperti F11)'}
              aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Aktifkan layar penuh'}
            >
              {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
              <span className="hidden sm:inline">{isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}</span>
            </button>
          </div>
        </header>

        {/* Content canvas */}
        <main className="p-4 md:p-8 lg:p-10 max-w-[1440px] w-full mx-auto flex-1">
          <Outlet />
        </main>
      </div>

      {/* MODAL LOGOUT KONFIRMASI */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <LogOut size={24} />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white text-center">Keluar dari Konsol?</h3>
            <p className="text-xs text-stone-500 dark:text-slate-400 text-center mt-1 mb-6">
              Sesi login Anda akan diakhiri dan dialihkan ke halaman masuk.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors shadow-sm"
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
