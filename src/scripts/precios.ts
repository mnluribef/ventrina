// src/scripts/precios.ts
// Lógica interactiva para la página de Planes y Precios (/precios)
import { initScrollReveal } from './utils/reveal.util';

type BillingCycle = 'annual' | 'monthly';

function initBillingSwitcher(): void {
    const switcherBtns = document.querySelectorAll<HTMLButtonElement>('[data-billing-toggle]');
    const priceElements = document.querySelectorAll<HTMLElement>('[data-price-annual][data-price-monthly]');
    const billingNotes = document.querySelectorAll<HTMLElement>('[data-billing-annual][data-billing-monthly]');
    const stickyPriceVal = document.querySelector<HTMLElement>('[data-sticky-price]');

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

        if (stickyPriceVal) {
            stickyPriceVal.textContent = cycle === 'annual' ? '$15' : '$19';
        }
    }

    switcherBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetCycle = btn.getAttribute('data-billing-toggle') as BillingCycle;
            if (targetCycle) {
                setBilling(targetCycle);
            }
        });
    });
}

function initFaqAccordion(): void {
    const faqItems = document.querySelectorAll<HTMLDetailsElement>('details.faq-accordion-item');
    if (!faqItems.length) return;

    // Sincronización para garantizar comportamiento de acordeón único entre navegadores
    faqItems.forEach((item) => {
        item.addEventListener('toggle', () => {
            if (item.open) {
                faqItems.forEach((other) => {
                    if (other !== item && other.open) {
                        other.open = false;
                    }
                });
            }
        });
    });
}

function initPreciosPage(): void {
    initScrollReveal('.reveal');
    initBillingSwitcher();
    initFaqAccordion();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreciosPage);
} else {
    initPreciosPage();
}
