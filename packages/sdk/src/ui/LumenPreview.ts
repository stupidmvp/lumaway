export interface LumenHealthScore {
    score: "low" | "medium" | "high";
    recommendations: string[];
    actionableEventsCount: number;
    totalEventsCount: number;
}

export interface LumenPreviewOptions {
    onSave: () => void;
    onDiscard: () => void;
    locale?: string;
    health?: LumenHealthScore;
}

export class LumenPreview {
    private host: HTMLElement;
    private shadowRoot: ShadowRoot;
    private container: HTMLElement;
    private videoEl: HTMLVideoElement;
    private options: LumenPreviewOptions;

    constructor(options: LumenPreviewOptions) {
        this.options = options;

        // 1. Create Host
        const id = "luma-preview-host";
        const existing = document.getElementById(id);
        if (existing) existing.remove();

        this.host = document.createElement("div");
        this.host.id = id;
        this.host.style.position = "fixed";
        this.host.style.inset = "0";
        this.host.style.zIndex = "2147483647";
        this.host.style.pointerEvents = "none";
        document.body.appendChild(this.host);

        this.shadowRoot = this.host.attachShadow({ mode: "open" });
        this.injectStyles();

        // 2. Build UI
        this.container = document.createElement("div");
        this.container.className = "luma-preview-overlay";
        this.container.innerHTML = `
            <div class="luma-preview-card">
                <div class="luma-preview-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 7l-7 5 7 5V7z"></path>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                    <span>Vista previa del Lumen</span>
                    <button class="luma-preview-close" aria-label="Cerrar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="luma-preview-body">
                    <div class="luma-video-container">
                        <video class="luma-preview-video" controls autoplay playsinline></video>
                    </div>
                    
                    <div class="luma-health-panel">
                        <div class="luma-health-header">
                            <span class="luma-health-title">Análisis de Guía Interactiva</span>
                            <span class="luma-health-badge" id="luma-health-badge">Calculando...</span>
                        </div>
                        <div class="luma-health-stats">
                            <div class="luma-stat-item">
                                <span class="luma-stat-val" id="luma-stat-events">0</span>
                                <span class="luma-stat-label">Acciones detectadas</span>
                            </div>
                        </div>
                        <div class="luma-health-recommendations" id="luma-health-recs">
                            <!-- Recommendations will be injected here -->
                        </div>
                    </div>

                    <p class="luma-preview-hint">Revisa tu grabación y la calidad de los selectores detectados para asegurar tours interactivos precisos.</p>
                </div>
                <div class="luma-preview-footer">
                    <button class="luma-preview-btn luma-btn-discard">Descartar</button>
                    <button class="luma-preview-btn luma-btn-save">Guardar y Finalizar</button>
                </div>
            </div>

            <!-- Custom Confirmation Dialog (Shadcn-like) -->
            <div class="luma-confirm-overlay" id="luma-confirm-dialog">
                <div class="luma-confirm-card">
                    <div class="luma-confirm-header">
                        <span class="luma-confirm-title">¿Estás completamente seguro?</span>
                        <p class="luma-confirm-desc">Esta acción no se puede deshacer. Esto eliminará permanentemente la grabación actual y todos sus eventos asociados.</p>
                    </div>
                    <div class="luma-confirm-footer">
                        <button class="luma-confirm-btn luma-confirm-cancel">Cancelar</button>
                        <button class="luma-confirm-btn luma-confirm-action">Sí, descartar grabación</button>
                    </div>
                </div>
            </div>
        `;

        this.videoEl = this.container.querySelector("video")!;
        
        const closeBtn = this.container.querySelector(".luma-preview-close") as HTMLElement;
        const discardBtn = this.container.querySelector(".luma-btn-discard") as HTMLElement;
        const saveBtn = this.container.querySelector(".luma-btn-save") as HTMLElement;

        // Confirmation dialog elements
        const confirmDialog = this.container.querySelector("#luma-confirm-dialog") as HTMLElement;
        const confirmCancel = this.container.querySelector(".luma-confirm-cancel") as HTMLElement;
        const confirmAction = this.container.querySelector(".luma-confirm-action") as HTMLElement;

        closeBtn.onclick = () => this.showConfirm();
        discardBtn.onclick = () => this.showConfirm();
        saveBtn.onclick = () => this.handleSave();

        confirmCancel.onclick = () => this.hideConfirm();
        confirmAction.onclick = () => {
            this.hideConfirm();
            this.executeDiscard();
        };

        this.shadowRoot.appendChild(this.container);
    }

