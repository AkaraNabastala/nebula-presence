import React, { useState } from 'react';
import api from '../../api/axios';
import { 
    UploadCloud, AlertTriangle, RefreshCw, FileText, 
    CheckCircle, AlertCircle, X, ServerCrash, Loader2,
    ShieldAlert, ArrowRight
} from 'lucide-react';

const RestorePage = () => {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  
  // --- STATE MODAL KONFIRMASI CUSTOM ---
  const [showConfirm, setShowConfirm] = useState(false);

  const showToast = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 5000);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
        if (!selected.name.endsWith('.sql')) {
            showToast('error', "Format file tidak valid! Gunakan ekstensi .sql");
            setFile(null);
            e.target.value = null;
            return;
        }
        setFile(selected);
        setUploadProgress(0);
    }
  };

  // Fungsi ini sekarang hanya membuka Modal, bukan langsung Restore
  const triggerRestore = () => {
    if (!file) return;
    setShowConfirm(true);
  };

  // Fungsi Eksekusi Asli
  const executeRestore = async () => {
    setShowConfirm(false); // Tutup modal dulu
    setLoading(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('backup_file', file);

    try {
        const res = await api.post('/restore', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(percent);
            }
        });
        
        if (res.data.success) {
            showToast('success', "Sistem berhasil dipulihkan dari cadangan data.");
            setFile(null);
            setTimeout(() => window.location.reload(), 3000);
        }
    } catch (error) {
        const errMsg = error.response?.data?.message || "Gagal memproses file SQL.";
        showToast('error', errMsg);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      
      {/* --- CUSTOM MODAL KONFIRMASI (ANTI-LOCALHOST) --- */}
      {showConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop dengan Blur Tebal */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"></div>
            
            {/* Modal Box */}
            <div className="relative bg-white rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.4)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 text-center">
                    <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <ShieldAlert size={40} />
                    </div>
                    
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-3">Konfirmasi Restore</h3>
                    <p className="text-slate-500 text-sm leading-relaxed px-4">
                        Tindakan ini akan <span className="text-rose-600 font-black">MENGHAPUS SEMUA DATA</span> saat ini secara permanen dan menggantinya dengan data dari file backup. 
                        <br/><br/>
                        Apakah Anda yakin ingin melanjutkan?
                    </p>
                </div>

                <div className="flex p-4 gap-3 bg-slate-50 border-t border-slate-100">
                    <button 
                        onClick={() => setShowConfirm(false)}
                        className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-white transition-all text-xs uppercase tracking-widest"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={executeRestore}
                        className="flex-1 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-lg shadow-rose-200 transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        Ya, Timpa Data <ArrowRight size={14}/>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- PREMIUM TOAST NOTIFICATION --- */}
      {notification.show && (
        <div className="fixed top-6 right-6 z-[999] animate-in slide-in-from-right-full duration-500">
            <div className={`relative overflow-hidden min-w-[320px] max-w-md backdrop-blur-xl bg-white/95 border-l-4 shadow-2xl p-5 rounded-2xl flex items-start gap-4 ${
                notification.type === 'success' ? 'border-emerald-500' : 'border-rose-500'
            }`}>
                <div className={`shrink-0 p-2 rounded-xl ${
                    notification.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                }`}>
                    {notification.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                </div>

                <div className="flex-1 pr-4">
                    <h4 className={`font-black text-xs uppercase tracking-widest mb-1 ${
                        notification.type === 'success' ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                        {notification.type === 'success' ? 'Success' : 'Error'}
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-bold uppercase tracking-tight">
                        {notification.message}
                    </p>
                </div>

                <button onClick={() => setNotification({ ...notification, show: false })} className="text-slate-400">
                    <X size={16} />
                </button>
            </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                <UploadCloud className="text-amber-600" size={28} /> RESTORE SYSTEM
            </h1>
            <p className="text-slate-500 text-sm mt-1">Kembalikan data dari salinan cadangan.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-50/50 rounded-full blur-3xl -mr-20 -mt-20 z-0"></div>
                
                <div className="relative z-10">
                    {/* AREA WARNING */}
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 mb-8 flex gap-4 items-center">
                        <div className="bg-rose-500 text-white p-2 rounded-lg">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-rose-800 text-sm">Tindakan Berisiko!</h4>
                            <p className="text-[10px] text-rose-600/80 font-bold uppercase tracking-tighter">
                                Database saat ini akan ditimpa secara permanen.
                            </p>
                        </div>
                    </div>

                    {/* DROPZONE */}
                    <div className="relative mb-8">
                        <input id="restore-page-file-input" name="restore_page_file" type="file" accept=".sql,.sqlite" onChange={handleFileChange} disabled={loading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                        <div className={`border-2 border-dashed rounded-[2rem] py-12 flex flex-col items-center justify-center transition-all duration-500 ${
                            file ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50 group-hover:border-amber-400 group-hover:bg-amber-50/30'
                        }`}>
                            {file ? (
                                <div className="text-center animate-in zoom-in duration-300">
                                    <div className="bg-emerald-500 text-white p-4 rounded-3xl shadow-lg shadow-emerald-200 mb-4 inline-block">
                                        <FileText size={32} />
                                    </div>
                                    <p className="font-black text-slate-700 text-lg uppercase tracking-tight">{file.name}</p>
                                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] mt-2">File Ready to Restore</p>
                                </div>
                            ) : (
                                <div className="text-center group-hover:scale-105 transition-transform duration-500">
                                    <div className="bg-white p-4 rounded-3xl shadow-md border border-slate-100 mb-4 inline-block text-slate-400 group-hover:text-amber-500 transition-colors">
                                        <UploadCloud size={32} />
                                    </div>
                                    <p className="font-bold text-slate-600">Tarik & Lepas file .sql / .sqlite ke sini</p>
                                    <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Format: .sql / .sqlite (Max 50MB)</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PROGRESS BAR */}
                    {loading && (
                        <div className="mb-8 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Processing Stream</span>
                                <span className="text-2xl font-black text-amber-500 italic">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                                <div className="bg-gradient-to-r from-amber-400 to-amber-600 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={triggerRestore}
                        disabled={!file || loading}
                        className={`w-full py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl flex items-center justify-center gap-3 transition-all duration-300 ${
                            !file || loading 
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' 
                            : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]'
                        }`}
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        {loading ? (uploadProgress < 100 ? 'Uploading Data' : 'Merging Database') : 'Execute Restore'}
                    </button>
                </div>
            </div>
        </div>

        <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white">
                <ServerCrash size={40} className="text-rose-500 mb-6" />
                <h3 className="font-black text-lg uppercase tracking-tight mb-4">Restore Protocol</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                    Sistem akan memutus koneksi aktif saat database sedang dipulihkan untuk menjaga integritas data.
                </p>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 text-[10px] font-bold uppercase">
                        <CheckCircle size={14} className="text-emerald-400" /> Auto-Verify Checksum
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RestorePage;