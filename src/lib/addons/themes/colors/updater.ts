import { settings } from "@lib/api/settings";
import { findByProps, findByPropsLazy, findByStoreNameLazy } from "@metro";

import chroma from "chroma-js";

import { colorOwner, installEngine, setColors } from "./omniEngine";
import { parseColorManifest } from "./parser";
import { ColorManifest, InternalColorDefinition } from "./types";

const tokenRef = findByProps("SemanticColor");
const origRawColor = { ...tokenRef.RawColor };
const AppearanceManager = findByPropsLazy("updateTheme");
const ThemeStore = findByStoreNameLazy("ThemeStore");
const FormDivider = findByPropsLazy("DIVIDER_COLORS");

let _inc = 1;

interface InternalColorRef {
    key: `bn-theme-${string}`;
    current: InternalColorDefinition | null;
    readonly origRaw: Record<string, string>;
    lastSetDiscordTheme: string;
}

/** @internal */
export const _colorRef: InternalColorRef = {
    current: null,
    key: `bn-theme-${_inc}`,
    origRaw: origRawColor,
    lastSetDiscordTheme: "darker"
};

// Old (≤ Discord 2xx) token names → names Discord 349 actually uses, so older themes cover new surfaces.
const COMPAT: Record<string, string[]> = {
    BACKGROUND_PRIMARY: ["BACKGROUND_BASE_LOWER", "BG_BASE_PRIMARY", "CHAT_BACKGROUND"],
    BACKGROUND_SECONDARY: ["BACKGROUND_BASE_LOW", "CHANNEL_BACKGROUND_DEFAULT", "PANEL_BG", "BG_BASE_SECONDARY", "BACKGROUND_SURFACE_HIGH"],
    BACKGROUND_TERTIARY: ["BACKGROUND_BASE_LOWEST", "BG_BASE_TERTIARY"],
    BACKGROUND_SECONDARY_ALT: ["MOBILE_FLOATINGBAR_BACKGROUND", "MOBILE_FLOATINGBAR_BACKGROUND_HIGHER"],
    BACKGROUND_FLOATING: ["BACKGROUND_SURFACE_HIGHER", "BACKGROUND_SURFACE_HIGHEST", "BG_SURFACE_OVERLAY"],
    BACKGROUND_MOBILE_PRIMARY: ["BG_SURFACE_RAISED"],
    TEXT_NORMAL: ["TEXT_DEFAULT"],
    TEXT_MUTED: ["TEXT_SUBTLE"],
    HEADER_PRIMARY: ["TEXT_STRONG"],
};

function flattenSemantic(def: InternalColorDefinition) {
    const out: Record<string, string> = {};
    for (const [k, d] of Object.entries(def.semantic ?? {})) {
        if (!d?.value) continue;
        try { out[k] = d.opacity === 1 || d.opacity == null ? d.value : chroma(d.value).alpha(d.opacity).hex(); } catch { }
    }
    for (const [oldName, news] of Object.entries(COMPAT)) {
        if (!out[oldName]) continue;
        for (const n of news) out[n] ??= out[oldName];
    }
    return out;
}

export function updateBunnyColor(colorManifest: ColorManifest | null, { update = true }) {
    if (settings.safeMode?.enabled) return;

    const internalDef = colorManifest ? parseColorManifest(colorManifest) : null;

    // Omnicord: Discord 349 ignores custom theme keys, so apply through the engine on the real themes.
    if (colorOwner() !== "custom" || internalDef) {
        try {
            if (internalDef) {
                if (installEngine()) setColors(flattenSemantic(internalDef), internalDef.raw ?? null, "themes");
            } else if (colorOwner() === "themes") setColors(null, null);
        } catch (e) { console.error("[Omnicord] theme engine failed", e); }
    }
    Object.assign(_colorRef, { current: internalDef });
    return;

    const ref = Object.assign(_colorRef, {
        current: internalDef,
        key: `bn-theme-${++_inc}`,
        lastSetDiscordTheme: !ThemeStore.theme.startsWith("bn-theme-")
            ? ThemeStore.theme
            : _colorRef.lastSetDiscordTheme
    });

    if (internalDef != null) {
        tokenRef.Theme[ref.key.toUpperCase()] = ref.key;
        FormDivider.DIVIDER_COLORS[ref.key] = FormDivider.DIVIDER_COLORS[ref.current!.reference];

        Object.keys(tokenRef.Shadow).forEach(k => tokenRef.Shadow[k][ref.key] = tokenRef.Shadow[k][ref.current!.reference]);
        Object.keys(tokenRef.SemanticColor).forEach(k => {
            tokenRef.SemanticColor[k][ref.key] = {
                ...tokenRef.SemanticColor[k][ref.current!.reference]
            };
        });
    }

    if (update) {
        AppearanceManager.setShouldSyncAppearanceSettings(false);
        AppearanceManager.updateTheme(internalDef != null ? ref.key : ref.lastSetDiscordTheme);
    }
}
