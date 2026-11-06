import { renderIconSvg } from '../../components/common/icons';
import type { ICurrencyService } from '../services/bcv.service';
import type { CartService } from '../services/cart.service';
import type { IImageService } from '../services/image.service';
import type { IOrderService } from '../services/order.service';
import type { IToastService } from '../services/toast.service';
import type { OrderSubmissionData, StoreMetaConfig } from '../types/catalog.types';

export class CartUIController {
    private cartService: CartService;
    private currencyService: ICurrencyService;
    private orderService: IOrderService;
    private toastService: IToastService;
    private imageService: IImageService;
    private config: StoreMetaConfig;

    private currentStep = 1;
    private uploadedReceiptBase64: string | null = null;
    private receiptFileInput: HTMLInputElement | null = null;
    private appliedCoupon: {
        code: string;
        discountType: 'percentage' | 'fixed';
        discountValue: number;
        minOrderAmount: number;
    } | null = null;
    private pagoMovilAccounts: Array<{
        banco: string;
        telefono: string;
        cedula: string;
        titular?: string;
        isDefault?: boolean;
    }> = [];

    constructor(
        cartService: CartService,
        currencyService: ICurrencyService,
        orderService: IOrderService,
        toastService: IToastService,
        imageService: IImageService,
        config: StoreMetaConfig,
    ) {
        this.cartService = cartService;
        this.currencyService = currencyService;
        this.orderService = orderService;
        this.toastService = toastService;
        this.imageService = imageService;
        this.config = config;

        this.init();
    }

    private init(): void {
        this.bindEvents();
        this.cartService.subscribe(() => {
            this.render();
            this.updateBadge();
        });
        this.currencyService.onRateChange(() => {
            this.renderTotals();
        });

        // Exponer temporalmente para compatibilidad
        (window as any)._cart = {
            updateQty: (key: string, delta: number) => this.cartService.updateQuantity(key, delta),
            removeFromCart: (key: string) => this.cartService.removeItem(key),
        };
        (window as any).goToStep = (step: number) => this.goToStep(step);

        this.updateBadge();
    }

    public render(): void {
        this.renderItems();
        this.renderTotals();
    }

    private updateBadge(): void {
        const total = this.cartService.getTotalCount();
        const badge = document.getElementById('cart-count');
        const btn = document.getElementById('cart-btn');
        if (badge) badge.textContent = String(total);
        if (btn) btn.classList.toggle('visible', total > 0);
    }

    private getEmptyStateHtml(): string {
        return `
            <div class="cart-empty-card">
                <div class="cart-empty-icon-wrap">
                    <svg class="cart-empty-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                        <path d="M3 6h18" />
                        <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                </div>
                <h4 class="cart-empty-title">Tu carrito está listo para llenarse</h4>
                <p class="cart-empty-desc">Explora nuestros productos artesanales, agrégalos a tu orden y finaliza tu pedido por WhatsApp en minutos.</p>
                <button type="button" id="cart-explore-btn" class="cart-empty-btn">
                    <span>Explorar Catálogo</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                    </svg>
                </button>
            </div>
        `;
    }

