// src/scripts/landing.ts
// Lógica de interacción para la Landing Page de Ventrina (FAQ accordion, smooth scroll, etc.)
import { BcvCurrencyService, formatBsCurrency } from './services/bcv.service';
import { initScrollReveal } from './utils/reveal.util';

type BillingCycle = 'annual' | 'monthly';

function initPricingSwitcher(): void {
    const switcherBtns = document.querySelectorAll<HTMLButtonElement>(
        '.pricing-preview-section [data-billing-toggle]',
    );
    const priceElements = document.querySelectorAll<HTMLElement>(
        '.pricing-preview-section [data-price-annual][data-price-monthly]',
    );
    const billingNotes = document.querySelectorAll<HTMLElement>(
        '.pricing-preview-section [data-billing-annual][data-billing-monthly]',
    );

    if (!switcherBtns.length) return;

    function setBilling(cycle: BillingCycle): void {
        switcherBtns.forEach((btn) => {
            const isTarget = btn.getAttribute('data-billing-toggle') === cycle;
            btn.classList.toggle('active', isTarget);
            btn.setAttribute('aria-pressed', isTarget ? 'true' : 'false');
        });

        priceElements.forEach((el) => {
            const annualPrice = el.getAttribute('data-price-annual');
            const monthlyPrice = el.getAttribute('data-price-monthly');
            const newPrice = cycle === 'annual' ? annualPrice : monthlyPrice;

            if (newPrice && el.textContent !== newPrice) {
                el.classList.add('price-updating');
                setTimeout(() => {
                    el.textContent = newPrice;
                    el.classList.remove('price-updating');
                }, 120);
            }
        });

        billingNotes.forEach((el) => {
            const annualNote = el.getAttribute('data-billing-annual');
            const monthlyNote = el.getAttribute('data-billing-monthly');
            const newNote = cycle === 'annual' ? annualNote : monthlyNote;
            if (newNote) {
                el.textContent = newNote;
            }
        });
    }

    switcherBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const cycle = btn.getAttribute('data-billing-toggle') as BillingCycle;
            if (cycle) {
                setBilling(cycle);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // 0. Inicialización de Scroll Reveal de Alto Rendimiento (Stripe / Linear Model)
    initScrollReveal(
        '.reveal, .contrast-card, .feature-box, .demo-card-light, .ticker-item, .pricing-preview-card, .pricing-card-preview, .testimonials-grid .testimonial-card, .testimonial-card-light, .faq-item-modern, .cta-banner-card',
    );

    // 1. FAQ Accordion Interactivo
    const faqButtons = document.querySelectorAll('.faq-question-btn');
    faqButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const currentItem = btn.closest('.faq-item-modern');
            if (!currentItem) return;

            const isOpen = currentItem.classList.contains('active');

            // Cierra todos los demás
            document.querySelectorAll('.faq-item-modern').forEach((item) => {
                item.classList.remove('active');
            });

            // Alterna el actual
            if (!isOpen) {
                currentItem.classList.add('active');
            }
        });
    });

    // 2. Billing Switcher Interactivo de Planes
    initPricingSwitcher();

    // 3. Navbar scroll effect (fallback si el navegador no soporta CSS Scroll-Driven Animations)
    const navbar = document.querySelector('.glass-nav');
    const supportsScrollDrivenTimeline =
        typeof window !== 'undefined' &&
        window.CSS &&
        CSS.supports &&
        CSS.supports('animation-timeline', 'scroll()');

    if (navbar && !supportsScrollDrivenTimeline) {
        window.addEventListener(
            'scroll',
            () => {
                if (window.scrollY > 20) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            },
            { passive: true },
        );
    }

    // 4. Sincronización en vivo de la Tasa Oficial BCV para mockups interactivos
    const heroWaTotal = document.getElementById('hero-wa-total');
    const dashBcvRate = document.getElementById('dash-bcv-rate');

    if (heroWaTotal || dashBcvRate) {
        const currencyService = new BcvCurrencyService();

        const updateLandingRates = (rate: number) => {
            if (rate <= 0) return;
            if (heroWaTotal) {
                const totalBs = 45.0 * rate;
                heroWaTotal.textContent = `Total: $45.00 ≈ Bs. ${formatBsCurrency(totalBs)}`;
            }
            if (dashBcvRate) {
                dashBcvRate.textContent = `${formatBsCurrency(rate)} Bs`;
            }
        };

        currencyService.onRateChange(updateLandingRates);
        currencyService
            .fetchRate()
            .then((rate) => {
                updateLandingRates(rate);
            })
            .catch(() => {
                // Preservar valores pre-renderizados
            });
    }
});
