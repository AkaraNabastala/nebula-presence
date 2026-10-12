import React, { useState } from 'react';
import { Database, Download, ShieldCheck, HardDrive, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import api from '../../api/axios';

const BackupPage = () => {
    const [notification, setNotification] = useState({ show: false, type: '', message: '' });

    const showToast = (type, message) => {
        setNotification({ show: true, type, message });
        setTimeout(() => setNotification({ show: false }), 4000);
    };

    const handleBackup = async () => {
        setNotification({ show: true, type: 'info', message: 'Sedang menyiapkan file SQL...' });

        try {
            // 1. Download file sebagai 'blob' (Binary Large Object)
            // Dengan cara ini, Headers/Token di api/axios.js akan otomatis ikut terkirim
            const response = await api.get('/backup', {
                responseType: 'blob', // PENTING: Agar axios tahu ini adalah file
            });

            // 2. Buat URL sementara untuk file tersebut
            const url = window.URL.createObjectURL(new Blob([response.data]));

            // 3. Buat elemen <a> bayangan untuk memicu download
            const link = document.createElement('a');
            link.href = url;

            // Beri nama file (Sesuaikan dengan tanggal jika perlu)
            const fileName = `backup_db_${new Date().toISOString().split('T')[0]}.sql`;
            link.setAttribute('download', fileName);

            // 4. Masukkan ke dokumen, klik, lalu hapus lagi
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);

            // Bersihkan memory URL
            window.URL.revokeObjectURL(url);

            showToast('success', "Database berhasil diunduh!");
        } catch (e) {
            console.error("Backup Error:", e);
            showToast('error', "Gagal mengunduh backup. Pastikan server aktif.");
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-300">

            {/* NOTIFIKASI TOAST */}
            {notification.show && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border bg-white dark:bg-slate-800 ${notification.type === 'success' ? 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
                    {notification.type === 'success' ? <CheckCircle size={22} /> : <AlertCircle size={22} />}
                    <div><p className="text-sm font-bold">{notification.message}</p></div>
                    <button onClick={() => setNotification({ show: false })}><X size={18} className="opacity-50 hover:opacity-100" /></button>
                </div>
            )}

            {/* HEADER */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                    <Database className="text-blue-600" /> Backup Database
                </h1>
                <p className="text-gray-500 dark:text-slate-400 mt-1">Unduh salinan lengkap data sistem untuk keamanan.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* KARTU UTAMA (DOWNLOAD) */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 dark:bg-slate-700/50 rounded-bl-full -mr-16 -mt-16 z-0"></div>

                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                                <Download size={32} />
                            </div>

                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Unduh Data Terkini</h2>
                            <p className="text-gray-500 dark:text-slate-400 leading-relaxed mb-8 max-w-lg">
                                Sistem akan meng-generate file SQL yang berisi seluruh data <b>pengguna, kelas/divisi, log absensi,</b> dan <b>pengaturan</b>.
                                <br /><br />
                                <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded font-bold uppercase tracking-wider">Format File: .SQL</span>
                            </p>

                            <button
                                onClick={handleBackup}
                                className="group flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
                            >
                                <Download size={20} className="group-hover:translate-y-1 transition-transform" />
                                <span>Download Backup Sekarang</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* KARTU INFO (KANAN) */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                            <ShieldCheck size={18} className="text-emerald-500" /> Keamanan Data
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                            Pastikan file backup disimpan di lokasi yang aman (Google Drive atau Hardisk Eksternal). File ini berisi data sensitif pengguna/karyawan.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                            <HardDrive size={18} className="text-purple-500" /> Ukuran File
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                            Ukuran file backup biasanya sangat kecil (kurang dari 5MB) untuk data instansi skala menengah, sehingga mudah disimpan.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BackupPage;