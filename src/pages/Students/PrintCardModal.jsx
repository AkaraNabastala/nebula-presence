import React from 'react';
import { X, Printer } from 'lucide-react';
import Barcode from 'react-barcode';
import QrCodeSvg from '../../components/QrCodeSvg';

// Sesuaikan path logo dengan struktur folder Anda
import logoDefault from '../../assets/logo-nabastala.png';

const getBarcodeQrValue = (student) => {
    const idPengguna = (student.nipd || student.identity_number || '').toString().trim();
    const idRef = (student.nisn || student.identity_reference || '').toString().trim();
    return idRef ? `${idPengguna}${idRef}` : idPengguna;
};

// 1. Penyingkat nama Portrait (Pola sama seperti Landscape, disesuaikan agar pas 1 baris)
const formatQrName = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.split(',');
    const mainName = parts[0].trim();
    const titles = parts.slice(1).join(',').trim();
    const words = mainName.split(/\s+/).filter(Boolean);
    // Jika hanya 1 atau 2 kata, biarkan utuh
    if (words.length <= 2) return fullName;
    // Kata ke-1 dan ke-2 tetap utuh, kata ke-3 dst disingkat inisial
    const kept = words.slice(0, 2).join(' ');
    const lastInitials = words.slice(2).map(w => `${w.charAt(0).toUpperCase()}.`).join(' ');
    const shortened = `${kept} ${lastInitials}`;
    return titles ? `${shortened}, ${titles}` : shortened;
};


// 2. Penyingkat nama Landscape (Lebar ke samping - hanya singkat jika melebihi 1 baris)
const formatLandscapeName = (fullName) => {
    if (!fullName) return "";
    if (fullName.length <= 22) return fullName; // Muat utuh dalam 1 baris

    const parts = fullName.split(',');
    const mainName = parts[0].trim();
    const titles = parts.slice(1).join(',').trim();
    const words = mainName.split(/\s+/).filter(Boolean);

    if (words.length <= 2) return fullName;

    // Kata ke-1 dan ke-2 tetap utuh, kata ke-3 dst disingkat inisial agar pas 1 baris
    const kept = words.slice(0, 2).join(' ');
    const lastInitials = words.slice(2).map(w => `${w.charAt(0).toUpperCase()}.`).join(' ');
    const shortened = `${kept} ${lastInitials}`;

    return titles ? `${shortened}, ${titles}` : shortened;
};