    private renderItems(): void {
        const container = document.getElementById('cart-items');
        const totalFixed = document.getElementById('cart-total-fixed');
        const nextBtn = document.getElementById('cart-next-btn') as HTMLButtonElement | null;
        if (!container) return;

        const items = this.cartService.getItems();

        if (items.length === 0) {
            container.innerHTML = this.getEmptyStateHtml();
            if (nextBtn) nextBtn.disabled = true;
            if (totalFixed) totalFixed.classList.add('d-none');
            return;
        }

        if (nextBtn) nextBtn.disabled = false;
        if (totalFixed) totalFixed.classList.remove('d-none');

        const labels: Record<string, string> = {
            switch: 'Switch',
            almacenamiento: 'Almacenamiento',
            capacidad: 'Capacidad',
            soporte: 'Montura',
            bateria: 'Batería',
            voltaje: 'Voltaje',
            longitud: 'Longitud',
            talla: 'Talla',
            color: 'Color',
            proteina: 'Proteína',
            guarnicion: 'Guarnición',
            relleno: 'Relleno',
            porcion: 'Porción',
            sabor: 'Sabor',
            presentacion: 'Presentación',
            punto: 'Punto',
            salsa: 'Salsa',
            cantidad: 'Cantidad',
            size: 'Opción',
            opcion: 'Opción',
        };

        container.innerHTML = items
            .map((item) => {
                const opts = Object.entries(item.options || {})
                    .filter(([, v]) => v)
                    .map(([k, v]) => {
                        const labelText = item.optionLabels?.[k] || labels[k] || k.charAt(0).toUpperCase() + k.slice(1);
                        return `<span class="cart-item-option">${labelText}: ${v}</span>`;
                    })
                    .join('');

                const unitPrice = item.price && item.price > 0 ? `$${item.price.toFixed(2)}` : 'A consultar';
                const subtotal =
                    item.price && item.price > 0 ? `$${(item.price * item.qty).toFixed(2)}` : 'A consultar';

                return `
          <div class="cart-item">
            <div class="cart-item-info">
              <h4 class="cart-item-name">${item.name}</h4>
              ${opts ? `<div class="cart-item-options">${opts}</div>` : ''}
              <div class="cart-item-unit-price">${unitPrice} c/u</div>
            </div>
            <div class="cart-item-actions">
              <div class="cart-item-price-box">
                <span class="cart-item-subtotal">${subtotal}</span>
              </div>
              <div class="cart-item-controls-row">
                <div class="qty-control" role="group" aria-label="Cantidad">
                  <button type="button" class="qty-btn" data-action="decrease" data-key="${item.key}" aria-label="Disminuir cantidad">-</button>
                  <span class="qty-val" aria-live="polite">${item.qty}</span>
                  <button type="button" class="qty-btn" data-action="increase" data-key="${item.key}" aria-label="Aumentar cantidad">+</button>
                </div>
                <button type="button" class="cart-item-remove" data-action="remove" data-key="${item.key}" title="Eliminar producto" aria-label="Eliminar producto">
                  ${renderIconSvg('trash', { size: 16 })}
                </button>
              </div>
            </div>
          </div>
        `;
            })
            .join('');
    }

