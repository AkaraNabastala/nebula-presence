import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, DownloadCloud, UploadCloud, ShieldCheck } from 'lucide-react';
import BackupPage from './BackupPage';
import RestorePage from './RestorePage';

const tabs = [
  { id: 'overview', label: 'Ringkasan', icon: Database },
  { id: 'backup', label: 'Backup', icon: DownloadCloud },
  { id: 'restore', label: 'Pulihkan', icon: UploadCloud }
];

export default function DatabasePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = ['overview', 'backup', 'restore'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const chooseTab = tab => setSearchParams(tab === 'overview' ? {} : { tab });

  return <div className="mx-auto max-w-5xl space-y-5 pb-10">
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-orange-50 p-5 shadow-[0_18px_55px_rgba(28,100,160,0.09)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/50 sm:p-7">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-300 via-blue-600 to-orange-400" />
      <div className="relative flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-950 via-blue-700 to-sky-400 text-white shadow-lg"><Database size={22} /></span>
        <div><span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-800 dark:text-sky-300">Pusat Pemeliharaan</span><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Manajemen Database</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">Backup, pemulihan, dan perlindungan database disatukan dalam satu halaman. Pilih tab tanpa berpindah menu.</p></div>
      </div>
    </section>

    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900" role="tablist" aria-label="Manajemen database">
      {tabs.map(tab => { const Icon = tab.icon; const active = activeTab === tab.id; return <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => chooseTab(tab.id)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${active ? 'bg-blue-950 text-white shadow-sm dark:bg-sky-700' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><Icon size={16} />{tab.label}</button>; })}
    </div>

    {activeTab === 'overview' && <section className="grid gap-4 md:grid-cols-2">
      <button type="button" onClick={() => chooseTab('backup')} className="group rounded-2xl border border-sky-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"><span className="inline-flex rounded-xl bg-sky-100 p-3 text-blue-800 dark:bg-blue-950/60 dark:text-sky-300"><DownloadCloud size={22} /></span><h2 className="mt-4 font-extrabold text-slate-900 dark:text-white">Backup Database</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Buat dan unduh snapshot SQLite yang konsisten.</p><span className="mt-4 inline-block text-sm font-bold text-sky-800 dark:text-sky-300">Buka backup →</span></button>
      <button type="button" onClick={() => chooseTab('restore')} className="group rounded-2xl border border-orange-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"><span className="inline-flex rounded-xl bg-orange-50 p-3 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"><UploadCloud size={22} /></span><h2 className="mt-4 font-extrabold text-slate-900 dark:text-white">Pulihkan Database</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Validasi file backup dan konfirmasi sebelum mengganti database aktif.</p><span className="mt-4 inline-block text-sm font-bold text-orange-800 dark:text-orange-300">Buka pemulihan →</span></button>
      <aside className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100 md:col-span-2"><ShieldCheck size={18} className="mt-0.5 shrink-0" /><p className="text-xs leading-relaxed"><strong>Lindungi data:</strong> file backup dapat memuat data pribadi. Simpan di lokasi tepercaya dan buat backup terbaru sebelum pemulihan.</p></aside>
    </section>}
    {activeTab === 'backup' && <BackupPage compact />}
    {activeTab === 'restore' && <RestorePage compact />}
  </div>;
}
