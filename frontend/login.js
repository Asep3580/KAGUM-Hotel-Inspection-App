document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorDiv = document.getElementById('login-error');
    const loginButton = loginForm.querySelector('button[type="submit"]');

    // Jika sudah ada token, langsung arahkan ke halaman utama
    if (localStorage.getItem('authToken')) {
        window.location.href = 'index.html';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
        loginButton.disabled = true;
        loginButton.textContent = 'Memproses...';

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('${API_BASE_URL}/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login gagal.');
            }

            // Simpan token di localStorage untuk persistensi
            localStorage.setItem('authToken', data.token);
            window.location.href = 'index.html'; // Arahkan ke halaman utama
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });

});
