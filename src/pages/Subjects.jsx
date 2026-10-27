import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Plus, RefreshCw, Pencil, Power, Trash2, Search, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/axios';

const emptyForm = { name: '', code: '' };
const fieldClass = 'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950';

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [subjectToDelete, setSubjectToDelete] = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/subjects');
      setSubjects(Array.isArray(response.data) ? response.data : response.data?.data || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal memuat mata pelajaran.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredSubjects = useMemo(() => subjects.filter(subject => {
    const term = query.trim().toLowerCase();
    return !term || String(subject.name || '').toLowerCase().includes(term) || String(subject.code || '').toLowerCase().includes(term);
  }), [subjects, query]);

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setModalOpen(true); };
  const edit = subject => { setEditingId(subject.id); setForm({ name: subject.name || '', code: subject.code || '' }); setModalOpen(true); };
  const closeModal = () => { if (!saving) { setModalOpen(false); setEditingId(null); setForm(emptyForm); } };

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), code: form.code.trim() };
      if (!payload.name) { toast.warning('Nama mata pelajaran wajib diisi.'); return; }
      if (editingId) {
        await api.put(`/subjects/${editingId}`, payload);
        toast.success('Mata pelajaran berhasil diperbarui.');
      } else {
        await api.post('/subjects', payload);
        toast.success('Mata pelajaran berhasil ditambahkan.');
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await load(true);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal menyimpan mata pelajaran.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async subject => {
    try {
      await api.patch(`/subjects/${subject.id}/status`, { is_active: Number(subject.is_active) === 1 ? 0 : 1 });
      toast.success('Status mata pelajaran diperbarui.');
      await load(true);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal mengubah status.');
    }
  };

  const deleteSubject = async subject => {
    setDeletingId(subject.id);
    try {
      await api.delete(`/subjects/${subject.id}`);
      toast.success('Mata pelajaran berhasil dihapus.');
      await load(true);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal menghapus mata pelajaran. Pastikan mata pelajaran tidak sedang digunakan.');
    } finally { setDeletingId(null); }
  };

  const activeCount = subjects.filter(item => Number(item.is_active) === 1 || item.is_active === undefined).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-orange-50 p-5 shadow-[0_18px_55px_rgba(28,100,160,0.09)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/60 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-300 via-blue-600 to-orange-400" />
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-sky-300/30 blur-3xl dark:bg-blue-500/15" />
        <div className="pointer-events-none absolute -bottom-20 right-1/3 h-36 w-36 rounded-full bg-orange-200/50 blur-3xl dark:bg-orange-500/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-950 via-blue-700 to-sky-400 text-white shadow-lg shadow-blue-900/15"><BookOpen size={22} /></span>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-800 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300">Ruang Akademik</span>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Mata Pelajaran</h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">Kelola katalog mata pelajaran yang dipakai untuk jadwal guru dan monitoring jurnal.</p>
            </div>
          </div>
          <button type="button" onClick={openAdd} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-950 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:shadow-xl"><Plus size={17} /> Tambah Mapel</button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"><BookOpen size={19} /></span>
          <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total mata pelajaran</p><p className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">{subjects.length}</p></div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><CheckCircle2 size={19} /></span>
          <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mapel aktif</p><p className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">{activeCount}</p></div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"><Search size={19} /></span>
          <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Hasil filter saat ini</p><p className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">{filteredSubjects.length}</p></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-sky-50/80 via-white to-orange-50/50 p-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><h2 className="font-extrabold text-slate-950 dark:text-white">Katalog Mapel</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cari, ubah identitas, atau kelola status mata pelajaran.</p></div>
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1 sm:w-72 sm:flex-none"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama atau kode mapel..." className="w-full rounded-xl border border-sky-100 bg-white py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950" /></label>

          </div>
        </div>
        {loading ? <div className="flex items-center justify-center gap-3 p-14 text-sm text-slate-500"><RefreshCw size={18} className="animate-spin text-blue-600" /> Memuat daftar mata pelajaran…</div> :
          filteredSubjects.length === 0 ? <div className="flex flex-col items-center px-5 py-14 text-center"><BookOpen size={32} className="text-sky-300" /><p className="mt-3 font-bold text-slate-800 dark:text-slate-200">Belum ada data yang cocok</p><p className="mt-1 text-xs text-slate-500">Ubah kata kunci pencarian atau tambahkan mata pelajaran baru.</p></div> : <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-sky-50 text-[10px] uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-950 dark:text-slate-300"><tr><th className="px-5 py-4">Mata Pelajaran</th><th className="px-5 py-4">Kode</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filteredSubjects.map(subject => { const active = subject.is_active === undefined || Number(subject.is_active) === 1; return <tr key={subject.id} className="transition hover:bg-sky-50/60 dark:hover:bg-slate-800/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-blue-50 text-blue-800 dark:from-slate-800 dark:to-blue-950 dark:text-sky-300"><BookOpen size={17} /></span><div><p className="font-bold text-slate-900 dark:text-white">{subject.name}</p><p className="mt-0.5 text-[10px] text-slate-400">ID #{subject.id}</p></div></div></td><td className="px-5 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">{subject.code || 'Belum diberi kode'}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />{active ? 'Aktif' : 'Nonaktif'}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-1.5"><button type="button" onClick={() => edit(subject)} title="Edit mapel" className="rounded-lg p-2 text-blue-700 hover:bg-blue-100 dark:text-sky-300 dark:hover:bg-slate-700"><Pencil size={15} /></button><button type="button" onClick={() => toggleStatus(subject)} title={active ? 'Nonaktifkan' : 'Aktifkan'} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"><Power size={15} /></button><button type="button" onClick={() => setSubjectToDelete(subject)} disabled={deletingId === subject.id} title="Hapus mapel" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/40">{deletingId === subject.id ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}</button></div></td></tr>; })}</tbody></table></div>
            <div className="grid gap-3 p-3 sm:grid-cols-2 md:hidden">{filteredSubjects.map(subject => { const active = subject.is_active === undefined || Number(subject.is_active) === 1; return <article key={subject.id} className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/60 p-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-blue-800 dark:bg-blue-950 dark:text-sky-300"><BookOpen size={17} /></span><div className="min-w-0 flex-1"><h3 className="break-words font-bold text-slate-900 dark:text-white">{subject.name}</h3><p className="mt-1 text-xs text-slate-500">{subject.code || 'Belum diberi kode'}</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{active ? 'Aktif' : 'Nonaktif'}</span></div></div><div className="mt-4 flex items-center justify-end gap-2 border-t border-sky-100 pt-3 dark:border-slate-800"><button type="button" onClick={() => edit(subject)} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs font-semibold text-blue-800 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300"><Pencil size={13} /> Edit</button><button type="button" onClick={() => toggleStatus(subject)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><Power size={13} /> {active ? 'Nonaktifkan' : 'Aktifkan'}</button><button type="button" onClick={() => setSubjectToDelete(subject)} disabled={deletingId === subject.id} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-100 bg-white px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-50 dark:border-rose-900 dark:bg-slate-800"><Trash2 size={13} /> Hapus</button></div></article>; })}</div>
          </>}
      </section>

      {modalOpen && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#071226]/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="subject-modal-title">
        <form onSubmit={submit} className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-blue-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between border-b border-slate-100 bg-blue-50/70 p-5 dark:border-slate-800 dark:bg-slate-950"><div><h2 id="subject-modal-title" className="font-bold text-slate-900 dark:text-white">{editingId ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}</h2><p className="mt-1 text-xs text-slate-500">Lengkapi identitas mata pelajaran di bawah ini.</p></div><button type="button" onClick={closeModal} disabled={saving} className="rounded-lg p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-800" aria-label="Tutup"><X size={17} /></button></div>
          <div className="space-y-4 p-5"><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Nama mata pelajaran *<input required maxLength={100} autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass} placeholder="Contoh: Matematika" /></label><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Kode mapel (opsional)<input maxLength={30} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className={fieldClass} placeholder="Contoh: MTK-01" /></label></div>
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><button type="button" onClick={closeModal} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Batal</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-950 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-60">{saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{saving ? 'Menyimpan…' : 'Simpan Mapel'}</button></div>
        </form>
      </div>}

      {subjectToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="delete-subject-title">
          <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-rose-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="h-1.5 bg-gradient-to-r from-rose-600 via-orange-400 to-sky-400" />
            <div className="p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"><AlertTriangle size={22} /></span>
              <h2 id="delete-subject-title" className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Hapus mata pelajaran?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Mata pelajaran <strong>{subjectToDelete.name}</strong> akan dihapus. Jika masih dipakai jadwal, server dapat menolak penghapusan.</p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={() => setSubjectToDelete(null)} disabled={deletingId !== null} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Batal</button>
                <button type="button" onClick={async () => { const target = subjectToDelete; await deleteSubject(target); setSubjectToDelete(null); }} disabled={deletingId !== null} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50"><Trash2 size={14} />{deletingId !== null ? 'Menghapus…' : 'Ya, Hapus'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
