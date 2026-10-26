import React, { useEffect, useState } from 'react';
import { Plus, Power, KeyRound, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

const currentYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
};

const initialForm = () => ({
  teacher_id: '', division_id: '', subject_id: '',
  academic_year: currentYear(), semester: '1'
});

export default function TeachingAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [teacherAccounts, setTeacherAccounts] = useState([]);
  const [accountForm, setAccountForm] = useState({ member_id: '', username: '', password: '' });
  const [accountSaving, setAccountSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [a, m, d, s] = await Promise.all([
        api.get('/teaching-assignments'),
        api.get('/members'),
        api.get('/divisions'),
        api.get('/subjects')
      ]);
      const list = value => Array.isArray(value) ? value : value?.data || [];
      setAssignments(list(a.data));
      setTeachers(list(m.data).filter(x => ['guru', 'tendik', 'staff', 'staf', 'pegawai', 'karyawan', 'wali kelas', 'wali_kelas', 'walikelas', 'penanggung jawab', 'penanggung_jawab', 'koordinator'].includes(String(x.role || '').trim().toLowerCase())));
      setDivisions(list(d.data));
      setSubjects(list(s.data).filter(x => Number(x.is_active) === 1));
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat data penugasan. Pastikan API dan database sudah siap.');
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherAccounts = async () => {
    try {
      const res = await api.get('/teacher-accounts');
      setTeacherAccounts(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat akun login guru.');
    }
  };

  useEffect(() => { load(); loadTeacherAccounts(); }, []);

  useEffect(() => {
    if (!accountForm.member_id && teachers.length) {
      setAccountForm(prev => ({ ...prev, member_id: String(teachers[0].id) }));
    }
  }, [teachers, accountForm.member_id]);

  useEffect(() => {
    if (!accountForm.member_id) return;
    const existing = teacherAccounts.find(item => String(item.member_id) === String(accountForm.member_id));
    setAccountForm(prev => ({ ...prev, username: existing?.username || '', password: '' }));
  }, [accountForm.member_id, teacherAccounts]);

  const saveTeacherAccount = async (event) => {
    event.preventDefault();
    setAccountSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await api.put(`/teacher-accounts/${accountForm.member_id}`, {
        username: accountForm.username,
        password: accountForm.password
      });
      setNotice(response.data?.message || 'Akun guru berhasil disimpan.');
      setAccountForm(prev => ({ ...prev, password: '' }));
      await loadTeacherAccounts();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan akun guru.');
    } finally {
      setAccountSaving(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.post('/teaching-assignments', {
        ...form,
        teacher_id: Number(form.teacher_id),
        division_id: Number(form.division_id),
        subject_id: Number(form.subject_id),
        semester: Number(form.semester)
      });
      setNotice('Penugasan guru berhasil ditambahkan.');
      setForm(initialForm());
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan penugasan guru.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async item => {
    setError('');
    setNotice('');
    try {
      await api.patch(`/teaching-assignments/${item.id}/status`, {
        is_active: Number(item.is_active) === 1 ? 0 : 1
      });
      setNotice('Status penugasan diperbarui.');
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal mengubah status penugasan.');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Penugasan Guru</h1>
          <p className="mt-1 text-sm text-slate-500">Satu guru dapat mengajar beberapa kelas dan mata pelajaran.</p>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}

      <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-xl bg-sky-100 p-2 text-sky-800 dark:bg-sky-950 dark:text-sky-300"><KeyRound size={19} /></span>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Akun Login Guru</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Buat akun di aplikasi, lalu sinkronkan ke portal.</p>
          </div>
        </div>
        {teachers.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800">Tambahkan data guru terlebih dahulu.</p> : (
          <form onSubmit={saveTeacherAccount} className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Guru
              <select required value={accountForm.member_id} onChange={e => setAccountForm(prev => ({ ...prev, member_id: e.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Username
              <input required minLength={3} maxLength={80} value={accountForm.username} onChange={e => setAccountForm(prev => ({ ...prev, username: e.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="username.guru" />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kata sandi {teacherAccounts.some(item => String(item.member_id) === String(accountForm.member_id)) ? '(opsional)' : '*'}
              <input type="password" minLength={8} maxLength={200} required={!teacherAccounts.some(item => String(item.member_id) === String(accountForm.member_id))} value={accountForm.password} onChange={e => setAccountForm(prev => ({ ...prev, password: e.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Minimal 8 karakter" />
            </label>
            <div className="md:col-span-3 flex flex-wrap items-center gap-3">
              <button disabled={accountSaving} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:opacity-50 dark:bg-sky-700 dark:hover:bg-sky-600"><ShieldCheck size={16} /> {accountSaving ? 'Menyimpan…' : 'Simpan Akun Guru'}</button>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Kata sandi disimpan sebagai hash aman.</span>
            </div>
          </form>
        )}
      </section>

      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-3">
        <label className="text-sm font-medium">Guru *
          <select required value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })} className="mt-1 block w-full rounded-lg border bg-transparent px-3 py-2 font-normal">
            <option value="">Pilih guru</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Kelas *
          <select required value={form.division_id} onChange={e => setForm({ ...form, division_id: e.target.value })} className="mt-1 block w-full rounded-lg border bg-transparent px-3 py-2 font-normal">
            <option value="">Pilih kelas</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Mata pelajaran *
          <select required value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} className="mt-1 block w-full rounded-lg border bg-transparent px-3 py-2 font-normal">
            <option value="">Pilih mata pelajaran</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Tahun ajaran *
          <input required maxLength={20} value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} placeholder="2026/2027" className="mt-1 block w-full rounded-lg border bg-transparent px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium">Semester *
          <select required value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} className="mt-1 block w-full rounded-lg border bg-transparent px-3 py-2 font-normal">
            <option value="1">Semester 1</option><option value="2">Semester 2</option>
          </select>
        </label>
        <div className="flex items-end">
          <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-white disabled:opacity-50"><Plus size={16} /> {saving ? 'Menyimpan…' : 'Tambah penugasan'}</button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr><th className="p-3">Guru</th><th className="p-3">Kelas</th><th className="p-3">Mata pelajaran</th><th className="p-3">Tahun ajaran</th><th className="p-3">Semester</th><th className="p-3">Status</th><th className="p-3">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? <tr><td colSpan="7" className="p-5 text-center">Memuat data…</td></tr> :
             assignments.length === 0 ? <tr><td colSpan="7" className="p-5 text-center text-slate-500">Belum ada penugasan guru.</td></tr> :
             assignments.map(item => (
              <tr key={item.id}>
                <td className="p-3 font-medium">{item.teacher_name || `ID ${item.teacher_id}`}</td>
                <td className="p-3">{item.division_name || `ID ${item.division_id}`}</td>
                <td className="p-3">{item.subject_name || `ID ${item.subject_id}`}</td>
                <td className="p-3">{item.academic_year}</td>
                <td className="p-3">{item.semester}</td>
                <td className="p-3">{Number(item.is_active) === 1 ? 'Aktif' : 'Nonaktif'}</td>
                <td className="p-3"><button title="Ubah status" onClick={() => toggleStatus(item)} className="rounded-md border p-2"><Power size={15} /></button></td>
              </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