    private renderTotals(): void {
        const totalAmount = document.getElementById('cart-total-amount');
        const totalBsEl = document.getElementById('cart-total-bs');
        const deliveryBadge = document.getElementById('cart-delivery-badge');
        const pagoMovilBs = document.getElementById('pago-movil-bs-amount');
        const binanceUsdt = document.getElementById('binance-usdt-amount');
        const bcvRateElements = document.querySelectorAll('.bcv-rate-text');
        if (!totalAmount) return;

        const deliveryType = this.getSelectedDeliveryType();
        const isDelivery = deliveryType === 'delivery';
        const { subtotal } = this.cartService.calculateTotal(deliveryType);
        const bcvRate = this.currencyService.getRate();

        bcvRateElements.forEach((el) => {
            el.textContent = bcvRate > 0 ? bcvRate.toFixed(2) : '--';
        });

        if (subtotal === 0) {
            totalAmount.textContent = '$0.00';
            if (totalBsEl) totalBsEl.textContent = '≈ Bs. 0,00';
            if (deliveryBadge) deliveryBadge.classList.add('d-none');
            if (pagoMovilBs) pagoMovilBs.textContent = 'Bs. 0,00';
            if (binanceUsdt) binanceUsdt.textContent = '$0.00 USDT';
            return;
        }

        let discount = 0;
        const discountLabel = document.getElementById('cart-discount-label');
        if (this.appliedCoupon) {
            if (subtotal >= this.appliedCoupon.minOrderAmount) {
                if (this.appliedCoupon.discountType === 'percentage') {
                    discount = Math.round(subtotal * (this.appliedCoupon.discountValue / 100) * 100) / 100;
                } else {
                    discount = Math.min(subtotal, this.appliedCoupon.discountValue);
                }
                if (discountLabel) {
                    discountLabel.classList.remove('d-none');
                    discountLabel.textContent = `Desc. Cupón ${this.appliedCoupon.code}: -$${discount.toFixed(2)}`;
                }
            } else {
                if (discountLabel) {
                    discountLabel.classList.remove('d-none');
                    discountLabel.textContent = `Cupón mín. $${this.appliedCoupon.minOrderAmount.toFixed(2)}`;
                }
            }
        } else {
            if (discountLabel) discountLabel.classList.add('d-none');
        }

        const discountedSubtotal = Math.max(0, subtotal - discount);
        const finalTotal = discountedSubtotal + (isDelivery ? this.config.deliveryPrice : 0);
        const totalBs = this.currencyService.toBs(finalTotal);

        totalAmount.textContent = `$${finalTotal.toFixed(2)}`;
        if (deliveryBadge) {
            deliveryBadge.classList.toggle('d-none', !isDelivery);
            deliveryBadge.textContent = `Incluye delivery ($${this.config.deliveryPrice.toFixed(2)})`;
        }

        const formattedBs = new Intl.NumberFormat('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(totalBs);

        if (totalBsEl) {
            totalBsEl.textContent = `≈ Bs. ${formattedBs}`;
        }
        if (pagoMovilBs) {
            pagoMovilBs.textContent = `Bs. ${formattedBs}`;
        }
        if (binanceUsdt) {
            binanceUsdt.textContent = `$${finalTotal.toFixed(2)} USDT`;
        }
    }

    private getSelectedDeliveryType(): 'retiro' | 'delivery' {
        const input = document.querySelector('input[name="delivery-type"]:checked') as HTMLInputElement | null;
        return (input?.value as 'retiro' | 'delivery') || 'retiro';
    }

    public toggleCart(): void {
        const drawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('cart-overlay');
        drawer?.classList.toggle('active');
        overlay?.classList.toggle('active');

        if (drawer?.classList.contains('active')) {
            this.render();
            this.updateStepUI();
        } else {
            setTimeout(() => {
                this.currentStep = 1;
                this.updateStepUI();
            }, 350);
        }
    }

    public goToStep(step: number): void {
        if (step === 2) {
            if (this.cartService.getItems().length === 0) {
                this.toastService.show('⚠️ Tu pedido está vacío');
                return;
            }
        }

        if (step === 3) {
            const nameInput = document.getElementById('client-name') as HTMLInputElement | null;
            const phoneInput = document.getElementById('client-phone') as HTMLInputElement | null;
            const deliveryType = this.getSelectedDeliveryType();
            const addressInput = document.getElementById('delivery-address') as HTMLInputElement | null;

            if (!nameInput?.value.trim() || !phoneInput?.value.trim()) {
                this.toastService.show('⚠️ Ingresa tu nombre y teléfono.');
                if (!nameInput?.value.trim()) nameInput?.focus();
                else phoneInput?.focus();
                return;
            }

            if (deliveryType === 'delivery' && !addressInput?.value.trim()) {
                this.toastService.show('⚠️ Ingresa la dirección para el delivery.');
                addressInput?.focus();
                return;
            }
        }

        this.currentStep = step;
        this.updateStepUI();
    }

    private updateStepUI(): void {
        const s1 = document.getElementById('cart-step-1');
        const s2 = document.getElementById('cart-step-2');
        const s3 = document.getElementById('cart-step-3');
        if (s1) {
            s1.classList.toggle('active', this.currentStep === 1);
            s1.classList.toggle('d-none', this.currentStep !== 1);
        }
        if (s2) {
            s2.classList.toggle('active', this.currentStep === 2);
            s2.classList.toggle('d-none', this.currentStep !== 2);
        }
        if (s3) {
            s3.classList.toggle('active', this.currentStep === 3);
            s3.classList.toggle('d-none', this.currentStep !== 3);
        }

        const title = document.getElementById('cart-title');
        const backBtn = document.getElementById('cart-back-btn');
        const nextBtn = document.getElementById('cart-next-btn');
        const nextBtnText = nextBtn?.querySelector('.cart-next-btn-text');
        const waSubmitGroup = document.getElementById('cart-wa-submit-group');

        // Update step pills
        document.querySelectorAll('.cart-step-pill').forEach((el) => {
            const stepNum = parseInt(el.getAttribute('data-step') || '0', 10);
            el.classList.toggle('active', stepNum === this.currentStep);
            el.classList.toggle('completed', stepNum < this.currentStep);
        });

        if (this.currentStep === 1) {
            if (title) title.innerHTML = '🛒 Tu Pedido';
            if (backBtn) backBtn.classList.add('d-none');
            if (nextBtn) {
                nextBtn.classList.remove('d-none');
                if (nextBtnText) nextBtnText.textContent = 'Continuar (Datos)';
            }
            if (waSubmitGroup) waSubmitGroup.classList.add('d-none');
        } else if (this.currentStep === 2) {
            if (title) title.innerHTML = '📦 Entrega y Contacto';
            if (backBtn) backBtn.classList.remove('d-none');
            if (nextBtn) {
                nextBtn.classList.remove('d-none');
                if (nextBtnText) nextBtnText.textContent = 'Continuar al Pago';
            }
            if (waSubmitGroup) waSubmitGroup.classList.add('d-none');
        } else if (this.currentStep === 3) {
            if (title) title.innerHTML = '💳 Método de Pago';
            if (backBtn) backBtn.classList.remove('d-none');
            if (nextBtn) nextBtn.classList.add('d-none');
            if (waSubmitGroup) waSubmitGroup.classList.remove('d-none');
        }
    }

    private bindEvents(): void {
        // Toggle cart drawer
        document.getElementById('cart-btn')?.addEventListener('click', () => this.toggleCart());
        document.getElementById('close-cart')?.addEventListener('click', () => this.toggleCart());
        document.getElementById('cart-overlay')?.addEventListener('click', () => this.toggleCart());

        // Step navigation via buttons
        document.getElementById('cart-back-btn')?.addEventListener('click', () => {
            if (this.currentStep > 1) this.goToStep(this.currentStep - 1);
        });
        document.getElementById('cart-next-btn')?.addEventListener('click', () => {
            if (this.currentStep < 3) this.goToStep(this.currentStep + 1);
        });

        // Step navigation via header stepper pills
        document.querySelectorAll('.cart-step-pill').forEach((pill) => {
            pill.addEventListener('click', () => {
                const targetStep = parseInt(pill.getAttribute('data-step') || '1', 10);
                if (targetStep !== this.currentStep) {
                    this.goToStep(targetStep);
                }
            });
        });

        // Cart items event delegation (Single handler for explore, quantity & remove)
        document.getElementById('cart-items')?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;

            // Explore catalog button handler (empty state)
            const exploreBtn = target.closest('#cart-explore-btn');
            if (exploreBtn) {
                this.toggleCart();
                const catalogEl = document.getElementById('catalogo') || document.getElementById('catalog-grid') || document.querySelector('.catalog-section');
                catalogEl?.scrollIntoView({ behavior: 'smooth' });
                return;
            }

            const btn = target.closest('[data-action]') as HTMLElement | null;
            if (!btn) return;

            const action = btn.getAttribute('data-action');
            const key = btn.getAttribute('data-key');
            if (!key) return;

            if (action === 'increase') {
                this.cartService.updateQuantity(key, 1);
            } else if (action === 'decrease') {
                this.cartService.updateQuantity(key, -1);
            } else if (action === 'remove') {
                this.cartService.removeItem(key);
            }
        });

