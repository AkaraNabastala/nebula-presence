import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
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
      toast.success(res.data?.message || 'Permintaan reset password berhasil diproses.');
      setShowResetModal(false);
      setResetCode('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Kode otorisasi tidak valid');
    } finally {
      setResetLoading(false);
    }
  };

  const copyMachineId = () => {
    if (machineId) {
      navigator.clipboard.writeText(machineId);
      toast.success('Machine ID disalin ke clipboard');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 font-['Poppins'] text-slate-900 lg:grid lg:grid-cols-[1.03fr_.97fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#101c30] text-white lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <img src={loginBackground} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#071226]/95 via-[#102e50]/80 to-[#075985]/70" />
        <div className="absolute -right-24 top-16 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <img src={schoolLogo} alt="Logo sekolah" className="h-14 w-14 object-contain" />
          <div className="min-w-0"><p className="truncate text-sm font-extrabold tracking-wide">{schoolName}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">Nebula Presence</p></div>
        </div>
        <div className="relative z-10 max-w-xl py-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200/25 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-100"><ShieldCheck size={14} /> Sistem presensi terpadu</span>
          <h1 className="mt-6 text-4xl font-black leading-[1.12] tracking-tight xl:text-5xl">Satu ruang kendali.<br /><span className="bg-gradient-to-r from-sky-300 via-cyan-100 to-orange-300 bg-clip-text text-transparent">Data hadir lebih jelas.</span></h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-200">Kelola perangkat, data akademik, aktivitas presensi, dan sinkronisasi Portal melalui konsol operator yang aman.</p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur"><Lock size={17} className="text-sky-300" /><p className="mt-3 text-[11px] font-bold">Akses terlindungi</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur"><User size={17} className="text-sky-300" /><p className="mt-3 text-[11px] font-bold">Konsol operator</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur"><ArrowRight size={17} className="text-orange-300" /><p className="mt-3 text-[11px] font-bold">Sinkronisasi data</p></div>
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-[10px] text-slate-300"><span>© {new Date().getFullYear()} {schoolName}</span><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-300" /> Nebula Presence Console</span></div>
      </section>

      <section className="relative flex min-h-screen flex-col justify-between overflow-hidden px-4 py-5 sm:px-8 lg:px-10 xl:px-14">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-300/35 blur-3xl lg:hidden" />
        <header className="relative z-10 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white/85 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-sky-50"><ArrowLeft size={15} /> Layar Kiosk</Link>
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800"><ShieldCheck size={14} className="text-sky-600" /> Akses administrator</span>
        </header>

        <div className="relative z-10 mx-auto my-8 w-full max-w-md lg:my-auto">
          <div className="mb-6 overflow-hidden rounded-[1.5rem] border border-sky-200/80 bg-[#101c30] text-white shadow-lg lg:hidden">
            <div className="relative min-h-36 overflow-hidden p-5">
              <img src={loginBackground} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#101c30]/95 via-[#123b62]/80 to-[#075985]/55" />
              <div className="relative flex items-center gap-3">
                <img src={schoolLogo} alt="Logo sekolah" className="h-12 w-12 object-contain" />
                <div className="min-w-0"><p className="truncate text-sm font-extrabold">{schoolName}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200">Nebula Presence</p></div>
              </div>
              <p className="relative mt-5 text-lg font-extrabold">Selamat datang kembali.</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-sky-100 bg-white/95 p-5 shadow-[0_24px_70px_rgba(28,100,160,0.14)] backdrop-blur-xl sm:p-8">
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-800"><Lock size={13} /> Area administrator</span>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Masuk ke konsol</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">Gunakan akun administrator untuk mengelola sistem presensi.</p>
            </div>

            {errorMsg && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700"><AlertCircle size={15} className="mt-0.5 shrink-0" />{errorMsg}</div>}

            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block text-xs font-bold text-slate-700">Username Operator
                <span className="relative mt-1.5 block"><User size={16} className="absolute left-3.5 top-3 text-slate-400" /><input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100" placeholder="Masukkan username" required /></span>
              </label>
              <label className="block text-xs font-bold text-slate-700">
                <span className="flex items-center justify-between gap-3">Password<button type="button" onClick={() => setShowResetModal(true)} className="text-[11px] font-bold text-blue-700 hover:text-orange-600">Lupa password?</button></span>
                <span className="relative mt-1.5 block"><Lock size={16} className="absolute left-3.5 top-3 text-slate-400" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100" placeholder="Masukkan password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3 text-slate-400 transition hover:text-blue-700" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
              </label>
              <button type="submit" disabled={loading} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-950 via-blue-700 to-sky-500 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-wait disabled:opacity-60">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Memverifikasi akun…</> : <>Masuk ke konsol <ArrowRight size={16} /></>}</button>
            </form>
            <div className="mt-5 flex items-start gap-2 border-t border-slate-100 pt-4 text-[10px] leading-relaxed text-slate-400"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-sky-600" /><span>Akses ini hanya untuk akun dengan hak administrator Nebula Presence.</span></div>
          </div>
        </div>

        <footer className="relative z-10 py-2 text-center text-[10px] text-slate-400">© {new Date().getFullYear()} {schoolName} · Sistem Presensi Otomatis</footer>
      </section>

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

    </main>
  );
};

export default Login;
