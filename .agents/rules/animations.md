---
title: "Directrices de Animaciones"
trigger: "always_on"
---

# Directrices de Animaciones

1. **Scroll-Driven Animations (CSS nativo)**:
   - Siempre que sea posible, utilizar [CSS Scroll-Driven Animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations) (`animation-timeline: view()`, `animation-timeline: scroll()`, `view-timeline`, `animation-range`, etc.) en lugar de JavaScript o TypeScript (`IntersectionObserver`, `window.addEventListener('scroll')`, etc.).
   - Utilizar `@supports (animation-timeline: view())` para progressive enhancement, garantizando que el contenido permanezca visible si el navegador no soporta la API.

2. **Cero CSS/JS inline**:
   - Todas las reglas y `@keyframes` deben ubicarse en archivos de estilos correspondientes (`src/styles/*.css`), nunca en atributos `style="..."` ni en etiquetas `<script>`/`<style>` inline.

