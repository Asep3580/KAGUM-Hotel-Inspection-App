-- Tabel untuk menyimpan data pengguna (user)
-- File: backend/database.sql
-- Versi: 2.0
-- Deskripsi: Skema basis data yang telah dirapikan dan dinormalisasi untuk aplikasi inspeksi hotel.

-- =================================================================
-- PERINGATAN: Skrip ini akan menghapus tabel dan tipe data yang ada.
-- Jangan jalankan pada basis data produksi tanpa cadangan data.
-- =================================================================
DROP TABLE IF EXISTS working_order_photos CASCADE;
DROP TABLE IF EXISTS working_orders CASCADE;
DROP TABLE IF EXISTS inspection_photos CASCADE;
DROP TABLE IF EXISTS inspection_details CASCADE;
DROP TABLE IF EXISTS inspections CASCADE;
DROP TABLE IF EXISTS user_hotels CASCADE;
DROP TABLE IF EXISTS room_checklist_items CASCADE;
DROP TABLE IF EXISTS area_checklist_items CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS areas CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS hotels CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TYPE IF EXISTS inspection_status CASCADE;


-- =================================================================
-- 1. DEFINISI TIPE DATA (TYPE DEFINITIONS)
-- =================================================================

CREATE TYPE inspection_status AS ENUM ('Baik', 'Kurang', 'In Progress', 'Belum Diinspeksi');

-- =================================================================
-- 2. PEMBUATAN TABEL (TABLE CREATION)
-- =================================================================

-- Tabel inti untuk Role-Based Access Control (RBAC)
CREATE TABLE roles (
    role_name VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT
);
COMMENT ON TABLE roles IS 'Mendefinisikan peran pengguna yang tersedia di sistem (misal: admin, inspector).';

CREATE TABLE permissions (
    permission_id VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255) NOT NULL
);
COMMENT ON TABLE permissions IS 'Mendefinisikan semua kemungkinan tindakan/izin dalam sistem.';

CREATE TABLE role_permissions (
    role_name VARCHAR(50) REFERENCES roles(role_name) ON DELETE CASCADE,
    permission_id VARCHAR(50) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_name, permission_id)
);
COMMENT ON TABLE role_permissions IS 'Menghubungkan peran dengan izin yang ditetapkan.';

-- Tabel entitas inti
CREATE TABLE hotels (
    hotel_id SERIAL PRIMARY KEY,
    hotel_name VARCHAR(255) UNIQUE NOT NULL,
    address TEXT
);
COMMENT ON TABLE hotels IS 'Menyimpan informasi tentang setiap hotel.';

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL REFERENCES roles(role_name) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    password_reset_token TEXT,
    password_reset_expires TIMESTAMPTZ
);
COMMENT ON TABLE users IS 'Menyimpan informasi akun dan kredensial pengguna.';
COMMENT ON COLUMN users.role IS 'Foreign key ke tabel roles. ON DELETE RESTRICT mencegah penghapusan peran jika masih ada pengguna yang ditugaskan.';

CREATE TABLE user_hotels (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    hotel_id INTEGER NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, hotel_id)
);
COMMENT ON TABLE user_hotels IS 'Tabel penghubung untuk relasi many-to-many antara pengguna dan hotel.';

-- Tabel entitas yang dapat diinspeksi
CREATE TABLE rooms (
    room_id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    room_number VARCHAR(10) NOT NULL,
    room_type VARCHAR(50) DEFAULT 'Standard',
    UNIQUE (hotel_id, room_number)
);
COMMENT ON TABLE rooms IS 'Menyimpan data kamar individual untuk setiap hotel.';
COMMENT ON COLUMN rooms.hotel_id IS 'ON DELETE CASCADE memastikan kamar terhapus jika hotel induknya dihapus.';

CREATE TABLE areas (
    area_id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    area_name VARCHAR(100) NOT NULL,
    UNIQUE (hotel_id, area_name)
);
COMMENT ON TABLE areas IS 'Menyimpan area publik yang dapat diinspeksi untuk setiap hotel.';
COMMENT ON COLUMN areas.hotel_id IS 'ON DELETE CASCADE memastikan area terhapus jika hotel induknya dihapus.';

-- Tabel definisi checklist
CREATE TABLE room_checklist_items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(255) UNIQUE NOT NULL
);
COMMENT ON TABLE room_checklist_items IS 'Daftar master item checklist untuk inspeksi kamar.';

CREATE TABLE area_checklist_items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(255) UNIQUE NOT NULL
);
COMMENT ON TABLE area_checklist_items IS 'Daftar master item checklist untuk inspeksi area.';

