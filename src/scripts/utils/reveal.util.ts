/**
 * Arquitectura de Animaciones Scroll-Triggered de Alto Rendimiento (Stripe / Linear Model)
 * Utiliza IntersectionObserver con desconexión inmediata (unobserve) para delegar
 * la interpolación temporal inercial (cubic-bezier) al compositor de GPU del navegador.
 */
export function initScrollReveal(selector = '.reveal', threshold = 0.1): void {
    if (typeof window === 'undefined') return;

    // Si el usuario tiene activada la preferencia de movimiento reducido, revelar de inmediato
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    const reveals = document.querySelectorAll<HTMLElement>(selector);
    if (!reveals.length) return;

    const revealElement = (el: HTMLElement) => {
        if (el.classList.contains('faq-item-modern')) {
            el.classList.add('active-reveal');
        } else {
            el.classList.add('active', 'is-revealed');
        }
    };

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
        reveals.forEach(revealElement);
        return;
    }

    const observer = new IntersectionObserver(
        (entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    revealElement(entry.target as HTMLElement);
                    obs.unobserve(entry.target);
                }
            });
        },
        {
            threshold,
            rootMargin: '0px 0px -40px 0px',
        },
    );

    reveals.forEach((el) => {
        // Fast-path: Si el elemento ya está dentro o por encima del viewport inicial (above-the-fold),
        // revelarlo de inmediato para evitar cualquier retraso o parpadeo inicial.
        const rect = el.getBoundingClientRect();
        if (rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.95 && rect.bottom >= 0) {
            revealElement(el);
        } else {
            observer.observe(el);
        }
    });
}
