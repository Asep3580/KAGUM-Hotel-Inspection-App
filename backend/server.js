// File: backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001; // Mengganti port default untuk menghindari konflik umum
const isProduction = process.env.NODE_ENV === 'production';

// --- Security: Ensure essential environment variables are set ---
if (isProduction && !process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in the production environment.');
    process.exit(1); // Exit the process with an error code
}
// Use a constant for the secret and provide a default for development only.
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_for_development_only';

// Konfigurasi koneksi database
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

// --- Konfigurasi Nodemailer untuk Kirim Email ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // true untuk port 465, false untuk port lain
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // Opsi TLS ini hanya untuk development dengan self-signed certificates.
    // Di produksi, ini harus `true` atau dihilangkan untuk keamanan.
    ...(!isProduction && {
        tls: {
            rejectUnauthorized: false
        }
    }
)});

// --- Konfigurasi Multer untuk Upload File ---

// Konfigurasi penyimpanan untuk foto inspeksi
const inspectionStorage = multer.diskStorage({
    // PERINGATAN PENTING UNTUK DEPLOYMENT:
    // Render.com memiliki sistem file sementara (ephemeral). File yang diunggah ke direktori lokal
    // akan HILANG saat server di-restart atau di-deploy ulang.
    // Untuk produksi, sangat disarankan menggunakan layanan cloud storage seperti AWS S3, Cloudinary, atau Google Cloud Storage.
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'uploads/inspections');
        if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Konfigurasi penyimpanan untuk foto Working Order
const woPhotoStorage = multer.diskStorage({
    // PERINGATAN PENTING UNTUK DEPLOYMENT:
    // Render.com memiliki sistem file sementara (ephemeral). File yang diunggah ke direktori lokal
    // akan HILANG saat server di-restart atau di-deploy ulang.
    // Untuk produksi, sangat disarankan menggunakan layanan cloud storage seperti AWS S3, Cloudinary, atau Google Cloud Storage.
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads/wo-photos');
        if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `wo-${req.params.id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const createUploader = (storage) => multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Batas ukuran file 5MB
    fileFilter: (req, file, cb) => {
        // Izinkan hanya file gambar
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diizinkan!'), false);
        }
    }
});

const uploadInspectionPhotos = createUploader(inspectionStorage);
const uploadWoPhotos = createUploader(woPhotoStorage);

// Middleware
app.use(helmet()); 

// Konfigurasi CORS yang lebih aman untuk produksi
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
if (!isProduction) {
    allowedOrigins.push('http://127.0.0.1:5500', 'http://localhost:5500');
}

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.use(express.json()); // Mem-parsing body request JSON
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Sajikan file dari folder 'uploads'

// --- Middleware untuk verifikasi Token ---
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(403).json({ message: 'Token tidak tersedia, otorisasi ditolak.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token tidak valid.' });
    }
};

// Middleware otorisasi yang fleksibel berdasarkan peran
const authorize = (allowedRoles) => {
    return (req, res, next) => {
        // Pastikan middleware verifyToken sudah dijalankan sebelumnya
        if (!req.user || !req.user.user || !req.user.user.role) {
            return res.status(403).json({ message: 'Akses ditolak: Informasi peran pengguna tidak valid atau tidak ditemukan.' });
        }

        const { role } = req.user.user;

        // Periksa apakah peran pengguna ada di dalam daftar peran yang diizinkan
        if (Array.isArray(allowedRoles) && allowedRoles.includes(role)) {
            return next(); // Pengguna memiliki peran yang sesuai, lanjutkan
        }

        // Jika tidak, kirim respons 'Forbidden'
        return res.status(403).json({ message: 'Akses ditolak: Anda tidak memiliki hak untuk mengakses sumber daya ini.' });
    };
};

// Middleware baru untuk verifikasi izin berbasis database
const verifyPermission = (requiredPermission) => asyncHandler(async (req, res, next) => {
    const userRole = req.user.user.role;

    // Admin selalu memiliki semua izin, tidak perlu cek database
    if (userRole === 'admin') {
        return next();
    }

    const query = `
        SELECT 1 FROM role_permissions WHERE role_name = $1 AND permission_id = $2
    `;
    const { rows } = await pool.query(query, [userRole, requiredPermission]);

    if (rows.length > 0) {
        next(); // Izin ditemukan, lanjutkan
    } else {
        res.status(403).json({ message: 'Akses ditolak: Anda tidak memiliki izin untuk melakukan tindakan ini.' });
    }
});

// --- Async Handler Wrapper ---
// Utility to avoid repeating try-catch blocks in every async route handler
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// --- API Endpoints ---

// --- Auth Endpoints ---

// POST: Registrasi pengguna baru (untuk testing)
app.post('/api/auth/register', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email dan password diperlukan.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
        "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $1, $2, 'inspector') RETURNING user_id, username, email, role",
        [email, password_hash] // Default role is 'inspector' for public registration
    );

    res.status(201).json(newUser.rows[0]);
}));

// POST: Login pengguna
app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
        return res.status(401).json({ message: 'Email atau password salah.' });
    }
    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const payload = { user: { id: user.user_id, username: user.username, email: user.email, role: user.role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
}));

// POST: Meminta link reset password
app.post('/api/auth/forgot-password', asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email diperlukan.' });
    }

    const client = await pool.connect();
    try {
        // 1. Cari pengguna berdasarkan email
        const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);

        // PENTING: Untuk keamanan, selalu kirim respons sukses yang sama
        // baik email ditemukan atau tidak, untuk mencegah user enumeration.
        if (userResult.rows.length === 0) {
            console.log(`Permintaan reset password untuk email yang tidak terdaftar: ${email}`);
            // Cukup kirim respons sukses tanpa melakukan apa-apa lagi.
            return res.json({ message: 'Jika email Anda terdaftar, Anda akan menerima link untuk mereset password.' });
        }

        const user = userResult.rows[0];

        // 2. Buat token reset yang aman
        const resetToken = crypto.randomBytes(32).toString('hex');
        const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // 3. Tetapkan masa berlaku token (misal: 15 menit)
        const passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);

        // 4. Simpan token yang di-hash dan masa berlakunya ke database
        await client.query(
            'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE user_id = $3',
            [passwordResetToken, passwordResetExpires, user.user_id]
        );

        // 5. Buat URL reset lengkap
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;

        // 6. Kirim email ke pengguna
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: 'Reset Password Akun Anda',
            html: `
                <p>Anda menerima email ini karena ada permintaan untuk mereset password akun Anda.</p>
                <p>Silakan klik link di bawah ini untuk melanjutkan:</p>
                <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
                <p>Link ini akan kedaluwarsa dalam 15 menit.</p>
                <p>Jika Anda tidak meminta ini, abaikan saja email ini.</p>
            `,
        };

        try {
            console.log(`Mencoba mengirim email reset password ke: ${user.email}`);
            const info = await transporter.sendMail(mailOptions);
            console.log(`Email berhasil dikirim. Message ID: ${info.messageId}`);
            console.log(`Respons dari server email: ${info.response}`);
        } catch (emailError) {
            console.error('Nodemailer gagal mengirim email:', emailError);
            // Meskipun email gagal, kita tidak memberitahu frontend untuk alasan keamanan.
            // Cukup log error di server dan lanjutkan dengan respons sukses generik.
            // Namun, jika ini adalah error kritis yang harus menghentikan alur,
            // Anda bisa melempar error ini lagi: throw emailError;
        }

        res.json({ message: 'Jika email Anda terdaftar, Anda akan menerima link untuk mereset password.' });

    } finally {
        client.release();
    }
}));

// POST: Mereset password menggunakan token
app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token dan password baru diperlukan.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password baru minimal harus 6 karakter.' });
    }

    // 1. Hash token yang diterima dari frontend agar bisa dibandingkan dengan yang di DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 2. Cari pengguna dengan token yang valid dan belum kedaluwarsa
        const userResult = await client.query(
            'SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
            [hashedToken]
        );

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Token tidak valid atau sudah kedaluwarsa.' });
        }

        const user = userResult.rows[0];

        // 3. Hash password baru dan perbarui data pengguna
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        await client.query(
            'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE user_id = $2',
            [newPasswordHash, user.user_id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Password Anda telah berhasil direset. Silakan login kembali.' });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));


// PUT: Mengubah password pengguna yang sedang login
app.put('/api/auth/change-password', verifyToken, asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.user.id;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Password saat ini dan password baru diperlukan.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password baru minimal harus 6 karakter.' });
    }

    // 1. Ambil hash password saat ini dari DB
    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
    if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }

    // 2. Bandingkan password saat ini
    const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isMatch) {
        return res.status(401).json({ message: 'Password saat ini salah.' });
    }

    // 3. Hash dan update password baru
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);
    await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [newPasswordHash, userId]);

    res.json({ message: 'Password berhasil diubah.' });
}));

// GET: Mendapatkan riwayat inspeksi singkat (5 terbaru)
app.get('/api/inspections/recent', verifyToken, asyncHandler(async (req, res) => {
    const { hotel_id } = req.query;
    const { role, id: userId } = req.user.user;

    const conditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (hotel_id) {
        conditions.push(`i.hotel_id = $${paramIndex++}`);
        queryParams.push(hotel_id);
    } else if (role !== 'admin') {
        conditions.push(`i.hotel_id IN (SELECT hotel_id FROM user_hotels WHERE user_id = $${paramIndex++})`);
        queryParams.push(userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const whereAndClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    const queryText = `
        SELECT * FROM (
            (SELECT 'INSPECTION' as event_type, i.inspection_id, i.target_id, i.inspection_type, u.username as inspector_name, i.overall_status, i.inspection_date as event_timestamp, to_char(i.inspection_date, 'DD Mon YYYY, HH24:MI') as formatted_date FROM inspections i LEFT JOIN users u ON i.inspector_id = u.user_id ${whereClause})
            UNION ALL
            (SELECT 'IN_PROGRESS' as event_type, i.inspection_id, i.target_id, i.inspection_type, 'Sistem' as inspector_name, 'In Progress' as overall_status, i.progress_start_time as event_timestamp, to_char(i.progress_start_time, 'DD Mon YYYY, HH24:MI') as formatted_date FROM inspections i WHERE i.progress_start_time IS NOT NULL ${whereAndClause})
            UNION ALL
            (SELECT 'COMPLETED' as event_type, i.inspection_id, i.target_id, i.inspection_type, 'Sistem' as inspector_name, 'Baik' as overall_status, i.completion_time as event_timestamp, to_char(i.completion_time, 'DD Mon YYYY, HH24:MI') as formatted_date FROM inspections i WHERE i.completion_time IS NOT NULL ${whereAndClause})
        ) as history
        WHERE history.event_timestamp IS NOT NULL
        ORDER BY event_timestamp DESC
        LIMIT 10;
    `;
    const result = await pool.query(queryText, queryParams);
    res.json(result.rows);
}));

// GET: Mendapatkan semua data inspeksi dengan filter tanggal
app.get('/api/inspections', verifyToken, asyncHandler(async (req, res) => {
    const { startDate, endDate, hotel_id, status, room_status } = req.query; // hotel_id bisa kosong
    const { role, id: userId } = req.user.user;

    let queryText = `
        SELECT 
            i.*, 
            h.hotel_name, 
            u.username AS inspector_name,
            to_char(i.inspection_date, 'DD Mon YYYY, HH24:MI') as formatted_date,
            COALESCE(p.photos, '[]'::json) as photos
        FROM inspections i
        LEFT JOIN (
            SELECT 
                inspection_id, 
                json_agg(json_build_object('path', file_path)) as photos
            FROM 
                inspection_photos 
            GROUP BY 
                inspection_id
        ) p ON i.inspection_id = p.inspection_id
        JOIN hotels h ON i.hotel_id = h.hotel_id
        LEFT JOIN users u ON i.inspector_id = u.user_id`;

    const conditions = [];
    const queryParams = [];
    let paramIndex = 1;

    if (hotel_id) {
        conditions.push(`i.hotel_id = $${paramIndex++}`);
        queryParams.push(hotel_id);
    } else {
        // Jika tidak ada hotel_id spesifik, filter berdasarkan hak akses pengguna
        if (role !== 'admin') {
            conditions.push(`i.hotel_id IN (SELECT hotel_id FROM user_hotels WHERE user_id = $${paramIndex++})`);
            queryParams.push(userId);
        }
        // Admin tidak perlu filter hotel_id, akan melihat semua
    }

    if (status) { conditions.push(`i.overall_status = $${paramIndex++}`); queryParams.push(status); }
    if (room_status) { conditions.push(`i.overall_status = $${paramIndex++}`); queryParams.push(room_status); }
    if (startDate) { conditions.push(`i.inspection_date >= $${paramIndex++}`); queryParams.push(startDate); }
    if (endDate) { conditions.push(`i.inspection_date < ($${paramIndex++}::date + '1 day'::interval)`); queryParams.push(endDate); }

    if (conditions.length > 0) { queryText += ' WHERE ' + conditions.join(' AND '); }
    queryText += ' ORDER BY i.inspection_date DESC';

    const result = await pool.query(queryText, queryParams);
    res.json(result.rows);
}));

// POST: Menyimpan inspeksi kamar baru
app.post('/api/inspections/room', [verifyToken, verifyPermission('perform_inspection'), uploadInspectionPhotos.array('photos', 5)], asyncHandler(async (req, res) => {
    const { roomNumber, notes, overallStatus, hotelId } = req.body;
    const inspectorId = req.user.user.id;
    const uploadedFiles = req.files; // Array file yang diupload dari multer

    if (!roomNumber || !overallStatus || !hotelId) {
        return res.status(400).json({ message: 'Data tidak lengkap. Nomor kamar, status, dan ID hotel diperlukan.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Simpan data inspeksi utama
        const inspectionResult = await client.query(
            `INSERT INTO inspections (inspection_type, target_id, inspector_id, notes, overall_status, hotel_id)
             VALUES ('Kamar', $1, $2, $3, $4, $5)
             RETURNING inspection_id`,
            [roomNumber, inspectorId, notes, overallStatus, hotelId]
        );
        const newInspectionId = inspectionResult.rows[0].inspection_id;

        // 2. Jika ada foto, simpan path-nya ke tabel inspection_photos
        if (uploadedFiles && uploadedFiles.length > 0) {
            const photoInsertPromises = uploadedFiles.map(file => {
                const filePath = `/uploads/inspections/${file.filename}`; // Simpan path relatif
                return client.query(
                    `INSERT INTO inspection_photos (inspection_id, file_path) VALUES ($1, $2)`,
                    [newInspectionId, filePath]
                );
            });
            await Promise.all(photoInsertPromises);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Inspeksi kamar berhasil disimpan.', inspection_id: newInspectionId });
    } catch (error) {
        await client.query('ROLLBACK');
        // Jika terjadi error, hapus file yang sudah terlanjur diupload
        if (uploadedFiles && uploadedFiles.length > 0) {
            uploadedFiles.forEach(file => fs.unlink(file.path, (err) => { if (err) console.error(`Gagal menghapus file orphan: ${file.path}`, err); }));
        }
        throw error; // Lanjutkan ke error handler global
    } finally {
        client.release();
    }
}));

// POST: Menyimpan inspeksi area baru
app.post('/api/inspections/area', [verifyToken, verifyPermission('perform_inspection'), uploadInspectionPhotos.array('photos', 5)], asyncHandler(async (req, res) => {
    const { areaName, notes, overallStatus, hotelId } = req.body;
    const inspectorId = req.user.user.id;
    const uploadedFiles = req.files;

    if (!areaName || !overallStatus || !hotelId) {
        return res.status(400).json({ message: 'Data tidak lengkap. Nama area, status, dan ID hotel diperlukan.' });
    }

    // Validasi tambahan: Pastikan area ada di hotel yang benar
    const areaCheck = await pool.query('SELECT area_id FROM areas WHERE area_name = $1 AND hotel_id = $2', [areaName, hotelId]);
    if (areaCheck.rows.length === 0) {
        return res.status(404).json({ message: `Area "${areaName}" tidak ditemukan di hotel ini.` });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Simpan data inspeksi utama
        const inspectionResult = await client.query(
            `INSERT INTO inspections (inspection_type, target_id, inspector_id, notes, overall_status, hotel_id)
             VALUES ('Area', $1, $2, $3, $4, $5)
             RETURNING inspection_id`,
            [areaName, inspectorId, notes, overallStatus, hotelId]
        );
        const newInspectionId = inspectionResult.rows[0].inspection_id;

        // 2. Jika ada foto, simpan path-nya
        if (uploadedFiles && uploadedFiles.length > 0) {
            const photoInsertPromises = uploadedFiles.map(file => {
                const filePath = `/uploads/inspections/${file.filename}`;
                return client.query(
                    `INSERT INTO inspection_photos (inspection_id, file_path) VALUES ($1, $2)`,
                    [newInspectionId, filePath]
                );
            });
            await Promise.all(photoInsertPromises);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Inspeksi area berhasil disimpan.', inspection_id: newInspectionId });
    } catch (error) {
        await client.query('ROLLBACK');
        // Hapus file yang sudah terlanjur diupload jika terjadi error
        if (uploadedFiles && uploadedFiles.length > 0) {
            uploadedFiles.forEach(file => fs.unlink(file.path, err => { if (err) console.error(`Gagal menghapus file orphan: ${file.path}`, err); }));
        }
        throw error;
    } finally {
        client.release();
    }
}));

// PUT: Memperbarui status inspeksi
app.put('/api/inspections/:id/status', verifyToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newStatus } = req.body;

    if (!newStatus || !['In Progress', 'Baik', 'Kurang'].includes(newStatus)) {
        return res.status(400).json({ message: 'Status baru tidak valid.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let queryText;
        const queryParams = [newStatus, id];

        if (newStatus === 'In Progress') {
            queryText = `UPDATE inspections SET overall_status = $1, progress_start_time = NOW(), completion_time = NULL WHERE inspection_id = $2 AND overall_status = 'Kurang' RETURNING *`;
        } else if (newStatus === 'Baik') {
            queryText = `UPDATE inspections SET overall_status = $1, completion_time = NOW() WHERE inspection_id = $2 AND (overall_status = 'In Progress' OR overall_status = 'Kurang') RETURNING *`;
        } else { // newStatus === 'Kurang'
            queryText = `UPDATE inspections SET overall_status = $1, progress_start_time = NULL, completion_time = NULL WHERE inspection_id = $2 RETURNING *`;
        }

        const { rows: updatedInspections } = await client.query(queryText, queryParams);

        if (updatedInspections.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Inspeksi tidak ditemukan atau transisi status tidak diizinkan.' });
        }

        const inspection = updatedInspections[0];

        await client.query('COMMIT');
        res.json(inspection);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

// DELETE: Menghapus laporan inspeksi (Admin Only)
app.delete('/api/inspections/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: 'ID Inspeksi tidak valid.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Hapus detail terkait terlebih dahulu untuk menghindari error foreign key.
        // Baris ini dinonaktifkan karena tabel 'inspection_details' tidak ada di skema database saat ini.
        // await client.query('DELETE FROM inspection_details WHERE inspection_id = $1', [id]);

        // 2. Hapus inspeksi utama
        const result = await client.query('DELETE FROM inspections WHERE inspection_id = $1', [id]);

        await client.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Laporan inspeksi tidak ditemukan.' });
        }

        res.status(200).json({ message: 'Laporan inspeksi berhasil dihapus.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[DELETE /api/inspections/${id}] Transaction failed:`, error);

        // Cek jika error adalah foreign key violation (kode 23503 di PostgreSQL)
        if (error.code === '23503') {
            console.error('Foreign key violation on delete:', error.detail);
            // Kirim respons 409 Conflict yang lebih deskriptif
            return res.status(409).json({ 
                message: 'Gagal menghapus laporan karena masih digunakan oleh data lain.',
                detail: error.detail // Detail ini sangat membantu saat development
            });
        }

        // Untuk error lainnya, teruskan ke middleware penanganan error global
        throw error;
    } finally {
        client.release();
    }
}));

