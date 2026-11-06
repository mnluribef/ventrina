/**
 * Ventrina SaaS — Legal Pages Interactive Script
 * Archivo: src/scripts/legal.ts
 *
 * Funcionalidades:
 * 1. IntersectionObserver para seguimiento activo del índice lateral y chips móviles.
 * 2. Navegación suave con compensación de altura del encabezado sticky.
 * 3. Copia rápida de enlace permanente (#ancla) con retroalimentación háptica/visual y toast.
 */

// Estado del temporizador del toast
let toastTimeoutId: number | null = null;

/**
 * Muestra el toast de confirmación visual flotante.
 */
function showLegalToast(message: string): void {
    const toast = document.getElementById('legal-toast');
    const toastMsg = toast?.querySelector('.legal-toast-msg');

    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.classList.add('show');

    if (toastTimeoutId !== null) {
        window.clearTimeout(toastTimeoutId);
    }

    toastTimeoutId = window.setTimeout(() => {
        toast.classList.remove('show');
        toastTimeoutId = null;
    }, 2800);
}

/**
 * Copia el texto al portapapeles con fallback robusto.
 */
async function copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Continúa al fallback si falla
        }
    }

    // Fallback tradicional con textarea oculto
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.classList.add('legal-sr-only');
        document.body.appendChild(textArea);
        textArea.select();
        // Fallback para entornos donde clipboard API no esté disponible
        const legacyDoc = document as unknown as { execCommand: (cmd: string) => boolean };
        const success = legacyDoc.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
    } catch {
        return false;
    }
}

/**
 * Inicializa la copia rápida de enlaces permanentes al pulsar en encabezados de cláusula.
 */
function initQuickCopyAnchors(): void {
    const anchorButtons = document.querySelectorAll<HTMLElement>('.legal-clause-anchor-btn');

    anchorButtons.forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();

            const anchorId = btn.getAttribute('data-anchor') || btn.closest<HTMLElement>('.legal-clause')?.id || '';

            if (!anchorId) return;

            const permalink = `${window.location.origin}${window.location.pathname}#${anchorId}`;
            const success = await copyToClipboard(permalink);

            if (success) {
                // Actualiza la URL en la barra sin forzar salto brusco
                try {
                    window.history.replaceState(null, '', `#${anchorId}`);
                } catch {
                    // Ignora si está restringido
                }

                // Estado visual en el botón
                btn.classList.add('copied');
                window.setTimeout(() => {
                    btn.classList.remove('copied');
                }, 2200);

                showLegalToast(`Enlace copiado al portapapeles (#${anchorId})`);
            } else {
                showLegalToast('No se pudo copiar el enlace.');
            }
        });
    });
}

/**
 * Inicializa el observador de intersección y sincronización del índice.
 */
function initTableOfContents(): void {
    const clauses = document.querySelectorAll<HTMLElement>('.legal-clause[id]');
    const sidebarLinks = document.querySelectorAll<HTMLAnchorElement>('.legal-sidebar-link');
    const mobileChips = document.querySelectorAll<HTMLAnchorElement>('.legal-toc-chip');

    if (clauses.length === 0) return;

    // Actualiza la clase activa en escritorio y móvil
    function setActiveId(activeId: string): void {
        sidebarLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (href === `#${activeId}`) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        mobileChips.forEach((chip) => {
            const href = chip.getAttribute('href');
            if (href === `#${activeId}`) {
                chip.classList.add('active');
                // Desplazamiento horizontal centrado en móvil
                chip.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center',
                });
            } else {
                chip.classList.remove('active');
            }
        });
    }

    // Observer con margen para detectar la sección actualmente visible
    const observer = new IntersectionObserver(
        (entries) => {
            const visibleEntries = entries.filter((entry) => entry.isIntersecting);
            if (visibleEntries.length > 0) {
                // Ordenar por cercanía al margen superior
                visibleEntries.sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
                const currentId = visibleEntries[0].target.id;
                if (currentId) {
                    setActiveId(currentId);
                }
            }
        },
        {
            rootMargin: '-90px 0px -55% 0px',
            threshold: [0, 0.2, 0.5],
        },
    );

    clauses.forEach((clause) => observer.observe(clause));

    // Desplazamiento suave al hacer clic en los enlaces del índice
    function setupNavClicks(links: NodeListOf<HTMLAnchorElement>): void {
        links.forEach((link) => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (!href?.startsWith('#')) return;

                e.preventDefault();
                const targetId = href.substring(1);
                const targetEl = document.getElementById(targetId);

                if (targetEl) {
                    const headerOffset = 90;
                    const elementPos = targetEl.getBoundingClientRect().top;
                    const offsetPosition = elementPos + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth',
                    });

                    try {
                        window.history.pushState(null, '', `#${targetId}`);
                    } catch {
                        // Ignora restricciones de iframe
                    }

                    setActiveId(targetId);
                }
            });
        });
    }

    setupNavClicks(sidebarLinks);
    setupNavClicks(mobileChips);

    // Si la URL inicial ya tiene hash, activarlo de inmediato
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && document.getElementById(initialHash)) {
        setActiveId(initialHash);
    } else if (clauses[0]) {
        setActiveId(clauses[0].id);
    }
}

// Inicialización de la lógica
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initTableOfContents();
        initQuickCopyAnchors();
    });
} else {
    initTableOfContents();
    initQuickCopyAnchors();
}