        // Clear cart modal
        const confirmModal = document.getElementById('confirm-modal');
        document.getElementById('clear-cart')?.addEventListener('click', () => {
            if (this.cartService.getItems().length > 0) confirmModal?.classList.add('active');
        });
        document.getElementById('modal-cancel')?.addEventListener('click', () => {
            confirmModal?.classList.remove('active');
        });
        confirmModal?.addEventListener('click', (e) => {
            if (e.target === confirmModal) confirmModal.classList.remove('active');
        });
        document.getElementById('modal-confirm')?.addEventListener('click', () => {
            this.cartService.clear();
            confirmModal?.classList.remove('active');
            this.toastService.show('Pedido vaciado');
        });

        // Delivery type selection (pill-tabs)
        const addressContainer = document.getElementById('delivery-address-container');
        document.querySelectorAll('input[name="delivery-type"]').forEach((radio) => {
            radio.addEventListener('change', (e) => {
                const isDelivery = (e.target as HTMLInputElement).value === 'delivery';
                if (addressContainer) {
                    addressContainer.classList.toggle('d-none', !isDelivery);
                }

                const paymentSelect = document.getElementById('payment-method') as HTMLSelectElement | null;
                if (paymentSelect && isDelivery && paymentSelect.value === 'punto') {
                    paymentSelect.value = '';
                }
                const puntoOption = paymentSelect?.querySelector('option[value="punto"]') as HTMLOptionElement | null;
                if (puntoOption) {
                    puntoOption.disabled = isDelivery;
                }

                this.renderTotals();
            });
        });

