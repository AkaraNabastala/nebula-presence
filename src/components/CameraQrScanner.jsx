import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, AlertCircle } from 'lucide-react';

const CameraQrScanner = ({ onScanSuccess, isLoading }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const isScanningRef = useRef(true);
    const lastScannedCodeRef = useRef("");
    const lastScannedTimeRef = useRef(0);

    const [cameras, setCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState("");
    const [cameraError, setCameraError] = useState(null);

    // Audio Feedback Synthesizer
    const playBeep = (isSuccess = true) => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (isSuccess) {
                osc.frequency.setValueAtTime(880, ctx.currentTime); // Nada A5 (Tinggi & Jernih)
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
            } else {
                osc.frequency.setValueAtTime(220, ctx.currentTime); // Nada Rendah (Warning)
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
                osc.start();
                osc.stop(ctx.currentTime + 0.25);
            }
        } catch {
            // Audio context might be restricted before interaction
        }
    };

    // Muat daftar perangkat kamera
    useEffect(() => {
        const getDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                setCameras(videoDevices);
                if (videoDevices.length > 0 && !selectedCameraId) {
                    setSelectedCameraId(videoDevices[0].deviceId);
                }
            } catch (err) {
                console.error("Gagal mendeteksi kamera:", err);
            }
        };
        getDevices();
    }, [selectedCameraId]);

    // Inisialisasi Stream Kamera
    useEffect(() => {
        let active = true;

        const startCamera = async () => {
            setCameraError(null);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            try {
                const constraints = {
                    video: selectedCameraId
                        ? { deviceId: { exact: selectedCameraId } }
                        : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (!active) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } catch (err) {
                if (!active) return;
                console.error("Gagal menyalakan kamera:", err);
                setCameraError(err.name === 'NotAllowedError'
                    ? "Izin akses kamera ditolak. Silakan izinkan di browser."
                    : "Kamera tidak terdeteksi atau sedang dipakai aplikasi lain.");
            }
        };

        startCamera();

        return () => {
            active = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, [selectedCameraId]);

    // Loop Deteksi Barcode / QR Code
    useEffect(() => {
        let animId;
        let detector = null;

        if ('BarcodeDetector' in window) {
            detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128'] });
        }

        const scanFrame = async () => {
            if (
                isScanningRef.current &&
                !isLoading &&
                detector &&
                videoRef.current &&
                videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
            ) {
                try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes.length > 0) {
                        const rawValue = barcodes[0].rawValue.trim();
                        const now = Date.now();

                        // Hindari trigger berulang untuk kartu yang sama dalam 2.5 detik
                        if (
                            rawValue !== lastScannedCodeRef.current ||
                            now - lastScannedTimeRef.current > 2500
                        ) {
                            lastScannedCodeRef.current = rawValue;
                            lastScannedTimeRef.current = now;
                            playBeep(true);
                            onScanSuccess(rawValue);
                        }
                    }
                } catch {
                    // Frame skip
                }
            }
            animId = requestAnimationFrame(scanFrame);
        };

        animId = requestAnimationFrame(scanFrame);
        return () => cancelAnimationFrame(animId);
    }, [isLoading, onScanSuccess]);

    return (
        <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black flex flex-col items-center justify-center">
            {/* Video Stream */}
            <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover" // mirror view agar natural
            />

            {/* Target Reticle (Viewfinder) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-44 h-44 sm:w-52 sm:h-52 border border-white/20 rounded-2xl">
                    {/* 4 Sudut Fokus (High Contrast Corner Brackets) */}
                    <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></span>
                    <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></span>
                    <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></span>
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></span>

                    {/* Garis Pindai Tipis Berjalan */}
                    <div className="w-full h-0.5 bg-blue-400/80 shadow-[0_0_8px_#3b82f6] animate-[bounce_2s_infinite]"></div>
                </div>
            </div>

            {/* Status Bar Atas */}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Kamera Aktif</span>
                </div>
            </div>

            {/* Pesan Bawah */}
            <div className="absolute bottom-3 px-4 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-white/90 tracking-wide text-center">
                Dekatkan QR Code ke dalam kotak
            </div>

            {/* Error State */}
            {cameraError && (
                <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center z-20">
                    <AlertCircle size={36} className="text-rose-500 mb-2" />
                    <p className="text-white text-xs font-bold mb-1">Gagal Mengakses Kamera</p>
                    <p className="text-slate-400 text-[10px] leading-relaxed max-w-[220px]">{cameraError}</p>
                </div>
            )}
        </div>
    );
};

export default CameraQrScanner;