// GET: Mendapatkan status untuk dashboard kamar
app.get('/api/dashboard/rooms', verifyToken, asyncHandler(async (req, res) => {
    const { hotel_id } = req.query; // Bisa kosong
    const { role, id: userId } = req.user.user;

    let queryText;
    let queryParams = [];

    if (hotel_id) {
        // Tampilan satu hotel
        queryParams.push(hotel_id);
        queryText = `
            WITH latest_inspections AS (SELECT DISTINCT ON (target_id) target_id, overall_status FROM inspections WHERE inspection_type = 'Kamar' AND hotel_id = $1 ORDER BY target_id, inspection_date DESC)
            SELECT r.room_id, r.room_number, r.room_type, COALESCE(li.overall_status, 'Belum Diinspeksi') as status
            FROM rooms r LEFT JOIN latest_inspections li ON r.room_number = li.target_id 
            WHERE r.hotel_id = $1 ORDER BY r.room_number ASC;`;
    } else {
        // Tampilan semua hotel (berdasarkan hak akses)
        if (role === 'admin') {
            queryText = `
                WITH latest_inspections AS (SELECT DISTINCT ON (hotel_id, target_id) hotel_id, target_id, overall_status FROM inspections WHERE inspection_type = 'Kamar' ORDER BY hotel_id, target_id, inspection_date DESC)
                SELECT r.room_id, r.room_number, r.room_type, h.hotel_name, COALESCE(li.overall_status, 'Belum Diinspeksi') as status
                FROM rooms r JOIN hotels h ON r.hotel_id = h.hotel_id
                LEFT JOIN latest_inspections li ON r.room_number = li.target_id AND r.hotel_id = li.hotel_id
                ORDER BY h.hotel_name, r.room_number ASC;`;
        } else {
            queryParams.push(userId);
            queryText = `
                WITH latest_inspections AS (SELECT DISTINCT ON (i.hotel_id, i.target_id) i.hotel_id, i.target_id, i.overall_status FROM inspections i JOIN user_hotels uh ON i.hotel_id = uh.hotel_id WHERE i.inspection_type = 'Kamar' AND uh.user_id = $1 ORDER BY i.hotel_id, i.target_id, i.inspection_date DESC)
                SELECT r.room_id, r.room_number, r.room_type, h.hotel_name, COALESCE(li.overall_status, 'Belum Diinspeksi') as status
                FROM rooms r JOIN user_hotels uh ON r.hotel_id = uh.hotel_id JOIN hotels h ON r.hotel_id = h.hotel_id
                LEFT JOIN latest_inspections li ON r.room_number = li.target_id AND r.hotel_id = li.hotel_id
                WHERE uh.user_id = $1 ORDER BY h.hotel_name, r.room_number ASC;`;
        }
    }

    const result = await pool.query(queryText, queryParams);
    res.json(result.rows);
}));

