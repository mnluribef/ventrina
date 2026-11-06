// Ventrina SaaS — Registro y Onboarding Optimizado
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('onboarding-form') as HTMLFormElement | null;
    if (!form) return;

    const nextBtns = document.querySelectorAll<HTMLButtonElement>('.next-step');
    const prevBtns = document.querySelectorAll<HTMLButtonElement>('.prev-step');
    const errorMsg = document.getElementById('error-message') as HTMLElement | null;
    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement | null;
    const successState = document.getElementById('success-state') as HTMLElement | null;
    const registerHeader = document.querySelector('.register-header') as HTMLElement | null;

    const tenantNameInput = document.getElementById('tenantName') as HTMLInputElement | null;
    const tenantSlugInput = document.getElementById('tenantSlug') as HTMLInputElement | null;
    const dynamicBg = document.getElementById('dynamic-bg') as HTMLElement | null;

    // Elementos del Stepper
    const stepperFill = document.getElementById('stepper-fill') as HTMLElement | null;
    const stepNode1 = document.getElementById('step-node-1') as HTMLElement | null;
    const stepNode2 = document.getElementById('step-node-2') as HTMLElement | null;

    // Elementos de la Previsualización Dinámica de URL
    const urlPreviewCard = document.getElementById('url-preview-card') as HTMLElement | null;
    const urlSlugPreview = document.getElementById('url-slug-preview') as HTMLElement | null;
    const urlSuffixPreview = document.getElementById('url-suffix-preview') as HTMLElement | null;
    const urlStatusBadge = document.getElementById('url-status-badge') as HTMLElement | null;
    const urlStatusText = document.getElementById('url-status-text') as HTMLElement | null;
    const domainSuffixEl = document.getElementById('domain-suffix') as HTMLElement | null;

    // 1. Detección y Configuración Dinámica del Dominio (Localhost vs Producción)
    let domainSuffix = '.ventrina.app';
    const host = window.location.host;
    if (host.includes('localhost')) {
        const portStr = window.location.port ? `:${window.location.port}` : '';
        domainSuffix = `.localhost${portStr}`;
    }

    if (domainSuffixEl) {
        domainSuffixEl.textContent = domainSuffix;
    }
    if (urlSuffixPreview) {
        urlSuffixPreview.textContent = domainSuffix;
    }

    // 2. Fondos Temáticos de Alta Calidad por Rubro
    const bgs: Record<string, string> = {
        restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2000',
        fashion: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&q=80&w=2000',
        hardware: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=2000',
        tech: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=2000',
        autoparts: 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=2000',
        grocery: '/assets/hero_grocery.webp',
    };

    function updateBackground(templateKey: string) {
        const bgUrl = bgs[templateKey];
        if (!bgUrl || !dynamicBg) return;

        const img = new Image();
        img.src = bgUrl;
        img.onload = () => {
            dynamicBg.style.backgroundImage = `url('${bgUrl}')`;
        };
    }

    // Inicializar fondo con el template marcado por defecto
    const initialCheckedTemplate = document.querySelector<HTMLInputElement>('input[name="template"]:checked');
    if (initialCheckedTemplate) {
        updateBackground(initialCheckedTemplate.value);
    }

    const templateRadios = document.querySelectorAll<HTMLInputElement>('input[name="template"]');
    templateRadios.forEach((radio) => {
        radio.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.checked) {
                updateBackground(target.value);
            }
        });
    });

    // 3. Sanitización y Generación Dinámica de Slug
    function formatSlug(text: string): string {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Quitar tildes y diacríticos
            .replace(/[^a-z0-9\s-]/g, '') // Quitar caracteres especiales
            .trim()
            .replace(/\s+/g, '-') // Espacios a guiones
            .replace(/-+/g, '-') // Evitar guiones consecutivos
            .replace(/^-|-$/g, ''); // Sin guiones en extremos
    }

    function updateUrlPreview() {
        if (!tenantSlugInput) return;

        const slug = tenantSlugInput.value.trim();
        const displaySlug = slug || 'mitienda';

        if (urlSlugPreview) {
            urlSlugPreview.textContent = displaySlug;
        }

        if (!urlStatusBadge || !urlStatusText || !urlPreviewCard) return;

        // Limpiar clases previas
        urlStatusBadge.className = 'url-status-badge';
        urlPreviewCard.classList.remove('valid-state', 'warning-state');

        if (!slug) {
            urlStatusBadge.classList.add('status-neutral');
            urlStatusText.textContent = 'Listo para crear';
            return;
        }

        if (slug.length < 3) {
            urlStatusBadge.classList.add('status-warning');
            urlPreviewCard.classList.add('warning-state');
            urlStatusText.textContent = 'Mínimo 3 caracteres';
            return;
        }

        const validPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
        if (validPattern.test(slug)) {
            urlStatusBadge.classList.add('status-valid');
            urlPreviewCard.classList.add('valid-state');
            urlStatusText.textContent = '✓ URL disponible';
        } else {
            urlStatusBadge.classList.add('status-invalid');
            urlPreviewCard.classList.add('warning-state');
            urlStatusText.textContent = 'Formato inválido (solo letras, números y guiones)';
        }
    }

    if (tenantNameInput && tenantSlugInput) {
        tenantNameInput.addEventListener('input', () => {
            if (!tenantSlugInput.dataset.manual) {
                tenantSlugInput.value = formatSlug(tenantNameInput.value);
                updateUrlPreview();
            }
        });

        tenantSlugInput.addEventListener('input', () => {
            tenantSlugInput.dataset.manual = 'true';
            // Restringir a caracteres válidos en tiempo real
            tenantSlugInput.value = tenantSlugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
            updateUrlPreview();
        });

        // Permitir avanzar con tecla Enter ergonómicamente
        tenantNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                tenantSlugInput.focus();
            }
        });

        tenantSlugInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const nextBtn = document.querySelector<HTMLButtonElement>('#step-1 .next-step');
                nextBtn?.click();
            }
        });

        // Inicializar preview al cargar
        updateUrlPreview();
    }

    // 4. Navegación del Stepper de 2 Pasos
    function goToStep(targetStepId: string) {
        const allSteps = document.querySelectorAll<HTMLElement>('.form-step');
        allSteps.forEach((step) => step.classList.remove('active'));

        const targetStep = document.getElementById(targetStepId);
        if (!targetStep) return;

        targetStep.classList.add('active');

        // Actualizar Stepper Visual
        if (targetStepId === 'step-1') {
            if (stepperFill) stepperFill.style.width = '50%';
            if (stepNode1) {
                stepNode1.classList.add('active');
                stepNode1.classList.remove('completed');
            }
            if (stepNode2) {
                stepNode2.classList.remove('active', 'completed');
            }
        } else if (targetStepId === 'step-2') {
            if (stepperFill) stepperFill.style.width = '100%';
            if (stepNode1) {
                stepNode1.classList.remove('active');
                stepNode1.classList.add('completed');
            }
            if (stepNode2) {
                stepNode2.classList.add('active');
                stepNode2.classList.remove('completed');
            }
        }

        // Desplazamiento ergonómico suave hacia la tarjeta
        const card = document.querySelector('.register-card');
        if (card) {
            const rect = card.getBoundingClientRect();
            if (rect.top < 0 || rect.top > 100) {
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    nextBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const currentStep = btn.closest<HTMLElement>('.form-step');
            if (!currentStep) return;

            // Validar inputs requeridos del paso actual
            const requiredInputs = currentStep.querySelectorAll<HTMLInputElement>('input[required]');
            let valid = true;

            requiredInputs.forEach((input) => {
                if (!input.checkValidity()) {
                    input.reportValidity();
                    valid = false;
                }
            });

            // Validación adicional para el slug
            if (currentStep.id === 'step-1' && tenantSlugInput) {
                const slugVal = tenantSlugInput.value.trim();
                const validPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
                if (slugVal.length < 3 || !validPattern.test(slugVal)) {
                    tenantSlugInput.setCustomValidity('El enlace debe tener al menos 3 caracteres válidos (solo letras minúsculas, números y guiones).');
                    tenantSlugInput.reportValidity();
                    valid = false;
                } else {
                    tenantSlugInput.setCustomValidity('');
                }
            }

            if (valid) {
                const targetId = btn.dataset.target;
                if (targetId) {
                    goToStep(targetId);
                }
            }
        });
    });

    prevBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            if (targetId) {
                goToStep(targetId);
            }
        });
    });

    // 5. Visibilidad de Contraseña
    const togglePasswordBtn = document.getElementById('toggle-password') as HTMLButtonElement | null;
    const passwordInput = document.getElementById('password') as HTMLInputElement | null;

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
            togglePasswordBtn.innerHTML = isPassword
                ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
                : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        });
    }

    // 6. Envío del Formulario a /api/onboarding
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (errorMsg) {
            errorMsg.classList.add('hidden');
            errorMsg.textContent = '';
        }

        const formData = new FormData(form);
        const acceptTerms = formData.get('acceptTerms') === 'on' || formData.get('acceptTerms') === 'true';

        if (!acceptTerms) {
            if (errorMsg) {
                errorMsg.textContent = 'Debes aceptar los Términos de Servicio y la Política de Privacidad para crear tu tienda.';
                errorMsg.classList.remove('hidden');
            }
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.querySelector('.btn-text')?.classList.add('hidden');
            submitBtn.querySelector('.spinner')?.classList.remove('hidden');
        }

        const emailValue = ((formData.get('email') as string) || '').trim().toLowerCase();
        const payload = {
            tenantName: formData.get('tenantName'),
            tenantSlug: formData.get('tenantSlug'),
            template: formData.get('template'),
            email: emailValue,
            password: formData.get('password') as string,
            whatsapp: formData.get('whatsapp') || null,
            acceptTerms: true,
        };

        try {
            const response = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = (await response.json()) as any;

            if (response.ok) {
                form.classList.add('hidden');
                registerHeader?.classList.add('hidden');
                successState?.classList.remove('hidden');

                const protocol = window.location.protocol;
                let storeUrl = `https://${data.tenantId}.ventrina.app`;
                if (window.location.hostname === 'localhost' || window.location.hostname.endsWith('.localhost')) {
                    const port = window.location.port ? `:${window.location.port}` : '';
                    storeUrl = `${protocol}//${data.tenantId}.localhost${port}`;
                }

                const adminUrl = `${protocol}//${window.location.host}/admin?tenant=${data.tenantId}`;
                const storeUrlEl = document.getElementById('store-url') as HTMLAnchorElement | null;
                const adminUrlEl = document.getElementById('admin-url') as HTMLAnchorElement | null;

                if (storeUrlEl) storeUrlEl.href = storeUrl;
                if (adminUrlEl) adminUrlEl.href = adminUrl;
            } else {
                let errMsg = data.error || 'No pudimos procesar tu registro. Por favor verifica tus datos.';
                if (data.details) {
                    errMsg += ` ${typeof data.details === 'string' ? data.details : JSON.stringify(data.details)}`;
                }
                throw new Error(errMsg);
            }
        } catch (error: any) {
            if (errorMsg) {
                errorMsg.textContent = error.message || 'Ocurrió un error inesperado al conectar con el servidor.';
                errorMsg.classList.remove('hidden');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.querySelector('.btn-text')?.classList.remove('hidden');
                submitBtn.querySelector('.spinner')?.classList.add('hidden');
            }
        }
    });
});
