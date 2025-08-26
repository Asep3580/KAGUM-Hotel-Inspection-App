document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reset-password-form');
    const messageDiv = document.getElementById('form-message');
    const submitButton = form.querySelector('button[type="submit"]');
    const loginLink = document.getElementById('login-link');

    // 1. Dapatkan token dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        messageDiv.textContent = 'Token reset tidak valid atau tidak ditemukan. Silakan coba lagi dari halaman lupa password.';
        messageDiv.className = 'text-sm text-center text-red-500';
        submitButton.disabled = true;
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Reset pesan
        messageDiv.textContent = '';

        // 2. Validasi password di frontend
        if (password.length < 6) {
            messageDiv.textContent = 'Password minimal harus 6 karakter.';
            messageDiv.className = 'text-sm text-center text-red-500';
            return;
        }

        if (password !== confirmPassword) {
            messageDiv.textContent = 'Password dan konfirmasi password tidak cocok.';
            messageDiv.className = 'text-sm text-center text-red-500';
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Memproses...';

        try {
            // 3. Kirim permintaan ke backend
            const response = await fetch('http://localhost:3000/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Gagal mereset password.');
            }

            // 4. Tampilkan pesan sukses dan sembunyikan form
            messageDiv.textContent = data.message;
            messageDiv.className = 'text-sm text-center text-green-600';
            form.classList.add('hidden');
            loginLink.classList.remove('hidden');
        } catch (error) {
            messageDiv.textContent = error.message;
            messageDiv.className = 'text-sm text-center text-red-500';
            submitButton.disabled = false;
            submitButton.textContent = 'Reset Password';
        }
    });
});