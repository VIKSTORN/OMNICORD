// Turns a palette config into a Kettu/Vendetta theme (spec 2) covering every Discord token.
import { rawNames, tokenNames } from "@lib/addons/themes/colors/omniEngine";
import chroma from "chroma-js";

import { logger } from "../vd";
import { Cfg, effective, HEX } from "./palette";

type Eff = ReturnType<typeof effective>;
const s2 = (c: string) => [c, c]; // [dark, light]

// Token-based (split on "_") so e.g. INTERACTIVE isn't caught by ACTIVE.
const SKIP_PARTS = new Set(["MODIFIER", "MOD", "STATUS", "DANGER", "WARNING", "POSITIVE", "CRITICAL", "INFO", "MENTION", "MENTIONED", "SPOILER",
    "BADGE", "PREMIUM", "NITRO", "BOOST", "SPEAKING", "ONLINE", "IDLE", "DND", "OFFLINE", "STREAMING", "SHADOW", "BORDER", "SCROLLBAR", "HOVER",
    "ACTIVE", "SELECTED", "PRESSED", "HIGHLIGHT", "ON", "WHITE", "BLACK", "DEPRECATED", "GRADIENT", "FILTER", "LOCKED", "NOTICE", "AUTOMOD",
    "GUILD", "DIVIDER", "UNREAD", "NEW", "RED", "GREEN", "YELLOW", "ORANGE", "BLURPLE", "TOOLTIP", "SPINE", "LOGO"]);
const isBg = (k: string) => /BACKGROUND|(^|_)BG(_|$)|SURFACE|(^|_)FILL|TILE|CONTAINER|(^|_)PANEL/.test(k);

function classify(k: string, p: Eff): string | undefined {
    if (p.mention && /MENTION/.test(k) && isBg(k) && !/TEXT|ICON|FOREGROUND/.test(k)) return p.mention + "30";
    if (k.split("_").some(x => SKIP_PARTS.has(x))) return;
    if (/LINK/.test(k)) return /TEXT|BACKGROUND|BUTTON|^LINK/.test(k) ? p.link : undefined;
    if (/BRAND|ACCENT/.test(k)) return /TEXT|BACKGROUND|BUTTON/.test(k) ? p.accent : undefined;
    if (!isBg(k) && /^(TEXT|HEADER|INTERACTIVE|CHANNELS|ICON)/.test(k))
        return /MUTED|SECONDARY|TERTIARY|PLACEHOLDER|SUBTLE|DISABLED|FAINT|LOW/.test(k) ? p.muted : /HEADER_PRIMARY|STRONG|HIGH/.test(k) ? p.header : p.text;
    if (/^(ICON|TEXT|HEADER|INTERACTIVE|CHANNELS)/.test(k)) return; // icon/text tiles etc: keep Discord's
    // Only real surfaces: anything naming an icon/text/glyph keeps Discord's color (else chat-bar/emoji icons go black).
    if (/ICON|TEXT|GLYPH|FOREGROUND|STROKE|EMOJI|LABEL|TINT|LINE|PLACEHOLDER|THUMB|KNOB/.test(k)) return;
    if (isBg(k)) {
        if (/NAV|TAB_BAR|TABBAR|FLOATINGBAR|BOTTOM_BAR/.test(k)) return p.nav;
        if (/INPUT|TEXTAREA|COMPOSER/.test(k)) return p.input;
        if (/TERTIARY|FLOATING|BACKDROP|LOWEST|DEEP|MOBILE_SECONDARY|SECONDARY_ALT/.test(k)) return p.bg3;
        if (/SECONDARY|RAISED|OVERLAY|CARD|MOBILE_PRIMARY|HIGHER|SURFACE|MODAL|SHEET/.test(k)) return p.bg2;
        return p.bg1;
    }
}

const mix = (a: string, b: string, f: number) => chroma.mix(a, b, Math.max(0, Math.min(1, f)), "rgb").hex();

/** Remap Discord's grey ramp (PRIMARY_560..900) onto the palette, and the BRAND ramp onto the accent. */
function rawScale(p: Eff, deep: boolean) {
    const out: Record<string, string> = {};
    for (const k of rawNames()) {
        const brand = /^BRAND_(\d+)$/.exec(k);
        if (brand) {
            const n = +brand[1];
            out[k] = n === 500 ? p.accent : n < 500 ? mix(p.accent, "#ffffff", (500 - n) / 500 * 0.9) : mix(p.accent, "#000000", (n - 500) / 500 * 0.8);
            continue;
        }
        if (!deep) continue;
        const m = /^PRIMARY_(\d+)$/.exec(k);
        if (!m) continue;
        const n = +m[1];
        if (n < 560) continue; // light/mid greys are text, icons and tiles: keep Discord's
        else if (n <= 600) out[k] = chroma(p.bg1).brighten((600 - n) / 100).hex();
        else if (n <= 630) out[k] = mix(p.bg1, p.bg2, (n - 600) / 30);
        else if (n <= 700) out[k] = mix(p.bg2, p.bg3, (n - 630) / 70);
        else out[k] = chroma(p.bg3).darken((n - 700) / 100).hex();
    }
    return out;
}

