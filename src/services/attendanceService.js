
import api from '../api/axios';

const attendanceService = {
  // Mengirim ID kartu, barcode, QR, atau ID manual ke backend.
  async scan(identifier) {
    const response = await api.post('/scan', {
      rfid_code: identifier.trim(),
    });

    return response.data;
  },

  // Mengambil anggota yang memiliki data wajah.
  async getFaceMembers() {
    const response = await api.get('/members/faces');
    return response.data;
  },

  // Mengambil daftar anggota sebagai alternatif jika endpoint wajah gagal.
  async getMembers() {
    const response = await api.get('/members');
    return response.data;
  },
};

export default attendanceService;
