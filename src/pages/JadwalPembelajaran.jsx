import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Clock, Pencil, Power, Plus, RefreshCw, X } from 'lucide-react';
import api from '../api/axios';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const EMPTY = {
  teacher_id: '',
  subject_id: '',
  start_time: '07:00',
  end_time: '08:00',
};

function rowsOf(value) {
  const result = value?.data ?? value;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.members)) return result.members;
  if (Array.isArray(result?.divisions)) return result.divisions;
  if (Array.isArray(result?.subjects)) return result.subjects;
  return [];
}

function errorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Terjadi kesalahan.';
}

function nameOf(item) {
  return item.full_name || item.name || item.nama || item.username || `#${item.id}`;
}

function divisionName(item) {
  return item.name || item.division_name || item.nama || `Kelas #${item.id}`;
}

function subjectName(item) {
  return item.subject_name || item.name || item.nama || item.title || `Mapel #${item.id}`;
}

// Konteks tahun ajaran default mengikuti kalender sekolah Juli–Juni.
// Nantinya nilai ini sebaiknya berasal dari Pengaturan sekolah.
function currentAcademicContext() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  return {
    academic_year: `${startYear}/${startYear + 1}`,
    semester: month >= 7 && month <= 12 ? 1 : 2,
  };
}

export default function TeachingSchedules() {
  const [teachers, setTeachers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [schedules, setSchedules] = useState([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDay, setSelectedDay] = useState('Senin');

  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [memberResponse, divisionResponse, subjectResponse, scheduleResponse] =
        await Promise.all([
          api.get('/members'),
          api.get('/divisions'),
          api.get('/subjects'),
          api.get('/teaching-schedules'),
        ]);

      const members = rowsOf(memberResponse);
      setTeachers(
        members.filter(item =>
          String(item.role || item.role_name || '').toLowerCase() === 'guru'
        )
      );

      const classRows = rowsOf(divisionResponse);
      setDivisions(classRows);

      setSubjects(
        rowsOf(subjectResponse).filter(item =>
          item.is_active === undefined || Number(item.is_active) === 1
        )
      );

      setSchedules(rowsOf(scheduleResponse));

      if (!selectedClass && classRows.length) {
        setSelectedClass(String(classRows[0].id));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedClassInfo = divisions.find(
    item => String(item.id) === String(selectedClass)
  );

  const visibleSchedules = schedules
    .filter(item =>
      String(item.division_id) === String(selectedClass) &&
      item.day_of_week === selectedDay
    )
    .sort((a, b) =>
      String(a.start_time).localeCompare(String(b.start_time))
    );

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
    setFormOpen(false);
    setError('');
  };

  const openAddForm = () => {
    setForm(EMPTY);
    setEditingId(null);
    setError('');
    setNotice('');
    setFormOpen(true);
  };

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (!selectedClass) {
        throw new Error('Pilih kelas terlebih dahulu.');
      }
      if (!selectedDay || !form.teacher_id || !form.subject_id) {
        throw new Error('Pilih guru dan mata pelajaran.');
      }
      if (form.start_time >= form.end_time) {
        throw new Error('Waktu selesai harus lebih akhir dari waktu mulai.');
      }

      const academic = currentAcademicContext();
      const payload = {
        teacher_id: Number(form.teacher_id),
        division_id: Number(selectedClass),
        subject_id: Number(form.subject_id),
        academic_year: academic.academic_year,
        semester: academic.semester,
        day_of_week: selectedDay,
        start_time: form.start_time,
        end_time: form.end_time,
      };

      if (editingId) {
        await api.put(`/teaching-schedules/${editingId}`, payload);
        setNotice('Jadwal berhasil diperbarui.');
      } else {
        await api.post('/teaching-schedules', payload);
        setNotice('Jadwal berhasil ditambahkan.');
      }

      setForm(EMPTY);
      setEditingId(null);
      setFormOpen(false);
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const edit = item => {
    setSelectedClass(String(item.division_id));
    setSelectedDay(DAYS.includes(item.day_of_week) ? item.day_of_week : 'Senin');

    setForm({
      teacher_id: String(item.teacher_id ?? ''),
      subject_id: String(item.subject_id ?? ''),
      start_time: String(item.start_time || '07:00').slice(0, 5),
      end_time: String(item.end_time || '08:00').slice(0, 5),
    });

    setEditingId(item.id);
    setFormOpen(true);
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleStatus = async item => {
    const nextStatus = Number(item.is_active) !== 1 ? 1 : 0;
    const action = nextStatus ? 'mengaktifkan' : 'menonaktifkan';

    if (!window.confirm(`Yakin ingin ${action} jadwal ini?`)) return;

    setError('');
    setNotice('');

    try {
      await api.patch(`/teaching-schedules/${item.id}/status`, {
        is_active: nextStatus,
      });
      setNotice(`Jadwal berhasil ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}.`);
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const fieldClass =
    'w-full rounded-lg border bg-transparent p-2.5 dark:border-gray-600';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Jadwal Mengajar</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pilih kelas dan hari untuk mengelola jadwal pelajaran.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-800"
        >
          <RefreshCw size={16} /> Muat ulang
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">
          {notice}
        </div>
      )}

      <section className="space-y-4 rounded-xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-5">
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">1. Pilih Kelas</span>
          <select
            value={selectedClass}
            onChange={event => setSelectedClass(event.target.value)}
            className={fieldClass}
            disabled={loading}
          >
            <option value="">Pilih kelas</option>
            {divisions.map(item => (
              <option key={item.id} value={item.id}>
                {divisionName(item)}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <span className="text-sm font-semibold">2. Pilih Hari</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {DAYS.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                aria-pressed={selectedDay === day}
                className={`rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                  selectedDay === day
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              Jadwal {selectedClassInfo ? divisionName(selectedClassInfo) : 'Kelas'}
            </h2>
            <p className="text-sm text-gray-500">
              Hari {selectedDay} · {visibleSchedules.length} jadwal
            </p>
          </div>

          <button
            type="button"
            disabled={!selectedClass || loading}
            onClick={openAddForm}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={17} /> Tambah Mata Pelajaran
          </button>
        </div>

        {formOpen && (
          <form
            onSubmit={save}
            className="space-y-4 rounded-xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900 dark:bg-gray-900 md:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {editingId ? 'Edit Jadwal' : 'Tambah Mata Pelajaran'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedClassInfo ? divisionName(selectedClassInfo) : 'Kelas'} · {selectedDay}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                aria-label="Tutup formulir"
                className="rounded-lg border p-2 dark:border-gray-700"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Guru</span>
                <select
                  required
                  value={form.teacher_id}
                  onChange={event => setForm({ ...form, teacher_id: event.target.value })}
                  className={fieldClass}
                >
                  <option value="">Pilih guru</option>
                  {teachers.map(item => (
                    <option key={item.id} value={item.id}>{nameOf(item)}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium">Mata Pelajaran</span>
                <select
                  required
                  value={form.subject_id}
                  onChange={event => setForm({ ...form, subject_id: event.target.value })}
                  className={fieldClass}
                >
                  <option value="">Pilih mata pelajaran</option>
                  {subjects.map(item => (
                    <option key={item.id} value={item.id}>{subjectName(item)}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium">Waktu Mulai</span>
                <input
                  required
                  type="time"
                  value={form.start_time}
                  onChange={event => setForm({ ...form, start_time: event.target.value })}
                  className={fieldClass}
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium">Waktu Selesai</span>
                <input
                  required
                  type="time"
                  value={form.end_time}
                  onChange={event => setForm({ ...form, end_time: event.target.value })}
                  className={fieldClass}
                />
              </label>
            </div>

            <p className="text-xs text-gray-500">
              Tahun pelajaran dan semester tidak diisi di sini. Saat ini nilainya
              mengikuti kalender Juli–Juni; integrasi dengan Pengaturan sekolah
              perlu disambungkan pada backend.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || loading}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Jadwal'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border px-4 py-2.5 text-sm dark:border-gray-700"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="p-4 text-sm text-gray-500">Memuat jadwal...</p>
        ) : !selectedClass ? (
          <div className="rounded-xl border p-8 text-center text-sm text-gray-500">
            Pilih kelas untuk melihat jadwal.
          </div>
        ) : visibleSchedules.length === 0 ? (
          <div className="rounded-xl border p-8 text-center text-sm text-gray-500">
            <CalendarDays size={28} className="mx-auto mb-2 opacity-50" />
            Belum ada jadwal untuk {divisionName(selectedClassInfo || { id: selectedClass })}
            pada hari {selectedDay}.
            <p className="mt-2">Tekan Tambah Mata Pelajaran untuk membuat jadwal.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Mata Pelajaran</th>
                  <th className="p-3">Guru</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visibleSchedules.map(item => {
                  const active = Number(item.is_active) === 1;
                  return (
                    <tr key={item.id} className="border-t dark:border-gray-700">
                      <td className="p-3">
                        <div className="flex items-center gap-1 font-medium">
                          <Clock size={15} />
                          {String(item.start_time).slice(0, 5)}–{String(item.end_time).slice(0, 5)}
                        </div>
                      </td>
                      <td className="p-3">{item.subject_name}</td>
                      <td className="p-3">{item.teacher_name}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-1 text-xs ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            title="Edit jadwal"
                            aria-label="Edit jadwal"
                            onClick={() => edit(item)}
                            className="rounded-lg border p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            title={active ? 'Nonaktifkan jadwal' : 'Aktifkan jadwal'}
                            aria-label={active ? 'Nonaktifkan jadwal' : 'Aktifkan jadwal'}
                            onClick={() => toggleStatus(item)}
                            className="rounded-lg border p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            <Power size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}