// GET: Mendapatkan status untuk dashboard area
app.get('/api/dashboard/areas', verifyToken, asyncHandler(async (req, res) => {
    const { hotel_id } = req.query; // Bisa kosong
    const { role, id: userId } = req.user.user;

    let queryText;
    let queryParams = [];

    if (hotel_id) {
        // Tampilan satu hotel
        queryParams.push(hotel_id);
        queryText = `
            WITH latest_inspections AS (SELECT DISTINCT ON (target_id) target_id, overall_status FROM inspections WHERE inspection_type = 'Area' AND hotel_id = $1 ORDER BY target_id, inspection_date DESC)
            SELECT a.area_id, a.area_name, COALESCE(li.overall_status, 'Belum Diinspeksi') as status
            FROM areas a LEFT JOIN latest_inspections li ON a.area_name = li.target_id 
            WHERE a.hotel_id = $1 ORDER BY a.area_name ASC;`;
    } else {
        // Tampilan semua hotel (berdasarkan hak akses)
        if (role === 'admin') {
            queryText = `
                WITH latest_inspections AS (SELECT DISTINCT ON (hotel_id, target_id) hotel_id, target_id, overall_status FROM inspections WHERE inspection_type = 'Area' ORDER BY hotel_id, target_id, inspection_date DESC)
                SELECT a.area_id, a.area_name, h.hotel_name, COALESCE(li.overall_status, 'Belum Diinspeksi') as status
                FROM areas a JOIN hotels h ON a.hotel_id = h.hotel_id
                LEFT JOIN latest_inspections li ON a.area_name = li.target_id AND a.hotel_id = li.hotel_id
                ORDER BY h.hotel_name, a.area_name ASC;`;
        } else {
            queryParams.push(userId);
            queryText = `
                WITH latest_inspections AS (SELECT DISTINCT ON (i.hotel_id, i.target_id) i.hotel_id, i.target_id, i.overall_status FROM inspections i JOIN user_hotels uh ON i.hotel_id = uh.hotel_id WHERE i.inspection_type = 'Area' AND uh.user_id = $1 ORDER BY i.hotel_id, i.target_id, i.inspection_date DESC)
                SELECT a.area_id, a.area_name, h.hotel_name, COALESCE(li.overall_status, 'Belum Diinspeksi') as status
                FROM areas a JOIN user_hotels uh ON a.hotel_id = uh.hotel_id JOIN hotels h ON a.hotel_id = h.hotel_id
                LEFT JOIN latest_inspections li ON a.area_name = li.target_id AND a.hotel_id = li.hotel_id
                WHERE uh.user_id = $1 ORDER BY h.hotel_name, a.area_name ASC;`;
        }
    }

    const result = await pool.query(queryText, queryParams);
    res.json(result.rows);
}));

