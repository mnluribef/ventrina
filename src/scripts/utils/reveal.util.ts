export function initScrollReveal(selector = '.reveal', threshold = 0.15): void {
    // Si el navegador soporta CSS Scroll-Driven Animations (animation-timeline: view()),
    // evitamos registrar IntersectionObserver y delegamos la animación al compositor de CSS.
    if (typeof window !== 'undefined' && window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()')) {
        return;
    }

    const reveals = document.querySelectorAll<HTMLElement>(selector);
    if (!reveals.length) return;

    const observer = new IntersectionObserver(
        (entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    obs.unobserve(entry.target);
                }
            });
        },
        { threshold },
    );

    reveals.forEach((el) => observer.observe(el));
}