const StudentCard = ({ student, conf }) => {
    const isQr = conf.metode_absensi === 'QR_CODE';

    // === TAMPILAN 1: KARTU PORTRAIT (KHUSUS QR CODE) ===
    if (isQr) {
        const qrDisplayName = formatQrName(student.nama_lengkap);

        return (
            <div className="card-item w-[210px] h-[300px] bg-white rounded-2xl shadow-sm border border-slate-300 relative overflow-hidden flex flex-col items-center p-3.5 break-inside-avoid page-break-avoid m-2 text-center justify-between">
                {/* Header Instansi */}
                <div className="w-full flex items-center justify-center gap-2 pb-2 border-b border-slate-200">
                    <img
                        src={conf.logo_instansi || conf.logo_sekolah || logoDefault}
                        alt="Logo"
                        className="w-7 h-7 object-contain"
                    />
                    <div className="text-left">
                        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-tight leading-tight line-clamp-1">
                            {conf.nama_instansi || 'NAMA INSTANSI'}
                        </h3>
                        <p className="text-[7px] text-slate-400 font-medium leading-tight line-clamp-1">
                            {conf.alamat_instansi || conf.alamat_sekolah || 'Alamat Lengkap Instansi'}
                        </p>
                    </div>
                </div>

                {/* Nama & Kelas Siswa (Ukuran huruf compact, 1 baris rapi truncate & rapat ke QR) */}
                <div className="mt-1.5 mb-1 w-full px-1">
                    <h2
                        className="text-[10px] font-bold text-slate-900 leading-tight uppercase tracking-tight truncate"
                        title={student.nama_lengkap}
                    >
                        {qrDisplayName}
                    </h2>
                    {(student.nipd || student.identity_number || student.kode_rfid) && (
                        <p className="text-[8.5px] text-slate-500 font-semibold mt-0.5 uppercase tracking-wider truncate">
                            {student.nipd || student.identity_number || student.kode_rfid}
                        </p>
                    )}
                </div>

                {/* QR Code Besar (Dekat dengan nama tanpa gap berlebih) */}
                <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                    <QrCodeSvg
                        value={getBarcodeQrValue(student)}
                        size={100}
                    />
                </div>

                {/* Footer Bawah */}
                <div className="w-full pt-1.5 border-t border-slate-100 mt-1">
                    <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">
                        Kartu Tanda Pengenal Resmi
                    </p>
                </div>
            </div>
        );
    }

    // === TAMPILAN 2: KARTU LANDSCAPE (KHUSUS BARCODE - DENGAN FOTO & 1 BARIS NAMA) ===
    const landscapeDisplayName = formatLandscapeName(student.nama_lengkap);

    return (
        <div className="card-item w-[350px] h-[225px] bg-white rounded-2xl shadow-sm border border-slate-300 relative overflow-hidden flex flex-col p-4 pb-5 break-inside-avoid page-break-avoid m-2 justify-between">
            {/* Header Instansi */}
            <div className="flex justify-between items-center pb-2 border-b-2 border-slate-800 mb-2">
                <div className="flex items-center justify-center w-12 h-12">
                    <img
                        src={conf.logo_instansi || conf.logo_sekolah || logoDefault}
                        alt="Logo"
                        className="w-full h-full object-contain"
                    />
                </div>
                <div className="flex-1 text-right pl-2">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide leading-tight">
                        {conf.nama_instansi || 'NAMA INSTANSI'}
                    </h3>
                    <p className="text-[8px] text-slate-500 font-medium leading-tight mt-0.5 max-w-[200px] ml-auto">
                        {conf.alamat_instansi || conf.alamat_sekolah || 'Alamat Lengkap Instansi'}
                    </p>
                </div>
            </div>

            {/* Konten Utama: Foto di Kiri, Data & Barcode di Kanan */}
            <div className="flex flex-row items-center gap-4 flex-1">
                {/* Foto Profil */}
                <div className="flex-shrink-0">
                    <div className="w-[80px] h-[105px] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden p-0.5 shadow-sm">
                        <img
                            src={student.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.nama_lengkap)}&background=e2e8f0&color=475569`}
                            className="w-full h-full object-cover rounded-lg"
                            alt="Foto"
                        />
                    </div>
                </div>

                {/* Detail Nama, Jabatan & Barcode */}
                <div className="flex-1 min-w-0 text-left flex flex-col justify-start pt-1">
                    {/* Nama 1 Baris Rapi */}
                    <h2 className="text-sm font-bold text-slate-900 leading-tight uppercase truncate" title={student.nama_lengkap}>
                        {landscapeDisplayName}
                    </h2>
                    <p className="text-xs text-slate-700 font-semibold mb-1">
                        ID : {student.nipd}
                    </p>

                    {/* Barcode Batang (Jarak Dibuat Rapat 'mt-1', Tanpa 'mt-auto') */}
                    <div className="mt-2 w-full flex-1 flex items-center justify-start">
                        {getBarcodeQrValue(student) ? (
                            <div className="flex justify-start items-center">
                                <Barcode
                                    value={getBarcodeQrValue(student)}
                                    width={1.4}
                                    height={44}
                                    displayValue={false}
                                    margin={0}
                                    background="transparent"
                                />
                            </div>
                        ) : (
                            <p className="text-[9px] text-rose-500 font-bold italic border border-rose-200 px-2 py-1 rounded bg-rose-50">
                                Belum ada Barcode
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Kartu (Diposisikan di Pojok Kiri Bawah agar Tidak Menimpa Angka Barcode) */}
            <div className="absolute bottom-1.5 left-4">
                <p className="text-[7px] text-slate-400 font-medium italic">Kartu Identitas Resmi</p>
            </div>
        </div>
    );
};

const PrintCardModal = ({
    show,
    onClose,
    data,
    config,
    isBulk = false
}) => {
    if (!show) return null;

    const printWindow = () => window.print();

    return (
        <div className="fixed inset-0 z-[100] bg-slate-100 overflow-y-auto animate-in fade-in duration-300">
            <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 md:px-10 py-4 flex justify-between items-center shadow-sm z-20 print:hidden">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2.5 bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                    <div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">Cetak Kartu Identitas</h2>
                        <p className="text-xs text-slate-500 font-medium">Tekan tombol Print untuk mencetak.</p>
                    </div>
                </div>
                <button onClick={printWindow} className="px-5 md:px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-[1.25rem] flex items-center gap-2 font-bold hover:shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-95 text-sm">
                    <Printer size={18} /> <span className="hidden md:inline">Print Sekarang</span>
                </button>
            </div>

            <div id="print-area" className="p-8 min-h-screen bg-slate-100 flex flex-wrap justify-center gap-4">
                {isBulk ? (
                    data.map((student) => <StudentCard key={student.id} student={student} conf={config} />)
                ) : (
                    data && <StudentCard student={data} conf={config} />
                )}
            </div>

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; background-color: white; display: block; }
                    .print\\:hidden { display: none !important; }
                    .card-item { page-break-inside: avoid; margin: 10px; border: 1px solid #ccc; display: inline-flex !important; }
                    @page { margin: 0.5cm; }
                }
            `}</style>
        </div>
    );
};

export default PrintCardModal;
