const multer = require('multer');
const fs = require('fs');
const path = require('path');

// --- SURGICAL FIX: Pastikan folder 'uploads' selalu ada ---
const uploadDir = path.join(__dirname, '../uploads'); // sesuaikan posisi folder Anda
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Beri nama unik agar tidak bentrok jika dua admin upload bersamaan
        cb(null, `restore_${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Limit 50MB
});

module.exports = upload;