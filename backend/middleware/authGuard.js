const jwt = require('jsonwebtoken');

const authGuard = (req, res, next) => {
    // 1. Coba ambil dari cookie
    let token = req.cookies?.auth_token;

    // 2. Jika tidak ada di cookie, coba ambil dari header Authorization
    if (!token && req.headers.authorization) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: "Sesi habis, silakan login ulang." });
    }

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('[Auth Guard] JWT_SECRET belum dikonfigurasi.');
            return res.status(503).json({ message: 'Autentikasi belum dikonfigurasi oleh administrator.' });
        }
        const decoded = jwt.verify(token, secret);
        // Semua API terproteksi di Nebula Presence khusus admin.
        if (decoded.role !== 'SuperAdmin' || decoded.type === 'teacher') {
            return res.status(403).json({ message: 'Akses Nebula Presence hanya untuk admin.' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token tidak valid." });
    }
};

module.exports = authGuard;