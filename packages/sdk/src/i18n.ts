export interface SdkI18nStrings {
    guideLabel: string;
    online: string;
    inputPlaceholder: string;
    footerPoweredBy: string;
    guidedBubbleShort: string;
    guidedBubblePrefix: string;
    guidedBubbleGeneric: string;
    walkthroughCompleted: string;
    stepCounter: (current: number, total: number) => string;
    previous: string;
    next: string;
    skip: string;
    finish: string;
    closeAriaLabel: string;
    themeLight: string;
    themeDark: string;
    langEs: string;
    langEn: string;
    autopilotRunning: string;
    pauseAutomation: string;
    resumeAutomation: string;
    stopAutomation: string;
    authorizeAction: string;
    stepProgress: (current: number, total: number, label?: string) => string;
}

const ES: SdkI18nStrings = {
    guideLabel: "Guía de Luma",
    online: "En línea",
    inputPlaceholder: "Escribe tu duda aquí...",
    footerPoweredBy: "Potenciado por",
    guidedBubbleShort: "Te guío paso a paso.",
    guidedBubblePrefix: "Te guío:",
    guidedBubbleGeneric: "Luma te guía. Sigue el globo.",
    walkthroughCompleted: "✅ Recorrido completado",
    stepCounter: (current, total) => `Paso ${current} / ${total}`,
    previous: "Anterior",
    next: "Siguiente",
    skip: "Saltar",
    finish: "✅ Finalizar",
    closeAriaLabel: "Cerrar",
    themeLight: "Claro",
    themeDark: "Oscuro",
    langEs: "ES",
    langEn: "EN",
    autopilotRunning: "AutoPilot en ejecución",
    pauseAutomation: "Pausar automatización",
    resumeAutomation: "Reanudar automatización",
    stopAutomation: "Cancelar y cerrar automatización",
    authorizeAction: "Autorizar acción",
    stepProgress: (current, total, label) => `Paso ${current}/${total}${label ? ` · ${label}` : ""}`,
};

const EN: SdkI18nStrings = {
    guideLabel: "Luma Guide",
    online: "Online",
    inputPlaceholder: "Ask your question here...",
    footerPoweredBy: "Powered by",
    guidedBubbleShort: "I'll guide you step by step.",
    guidedBubblePrefix: "I'll guide you:",
    guidedBubbleGeneric: "Luma is guiding you. Follow the bubble.",
    walkthroughCompleted: "✅ Walkthrough completed",
    stepCounter: (current, total) => `Step ${current} / ${total}`,
    previous: "Previous",
    next: "Next",
    skip: "Skip",
    finish: "✅ Finish",
    closeAriaLabel: "Close",
    themeLight: "Light",
    themeDark: "Dark",
    langEs: "ES",
    langEn: "EN",
    autopilotRunning: "AutoPilot running",
    pauseAutomation: "Pause automation",
    resumeAutomation: "Resume automation",
    stopAutomation: "Cancel and close automation",
    authorizeAction: "Authorize action",
    stepProgress: (current, total, label) => `Step ${current}/${total}${label ? ` · ${label}` : ""}`,
};

export function resolveSdkStrings(locale?: string): SdkI18nStrings {
    const normalized = String(locale || "").toLowerCase();
    if (normalized.startsWith("es")) return ES;
    return EN;
}
