import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  Lock, User, ArrowRight, ArrowLeft, ShieldCheck, KeyRound,
  Eye, EyeOff, AlertCircle, CheckCircle, Copy, X
} from 'lucide-react';
import backgroundSekolah from '../assets/gedung.jpg';
import logoNabastala from '../assets/logo-nabastala.png';

const Login = () => {
  const navigate = useNavigate();

  // State Login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // State Tampilan
  const [schoolLogo, setSchoolLogo] = useState(logoNabastala);
  const [loginBackground, setLoginBackground] = useState(backgroundSekolah);
  const [schoolName, setSchoolName] = useState('Nebula Smart Presence');
  const [errorMsg, setErrorMsg] = useState('');

  // State Lupa Password
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [machineId, setMachineId] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // Ambil Machine ID untuk Lupa Password & Logo Sekolah
  React.useEffect(() => {
    const fetchInfo = async () => {
      try {
        const resLic = await api.get('/license-status');
        if (resLic.data && resLic.data.machineId) setMachineId(resLic.data.machineId);
      } catch (err) {
        if (err.response?.data?.machineId) setMachineId(err.response.data.machineId);
      }

      try {
        const resSet = await api.get('/settings');
        if (resSet.data) {
          if (resSet.data.nama_sekolah || resSet.data.nama_instansi) {
            setSchoolName(resSet.data.nama_sekolah || resSet.data.nama_instansi);
          }
          if (resSet.data.background_absensi) setLoginBackground(resSet.data.background_absensi);
          if (resSet.data.logo_sekolah || resSet.data.logo_instansi) {
            setSchoolLogo(resSet.data.logo_sekolah || resSet.data.logo_instansi);
          }
        }
      } catch {
        /* fallback ke default logo */
      }
    };
    fetchInfo();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post('/login', { username, password });
      const userData = res.data?.user;
      if (res.data?.success === true && userData?.role === 'SuperAdmin') {
        localStorage.setItem('user', JSON.stringify(userData));
        navigate('/admin/dashboard');
      } else {
        localStorage.removeItem('user');
        setErrorMsg(res.data?.message || 'Akses Nebula Presence hanya untuk admin.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal login ke sistem.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const res = await api.post('/reset-password-emergency', {
        security_code: resetCode,
        machine_id: machineId
      });
      setNotification({
        show: true,
        type: 'success',
        message: res.data?.message || 'Password berhasil di-reset ke default: admin123'
      });
      setShowResetModal(false);
      setResetCode('');
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        message: err.response?.data?.message || 'Kode otorisasi tidak valid'
      });
    } finally {
      setResetLoading(false);
    }
  };

  const copyMachineId = () => {
    if (machineId) {
      navigator.clipboard.writeText(machineId);
      setNotification({
        show: true,
        type: 'success',
        message: 'Machine ID disalin ke clipboard'
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#070e1c] text-slate-100 flex flex-col justify-between font-['Poppins'] p-6 relative overflow-hidden">
      {/* BACKGROUND IMAGE DENGAN SCRIM ELEGAN */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={loginBackground}
          alt="Latar Belakang Sekolah"
          className="w-full h-full object-cover scale-105 brightness-[0.34] contrast-[1.05] saturate-[1.1]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060b17] via-[#091326]/85 to-[#0c1a35]/70 backdrop-blur-[4px]" />
      </div>

      {/* TOP HEADER */}
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto z-10">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors text-xs font-semibold bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10"
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Layar Kiosk</span>
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <ShieldCheck size={14} className="text-cyan-400" />
          <span>Konsol Operator Presensi</span>
        </div>
      </div>

      {/* NOTIFIKASI TOAST */}
      {notification.show && (
        <div className="fixed top-6 right-6 z-50">
          <div
            className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-xl ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span className="text-xs font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification({ show: false, type: '', message: '' })}
              className="ml-2 hover:opacity-75"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* LOGIN CARD */}
      <div className="w-full max-w-md mx-auto my-auto z-10">
        <div className="bg-white/[0.05] hover:bg-white/[0.07] backdrop-blur-2xl border border-white/15 rounded-3xl p-8 shadow-2xl transition-colors">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-3 p-2 shadow-lg">
              <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Konsol Pengelola</h1>
            <p className="text-xs text-slate-300 mt-1">{schoolName} · Presensi Terpadu</p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-500/15 border border-rose-400/30 rounded-2xl text-rose-200 text-xs text-center font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username Operator
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-2xl px-4 py-2.5 pl-10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-['Poppins']"
                  placeholder="Masukkan username"
                  required
                />
                <User size={16} className="absolute left-3.5 top-3 text-slate-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Lupa Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-2xl px-4 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-['Poppins']"
                  placeholder="••••••••"
                  required
                />
                <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm rounded-2xl transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Masuk ke Konsol</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* FOOTER */}
      <div className="text-center text-xs text-slate-400 z-10 py-2">
        © {new Date().getFullYear()} {schoolName}. Sistem Presensi Otomatis.
      </div>

      {/* MODAL RESET PASSWORD DARURAT */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-white/15 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                <KeyRound size={22} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Reset Password Darurat</h3>
                <p className="text-xs text-slate-400">Hubungi Super Administrator / Pengembang</p>
              </div>
            </div>

            {machineId && (
              <div className="mb-4 p-3 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    ID Mesin Perangkat Ini
                  </span>
                  <code className="text-xs text-cyan-300 font-mono">{machineId}</code>
                </div>
                <button
                  type="button"
                  onClick={copyMachineId}
                  className="p-2 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors"
                  title="Salin ID Mesin"
                >
                  <Copy size={16} />
                </button>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Kode Otorisasi Darurat
                </label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="Masukkan kode otorisasi"
                  className="w-full bg-black/40 border border-white/15 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-white/15 hover:bg-white/5 text-xs text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {resetLoading ? 'Memproses...' : 'Reset ke Default'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