        // Payment method selection
        document.getElementById('payment-method')?.addEventListener('change', (e) => {
            const method = (e.target as HTMLSelectElement).value;
            const refContainer = document.getElementById('payment-reference-container');
            const infoPagoMovil = document.getElementById('payment-info-pago-movil');
            const infoZelle = document.getElementById('payment-info-zelle');
            const infoBinance = document.getElementById('payment-info-binance-pay');

            if (infoPagoMovil) infoPagoMovil.classList.toggle('d-none', method !== 'pago_movil');
            if (infoZelle) infoZelle.classList.toggle('d-none', method !== 'zelle');
            if (infoBinance) infoBinance.classList.toggle('d-none', method !== 'binance_pay');
            if (refContainer) {
                refContainer.classList.toggle('d-none', method !== 'pago_movil' && method !== 'zelle' && method !== 'binance_pay');
            }

            const refInput = document.getElementById('payment-reference') as HTMLInputElement | null;
            if (refInput) {
                if (method === 'binance_pay') {
                    refInput.placeholder = 'Ej. 248910284 (Order ID o Pay ID)';
                } else {
                    refInput.placeholder = 'Ej. 123456';
                }
            }
        });

        // Pago Movil account selection
        document.getElementById('pm-account-selector')?.addEventListener('change', (e) => {
            const idx = parseInt((e.target as HTMLSelectElement).value, 10);
            if (!Number.isNaN(idx) && this.pagoMovilAccounts[idx]) {
                this.updateDisplayedPagoMovilAccount(this.pagoMovilAccounts[idx]);
            }
        });

