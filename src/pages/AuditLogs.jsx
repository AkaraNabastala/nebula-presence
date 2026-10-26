import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, User, Target, RefreshCw, Cloud, CloudOff, Server, CircleCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/axios';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState(null);
    const [runtimeLogs, setRuntimeLogs] = useState([]);
    const [activeLogType, setActiveLogType] = useState('audit');
    const [backendReachable, setBackendReachable] = useState(null);
    const [lastChecked, setLastChecked] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchLogs = async (manual = false) => {
        if (manual) setRefreshing(true);
        try {
            const [logsResult, syncResult, runtimeResult] = await Promise.allSettled([
                api.get('/audit-logs'),
                api.get('/cloud-sync/status'),
                api.get('/system-logs?limit=100')
            ]);
            if (logsResult.status === 'fulfilled') {
                const res = logsResult.value;
                setLogs(res.data?.data || (Array.isArray(res.data) ? res.data : []));
            } else if (manual) {
                toast.error('Log aktivitas gagal dimuat dari backend.');
            }
            if (syncResult.status === 'fulfilled') {
                setSyncStatus(syncResult.value.data?.data || syncResult.value.data || null);
            } else if (manual) {
                toast.error('Status koneksi Portal tidak dapat diperiksa.');
            }
            setBackendReachable(logsResult.status === 'fulfilled' || syncResult.status === 'fulfilled');
            if (runtimeResult.status === 'fulfilled') setRuntimeLogs(runtimeResult.value.data?.data || []);
            setLastChecked(new Date());
        } catch (error) {
            console.error('Gagal memuat pemantauan sistem', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const timer = setInterval(() => fetchLogs(), 30000);
        return () => clearInterval(timer);
    }, []);

    const safeLogs = activeLogType === 'backend' ? (Array.isArray(runtimeLogs) ? runtimeLogs : []) : (Array.isArray(logs) ? logs : []);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 dark:bg-slate-900 dark:border-slate-800">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                        <ShieldAlert className="w-6 h-6 text-indigo-500" />
                        Log Aktivitas (Audit Trail)
                    </h1>
                    <p className="text-slate-500 mt-1 dark:text-slate-400">
                        Pantau seluruh riwayat aktivitas krusial yang dilakukan oleh Administrator. (Hanya SuperAdmin)
                    </p>
                </div>
                <button type="button" onClick={() => fetchLogs(true)} disabled={refreshing} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-900 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-900/15 disabled:opacity-60"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Perbarui pemantauan</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Server size={18} /></span><div><p className="text-sm font-bold text-slate-900 dark:text-white">Backend Nebula</p><p className="text-xs text-slate-500 dark:text-slate-400">Status diperiksa melalui endpoint API</p></div></div>
                    <div className="mt-4 flex items-center gap-2 text-sm font-semibold"><CircleCheck size={16} className={backendReachable === false ? "text-rose-500" : "text-emerald-500"} /> {backendReachable === true ? 'API merespons' : backendReachable === false ? 'Backend tidak merespons' : 'Memeriksa koneksi...'}</div>
                    <p className="mt-1 text-[11px] text-slate-500">Pemeriksaan terakhir: {lastChecked ? lastChecked.toLocaleTimeString('id-ID') : '—'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">{syncStatus?.lastStatus === 'synced' ? <Cloud size={18} /> : <CloudOff size={18} />}</span><div><p className="text-sm font-bold text-slate-900 dark:text-white">Sinkronisasi Portal</p><p className="text-xs text-slate-500 dark:text-slate-400">Ringkasan koneksi dan antrean kirim</p></div></div>
                    <div className="mt-4 flex flex-wrap items-center gap-2"><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${syncStatus?.lastStatus === 'synced' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : syncStatus?.lastStatus === 'partial' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{syncStatus?.lastStatus || 'Belum ada status'}</span><span className="text-xs text-slate-500">{Number(syncStatus?.pendingCount || 0)} antrean belum terkirim</span></div>
                    <p className="mt-2 break-all text-[11px] text-slate-500">{syncStatus?.url || 'URL Portal belum diatur'}</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                        <button type="button" onClick={() => setActiveLogType('audit')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${activeLogType === 'audit' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500'}`}>Audit Trail</button>
                        <button type="button" onClick={() => setActiveLogType('backend')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${activeLogType === 'backend' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500'}`}>Log Backend ({runtimeLogs.length})</button>
                    </div>
                    <p className="text-[11px] text-slate-500">Log proses aktif disimpan sementara di memori dan dibatasi hingga 300 entri.</p>
                </div>
                <div className="p-6 overflow-x-auto">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                        </div>
                    ) : safeLogs.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 dark:text-slate-500">
                            {activeLogType === 'backend' ? 'Belum ada log backend yang terekam sejak proses server berjalan.' : 'Belum ada aktivitas admin yang tercatat pada audit trail.'}
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-slate-100 dark:border-slate-700 ml-3 space-y-8 py-2">
                            {safeLogs.map((log, index) => (
                                <div key={log.id || index} className="relative pl-6 group">
                                    <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white border-2 border-indigo-400 group-hover:border-indigo-600 transition-colors dark:bg-slate-800 dark:border-indigo-500"></span>

                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1">
                                        <h3 className="break-words font-semibold text-slate-800 text-base dark:text-slate-200">
                                            {activeLogType === 'backend' ? log.message : log.action}
                                        </h3>
                                        <div className="flex items-center text-xs text-slate-400 gap-1 mt-1 sm:mt-0 font-mono">
                                            <Clock className="w-3 h-3" />
                                            {new Date(log.timestamp).toLocaleString('id-ID')}
                                        </div>
                                    </div>

                                    {activeLogType === 'backend' ? (
                                        <div className="mt-2 inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{log.level || 'info'} · Backend</div>
                                    ) : (
                                        <div className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 dark:text-slate-400">
                                            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 dark:bg-slate-900/50 dark:border-slate-700"><User className="w-3.5 h-3.5 text-slate-400" /><span className="font-medium">{log.admin_name}</span></div>
                                            <div className="flex items-center gap-1.5 text-slate-500"><Target className="w-3.5 h-3.5" /><span>Target: <span className="text-slate-700 font-medium dark:text-slate-300">{log.target}</span></span></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditLogs;
