import React, { useRef, useState } from 'react';
import { UploadCloud, AlertTriangle, RefreshCw, FileText, CheckCircle2, X, ShieldAlert } from 'lucide-react';
import api from '../api/axios';

const RestorePage = () => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultDialog, setResultDialog] = useState(null);

  const chooseFile = (event) => {
    const selected = event.target.files?.[0] || null;
    event.target.value = '';
    if (!selected) return;
    if (!/\.(sqlite|db)$/i.test(selected.name)) {
      setResultDialog({ status: 'error', message: 'Format file tidak sesuai. Pilih file backup .sqlite atau .db.' });
      return;
    }
    if (selected.size === 0) {
      setResultDialog({ status: 'error', message: 'File backup kosong dan tidak dapat dipulihkan.' });
      return;
    }
    setFile(selected);
    setUploadProgress(0);
  };

  const executeRestore = async () => {
    if (!file || busy) return;
    setConfirmOpen(false);
    setBusy(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('backup_file', file);
    try {
      const response = await api.post('/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.min(100, Math.round((event.loaded * 100) / event.total)));
        }
      });
      const message = response.data?.message || 'Permintaan pemulihan diterima.';
      if (response.data?.success === false) throw new Error(message);
      setFile(null);
      setResultDialog({ status: 'success', message });
    } catch (error) {
      setResultDialog({ status: 'error', message: error.response?.data?.message || error.message || 'Gagal memproses file backup.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-orange-200/80 bg-gradient-to-br from-orange-50 via-white to-sky-50 p-5 shadow-[0_18px_55px_rgba(160,90,28,0.08)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-orange-950/20 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-sky-400" />
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-600 to-amber-300 text-slate-950 shadow-lg"><UploadCloud size={22} /></span>
          <div><span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-orange-800 dark:text-orange-300">Pemulihan Data</span><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Pulihkan Database</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">Impor file backup SQLite untuk mengganti database aktif. Pemulihan hanya dijalankan setelah file dipilih dan konfirmasi diberikan.</p></div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <input ref={inputRef} type="file" accept=".sqlite,.db" className="hidden" onChange={chooseFile} />
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"><FileText size={30} /></span>
          <h2 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Pilih file backup</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-slate-300">Gunakan file .sqlite atau .db yang dibuat dari aplikasi Nebula Presence. File akan diperiksa validitasnya oleh server sebelum dipakai.</p>
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-bold text-orange-900 transition hover:bg-orange-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-orange-200 dark:hover:bg-slate-700"><UploadCloud size={17} />{file ? 'Pilih File Lain' : 'Pilih File Backup'}</button>
        </div>
        {file ? <div className="mx-auto mt-6 flex max-w-xl items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/70 p-4 dark:border-slate-700 dark:bg-slate-950"><FileText size={20} className="shrink-0 text-blue-700 dark:text-sky-300" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{file.name}</p><p className="mt-1 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div><button type="button" disabled={busy} onClick={() => setFile(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white disabled:opacity-50 dark:hover:bg-slate-800" aria-label="Hapus file pilihan"><X size={16} /></button></div> : <div className="mx-auto mt-6 max-w-xl rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-700">Belum ada file yang dipilih.</div>}
        <button type="button" disabled={!file || busy} onClick={() => setConfirmOpen(true)} className="mx-auto mt-5 flex w-full max-w-xl items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-400 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"><ShieldAlert size={17} /> Tinjau & Pulihkan</button>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><p className="text-xs leading-relaxed"><strong>Perhatian:</strong> pemulihan mengganti database aktif. Sistem akan membuat snapshot sebelum restore; ikuti instruksi server untuk menutup dan membuka kembali aplikasi jika diminta.</p></div>

      {confirmOpen && file && <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="restore-confirm-title"><div className="w-full max-w-md overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-sky-400" /><div className="p-6"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"><AlertTriangle size={22} /></span><h2 id="restore-confirm-title" className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Konfirmasi pemulihan</h2><p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Database aktif akan diganti dengan file ini. Pastikan file benar dan Anda sudah memiliki backup terbaru.</p><div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{file.name}</p><p className="mt-1 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row"><button type="button" disabled={busy} onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Batal</button><button type="button" disabled={busy} onClick={executeRestore} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-400 px-4 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-50">{busy ? <RefreshCw size={16} className="animate-spin" /> : <UploadCloud size={16} />}Ya, Pulihkan</button></div></div></div></div>}

      {busy && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="status" aria-live="polite"><div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900"><RefreshCw size={26} className="mx-auto animate-spin text-blue-700 dark:text-sky-300" /><h2 className="mt-3 font-extrabold text-slate-950 dark:text-white">Mengunggah file backup</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Progres pengiriman file: {uploadProgress}%</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-sky-600 transition-[width] duration-200" style={{ width: `${uploadProgress}%` }} /></div><p className="mt-3 text-xs text-slate-500">Setelah file diterima, server memvalidasi database dan menjadwalkan penerapan restore.</p></div></div>}

      {resultDialog && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="restore-result-title"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${resultDialog.status === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300'}`}>{resultDialog.status === 'success' ? <CheckCircle2 size={25} /> : <AlertTriangle size={25} />}</div><h2 id="restore-result-title" className="mt-4 text-center text-lg font-extrabold text-slate-950 dark:text-white">{resultDialog.status === 'success' ? 'Permintaan restore diterima' : 'Restore gagal'}</h2><p className="mt-2 text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">{resultDialog.message}</p><button type="button" onClick={() => setResultDialog(null)} className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-900 to-blue-600 px-4 py-3 text-sm font-bold text-white">Tutup</button></div></div>}
    </div>
  );
};

export default RestorePage;
