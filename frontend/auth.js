// Skrip ini harus disertakan di index.html sebelum script.js

// --- Pemeriksaan Autentikasi ---
// Jika tidak ada token, arahkan ke halaman login.
if (!localStorage.getItem('authToken')) {
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-btn');
    
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            // Hapus token dari localStorage
            localStorage.removeItem('authToken');
            // Arahkan ke halaman login
            window.location.href = 'login.html';
        });
    }
});