// --- Room Management API Endpoints ---

// GET: Mendapatkan semua kamar
app.get('/api/rooms', verifyToken, asyncHandler(async (req, res) => {
    const { hotel_id } = req.query;
    if (!hotel_id) {
        // Return empty for now if no hotel is selected, or handle as an error
        return res.json([]);
    }
    const result = await pool.query('SELECT * FROM rooms WHERE hotel_id = $1 ORDER BY room_number ASC', [hotel_id]);
    res.json(result.rows);
}));

// POST: Menambah kamar baru
app.post('/api/rooms', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    try {
        const { room_number, room_type, hotel_id } = req.body;
        if (!room_number) return res.status(400).json({ message: 'Nomor kamar tidak boleh kosong.' });
        if (!hotel_id) return res.status(400).json({ message: 'Hotel ID tidak boleh kosong.' });

        const newRoom = await pool.query(
            'INSERT INTO rooms (room_number, room_type, hotel_id) VALUES ($1, $2, $3) RETURNING *',
            [room_number, room_type || 'Standard', hotel_id]
        );
        res.status(201).json(newRoom.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nomor kamar sudah ada.' });
        next(err);
    }
}));

// PUT: Memperbarui kamar
app.put('/api/rooms/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { room_number, room_type } = req.body;
    if (!room_number) return res.status(400).json({ message: 'Nomor kamar tidak boleh kosong.' });

    try {
        // 1. Dapatkan data kamar lama untuk pengecekan
        const roomResult = await pool.query('SELECT room_number, hotel_id FROM rooms WHERE room_id = $1', [id]);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ message: 'Kamar tidak ditemukan.' });
        }
        const oldRoom = roomResult.rows[0];

        // 2. Periksa apakah kamar sudah digunakan dalam inspeksi
        const inUseCheck = await pool.query(
            "SELECT 1 FROM inspections WHERE inspection_type = 'Kamar' AND target_id = $1 AND hotel_id = $2 LIMIT 1",
            [oldRoom.room_number, oldRoom.hotel_id]
        );

        if (inUseCheck.rows.length > 0) {
            return res.status(409).json({ message: `Kamar ${oldRoom.room_number} tidak dapat diubah karena sudah memiliki riwayat inspeksi.` });
        }

        // 3. Lanjutkan update jika tidak digunakan
        const updatedRoom = await pool.query(
            'UPDATE rooms SET room_number = $1, room_type = $2 WHERE room_id = $3 RETURNING *',
            [room_number, room_type, id]
        );
        if (updatedRoom.rows.length === 0) return res.status(404).json({ message: 'Kamar tidak ditemukan.' });
        res.json(updatedRoom.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nomor kamar sudah ada.' });
        next(err);
    }
}));

// DELETE: Menghapus kamar
app.delete('/api/rooms/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 1. Dapatkan data kamar untuk pengecekan
    const roomResult = await pool.query('SELECT room_number, hotel_id FROM rooms WHERE room_id = $1', [id]);
    if (roomResult.rows.length === 0) {
        return res.status(404).json({ message: 'Kamar tidak ditemukan.' });
    }
    const room = roomResult.rows[0];

    // 2. Periksa apakah kamar sudah digunakan dalam inspeksi
    const inUseCheck = await pool.query(
        "SELECT 1 FROM inspections WHERE inspection_type = 'Kamar' AND target_id = $1 AND hotel_id = $2 LIMIT 1",
        [room.room_number, room.hotel_id]
    );

    if (inUseCheck.rows.length > 0) {
        return res.status(409).json({ message: `Kamar ${room.room_number} tidak dapat dihapus karena sudah memiliki riwayat inspeksi.` });
    }

    // 3. Lanjutkan hapus jika tidak digunakan
    const deleteOp = await pool.query('DELETE FROM rooms WHERE room_id = $1', [id]);
    if (deleteOp.rowCount === 0) return res.status(404).json({ message: 'Gagal menghapus kamar dari database.' });
    res.status(204).send(); // No Content
}));

// --- Hotel Management API Endpoints ---

// GET: Mendapatkan semua hotel
app.get('/api/hotels', verifyToken, asyncHandler(async (req, res, next) => {
    // Tambahan: Pemeriksaan keamanan untuk memastikan struktur token sesuai harapan
    if (!req.user || !req.user.user) {
        return res.status(401).json({ message: 'Struktur token tidak valid.' });
    }

    const { role, id: userId } = req.user.user;

    if (role === 'admin') {
        // Admin dapat melihat semua hotel
        const result = await pool.query('SELECT * FROM hotels ORDER BY hotel_name ASC');
        res.json(result.rows);
    } else {
        // Inspector hanya melihat hotel yang ditugaskan padanya
        const result = await pool.query(
            `SELECT h.* FROM hotels h JOIN user_hotels uh ON h.hotel_id = uh.hotel_id WHERE uh.user_id = $1 ORDER BY h.hotel_name ASC`,
            [userId]
        );
        res.json(result.rows);
    }
}));

