import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { FileText, Calendar, Filter, ChevronDown, Printer, Search, Building2, Download } from 'lucide-react';

// Import Logo Default
import logoDefault from '../../assets/logo-nabastala.png';

const Laporan = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [classes, setClasses] = useState([]);
  const API_URL = "http://localhost:6990/api";
  
  // Filter Data
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  
  const [appConfig, setAppConfig] = useState({ 
      timezone: 'Asia/Jakarta',
      nama_instansi: 'Instansi',
      alamat_instansi: 'Alamat Belum Diatur',
      logo_instansi: '',
      labels: { label_anggota: 'Anggota', label_unit: 'Divisi' }
  });

  useEffect(() => {
    const init = async () => {
        try {
            // Load Settings
            const resSet = await api.get('/settings');
            const tz = resSet.data.timezone || 'Asia/Jakarta';
            setAppConfig({ 
                timezone: tz,
                nama_instansi: resSet.data.nama_sekolah || resSet.data.nama_instansi || 'Instansi',
                alamat_instansi: resSet.data.alamat_sekolah || resSet.data.alamat_instansi || 'Alamat Instansi',
                logo_instansi: resSet.data.logo_sekolah || resSet.data.logo_instansi || '',
                labels: resSet.data.labels || { label_anggota: 'Anggota', label_unit: 'Divisi' }
            });

            // Set Default Date
            const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
            setStartDate(today);
            setEndDate(today);

            // Load Classes
            const resCls = await api.get('/divisions');
            setClasses(resCls.data);
        } catch(e) {
            console.error("Gagal inisialisasi laporan", e);
        }
    };
    init();
  }, []);

  const handleFilter = async () => {
    setLoading(true);
    try {
        const res = await api.get(`/attendance/report`, {
            params: { start_date: startDate, end_date: endDate, kelas: selectedClass }
        });
        setReportData(res.data);
    } catch (error) { console.error("Gagal tarik laporan"); } 
    finally { setLoading(false); }
  };

  // 2. Perbaiki fungsi format jam agar lebih rapi (Surgical Fix)
  const formatTime = (t) => {
      if (!t) return '-';
      // Jika formatnya ISO String (ada huruf T atau -), potong ke jam lokal
      if (t.includes('T') || t.includes('-')) {
          return new Date(t).toLocaleTimeString('id-ID', { 
              hour: '2-digit', minute: '2-digit', hour12: false 
          }).replace('.', ':');
      }
      return t.slice(0, 5); // Ambil 5 karakter awal saja (00:00)
  };

  // Helper untuk Tanggal Indonesia di Surat
  const getIndonesianDate = () => {
      const date = new Date();
      return date.toLocaleDateString('id-ID', {
          timeZone: appConfig.timezone,
          day: 'numeric', month: 'long', year: 'numeric'
      });
  };

  return (
    <div className="space-y-6 pb-24 md:pb-10 font-sans">
      
      {/* =================================================================================
          1. SCREEN VIEW (TAMPILAN LAYAR - MODERN & RESPONSIVE)
          Akan disembunyikan saat print menggunakan class 'print:hidden'
      ================================================================================= */}
      <div className="print:hidden space-y-6">
          
          {/* HEADER CARD */}
          <div className="relative bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

            <div className="relative z-10">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="text-blue-600" size={28}/> Laporan Kehadiran
                </h2>
                <p className="text-sm text-gray-500 mt-1">Rekapitulasi data masuk & pulang anggota.</p>
            </div>
            
            <div className="relative z-10 w-full md:w-auto">
                <button onClick={() => window.print()} className="w-full md:w-auto flex justify-center items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all shadow-lg active:scale-95">
                    <Printer size={18}/> <span>Cetak Laporan</span>
                </button>
            </div>
          </div>

          {/* FILTER SECTION */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:flex-1 grid grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 mb-1.5 block flex items-center gap-1">
                        <Calendar size={12}/> Dari Tanggal
                    </label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold bg-gray-50 focus:bg-white transition-all cursor-pointer"/>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 mb-1.5 block flex items-center gap-1">
                        <Calendar size={12}/> Sampai Tanggal
                    </label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold bg-gray-50 focus:bg-white transition-all cursor-pointer"/>
                </div>
            </div>
            <div className="w-full md:w-64">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 mb-1.5 block flex items-center gap-1">
                    <Building2 size={12}/> {appConfig.labels?.label_unit || 'Divisi / Kelas'}
                </label>
                <div className="relative">
                    <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold bg-white appearance-none cursor-pointer hover:border-blue-300 transition-all">
                        <option value="">Semua {appConfig.labels?.label_unit || 'Divisi / Kelas'}</option>
                        {classes.map(c => <option key={c.id} value={c.nama_kelas}>{c.nama_kelas}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16}/>
                </div>
            </div>
            <button onClick={handleFilter} className="w-full md:w-auto px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-200 transition-all active:scale-95 flex justify-center items-center gap-2">
                <Filter size={16}/> Tampilkan
            </button>
          </div>

          {/* TABLE PREVIEW (SCREEN) */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
            <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-widest border-b">
                        <tr>
                            <th className="p-5 text-center w-16">No</th>
                            <th className="p-5">Tanggal</th>
                            <th className="p-5">Nama {appConfig.labels?.label_anggota || 'Anggota'}</th>
                            <th className="p-5">{appConfig.labels?.label_unit || 'Divisi / Kelas'}</th>
                            <th className="p-5 text-center">Masuk</th>
                            <th className="p-5 text-center">Pulang</th>
                            <th className="p-5 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan="7" className="p-10 text-center text-gray-400">Memuat data...</td></tr>
                        ) : reportData.length === 0 ? (
                            <tr><td colSpan="7" className="p-16 text-center text-gray-400">Tidak ada data ditemukan</td></tr>
                        ) : (
                            reportData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="p-5 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                                    <td className="p-5 font-mono text-xs font-medium text-gray-600">
                                        {new Date(row.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </td>
                                    <td className="p-5 font-bold text-gray-800">{row.nama_lengkap}</td>
                                    <td className="p-5 text-xs"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-bold uppercase tracking-wide">{row.kelas}</span></td>
                                    <td className="p-5 text-center font-mono text-emerald-600 font-bold bg-emerald-50/10">{formatTime(row.scan_in)}</td>
                                    <td className="p-5 text-center font-mono text-blue-600 font-bold bg-blue-50/10">{formatTime(row.scan_out)}</td>
                                    <td className="p-5 text-center"><span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border bg-gray-50 border-gray-200">{row.status}</span></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
          </div>
      </div>

      {/* =================================================================================
          2. PRINT VIEW (TAMPILAN CETAK - KOP SURAT FORMAL)
          Hanya muncul saat print (class: hidden print:block)
      ================================================================================= */}
      <div id="printable-area" className="hidden print:block bg-white text-black p-0 m-0">
          
          {/* HEADER / KOP SURAT */}
          <div className="flex items-center justify-between border-b-4 border-double border-black pb-4 mb-6">
              <div className="w-[100px] h-[100px] flex items-center justify-center">
                  <img src={appConfig.logo_instansi || logoDefault} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 text-center px-4">
                  <h1 className="text-2xl font-bold uppercase tracking-wide mb-1">{appConfig.nama_instansi}</h1>
                  <p className="text-sm font-normal">{appConfig.alamat_instansi}</p>
                  <p className="text-xs italic mt-1 text-gray-600">Laporan Resmi Sistem Presensi Digital</p>
              </div>
              <div className="w-[100px]"></div> {/* Spacer agar teks tengah sempurna */}
          </div>

          {/* JUDUL LAPORAN */}
          <div className="text-center mb-6">
              <h2 className="text-xl font-bold underline decoration-2 underline-offset-4 uppercase">LAPORAN KEHADIRAN</h2>
              <div className="flex justify-center gap-8 mt-2 text-sm">
                  <p><strong>{appConfig.labels?.label_unit || 'Divisi/Kelas'}:</strong> {selectedClass || 'Semua'}</p>
                  <p><strong>Periode:</strong> {new Date(startDate).toLocaleDateString('id-ID')} s.d. {new Date(endDate).toLocaleDateString('id-ID')}</p>
              </div>
          </div>

          {/* TABEL FORMAL (HITAM PUTIH) */}
          <div className="w-full border border-black mb-8">
              <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 border-b border-black">
                      <tr>
                          <th className="p-2 border-r border-black text-center w-10">No</th>
                          <th className="p-2 border-r border-black w-32">Tanggal</th>
                          <th className="p-2 border-r border-black">Nama {appConfig.labels?.label_anggota || 'Anggota'}</th>
                          <th className="p-2 border-r border-black w-32">ID/NIP</th>
                          <th className="p-2 border-r border-black text-center w-24">Masuk</th>
                          <th className="p-2 border-r border-black text-center w-24">Pulang</th>
                          <th className="p-2 text-center w-24">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-black">
                      {reportData.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-300">
                              <td className="p-2 border-r border-black text-center">{idx + 1}</td>
                              <td className="p-2 border-r border-black">{new Date(row.tanggal).toLocaleDateString('id-ID')}</td>
                              <td className="p-2 border-r border-black font-bold">{row.nama_lengkap}</td>
                              <td className="p-2 border-r border-black font-mono text-xs">{row.nisn || row.nipd}</td>
                              <td className="p-2 border-r border-black text-center">{formatTime(row.scan_in)}</td>
                              <td className="p-2 border-r border-black text-center">{formatTime(row.scan_out)}</td>
                              <td className="p-2 text-center font-bold text-xs">{row.status}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>

          {/* AREA TANDA TANGAN (SIGNATURE) */}
          <div className="flex justify-end mt-12 pr-10 page-break-inside-avoid">
              <div className="text-center">
                  <p className="mb-1">Jakarta, {getIndonesianDate()}</p>
                  <p className="font-bold mb-20">Mengetahui,</p>
                  <p className="font-bold underline text-black">__________________________</p>
                  <p className="text-xs mt-1">Penanggung Jawab / HRD</p>
              </div>
          </div>

      </div>

      {/* CSS KHUSUS PRINT */}
      <style>{`
          @media print {
              /* Sembunyikan elemen layar */
              body * { visibility: hidden; }
              /* Tampilkan hanya area print */
              #printable-area, #printable-area * { visibility: visible; }
              /* Posisikan di pojok kiri atas */
              #printable-area { 
                  position: absolute; 
                  left: 0; 
                  top: 0; 
                  width: 100%; 
                  margin: 0; 
                  padding: 20px;
                  background-color: white;
                  color: black;
              }
              /* Pastikan background tabel tercetak jika user mengaktifkan 'background graphics' */
              .bg-gray-100 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
              /* Hindari tabel terpotong di tengah baris */
              tr { page-break-inside: avoid; }
          }
      `}</style>

    </div>
  );
};

export default Laporan;