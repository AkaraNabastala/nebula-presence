import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { saveOfflineScan, getOfflineScans, removeOfflineScan } from '../../api/indexedDB';
import {
  MapPin, Fingerprint, Keyboard, X,
  Clock, Calendar as CalendarIcon,
  ScanLine, QrCode, UserCircle,
  AlertTriangle, CheckCircle, Info,
  Camera
} from 'lucide-react';
import { io } from 'socket.io-client';

// Scanner & Aset
import CameraQrScanner from '../../components/CameraQrScanner';
import CameraFaceScanner from '../../components/CameraFaceScanner';
import logoDefault from '../../assets/logo-nabastala.png';
import bgDefault from '../../assets/gedung.jpg';

const Absensi = () => {
  const navigate = useNavigate();

  // --- STATE ---
  const [time, setTime] = useState(new Date());
  const [notification, setNotification] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- REFS ---
  const rfidBuffer = useRef("");
  const lastKeyTime = useRef(Date.now());
  const inputRef = useRef(null);
  const queueRef = useRef([]);
  const processingRef = useRef(false);

  // STATE CONFIG
  const [appConfig, setAppConfig] = useState({
    nama_instansi: 'Memuat...',
    alamat_instansi: '',
    metode_absensi: 'RFID',
    timezone: 'Asia/Jakarta',
    logo_instansi: '',
    background_absensi: '',
    jam_masuk: '07:00',
    jam_pulang: '16:00'
  });

  const [membersList, setMembersList] = useState([]);

  // Ambil data anggota berwajah saat mode WAJAH aktif
  useEffect(() => {
    if (appConfig.metode_absensi === 'WAJAH') {
      api.get('/members/faces').then(res => {
        const list = res.data?.data || res.data || [];
        console.log("Loaded face members count:", list.length);
        setMembersList(list);
      }).catch(() => {
        // Fallback
        api.get('/members').then(res => {
          setMembersList(res.data?.data || res.data || []);
        }).catch(err => console.error("Gagal load data wajah:", err));
      });
    }
  }, [appConfig.metode_absensi]);

  // --- 1. LOAD CONFIG & JADWAL DINAMIS ---
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data) {
          const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          const todayName = days[new Date().getDay()];

          let dynamicIn = '07:00';
          let dynamicOut = '16:00';

          if (res.data.jadwal_sekolah) {
            const fullSchedule = JSON.parse(res.data.jadwal_sekolah);
            const todaySchedule = fullSchedule.find(s => s.day === todayName);
            if (todaySchedule && todaySchedule.active) {
              dynamicIn = todaySchedule.in;
              dynamicOut = todaySchedule.out;
            }
          }

          let fallbackName = res.data.nama_sekolah || '';
          if (!fallbackName) {
            try {
              const licRes = await api.get('/license-status');
              if (licRes.data && licRes.data.owner) {
                fallbackName = licRes.data.owner;
              }
            } catch {
              // ignore
            }
          }

          setAppConfig(prev => ({
            ...prev,
            nama_instansi: fallbackName || 'Nebula Smart Presence',
            alamat_instansi: res.data.alamat_sekolah || '',
            metode_absensi: res.data.metode_absensi || 'RFID',
            timezone: res.data.timezone || 'Asia/Jakarta',
            logo_instansi: res.data.logo_sekolah || '',
            background_absensi: res.data.background_absensi || '',
            jam_masuk: dynamicIn,
            jam_pulang: dynamicOut
          }));
        }
      } catch (error) {
        console.error("Gagal sinkronisasi data:", error);
      }
    };
    fetchConfig();
  }, []);

  // --- 2. JAM BERJALAN ---
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- 3. AUTO FOCUS INPUT ---
  useEffect(() => {
    if (showManualInput && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 150);
    }
  }, [showManualInput]);

  // --- 4. ZKTECO REAL-TIME LISTENER (SOCKET.IO) ---
  useEffect(() => {
    const SOCKET_URL = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || 'http://localhost:6990') : window.location.origin;
    const socket = io(SOCKET_URL);

    const getNotificationDuration = () => {
      try {
        const localTimeStr = new Date().toLocaleTimeString('en-GB', {
          timeZone: appConfig.timezone || 'Asia/Jakarta', hour12: false
        });
        const [currentHour, currentMinute] = localTimeStr.split(':').map(Number);

        const [masukHour, masukMinute] = (appConfig.jam_masuk || '07:00').split(':').map(Number);
        const [pulangHour, pulangMinute] = (appConfig.jam_pulang || '16:00').split(':').map(Number);

        const currentMinutes = currentHour * 60 + currentMinute;
        const masukMinutes = masukHour * 60 + masukMinute;
        const pulangMinutes = pulangHour * 60 + pulangMinute;

        const isJamMasukSibuk = currentMinutes >= (masukMinutes - 60) && currentMinutes <= (masukMinutes + 60);
        const isJamPulangSibuk = currentMinutes >= (pulangMinutes - 60) && currentMinutes <= (pulangMinutes + 60);

        if (isJamMasukSibuk || isJamPulangSibuk) {
          return 1000;
        }
      } catch (e) {
        console.warn("Gagal menghitung jam sibuk:", e);
      }
      return 3000;
    };

    const processQueue = () => {
      if (processingRef.current) {
        if (Date.now() - (processingRef.lastTime || 0) > 4000) {
          processingRef.current = false;
        } else {
          return;
        }
      }
      if (queueRef.current.length === 0) return;

      processingRef.current = true;
      processingRef.lastTime = Date.now();

      const nextNotif = queueRef.current.shift();
      setNotification(nextNotif);

      const duration = getNotificationDuration();

      setTimeout(() => {
        setNotification(null);
        processingRef.current = false;
        processQueue();
      }, duration);
    };

    socket.on('new_scan', (data) => {
      let pesanBawah = "TERIMA KASIH";
      let statusText = data.status;

      if (data.mode === 'PULANG') {
        pesanBawah = "HATI-HATI DI JALAN";
        statusText = data.status || "PULANG";
      } else if (data.status === 'TERLAMBAT') {
        pesanBawah = "JANGAN TERLAMBAT LAGI";
      } else if (data.status === 'HADIR') {
        pesanBawah = "SELAMAT BERAKTIVITAS";
      }

      const notifPayload = {
        nama: data.nama,
        status: statusText,
        pesan: pesanBawah,
        waktu: data.waktu || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        id_user: data.info_id,
        info: data.divisi || "Pengguna Aktif",
        foto: data.foto,
        type: 'SUCCESS'
      };

      queueRef.current.push(notifPayload);
      processQueue();
    });

    socket.on('scan_error', (data) => {
      const notifPayload = {
        nama: "Gagal Absensi",
        status: "ERROR",
        pesan: data.message || "ID Tidak Terdaftar",
        type: 'ERROR'
      };

      queueRef.current.push(notifPayload);
      processQueue();
    });

    return () => socket.disconnect();
  }, [appConfig]);

  const getStatusDisplay = () => {
    const localTimeStr = time.toLocaleTimeString('en-GB', {
      timeZone: appConfig.timezone, hour12: false
    });
    const [currentHour, currentMinute] = localTimeStr.split(':').map(Number);
    const [masukHour, masukMinute] = (appConfig.jam_masuk).split(':').map(Number);
    const [pulangHour, pulangMinute] = (appConfig.jam_pulang).split(':').map(Number);

    const isAfterPulang = currentHour > pulangHour || (currentHour === pulangHour && currentMinute >= pulangMinute);
    const isAfterMasuk = currentHour > masukHour || (currentHour === masukHour && currentMinute > masukMinute);

    if (isAfterPulang) return { text: 'Waktu Pulang', color: 'text-blue-400', border: 'border-blue-500/50 bg-blue-500/10', indicator: 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' };
    else if (isAfterMasuk) return { text: 'Terlambat', color: 'text-orange-400', border: 'border-orange-500/50 bg-orange-500/10', indicator: 'bg-orange-500 shadow-[0_0_10px_#f97316]' };
    else return { text: 'Tepat Waktu', color: 'text-emerald-400', border: 'border-emerald-500/50 bg-emerald-500/10', indicator: 'bg-emerald-500 shadow-[0_0_10px_#10b981]' };
  };
  const statusDisplay = getStatusDisplay();

  const processAbsensi = useCallback(async (identifier) => {
    if (!identifier || isLoading) return;
    setIsLoading(true);

    // OFFLINE FALLBACK
    if (!navigator.onLine) {
      try {
        await saveOfflineScan(identifier.trim());
        setNotification({
          nama: "Koneksi Terputus",
          status: "OFFLINE",
          pesan: "Data Tersimpan Sementara di Perangkat",
          waktu: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          id_user: identifier.trim(),
          info: "Akan disinkronisasi otomatis",
          foto: null,
          type: 'WARNING'
        });
      } catch {
        setNotification({ nama: "Gagal", status: "ERROR", pesan: "Penyimpanan Offline Gagal", type: 'ERROR' });
      }
      setIsLoading(false);
      setTimeout(() => { setNotification(null); setShowManualInput(false); setManualId(""); }, 3000);
      return;
    }

    try {
      const response = await api.post('/scan', { rfid_code: identifier.trim() });
      const data = response.data;

      let pesanBawah = "TERIMA KASIH";
      let statusText = data.status;
      if (data.mode === 'PULANG') { pesanBawah = "HATI-HATI DI JALAN"; statusText = "PULANG"; }
      else if (data.status === 'TERLAMBAT') { pesanBawah = "JANGAN TERLAMBAT LAGI"; }
      else if (data.status === 'HADIR') { pesanBawah = "SELAMAT BERAKTIVITAS"; }

      setNotification({
        nama: data.nama,
        status: statusText,
        pesan: pesanBawah,
        waktu: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        id_user: data.info_id || data.nisn || identifier.trim(),
        info: data.divisi || data.kelas || "Pengguna Aktif",
        foto: data.foto,
        type: 'SUCCESS'
      });
    } catch (error) {
      const serverMsg = error.response?.data?.message || "ID Tidak Terdaftar";
      console.warn("[Absensi] Respon Server 400/Error:", serverMsg);
      setNotification({
        nama: "Gagal Absensi",
        status: "ERROR",
        pesan: serverMsg,
        type: 'ERROR'
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => { setNotification(null); setShowManualInput(false); setManualId(""); }, 3000);
    }
  }, [isLoading, time]);

  // --- AUTO SYNC OFFLINE SCANS ---
  useEffect(() => {
    const syncOfflineData = async () => {
      if (!navigator.onLine) return;
      try {
        const scans = await getOfflineScans();
        if (scans && scans.length > 0) {
          console.log(`Syncing ${scans.length} offline scans...`);
          for (const scan of scans) {
            try {
              await api.post('/scan', { rfid_code: scan.rfid_code });
              await removeOfflineScan(scan.id);
            } catch {
              console.error("Gagal sync scan:", scan.rfid_code);
            }
          }
          setNotification({
            nama: "Sinkronisasi Selesai",
            status: "SYNC",
            pesan: `${scans.length} absen offline berhasil diunggah`,
            type: 'SUCCESS'
          });
          setTimeout(() => setNotification(null), 3000);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('online', syncOfflineData);
    if (navigator.onLine) {
      syncOfflineData();
    }

    return () => window.removeEventListener('online', syncOfflineData);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showManualInput) return;
      const currentTime = Date.now();
      if (currentTime - lastKeyTime.current > 100) rfidBuffer.current = "";
      lastKeyTime.current = currentTime;

      if (e.key === 'Enter') {
        if (rfidBuffer.current.length > 0) {
          processAbsensi(rfidBuffer.current);
          rfidBuffer.current = "";
        }
      } else if (e.key.length === 1) {
        rfidBuffer.current += e.key;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showManualInput, processAbsensi]);

  const renderScanInstruction = () => {
    const metode = appConfig.metode_absensi;
    const iconProps = { size: 32, className: "text-white/90 drop-shadow-md" };
    if (metode === 'BARCODE') return { title: "Scan Barcode", text: "Arahkan Barcode ID", icon: <QrCode {...iconProps} /> };
    if (metode === 'FINGERPRINT') return { title: "Tempel Jari", text: "Letakkan jari pada sensor", icon: <Fingerprint {...iconProps} /> };
    if (metode === 'MANUAL') return { title: "Input ID", text: "Ketik ID Pengguna", icon: <Keyboard {...iconProps} /> };
    if (metode === 'QR_CODE') {
      return { title: "Kamera QR Code", text: "Arahkan QR Code ke Lensa Kamera", icon: <Camera {...iconProps} /> };
    }
    if (metode === 'WAJAH') {
      return { title: "Pengenalan Wajah", text: "Arahkan Wajah ke Lensa Kamera", icon: <UserCircle {...iconProps} /> };
    }
    return { title: "Tempel Kartu", text: "Silakan Tap Kartu ID", icon: <ScanLine {...iconProps} /> };
  };
  const instruction = renderScanInstruction();

  return (
    <div className="min-h-[100dvh] w-full bg-slate-900 flex flex-col lg:flex-row items-center justify-center antialiased font-sans font-normal relative overflow-hidden select-none">

      {/* BACKGROUND */}
      <div className="fixed inset-0 z-0">
        <img
          src={appConfig.background_absensi || bgDefault}
          alt="Background"
          className="w-full h-full object-cover scale-105 animate-in fade-in duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/70 to-slate-900/50 backdrop-blur-[2px]" />
      </div>

      {/* HEADER */}
      <div className="absolute top-0 w-full p-4 lg:p-8 flex justify-between items-center z-30 pointer-events-none">
        <div className="flex items-center gap-2 lg:gap-3 group cursor-pointer pointer-events-auto" onClick={() => navigate('/login')}>
          <div className="w-10 h-10 lg:w-14 lg:h-14 flex items-center justify-center drop-shadow-xl hover:scale-105 transition-transform duration-300">
            <img src={appConfig.logo_instansi || logoDefault} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-sm lg:text-xl font-black text-white uppercase tracking-tight drop-shadow-md leading-none">
              {appConfig.nama_instansi}
            </h1>
            <p className="text-[8px] lg:text-[10px] font-bold text-blue-300 uppercase tracking-[0.2em] mt-0.5 lg:mt-1 opacity-90">
              Nebula Smart Presence
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center relative z-10 px-4 lg:px-10 mt-16 lg:mt-0">

        {/* JAM (KIRI) */}
        <div className="lg:col-span-7 flex flex-col justify-center text-center lg:text-left space-y-1 lg:order-1 order-1">
          <div className="flex items-center justify-center lg:justify-start gap-2 lg:gap-3 text-blue-200 font-bold uppercase tracking-[0.2em] text-[10px] lg:text-xs lg:pl-1">
            <CalendarIcon size={14} className="lg:w-4 lg:h-4" />
            {time.toLocaleDateString('id-ID', { timeZone: appConfig.timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          <div className="flex items-baseline justify-center lg:justify-start gap-2 lg:gap-5 text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]">
            <div className="flex font-bold tracking-tighter leading-none tabular-nums">
              <span className="text-7xl sm:text-8xl lg:text-[12rem]">{time.toLocaleTimeString('en-GB', { timeZone: appConfig.timezone, hour: '2-digit', hour12: false })}</span>
              <span className="text-7xl sm:text-8xl lg:text-[12rem] text-blue-500 animate-pulse pb-1 lg:pb-4">:</span>
              <span className="text-7xl sm:text-8xl lg:text-[12rem]">{time.toLocaleTimeString('en-GB', { timeZone: appConfig.timezone, minute: '2-digit' })}</span>
            </div>
            <div className="flex flex-col justify-end pb-2 lg:pb-8">
              <span className="text-3xl sm:text-4xl lg:text-7xl font-bold text-blue-500 underline decoration-4 decoration-blue-500/50 underline-offset-4 lg:underline-offset-8 tabular-nums">
                {time.toLocaleTimeString('en-GB', { timeZone: appConfig.timezone, second: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center lg:justify-start gap-3 lg:gap-4 mt-4 lg:mt-0">
            <div className={`flex items-center gap-2 lg:gap-3 border px-4 lg:px-5 py-2 lg:py-3 rounded-full backdrop-blur-md transition-all ${statusDisplay.border}`}>
              <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center ${statusDisplay.color} bg-black/20`}>
                <Clock size={12} className="lg:w-4 lg:h-4" />
              </div>
              <div className="text-left">
                <p className="text-[8px] lg:text-[9px] text-white/40 font-bold uppercase tracking-wider">Status Waktu</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDisplay.indicator}`}></span>
                  <p className={`text-[10px] lg:text-xs font-bold ${statusDisplay.color}`}>{statusDisplay.text}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-3 bg-white/5 border border-white/10 px-4 lg:px-5 py-2 lg:py-2 rounded-full backdrop-blur-md">
              <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
                <MapPin size={12} className="lg:w-4 lg:h-4" />
              </div>
              <div className="text-left">
                <p className="text-[8px] lg:text-[9px] text-white/40 font-bold uppercase tracking-wider">Lokasi</p>
                <p className="text-white text-[10px] lg:text-xs font-bold truncate max-w-[120px] lg:max-w-[200px]">{appConfig.alamat_instansi}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SCANNER CARD (KANAN) */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end pb-24 lg:pb-0 lg:order-2 order-2 w-full">
          <div className="relative w-full max-w-[320px] sm:max-w-[360px] lg:max-w-[380px]">
            <div className="w-full aspect-[3/4] bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 lg:p-6 shadow-2xl relative flex flex-col items-center justify-center overflow-hidden ring-1 ring-white/5 transition-all duration-300">

              {!notification && !showManualInput && appConfig.metode_absensi !== 'QR_CODE' && appConfig.metode_absensi !== 'WAJAH' && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/10 to-transparent h-[100%] w-full animate-[scan_3s_ease-in-out_infinite] pointer-events-none"></div>
              )}

              {/* 1. NOTIFIKASI HASIL SCAN (Untuk mode selain WAJAH) */}
              {notification && appConfig.metode_absensi !== 'WAJAH' ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300 relative z-10">
                  <div className="relative mb-4 lg:mb-6">
                    <div className={`w-28 h-36 lg:w-36 lg:h-44 p-1 rounded-2xl border-2 ${notification.type === 'ERROR' ? 'border-rose-500 shadow-rose-500/20' :
                      notification.status === 'TERLAMBAT' ? 'border-yellow-500 shadow-yellow-500/20' :
                        'border-emerald-500 shadow-emerald-500/20'
                      } bg-black/40 overflow-hidden shadow-2xl relative`}>

                      {notification.foto ? (
                        <img src={notification.foto} alt="Profile" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 rounded-xl text-white/20">
                          <UserCircle size={48} className="lg:w-16 lg:h-16" />
                        </div>
                      )}
                    </div>

                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full font-bold text-[9px] lg:text-[10px] text-white uppercase tracking-wider shadow-lg border border-slate-900 ${notification.type === 'ERROR' ? 'bg-rose-600' :
                      notification.status === 'TERLAMBAT' ? 'bg-yellow-500' :
                        'bg-emerald-600'
                      }`}>
                      {notification.status}
                    </div>
                  </div>

                  <h3 className="text-lg lg:text-xl font-bold text-white tracking-wide uppercase mb-1 drop-shadow-md line-clamp-1 w-full px-2 mt-1">
                    {notification.nama}
                  </h3>

                  <div className="flex gap-2 justify-center mt-1 mb-4 lg:mb-6">
                    <span className="text-[9px] lg:text-[10px] font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded border border-white/5">{notification.id_user}</span>
                    <span className="text-[9px] lg:text-[10px] font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{notification.info}</span>
                  </div>

                  <div className={`w-full py-3 lg:py-4 rounded-xl lg:rounded-2xl bg-white/5 border border-white/10 font-bold uppercase tracking-widest text-[10px] lg:text-xs animate-pulse shadow-inner ${notification.type === 'ERROR' ? 'text-rose-400 bg-rose-500/10' :
                    notification.status === 'TERLAMBAT' ? 'text-yellow-400 bg-yellow-500/10' :
                      'text-emerald-400 bg-emerald-500/10'
                    }`}>
                    {notification.pesan}
                  </div>
                </div>
              ) : showManualInput ? (
                /* 2. FORM INPUT MANUAL */
                <div className="w-full h-full flex flex-col justify-center animate-in slide-in-from-right duration-300 relative z-[50]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowManualInput(false);
                      setManualId("");
                    }}
                    className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-rose-500 text-white rounded-full transition-all cursor-pointer z-[100] border border-white/10 active:scale-95 shadow-lg pointer-events-auto"
                  >
                    <X size={20} />
                  </button>
                  <div className="text-center mb-6 lg:mb-8">
                    <div className="w-14 h-14 lg:w-16 lg:h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3 lg:mb-4 text-blue-400 border border-white/10 shadow-lg">
                      <Keyboard size={24} className="lg:w-7 lg:h-7" />
                    </div>
                    <h3 className="text-base lg:text-lg font-bold text-white uppercase tracking-wide">Manual Entry</h3>
                    <p className="text-white/40 text-[9px] lg:text-[10px] mt-1">Masukkan ID Pengguna</p>
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); processAbsensi(manualId); }} className="space-y-4 w-full px-1">
                    <input
                      ref={inputRef}
                      id="manualId"
                      name="manualId"
                      type="text"
                      placeholder="Ketik ID..."
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 font-mono font-bold text-base lg:text-lg text-white text-center outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-white/10 tracking-widest shadow-inner pointer-events-auto"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      disabled={isLoading}
                      autoComplete="off"
                    />
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-4 lg:py-3.5 font-bold uppercase tracking-widest text-[10px] shadow-lg transition-transform active:scale-95 border-t border-white/10 touch-manipulation flex items-center justify-center gap-2 pointer-events-auto">
                      {isLoading ? "Memproses..." : "Verifikasi"}
                    </button>
                  </form>
                </div>
              ) : appConfig.metode_absensi === 'WAJAH' ? (
                /* 3. TAMPILAN KAMERA PENGENALAN WAJAH AKTIF (Kamera Tetap Menyala) */
                <div className="w-full h-full flex flex-col items-center justify-between p-1 relative z-10 animate-in fade-in duration-300">
                  <div className="w-full flex-1 rounded-2xl overflow-hidden shadow-inner border border-white/10">
                    <CameraFaceScanner
                      onScanSuccess={processAbsensi}
                      isLoading={isLoading}
                      members={membersList}
                      notification={notification}
                    />
                  </div>
                  <button
                    onClick={() => setShowManualInput(true)}
                    className="mt-3 px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all shadow-md active:scale-95 touch-manipulation pointer-events-auto"
                  >
                    Input Manual
                  </button>
                </div>
              ) : appConfig.metode_absensi === 'QR_CODE' ? (
                /* 4. TAMPILAN KAMERA QR AKTIF */
                <div className="w-full h-full flex flex-col items-center justify-between p-1 relative z-10 animate-in fade-in duration-300">
                  <div className="w-full flex-1 rounded-2xl overflow-hidden shadow-inner border border-white/10">
                    <CameraQrScanner onScanSuccess={processAbsensi} isLoading={isLoading} />
                  </div>
                  <button
                    onClick={() => setShowManualInput(true)}
                    className="mt-3 px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all shadow-md active:scale-95 touch-manipulation pointer-events-auto"
                  >
                    Input Manual
                  </button>
                </div>
              ) : (
                /* 5. TAMPILAN STANDAR (RFID / BARCODE / FINGERPRINT) */
                <div className="w-full h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-500 relative z-10">
                  <div className="relative mb-6 lg:mb-8 group cursor-default">
                    <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse opacity-50"></div>
                    <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-b from-white/10 to-white/5 rounded-3xl flex items-center justify-center shadow-2xl relative z-10 border border-white/10 backdrop-blur-sm group-hover:scale-105 transition-transform duration-500">
                      {instruction.icon}
                    </div>
                  </div>
                  <h3 className="text-lg lg:text-xl font-bold text-white tracking-wide uppercase mb-1 lg:mb-2">{instruction.title}</h3>
                  <p className="text-white/40 text-[10px] lg:text-xs max-w-[200px] leading-relaxed mb-6 lg:mb-8 border-b border-white/5 pb-4">{instruction.text}</p>
                  <button onClick={() => setShowManualInput(true)} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95 touch-manipulation pointer-events-auto">
                    Input Manual
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <a
        href="https://akaranabastala.github.io/portofolio_dicha/"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 lg:bottom-6 left-1/2 -translate-x-1/2 lg:translate-x-0 lg:left-8 z-20 opacity-60 hover:opacity-100 transition-opacity w-fit text-center lg:text-left cursor-pointer pointer-events-auto"
      >
        <div className="flex items-center justify-center lg:justify-start gap-3 group">
          <div className="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center">
            <img
              src={logoDefault}
              alt="Creator"
              className="w-full h-full object-contain filter drop-shadow-md grayscale group-hover:grayscale-0 transition-all"
            />
          </div>
          <div className="h-4 w-[1px] bg-white/20 mx-1"></div>
          <p className="text-white/80 text-[8px] lg:text-[10px] font-medium tracking-[0.2em] group-hover:text-white transition-colors">
            POWERED BY NABASTALA
          </p>
        </div>
      </a>
    </div>
  );
};

export default Absensi;
