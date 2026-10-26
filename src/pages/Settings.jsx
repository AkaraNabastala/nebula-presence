import React, { useState, useEffect } from 'react';
import {
    Save, Upload, ScanLine, QrCode, Fingerprint, Keyboard,
    Image as ImageIcon, CheckCircle, AlertCircle, X,
    Settings as SettingsIcon, Calendar, Clock, MapPin,
    Building2, ToggleLeft, ToggleRight, ChevronDown, Trash2, Camera,
    Send, Cloud, CloudOff, RefreshCw, Globe, Check, ShieldCheck, Plus
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../api/axios';

const Settings = () => {
    const [loading, setLoading] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [syncLoading, setSyncLoading] = useState(false);
    const [notification, setNotification] = useState({ show: false, type: '', message: '' });

    // Konfigurasi Dasar, Notifikasi & Cloud Sync
    const [config, setConfig] = useState({
        nama_instansi: 'Memuat...',
        alamat_instansi: '',
        metode_absensi: 'RFID',
        timezone: 'Asia/Jakarta',
        logo_instansi: '',
        background_absensi: '',
        app_mode: 'korporat',
        company_shifts: '[{"name":"Shift 1","in":"08:00","out":"16:00"}]',
        notif_telegram_active: '0',
        notif_telegram_bot_token: '',
        notif_telegram_default_chat_id: '',
        notif_template_masuk: '',
        notif_template_pulang: '',
        cloud_sync_active: '0',
        cloud_sync_url: '',
        cloud_sync_token: ''
    });

    // Status Live Sinkronisasi Cloud
    const [cloudSyncLive, setCloudSyncLive] = useState({
        enabled: false,
        pendingCount: 0,
        lastStatus: 'idle',
        lastTime: '',
        stage: '',
        message: '',
        progress: 0,
        processed: 0,
        total: 0,
        skipped: 0,
        errors: []
    });

    // Konfigurasi Jadwal Sekolah / Hari
    const [schedule, setSchedule] = useState([
        { day: 'Senin', active: true, in: '07:00', out: '15:00' },
        { day: 'Selasa', active: true, in: '07:00', out: '15:00' },
        { day: 'Rabu', active: true, in: '07:00', out: '15:00' },
        { day: 'Kamis', active: true, in: '07:00', out: '15:00' },
        { day: 'Jumat', active: true, in: '07:00', out: '11:30' },
        { day: 'Sabtu', active: false, in: '07:00', out: '13:00' },
        { day: 'Minggu', active: false, in: '07:00', out: '13:00' },
    ]);

    const [shifts, setShifts] = useState([
        { name: 'Shift 1', in: '08:00', out: '16:00' }
    ]);

    const fetchCloudSyncStatus = async () => {
        try {
            const res = await api.get('/cloud-sync/status');
            if (res.data && res.data.success) {
                setCloudSyncLive(prev => ({
                    ...prev,
                    enabled: res.data.enabled,
                    pendingCount: res.data.pendingCount || 0,
                    lastStatus: res.data.lastStatus || prev.lastStatus || 'idle',
                    lastTime: res.data.lastTime || prev.lastTime || ''
                }));
            }
        } catch {
            // silent fallback
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings');
            if (res.data) {
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

                setConfig({
                    nama_instansi: fallbackName,
                    alamat_instansi: res.data.alamat_sekolah || '',
                    metode_absensi: res.data.metode_absensi || 'RFID',
                    timezone: res.data.timezone || 'Asia/Jakarta',
                    logo_instansi: res.data.logo_sekolah || '',
                    background_absensi: res.data.background_absensi || '',
                    app_mode: res.data.app_mode || 'korporat',
                    company_shifts: res.data.company_shifts || '[{"name":"Shift 1","in":"08:00","out":"16:00"}]',
                    notif_telegram_active: res.data.notif_telegram_active || '0',
                    notif_telegram_bot_token: res.data.notif_telegram_bot_token || '',
                    notif_telegram_default_chat_id: res.data.notif_telegram_default_chat_id || '',
                    notif_template_masuk: res.data.notif_template_masuk || '',
                    notif_template_pulang: res.data.notif_template_pulang || '',
                    cloud_sync_active: res.data.cloud_sync_active || '0',
                    cloud_sync_url: res.data.cloud_sync_url || '',
                    cloud_sync_token: res.data.cloud_sync_token || ''
                });

                try {
                    if (res.data.jadwal_sekolah && res.data.jadwal_sekolah.trim() !== '') {
                        const parsed = JSON.parse(res.data.jadwal_sekolah);
                        if (Array.isArray(parsed) && parsed.length > 0) setSchedule(parsed);
                    }
                } catch (e) { console.error("Gagal parse jadwal", e); }

                try {
                    if (res.data.company_shifts && res.data.company_shifts.trim() !== '') {
                        const parsedShifts = JSON.parse(res.data.company_shifts);
                        if (Array.isArray(parsedShifts) && parsedShifts.length > 0) setShifts(parsedShifts);
                    }
                } catch (e) { console.error("Gagal parse shifts", e); }
            }
        } catch {
            console.error("Gagal sinkronisasi data settings");
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchCloudSyncStatus();

        // Socket.IO Listener untuk Status Sinkronisasi Real-Time
        const socket = io(import.meta.env.DEV ? (import.meta.env.VITE_API_URL || 'http://localhost:6990') : window.location.origin);
        socket.on('cloud_sync_status', (data) => {
            setCloudSyncLive(prev => ({
                ...prev,
                lastStatus: data.state || prev.lastStatus,
                stage: data.stage || prev.stage,
                message: data.message || prev.message,
                progress: Number.isFinite(data.progress) ? data.progress : prev.progress,
                processed: Number.isFinite(data.processed) ? data.processed : prev.processed,
                total: Number.isFinite(data.total) ? data.total : prev.total,
                skipped: Number.isFinite(data.skipped) ? data.skipped : prev.skipped,
                errors: Array.isArray(data.errors) ? data.errors : prev.errors,
                lastTime: data.lastTime || prev.lastTime
            }));
            if (data.state !== 'syncing') fetchCloudSyncStatus();
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const showToast = (type, message) => {
        setNotification({ show: true, type, message });
        setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3500);
    };

    const handleConfigChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e, keyName) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                showToast('error', "Ukuran file maksimal 2MB!");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setConfig(prev => ({ ...prev, [keyName]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveAsset = (e, keyName) => {
        e.stopPropagation();
        setConfig(prev => ({ ...prev, [keyName]: '' }));
    };

    const handleTimeChange = (index, field, value) => {
        const newSchedule = [...schedule];
        newSchedule[index][field] = value;
        setSchedule(newSchedule);
    };

    const handleDayToggle = (index) => {
        const newSchedule = [...schedule];
        newSchedule[index].active = !newSchedule[index].active;
        setSchedule(newSchedule);
    };

    const handleShiftChange = (index, field, value) => {
        const newShifts = [...shifts];
        newShifts[index][field] = value;
        setShifts(newShifts);
    };

    const addShift = () => {
        if (shifts.length < 4) {
            setShifts([...shifts, { name: `Shift ${shifts.length + 1}`, in: '08:00', out: '16:00' }]);
        }
    };

    const removeShift = (index) => {
        const newShifts = shifts.filter((_, i) => i !== index);
        const normalizedShifts = newShifts.map((shift, i) => ({ ...shift, name: `Shift ${i + 1}` }));
        setShifts(normalizedShifts);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const payload = {
                nama_sekolah: config.nama_instansi,
                alamat_sekolah: config.alamat_instansi,
                metode_absensi: config.metode_absensi,
                timezone: config.timezone,
                logo_sekolah: config.logo_instansi,
                background_absensi: config.background_absensi,
                app_mode: config.app_mode,
                company_shifts: JSON.stringify(shifts),
                jadwal_sekolah: JSON.stringify(schedule),
                jam_masuk: schedule[0].in,
                jam_pulang: schedule[0].out,
                notif_telegram_active: config.notif_telegram_active || '0',
                notif_telegram_bot_token: config.notif_telegram_bot_token || '',
                notif_telegram_default_chat_id: config.notif_telegram_default_chat_id || '',
                notif_template_masuk: config.notif_template_masuk || '',
                notif_template_pulang: config.notif_template_pulang || '',
                cloud_sync_active: config.cloud_sync_active || '0',
                cloud_sync_url: config.cloud_sync_url || '',
                cloud_sync_token: config.cloud_sync_token || ''
            };

            await api.post('/settings', payload);
            showToast('success', "Pengaturan berhasil disimpan! Memuat ulang...");
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch {
            showToast('error', "Gagal menyimpan pengaturan.");
        }
        setLoading(false);
    };

    const handleTestTelegram = async () => {
        if (!config.notif_telegram_bot_token || !config.notif_telegram_default_chat_id) {
            showToast('error', "Isi Bot Token dan Default Chat ID terlebih dahulu!");
            return;
        }
        setTestLoading(true);
        try {
            const res = await api.post('/notifications/test-telegram', {
                bot_token: config.notif_telegram_bot_token,
                chat_id: config.notif_telegram_default_chat_id
            });
            showToast('success', res.data.message || "Pesan uji coba berhasil terkirim!");
        } catch (err) {
            showToast('error', err.response?.data?.message || "Gagal mengirim pesan uji coba.");
        } finally {
            setTestLoading(false);
        }
    };

    const handleTriggerSync = async () => {
        if (config.cloud_sync_active !== '1') {
            showToast('error', "Aktifkan sinkronisasi Cloud terlebih dahulu.");
            return;
        }
        setSyncLoading(true);
        setCloudSyncLive(prev => ({ ...prev, lastStatus: 'syncing', stage: 'connecting', message: 'Memulai sinkronisasi...', progress: 0, processed: 0, total: 0, skipped: 0, errors: [] }));
        try {
            const res = await api.post('/cloud-sync/trigger');
            if (res.data && res.data.success) {
                showToast('success', res.data.message || "Sinkronisasi berhasil!");
                fetchCloudSyncStatus();
            } else {
                setCloudSyncLive(prev => ({ ...prev, lastStatus: 'partial', stage: 'complete', progress: 100, message: res.data?.message || 'Sinkronisasi gagal.', errors: res.data?.errors || [] }));
                showToast('error', res.data?.message || "Sinkronisasi gagal.");
            }
        } catch (err) {
            setCloudSyncLive(prev => ({ ...prev, lastStatus: 'offline', stage: 'complete', message: err.response?.data?.message || 'Gagal menghubungi server Cloud.' }));
            showToast('error', err.response?.data?.message || "Gagal menghubungi server Cloud.");
        } finally {
            setSyncLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-24 md:pb-10 font-sans">

            {/* TOAST NOTIFIKASI */}
            {notification.show && (
                <div className={`fixed top-4 right-4 z-[99] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right border bg-white dark:bg-slate-800 ${notification.type === 'success' ? 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
                    {notification.type === 'success' ? <CheckCircle size={22} className="text-green-500" /> : <AlertCircle size={22} className="text-red-500" />}
                    <div><h4 className="font-bold text-sm">{notification.type === 'success' ? 'Berhasil' : 'Gagal'}</h4><p className="text-xs text-gray-500 dark:text-gray-400">{notification.message}</p></div>
                    <button onClick={() => setNotification({ show: false })}><X size={18} className="text-gray-400" /></button>
                </div>
            )}

            {/* HEADER */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm text-blue-600 dark:text-blue-400">
                    <SettingsIcon size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Pengaturan Sistem</h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Sesuaikan jadwal operasional, identitas instansi, Cloud Sync, dan notifikasi.</p>
                </div>
            </div>

            {/* ======================================================== */}
            {/* 📅 1. JADWAL OPERASIONAL & SHIFT (DITARUH DI PALING ATAS) */}
            {/* ======================================================== */}
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-700/80">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2.5">
                            <Calendar size={24} className="text-blue-500" />
                            {config.app_mode === 'edukasi' ? 'Jadwal Jam Masuk & Pulang Sekolah' : 'Pengaturan Shift Kerja'}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
                            {config.app_mode === 'edukasi'
                                ? 'Atur jam kehadiran, batas pulang, dan tentukan hari aktif belajar per minggu.'
                                : 'Atur pembagian jam masuk dan kepulangan shift karyawan.'}
                        </p>
                    </div>
                    <span className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl border border-blue-100 dark:border-blue-800/80 shrink-0">
                        {config.app_mode === 'edukasi' ? '🏫 Mode Sekolah' : '🏢 Mode Perusahaan'}
                    </span>
                </div>

                {config.app_mode === 'edukasi' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {schedule.map((day, index) => (
                            <div
                                key={day.day}
                                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${day.active
                                        ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm'
                                        : 'bg-gray-50/80 dark:bg-slate-800/40 border-gray-100 dark:border-slate-800 opacity-60'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-sm text-gray-800 dark:text-white">{day.day}</span>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${day.active
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                : 'bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400'
                                            }`}>
                                            {day.active ? 'Aktif' : 'Libur'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDayToggle(index)}
                                        className={`transition-colors ${day.active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-slate-600'}`}
                                    >
                                        {day.active ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-slate-700/60">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Jam Masuk</label>
                                        <input
                                            type="time"
                                            value={day.in}
                                            onChange={(e) => handleTimeChange(index, 'in', e.target.value)}
                                            disabled={!day.active}
                                            className={`w-full py-2 px-2 text-xs font-bold rounded-xl border outline-none text-center transition-colors ${!day.active
                                                    ? 'bg-gray-100 dark:bg-slate-700/40 text-gray-400 border-transparent cursor-not-allowed'
                                                    : 'bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-600 focus:border-blue-500'
                                                }`}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Jam Pulang</label>
                                        <input
                                            type="time"
                                            value={day.out}
                                            onChange={(e) => handleTimeChange(index, 'out', e.target.value)}
                                            disabled={!day.active}
                                            className={`w-full py-2 px-2 text-xs font-bold rounded-xl border outline-none text-center transition-colors ${!day.active
                                                    ? 'bg-gray-100 dark:bg-slate-700/40 text-gray-400 border-transparent cursor-not-allowed'
                                                    : 'bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-600 focus:border-blue-500'
                                                }`}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {shifts.map((shift, index) => (
                                <div key={index} className="p-4 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <input
                                            type="text"
                                            value={shift.name}
                                            onChange={(e) => handleShiftChange(index, 'name', e.target.value)}
                                            className="font-bold text-sm text-gray-800 dark:text-white bg-transparent outline-none border-b border-dashed border-gray-300 dark:border-slate-600 focus:border-blue-500"
                                            placeholder="Nama Shift"
                                        />
                                        {shifts.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeShift(index)}
                                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                                title="Hapus Shift"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Masuk</label>
                                            <input
                                                type="time"
                                                value={shift.in}
                                                onChange={(e) => handleShiftChange(index, 'in', e.target.value)}
                                                className="w-full py-2 px-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-white outline-none focus:border-blue-500 text-center"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Pulang</label>
                                            <input
                                                type="time"
                                                value={shift.out}
                                                onChange={(e) => handleShiftChange(index, 'out', e.target.value)}
                                                className="w-full py-2 px-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-white outline-none focus:border-blue-500 text-center"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {shifts.length < 4 && (
                            <button
                                type="button"
                                onClick={addShift}
                                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl text-gray-500 dark:text-slate-400 font-bold hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-blue-400 hover:text-blue-500 transition-colors flex justify-center items-center gap-2 text-xs"
                            >
                                <Plus size={16} />
                                <span>Tambah Shift Baru</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ======================================================== */}
            {/* 2. DUA KOLOM DI BAWAHNYA (SEIMBANG & RAPI)                 */}
            {/* ======================================================== */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                {/* --- KOLOM KIRI: IDENTITAS, METODE, & VISUAL --- */}
                <div className="space-y-8">

                    {/* IDENTITAS */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 space-y-5">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <Building2 size={20} className="text-blue-500" /> Identitas Instansi
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="settings-nama-instansi" className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Nama Instansi / Perusahaan</label>
                                <input id="settings-nama-instansi" name="nama_instansi" value={config.nama_instansi} readOnly disabled className="w-full border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 p-3 rounded-xl outline-none font-bold cursor-not-allowed opacity-80 text-sm" title="Diatur oleh lisensi" />
                            </div>

                            <div>
                                <label htmlFor="settings-alamat-instansi" className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Alamat Instansi</label>
                                <div className="relative">
                                    <MapPin size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                                    <input id="settings-alamat-instansi" name="alamat_instansi" value={config.alamat_instansi} onChange={handleConfigChange} placeholder="Jl. Pendidikan No. 123..." className="w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-3 pl-10 rounded-xl outline-none focus:border-blue-500 text-sm font-semibold text-gray-800 dark:text-slate-200 transition-colors" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Zona Waktu</label>
                                <div className="relative">
                                    <Clock size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                                    <select name="timezone" value={config.timezone} onChange={handleConfigChange} className="w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-3 pl-10 rounded-xl outline-none focus:border-blue-500 text-sm font-semibold text-gray-800 dark:text-slate-200 transition-colors appearance-none cursor-pointer">
                                        <option value="Asia/Jakarta">WIB - Asia/Jakarta (GMT+7)</option>
                                        <option value="Asia/Makassar">WITA - Asia/Makassar (GMT+8)</option>
                                        <option value="Asia/Jayapura">WIT - Asia/Jayapura (GMT+9)</option>
                                    </select>
                                    <ChevronDown size={18} className="absolute right-3.5 top-3.5 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Mode Operasional</label>
                                <div className="flex gap-3">
                                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all active:scale-95 ${config.app_mode === 'edukasi' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'border-gray-100 dark:border-slate-700 hover:border-blue-200 text-gray-400 dark:text-slate-500'}`}>
                                        <input type="radio" name="app_mode" value="edukasi" checked={config.app_mode === 'edukasi'} onChange={handleConfigChange} className="hidden" />
                                        <Building2 size={18} />
                                        <span className="text-xs font-bold uppercase">Sekolah</span>
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all active:scale-95 ${config.app_mode === 'korporat' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'border-gray-100 dark:border-slate-700 hover:border-blue-200 text-gray-400 dark:text-slate-500'}`}>
                                        <input type="radio" name="app_mode" value="korporat" checked={config.app_mode === 'korporat'} onChange={handleConfigChange} className="hidden" />
                                        <Building2 size={18} />
                                        <span className="text-xs font-bold uppercase">Perusahaan</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* METODE ABSENSI */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <ScanLine size={20} className="text-blue-500" /> Metode Absensi Utama
                        </h3>
                        <div className="grid grid-cols-3 gap-2.5">
                            {['RFID', 'FINGERPRINT', 'BARCODE', 'QR_CODE', 'WAJAH', 'MANUAL'].map((metode) => (
                                <div
                                    key={metode}
                                    onClick={() => setConfig({ ...config, metode_absensi: metode })}
                                    className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all active:scale-95 ${config.metode_absensi === metode ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'border-gray-100 dark:border-slate-700 hover:border-blue-200 text-gray-400 dark:text-slate-500'}`}
                                >
                                    {metode === 'RFID' && <ScanLine size={22} />}
                                    {metode === 'FINGERPRINT' && <Fingerprint size={22} />}
                                    {metode === 'BARCODE' && (
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 5v14M6 5v14M9 5v14M12 5v14M15 5v14M18 5v14M21 5v14M7 5v14M16 5v14" />
                                        </svg>
                                    )}
                                    {metode === 'QR_CODE' && <QrCode size={22} />}
                                    {metode === 'WAJAH' && <Camera size={22} />}
                                    {metode === 'MANUAL' && <Keyboard size={22} />}

                                    <span className="text-[10px] font-bold uppercase text-center">
                                        {metode === 'BARCODE' && 'BARCODE'}
                                        {metode === 'QR_CODE' && 'QR CODE'}
                                        {metode === 'RFID' && 'RFID'}
                                        {metode === 'FINGERPRINT' && 'FINGERPRINT'}
                                        {metode === 'WAJAH' && 'WAJAH'}
                                        {metode === 'MANUAL' && 'MANUAL'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* VISUAL APLIKASI */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <ImageIcon size={20} className="text-blue-500" /> Visual & Logo Aplikasi
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Logo Instansi</label>
                                <div className="relative aspect-square rounded-2xl bg-gray-50 dark:bg-slate-700/50 border-2 border-dashed border-gray-200 dark:border-slate-600 flex items-center justify-center overflow-hidden hover:border-blue-400 transition-colors group cursor-pointer">
                                    {config.logo_instansi ? (
                                        <>
                                            <img src={config.logo_instansi} className="w-3/4 h-3/4 object-contain" alt="Logo" />
                                            <button onClick={(e) => handleRemoveAsset(e, 'logo_instansi')} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Trash2 size={14} /></button>
                                        </>
                                    ) : <Upload className="text-gray-300" />}
                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'logo_instansi')} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Background Layar Scan</label>
                                <div className="relative aspect-square rounded-2xl bg-gray-50 dark:bg-slate-700/50 border-2 border-dashed border-gray-200 dark:border-slate-600 flex items-center justify-center overflow-hidden hover:border-blue-400 transition-colors group cursor-pointer">
                                    {config.background_absensi ? (
                                        <>
                                            <img src={config.background_absensi} className="w-full h-full object-cover" alt="Bg" />
                                            <button onClick={(e) => handleRemoveAsset(e, 'background_absensi')} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Trash2 size={14} /></button>
                                        </>
                                    ) : <Upload className="text-gray-300" />}
                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'background_absensi')} />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* --- KOLOM KANAN: CLOUD SYNC & NOTIFIKASI TELEGRAM --- */}
                <div className="space-y-8">

                    {/* 🌐 CLOUD SYNC (LOCAL-FIRST ENGINE) */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <Cloud size={22} className="text-sky-500" /> Sinkronisasi Cloud & Web Portal
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                    Sinkronkan data scan ke portal orang tua & tarik izin wali kelas.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({
                                    ...prev,
                                    cloud_sync_active: prev.cloud_sync_active === '1' ? '0' : '1'
                                }))}
                                className={`p-1.5 rounded-full transition-colors ${config.cloud_sync_active === '1' ? 'text-sky-600 dark:text-sky-400' : 'text-gray-300 dark:text-slate-600'}`}
                            >
                                {config.cloud_sync_active === '1' ? <ToggleRight size={38} /> : <ToggleLeft size={38} />}
                            </button>
                        </div>

                        {config.cloud_sync_active === '1' && (
                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-700 animate-in fade-in duration-300">
                                <div className="p-4 rounded-2xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">Status:</span>
                                            {cloudSyncLive.lastStatus === 'syncing' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                                                    <RefreshCw size={12} className="animate-spin" /> Sedang Mengirim...
                                                </span>
                                            ) : cloudSyncLive.lastStatus === 'synced' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Terhubung & Sinkron
                                                </span>
                                            ) : cloudSyncLive.lastStatus === 'offline' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400">
                                                    <CloudOff size={12} /> Offline (Mode Mandiri)
                                                </span>
                                            ) : cloudSyncLive.lastStatus === 'partial' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400">
                                                    <AlertCircle size={12} /> Sinkronisasi Sebagian
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                                    Siaga (Idle)
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-500 dark:text-slate-400">
                                            {cloudSyncLive.pendingCount > 0 ? (
                                                <b className="text-amber-600 dark:text-amber-400">{cloudSyncLive.pendingCount} data antre terkirim</b>
                                            ) : 'Semua log tersinkron'}{' '}
                                            {cloudSyncLive.lastTime ? `• Jam: ${new Date(cloudSyncLive.lastTime).toLocaleTimeString('id-ID')} WIB` : ''}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleTriggerSync}
                                        disabled={syncLoading}
                                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 shrink-0"
                                    >
                                        <RefreshCw size={13} className={syncLoading ? "animate-spin" : ""} />
                                        <span>{syncLoading ? "Menyinkronkan..." : "Sinkronkan Sekarang"}</span>
                                    </button>
                                </div>

                                {(syncLoading || cloudSyncLive.lastStatus === 'syncing' || cloudSyncLive.lastStatus === 'partial' || cloudSyncLive.lastStatus === 'synced') && (
                                    <div className="p-4 rounded-2xl border border-sky-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {cloudSyncLive.lastStatus === 'syncing' ? <RefreshCw size={15} className="animate-spin text-sky-600 shrink-0" /> : cloudSyncLive.lastStatus === 'synced' ? <CheckCircle size={15} className="text-emerald-600 shrink-0" /> : <AlertCircle size={15} className="text-orange-600 shrink-0" />}
                                                <span className="text-xs font-bold text-gray-700 dark:text-slate-200 truncate">{cloudSyncLive.message || (cloudSyncLive.lastStatus === 'synced' ? 'Semua tahap sinkronisasi berhasil.' : cloudSyncLive.lastStatus === 'partial' ? 'Periksa detail data yang belum terkirim.' : 'Proses sinkronisasi berjalan...')}</span>
                                            </div>
                                            <span className="text-xs font-black tabular-nums text-sky-700 dark:text-sky-300">{Math.min(100, Math.max(0, cloudSyncLive.progress || 0))}%</span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${cloudSyncLive.lastStatus === 'partial' ? 'bg-orange-500' : cloudSyncLive.lastStatus === 'synced' ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${Math.min(100, Math.max(0, cloudSyncLive.progress || 0))}%` }} />
                                        </div>
                                        {cloudSyncLive.stage && <p className="text-[11px] text-gray-500 dark:text-slate-400">Tahap: {cloudSyncLive.stage}{cloudSyncLive.total > 0 ? ` • ${cloudSyncLive.processed}/${cloudSyncLive.total} jadwal` : ''}{cloudSyncLive.skipped > 0 ? ` • ${cloudSyncLive.skipped} dilewati` : ''}</p>}
                                        {Array.isArray(cloudSyncLive.errors) && cloudSyncLive.errors.length > 0 && <ul className="list-disc pl-5 text-[11px] text-orange-700 dark:text-orange-300 space-y-1">{cloudSyncLive.errors.slice(0, 4).map((error, index) => <li key={index}>{error}</li>)}</ul>}
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                            URL Web Portal Sekolah <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Globe size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                                            <input
                                                type="text"
                                                name="cloud_sync_url"
                                                value={config.cloud_sync_url || ''}
                                                onChange={handleConfigChange}
                                                placeholder="https://presensi.sekolah.sch.id/api/sync"
                                                className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-mono text-gray-800 dark:text-white outline-none focus:border-sky-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                            Secret Token / API Key
                                        </label>
                                        <div className="relative">
                                            <ShieldCheck size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                                            <input
                                                type="password"
                                                name="cloud_sync_token"
                                                value={config.cloud_sync_token || ''}
                                                onChange={handleConfigChange}
                                                placeholder="Token enkripsi sinkronisasi data"
                                                className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-mono text-gray-800 dark:text-white outline-none focus:border-sky-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200/60 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                                    💡 <b>Local-First:</b> Scanner di sekolah tetap mencatat secepat kilat (&lt;50ms) walau tanpa internet. Log antrean akan otomatis terkirim saat internet online.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 🔔 NOTIFIKASI TELEGRAM */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <Send size={20} className="text-blue-500" /> Notifikasi Online Telegram
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                    Kirim notifikasi otomatis instan ke akun Telegram orang tua/wali.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({
                                    ...prev,
                                    notif_telegram_active: prev.notif_telegram_active === '1' ? '0' : '1'
                                }))}
                                className={`p-1.5 rounded-full transition-colors ${config.notif_telegram_active === '1' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-slate-600'}`}
                            >
                                {config.notif_telegram_active === '1' ? <ToggleRight size={38} /> : <ToggleLeft size={38} />}
                            </button>
                        </div>

                        {config.notif_telegram_active === '1' && (
                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-700 animate-in fade-in duration-300">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                            Telegram Bot Token <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="notif_telegram_bot_token"
                                            value={config.notif_telegram_bot_token || ''}
                                            onChange={handleConfigChange}
                                            placeholder="123456:ABC-DEF1234ghIkl-zyx..."
                                            className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-800 dark:text-white outline-none focus:border-blue-500"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">Dapatkan bot gratis dari <b>@BotFather</b> di Telegram.</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                            Default Group / Chat ID
                                        </label>
                                        <input
                                            type="text"
                                            name="notif_telegram_default_chat_id"
                                            value={config.notif_telegram_default_chat_id || ''}
                                            onChange={handleConfigChange}
                                            placeholder="Contoh: -100123456789 atau ID Chat"
                                            className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-800 dark:text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={handleTestTelegram}
                                        disabled={testLoading}
                                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-2 border border-blue-200 dark:border-blue-800"
                                    >
                                        {testLoading ? <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : <Send size={13} />}
                                        <span>Kirim Pesan Uji Coba</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-amber-700 dark:text-amber-400">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">💬</span>
                                <div>
                                    <p className="text-xs font-bold">WhatsApp Gateway</p>
                                    <p className="text-[11px] opacity-80">Nomor kontak anggota tersimpan di database & siap diaktifkan saat modul gateway selesai diriset.</p>
                                </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-[10px] font-extrabold uppercase shrink-0">Riset</span>
                        </div>
                    </div>

                </div>

            </div>

            {/* TOMBOL SIMPAN PENGATURAN */}
            <div className="fixed bottom-6 right-6 md:static md:flex md:justify-end z-40">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-xl shadow-blue-300 dark:shadow-none transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <>
                            <Save size={18} />
                            <span>Simpan Pengaturan</span>
                        </>
                    )}
                </button>
            </div>

        </div>
    );
};

export default Settings;
