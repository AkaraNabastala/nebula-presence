import React from 'react';
import { Loader2 } from 'lucide-react';
import logoNabastala from '../assets/logo-nabastala.png';

const LoadingScreen = ({ message = "MENYIAPKAN DATABASE" }) => {
  return (
    <div className="h-[100dvh] w-full bg-slate-950 flex flex-col items-center justify-center font-sans overflow-hidden relative px-4">
      
      {/* --- Background Glow Ornaments (Responsive Size) --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-blue-600/10 blur-[80px] md:blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute top-1/4 left-1/4 w-[150px] h-[150px] md:w-[300px] md:h-[300px] bg-indigo-600/5 blur-[60px] md:blur-[100px] rounded-full"></div>

      <div className="relative z-10 flex flex-col items-center">
        
        {/* --- Floating Logo Container (Responsive Size) --- */}
        <div className="relative w-24 h-24 md:w-32 md:h-32 mb-6 md:mb-10 group">
          <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full scale-75 group-hover:scale-110 transition-transform duration-700"></div>
          <img 
            src={logoNabastala} 
            alt="Nabastala Logo" 
            className="w-full h-full object-contain relative z-10 animate-[bounce_3s_ease-in-out_infinite]"
          />
        </div>

        {/* --- Text Section --- */}
        <div className="text-center space-y-3 md:space-y-4">
          <h1 className="text-white text-lg md:text-2xl font-black tracking-[0.2em] md:tracking-[0.4em] uppercase opacity-90 leading-relaxed">
            SI-MAS PRESENSI
          </h1>
          
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 md:gap-3 text-blue-400 font-bold text-[10px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em]">
              <Loader2 className="animate-spin" size={14} md:size={16} strokeWidth={3} />
              <span className="uppercase">{message}</span>
            </div>
            
            {/* Progress Bar Mini (Responsive Width) */}
            <div className="w-32 md:w-48 h-[2px] bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-1/3 animate-[loading_2s_infinite_ease-in-out]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Credit Footer (Responsive Position & Text) --- */}
      <div className="absolute bottom-6 md:bottom-10 flex flex-col items-center gap-2 w-full text-center">
        <p className="text-white/20 text-[8px] md:text-[9px] font-bold tracking-[0.3em] md:tracking-[0.5em] uppercase px-4">
          Mahakarya Nabastala Digital Solution
        </p>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;