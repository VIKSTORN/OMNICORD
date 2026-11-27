// Palette model, presets and generators for the Custom Theme plugin.
import chroma from "chroma-js";

export const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export type Palette = {
    accent: string; bg1: string; bg2: string; bg3: string; text: string; muted: string; header: string;
    /** Optional: "" = derived from the others / Discord default. */
    link?: string; input?: string; nav?: string; mention?: string;
};

export const REQUIRED: [keyof Palette, string][] = [
    ["accent", "Accent"],
    ["bg1", "Chat background"],
    ["bg2", "Sidebar / cards"],
    ["bg3", "Deepest background"],
    ["header", "Names / headers"],
    ["text", "Text"],
    ["muted", "Muted text"],
];
export const OPTIONAL: [keyof Palette, string, string][] = [
    ["link", "Links", "Empty = accent"],
    ["input", "Message box", "Empty = sidebar color"],
    ["nav", "Bottom tab bar", "Empty = deepest color"],
    ["mention", "Mention highlight", "Empty = Discord default"],
];

const P = (accent: string, bg1: string, bg2: string, bg3: string, text: string, muted: string, header: string): Palette =>
    ({ accent, bg1, bg2, bg3, text, muted, header });

export const PRESETS: Record<string, Palette> = {
    AMOLED: P("#5865f2", "#000000", "#050505", "#000000", "#e3e5e8", "#949ba4", "#ffffff"),
    "Discord Classic": P("#5865f2", "#313338", "#2b2d31", "#1e1f22", "#dbdee1", "#949ba4", "#f2f3f5"),
    "Midnight Blue": P("#7aa2f7", "#1a1b26", "#16161e", "#13131a", "#c0caf5", "#7982a9", "#e0e6ff"),
    Mocha: P("#cba6f7", "#1e1e2e", "#181825", "#11111b", "#cdd6f4", "#a6adc8", "#f5e0dc"),
    Nord: P("#88c0d0", "#2e3440", "#292e39", "#242933", "#d8dee9", "#8a93a5", "#eceff4"),
    Vampire: P("#bd93f9", "#282a36", "#21222c", "#191a21", "#f8f8f2", "#a4abc9", "#ffffff"),
    Retro: P("#fe8019", "#282828", "#1d2021", "#141617", "#ebdbb2", "#a89984", "#fbf1c7"),
    "One Dark": P("#61afef", "#282c34", "#21252b", "#1b1f23", "#abb2bf", "#7f848e", "#e6e6e6"),
    Lime: P("#a6e22e", "#272822", "#1e1f1c", "#171814", "#f8f8f2", "#a59f85", "#ffffff"),
    Forest: P("#7fbf7f", "#1d2420", "#18201b", "#131915", "#d6e2d6", "#8fa38f", "#eef7ee"),
    Moss: P("#a7c080", "#2d353b", "#272e33", "#1e2326", "#d3c6aa", "#9da9a0", "#e6dcc4"),
    Solar: P("#268bd2", "#002b36", "#00252e", "#001e26", "#93a1a1", "#657b83", "#eee8d5"),
    Ocean: P("#00b4d8", "#0b1d2a", "#091823", "#06121b", "#d6eef7", "#7fa3b5", "#ffffff"),
    Rose: P("#eb6f92", "#232136", "#1f1d2e", "#191724", "#e0def4", "#908caa", "#f6c177"),
    Sakura: P("#ff8fb1", "#2a1f2d", "#241a27", "#1d1520", "#f3e5ee", "#b89fb0", "#ffd6e5"),
    Neon: P("#ff2a6d", "#0d0221", "#0a011a", "#070113", "#e0e0ff", "#8f8fbf", "#05d9e8"),
    Blood: P("#e03131", "#160b0b", "#110808", "#0b0505", "#f1dede", "#a08585", "#ffffff"),
    Gold: P("#e5b647", "#14120d", "#100e0a", "#0b0a07", "#efe6cf", "#a89b7c", "#fff3d1"),
    Light: P("#5865f2", "#ffffff", "#f2f3f5", "#e3e5e8", "#313338", "#5c5e66", "#060607"),
    Paper: P("#c96a28", "#f7f3ea", "#efe9dc", "#e5dccb", "#3b3329", "#7a6f60", "#1f1a14"),
};

