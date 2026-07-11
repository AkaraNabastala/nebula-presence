import React from 'react';
import { Building2, GraduationCap } from 'lucide-react';

const IndustryModal = ({ show, onClose, onSelect, currentMode }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center">
                <h3 className="text-xl font-black text-slate-800 mb-6">Pilih Mode Operasional</h3>
                <div className="space-y-3">
                    <button onClick={() => onSelect('pendidikan')} className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 ${currentMode === 'pendidikan' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100'}`}>
                        <GraduationCap className="text-indigo-500" size={24}/>
                        <div className="text-left"><p className="font-bold">Pendidikan</p><p className="text-[11px] text-slate-500">Istilah: Siswa, Kelas</p></div>
                    </button>
                    <button onClick={() => onSelect('perusahaan')} className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 ${currentMode === 'perusahaan' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100'}`}>
                        <Building2 className="text-indigo-500" size={24}/>
                        <div className="text-left"><p className="font-bold">Perusahaan</p><p className="text-[11px] text-slate-500">Istilah: Karyawan, Divisi</p></div>
                    </button>
                </div>
            </div>
        </div>
    );
};
export default IndustryModal;