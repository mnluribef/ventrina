// src/scripts/precios.ts
// Animaciones de reveal fluidas para la página de precios
import { initScrollReveal } from './utils/reveal.util';

function initPreciosReveals(): void {
    initScrollReveal('.reveal');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreciosReveals);
} else {
    initPreciosReveals();
}
