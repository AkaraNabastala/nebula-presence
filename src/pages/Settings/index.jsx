import React, { useState, useEffect } from 'react';
import { 
    Save, Upload, ScanLine, QrCode, Fingerprint, Keyboard, 
    Image as ImageIcon, CheckCircle, AlertCircle, X, 
    Settings as SettingsIcon, Calendar, Clock, MapPin, 
    Building2, ToggleLeft, ToggleRight, ChevronDown, Trash2 
} from 'lucide-react';
import api from '../../api/axios';

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  
  // Konfigurasi Dasar
  const [config, setConfig] = useState({
    nama_instansi: 'Memuat...', 
    alamat_instansi: '',        
    metode_absensi: 'RFID',
    timezone: 'Asia/Jakarta',
    logo_instansi: '',
    background_absensi: ''
  });

  // Konfigurasi Jadwal
  const [schedule, setSchedule] = useState([
      { day: 'Senin', active: true, in: '08:00', out: '16:00' },
      { day: 'Selasa', active: true, in: '08:00', out: '16:00' },
      { day: 'Rabu', active: true, in: '08:00', out: '16:00' },
      { day: 'Kamis', active: true, in: '08:00', out: '16:00' },
      { day: 'Jumat', active: true, in: '08:00', out: '16:00' }, 
      { day: 'Sabtu', active: false, in: '08:00', out: '13:00' },
      { day: 'Minggu', active: false, in: '08:00', out: '13:00' },
  ]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data) {
          setConfig({
              nama_instansi: res.data.nama_sekolah || '', 
              alamat_instansi: res.data.alamat_sekolah || '',
              metode_absensi: res.data.metode_absensi || 'RFID',
              timezone: res.data.timezone || 'Asia/Jakarta',
              logo_instansi: res.data.logo_sekolah || '',
              background_absensi: res.data.background_absensi || ''
          });
          
          if (res.data.jadwal_sekolah) {
              setSchedule(JSON.parse(res.data.jadwal_sekolah));
          }
      }
    } catch (error) { 
        console.error("Gagal sinkronisasi data settings");
    }
  };

  const showToast = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  const handleConfigChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e, keyName) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            showToast('error', "Ukuran file maksimal 2MB!");
            return;
        }
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig(prev => ({ ...prev, [keyName]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // --- PERBAIKAN: FUNGSI HAPUS ASET (LOGO/BG) ---
  const handleRemoveAsset = (e, keyName) => {
      e.stopPropagation(); // Agar tidak memicu input file
      setConfig(prev => ({ ...prev, [keyName]: '' }));
  };

  const handleTimeChange = (index, field, value) => {
      const newSchedule = [...schedule];
      newSchedule[index][field] = value;
      setSchedule(newSchedule);
  };

  const handleDayToggle = (index) => {
      const newSchedule = [...schedule];
      newSchedule[index].active = !newSchedule[index].active;
      setSchedule(newSchedule);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
          nama_sekolah: config.nama_instansi,     
          alamat_sekolah: config.alamat_instansi, 
          metode_absensi: config.metode_absensi,
          timezone: config.timezone,
          logo_sekolah: config.logo_instansi,     
          background_absensi: config.background_absensi,
          jadwal_sekolah: JSON.stringify(schedule),
          jam_masuk: schedule[0].in, 
          jam_pulang: schedule[0].out
      };

      await api.post('/settings', payload);
      showToast('success', "Pengaturan berhasil disimpan!");
      fetchSettings();
      
    } catch (error) {
      showToast('error', "Gagal menyimpan pengaturan.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 md:pb-10 font-sans">
      
      {/* TOAST */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-[99] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right border bg-white ${notification.type === 'success' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`}>
            {notification.type === 'success' ? <CheckCircle size={22} className="text-green-500"/> : <AlertCircle size={22} className="text-red-500"/>}
            <div><h4 className="font-bold text-sm">{notification.type === 'success' ? 'Berhasil' : 'Gagal'}</h4><p className="text-xs text-gray-500">{notification.message}</p></div>
            <button onClick={() => setNotification({ show: false })}><X size={18} className="text-gray-400"/></button>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center gap-4">
          <div className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-blue-600">
              <SettingsIcon size={28}/>
          </div>
          <div>
              <h2 className="text-2xl font-bold text-gray-800">Pengaturan Sistem</h2>
              <p className="text-sm text-gray-500">Sesuaikan identitas, metode absensi, dan jam operasional.</p>
          </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* KOLOM KIRI */}
        <div className="space-y-8">
            
            {/* IDENTITAS */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Building2 size={20} className="text-blue-500"/> Identitas Instansi
                </h3>
                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Nama Instansi / Perusahaan</label>
                        <input name="nama_instansi" value={config.nama_instansi} readOnly className="w-full border border-gray-200 bg-gray-50 text-gray-500 p-3 rounded-xl outline-none font-bold cursor-not-allowed" title="Diatur oleh lisensi"/>
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Alamat Lengkap</label>
                        <textarea name="alamat_instansi" value={config.alamat_instansi} onChange={handleConfigChange} rows="3" className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-sm bg-white" placeholder="Jl. Sudirman No. 1..."/>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Zona Waktu (Timezone)</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 text-gray-400 pointer-events-none" size={18}/>
                            <select 
                                name="timezone" 
                                value={config.timezone || 'Asia/Jakarta'} 
                                onChange={handleConfigChange} 
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white cursor-pointer text-sm font-medium transition-all appearance-none"
                            >
                                <option value="Asia/Jakarta">WIB (Asia/Jakarta) - UTC+7</option>
                                <option value="Asia/Makassar">WITA (Asia/Makassar) - UTC+8</option>
                                <option value="Asia/Jayapura">WIT (Asia/Jayapura) - UTC+9</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16}/>
                        </div>
                    </div>
                </div>
            </div>

            {/* METODE ABSENSI */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <ScanLine size={20} className="text-blue-500"/> Metode Absensi
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {['RFID', 'BARCODE', 'FINGERPRINT', 'MANUAL'].map((metode) => (
                        <div key={metode} onClick={() => setConfig({...config, metode_absensi: metode})} className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all active:scale-95 ${config.metode_absensi === metode ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 hover:border-blue-200 text-gray-400'}`}>
                            {metode === 'RFID' && <ScanLine size={24} />}
                            {metode === 'BARCODE' && <QrCode size={24} />}
                            {metode === 'FINGERPRINT' && <Fingerprint size={24} />}
                            {metode === 'MANUAL' && <Keyboard size={24} />}
                            <span className="text-[10px] font-bold uppercase">{metode}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ASSETS (LOGO & BG) */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <ImageIcon size={20} className="text-blue-500"/> Visual Aplikasi
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    {/* LOGO INSTANSI */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Logo Instansi</label>
                        <div className="relative aspect-square rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden hover:border-blue-400 transition-colors group cursor-pointer">
                            {config.logo_instansi ? (
                                <>
                                    <img src={config.logo_instansi} className="w-3/4 h-3/4 object-contain" alt="Logo"/>
                                    <button onClick={(e) => handleRemoveAsset(e, 'logo_instansi')} className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Trash2 size={14}/></button>
                                </>
                            ) : <Upload className="text-gray-300"/>}
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'logo_instansi')} />
                        </div>
                    </div>

                    {/* BACKGROUND */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Background</label>
                        <div className="relative aspect-square rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden hover:border-blue-400 transition-colors group cursor-pointer">
                            {config.background_absensi ? (
                                <>
                                    <img src={config.background_absensi} className="w-full h-full object-cover" alt="Bg"/>
                                    <button onClick={(e) => handleRemoveAsset(e, 'background_absensi')} className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Trash2 size={14}/></button>
                                </>
                            ) : <Upload className="text-gray-300"/>}
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'background_absensi')} />
                        </div>
                    </div>
                </div>
            </div>

        </div>

        {/* KOLOM KANAN */}
        <div className="xl:col-span-2">
            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 h-full flex flex-col">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Calendar size={24} className="text-blue-500"/> Jadwal Operasional
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Atur jam masuk dan pulang kerja.</p>
                    </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-12 gap-4 text-[10px] uppercase font-bold text-gray-400 tracking-widest px-4">
                        <div className="col-span-3 md:col-span-3">Hari</div>
                        <div className="col-span-2 md:col-span-2 text-center">Status</div>
                        <div className="col-span-7 md:col-span-7 grid grid-cols-2 gap-4">
                            <span>Jam Masuk (Telat)</span>
                            <span>Jam Pulang</span>
                        </div>
                    </div>

                    {schedule.map((day, index) => (
                        <div key={day.day} className={`grid grid-cols-12 gap-4 items-center p-3 rounded-xl border transition-all ${day.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-transparent opacity-60'}`}>
                            <div className="col-span-3 md:col-span-3 font-bold text-gray-700 text-sm">{day.day}</div>
                            <div className="col-span-2 md:col-span-2 flex justify-center">
                                <button onClick={() => handleDayToggle(index)} className={`transition-colors ${day.active ? 'text-blue-600' : 'text-gray-300'}`}>
                                    {day.active ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>}
                                </button>
                            </div>
                            <div className="col-span-7 md:col-span-7 grid grid-cols-2 gap-4">
                                <div className="relative">
                                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                    <input type="time" value={day.in} onChange={(e) => handleTimeChange(index, 'in', e.target.value)} disabled={!day.active} className={`w-full border rounded-lg py-2 pl-9 pr-2 text-sm font-bold outline-none focus:border-blue-500 text-center ${!day.active ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-800 border-gray-300'}`} />
                                </div>
                                <div className="relative">
                                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                    <input type="time" value={day.out} onChange={(e) => handleTimeChange(index, 'out', e.target.value)} disabled={!day.active} className={`w-full border rounded-lg py-2 pl-9 pr-2 text-sm font-bold outline-none focus:border-blue-500 text-center ${!day.active ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-800 border-gray-300'}`} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-6 border-t border-dashed border-gray-200 text-right">
                    <p className="text-xs text-gray-400 mb-4 italic">*Jam Masuk adalah batas toleransi keterlambatan.</p>
                </div>
            </div>
        </div>

      </div>

      <div className="fixed bottom-6 right-6 md:static md:flex md:justify-end z-40">
        <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-blue-300 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
            {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
                <>
                    <Save size={20} />
                    <span>Simpan Pengaturan</span>
                </>
            )}
        </button>
      </div>

    </div>
  );
};

export default Settings;