import React from 'react';
import { X, Printer } from 'lucide-react';
import Barcode from 'react-barcode';

// Sesuaikan path logo dengan struktur folder Anda
import logoDefault from '../../assets/logo-nabastala.png';

const StudentCard = ({ student, conf }) => (
    <div className="card-item w-[350px] h-[220px] bg-white rounded-2xl shadow-sm border border-slate-300 relative overflow-hidden flex flex-col p-4 break-inside-avoid page-break-avoid m-2 inline-flex">
        <div className="flex justify-between items-center pb-2 border-b-2 border-slate-800 mb-3">
            <div className="flex items-center justify-center w-12 h-12">
                <img 
                    src={conf.logo_instansi || logoDefault} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                />
            </div>
            <div className="flex-1 text-right pl-2">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide leading-tight">
                    {conf.nama_instansi || 'NAMA INSTANSI'}
                </h3>
                <p className="text-[8px] text-slate-500 font-medium leading-tight mt-0.5 max-w-[200px] ml-auto">
                    {conf.alamat_instansi || 'Alamat Lengkap Instansi'}
                </p>
            </div>
        </div>
        <div className="flex flex-row items-center gap-4 flex-1">
            <div className="flex-shrink-0">
                <div className="w-[80px] h-[105px] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden p-0.5">
                    <img 
                        src={student.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.nama_lengkap)}&background=e2e8f0&color=475569`} 
                        className="w-full h-full object-cover rounded-lg" 
                        alt="Foto" 
                    />
                </div>
            </div>
            <div className="flex-1 min-w-0 text-left flex flex-col justify-center">
                <h2 className="text-sm font-bold text-slate-900 leading-tight uppercase mb-1 line-clamp-2">
                    {student.nama_lengkap}
                </h2>
                <p className="text-xs text-slate-700 font-semibold mb-2">
                    {student.kelas} <span className="text-slate-300 mx-1">|</span> {student.nipd}
                </p>
                <div className="mt-auto">
                    {student.kode_rfid ? (
                        <div className="inline-block">
                            <Barcode 
                                value={student.kode_rfid} 
                                width={1.2} 
                                height={30} 
                                fontSize={10} 
                                displayValue={true} 
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
        <div className="absolute bottom-1 right-2">
            <p className="text-[7px] text-slate-400 font-medium italic">Kartu Identitas Resmi</p>
        </div>
    </div>
);

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
                    <button onClick={onClose} className="p-2.5 bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"><X size={20}/></button>
                    <div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">Cetak Kartu Identitas</h2>
                        <p className="text-xs text-slate-500 font-medium">Tekan tombol Print untuk mencetak.</p>
                    </div>
                </div>
                <button onClick={printWindow} className="px-5 md:px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-[1.25rem] flex items-center gap-2 font-bold hover:shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-95 text-sm">
                    <Printer size={18}/> <span className="hidden md:inline">Print Sekarang</span>
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