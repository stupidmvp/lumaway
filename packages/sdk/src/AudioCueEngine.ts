type CueName =
    | "thinking"
    | "typing"
    | "message"
    | "action_required"
    | "authorization"
    | "success"
    | "error"
    | "cancel";

export interface AudioCueConfig {
    enabled?: boolean;
    volume?: number; // 0..1
}

export class AudioCueEngine {
    private enabled: boolean;
    private volume: number;
    private ctx: AudioContext | null = null;
    private unlocked = false;
    private lastPlayed = new Map<CueName, number>();

    constructor(config?: AudioCueConfig) {
        this.enabled = config?.enabled !== false;
        this.volume = Math.max(0, Math.min(1, config?.volume ?? 0.18));
        this.bindUnlockHandlers();
    }

    setEnabled(value: boolean) {
        this.enabled = value;
    }

    setVolume(value: number) {
        this.volume = Math.max(0, Math.min(1, value));
    }

    play(cue: CueName) {
        if (!this.enabled) return;
        if (!this.allowByRateLimit(cue)) return;
        if (!this.ensureContext()) return;

        switch (cue) {
            case "thinking":
                this.playThinking();
                break;
            case "typing":
                this.playTyping();
                break;
            case "message":
                this.playMessage();
                break;
            case "action_required":
                this.playActionRequired();
                break;
            case "authorization":
                this.playAuthorization();
                break;
            case "success":
                this.playSuccess();
                break;
            case "error":
                this.playError();
                break;
            case "cancel":
                this.playCancel();
                break;
        }
    }

    private bindUnlockHandlers() {
        if (typeof window === "undefined") return;
        const unlock = () => {
            this.ensureContext();
            this.ctx?.resume().finally(() => {
                this.unlocked = true;
            });
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("keydown", unlock);
        };
        window.addEventListener("pointerdown", unlock, { passive: true, once: true });
        window.addEventListener("keydown", unlock, { passive: true, once: true });
    }

    private ensureContext(): boolean {
        if (typeof window === "undefined") return false;
        if (!this.ctx) {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            if (!Ctx) return false;
            this.ctx = new Ctx();
        }
        if (this.ctx.state === "suspended" && this.unlocked) {
            this.ctx.resume().catch(() => undefined);
        }
        return this.ctx.state !== "closed";
    }

    private allowByRateLimit(cue: CueName): boolean {
        const now = Date.now();
        const last = this.lastPlayed.get(cue) || 0;
        const minGapByCue: Record<CueName, number> = {
            thinking: 1600,
            typing: 750,
            message: 500,
            action_required: 700,
            authorization: 900,
            success: 600,
            error: 600,
            cancel: 600,
        };
        if (now - last < minGapByCue[cue]) return false;
        this.lastPlayed.set(cue, now);
        return true;
    }

    private scheduleTone(
        time: number,
        freq: number,
        duration: number,
        type: OscillatorType,
        gainMul = 1
    ) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(this.volume * gainMul, time + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + duration + 0.02);
    }

    // Signature timbre: clean bell-like core + subtle airy harmonic for brand identity.
    private scheduleBrandTone(time: number, freq: number, duration: number, gainMul = 1) {
        if (!this.ctx) return;
        const core = this.ctx.createOscillator();
        const shimmer = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const shimmerGain = this.ctx.createGain();
        const master = this.ctx.createGain();

        core.type = "triangle";
        shimmer.type = "sine";
        core.frequency.setValueAtTime(freq, time);
        shimmer.frequency.setValueAtTime(freq * 2.01, time);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(this.volume * gainMul, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        shimmerGain.gain.setValueAtTime(0.0001, time);
        shimmerGain.gain.linearRampToValueAtTime(this.volume * gainMul * 0.35, time + 0.015);
        shimmerGain.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.85);

        master.gain.setValueAtTime(1, time);

        core.connect(gain).connect(master);
        shimmer.connect(shimmerGain).connect(master);
        master.connect(this.ctx.destination);

        core.start(time);
        shimmer.start(time);
        core.stop(time + duration + 0.03);
        shimmer.stop(time + duration + 0.03);
    }

    private playThinking() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.scheduleBrandTone(t, 622, 0.09, 0.38);
    }

    private playTyping() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.scheduleBrandTone(t, 698, 0.055, 0.26);
    }

    private playMessage() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Luma signature motif (ascending major 3rd)
        this.scheduleBrandTone(t, 587, 0.11, 0.56);
        this.scheduleBrandTone(t + 0.12, 740, 0.13, 0.54);
    }

    private playActionRequired() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.scheduleBrandTone(t, 880, 0.11, 0.62);
        this.scheduleBrandTone(t + 0.1, 1047, 0.1, 0.58);
    }

    private playAuthorization() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Deliberate double-pulse for approval attention.
        this.scheduleBrandTone(t, 932, 0.08, 0.55);
        this.scheduleBrandTone(t + 0.14, 932, 0.08, 0.48);
    }

    private playSuccess() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Clear positive cadence.
        this.scheduleBrandTone(t, 622, 0.1, 0.58);
        this.scheduleBrandTone(t + 0.1, 784, 0.11, 0.56);
        this.scheduleBrandTone(t + 0.21, 988, 0.12, 0.54);
    }

    private playError() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.scheduleTone(t, 466, 0.11, "sine", 0.4);
        this.scheduleTone(t + 0.1, 349, 0.14, "triangle", 0.38);
    }

    private playCancel() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.scheduleTone(t, 554, 0.09, "sine", 0.38);
        this.scheduleTone(t + 0.1, 415, 0.11, "triangle", 0.34);
    }
}
