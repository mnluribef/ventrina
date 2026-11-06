// src/scripts/precios.ts
// Script de animaciones de reveal para la página /precios

/**
 * Inicializa el IntersectionObserver para las animaciones de reveal
 * en los elementos con clase `.reveal` de la página de precios.
 */
function initPreciosReveals(): void {
    // Si el navegador soporta CSS Scroll-Driven Animations (animation-timeline: view()),
    // evitamos el uso de IntersectionObserver en JavaScript.
    if (typeof window !== 'undefined' && window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()')) {
        return;
    }

    const reveals = document.querySelectorAll<HTMLElement>('.reveal');

    const revealObserver = new IntersectionObserver(
        (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        },
        { rootMargin: '0px 0px -40px 0px' },
    );

    if (reveals.length > 0) {
        reveals.forEach((reveal) => revealObserver.observe(reveal));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreciosReveals);
} else {
    initPreciosReveals();
}
