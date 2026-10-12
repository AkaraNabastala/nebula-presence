import React, { useEffect, useRef } from 'react';

// Generator QR Code menggunakan Browser Canvas API
const QrCodeSvg = ({ value, size = 100, className = "" }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !value) return;

        // Menggunakan library QR generator native / API canvas
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Fallback URL SVG / Pure Data Matrix
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(value)}&margin=1`;

        img.onload = () => {
            ctx.clearRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0, size, size);
        };

        // Fallback jika offline: render placeholder barcode matrix
        img.onerror = () => {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = "#000000";
            ctx.font = "10px monospace";
            ctx.textAlign = "center";
            ctx.fillText(value, size / 2, size / 2);
        };
    }, [value, size]);

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className={`rounded-lg ${className}`}
            title={value}
        />
    );
};

export default QrCodeSvg;
