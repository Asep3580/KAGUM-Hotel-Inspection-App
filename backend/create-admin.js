// File: backend/create-admin.js

// Skrip ini terhubung langsung ke database untuk membuat pengguna baru.
// Ini adalah cara yang lebih andal untuk inisialisasi admin pertama kali
// karena tidak memerlukan server web yang sedang berjalan.

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const isProduction = process.env.NODE_ENV === 'production';

// Di produksi (Render), gunakan DATABASE_URL. Di development, gunakan variabel .env
const connectionConfig = isProduction 
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Diperlukan untuk koneksi ke database Render
        }
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      };

const pool = new Pool(connectionConfig);

const createAdmin = async () => {
    // Ambil email dan password dari argumen baris perintah
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
        console.error('Penggunaan: npm run create-admin -- <email> <password>');
        console.error('Contoh:   npm run create-admin -- admin@hotel.com password123');
        process.exit(1); // Keluar dengan kode error
    }

    console.log(`Mencoba mendaftarkan pengguna: ${email}...`);

    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $1, $2, 'admin') RETURNING user_id, username, email, role",
            [email, password_hash]
        );

        console.log('✅ Pengguna admin berhasil dibuat!');
        console.log(newUser.rows[0]);

    } catch (err) {
        console.error('❌ Gagal membuat pengguna:');
        if (err.code === '23505') { // Kode error untuk unique violation
            console.error('Error: Email sudah terdaftar.');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('Error: Koneksi ke database ditolak. Pastikan PostgreSQL sedang berjalan dan konfigurasi .env sudah benar.');
        } else {
            console.error(err.message);
        }
        process.exit(1);
    } finally {
        await pool.end(); // Pastikan koneksi ditutup
    }
};

createAdmin();