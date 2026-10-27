import React, { useState } from 'react';
import { Database, DownloadCloud, ShieldCheck, HardDrive, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import api from '../api/axios';

const BackupPage = () => {
  const [dialog, setDialog] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleBackup = async () => {
    setDownloading(true);
    setDialog({ status: 'processing', message: 'Membuat snapshot database yang konsisten dan menyiapkan unduhan.' });
    try {
      const response = await api.get('/backup', { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_db_${new Date().toISOString().slice(0, 10)}.sqlite`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1500);
      setDialog({ status: 'success', message: 'Snapshot database berhasil dibuat dan unduhan telah dimulai.' });
    } catch (error) {
      let message = 'Gagal membuat backup database. Periksa koneksi aplikasi lalu coba lagi.';
      const payload = error.response?.data;
      if (payload instanceof Blob) {
        try {
          const parsed = JSON.parse(await payload.text());
          message = parsed.message || message;
        } catch { /* keep safe fallback */ }
      } else if (payload?.message) {
        message = payload.message;
      }
      setDialog({ status: 'error', message });
    } finally {
      setDownloading(false);
    }
  };

  const closeDialog = () => {
    if (!downloading) setDialog(null);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-orange-50 p-5 shadow-[0_18px_55px_rgba(28,100,160,0.09)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/50 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-300 via-blue-600 to-orange-400" />
        <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-sky-300/30 blur-3xl dark:bg-blue-500/15" />
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-950 via-blue-700 to-sky-400 text-white shadow-lg"><Database size={22} /></span>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-800 dark:text-sky-300">Perlindungan Data</span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Backup Database</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">Buat dan unduh salinan database lokal. Proses ekspor dijalankan setelah konfirmasi melalui dialog, tanpa mencampur halaman pemulihan.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-blue-800 dark:bg-blue-950/60 dark:text-sky-300"><DownloadCloud size={26} /></span>
          <h2 className="mt-5 text-xl font-extrabold text-slate-950 dark:text-white">Unduh salinan database</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">Sistem membuat snapshot SQLite yang konsisten agar data yang sedang digunakan tidak disalin setengah jalan.</p>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <HardDrive size={20} className="shrink-0 text-slate-500" />
            <div><p className="text-sm font-bold text-slate-800 dark:text-slate-200">Format .sqlite</p><p className="mt-0.5 text-xs text-slate-500">File berisi salinan database lokal.</p></div>
          </div>
          <button type="button" disabled={downloading} onClick={() => setDialog({ status: 'ready', message: 'Buat salinan database lokal sekarang? File hasil backup akan diunduh ke perangkat ini.' })} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-950 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-50 sm:w-auto">
            <DownloadCloud size={17} /> Mulai Backup
          </button>
        </div>
        <aside className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/20">
          <ShieldCheck size={24} className="text-amber-700 dark:text-amber-300" />
          <h2 className="mt-3 font-extrabold text-amber-950 dark:text-amber-100">Simpan dengan aman</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">File backup dapat memuat data pribadi. Simpan di lokasi yang aksesnya dibatasi dan buat backup terbaru sebelum pemulihan atau pembaruan besar.</p>
        </aside>
      </section>

      {dialog && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="backup-dialog-title">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="h-1 bg-gradient-to-r from-blue-900 via-sky-500 to-orange-300" />
            <div className="p-6 text-center">
              <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${dialog.status === 'error' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300' : dialog.status === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-sky-50 text-blue-800 dark:bg-sky-950/40 dark:text-sky-300'}`}>
                {dialog.status === 'processing' ? <RefreshCw size={25} className="animate-spin" /> : dialog.status === 'error' ? <AlertTriangle size={25} /> : dialog.status === 'success' ? <CheckCircle2 size={25} /> : <DownloadCloud size={25} />}
              </div>
              <h2 id="backup-dialog-title" className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">{dialog.status === 'ready' ? 'Konfirmasi Backup' : dialog.status === 'processing' ? 'Backup sedang diproses' : dialog.status === 'success' ? 'Backup berhasil' : 'Backup gagal'}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{dialog.message}</p>
              {dialog.status === 'processing' && <div className="nebula-transfer-glow mx-auto mt-5 h-1.5 max-w-xs rounded-full bg-gradient-to-r from-blue-900 via-sky-400 to-orange-300" />}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
                {dialog.status === 'ready' ? <>
                  <button type="button" onClick={closeDialog} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Batal</button>
                  <button type="button" onClick={handleBackup} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-900 to-blue-600 px-4 py-3 text-sm font-bold text-white"><DownloadCloud size={16} /> Unduh Backup</button>
                </> : dialog.status === 'processing' ? <button type="button" disabled className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Menyiapkan file…</button> : <button type="button" onClick={closeDialog} className="w-full rounded-xl bg-gradient-to-r from-blue-900 to-blue-600 px-4 py-3 text-sm font-bold text-white"><X size={16} className="mr-2 inline" />Tutup</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupPage;
