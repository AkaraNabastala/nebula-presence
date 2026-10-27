import React from 'react';
import { Link } from 'react-router-dom';
import { Database, DownloadCloud, UploadCloud, ArrowRight, ShieldCheck, HardDrive } from 'lucide-react';

const DatabasePage = () => (
  <div className="mx-auto max-w-5xl space-y-6 pb-10">
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-orange-50 p-5 shadow-[0_18px_55px_rgba(28,100,160,0.09)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/50 sm:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-300 via-blue-600 to-orange-400" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-sky-300/30 blur-3xl dark:bg-blue-500/15" />
      <div className="relative flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-950 via-blue-700 to-sky-400 text-white shadow-lg"><Database size={22} /></span>
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-800 dark:text-sky-300">Pemeliharaan Sistem</span>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Manajemen Database</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">Pilih tindakan database yang ingin dilakukan. Backup dan pemulihan berada di halaman terpisah; konfirmasi serta proses masing-masing ditampilkan dalam modal khusus.</p>
        </div>
      </div>
    </section>

    <div className="grid gap-5 md:grid-cols-2">
      <Link to="/admin/backup" className="group rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-800 sm:p-7">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-blue-800 dark:bg-blue-950/60 dark:text-sky-300"><DownloadCloud size={23} /></span>
        <h2 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Backup Database</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Buat snapshot SQLite yang konsisten dan unduh sebagai file cadangan.</p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-800 dark:text-sky-300">Buka halaman backup <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span>
      </Link>
      <Link to="/admin/restore" className="group rounded-[1.75rem] border border-orange-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-orange-800 sm:p-7">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"><UploadCloud size={23} /></span>
        <h2 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Pulihkan Database</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Pilih file backup, periksa validitasnya, lalu konfirmasi sebelum pemulihan dijadwalkan.</p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-orange-800 dark:text-orange-300">Buka halaman pemulihan <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span>
      </Link>
    </div>

    <aside className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
      <ShieldCheck size={19} className="mt-0.5 shrink-0" />
      <div><p className="text-sm font-extrabold">Lindungi file cadangan</p><p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">File database dapat memuat data pribadi. Simpan di lokasi tepercaya dan buat backup terbaru sebelum pemulihan.</p></div>
    </aside>
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><HardDrive size={15} /> Database lokal dikelola oleh aplikasi Nebula Presence.</div>
  </div>
);

export default DatabasePage;
