import { renderIconSvg } from '../../components/common/icons';

export interface ConfirmModalOptions {
    title?: string;
    subtitle?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'primary' | 'success';
    icon?: string;
}

export type ModalConfirmOptions = ConfirmModalOptions;

/**
 * Servicio Centralizado para el Control de Modales y Diálogos de Confirmación
 */
export class ModalService {
    private modalId: string;
    private resolver: ((value: boolean) => void) | null = null;
    private isBound = false;

    constructor(modalId = 'admin-confirm-modal') {
        this.modalId = modalId;
    }

    private getElements() {
        const id = this.modalId;
        const modal = document.getElementById(id);
        return {
            modal,
            title: document.getElementById(`${id}-title`),
            subtitle: document.getElementById(`${id}-subtitle`),
            message: document.getElementById(`${id}-desc`) || document.getElementById('admin-confirm-message') || document.getElementById('sa-confirm-msg'),
            iconBox: document.getElementById(`${id}-icon-box`),
            iconSlot: document.getElementById(`${id}-icon-slot`) || document.getElementById('sa-confirm-icon'),
            acceptBtn: (document.getElementById(`${id}-accept`) || document.getElementById('btn-accept-admin-confirm') || document.getElementById('sa-confirm-accept-btn')) as HTMLButtonElement | null,
            acceptText: document.getElementById(`${id}-accept-text`) || document.getElementById('sa-confirm-accept-text'),
            cancelBtn: (document.getElementById(`${id}-cancel`) || document.getElementById('btn-cancel-admin-confirm') || document.getElementById('sa-confirm-cancel-btn')) as HTMLButtonElement | null,
            closeBtn: (document.getElementById(`${id}-close`) || document.getElementById('btn-close-admin-confirm') || document.getElementById('sa-confirm-close')) as HTMLButtonElement | null,
        };
    }

    private bindEvents(): void {
        if (this.isBound) return;
        const { modal, acceptBtn, cancelBtn, closeBtn } = this.getElements();
        if (!modal) return;

        acceptBtn?.addEventListener('click', () => this.closeConfirm(true));
        cancelBtn?.addEventListener('click', () => this.closeConfirm(false));
        closeBtn?.addEventListener('click', () => this.closeConfirm(false));

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeConfirm(false);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.closeConfirm(false);
            }
        });

        this.isBound = true;
    }

    /**
     * Verifica si el modal está visible
     */
    public isOpen(targetId?: string): boolean {
        const modal = targetId ? document.getElementById(targetId) : this.getElements().modal;
        if (!modal) return false;
        return modal.classList.contains('active') || !modal.classList.contains('hidden');
    }

    /**
     * Abre un modal por ID o el modal asociado a esta instancia
     */
    public open(targetId?: string): void {
        const modal = targetId ? document.getElementById(targetId) : this.getElements().modal;
        if (!modal) return;
        modal.classList.add('active');
        modal.classList.remove('hidden');
    }

    /**
     * Cierra un modal por ID o el modal asociado a esta instancia
     */
    public close(targetId?: string): void {
        const modal = targetId ? document.getElementById(targetId) : this.getElements().modal;
        if (!modal) return;
        modal.classList.remove('active');
        modal.classList.add('hidden');
        if (this.resolver) {
            this.resolver(false);
            this.resolver = null;
        }
    }

    /**
     * Diálogo interactivo de confirmación que reemplaza window.confirm() con Promesas
     */
    public confirm(options: ConfirmModalOptions): Promise<boolean> {
        this.bindEvents();
        const { modal, title, subtitle, message, iconBox, iconSlot, acceptBtn, acceptText, cancelBtn } = this.getElements();

        if (!modal) {
            return Promise.resolve(window.confirm(options.message));
        }

        const variant = options.variant || 'danger';
        const confirmText = options.confirmText || (variant === 'danger' ? 'Eliminar' : 'Confirmar');
        const cancelText = options.cancelText || 'Cancelar';
        const titleText = options.title || (variant === 'danger' ? '¿Estás seguro?' : 'Confirmar acción');
        const subtitleText = options.subtitle || (variant === 'danger' ? 'Esta acción no se puede deshacer' : 'Por favor verifica la información');
        const iconName = options.icon || (variant === 'danger' ? 'alert-triangle' : variant === 'warning' ? 'alert-circle' : 'help-circle');

        if (title) title.textContent = titleText;
        if (subtitle) subtitle.textContent = subtitleText;
        if (message) message.textContent = options.message;

        if (iconBox) {
            iconBox.className = `app-confirm-icon-box variant-${variant} modal-confirm-icon-box sa-confirm-icon-box ${variant}`;
        }

        if (iconSlot) {
            iconSlot.innerHTML = renderIconSvg(iconName, { size: 24, class: 'app-confirm-icon' });
        }

        if (acceptBtn) {
            acceptBtn.className = `app-confirm-btn app-confirm-btn-accept variant-${variant} btn-action ${variant === 'danger' ? 'btn-danger sa-btn-danger' : variant === 'warning' ? 'btn-warning-action sa-btn-warning' : 'sa-btn-primary'}`.trim();
        }
        if (acceptText) {
            acceptText.textContent = confirmText;
        } else if (acceptBtn) {
            acceptBtn.textContent = confirmText;
        }

        if (cancelBtn) {
            cancelBtn.textContent = cancelText;
        }

        // Si Lucide está presente en el documento, refrescar íconos
        if (typeof window !== 'undefined' && (window as any).lucide) {
            (window as any).lucide.createIcons();
        }

        // Si existía un diálogo previo abierto sin resolver, rechazarlo con false
        if (this.resolver) {
            this.resolver(false);
            this.resolver = null;
        }

        // Abrir modal (soporta clases active y unhidden)
        this.open();

        return new Promise<boolean>((resolve) => {
            this.resolver = resolve;
        });
    }

    private closeConfirm(result = false): void {
        this.close();
        if (this.resolver) {
            this.resolver(result);
            this.resolver = null;
        }
    }
}

// Alias de retrocompatibilidad
export const ConfirmModalService = ModalService;

// Instancia por defecto para uso global rápido
let defaultService: ModalService | null = null;

export function getModalService(modalId?: string): ModalService {
    if (modalId) return new ModalService(modalId);
    if (!defaultService) defaultService = new ModalService('admin-confirm-modal');
    return defaultService;
}

export const getConfirmModalService = getModalService;

export function openModal(id: string): void {
    getModalService(id).open(id);
}

export function closeModal(id: string): void {
    getModalService(id).close(id);
}
