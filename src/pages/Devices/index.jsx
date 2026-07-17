import React, { useState, useEffect } from 'react';
import { Fingerprint, Plus, Trash2, RefreshCw, DownloadCloud } from 'lucide-react';
import api from '../../api/axios';
import Swal from 'sweetalert2';

const Devices = () => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    
    const [formData, setFormData] = useState({ name: '', ip_address: '', port: 4370 });

    const fetchDevices = async () => {
        setLoading(true);
        try {
            const res = await api.get('/devices');
            setDevices(res.data.devices);
        } catch (err) {
            console.error("Gagal memuat perangkat", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDevices();
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/devices', formData);
            Swal.fire('Berhasil', 'Perangkat ditambahkan', 'success');
            setShowModal(false);
            fetchDevices();
        } catch {
            Swal.fire('Error', 'Gagal menambah perangkat', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Hapus perangkat ini?")) return;
        try {
            await api.delete(`/devices/${id}`);
            fetchDevices();
        } catch {
            Swal.fire('Error', 'Gagal menghapus perangkat', 'error');
        }
    };

    const handleTest = async (device) => {
        Swal.fire({
            title: 'Mengetes Koneksi...',
            text: `Menghubungkan ke ${device.ip_address}:${device.port}`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const res = await api.post('/devices/test', { ip_address: device.ip_address, port: device.port });
            Swal.fire('Berhasil', res.data.message, 'success');
        } catch (err) {
            Swal.fire('Gagal', err.response?.data?.message || 'Gagal terhubung', 'error');
        }
    };

    const handleSync = async (device) => {
        Swal.fire({
            title: 'Menarik Data...',
            text: `Menyalin riwayat absen hari ini dari ${device.name}`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const res = await api.post('/devices/sync', { ip_address: device.ip_address, port: device.port });
            if (res.data.success) {
                Swal.fire('Selesai', res.data.message, 'success');
            } else {
                Swal.fire('Perhatian', res.data.message, 'info');
            }
        } catch (err) {
            Swal.fire('Gagal', err.response?.data?.message || 'Gagal menarik data', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                        <Fingerprint size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Manajemen Mesin</h1>
                        <p className="text-slate-500 text-sm">Kelola mesin absensi / Sidik Jari</p>
                    </div>
                </div>
                <button onClick={() => setShowModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/30">
                    <Plus size={20} /> Tambah Mesin
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {devices.map(dev => (
                    <div key={dev.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-slate-800">{dev.name}</h3>
                                <span className="bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-full font-bold">Port: {dev.port}</span>
                            </div>
                            <p className="text-slate-500 font-mono text-sm mb-6">{dev.ip_address}</p>
                        </div>
                        
                        <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleTest(dev)} className="flex items-center gap-2 text-blue-500 hover:text-blue-600 font-bold text-sm bg-blue-50 px-3 py-2 rounded-xl transition-colors">
                                    <RefreshCw size={16} /> Test
                                </button>
                                <button onClick={() => handleSync(dev)} className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-bold text-sm bg-emerald-50 px-3 py-2 rounded-xl transition-colors">
                                    <DownloadCloud size={16} /> Tarik Data
                                </button>
                            </div>
                            <button onClick={() => handleDelete(dev.id)} className="text-red-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-colors">
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                ))}

                {devices.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-[2rem] border border-slate-100">
                        Belum ada mesin absensi yang terdaftar.
                    </div>
                )}
            </div>

            {/* Modal Tambah */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 mb-8 relative overflow-hidden max-w-md w-full">
                        <h3 className="text-xl font-bold mb-6 text-slate-800">Tambah Mesin Absensi</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Mesin</label>
                                <input required type="text" className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Pintu Utama" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">IP Address</label>
                                <input required type="text" className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500" value={formData.ip_address} onChange={e => setFormData({...formData, ip_address: e.target.value})} placeholder="192.168.1.201" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Port</label>
                                <input required type="number" className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500" value={formData.port} onChange={e => setFormData({...formData, port: e.target.value})} />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">Batal</button>
                                <button type="submit" className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/30">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Devices;
