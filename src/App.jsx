import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; 
import api from "./api/axios";
import { Lock, MessageCircle, Copy, Check } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- IMPORT LAYOUTS & PAGES ---
import MainLayout from './layouts/MainLayout';
import LoadingScreen from './layouts/LoadingScreen';

// --- LAZY LOAD PAGES ---
const Absensi = React.lazy(() => import('./pages/Absensi.jsx')); 
const Login = React.lazy(() => import('./pages/Login.jsx')); 
const Dashboard = React.lazy(() => import('./pages/Dashboard.jsx'));
const Classes = React.lazy(() => import('./pages/Classes.jsx'));
const Students = React.lazy(() => import('./pages/Students.jsx'));
const Settings = React.lazy(() => import('./pages/Settings.jsx'));
const ManualAttendance = React.lazy(() => import('./pages/ManualAttendance'));
const Laporan = React.lazy(() => import('./pages/Laporan'));
const LaporanBulanan = React.lazy(() => import('./pages/LaporanBulanan'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Database = React.lazy(() => import('./pages/Database'));
const License = React.lazy(() => import('./pages/License')); 
const Devices = React.lazy(() => import('./pages/Devices'));
const AuditLogs = React.lazy(() => import('./pages/AuditLogs'));
const Holidays = React.lazy(() => import('./pages/Holidays'));
const Extracurricular = React.lazy(() => import('./pages/Extracurricular'));
const PresensiEkskul = React.lazy(() => import('./pages/PresensiEkskul'));
const JadwalPembelajaran = React.lazy(() => import('./pages/JadwalPembelajaran.jsx'));
const Subjects = React.lazy(() => import('./pages/Subjects.jsx'));
const MonitoringAkademik = React.lazy(
    () => import('./pages/MonitoringAkademik.jsx')
);

import backgroundSekolah from './assets/gedung.jpg'; 

const ProtectedRoute = ({ children }) => {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    localStorage.removeItem('user');
  }

  // Nebula Presence hanya untuk admin; role lain tidak boleh membuka konsol.
  if (!user || user.role !== 'SuperAdmin') {
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }
  return children;
};

// --- LOCK SCREEN (POWERFULL & SECURE) ---
const LockScreen = ({ onUnlock }) => {
  const [code, setCode] = useState('');
  const [machineId, setMachineId] = useState('Memuat...');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Ambil Machine ID dari backend untuk ditunjukkan ke user
    api.get(`/license-status`, { validateStatus: status => status < 500 })
      .then(res => {
        if (res.data?.machineId) {
          setMachineId(res.data.machineId);
        } else {
          setMachineId(JSON.stringify(res.data) || "KOSONG");
        }
      })
      .catch(() => {
        setMachineId("Koneksi Error");
      });
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.post(`/activation`, { code });
      if (res.data.success) {
          onUnlock();
          window.location.reload();
      }
    } catch (err) { 
      setErrorMsg(err.response?.data?.message || "Kode aktivasi salah.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 h-screen w-screen bg-slate-900 flex items-center justify-center font-sans overflow-hidden z-[999]">
      <div className="absolute inset-0 z-0">
        <img src={backgroundSekolah} className="w-full h-full object-cover opacity-20 blur-sm" alt="bg"/>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/40"></div>
      </div>

      <div className="relative z-10 w-full max-w-[90%] md:max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center animate-in zoom-in-95">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 animate-pulse">
          <Lock size={32} className="text-red-500" />
        </div>

        <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Akses Terkunci</h1>
        <p className="text-slate-400 text-sm text-center mb-6">Masa aktif lisensi berakhir atau perangkat belum terdaftar.</p>

        {/* MACHINE ID DISPLAY (PENTING UNTUK USER) */}
        <div className="w-full bg-black/40 rounded-2xl p-4 mb-6 border border-white/5 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">ID Perangkat Anda</p>
            <div className="flex flex-col items-center justify-center gap-2">
                <code className="text-blue-400 font-mono text-[10px] sm:text-xs break-all max-w-full text-center px-2">{machineId}</code>
                <button onClick={copyToClipboard} className="text-slate-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs">
                    {copied ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>}
                    {copied ? "Tersalin!" : "Salin ID"}
                </button>
            </div>
        </div>

        <form onSubmit={handleActivate} className="w-full space-y-4">
          <textarea 
            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm h-28 resize-none focus:border-blue-500 outline-none font-mono"
            placeholder="Tempel Kode Aktivasi..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {errorMsg && <p className="text-red-400 text-xs font-bold text-center bg-red-500/10 py-2 rounded-lg">{errorMsg}</p>}
          <button disabled={loading || !code} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold transition-all active:scale-95 disabled:opacity-50">
            {loading ? "Memverifikasi..." : "Aktifkan Sekarang"}
          </button>
        </form>
        
        <button onClick={() => window.open('https://wa.me/6282132972773', '_blank')} className="mt-6 text-emerald-400 text-xs font-bold flex items-center gap-2 hover:opacity-80">
            <MessageCircle size={16}/> Chat Admin Nebula Tech
        </button>
      </div>
    </div>
  );
};

function App() {
  // Apply the sky palette throughout the app, including the login screen.
  useEffect(() => {
    const updateSkyPhase = () => {
      const hour = new Date().getHours();
      const phase = hour >= 5 && hour < 10
        ? 'morning'
        : hour >= 10 && hour < 16
          ? 'day'
          : hour >= 16 && hour < 19
            ? 'sunset'
            : 'night';
      document.documentElement.dataset.skyPhase = phase;
    };
    updateSkyPhase();
    const timer = window.setInterval(updateSkyPhase, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [isLocked, setIsLocked] = useState(false);
  const [dbWaiting, setDbWaiting] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Cek Lisensi
        const res = await api.get(`/license-status`, { validateStatus: status => status < 500 });
        if (res.status === 403) {
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }

        // 2. Ambil Settings untuk Favicon Dinamis & Judul
        const resSet = await api.get('/settings');
        if (resSet.data) {
           const logo = resSet.data.logo_sekolah || resSet.data.logo_instansi;
           const nama = resSet.data.nama_sekolah || resSet.data.nama_instansi;
           
           // Judul dihapus dari dynamic update agar tetap Nebula Smart Presence
           // if (nama) {
           //     document.title = nama;
           // }
        }

      } catch {
        setIsLocked(true);
      } finally { setDbWaiting(false); }
    };
    initApp();
  }, []);

  useEffect(() => {
    const handleLockSinyal = () => {
      setIsLocked(true); // Langsung munculkan LockScreen
    };

    window.addEventListener("licenseExpired", handleLockSinyal);
    return () => window.removeEventListener("licenseExpired", handleLockSinyal);
  }, []);

  if (dbWaiting) return <LoadingScreen />;
  if (isLocked) return <LockScreen onUnlock={() => setIsLocked(false)} />;

  return (
    <BrowserRouter>
      <React.Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Absensi />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="members" element={<Students />} /> 
            <Route path="divisions" element={<Classes />} />
            <Route path="attendance-manual" element={<ManualAttendance />} />
            <Route path="reports" element={<Laporan />} />
            <Route path="reports-monthly" element={<LaporanBulanan />} />
            <Route path="settings" element={<Settings />} />
            <Route path="database" element={<Database />} />
            {/* URL lama tetap berfungsi, tetapi manajemen backup/restore berada di halaman database khusus. */}
            <Route path="backup" element={<Navigate to="/admin/database" replace />} />
            <Route path="restore" element={<Navigate to="/admin/database" replace />} />
            <Route path="profile" element={<Profile />} />
            <Route path="license" element={<License />} /> 
            <Route path="devices" element={<Devices />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="holidays" element={<Holidays />} />
            <Route path="extracurricular" element={<Extracurricular />} />
            <Route
                path="presensi-ekskul"
                element={
                    <Navigate
                        to="/admin/extracurricular"
                        replace
                    />
                }
            />

            <Route
                path="monitoring-akademik"
                element={<MonitoringAkademik />}
            />
            <Route path="jadwal-pembelajaran" element={<JadwalPembelajaran />} />
            <Route path="mata-pelajaran" element={<Subjects />} />
            <Route path="monitoring-akademik" element={<MonitoringAkademik />} />
          
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
      <ToastContainer position="top-right" autoClose={3200} newestOnTop closeOnClick pauseOnFocusLoss draggable theme={localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'} toastClassName="!rounded-2xl !border !border-slate-200 !shadow-xl dark:!border-slate-700" />
    </BrowserRouter>
  );
}

export default App;