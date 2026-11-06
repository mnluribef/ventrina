// src/scripts/login.ts - Autenticación y ergonomía del panel admin Ventrina

const form = document.getElementById('login-form') as HTMLFormElement | null;
const btn = document.getElementById('login-btn') as HTMLButtonElement | null;
const errDiv = document.getElementById('login-error') as HTMLElement | null;
const errText = document.getElementById('login-error-text') as HTMLElement | null;
const serverError = document.getElementById('server-error') as HTMLElement | null;
const btnSpinner = document.getElementById('btn-spinner') as HTMLElement | null;
const btnText = document.getElementById('btn-text') as HTMLElement | null;

const escapeHtml = (str: string): string => {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const showError = (msg: string) => {
    if (serverError) {
        serverError.classList.add('hidden');
    }
    if (errText) {
        errText.textContent = msg;
    } else if (errDiv) {
        errDiv.textContent = msg;
    }
    errDiv?.classList.remove('hidden');
};

const hideErrors = () => {
    errDiv?.classList.add('hidden');
    serverError?.classList.add('hidden');
};

const setLoading = (loading: boolean) => {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.classList.add('loading');
        btnSpinner?.classList.remove('hidden');
        if (btnText) {
            btnText.textContent = 'Verificando...';
        } else {
            btn.textContent = 'Verificando...';
        }
    } else {
        btn.classList.remove('loading');
        btnSpinner?.classList.add('hidden');
        if (btnText) {
            btnText.textContent = 'Iniciar Sesión';
        } else {
            btn.textContent = 'Iniciar Sesión';
        }
    }
};

// Toggle de visibilidad de contraseña (Show/Hide)
const togglePasswordBtn = document.getElementById('toggle-password') as HTMLButtonElement | null;
const passwordInput = document.getElementById('password') as HTMLInputElement | null;

if (togglePasswordBtn && passwordInput) {
    const eyeIcon = togglePasswordBtn.querySelector('.eye-icon') as SVGElement | null;
    const eyeOffIcon = togglePasswordBtn.querySelector('.eye-off-icon') as SVGElement | null;

    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';

        const newLabel = isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña';
        togglePasswordBtn.setAttribute('aria-label', newLabel);
        togglePasswordBtn.setAttribute('title', newLabel);

        if (eyeIcon && eyeOffIcon) {
            eyeIcon.classList.toggle('hidden', isPassword);
            eyeOffIcon.classList.toggle('hidden', !isPassword);
        }
    });
}

// Auto-detección de tenant en subdominio
const host = window.location.hostname.toLowerCase();
let detectedTenant: string | null = null;
if (host.endsWith('.ventrina.app') && host !== 'ventrina.app' && !host.startsWith('www.')) {
    detectedTenant = host.slice(0, -'.ventrina.app'.length).split('.').pop() || null;
} else if (host.endsWith('.localhost') && host !== 'localhost') {
    detectedTenant = host.slice(0, -'.localhost'.length).split('.').pop() || null;
}

if (detectedTenant) {
    const storeBadge = (document.getElementById('store-badge') || document.querySelector('.store-badge')) as HTMLElement | null;
    if (storeBadge) {
        storeBadge.classList.remove('hidden');
        const badgeText = document.getElementById('store-badge-text');
        if (badgeText) {
            badgeText.innerHTML = `Tienda activa: <strong>${escapeHtml(detectedTenant)}</strong>`;
        } else {
            storeBadge.innerHTML = `<svg class="store-badge-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg><span>Tienda activa: <strong>${escapeHtml(detectedTenant)}</strong></span>`;
        }
    }
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideErrors();
        setLoading(true);

        const emailInput = document.getElementById('email') as HTMLInputElement | null;
        const passwordInputElem = document.getElementById('password') as HTMLInputElement | null;
        const email = emailInput?.value.trim() || '';
        const password = passwordInputElem?.value || '';
        const tenant = detectedTenant || undefined;

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, tenant }),
                credentials: 'include',
            });
            const data = (await res.json()) as { success: boolean; tenant?: string; error?: string };
            if (data.success) {
                try {
                    localStorage.setItem('ventrina_last_activity', String(Date.now()));
                } catch {}
                const redirectTenant = data.tenant || tenant;
                const currentHost = window.location.hostname.toLowerCase();
                const isSubdomain =
                    (currentHost.endsWith('.ventrina.app') &&
                        currentHost !== 'ventrina.app' &&
                        !currentHost.startsWith('www.')) ||
                    (currentHost.endsWith('.localhost') && currentHost !== 'localhost');

                if (isSubdomain) {
                    // Ya estamos en el subdominio de la tienda: URL limpia sin parámetros
                    window.location.href = '/admin';
                } else if (redirectTenant && redirectTenant !== 'default') {
                    if (currentHost === 'ventrina.app') {
                        window.location.href = `https://${redirectTenant}.ventrina.app/admin`;
                    } else if (currentHost === 'localhost' || currentHost.endsWith('.localhost')) {
                        const port = window.location.port ? `:${window.location.port}` : '';
                        window.location.href = `${window.location.protocol}//${redirectTenant}.localhost${port}/admin`;
                    } else {
                        window.location.href = `/admin?tenant=${encodeURIComponent(redirectTenant)}`;
                    }
                } else {
                    window.location.href = '/admin';
                }
            } else {
                showError(data.error || 'Credenciales incorrectas.');
            }
        } catch {
            showError('Error de red. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    });
}