    private injectStyles() {
        const style = document.createElement("style");
        style.textContent = `
            :host {
                --luma-bg: #ffffff;
                --luma-text: #1f2937;
                --luma-text-muted: #6b7280;
                --luma-primary: #4f46e5;
                --luma-primary-hover: #4338ca;
                --luma-danger: #ef4444;
                --luma-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                --luma-radius: 16px;
                --luma-font: 'Inter', system-ui, -apple-system, sans-serif;
            }

            .luma-preview-overlay {
                position: absolute;
                inset: 0;
                background: rgba(15, 23, 42, 0.75);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: auto;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .luma-preview-overlay.visible {
                opacity: 1;
            }

            .luma-preview-card {
                width: min(600px, 90vw);
                background: var(--luma-bg);
                border-radius: var(--luma-radius);
                box-shadow: var(--luma-shadow);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: translateY(20px) scale(0.95);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            .luma-preview-overlay.visible .luma-preview-card {
                transform: translateY(0) scale(1);
            }

            .luma-preview-header {
                padding: 16px 20px;
                border-bottom: 1px solid #f1f5f9;
                display: flex;
                align-items: center;
                gap: 12px;
                font-family: var(--luma-font);
                font-weight: 700;
                color: var(--luma-text);
            }

            .luma-preview-header svg {
                width: 20px;
                height: 20px;
                color: var(--luma-primary);
            }

            .luma-preview-close {
                margin-left: auto;
                background: transparent;
                border: none;
                color: var(--luma-text-muted);
                cursor: pointer;
                padding: 4px;
                border-radius: 6px;
                display: flex;
                transition: background 0.2s;
            }

            .luma-preview-close:hover {
                background: #f1f5f9;
                color: var(--luma-text);
            }

            .luma-preview-body {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                max-height: 70vh;
                overflow-y: auto;
            }

            .luma-video-container {
                width: 100%;
                background: #000;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }

            .luma-preview-video {
                width: 100%;
                display: block;
                aspect-ratio: 16/9;
            }

            .luma-health-panel {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 16px;
            }

            .luma-health-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }

            .luma-health-title {
                font-family: var(--luma-font);
                font-weight: 700;
                font-size: 14px;
                color: var(--luma-text);
            }

            .luma-health-badge {
                padding: 4px 10px;
                border-radius: 99px;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .luma-health-badge.high { background: #dcfce7; color: #166534; }
            .luma-health-badge.medium { background: #fef9c3; color: #854d0e; }
            .luma-health-badge.low { background: #fee2e2; color: #991b1b; }

            .luma-health-stats {
                display: flex;
                gap: 20px;
                margin-bottom: 12px;
            }

            .luma-stat-item {
                display: flex;
                flex-direction: column;
            }

            .luma-stat-val {
                font-family: var(--luma-font);
                font-weight: 700;
                font-size: 18px;
                color: var(--luma-primary);
            }

            .luma-stat-label {
                font-size: 11px;
                color: var(--luma-text-muted);
                font-weight: 600;
            }

            .luma-health-recommendations {
                display: flex;
                flex-direction: column;
                gap: 6px;
                border-top: 1px solid #e2e8f0;
                padding-top: 12px;
            }

            .luma-rec-item {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                font-size: 13px;
                color: var(--luma-text);
                line-height: 1.4;
            }

            .luma-rec-item::before {
                content: "•";
                color: var(--luma-primary);
                font-weight: bold;
            }

            .luma-preview-hint {
                margin: 0;
                font-family: var(--luma-font);
                font-size: 14px;
                color: var(--luma-text-muted);
                text-align: center;
                line-height: 1.5;
            }

            .luma-preview-footer {
                padding: 16px 20px;
                background: #f8fafc;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }

            .luma-preview-btn {
                padding: 10px 20px;
                border-radius: 10px;
                font-family: var(--luma-font);
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
            }

            .luma-btn-discard {
                background: transparent;
                color: var(--luma-danger);
                border: 1px solid transparent;
            }

            .luma-btn-discard:hover {
                background: #fee2e2;
                border-color: #fecaca;
            }

            .luma-btn-save {
                background: var(--luma-primary);
                color: white;
                box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
            }

            .luma-btn-save:hover {
                background: var(--luma-primary-hover);
                transform: translateY(-1px);
                box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
            }

            /* --- Custom Confirmation Dialog --- */
            .luma-confirm-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(2px);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 100;
                animation: luma-fade-in 0.2s ease;
            }

            .luma-confirm-overlay.visible {
                display: flex;
            }

            .luma-confirm-card {
                background: var(--luma-bg);
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                width: min(400px, 85vw);
                padding: 24px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                animation: luma-slide-up 0.2s ease;
            }

            .luma-confirm-header {
                margin-bottom: 24px;
            }

            .luma-confirm-title {
                display: block;
                font-family: var(--luma-font);
                font-size: 18px;
                font-weight: 600;
                color: #0f172a;
                margin-bottom: 8px;
            }

            .luma-confirm-desc {
                margin: 0;
                font-family: var(--luma-font);
                font-size: 14px;
                color: #64748b;
                line-height: 1.5;
            }

            .luma-confirm-footer {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }

            .luma-confirm-btn {
                padding: 8px 16px;
                border-radius: 6px;
                font-family: var(--luma-font);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                transition: background 0.2s;
            }

            .luma-confirm-cancel {
                background: white;
                color: #0f172a;
                border: 1px solid #e2e8f0;
            }

            .luma-confirm-cancel:hover {
                background: #f8fafc;
            }

            .luma-confirm-action {
                background: #0f172a;
                color: white;
            }

            .luma-confirm-action:hover {
                background: #1e293b;
            }

            @keyframes luma-fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes luma-slide-up {
                from { transform: translateY(10px) scale(0.98); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
        `;
        this.shadowRoot.appendChild(style);
    }

