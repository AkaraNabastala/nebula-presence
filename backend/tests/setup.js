process.env.NODE_ENV = 'test'; // Memastikan DB SQLite memory digunakan

const initSystem = require('../models/init');

beforeAll(async () => {
    // Jalankan migrasi tabel di database memori
    await initSystem();
});
