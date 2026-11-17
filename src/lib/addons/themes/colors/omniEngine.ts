// Color engine for Discord 349+: overrides resolveSemanticColor for the real base themes
// (dark/darker/midnight/light) instead of registering a fake theme key, which new Discord ignores.
// Approach adapted from Valenced's api.themes plugin.
import { before, instead } from "@lib/api/patcher";
import { logger } from "@lib/utils/logger";
import { findByProps } from "@metro";
import { React } from "@metro/common";

let semantic: Record<string, string> | null = null;
let raw: Record<string, string> | null = null;
let tokens: any;
let reverse: Map<object, string> | undefined;
const rawSaved = new Map<string, PropertyDescriptor | undefined>();
const unpatches: (() => void)[] = [];

let version = 0;
const listeners = new Set<() => void>();

function nameOf(internal: any, color: any): string | undefined {
    try { const n = internal.getSemanticColorName?.(color); if (n) return n; } catch { }
    if (!reverse) {
        reverse = new Map();
        for (const [k, v] of Object.entries<any>(tokens?.default?.colors ?? {})) if (v && typeof v === "object") reverse.set(v, k);
    }
    return reverse.get(color);
}

/** All semantic token names known to this Discord build. */
export function tokenNames(): string[] {
    tokens ??= findByProps("RawColor", "SemanticColor");
    return [...new Set([...Object.keys(tokens?.default?.colors ?? {}), ...Object.keys(tokens?.SemanticColor ?? {})])];
}
export const rawNames = () => Object.keys((tokens ??= findByProps("RawColor", "SemanticColor"))?.RawColor ?? {});

export function installEngine() {
    if (unpatches.length) return true;
    tokens ??= findByProps("RawColor", "SemanticColor");
    const internal = tokens?.default?.internal ?? tokens?.default?.meta;
    if (!internal?.resolveSemanticColor) { logger.error("theme engine: resolveSemanticColor not found"); return false; }

    unpatches.push(instead("resolveSemanticColor", internal, (args: any[], orig: any) => {
        if (semantic) {
            const [, color, ctx] = args;
            if (!ctx?.isProfileTheme) {
                const n = nameOf(internal, color);
                const v = n && semantic[n];
                if (v) return v;
            }
        }
        return orig.apply(internal, args);
    }));

    // Re-render themed trees when colors change (new key through enabledExperiments).
    const Root = findByProps("RootThemeContextProvider");
    if (Root) unpatches.push(before("RootThemeContextProvider", Root, (args: any[]) => {
        const v = React.useSyncExternalStore((l: () => void) => (listeners.add(l), () => void listeners.delete(l)), () => version);
        const props = args[0] ?? (args[0] = {});
        props.enabledExperiments = [...(props.enabledExperiments ?? []).filter((n: string) => !n.startsWith("omnicord-colors:")), `omnicord-colors:${v}`];
        return args;
    }));
    return true;
}

function restoreRaw() {
    const R = tokens?.RawColor;
    if (!R) return;
    for (const [k, d] of rawSaved) {
        if (d) Object.defineProperty(R, k, d); else delete R[k];
    }
    rawSaved.clear();
}

function applyRaw() {
    const R = tokens?.RawColor;
    if (!R || !raw) return;
    for (const [k, v] of Object.entries(raw)) {
        if (!(k in R)) continue;
        if (!rawSaved.has(k)) rawSaved.set(k, Object.getOwnPropertyDescriptor(R, k));
        // Kettu redefines RawColor with getter-only props, so define instead of assigning.
        Object.defineProperty(R, k, { configurable: true, enumerable: true, get: () => v, set: () => { } });
    }
}

/** Who set the current colors: "custom" (Custom Theme plugin) or "themes" (Themes page). */
let owner: string | null = null;
export const colorOwner = () => owner;
/** Called when the Themes page selects a theme, so Custom Theme can switch itself off. */
export const themeHooks: { onExternalSelect?: () => void; } = {};

export function setColors(sem: Record<string, string> | null, rawColors: Record<string, string> | null, by: string | null = null) {
    owner = sem || rawColors ? by : null;
    restoreRaw();
    semantic = sem;
    raw = rawColors;
    applyRaw();
    version++;
    listeners.forEach(l => l());
}

export function uninstallEngine() {
    setColors(null, null);
    unpatches.splice(0).forEach(u => u());
}
