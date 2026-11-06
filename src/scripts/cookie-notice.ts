// src/scripts/cookie-notice.ts
// Gestión de consentimiento de almacenamiento local y cookies técnicas

function initCookieNotice(): void {
    const banner = document.getElementById('cookie-notice');
    const acceptBtn = document.getElementById('cookie-accept-btn');

    if (!banner || !acceptBtn) return;

    let hasConsent = false;
    try {
        const consent = localStorage.getItem('ventrina_cookie_consent');
        if (consent === 'true' || consent === 'accepted') {
            hasConsent = true;
        }
    } catch {
        // En caso de modo incógnito estricto con cookies o storage bloqueados
    }

    if (!hasConsent) {
        banner.classList.add('cookie-notice-visible');
    }

    let isDismissing = false;

    const dismissBanner = (): void => {
        if (isDismissing) return;
        isDismissing = true;

        try {
            localStorage.setItem('ventrina_cookie_consent', 'true');
        } catch {
            // Manejo silencioso en caso de almacenamiento no disponible
        }

        banner.classList.add('cookie-notice-hiding');

        const handleDismissEnd = (): void => {
            banner.classList.remove('cookie-notice-visible', 'cookie-notice-hiding');
            banner.setAttribute('aria-hidden', 'true');
        };

        banner.addEventListener('animationend', handleDismissEnd, { once: true });
        // Respaldo de seguridad en caso de que animationend no se dispare
        window.setTimeout(handleDismissEnd, 300);
    };

    acceptBtn.addEventListener('click', dismissBanner);

    const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && banner.classList.contains('cookie-notice-visible')) {
            dismissBanner();
        }
    };

    document.addEventListener('keydown', handleKeyDown);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieNotice);
} else {
    initCookieNotice();
}