// POST: Menambah hotel baru
app.post('/api/hotels', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    try {
        const { hotel_name, address } = req.body;
        if (!hotel_name) return res.status(400).json({ message: 'Nama hotel tidak boleh kosong.' });
        
        const newHotel = await pool.query(
            'INSERT INTO hotels (hotel_name, address) VALUES ($1, $2) RETURNING *',
            [hotel_name, address || '']
        );
        res.status(201).json(newHotel.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nama hotel sudah ada.' });
        next(err);
    }
}));

// PUT: Memperbarui hotel
app.put('/api/hotels/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        const { hotel_name, address } = req.body;
        if (!hotel_name) return res.status(400).json({ message: 'Nama hotel tidak boleh kosong.' });

        const updatedHotel = await pool.query(
            'UPDATE hotels SET hotel_name = $1, address = $2 WHERE hotel_id = $3 RETURNING *',
            [hotel_name, address, id]
        );
        if (updatedHotel.rows.length === 0) return res.status(404).json({ message: 'Hotel tidak ditemukan.' });
        res.json(updatedHotel.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nama hotel sudah ada.' });
        next(err);
    }
}));

// DELETE: Menghapus hotel
app.delete('/api/hotels/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Pengecekan dependensi sebelum menghapus
    // 1. Cek inspeksi
    const inspectionCheck = await pool.query('SELECT 1 FROM inspections WHERE hotel_id = $1 LIMIT 1', [id]);
    if (inspectionCheck.rows.length > 0) {
        return res.status(409).json({ message: 'Hotel tidak dapat dihapus karena memiliki data inspeksi terkait.' });
    }

    // 2. Cek kamar
    const roomCheck = await pool.query('SELECT 1 FROM rooms WHERE hotel_id = $1 LIMIT 1', [id]);
    if (roomCheck.rows.length > 0) {
        return res.status(409).json({ message: 'Hotel tidak dapat dihapus karena memiliki data kamar terkait.' });
    }

    // 3. Cek area
    const areaCheck = await pool.query('SELECT 1 FROM areas WHERE hotel_id = $1 LIMIT 1', [id]);
    if (areaCheck.rows.length > 0) {
        return res.status(409).json({ message: 'Hotel tidak dapat dihapus karena memiliki data area terkait.' });
    }

    // 4. Cek penugasan pengguna (jika ada tabel user_hotels)
    const userHotelCheck = await pool.query('SELECT 1 FROM user_hotels WHERE hotel_id = $1 LIMIT 1', [id]);
    if (userHotelCheck.rows.length > 0) {
        return res.status(409).json({ message: 'Hotel tidak dapat dihapus karena masih ditugaskan ke pengguna.' });
    }

    // Jika semua pengecekan lolos, lanjutkan penghapusan
    const deleteOp = await pool.query('DELETE FROM hotels WHERE hotel_id = $1', [id]);
    if (deleteOp.rowCount === 0) return res.status(404).json({ message: 'Hotel tidak ditemukan.' });
    res.status(204).send(); // No Content
}));

// --- Area Management API Endpoints ---

// GET: Mendapatkan semua area
app.get('/api/areas', verifyToken, asyncHandler(async (req, res) => {
    const { hotel_id } = req.query;
    if (!hotel_id) {
        // Return empty for now if no hotel is selected, or handle as an error
        return res.json([]);
    }
    const result = await pool.query('SELECT * FROM areas WHERE hotel_id = $1 ORDER BY area_name ASC', [hotel_id]);
    res.json(result.rows);
}));

// POST: Menambah area baru
app.post('/api/areas', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    try {
        const { area_name, hotel_id } = req.body;
        if (!area_name) return res.status(400).json({ message: 'Nama area tidak boleh kosong.' });
        if (!hotel_id) return res.status(400).json({ message: 'Hotel ID tidak boleh kosong.' });

        const newArea = await pool.query(
            'INSERT INTO areas (area_name, hotel_id) VALUES ($1, $2) RETURNING *',
            [area_name, hotel_id]
        );
        res.status(201).json(newArea.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nama area sudah ada.' });
        next(err);
    }
}));

// PUT: Memperbarui area
app.put('/api/areas/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { area_name } = req.body;
    if (!area_name) return res.status(400).json({ message: 'Nama area tidak boleh kosong.' });

    try {
        // 1. Dapatkan data area lama untuk pengecekan
        const areaResult = await pool.query('SELECT area_name, hotel_id FROM areas WHERE area_id = $1', [id]);
        if (areaResult.rows.length === 0) {
            return res.status(404).json({ message: 'Area tidak ditemukan.' });
        }
        const oldArea = areaResult.rows[0];

        // 2. Periksa apakah area sudah digunakan dalam inspeksi
        const inUseCheck = await pool.query(
            "SELECT 1 FROM inspections WHERE inspection_type = 'Area' AND target_id = $1 AND hotel_id = $2 LIMIT 1",
            [oldArea.area_name, oldArea.hotel_id]
        );

        if (inUseCheck.rows.length > 0) {
            return res.status(409).json({ message: `Area "${oldArea.area_name}" tidak dapat diubah karena sudah memiliki riwayat inspeksi.` });
        }

        // 3. Lanjutkan update jika tidak digunakan
        const updatedArea = await pool.query(
            'UPDATE areas SET area_name = $1 WHERE area_id = $2 RETURNING *',
            [area_name, id]
        );
        if (updatedArea.rows.length === 0) return res.status(404).json({ message: 'Area tidak ditemukan.' });
        res.json(updatedArea.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nama area sudah ada.' });
        next(err);
    }
}));

// DELETE: Menghapus area
app.delete('/api/areas/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 1. Dapatkan data area untuk pengecekan
    const areaResult = await pool.query('SELECT area_name, hotel_id FROM areas WHERE area_id = $1', [id]);
    if (areaResult.rows.length === 0) {
        return res.status(404).json({ message: 'Area tidak ditemukan.' });
    }
    const area = areaResult.rows[0];

    // 2. Periksa apakah area sudah digunakan dalam inspeksi
    const inUseCheck = await pool.query(
        "SELECT 1 FROM inspections WHERE inspection_type = 'Area' AND target_id = $1 AND hotel_id = $2 LIMIT 1",
        [area.area_name, area.hotel_id]
    );

    if (inUseCheck.rows.length > 0) {
        return res.status(409).json({ message: `Area "${area.area_name}" tidak dapat dihapus karena sudah memiliki riwayat inspeksi.` });
    }

    // 3. Lanjutkan hapus jika tidak digunakan
    const deleteOp = await pool.query('DELETE FROM areas WHERE area_id = $1', [id]);
    if (deleteOp.rowCount === 0) return res.status(404).json({ message: 'Gagal menghapus area dari database.' });
    res.status(204).send(); // No Content
}));

// --- Room Checklist Management API Endpoints ---

// GET: Mendapatkan semua item checklist kamar
app.get('/api/room-checklist-items', verifyToken, asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM room_checklist_items ORDER BY item_id ASC');
    res.json(result.rows);
}));

