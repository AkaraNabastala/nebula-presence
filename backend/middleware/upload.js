const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Pastikan folder 'uploads' ada
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi penyimpanan
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `restore_${Date.now()}_${file.originalname}`);
    }
});

// Definisi multer hanya satu kali
const uploadInstance = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Limit 50MB
});

// Export objek multer yang sudah dikonfigurasi
module.exports = uploadInstance;