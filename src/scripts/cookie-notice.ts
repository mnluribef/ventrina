// src/scripts/cookie-notice.ts
// Gestión de consentimiento de almacenamiento local y cookies técnicas

function initCookieNotice() {
    const banner = document.getElementById('cookie-notice');
    const acceptBtn = document.getElementById('cookie-accept-btn');

    if (!banner || !acceptBtn) return;

    try {
        const consent = localStorage.getItem('ventrina_cookie_consent');
        if (!consent) {
            banner.classList.add('cookie-notice-visible');
        }
    } catch {
        // En caso de modo incógnito estricto con cookies bloqueadas
    }

    acceptBtn.addEventListener('click', () => {
        try {
            localStorage.setItem('ventrina_cookie_consent', 'accepted');
        } catch {
            // Manejo silencioso
        }
        banner.classList.remove('cookie-notice-visible');
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieNotice);
} else {
    initCookieNotice();
}