        // Copy Pago Movil Data
        document.getElementById('copy-pm-btn')?.addEventListener('click', async (e) => {
            const banco = document.getElementById('pm-data-banco')?.textContent?.trim() || '';
            const telefono = document.getElementById('pm-data-telefono')?.textContent?.trim() || '';
            const cedula = document.getElementById('pm-data-cedula')?.textContent?.trim() || '';
            const titular = document.getElementById('pm-data-titular')?.textContent?.trim() || '';
            const copyText = `Banco: ${banco}\nTeléfono: ${telefono}\nC.I/RIF: ${cedula}${titular ? `\nTitular: ${titular}` : ''}`;

            try {
                await navigator.clipboard.writeText(copyText);
                const btn = e.currentTarget as HTMLButtonElement;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '✅ ¡Copiado!';
                this.toastService.show('Datos copiados al portapapeles');
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                }, 2000);
            } catch (_err) {
                this.toastService.show('❌ Error al copiar los datos');
            }
        });

        // Copy Zelle Data
        document.getElementById('copy-zelle-btn')?.addEventListener('click', async (e) => {
            const email = document.getElementById('zelle-data-email')?.textContent?.trim() || '';
            const titular = document.getElementById('zelle-data-titular')?.textContent?.trim() || '';
            const copyText = `Correo: ${email}\nTitular: ${titular}`;

            try {
                await navigator.clipboard.writeText(copyText);
                const btn = e.currentTarget as HTMLButtonElement;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '✅ ¡Copiado!';
                this.toastService.show('Datos copiados al portapapeles');
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                }, 2000);
            } catch (_err) {
                this.toastService.show('❌ Error al copiar los datos');
            }
        });

        // Copy Binance Pay Data
        document.getElementById('copy-binance-btn')?.addEventListener('click', async (e) => {
            const payId = document.getElementById('binance-data-payid')?.textContent?.trim() || '';
            const merchant = document.getElementById('binance-data-merchant')?.textContent?.trim() || '';
            const copyText = `Binance Pay ID: ${payId}${merchant ? `\nComercio: ${merchant}` : ''}`;

            try {
                await navigator.clipboard.writeText(copyText);
                const btn = e.currentTarget as HTMLButtonElement;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '✅ ¡Copiado!';
                this.toastService.show('Datos de Binance Pay copiados');
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                }, 2000);
            } catch (_err) {
                this.toastService.show('❌ Error al copiar datos de Binance Pay');
            }
        });

        // Receipt dropzone & file handling
        this.bindReceiptUpload();

        // Coupon code handling
        const btnApplyCoupon = document.getElementById('btn-apply-coupon');
        const couponInput = document.getElementById('cart-coupon-input') as HTMLInputElement | null;
        const couponMsg = document.getElementById('cart-coupon-msg');

        const applyCouponHandler = async () => {
            const code = couponInput?.value.trim().toUpperCase();
            if (!code) {
                this.toastService.show('⚠️ Ingresa un código de cupón.');
                return;
            }

            try {
                if (btnApplyCoupon) btnApplyCoupon.textContent = 'Verificando...';
                const tenantParam = this.config.tenantId ? `&tenant=${encodeURIComponent(this.config.tenantId)}` : '';
                const headers: Record<string, string> = {};
                if (this.config.tenantId) headers['X-Tenant-Id'] = this.config.tenantId;

                const res = await fetch(`/api/coupons?code=${encodeURIComponent(code)}${tenantParam}`, { headers });
                const data = (await res.json()) as any;

                if (!res.ok || !data.valid) {
                    throw new Error(data.error || 'Cupón inválido o expirado.');
                }

                this.appliedCoupon = {
                    code: data.coupon.code,
                    discountType: data.coupon.discount_type,
                    discountValue: data.coupon.discount_value,
                    minOrderAmount: data.coupon.min_order_amount || 0,
                };

                if (couponMsg) {
                    couponMsg.classList.remove('d-none', 'coupon-error');
                    couponMsg.classList.add('coupon-success');
                    const desc =
                        this.appliedCoupon.discountType === 'percentage'
                            ? `${this.appliedCoupon.discountValue}%`
                            : `$${this.appliedCoupon.discountValue.toFixed(2)}`;
                    couponMsg.textContent = `✓ ¡Cupón ${code} aplicado (${desc} de descuento)!`;
                }

                this.toastService.show(`🎉 Cupón ${code} aplicado exitosamente`);
                this.renderTotals();
            } catch (err: any) {
                this.appliedCoupon = null;
                if (couponMsg) {
                    couponMsg.classList.remove('d-none', 'coupon-success');
                    couponMsg.classList.add('coupon-error');
                    couponMsg.textContent = `✕ ${err.message || 'Error al validar cupón'}`;
                }
                this.toastService.show(`❌ ${err.message || 'Cupón inválido'}`);
                this.renderTotals();
            } finally {
                if (btnApplyCoupon) btnApplyCoupon.textContent = 'Aplicar';
            }
        };

        btnApplyCoupon?.addEventListener('click', applyCouponHandler);
        couponInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCouponHandler();
            }
        });

        // Submit order via WhatsApp
        document.getElementById('whatsapp-order-btn')?.addEventListener('click', () => this.handleOrderSubmit());
    }

    private bindReceiptUpload(): void {
        const dropzone = document.getElementById('receipt-dropzone');
        this.receiptFileInput = document.getElementById('payment-receipt-file') as HTMLInputElement | null;

        dropzone?.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).id === 'btn-remove-receipt') return;
            this.receiptFileInput?.click();
        });

        this.receiptFileInput?.addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                this.toastService.show('📷 Procesando comprobante...');
                this.uploadedReceiptBase64 = await this.imageService.compress(file);

                const previewBox = document.getElementById('receipt-preview-box');
                const promptBox = document.getElementById('receipt-prompt');
                const previewImg = document.getElementById('receipt-preview-img') as HTMLImageElement | null;
                const previewName = document.getElementById('receipt-preview-name');

                if (previewImg) previewImg.src = this.uploadedReceiptBase64;
                if (previewName) previewName.textContent = file.name;
                if (promptBox) promptBox.classList.add('d-none');
                if (previewBox) previewBox.classList.remove('d-none');
                this.toastService.show('✅ Comprobante adjuntado correctamente');
            } catch {
                this.toastService.show('❌ No se pudo procesar la imagen del comprobante.');
            }
        });

        document.getElementById('btn-remove-receipt')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.uploadedReceiptBase64 = null;
            if (this.receiptFileInput) this.receiptFileInput.value = '';
            const previewBox = document.getElementById('receipt-preview-box');
            const promptBox = document.getElementById('receipt-prompt');
            if (promptBox) promptBox.classList.remove('d-none');
            if (previewBox) previewBox.classList.add('d-none');
            this.toastService.show('Comprobante removido');
        });
    }

    private async handleOrderSubmit(): Promise<void> {
        const nameInput = document.getElementById('client-name') as HTMLInputElement | null;
        const phoneInput = document.getElementById('client-phone') as HTMLInputElement | null;
        const addressInput = document.getElementById('delivery-address') as HTMLInputElement | null;
        const paymentSelect = document.getElementById('payment-method') as HTMLSelectElement | null;
        const paymentRefInput = document.getElementById('payment-reference') as HTMLInputElement | null;

        const clientName = nameInput?.value.trim() || '';
        const clientPhone = phoneInput?.value.trim() || '';
        const deliveryType = this.getSelectedDeliveryType();
        const deliveryAddress = addressInput?.value.trim() || '';
        const paymentMethod = paymentSelect?.value || '';
        const paymentReference = paymentRefInput?.value.trim() || '';

        if (!paymentMethod) {
            this.toastService.show('⚠️ Selecciona un método de pago.');
            paymentSelect?.focus();
            return;
        }

        if (
            (paymentMethod === 'pago_movil' || paymentMethod === 'zelle' || paymentMethod === 'binance_pay') &&
            !paymentReference
        ) {
            const msg =
                paymentMethod === 'binance_pay'
                    ? '⚠️ Ingresa el Order ID o ID de transacción de Binance Pay.'
                    : '⚠️ Ingresa el número de referencia del pago.';
            this.toastService.show(msg);
            paymentRefInput?.focus();
            return;
        }

        const waBtn = document.getElementById('whatsapp-order-btn') as HTMLButtonElement | null;
        const waBtnText = waBtn?.querySelector('.cart-wa-btn-text');
        if (waBtn) {
            waBtn.disabled = true;
            waBtn.classList.add('loading');
            if (waBtnText) {
                waBtnText.textContent = 'Registrando Pedido...';
            }
        }

        let resolvedPaymentMethod = paymentMethod;
        if (paymentMethod === 'pago_movil') {
            const selectedBank = document.getElementById('pm-data-banco')?.textContent?.trim();
            if (selectedBank) {
                resolvedPaymentMethod = `pago_movil:${selectedBank}`;
            }
        }

        const submissionData: OrderSubmissionData = {
            clientName,
            clientPhone,
            deliveryType,
            deliveryAddress,
            paymentMethod: resolvedPaymentMethod,
            paymentReference,
            paymentReceipt: this.uploadedReceiptBase64,
            couponCode: this.appliedCoupon?.code,
        };

        const items = this.cartService.getItems();

        try {
            const { orderId } = await this.orderService.submitOrder(submissionData, items);
            const waUrl = this.orderService.buildWhatsAppUrl(orderId, submissionData, items);

            // Limpieza del carrito y formulario
            this.cartService.clear();
            this.appliedCoupon = null;
            const couponInput = document.getElementById('cart-coupon-input') as HTMLInputElement | null;
            if (couponInput) couponInput.value = '';
            const couponMsg = document.getElementById('cart-coupon-msg');
            if (couponMsg) {
                couponMsg.classList.add('d-none');
                couponMsg.textContent = '';
            }

            if (nameInput) nameInput.value = '';
            if (phoneInput) phoneInput.value = '';
            if (paymentSelect) paymentSelect.value = '';
            if (paymentRefInput) paymentRefInput.value = '';
            this.uploadedReceiptBase64 = null;
            if (this.receiptFileInput) this.receiptFileInput.value = '';

            const previewBox = document.getElementById('receipt-preview-box');
            const promptBox = document.getElementById('receipt-prompt');
            if (promptBox) promptBox.classList.remove('d-none');
            if (previewBox) previewBox.classList.add('d-none');

            const refContainer = document.getElementById('payment-reference-container');
            const infoPagoMovil = document.getElementById('payment-info-pago-movil');
            const infoZelle = document.getElementById('payment-info-zelle');
            const infoBinance = document.getElementById('payment-info-binance-pay');
            if (refContainer) refContainer.classList.add('d-none');
            if (infoPagoMovil) infoPagoMovil.classList.add('d-none');
            if (infoZelle) infoZelle.classList.add('d-none');
            if (infoBinance) infoBinance.classList.add('d-none');

            this.toggleCart();
            this.toastService.show(`🎉 ¡Pedido #${orderId} registrado con éxito!`);

            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                window.location.href = waUrl;
            } else {
                window.open(waUrl, '_blank');
            }
        } catch (err: any) {
            this.toastService.show(`❌ ${err.message || 'Error al registrar pedido. Intenta de nuevo.'}`);
        } finally {
            if (waBtn) {
                waBtn.disabled = false;
                waBtn.classList.remove('loading');
                if (waBtnText) {
                    waBtnText.textContent = 'Enviar Pedido a WhatsApp';
                }
            }
        }
    }

    public setPagoMovilAccounts(
        accounts: Array<{ banco: string; telefono: string; cedula: string; titular?: string; isDefault?: boolean }>,
    ): void {
        this.pagoMovilAccounts = accounts || [];
        this.renderPagoMovilSelector();
    }

    private renderPagoMovilSelector(): void {
        const selectorGroup = document.getElementById('pm-accounts-selector-group');
        const selector = document.getElementById('pm-account-selector') as HTMLSelectElement | null;
        if (!selectorGroup || !selector) return;

        if (this.pagoMovilAccounts.length > 1) {
            selectorGroup.classList.remove('d-none');
            selector.innerHTML = this.pagoMovilAccounts
                .map((acc, idx) => {
                    const label = `${acc.banco} — ${acc.telefono}${acc.titular ? ` (${acc.titular})` : ''}`;
                    return `<option value="${idx}" ${acc.isDefault ? 'selected' : ''}>${label}</option>`;
                })
                .join('');

            const selectedIdx = selector.selectedIndex >= 0 ? selector.selectedIndex : 0;
            this.updateDisplayedPagoMovilAccount(this.pagoMovilAccounts[selectedIdx]);
        } else if (this.pagoMovilAccounts.length === 1) {
            selectorGroup.classList.add('d-none');
            this.updateDisplayedPagoMovilAccount(this.pagoMovilAccounts[0]);
        }
    }

    private updateDisplayedPagoMovilAccount(acc?: {
        banco: string;
        telefono: string;
        cedula: string;
        titular?: string;
    }): void {
        if (!acc) return;
        const b = document.getElementById('pm-data-banco');
        const t = document.getElementById('pm-data-telefono');
        const c = document.getElementById('pm-data-cedula');
        const titularRow = document.getElementById('pm-data-titular-item');
        const titularSpan = document.getElementById('pm-data-titular');

        if (b && acc.banco) b.textContent = acc.banco;
        if (t && acc.telefono) t.textContent = acc.telefono;
        if (c && acc.cedula) c.textContent = acc.cedula;

        if (titularRow && titularSpan) {
            if (acc.titular) {
                titularSpan.textContent = acc.titular;
                titularRow.classList.remove('d-none');
            } else {
                titularRow.classList.add('d-none');
            }
        }
    }
}