export function buildTheme(c: Cfg) {
    const p = effective(c);
    const semanticColors: Record<string, string[]> = {
        // legacy + new token names
        BACKGROUND_PRIMARY: s2(p.bg1), BG_BASE_PRIMARY: s2(p.bg1), CHAT_BACKGROUND: s2(p.bg1),
        BACKGROUND_SECONDARY: s2(p.bg2), BG_BASE_SECONDARY: s2(p.bg2), BACKGROUND_MOBILE_PRIMARY: s2(p.bg2), BG_SURFACE_RAISED: s2(p.bg2),
        BACKGROUND_TERTIARY: s2(p.bg3), BACKGROUND_SECONDARY_ALT: s2(p.bg3), BG_BASE_TERTIARY: s2(p.bg3), BACKGROUND_MOBILE_SECONDARY: s2(p.nav),
        BACKGROUND_FLOATING: s2(p.bg2), BG_SURFACE_OVERLAY: s2(p.bg2), BG_BACKDROP: s2(p.bg3 + "cc"),
        CHAT_INPUT_CONTAINER_BACKGROUND: s2(p.input), BACKGROUND_NESTED_FLOATING: s2(p.bg2),
        HEADER_PRIMARY: s2(p.header), HEADER_SECONDARY: s2(p.muted),
        TEXT_NORMAL: s2(p.text), TEXT_DEFAULT: s2(p.text), TEXT_MUTED: s2(p.muted), TEXT_SECONDARY: s2(p.muted),
        INTERACTIVE_NORMAL: s2(p.text), INTERACTIVE_ACTIVE: s2(p.header), INTERACTIVE_MUTED: s2(p.muted),
        CHANNELS_DEFAULT: s2(p.muted), CHANNEL_ICON: s2(p.muted),
        TEXT_LINK: s2(p.link), TEXT_BRAND: s2(p.accent),
        BUTTON_BACKGROUND_BRAND: s2(p.accent), REDESIGN_BUTTON_PRIMARY_BACKGROUND: s2(p.accent),
        BACKGROUND_BRAND: s2(p.accent), CONTROL_BRAND_FOREGROUND: s2(p.accent), CONTROL_BRAND_FOREGROUND_NEW: s2(p.accent),
        ...(p.mention ? {
            BACKGROUND_MENTIONED: s2(p.mention + "30"), BACKGROUND_MENTIONED_HOVER: s2(p.mention + "40"),
            BACKGROUND_MESSAGE_HIGHLIGHT: s2(p.mention + "26"), BACKGROUND_MESSAGE_HIGHLIGHT_HOVER: s2(p.mention + "33"),
            INFO_HELP_FOREGROUND: s2(p.mention), MENTION_FOREGROUND: s2(p.mention), MENTION_BACKGROUND: s2(p.mention + "40"),
        } : {}),
    };
    // Cover every semantic token Discord has in this version, by name.
    try {
        for (const k of tokenNames()) {
            if (k in semanticColors) continue;
            const v = classify(k, p);
            if (v) semanticColors[k] = s2(v);
        }
    } catch (e) { logger.error("theme token scan failed", e); }

    // Per-element overrides always win.
    const rawColors: Record<string, string> = { ...rawScale(p, c.deep !== false), PLUM_23: p.bg1 };
    for (const [k, v] of Object.entries(c.overrides ?? {})) if (HEX.test(v)) semanticColors[k] = s2(v);
    for (const [k, v] of Object.entries(c.rawOverrides ?? {})) if (HEX.test(v)) rawColors[k] = v;

    return {
        name: "Custom Theme",
        description: "Made with Omnicord Custom Theme",
        authors: [{ name: "Omnicord", id: "0" }],
        spec: 2,
        semanticColors,
        rawColors,
        ...(c.bg?.url ? { background: { url: c.bg.url, blur: c.bg.blur || 0, alpha: c.bg.alpha ?? 0.6, zoom: c.bg.zoom ?? 1, x: c.bg.x ?? 0, y: c.bg.y ?? 0, fit: c.bg.fit ?? "cover" } } : {}),
    };
}

export const flat = (data: { semanticColors?: Record<string, string[]>; }) => {
    const sem: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.semanticColors ?? {})) if (v?.[0]) sem[k] = v[0];
    return sem;
};
