import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, User, Target } from 'lucide-react';
import api from '../api/axios';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await api.get('/audit-logs');
                setLogs(res.data?.data || (Array.isArray(res.data) ? res.data : []));
            } catch (error) {
                console.error("Gagal memuat audit log", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const safeLogs = Array.isArray(logs) ? logs : [];

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex justify-between items-center dark:bg-slate-800 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                        <ShieldAlert className="w-6 h-6 text-indigo-500" />
                        Log Aktivitas (Audit Trail)
                    </h1>
                    <p className="text-slate-500 mt-1 dark:text-slate-400">
                        Pantau seluruh riwayat aktivitas krusial yang dilakukan oleh Administrator. (Hanya SuperAdmin)
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div className="p-6 overflow-x-auto">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                        </div>
                    ) : safeLogs.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 dark:text-slate-500">
                            Belum ada riwayat aktivitas yang tercatat.
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-slate-100 dark:border-slate-700 ml-3 space-y-8 py-2">
                            {safeLogs.map((log, index) => (
                                <div key={log.id || index} className="relative pl-6 group">
                                    <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white border-2 border-indigo-400 group-hover:border-indigo-600 transition-colors dark:bg-slate-800 dark:border-indigo-500"></span>

                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1">
                                        <h3 className="font-semibold text-slate-800 text-base dark:text-slate-200">
                                            {log.action}
                                        </h3>
                                        <div className="flex items-center text-xs text-slate-400 gap-1 mt-1 sm:mt-0 font-mono">
                                            <Clock className="w-3 h-3" />
                                            {new Date(log.timestamp).toLocaleString('id-ID')}
                                        </div>
                                    </div>

                                    <div className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 dark:text-slate-400">
                                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 dark:bg-slate-900/50 dark:border-slate-700">
                                            <User className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="font-medium">{log.admin_name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                            <Target className="w-3.5 h-3.5" />
                                            <span>Target: <span className="text-slate-700 font-medium dark:text-slate-300">{log.target}</span></span>
                                        </div>
                                    </div>
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
