process.env.NODE_ENV = 'test'; // Memastikan DB SQLite memory digunakan
// Secret ini khusus untuk test, bukan secret deployment.
process.env.JWT_SECRET = 'test-only-nebula-jwt-secret-not-for-production';

const initSystem = require('../models/init');

beforeAll(async () => {
    // Jalankan migrasi tabel di database memori
    await initSystem();
});