// POST: Menambah item checklist baru
app.post('/api/room-checklist-items', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    try {
        const { item_name } = req.body;
        if (!item_name) return res.status(400).json({ message: 'Nama item tidak boleh kosong.' });
        const newItem = await pool.query('INSERT INTO room_checklist_items (item_name) VALUES ($1) RETURNING *', [item_name]);
        res.status(201).json(newItem.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nama item sudah ada.' });
        next(err);
    }
}));

// PUT: Memperbarui item checklist
app.put('/api/room-checklist-items/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    // CATATAN: Pengecekan dependensi (apakah item ini digunakan dalam inspeksi)
    // belum dapat dilakukan karena skema database saat ini tidak menyimpan detail checklist per inspeksi.
    // Jika skema diperluas, tambahkan logika pengecekan di sini untuk mencegah pengeditan item yang sudah digunakan.
    try {
        const { id } = req.params;
        const { item_name } = req.body;
        if (!item_name) return res.status(400).json({ message: 'Nama item tidak boleh kosong.' });
        const updatedItem = await pool.query('UPDATE room_checklist_items SET item_name = $1 WHERE item_id = $2 RETURNING *', [item_name, id]);
        if (updatedItem.rows.length === 0) return res.status(404).json({ message: 'Item tidak ditemukan.' });
        res.json(updatedItem.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nama item sudah ada.' });
        next(err);
    }
}));

// DELETE: Menghapus item checklist
app.delete('/api/room-checklist-items/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    // CATATAN: Pengecekan dependensi (apakah item ini digunakan dalam inspeksi)
    // belum dapat dilakukan karena skema database saat ini tidak menyimpan detail checklist per inspeksi.
    // Jika skema diperluas, tambahkan logika pengecekan di sini untuk mencegah penghapusan item yang sudah digunakan.
    const { id } = req.params;
    const deleteOp = await pool.query('DELETE FROM room_checklist_items WHERE item_id = $1', [id]);
    if (deleteOp.rowCount === 0) return res.status(404).json({ message: 'Item tidak ditemukan.' });
    res.status(204).send();
}));

// --- Area Checklist Management API Endpoints ---

// GET: Mendapatkan semua item checklist area
app.get('/api/area-checklist-items', verifyToken, asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM area_checklist_items ORDER BY item_id ASC');
    res.json(result.rows);
}));

// POST: Menambah item checklist area baru
app.post('/api/area-checklist-items', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    try {
        const { item_name } = req.body;
        if (!item_name) return res.status(400).json({ message: 'Nama item tidak boleh kosong.' });
        const newItem = await pool.query('INSERT INTO area_checklist_items (item_name) VALUES ($1) RETURNING *', [item_name]);
        res.status(201).json(newItem.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nama item sudah ada.' });
        next(err);
    }
}));

// PUT: Memperbarui item checklist area
app.put('/api/area-checklist-items/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    // CATATAN: Pengecekan dependensi (apakah item ini digunakan dalam inspeksi)
    // belum dapat dilakukan karena skema database saat ini tidak menyimpan detail checklist per inspeksi.
    // Jika skema diperluas, tambahkan logika pengecekan di sini untuk mencegah pengeditan item yang sudah digunakan.
    try {
        const { id } = req.params;
        const { item_name } = req.body;
        if (!item_name) return res.status(400).json({ message: 'Nama item tidak boleh kosong.' });
        const updatedItem = await pool.query('UPDATE area_checklist_items SET item_name = $1 WHERE item_id = $2 RETURNING *', [item_name, id]);
        if (updatedItem.rows.length === 0) return res.status(404).json({ message: 'Item tidak ditemukan.' });
        res.json(updatedItem.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nama item sudah ada.' });
        next(err);
    }
}));

// DELETE: Menghapus item checklist area
app.delete('/api/area-checklist-items/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    // CATATAN: Pengecekan dependensi (apakah item ini digunakan dalam inspeksi)
    // belum dapat dilakukan karena skema database saat ini tidak menyimpan detail checklist per inspeksi.
    // Jika skema diperluas, tambahkan logika pengecekan di sini untuk mencegah penghapusan item yang sudah digunakan.
    const { id } = req.params;
    const deleteOp = await pool.query('DELETE FROM area_checklist_items WHERE item_id = $1', [id]);
    if (deleteOp.rowCount === 0) return res.status(404).json({ message: 'Item tidak ditemukan.' });
    res.status(204).send();
}));

// --- User Management API Endpoints (Admin Only) ---

// GET: Mendapatkan semua pengguna
app.get('/api/users', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const result = await pool.query(`
        SELECT 
            u.user_id, 
            u.username, 
            u.email, 
            u.role,
            COALESCE(
                (SELECT json_agg(h.hotel_name) FROM user_hotels uh JOIN hotels h ON uh.hotel_id = h.hotel_id WHERE uh.user_id = u.user_id),
                '[]'::json
            ) as assigned_hotels
        FROM users u 
        ORDER BY u.username ASC
    `);
    res.json(result.rows);
}));

