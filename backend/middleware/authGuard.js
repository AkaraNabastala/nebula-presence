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
        const secret = process.env.JWT_SECRET || 'Nabastala_Secret_Key_2026_XYZ!';
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token tidak valid." });
    }
};

module.exports = authGuard;