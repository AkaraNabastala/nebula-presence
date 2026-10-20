
import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import * as XLSX from 'xlsx-js-style';
import { Download, ClipboardList, BookOpen, RefreshCw } from 'lucide-react';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const monthRange = (month) => ({
  start_date: `${month}-01`,
  end_date: `${month}-${new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0
  ).getDate()}`
});

const PresensiEkskul = () => {
  const [tab, setTab] = useState('attendance');
  const [extracurriculars, setExtracurriculars] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [month, setMonth] = useState(getCurrentMonth());
  const [attendance, setAttendance] = useState([]);
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/extracurriculars')
      .then(res => {
        const list = res.data?.data || [];
        setExtracurriculars(list);
        if (list.length) setSelectedId(String(list[0].id));
      })
      .catch(() => setError('Gagal memuat daftar ekskul.'));
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const range = monthRange(month);
      const params = {
        extracurricular_id: selectedId || undefined,
        ...range
      };

      const [attendanceRes, journalsRes] = await Promise.all([
        selectedId
          ? api.get('/extracurriculars/attendance', { params })
          : Promise.resolve({ data: { data: [] } }),
        api.get('/extracurriculars/journals', { params })
      ]);

      setAttendance(attendanceRes.data?.data || []);
      setJournals(journalsRes.data?.data || []);
    } catch {
      setError('Gagal memuat data laporan. Silakan muat ulang.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (month) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, selectedId]);

  const styleHeader = (worksheet, headers, rows) => {
    worksheet['!cols'] = headers.map((header, index) => ({
      wch: Math.min(40, Math.max(
        header.length + 3,
        ...rows.map(row => String(row[index] ?? '').length + 2),
        12
      ))
    }));

    headers.forEach((_, col) => {
      const cell = XLSX.utils.encode_cell({ r: 0, c: col });
      if (worksheet[cell]) {
        worksheet[cell].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '166534' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    });
  };

  const exportMonthlyReport = () => {
    const attendanceHeaders = [
      'Tanggal', 'Ekskul', 'Nomor Identitas', 'Nama Peserta', 'Status', 'Catatan'
    ];
    const journalHeaders = [
      'Tanggal', 'Ekskul', 'Jam Mulai', 'Jam Selesai',
      'Topik', 'Deskripsi Kegiatan', 'Jumlah Hadir', 'Catatan'
    ];

    const attendanceRows = attendance.map(row => [
      row.attendance_date,
      row.extracurricular_name || '-',
      row.identity_number || '-',
      row.full_name || '-',
      row.status || '-',
      row.notes || '-'
    ]);

    const journalRows = journals.map(row => [
      row.activity_date,
      row.extracurricular_name || '-',
      row.start_time || '-',
      row.end_time || '-',
      row.topic || '-',
      row.activity_description || '-',
      row.attendance_count ?? 0,
      row.notes || '-'
    ]);

    if (!attendanceRows.length && !journalRows.length) {
      window.alert('Tidak ada data kehadiran maupun jurnal pada bulan ini.');
      return;
    }

    const workbook = XLSX.utils.book_new();

    const attendanceData = [attendanceHeaders, ...attendanceRows];
    const attendanceSheet = XLSX.utils.aoa_to_sheet(attendanceData);
    styleHeader(attendanceSheet, attendanceHeaders, attendanceRows);
    XLSX.utils.book_append_sheet(workbook, attendanceSheet, 'Kehadiran');

    const journalData = [journalHeaders, ...journalRows];
    const journalSheet = XLSX.utils.aoa_to_sheet(journalData);
    styleHeader(journalSheet, journalHeaders, journalRows);
    XLSX.utils.book_append_sheet(workbook, journalSheet, 'Jurnal Kegiatan');

    XLSX.writeFile(workbook, `Laporan_Ekskul_${month}.xlsx`);
  };

  const selectedName = extracurriculars.find(
    item => String(item.id) === String(selectedId)
  )?.name || 'Semua ekskul';

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Presensi Ekskul</h1>
        <p className="text-sm text-gray-500 mt-1">
          Lihat data bulanan dan unduh satu laporan dengan dua sheet Excel.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm space-y-1">
            <span>Bulan Laporan</span>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full border rounded-lg p-2.5 bg-transparent"
            />
          </label>

          <label className="text-sm space-y-1">
            <span>Ekstrakurikuler</span>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full border rounded-lg p-2.5 bg-transparent"
            >
              <option value="">Semua ekskul</option>
              {extracurriculars.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2 flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center gap-2"
            >
              <RefreshCw size={16} /> Muat Ulang
            </button>
            <button
              onClick={exportMonthlyReport}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white flex items-center gap-2"
            >
              <Download size={16} /> Unduh Laporan Bulanan
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('attendance')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            tab === 'attendance'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          <ClipboardList size={18} /> Daftar Kehadiran
        </button>
        <button
          onClick={() => setTab('journals')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            tab === 'journals'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          <BookOpen size={18} /> Jurnal Kegiatan
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-center">Memuat data...</p>
        ) : tab === 'attendance' ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                {['Tanggal', 'Nama Peserta', 'Nomor Identitas', 'Ekskul', 'Status', 'Catatan'].map(label => (
                  <th key={label} className="p-3 text-left">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendance.map(row => (
                <tr key={row.id} className="border-t dark:border-slate-700">
                  <td className="p-3">{row.attendance_date}</td>
                  <td className="p-3">{row.full_name}</td>
                  <td className="p-3">{row.identity_number || '-'}</td>
                  <td className="p-3">{row.extracurricular_name || selectedName}</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3">{row.notes || '-'}</td>
                </tr>
              ))}
              {!attendance.length && (
                <tr><td colSpan="6" className="p-6 text-center text-gray-500">
                  Belum ada data kehadiran pada bulan ini.
                </td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                {['Tanggal', 'Ekskul', 'Topik', 'Jam', 'Jumlah Hadir', 'Catatan'].map(label => (
                  <th key={label} className="p-3 text-left">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {journals.map(row => (
                <tr key={row.id} className="border-t dark:border-slate-700">
                  <td className="p-3">{row.activity_date}</td>
                  <td className="p-3">{row.extracurricular_name}</td>
                  <td className="p-3">{row.topic}</td>
                  <td className="p-3">
                    {[row.start_time, row.end_time].filter(Boolean).join(' - ') || '-'}
                  </td>
                  <td className="p-3">{row.attendance_count ?? 0}</td>
                  <td className="p-3">{row.notes || '-'}</td>
                </tr>
              ))}
              {!journals.length && (
                <tr><td colSpan="6" className="p-6 text-center text-gray-500">
                  Belum ada jurnal pada bulan ini.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PresensiEkskul;