export type Cfg = {
    palette: Palette;
    bg?: { url: string; blur: number; alpha: number; source?: string; zoom?: number; x?: number; y?: number; fit?: "cover" | "contain" | "stretch"; parallax?: number; smooth?: number;
        light?: { on: boolean; color: string; strength: number; size: number; pos: "top" | "center" | "bottom"; follow: boolean; }; vignette?: number;
        grad?: { on: boolean; c1: string; c2: string; c3?: string; dir?: "v" | "h" | "d"; alpha?: number; blend?: string; }; };
    deep?: boolean;
    tint?: number;    // 0..100: pull backgrounds toward the accent
    bright?: number;  // -5..5: lighten/darken every background
    overrides?: Record<string, string>;     // semantic token -> hex
    rawOverrides?: Record<string, string>;  // raw color -> hex
};

const ok = (c?: string) => !!c && HEX.test(c);
const isLight = (c: string) => { try { return chroma(c).luminance() > 0.4; } catch { return false; } };

/** Palette after tint/brightness and with optional colors filled in. */
export function effective(c: Cfg): Required<Palette> {
    const p = c.palette;
    const tint = Math.max(0, Math.min(100, c.tint ?? 0)) / 100 * 0.35;
    const bright = (c.bright ?? 0) * 0.12;
    const bg = (x: string) => {
        try {
            let v = chroma(x);
            if (tint) v = chroma.mix(v, p.accent, tint, "rgb");
            if (bright) v = bright > 0 ? v.brighten(bright) : v.darken(-bright);
            return v.hex();
        } catch { return x; }
    };
    const bg1 = bg(p.bg1), bg2 = bg(p.bg2), bg3 = bg(p.bg3);
    return {
        ...p, bg1, bg2, bg3,
        link: ok(p.link) ? p.link! : p.accent,
        input: ok(p.input) ? bg(p.input!) : bg2,
        nav: ok(p.nav) ? bg(p.nav!) : bg3,
        mention: ok(p.mention) ? chroma(p.mention!).hex("rgb") : "",
    };
}

export function invalid(p: Palette): string | undefined {
    const bad = REQUIRED.find(([k]) => !ok(p[k] as string));
    if (bad) return bad[1];
    const badOpt = OPTIONAL.find(([k]) => p[k] && !ok(p[k] as string));
    return badOpt?.[1];
}

/** Whole palette from one accent color. */
export function fromAccent(accent: string, light = false): Palette {
    const a = chroma(accent);
    const h = Number.isNaN(a.get("hsl.h")) ? 230 : a.get("hsl.h");
    const hsl = (s: number, l: number) => chroma.hsl(h, s, l).hex();
    return light
        ? { accent, bg1: hsl(0.25, 0.98), bg2: hsl(0.22, 0.94), bg3: hsl(0.2, 0.89), text: hsl(0.15, 0.2), muted: hsl(0.1, 0.42), header: hsl(0.2, 0.08) }
        : { accent, bg1: hsl(0.22, 0.12), bg2: hsl(0.22, 0.095), bg3: hsl(0.22, 0.07), text: hsl(0.15, 0.88), muted: hsl(0.1, 0.62), header: hsl(0.3, 0.96) };
}

export function randomPalette(): Palette {
    const accent = chroma.hsl(Math.random() * 360, 0.6 + Math.random() * 0.3, 0.55 + Math.random() * 0.1).hex();
    return fromAccent(accent, Math.random() < 0.15);
}

/** Readable text color on top of a color. */
export const onColor = (c: string) => (ok(c) && isLight(c) ? "#000000" : "#ffffff");

export const samePalette = (a: Palette, b: Palette) =>
    REQUIRED.every(([k]) => (a[k] as string)?.toLowerCase() === (b[k] as string)?.toLowerCase());