// GET: Mendapatkan daftar pengguna yang dapat ditugaskan (untuk form WO)
// Endpoint ini aman untuk diakses oleh admin dan inspector.
app.get('/api/users/assignable', [verifyToken, authorize(['admin', 'inspector'])], asyncHandler(async (req, res) => {
    const query = `
        SELECT user_id, username, role 
        FROM users 
        WHERE role IN ('admin', 'inspector', 'teknisi')
        ORDER BY username ASC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
}));

// POST: Menambah pengguna baru
app.post('/api/users', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    try {
        const { username, email, password, role } = req.body;
        if (!username || !email || !password || !role) {
            return res.status(400).json({ message: 'Semua field (username, email, password, role) diperlukan.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING user_id, username, email, role',
            [username, email, password_hash, role]
        );

        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // unique_violation
            return res.status(409).json({ message: 'Username atau email sudah ada.' });
        }
        next(err);
    }
}));

// PUT: Memperbarui pengguna
app.put('/api/users/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        const { username, email, role, password } = req.body;

        if (!username || !email || !role) {
            return res.status(400).json({ message: 'Username, email, dan role diperlukan.' });
        }

        let queryText;
        let queryParams;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            queryText = 'UPDATE users SET username = $1, email = $2, role = $3, password_hash = $4 WHERE user_id = $5 RETURNING user_id, username, email, role';
            queryParams = [username, email, role, password_hash, id];
        } else {
            queryText = 'UPDATE users SET username = $1, email = $2, role = $3 WHERE user_id = $4 RETURNING user_id, username, email, role';
            queryParams = [username, email, role, id];
        }

        const updatedUser = await pool.query(queryText, queryParams);
        if (updatedUser.rows.length === 0) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
        res.json(updatedUser.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Username atau email sudah ada.' });
        next(err);
    }
}));

// DELETE: Menghapus pengguna
app.delete('/api/users/:id', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (req.user.user.id == id) return res.status(403).json({ message: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    const deleteOp = await pool.query('DELETE FROM users WHERE user_id = $1', [id]);
    if (deleteOp.rowCount === 0) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    res.status(204).send();
}));

// --- User-Hotel Assignment Endpoints (Admin Only) ---

// GET: Mendapatkan hotel yang ditugaskan untuk seorang pengguna
app.get('/api/users/:id/hotels', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT hotel_id FROM user_hotels WHERE user_id = $1', [id]);
    res.json(result.rows.map(r => r.hotel_id)); // Return array of IDs
}));

// PUT: Memperbarui daftar hotel yang ditugaskan untuk seorang pengguna
app.put('/api/users/:id/hotels', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { hotelIds } = req.body; // Expect an array of hotel IDs

    if (!Array.isArray(hotelIds)) {
        return res.status(400).json({ message: 'hotelIds harus berupa array.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM user_hotels WHERE user_id = $1', [id]);
        for (const hotelId of hotelIds) {
            await client.query('INSERT INTO user_hotels (user_id, hotel_id) VALUES ($1, $2)', [id, hotelId]);
        }
        await client.query('COMMIT');
        res.json({ message: 'Penugasan hotel berhasil diperbarui.' });
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}));

// GET: Mendapatkan informasi peran (roles)
app.get('/api/roles', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const query = `
        SELECT
            r.role_name,
            r.display_name,
            r.description,
            COALESCE(json_agg(rp.permission_id) FILTER (WHERE rp.permission_id IS NOT NULL), '[]'::json) as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.role_name = rp.role_name
        GROUP BY r.role_name, r.display_name, r.description
        ORDER BY r.role_name;
    `;
    const { rows: roles } = await pool.query(query);
    res.json(roles);
}));

// GET: Mendapatkan semua izin yang tersedia
app.get('/api/permissions', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const { rows: permissions } = await pool.query('SELECT permission_id, description FROM permissions ORDER BY permission_id');
    res.json(permissions);
}));

// PUT: Memperbarui izin untuk sebuah peran
app.put('/api/roles/:role_name/permissions', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const { role_name } = req.params;
    const { permissions } = req.body; // Array of permission_id

    if (role_name === 'admin') {
        return res.status(400).json({ message: 'Hak akses Administrator tidak dapat diubah.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Hapus semua izin lama untuk peran ini
        await client.query('DELETE FROM role_permissions WHERE role_name = $1', [role_name]);

        // Masukkan izin baru
        if (permissions && permissions.length > 0) {
            const insertQuery = 'INSERT INTO role_permissions (role_name, permission_id) VALUES ' +
                permissions.map((_, i) => `($1, $${i + 2})`).join(',');
            
            await client.query(insertQuery, [role_name, ...permissions]);
        }

        await client.query('COMMIT');
        res.json({ message: `Hak akses untuk peran ${role_name} berhasil diperbarui.` });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

// =================================================================
// WORKING ORDER ENDPOINTS
// =================================================================

// GET: Mendapatkan semua working orders
app.get('/api/working-orders', [verifyToken], asyncHandler(async (req, res) => {
    const { status, assignee } = req.query;

    let baseQuery = `
        SELECT
            wo.wo_id,
            wo.inspection_id,
            wo.priority,
            wo.status,
            wo.assignee_id,
            u.username AS assignee_name,
            wo.target_completion_date,
            i.target_id,
            h.hotel_name
        FROM working_orders wo
        LEFT JOIN users u ON wo.assignee_id = u.user_id
        JOIN inspections i ON wo.inspection_id = i.inspection_id
        JOIN hotels h ON i.hotel_id = h.hotel_id
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (status) {
        conditions.push(`wo.status = $${paramIndex++}`);
        values.push(status);
    }

    if (assignee) {
        // Gunakan ILIKE untuk pencarian nama yang tidak case-sensitive
        conditions.push(`u.username ILIKE $${paramIndex++}`);
        values.push(`%${assignee}%`);
    }

    if (conditions.length > 0) {
        baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    baseQuery += ' ORDER BY wo.created_at DESC';

    const { rows } = await pool.query(baseQuery, values);
    res.json(rows);
}));

// GET: /api/working-orders/recent - Get recent WO activities
app.get('/api/working-orders/recent', [verifyToken], asyncHandler(async (req, res) => {
    const { hotel_id } = req.query;
    const limit = 5; // Batasi hingga 5 aktivitas WO terbaru

    const params = [];
    let whereClause = '';
    let whereAndClause = '';

    if (hotel_id) {
        params.push(hotel_id);
        whereClause = `WHERE i.hotel_id = $1`;
        whereAndClause = `AND i.hotel_id = $1`;
    }

    const query = `
        SELECT * FROM (
            -- Aktivitas Pembuatan WO
            SELECT
                wo.wo_id,
                wo.status,
                'WO_CREATED' AS event_type,
                wo.created_at AS event_timestamp,
                to_char(wo.created_at, 'DD Mon YYYY, HH24:MI') as formatted_date,
                i.target_id,
                i.inspection_type,
                u.username AS assignee_name
            FROM working_orders wo
            JOIN inspections i ON wo.inspection_id = i.inspection_id
            LEFT JOIN users u ON wo.assignee_id = u.user_id
            ${whereClause}

            UNION ALL

            -- Aktivitas Pembaruan Status WO (hanya jika ada perubahan signifikan)
            SELECT wo.wo_id, wo.status, 'WO_UPDATED' AS event_type, wo.updated_at AS event_timestamp, to_char(wo.updated_at, 'DD Mon YYYY, HH24:MI') as formatted_date, i.target_id, i.inspection_type, u.username AS assignee_name
            FROM working_orders wo JOIN inspections i ON wo.inspection_id = i.inspection_id LEFT JOIN users u ON wo.assignee_id = u.user_id
            WHERE wo.updated_at > wo.created_at + interval '1 minute' ${whereAndClause}
        ) as recent_activities
        ORDER BY event_timestamp DESC
        LIMIT ${limit};
    `;

    const { rows } = await pool.query(query, params);
    res.json(rows);
}));

// GET: Mendapatkan satu working order by ID
app.get('/api/working-orders/:id', [verifyToken], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT
            wo.*,
            i.notes AS inspection_notes,
            i.target_id,
            h.hotel_name,
            u.username AS assignee_name,
            (SELECT json_agg(json_build_object('id', p.wo_photo_id, 'path', p.file_path)) FROM working_order_photos p WHERE p.wo_id = wo.wo_id) as photos
        FROM working_orders wo
        JOIN inspections i ON wo.inspection_id = i.inspection_id
        JOIN hotels h ON i.hotel_id = h.hotel_id
        LEFT JOIN users u ON wo.assignee_id = u.user_id
        WHERE wo.wo_id = $1
    `;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
        return res.status(404).json({ message: 'Working Order tidak ditemukan.' });
    }
    const woData = rows[0];
    woData.photos = woData.photos || []; // Pastikan photos adalah array, bukan null
    res.json(woData);
}));


// POST: Membuat working order baru
app.post('/api/working-orders', [verifyToken, verifyPermission('manage_wo')], asyncHandler(async (req, res) => {
    const {
        priority,
        inspection_id,
        status,
        assignee_id,
        start_date,
        target_completion_date,
        materials
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const woQuery = `
            INSERT INTO working_orders (inspection_id, status, priority, assignee_id, start_date, target_completion_date, materials, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *;
        `;
        const woValues = [inspection_id, status, priority || 'Sedang', assignee_id || null, start_date || null, target_completion_date || null, materials];
        const newWo = await client.query(woQuery, woValues);

        const inspectionUpdateQuery = `
            UPDATE inspections SET overall_status = 'In Progress' WHERE inspection_id = $1;
        `;
        await client.query(inspectionUpdateQuery, [inspection_id]);

        await client.query('COMMIT');
        res.status(201).json(newWo.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { // unique_violation
            return res.status(409).json({ message: 'Sudah ada Working Order untuk inspeksi ini.' });
        }
        throw error;
    } finally {
        client.release();
    }
}));

// PUT: Memperbarui working order
app.put('/api/working-orders/:id', [verifyToken], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, priority, assignee_id, start_date, target_completion_date, materials } = req.body;
    const { role, id: userId } = req.user.user;

    // Cek izin secara manual karena logikanya kompleks
    const woCheck = await pool.query('SELECT assignee_id FROM working_orders WHERE wo_id = $1', [id]);
    if (woCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Working Order tidak ditemukan.' });
    }
    const currentAssigneeId = woCheck.rows[0].assignee_id;

    const canManage = await hasPermission(role, 'manage_wo');
    const canUpdateOwn = await hasPermission(role, 'update_own_wo');

    if (!canManage && !(canUpdateOwn && currentAssigneeId === userId)) {
        return res.status(403).json({ message: 'Akses ditolak: Anda tidak memiliki izin untuk memperbarui Working Order ini.' });
    }

    // Jika pengguna adalah teknisi, mereka tidak bisa mengubah penugasan
    if (role === 'teknisi' && assignee_id && assignee_id != currentAssigneeId) {
        return res.status(403).json({ message: 'Akses ditolak: Anda tidak dapat mengubah penugasan Working Order.' });
    }


    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const query = `
            UPDATE working_orders
            SET status = $1, priority = $2, assignee_id = $3, start_date = $4, target_completion_date = $5, materials = $6,
                actual_completion_date = CASE WHEN $8 = 'Completed' AND actual_completion_date IS NULL THEN NOW() ELSE actual_completion_date END,
                updated_at = NOW()
            WHERE wo_id = $7 RETURNING *;
        `;
        const values = [status, priority, assignee_id || null, start_date || null, target_completion_date || null, materials, id, status];
        const { rows } = await client.query(query, values);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Working Order tidak ditemukan.' });
        }

        const updatedWo = rows[0];

        // Jika status WO adalah 'Completed', perbarui status inspeksi terkait menjadi 'Baik'
        if (status === 'Completed') {
            const inspectionUpdateQuery = `
                UPDATE inspections SET overall_status = 'Baik', completion_time = NOW()
                WHERE inspection_id = $1;
            `;
            await client.query(inspectionUpdateQuery, [updatedWo.inspection_id]);
        }

        await client.query('COMMIT');
        res.json(updatedWo);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error; // Teruskan ke middleware penanganan error global
    } finally {
        client.release();
    }
}));

// DELETE: Menghapus working order
app.delete('/api/working-orders/:id', [verifyToken, verifyPermission('manage_wo')], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const deleteOp = await pool.query('DELETE FROM working_orders WHERE wo_id = $1', [id]);
    if (deleteOp.rowCount === 0) return res.status(404).json({ message: 'Working Order tidak ditemukan.' });
    res.status(204).send();
}));

// POST: Upload photos for a working order
app.post('/api/working-orders/:id/photos', [verifyToken, uploadWoPhotos.array('photos', 5)], asyncHandler(async (req, res) => {
    const { id } = req.params; // wo_id
    const files = req.files;
    const { role, id: userId } = req.user.user;

    // Cek izin secara manual
    const woCheck = await pool.query('SELECT assignee_id FROM working_orders WHERE wo_id = $1', [id]);
    if (woCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Working Order tidak ditemukan.' });
    }
    const currentAssigneeId = woCheck.rows[0].assignee_id;

    const canManage = await hasPermission(role, 'manage_wo');
    const canUpdateOwn = await hasPermission(role, 'update_own_wo');

    if (!canManage && !(canUpdateOwn && currentAssigneeId === userId)) {
        return res.status(403).json({ message: 'Akses ditolak: Anda tidak memiliki izin untuk mengunggah foto ke WO ini.' });
    }


    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertPromises = files.map(file => {
            const filePath = `/uploads/wo-photos/${file.filename}`;
            return client.query(
                'INSERT INTO working_order_photos (wo_id, file_path) VALUES ($1, $2)',
                [id, filePath]
            );
        });
        await Promise.all(insertPromises);
        await client.query('COMMIT');
        res.status(201).json({ message: `${files.length} foto berhasil diunggah.` });
    } catch (error) {
        await client.query('ROLLBACK');
        // Hapus file yang sudah terunggah jika terjadi error database
        files.forEach(file => fs.unlinkSync(file.path));
        throw error;
    } finally {
        client.release();
    }
}));

// DELETE: Menghapus satu foto working order
app.delete('/api/working-orders/photos/:photo_id', [verifyToken], asyncHandler(async (req, res) => {
    const { photo_id } = req.params;
    const { role, id: userId } = req.user.user;

    // Cek izin secara manual
    const photoCheck = await pool.query(
        'SELECT wo.assignee_id FROM working_order_photos wop JOIN working_orders wo ON wop.wo_id = wo.wo_id WHERE wop.wo_photo_id = $1',
        [photo_id]
    );
    if (photoCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Foto tidak ditemukan.' });
    }
    const currentAssigneeId = photoCheck.rows[0].assignee_id;
    const canManage = await hasPermission(role, 'manage_wo');
    const canUpdateOwn = await hasPermission(role, 'update_own_wo');
    if (!canManage && !(canUpdateOwn && currentAssigneeId === userId)) {
        return res.status(403).json({ message: 'Akses ditolak: Anda tidak dapat menghapus foto ini.' });
    }

    const { rows } = await pool.query('SELECT file_path FROM working_order_photos WHERE wo_photo_id = $1', [photo_id]);
    await pool.query('DELETE FROM working_order_photos WHERE wo_photo_id = $1', [photo_id]);
    if (rows.length > 0) {
        fs.unlink(path.join(__dirname, rows[0].file_path), (err) => { if (err) console.error("Gagal hapus file fisik:", err); });
    }
    res.status(204).send();
}));

// Helper function untuk cek izin di dalam endpoint yang kompleks
async function hasPermission(role, permissionId) {
    if (role === 'admin') return true;
    const { rows } = await pool.query(
        'SELECT 1 FROM role_permissions WHERE role_name = $1 AND permission_id = $2',
        [role, permissionId]
    );
    return rows.length > 0;
}

// =================================================================
// SETTINGS ENDPOINTS
// =================================================================

// POST: Reset inspection and WO sequences
app.post('/api/settings/reset-sequences', [verifyToken, verifyPermission('manage_settings')], asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Hapus data yang bergantung terlebih dahulu untuk menghindari error foreign key
        await client.query('DELETE FROM working_order_photos;');
        await client.query('DELETE FROM working_orders;');
        await client.query('DELETE FROM inspection_photos;');
        await client.query('DELETE FROM inspections;');

        // Atur ulang sequence counter ke 1
        await client.query('ALTER SEQUENCE inspections_inspection_id_seq RESTART WITH 1;');
        await client.query('ALTER SEQUENCE working_orders_wo_id_seq RESTART WITH 1;');

        await client.query('COMMIT');
        res.json({ message: 'Semua data inspeksi dan working order telah dihapus, dan penomoran berhasil direset ke 1.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error resetting sequences:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server saat mereset data.' });
    } finally {
        client.release();
    }
}));

// Middleware Penanganan Error Global (letakkan di paling akhir, sebelum app.listen)
app.use((err, req, res, next) => {
    console.error('UNHANDLED ERROR:', err); // Log the full error object for debugging

    const statusCode = err.status || 500;
    
    // Default response for production
    const response = {
        message: 'Terjadi kesalahan internal pada server.',
        code: err.code || null,
    };

    // For specific, "safe" errors, we can provide a better message even in production
    if (err.code === '23503') { // foreign_key_violation
        response.message = 'Operasi gagal karena data ini terkait dengan data lain yang sudah ada.';
    } else if (err.code === '23505') { // unique_violation
        response.message = 'Gagal karena data yang dimasukkan sudah ada (duplikat).';
    } else if (statusCode < 500) {
        // For client errors (4xx), the original message is usually safe to send
        response.message = err.message;
    }

    // In development, we want all the details for easier debugging
    if (!isProduction) {
        response.message = err.message;
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
});

// Menjalankan server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
