import React, { useCallback, useEffect, useState, useRef } from 'react';
import { CalendarDays, Clock, Pencil, Power, Plus, RefreshCw, X, Download, Upload, FileSpreadsheet } from 'lucide-react';
import api from '../api/axios';
import Swal from 'sweetalert2';

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
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fileInputRef = useRef(null);

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

  // Unduh Template Excel (.xlsx)
  const downloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx-js-style");

      const templateData = [
        ['Kelas', 'Hari', 'Mata Pelajaran', 'Nama Guru', 'Waktu Mulai', 'Waktu Selesai'],
        ['X-RPL 1', 'Senin', 'Pemrograman Web', 'Budi Santoso', '07:00', '08:30'],
        ['X-RPL 1', 'Senin', 'Basis Data', 'Siti Aminah', '08:30', '10:00'],
        ['XI-TKJ 2', 'Selasa', 'Administrasi Jaringan', 'Ahmad Dani', '07:30', '09:00']
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateData);

      // Styling Header
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[cell]) {
          ws[cell].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2563EB" } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }
      }

      ws['!cols'] = [
        { wch: 18 },
        { wch: 12 },
        { wch: 25 },
        { wch: 25 },
        { wch: 14 },
        { wch: 14 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template Jadwal');
      XLSX.writeFile(wb, 'Template_Import_Jadwal.xlsx');
    } catch (e) {
      Swal.fire('Error', 'Gagal membuat template Excel: ' + e.message, 'error');
    }
  };

  // Import File Excel (.xlsx) dengan Auto-Create Mapel & Kelas
  const handleExcelUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    Swal.fire({
      title: 'Memproses Import...',
      text: 'Membaca dan memvalidasi berkas jadwal...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const XLSX = await import("xlsx-js-style");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('Berkas Excel kosong atau tidak memiliki data.');
      }

      // Ambil data terbaru untuk sinkronisasi ID
      const [membersRes, divRes, subjRes] = await Promise.all([
        api.get('/members'),
        api.get('/divisions'),
        api.get('/subjects')
      ]);

      const membersList = rowsOf(membersRes);
      let currentDivisions = rowsOf(divRes);
      let currentSubjects = rowsOf(subjRes);
      const currentTeachers = membersList.filter(item =>
        String(item.role || item.role_name || '').toLowerCase() === 'guru'
      );

      const academic = currentAcademicContext();
      let createdCount = 0;
      let newSubjectsCount = 0;
      let newDivisionsCount = 0;
      const errors = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNum = i + 2;

        const className = String(row['Kelas'] || row['kelas'] || row['Nama Kelas'] || '').trim();
        let day = String(row['Hari'] || row['hari'] || '').trim();
        const subjName = String(row['Mata Pelajaran'] || row['mata_pelajaran'] || row['Mapel'] || '').trim();
        const teacherName = String(row['Nama Guru'] || row['nama_guru'] || row['Guru'] || '').trim();
        let start = String(row['Waktu Mulai'] || row['start_time'] || '').trim();
        let end = String(row['Waktu Selesai'] || row['end_time'] || '').trim();

        if (!className || !subjName || !teacherName) {
          errors.push(`Baris ${rowNum}: Kelas, Mata Pelajaran, atau Guru kosong.`);
          continue;
        }

        // Normalisasi format waktu jika hanya 1 angka / desimal Excel
        if (start.length === 4 && start.includes(':')) start = '0' + start;
        if (end.length === 4 && end.includes(':')) end = '0' + end;
        if (!start) start = '07:00';
        if (!end) end = '08:00';

        // Normalisasi hari
        day = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
        if (!DAYS.includes(day)) {
          day = 'Senin';
        }

        // 1. Resolve / Auto-create Kelas
        let div = currentDivisions.find(d =>
          divisionName(d).toLowerCase() === className.toLowerCase()
        );
        if (!div) {
          try {
            await api.post('/divisions', { name: className });
            const refreshDiv = await api.get('/divisions');
            currentDivisions = rowsOf(refreshDiv);
            div = currentDivisions.find(d =>
              divisionName(d).toLowerCase() === className.toLowerCase()
            );
            newDivisionsCount++;
          } catch (eDiv) {
            errors.push(`Baris ${rowNum}: Gagal membuat kelas "${className}" (${eDiv.message})`);
            continue;
          }
        }

        // 2. Resolve / Auto-create Mata Pelajaran
        let subj = currentSubjects.find(s =>
          subjectName(s).toLowerCase() === subjName.toLowerCase()
        );
        if (!subj) {
          try {
            await api.post('/subjects', { name: subjName });
            const refreshSubj = await api.get('/subjects');
            currentSubjects = rowsOf(refreshSubj);
            subj = currentSubjects.find(s =>
              subjectName(s).toLowerCase() === subjName.toLowerCase()
            );
            newSubjectsCount++;
          } catch (eSubj) {
            errors.push(`Baris ${rowNum}: Gagal membuat mapel "${subjName}" (${eSubj.message})`);
            continue;
          }
        }

        // 3. Resolve Guru
        let teacher = currentTeachers.find(t =>
          nameOf(t).toLowerCase() === teacherName.toLowerCase() ||
          String(t.identity_number || '').trim() === teacherName
        );

        if (!teacher) {
          // Cari apakah nama guru terdaftar di anggota umum
          teacher = membersList.find(m =>
            nameOf(m).toLowerCase() === teacherName.toLowerCase()
          );
        }

        if (!teacher) {
          errors.push(`Baris ${rowNum}: Guru "${teacherName}" belum terdaftar di data Guru.`);
          continue;
        }

        // 4. Create Schedule
        try {
          await api.post('/teaching-schedules', {
            teacher_id: Number(teacher.id),
            division_id: Number(div.id),
            subject_id: Number(subj.id),
            academic_year: academic.academic_year,
            semester: academic.semester,
            day_of_week: day,
            start_time: start,
            end_time: end,
          });
          createdCount++;
        } catch (eSched) {
          errors.push(`Baris ${rowNum}: ${eSched.response?.data?.message || eSched.message}`);
        }
      }

      await loadData();

      let summaryHtml = `<b>${createdCount}</b> jadwal berhasil ditambahkan.`;
      if (newSubjectsCount > 0) summaryHtml += `<br/>• Otomatis menambah <b>${newSubjectsCount}</b> mapel baru.`;
      if (newDivisionsCount > 0) summaryHtml += `<br/>• Otomatis menambah <b>${newDivisionsCount}</b> kelas baru.`;
      if (errors.length > 0) {
        summaryHtml += `<br/><br/><div style="max-height:120px; overflow-y:auto; text-align:left; font-size:11px; background:#fef2f2; color:#991b1b; padding:8px; border-radius:8px;">${errors.slice(0, 5).join('<br/>')}${errors.length > 5 ? `<br/>...dan ${errors.length - 5} kesalahan lainnya` : ''}</div>`;
      }

      Swal.fire({
        icon: createdCount > 0 ? 'success' : 'warning',
        title: 'Hasil Import Jadwal',
        html: summaryHtml,
        confirmButtonColor: '#2563EB'
      });

    } catch (err) {
      Swal.fire('Import Gagal', err.message || 'Terjadi kesalahan saat mengolah berkas Excel.', 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fieldClass =
    'w-full rounded-lg border bg-transparent p-2.5 dark:border-gray-600';

  return (
    <div className="space-y-6 p-4 md:p-6 font-['Poppins']">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Jadwal Pembelajaran</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola jadwal pelajaran mingguan per kelas dan penugasan guru.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelUpload}
            accept=".xlsx, .xls"
            className="hidden"
          />

          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700 shadow-sm transition-colors cursor-pointer"
            title="Download Template Format Excel"
          >
            <Download size={15} className="text-blue-600" />
            <span>Download Template (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            title="Import Jadwal dari Excel"
          >
            <Upload size={15} />
            <span>{importing ? 'Mengimpor...' : 'Import Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Muat ulang</span>
          </button>
        </div>
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

      <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-5">
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-800 dark:text-white">1. Pilih Kelas</span>
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
          <span className="text-sm font-semibold text-slate-800 dark:text-white">2. Pilih Hari</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {DAYS.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                aria-pressed={selectedDay === day}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                  selectedDay === day
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-300'
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Jadwal {selectedClassInfo ? divisionName(selectedClassInfo) : 'Kelas'}
            </h2>
            <p className="text-xs text-gray-500">
              Hari {selectedDay} · {visibleSchedules.length} jadwal pelajaran
            </p>
          </div>

          <button
            type="button"
            disabled={!selectedClass || loading}
            onClick={openAddForm}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm cursor-pointer"
          >
            <Plus size={16} /> Tambah Jadwal Manual
          </button>
        </div>

        {formOpen && (
          <form
            onSubmit={save}
            className="space-y-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-900 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {editingId ? 'Edit Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran'}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedClassInfo ? divisionName(selectedClassInfo) : 'Kelas'} · {selectedDay}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                aria-label="Tutup formulir"
                className="rounded-lg border p-1.5 text-slate-400 hover:text-slate-700 dark:border-gray-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Guru Pengajar</span>
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

              <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Mata Pelajaran</span>
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

              <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Waktu Mulai</span>
                <input
                  required
                  type="time"
                  value={form.start_time}
                  onChange={event => setForm({ ...form, start_time: event.target.value })}
                  className={fieldClass}
                />
              </label>

              <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Waktu Selesai</span>
                <input
                  required
                  type="time"
                  value={form.end_time}
                  onChange={event => setForm({ ...form, end_time: event.target.value })}
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={saving || loading}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Jadwal'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border px-4 py-2.5 text-xs font-semibold text-slate-700 dark:border-gray-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="p-4 text-sm text-gray-500">Memuat jadwal...</p>
        ) : !selectedClass ? (
          <div className="rounded-2xl border p-8 text-center text-sm text-gray-500 bg-white dark:bg-slate-900">
            Pilih kelas untuk melihat jadwal.
          </div>
        ) : visibleSchedules.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center text-sm text-gray-500 bg-white dark:bg-slate-900">
            <CalendarDays size={28} className="mx-auto mb-2 opacity-50 text-blue-500" />
            Belum ada jadwal untuk {divisionName(selectedClassInfo || { id: selectedClass })} pada hari {selectedDay}.
            <p className="mt-2 text-xs text-slate-400">Tekan "Tambah Jadwal Manual" atau "Import Excel (.xlsx)" untuk mengisi jadwal.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-stone-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-3.5">Waktu</th>
                  <th className="p-3.5">Mata Pelajaran</th>
                  <th className="p-3.5">Guru</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-slate-800 text-xs">
                {visibleSchedules.map(item => (
                  <tr key={item.id} className="hover:bg-stone-50/50 dark:hover:bg-slate-800/50">
                    <td className="p-3.5 font-bold tabular-nums text-slate-800 dark:text-white">
                      {String(item.start_time).slice(0, 5)} - {String(item.end_time).slice(0, 5)} WIB
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800 dark:text-white">
                      {item.subject_name || subjectName(item)}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">
                      {item.teacher_name || nameOf(item)}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        Number(item.is_active) === 1
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}>
                        {Number(item.is_active) === 1 ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => edit(item)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-blue-600 hover:bg-slate-50 cursor-pointer"
                          title="Edit Jadwal"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(item)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-amber-600 hover:bg-slate-50 cursor-pointer"
                          title="Ubah Status"
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
