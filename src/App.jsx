import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'; 
import api from "./api/axios";
import { Lock, MessageCircle, ArrowRight, ShieldAlert, Copy, Check } from 'lucide-react';

// --- IMPORT LAYOUTS & PAGES ---
import MainLayout from './layouts/MainLayout';
import LoadingScreen from './layouts/LoadingScreen';
import Absensi from './pages/Absensi'; 
import Login from './pages/Login'; 
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Students from './pages/Students';
import Settings from './pages/Settings';
import ManualAttendance from './pages/ManualAttendance';
import BackupPage from './pages/BackupPage';
import RestorePage from './pages/RestorePage';
import Laporan from './pages/Laporan';
import Profile from './pages/Profile';
import Database from './pages/Database';
import License from './pages/License'; 
import Devices from './pages/Devices';
import AuditLogs from './pages/AuditLogs';
import Holidays from './pages/Holidays';

import backgroundSekolah from './assets/gedung.jpg'; 

const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  if (!user) return <Navigate to="/login" replace />;
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
    api.get(`/license-status`)
      .catch(err => {
        if (err.response?.data?.machineId) {
          setMachineId(err.response.data.machineId);
        }
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
            <div className="flex items-center justify-center gap-2">
                <code className="text-blue-400 font-mono text-sm">{machineId}</code>
                <button onClick={copyToClipboard} className="text-slate-400 hover:text-white transition-colors">
                    {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
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
        
        <button onClick={() => window.open('https://wa.me/6285183382128', '_blank')} className="mt-6 text-emerald-400 text-xs font-bold flex items-center gap-2 hover:opacity-80">
            <MessageCircle size={16}/> Chat Admin Nebula Tech
        </button>
      </div>
    </div>
  );
};

function App() {
  const [isLocked, setIsLocked] = useState(false);
  const [dbWaiting, setDbWaiting] = useState(true);

  useEffect(() => {
    const checkLicense = async () => {
      try {
        await api.get(`/license-status`);
        setIsLocked(false);
      } catch (err) {
        if (err.response?.status === 403) setIsLocked(true);
      } finally { setDbWaiting(false); }
    };
    checkLicense();
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
          <Route path="settings" element={<Settings />} />
          <Route path="database" element={<Database />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="restore" element={<RestorePage />} />
          <Route path="profile" element={<Profile />} />
          <Route path="license" element={<License />} /> 
          <Route path="devices" element={<Devices />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="holidays" element={<Holidays />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;