    public show(blob: Blob) {
        const url = URL.createObjectURL(blob);
        this.videoEl.src = url;
        
        if (this.options.health) {
            this.renderHealth(this.options.health);
        }

        requestAnimationFrame(() => {
            this.container.classList.add("visible");
        });
    }

    private renderHealth(health: LumenHealthScore) {
        const badge = this.container.querySelector("#luma-health-badge")!;
        const statEvents = this.container.querySelector("#luma-stat-events")!;
        const recsContainer = this.container.querySelector("#luma-health-recs")!;

        statEvents.textContent = health.actionableEventsCount.toString();
        
        const labels = {
            high: "Calidad Alta (Excelente para Tours)",
            medium: "Calidad Media (Aceptable)",
            low: "Calidad Baja (Difícil de seguir)"
        };

        badge.textContent = labels[health.score];
        badge.className = `luma-health-badge ${health.score}`;

        recsContainer.innerHTML = health.recommendations
            .map(rec => `<div class="luma-rec-item">${rec}</div>`)
            .join("");
    }

    private handleSave() {
        this.hide();
        this.options.onSave();
    }

    private showConfirm() {
        const dialog = this.container.querySelector("#luma-confirm-dialog") as HTMLElement;
        dialog.classList.add("visible");
    }

    private hideConfirm() {
        const dialog = this.container.querySelector("#luma-confirm-dialog") as HTMLElement;
        dialog.classList.remove("visible");
    }

    private executeDiscard() {
        this.hide();
        this.options.onDiscard();
    }

    private hide() {
        this.container.classList.remove("visible");
        this.videoEl.pause();
        setTimeout(() => {
            this.host.remove();
        }, 300);
    }
}
