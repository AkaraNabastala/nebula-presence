import React, { useRef, useState } from 'react';
import {
  Database as DatabaseIcon, DownloadCloud, UploadCloud, ShieldCheck,
  FileText, AlertTriangle, CheckCircle2, X, RefreshCw, HardDrive, ArrowRight
} from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-toastify';

const Database = () => {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [backupDialog, setBackupDialog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleBackup = async () => {
    setDownloading(true);
    setBackupDialog({ status: 'processing', message: 'Membuat salinan database dan menyiapkan unduhan.' });
    try {
      const response = await api.get('/backup', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_database_${new Date().toISOString().slice(0, 10)}.sqlite`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      toast.success('Backup database berhasil diunduh.');
      setBackupDialog({ status: 'success', message: 'Salinan database berhasil dibuat dan unduhan telah dimulai.' });
    } catch (error) {
      const message = error.response?.data?.message || 'Gagal mengunduh backup database.';
      toast.error(message);
      setBackupDialog({ status: 'error', message });
    } finally {
      setDownloading(false);
    }
  };

  const chooseFile = (event) => {
    const selected = event.target.files?.[0] || null;
    event.target.value = '';
    if (!selected) return;
    if (!/\.(sqlite|db)$/i.test(selected.name)) {
      toast.error('Format file tidak sesuai. Pilih file backup .sqlite atau .db.');
      return;
    }
    setFile(selected);
    toast.info('File backup siap diperiksa sebelum pemulihan.');
  };

  const handleRestore = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('backup_file', file);
    try {
      const response = await api.post('/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data?.success === false) throw new Error(response.data?.message || 'Pemulihan database gagal.');
      toast.success('Database berhasil dipulihkan. Aplikasi akan dimuat ulang.');
      setFile(null);
      window.setTimeout(() => window.location.reload(), 1800);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Gagal memulihkan database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-orange-50 p-5 shadow-[0_18px_55px_rgba(28,100,160,0.09)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/50 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-300 via-blue-600 to-orange-400" />
        <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-sky-300/30 blur-3xl dark:bg-blue-500/15" />
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-950 via-blue-700 to-sky-400 text-white shadow-lg"><DatabaseIcon size={22} /></span>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-800 dark:text-sky-300">Perlindungan Data</span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Manajemen Database</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">Kelola perlindungan data dari satu pusat pemeliharaan. Konfirmasi dan proses unduh maupun pemulihan ditampilkan melalui modal khusus.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-blue-800 dark:bg-blue-950/60 dark:text-sky-300"><DownloadCloud size={21} /></span><h2 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Backup Database</h2><p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Unduh salinan database lokal untuk disimpan sebagai cadangan sebelum pembaruan atau pemulihan.</p></div>
            <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-800 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300">EXPORT</span>
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"><HardDrive size={18} className="shrink-0 text-slate-500" /><div><p className="text-xs font-bold text-slate-800 dark:text-slate-200">Format file .sqlite</p><p className="mt-0.5 text-[11px] text-slate-500">Salinan database lengkap</p></div></div>
          <button type="button" onClick={() => setBackupDialog({ status: 'ready', message: 'Buat salinan database lokal sebelum pembaruan atau pemulihan.' })} disabled={downloading || loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-950 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-900/15 transition hover:brightness-110 disabled:opacity-50">{downloading ? <RefreshCw size={16} className="animate-spin" /> : <DownloadCloud size={16} />}{downloading ? 'Menyiapkan backup…' : 'Unduh Backup Database'}</button>
        </section>

        <section className="rounded-[1.75rem] border border-orange-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"><UploadCloud size={21} /></span><h2 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Restore Database</h2><p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Pilih file backup yang valid. Sistem akan meminta konfirmasi sebelum mengganti database yang aktif.</p></div>
            <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold text-orange-800 dark:border-slate-700 dark:bg-slate-800 dark:text-orange-300">IMPORT</span>
          </div>
          <input ref={fileInputRef} type="file" accept=".sqlite,.db" className="hidden" onChange={chooseFile} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || downloading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-blue-900 transition hover:bg-sky-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300 dark:hover:bg-slate-700"><FileText size={16} />{file ? 'Pilih File Lain' : 'Pilih File Backup'}</button>
          {file ? <div className="mt-3 flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/70 p-3 dark:border-slate-700 dark:bg-slate-950"><FileText size={18} className="shrink-0 text-blue-700 dark:text-sky-300" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-900 dark:text-white">{file.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div><button type="button" onClick={() => setFile(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white dark:hover:bg-slate-800" aria-label="Hapus file pilihan"><X size={15} /></button></div> : <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700">Belum ada file yang dipilih.</div>}
          <button type="button" onClick={() => setConfirmOpen(true)} disabled={!file || loading || downloading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"><ShieldCheck size={16} />Tinjau & Pulihkan Database</button>
        </section>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-950 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-200">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" /><p className="text-xs leading-relaxed"><strong>Catatan penting:</strong> proses restore mengganti database aktif. Buat backup terbaru dan pastikan file yang dipilih berasal dari sumber tepercaya.</p>
      </div>

      {confirmOpen && file && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="restore-confirm-title">
          <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-orange-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-sky-400" />
            <div className="p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"><AlertTriangle size={22} /></span>
              <h2 id="restore-confirm-title" className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Konfirmasi pemulihan database</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Database aktif akan diganti dengan file berikut. Pastikan backup terbaru sudah tersedia.</p>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"><FileText size={18} className="shrink-0 text-blue-700 dark:text-sky-300" /><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900 dark:text-white">{file.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div></div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Batal</button><button type="button" onClick={handleRestore} disabled={loading} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-3 text-xs font-extrabold text-slate-950 disabled:opacity-50">{loading ? <RefreshCw size={15} className="animate-spin" /> : <ArrowRight size={15} />}{loading ? 'Memulihkan…' : 'Ya, Pulihkan'}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Database;
