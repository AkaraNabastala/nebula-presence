const roleGuard = (allowedRoles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !user.role) {
            return res.status(403).json({ message: "Akses ditolak: Anda tidak memiliki akses ke fitur ini." });
        }

        if (allowedRoles.includes(user.role)) {
            next();
        } else {
            return res.status(403).json({ message: "Akses ditolak: Fitur ini hanya untuk SuperAdmin." });
        }
    };
};

module.exports = roleGuard;