-- Tabel transaksional
CREATE TABLE inspections (
    inspection_id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL REFERENCES hotels(hotel_id) ON DELETE RESTRICT,
    inspector_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    inspection_type VARCHAR(50) NOT NULL, -- 'Kamar' atau 'Area'
    target_id VARCHAR(100) NOT NULL, -- Sesuai dengan room_number atau area_name
    overall_status inspection_status NOT NULL,
    notes TEXT,
    inspection_date TIMESTAMPTZ DEFAULT NOW(),
    progress_start_time TIMESTAMPTZ,
    completion_time TIMESTAMPTZ
);
COMMENT ON TABLE inspections IS 'Menyimpan catatan dari setiap inspeksi yang dilakukan.';
COMMENT ON COLUMN inspections.hotel_id IS 'ON DELETE RESTRICT mencegah penghapusan hotel jika memiliki catatan inspeksi.';
COMMENT ON COLUMN inspections.inspector_id IS 'Pengguna yang melakukan inspeksi. SET NULL jika pengguna dihapus.';

CREATE TABLE inspection_details (
    detail_id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES inspections(inspection_id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    status inspection_status NOT NULL,
    notes TEXT,
    UNIQUE (inspection_id, item_name)
);
COMMENT ON TABLE inspection_details IS 'Menyimpan status setiap item checklist untuk inspeksi tertentu.';

CREATE TABLE inspection_photos (
    photo_id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES inspections(inspection_id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE inspection_photos IS 'Menyimpan path ke foto yang terkait dengan inspeksi.';

CREATE TABLE working_orders (
    wo_id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL UNIQUE REFERENCES inspections(inspection_id) ON DELETE RESTRICT,
    assignee_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Open',
    priority VARCHAR(20) NOT NULL DEFAULT 'Sedang' CHECK (priority IN ('Rendah', 'Sedang', 'Tinggi')),
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date TIMESTAMPTZ,
    materials TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE working_orders IS 'Menyimpan tugas perbaikan yang dihasilkan dari inspeksi.';
COMMENT ON COLUMN working_orders.inspection_id IS 'WO terikat secara unik ke satu inspeksi. RESTRICT delete untuk memastikan WO tidak menjadi yatim.';
COMMENT ON COLUMN working_orders.assignee_id IS 'Pengguna yang ditugaskan. SET NULL jika pengguna dihapus.';

CREATE TABLE working_order_photos (
    wo_photo_id SERIAL PRIMARY KEY,
    wo_id INTEGER NOT NULL REFERENCES working_orders(wo_id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE working_order_photos IS 'Menyimpan path ke foto yang terkait dengan working order.';

-- =================================================================
-- 3. PEMBUATAN INDEKS (INDEX CREATION)
-- =================================================================

-- Indeks pada foreign key untuk meningkatkan performa JOIN
CREATE INDEX IF NOT EXISTS idx_inspections_hotel_id ON inspections(hotel_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector_id ON inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_rooms_hotel_id ON rooms(hotel_id);
CREATE INDEX IF NOT EXISTS idx_areas_hotel_id ON areas(hotel_id);
CREATE INDEX IF NOT EXISTS idx_wo_assignee_id ON working_orders(assignee_id);

-- =================================================================
-- 4. PENYEMAIAN DATA (DATA SEEDING)
-- =================================================================

-- Data penting untuk RBAC
INSERT INTO roles (role_name, display_name, description) VALUES
('admin', 'Administrator', 'Memiliki akses penuh ke semua fitur, termasuk pengaturan sistem.'),
('inspector', 'Inspector', 'Bertanggung jawab untuk melakukan inspeksi dan membuat Working Order.'),
('teknisi', 'Teknisi', 'Bertanggung jawab untuk mengerjakan dan memperbarui status Working Order.')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO permissions (permission_id, description) VALUES
('view_dashboard', 'Melihat Dasbor'),
('perform_inspection', 'Melakukan Inspeksi'),
('view_reports', 'Melihat Laporan'),
('manage_wo', 'Mengelola Working Order (Membuat, Edit, Hapus)'),
('update_own_wo', 'Memperbarui Working Order milik sendiri'),
('manage_settings', 'Mengakses semua menu Pengaturan')
ON CONFLICT (permission_id) DO NOTHING;

INSERT INTO role_permissions (role_name, permission_id) VALUES
-- Admin memiliki semua izin
('admin', 'view_dashboard'),
('admin', 'perform_inspection'),
('admin', 'view_reports'),
('admin', 'manage_wo'),
('admin', 'manage_settings'),
-- Inspector dapat melakukan sebagian besar hal kecuali pengaturan sistem
('inspector', 'view_dashboard'),
('inspector', 'perform_inspection'),
('inspector', 'view_reports'),
('inspector', 'manage_wo'),
-- Teknisi dapat melihat dasbor dan memperbarui WO mereka sendiri
('teknisi', 'view_dashboard'),
('teknisi', 'update_own_wo')
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- Data checklist default
INSERT INTO room_checklist_items (item_name) VALUES
('Lantai & Karpet'),
('Jendela & Cermin'),
('Kamar Mandi')
ON CONFLICT (item_name) DO NOTHING;

INSERT INTO area_checklist_items (item_name) VALUES
('Kebersihan Umum'),
('Penerangan')
ON CONFLICT (item_name) DO NOTHING;
