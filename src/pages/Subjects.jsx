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
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#0b1730] via-[#123b82] to-[#2563eb] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-sky-100"><BookOpen size={13} /> DATA AKADEMIK</span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Mata Pelajaran</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100">Kelola daftar mapel yang dapat digunakan pada penjadwalan guru dan monitoring jurnal.</p>
          </div>
          <button type="button" onClick={openAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-950 shadow-md transition hover:-translate-y-0.5 hover:bg-sky-50"><Plus size={17} /> Tambah Mapel</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total mata pelajaran</p><p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{subjects.length}</p></div>
        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Aktif</p><p className="mt-2 text-2xl font-extrabold text-blue-700 dark:text-sky-300">{activeCount}</p></div>
        <div className="col-span-2 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:col-span-1"><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Hasil pencarian</p><p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{filteredSubjects.length}</p></div>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><h2 className="font-bold text-slate-900 dark:text-white">Daftar Mapel</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pilih baris untuk mengubah data atau status mapel.</p></div>
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama atau kode..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
            <button type="button" onClick={() => load()} disabled={loading} aria-label="Muat ulang daftar" className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 text-slate-600 transition hover:bg-blue-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </div>
        {loading ? <div className="flex items-center justify-center gap-3 p-14 text-sm text-slate-500"><RefreshCw size={18} className="animate-spin text-blue-600" /> Memuat daftar mata pelajaran…</div> :
          filteredSubjects.length === 0 ? <div className="flex flex-col items-center px-5 py-14 text-center"><BookOpen size={30} className="text-slate-300" /><p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">Belum ada data yang cocok</p><p className="mt-1 text-xs text-slate-500">Coba kata kunci lain atau tambahkan mata pelajaran baru.</p></div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-blue-50/70 text-[11px] uppercase tracking-wider text-blue-950 dark:bg-slate-950 dark:text-slate-300"><tr><th className="px-5 py-3.5">Mata Pelajaran</th><th className="px-5 py-3.5">Kode</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filteredSubjects.map(subject => { const active = subject.is_active === undefined || Number(subject.is_active) === 1; return <tr key={subject.id} className="transition hover:bg-blue-50/50 dark:hover:bg-slate-800/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-sky-300"><BookOpen size={16} /></span><span className="font-semibold text-slate-900 dark:text-white">{subject.name}</span></div></td><td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">{subject.code || '—'}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />{active ? 'Aktif' : 'Nonaktif'}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-1.5"><button type="button" onClick={() => edit(subject)} title="Edit mapel" className="rounded-lg p-2 text-blue-700 hover:bg-blue-100 dark:text-sky-300 dark:hover:bg-slate-700"><Pencil size={15} /></button><button type="button" onClick={() => toggleStatus(subject)} title={active ? 'Nonaktifkan' : 'Aktifkan'} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"><Power size={15} /></button><button type="button" onClick={() => deleteSubject(subject)} disabled={deletingId === subject.id} title="Hapus mapel" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/40">{deletingId === subject.id ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}</button></div></td></tr>; })}</tbody></table></div>}
      </section>

      {modalOpen && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#071226]/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="subject-modal-title">
        <form onSubmit={submit} className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-blue-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between border-b border-slate-100 bg-blue-50/70 p-5 dark:border-slate-800 dark:bg-slate-950"><div><h2 id="subject-modal-title" className="font-bold text-slate-900 dark:text-white">{editingId ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}</h2><p className="mt-1 text-xs text-slate-500">Lengkapi identitas mata pelajaran di bawah ini.</p></div><button type="button" onClick={closeModal} disabled={saving} className="rounded-lg p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-800" aria-label="Tutup"><X size={17} /></button></div>
          <div className="space-y-4 p-5"><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Nama mata pelajaran *<input required maxLength={100} autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass} placeholder="Contoh: Matematika" /></label><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Kode mapel (opsional)<input maxLength={30} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className={fieldClass} placeholder="Contoh: MTK-01" /></label></div>
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><button type="button" onClick={closeModal} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Batal</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-950 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-60">{saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{saving ? 'Menyimpan…' : 'Simpan Mapel'}</button></div>
        </form>
      </div>}
    </div>
  );
}
