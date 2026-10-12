import React, { useState, useEffect } from 'react';
import { Calendar, Trash2, Plus, AlertCircle } from 'lucide-react';
import api from '../../api/axios';
import Swal from 'sweetalert2';

const Holidays = () => {
    const [holidays, setHolidays] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState('');
    const [description, setDescription] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'holiday_date', direction: 'desc' });

    const fetchHolidays = async () => {
        try {
            const res = await api.get('/holidays');
            setHolidays(res.data?.data || (Array.isArray(res.data) ? res.data : []));
        } catch (error) {
            console.error("Gagal memuat hari libur", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHolidays();
    }, []);

    const handleAddHoliday = async (e) => {
        e.preventDefault();
        if (!date || !description) return;

        try {
            await api.post('/holidays', { date, description });
            Swal.fire('Berhasil', 'Hari libur ditambahkan', 'success');
            setDate('');
            setDescription('');
            fetchHolidays();
        } catch (error) {
            Swal.fire('Gagal', error.response?.data?.message || 'Gagal menambahkan data', 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirm = await Swal.fire({
            title: 'Hapus Hari Libur?',
            text: "Data yang dihapus tidak bisa dikembalikan!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus!'
        });

        if (confirm.isConfirmed) {
            try {
                await api.delete(`/holidays/${id}`);
                Swal.fire('Terhapus!', 'Hari libur berhasil dihapus.', 'success');
                fetchHolidays();
            } catch {
                Swal.fire('Gagal!', 'Terjadi kesalahan saat menghapus.', 'error');
            }
        }
    };

    const sortedHolidays = [...(Array.isArray(holidays) ? holidays : [])].sort((a, b) => {
        if (sortConfig.key === 'holiday_date') {
            const dateA = new Date(a.holiday_date);
            const dateB = new Date(b.holiday_date);
            return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        } else {
            const valA = a.description || a.keterangan || a.nama_libur || "";
            const valB = b.description || b.keterangan || b.nama_libur || "";
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        }
    });

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex justify-between items-center dark:bg-slate-800 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                        <Calendar className="w-6 h-6 text-red-500" />
                        Kalender Libur (Tanggal Merah)
                    </h1>
                    <p className="text-slate-500 mt-1 dark:text-slate-400">
                        Atur hari libur nasional atau instansi agar sistem tidak merekap ALFA secara otomatis.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <form onSubmit={handleAddHoliday} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 dark:bg-slate-800 dark:border-slate-700">
                        <h2 className="font-bold text-slate-700 flex items-center gap-2 dark:text-slate-200">
                            <Plus className="w-5 h-5" />
                            Tambah Hari Libur
                        </h2>

                        <div>
                            <label htmlFor="holiday-date" className="block text-sm font-medium text-slate-600 mb-1 dark:text-slate-400">Tanggal</label>
                            <input
                                id="holiday-date"
                                name="holiday_date"
                                type="date"
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>

                        <div>
                            <label htmlFor="holiday-description" className="block text-sm font-medium text-slate-600 mb-1 dark:text-slate-400">Keterangan / Nama Libur</label>
                            <input
                                id="holiday-description"
                                name="holiday_description"
                                type="text"
                                required
                                placeholder="Cth: Hari Raya Idul Fitri"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-xl transition-colors shadow-sm"
                        >
                            Simpan Hari Libur
                        </button>
                    </form>
                </div>

                <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('holiday_date')}>
                                        Tanggal {sortConfig.key === 'holiday_date' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('description')}>
                                        Keterangan {sortConfig.key === 'description' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-8 text-center text-slate-400">
                                            Memuat data...
                                        </td>
                                    </tr>
                                ) : holidays.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-8 text-center text-slate-400 flex flex-col items-center">
                                            <AlertCircle className="w-8 h-8 mb-2 text-slate-300" />
                                            Belum ada hari libur yang terdaftar
                                        </td>
                                    </tr>
                                ) : (
                                    sortedHolidays.map((h, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 font-medium text-red-500 dark:text-red-400">
                                                {new Date(h.holiday_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                                                {h.description || h.keterangan || h.nama_libur || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleDelete(h.id)}
                                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all dark:hover:bg-red-900/30"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Holidays;
