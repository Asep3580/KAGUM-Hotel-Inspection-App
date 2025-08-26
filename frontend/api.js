// File: api.js
// Klien API terpusat untuk semua permintaan ke backend.

const BASE_URL = 'http://localhost:3000/api';

/**
 * Fungsi logout terpusat.
 * Membersihkan token dan mengarahkan pengguna ke halaman login.
 */
function forceLogout() {
    console.error("Sesi kedaluwarsa atau token tidak valid. Melakukan logout...");
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
}

/**
 * Fungsi inti untuk melakukan permintaan fetch.
 * @param {string} endpoint - Endpoint API (misal: '/inspections')
 * @param {object} options - Opsi untuk fetch (method, body, dll.)
 * @returns {Promise<any>} - Data JSON dari respons
 */
async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const token = localStorage.getItem('authToken');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    try {
        const response = await fetch(url, config);

        // **KUNCI UTAMA ADA DI SINI**
        // Jika token kedaluwarsa, server akan mengembalikan 401 Unauthorized.
        if (response.status === 401) {
            forceLogout();
            throw new Error('Sesi Anda telah kedaluwarsa. Silakan login kembali.');
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        return response.status === 204 ? null : response.json();
    } catch (error) {
        console.error('API Client Error:', error.message);
        throw error;
    }
}

// Ekspor metode-metode yang mudah digunakan
export const apiClient = {
    get: (endpoint) => request(endpoint),
    post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};