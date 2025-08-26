document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgot-password-form');
    const messageDiv = document.getElementById('form-message');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;

        messageDiv.textContent = '';
        messageDiv.classList.add('hidden');
        submitButton.disabled = true;
        submitButton.textContent = 'Mengirim...';

        try {
            const response = await fetch('http://localhost:3000/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Terjadi kesalahan.');
            }

            messageDiv.textContent = data.message;
            messageDiv.className = 'text-sm text-center text-green-600';
        } catch (error) {
            messageDiv.textContent = error.message;
            messageDiv.className = 'text-sm text-center text-red-500';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Kirim Link Reset';
        }
    });
});