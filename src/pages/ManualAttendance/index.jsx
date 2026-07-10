import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
    Calendar, Filter, Search, Clock, 
    CheckCircle, AlertCircle, XCircle, 
    UserCheck, ChevronDown, RefreshCcw, 
    HelpCircle, Activity, Building2, User
} from 'lucide-react';

const ManualAttendance = () => {
  // --- STATE ---
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Config State
  const [appConfig, setAppConfig] = useState({ timezone: 'Asia/Jakarta' });

  // Filter State
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(""); 

  // Stats
  const [stats, setStats] = useState({ total: 0, hadir: 0, terlambat: 0, sakit: 0, izin: 0, alfa: 0, belum: 0 });
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // --- 1. INISIALISASI ---
  useEffect(() => {
    const initPage = async () => {
        try {
            const resSettings = await api.get('/settings');
            const schoolTimezone = resSettings.data.timezone || 'Asia/Jakarta';
            setAppConfig({ timezone: schoolTimezone });

            const today = new Intl.DateTimeFormat('en-CA', {
                timeZone: schoolTimezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(new Date());
            
            setSelectedDate(today);

            const resClasses = await api.get('/divisions');
            setClasses(resClasses.data);
        } catch (e) {
            console.error("Gagal inisialisasi halaman", e);
        }
    };
    initPage();
  }, []);

  // --- 2. FETCH DATA ---
  useEffect(() => {
    if (selectedClass && selectedDate) {
      fetchDailyAttendance();
    } else {
      setStudents([]);
      resetStats();
    }
  }, [selectedClass, selectedDate]);

  // --- HELPER FORMAT JAM ---
  const formatTimeOnly = (timeString) => {
      if (!timeString) return '-';
      if (timeString.length > 8 && (timeString.includes('T') || timeString.includes('-'))) {
          return new Date(timeString).toLocaleTimeString('id-ID', { 
              timeZone: appConfig.timezone, 
              hour: '2-digit', 
              minute: '2-digit', 
              hour12: false 
          }).replace('.', ':');
      }
      return timeString.slice(0, 5);
  };

  const showToast = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  const calculateStats = (data) => {
      const newStats = { total: data.length, hadir: 0, terlambat: 0, sakit: 0, izin: 0, alfa: 0, belum: 0 };
      data.forEach(s => {
          if (s.status === 'HADIR') newStats.hadir++;
          else if (s.status === 'TERLAMBAT') newStats.terlambat++;
          else if (s.status === 'SAKIT') newStats.sakit++;
          else if (s.status === 'IZIN') newStats.izin++;
          else if (s.status === 'ALFA') newStats.alfa++;
          else newStats.belum++;
      });
      setStats(newStats);
  };

  const resetStats = () => setStats({ total: 0, hadir: 0, terlambat: 0, sakit: 0, izin: 0, alfa: 0, belum: 0 });

  const fetchDailyAttendance = async () => {
    setLoading(true);
    try {
      const res = await api.get('/attendance/daily', {
        params: { kelas: selectedClass, tanggal: selectedDate }
      });
      setStudents(res.data);
      calculateStats(res.data);
    } catch (error) {
      showToast('error', "Gagal memuat data anggota.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (studentId, newStatus) => {
    // Simpan data lama untuk cadangan jika error (Rollback)
    const originalStudents = [...students];

    // --- PERBAIKAN LOGIKA OPTIMISTIC UPDATE ---
    const updatedStudents = students.map(s => {
      if (s.id === studentId) {
        if (newStatus === 'RESET') {
          // Jika RESET, kembalikan semua ke null agar UI menampilkan "Belum"
          return { ...s, status: null, scan_time: null, scan_out: null };
        }
        return { ...s, status: newStatus };
      }
      return s;
    });
    
    setStudents(updatedStudents);
    calculateStats(updatedStudents);

    try {
      // --- PERBAIKAN PENGIRIMAN DATA KE API ---
      await api.post('/attendance/manual', {
        student_id: studentId,
        // Kirim null jika RESET, agar backend tahu data harus dihapus/direset
        status: newStatus === 'RESET' ? null : newStatus, 
        tanggal: selectedDate
      });
      
      if (newStatus === 'RESET') {
        showToast('success', "Data kehadiran berhasil direset.");
      }
    } catch (error) {
      // Jika gagal, kembalikan data ke kondisi semula
      setStudents(originalStudents); 
      calculateStats(originalStudents);
      showToast('error', "Gagal memperbarui status.");
    }
  };

  const filteredStudents = students.filter(s => s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()));

  // COMPONENT TOMBOL AKSI (DITAMBAHKAN TOMBOL "T")
  const ActionButtons = ({ student }) => (
      <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-inner w-full md:w-auto overflow-x-auto">
          {/* TOMBOL HADIR */}
          <button onClick={() => handleStatusChange(student.id, 'HADIR')} className={`flex-1 min-w-[30px] py-2 md:py-1.5 px-2 rounded-md text-[10px] font-bold transition-all active:scale-95 ${student.status === 'HADIR' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>H</button>
          
          {/* TOMBOL TERLAMBAT (BARU) */}
          <button onClick={() => handleStatusChange(student.id, 'TERLAMBAT')} className={`flex-1 min-w-[30px] py-2 md:py-1.5 px-2 rounded-md text-[10px] font-bold transition-all active:scale-95 ${student.status === 'TERLAMBAT' ? 'bg-amber-400 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>T</button>
          
          {/* TOMBOL SAKIT */}
          <button onClick={() => handleStatusChange(student.id, 'SAKIT')} className={`flex-1 min-w-[30px] py-2 md:py-1.5 px-2 rounded-md text-[10px] font-bold transition-all active:scale-95 ${student.status === 'SAKIT' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>S</button>
          
          {/* TOMBOL IZIN */}
          <button onClick={() => handleStatusChange(student.id, 'IZIN')} className={`flex-1 min-w-[30px] py-2 md:py-1.5 px-2 rounded-md text-[10px] font-bold transition-all active:scale-95 ${student.status === 'IZIN' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>I</button>
          
          {/* TOMBOL ALFA */}
          <button onClick={() => handleStatusChange(student.id, 'ALFA')} className={`flex-1 min-w-[30px] py-2 md:py-1.5 px-2 rounded-md text-[10px] font-bold transition-all active:scale-95 ${student.status === 'ALFA' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>A</button>
          
          {student.status && (
             <button onClick={() => handleStatusChange(student.id, 'RESET')} className="ml-1 px-2 rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-all active:scale-95" title="Reset Status"><RefreshCcw size={14} /></button>
          )}
      </div>
  );

  return (
    <div className="space-y-6 pb-24 md:pb-0 relative h-full font-sans">
      
      {/* TOAST NOTIFICATION */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-[99] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right border bg-white ${notification.type === 'success' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`}>
            {notification.type === 'success' ? <CheckCircle size={22}/> : <AlertCircle size={22}/>}
            <div><h4 className="font-bold text-sm">{notification.type === 'success' ? 'Berhasil' : 'Gagal'}</h4><p className="text-xs text-gray-500">{notification.message}</p></div>
            <button onClick={() => setNotification({ show: false })}><XCircle size={18} className="text-gray-400"/></button>
        </div>
      )}

      {/* HEADER & FILTER */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <UserCheck className="text-blue-600" size={28}/> Absensi Manual
                </h2>
                <p className="text-sm text-gray-500 mt-1">Kelola kehadiran harian secara manual.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                    <Calendar className="absolute left-3 top-3 text-gray-400 pointer-events-none" size={18}/>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white cursor-pointer text-sm font-medium"/>
                </div>
                
                <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-gray-400 pointer-events-none" size={18}/>
                    <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white cursor-pointer text-sm font-medium appearance-none">
                        <option value="" disabled>-- Pilih Divisi --</option>
                        {classes.map(c => (<option key={c.id} value={c.nama_kelas}>{c.nama_kelas}</option>))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16}/>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                    <input type="text" placeholder="Cari Nama..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"/>
                </div>
            </div>
        </div>

        {/* STATISTIK RINGKAS */}
        <div className={`flex flex-wrap gap-2 pt-4 border-t border-dashed border-gray-100 transition-all duration-500 ${selectedClass ? 'opacity-100' : 'opacity-50 grayscale cursor-not-allowed'}`}>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <Activity size={14} className="text-gray-400"/>
                <span className="text-xs font-bold text-gray-600">Total: {stats.total}</span>
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 rounded-lg text-xs font-bold text-emerald-600 border border-emerald-100">Hadir: {stats.hadir}</div>
            <div className="px-3 py-1.5 bg-amber-50 rounded-lg text-xs font-bold text-amber-600 border border-amber-100">Telat: {stats.terlambat}</div>
            <div className="px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-bold text-blue-600 border border-blue-100">Sakit: {stats.sakit}</div>
            <div className="px-3 py-1.5 bg-indigo-50 rounded-lg text-xs font-bold text-indigo-600 border border-indigo-100">Izin: {stats.izin}</div>
            <div className="px-3 py-1.5 bg-rose-50 rounded-lg text-xs font-bold text-rose-600 border border-rose-100">Alfa: {stats.alfa}</div>
            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${stats.belum > 0 ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>Belum: {stats.belum}</div>
        </div>
      </div>

      {/* TABLE CONTENT */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {!selectedClass ? (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400 animate-in fade-in zoom-in duration-500">
                <div className="p-6 bg-gray-50 rounded-full mb-4 border border-gray-100"><Filter size={40} className="opacity-20 text-blue-500"/></div>
                <h3 className="font-bold text-lg text-gray-600">Pilih Divisi / Kelas Terlebih Dahulu</h3>
                <p className="text-xs text-gray-400 mt-2">Silakan pilih opsi filter di atas.</p>
            </div>
        ) : loading ? (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400 animate-pulse">
                <div className="p-4 bg-gray-50 rounded-full mb-3"><RefreshCcw size={32} className="animate-spin opacity-20"/></div>
                <p className="text-sm">Memuat data anggota...</p>
            </div>
        ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                <div className="p-4 bg-gray-50 rounded-full mb-3"><Search size={32} className="opacity-20"/></div>
                <p className="text-sm">Tidak ada anggota ditemukan.</p>
            </div>
        ) : (
            <>
                {/* 1. DESKTOP TABLE VIEW */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="p-5 w-16 text-center">No</th>
                                <th className="p-5">Nama Anggota</th>
                                <th className="p-5 text-center">Status</th>
                                <th className="p-5 text-center">Jam Masuk</th>
                                <th className="p-5 text-center">Jam Pulang</th>
                                <th className="p-5 text-center w-[320px]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {filteredStudents.map((student, idx) => (
                                <tr key={student.id} className={`hover:bg-blue-50/20 transition-colors ${!student.status ? 'bg-amber-50/30' : ''}`}>
                                    <td className="p-5 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                                    <td className="p-5">
                                        <div className="font-bold text-gray-800 text-base">{student.nama_lengkap}</div>
                                        <div className="text-xs text-gray-400 mt-0.5 font-mono">{student.nisn}</div>
                                    </td>
                                    <td className="p-5 text-center">
                                        {student.status ? (
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                                student.status === 'HADIR' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 
                                                student.status === 'TERLAMBAT' ? 'bg-amber-100 text-amber-600 border-amber-200' :
                                                student.status === 'SAKIT' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                                                student.status === 'IZIN' ? 'bg-indigo-100 text-indigo-600 border-indigo-200' :
                                                'bg-rose-100 text-rose-600 border-rose-200'
                                            }`}>
                                                {student.status}
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-white text-gray-400 border border-gray-200 flex items-center justify-center gap-1 w-fit mx-auto">
                                                <HelpCircle size={12}/> Belum
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-5 text-center font-mono text-gray-500 text-xs">
                                        {student.scan_time ? <span className="text-emerald-600 font-bold">{formatTimeOnly(student.scan_time)}</span> : '-'}
                                    </td>
                                    <td className="p-5 text-center font-mono text-gray-500 text-xs">
                                        {student.scan_out ? <span className="text-blue-600 font-bold">{formatTimeOnly(student.scan_out)}</span> : '-'}
                                    </td>
                                    <td className="p-5">
                                        <ActionButtons student={student} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 2. MOBILE CARD VIEW */}
                <div className="md:hidden p-4 space-y-3 bg-gray-50">
                    {filteredStudents.map((student) => (
                        <div key={student.id} className={`bg-white p-4 rounded-2xl shadow-sm border ${!student.status ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-100'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 ${student.status ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                        {student.nama_lengkap.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight">{student.nama_lengkap}</h3>
                                        <p className="text-xs text-gray-400 font-mono mt-0.5">{student.nisn}</p>
                                    </div>
                                </div>
                                
                                <div className="text-right">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border mb-1 inline-block ${
                                         student.status === 'TERLAMBAT' ? 'bg-amber-100 text-amber-600 border-amber-200' :
                                         student.status ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-100 text-gray-500 border-gray-200'
                                    }`}>
                                        {student.status || 'BELUM'}
                                    </span>
                                </div>
                            </div>

                            {/* JAM INFO DI MOBILE */}
                            <div className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded-lg mb-3 border border-gray-100">
                                <div className="text-center flex-1 border-r border-gray-200">
                                    <p className="text-[9px] text-gray-400 uppercase font-bold">Masuk</p>
                                    <p className="font-mono font-bold text-emerald-600">{formatTimeOnly(student.scan_time)}</p>
                                </div>
                                <div className="text-center flex-1">
                                    <p className="text-[9px] text-gray-400 uppercase font-bold">Pulang</p>
                                    <p className="font-mono font-bold text-blue-600">{formatTimeOnly(student.scan_out)}</p>
                                </div>
                            </div>

                            <ActionButtons student={student} />
                        </div>
                    ))}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default ManualAttendance;