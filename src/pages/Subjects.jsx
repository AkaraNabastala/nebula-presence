import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Pencil, Power, Trash2 } from 'lucide-react';
import api from '../api/axios';

const emptyForm = { name: '', code: '' };

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/subjects');
      setSubjects(Array.isArray(response.data) ? response.data : response.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat mata pelajaran.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (editingId) {
        await api.put(`/subjects/${editingId}`, form);
        setNotice('Mata pelajaran berhasil diperbarui.');
      } else {
        await api.post('/subjects', form);
        setNotice('Mata pelajaran berhasil ditambahkan.');
      }
      reset();
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan mata pelajaran.');
    } finally {
      setSaving(false);
    }
  };

  const edit = (subject) => {
    setEditingId(subject.id);
    setForm({ name: subject.name || '', code: subject.code || '' });
    setNotice('');
    setError('');
  };

  const toggleStatus = async (subject) => {
    setError('');
    setNotice('');
    try {
      await api.patch(`/subjects/${subject.id}/status`, {
        is_active: Number(subject.is_active) === 1 ? 0 : 1
      });
      setNotice('Status mata pelajaran diperbarui.');
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal mengubah status.');
    }
  };

  const deleteSubject = async (subject) => {
    const confirmed = window.confirm(
      `Hapus mata pelajaran "${subject.name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    setError('');
    setNotice('');
    try {
      await api.delete(`/subjects/${subject.id}`);
      if (editingId === subject.id) reset();
      setNotice('Mata pelajaran berhasil dihapus.');
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menghapus mata pelajaran.');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Mata Pelajaran</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola daftar mata pelajaran untuk penugasan guru.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <RefreshCw size={16} /> Muat ulang
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}

      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[1fr_1fr_auto_auto]">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Nama mata pelajaran *
          <input required maxLength={100} value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Kode (opsional)
          <input maxLength={30} value={form.code}
            onChange={e => setForm({ ...form, code: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 font-normal" />
        </label>
        <button disabled={saving} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          <Plus size={16} /> {saving ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Tambah'}
        </button>
        {editingId && <button type="button" onClick={reset} className="mt-auto rounded-lg border px-4 py-2">Batal</button>}
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr><th className="p-3">Nama</th><th className="p-3">Kode</th><th className="p-3">Status</th><th className="p-3">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? <tr><td colSpan="4" className="p-5 text-center">Memuat data…</td></tr> :
             subjects.length === 0 ? <tr><td colSpan="4" className="p-5 text-center text-slate-500">Belum ada mata pelajaran.</td></tr> :
             subjects.map(subject => (
              <tr key={subject.id}>
                <td className="p-3 font-medium">{subject.name}</td>
                <td className="p-3">{subject.code || '—'}</td>
                <td className="p-3">{Number(subject.is_active) === 1 ? 'Aktif' : 'Nonaktif'}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button title="Edit" onClick={() => edit(subject)} className="rounded-md border p-2"><Pencil size={15} /></button>
                    <button type="button" title="Ubah status" onClick={() => toggleStatus(subject)} className="rounded-md border p-2"><Power size={15} /></button>
                    <button type="button" title="Hapus mapel" onClick={() => deleteSubject(subject)} className="rounded-md border border-red-300 p-2 text-red-600 hover:bg-red-50" aria-label={`Hapus ${subject.name}`}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
