import { Txt } from "@core/ui/components/SafeUI";
import * as themes from "@lib/addons/themes";
import chroma from "chroma-js";

import { SafeInput, SafeSwitchRow } from "@core/ui/components/SafeUI";

import { parseColorManifest } from "@lib/addons/themes/colors/parser";
import { _colorRef } from "@lib/addons/themes/colors/updater";
import { getStoredTheme } from "@lib/api/native/loader";
import { NativeFileModule } from "@lib/api/native/modules";

import { addQuickActions } from "../shared/quick";
import { colorOwner, installEngine, rawNames, setColors, themeHooks, tokenNames } from "@lib/addons/themes/colors/omniEngine";

import { icon, Row, Scroll, Section } from "../shared/ui";
import { findByProps, logger, omniPlugin, ReactNative as RN, showToast, useProxy } from "../vd";
const THEME_ID = "equicord-mobile://custom-theme";
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

type Palette = { accent: string; bg1: string; bg2: string; bg3: string; text: string; muted: string; header: string; };

const FIELDS: [keyof Palette, string][] = [
    ["accent", "Accent"],
    ["bg1", "Background (chat)"],
    ["bg2", "Background (sidebar)"],
    ["bg3", "Background (deepest)"],
    ["header", "Headers / names"],
    ["text", "Text"],
    ["muted", "Muted text"],
];

const PRESETS: Record<string, Palette> = {
    AMOLED: { accent: "#5865f2", bg1: "#000000", bg2: "#050505", bg3: "#000000", text: "#e3e5e8", muted: "#949ba4", header: "#ffffff" },
    "Midnight Blue": { accent: "#7aa2f7", bg1: "#1a1b26", bg2: "#16161e", bg3: "#13131a", text: "#c0caf5", muted: "#7982a9", header: "#e0e6ff" },
    Forest: { accent: "#7fbf7f", bg1: "#1d2420", bg2: "#18201b", bg3: "#131915", text: "#d6e2d6", muted: "#8fa38f", header: "#eef7ee" },
    Rose: { accent: "#eb6f92", bg1: "#232136", bg2: "#1f1d2e", bg3: "#191724", text: "#e0def4", muted: "#908caa", header: "#f6c177" },
};

const defaults = {
    palette: { ...PRESETS.AMOLED } as Palette,
    enabled: false,
    bg: { url: "", blur: 0, alpha: 0.6 },   // background picture
    deep: true,                              // also recolor Discord's raw grey scale (covers every surface)
};
type S = typeof defaults;

const s2 = (c: string) => [c, c]; // [dark, light]

// Token-based (split on "_") so e.g. INTERACTIVE isn't caught by ACTIVE.
const SKIP_PARTS = new Set(["MODIFIER", "MOD", "STATUS", "DANGER", "WARNING", "POSITIVE", "CRITICAL", "INFO", "MENTION", "MENTIONED", "SPOILER",
    "BADGE", "PREMIUM", "NITRO", "BOOST", "SPEAKING", "ONLINE", "IDLE", "DND", "OFFLINE", "STREAMING", "SHADOW", "BORDER", "SCROLLBAR", "HOVER",
    "ACTIVE", "SELECTED", "PRESSED", "HIGHLIGHT", "ON", "WHITE", "BLACK", "DEPRECATED", "GRADIENT", "FILTER", "LOCKED", "NOTICE", "AUTOMOD",
    "GUILD", "DIVIDER", "UNREAD", "NEW", "RED", "GREEN", "YELLOW", "ORANGE", "BLURPLE", "TOOLTIP", "SPINE", "LOGO"]);
const isBg = (k: string) => /BACKGROUND|(^|_)BG(_|$)|SURFACE|(^|_)FILL|TILE|CONTAINER|(^|_)PANEL/.test(k);

function classify(k: string, p: Palette): string | undefined {
    if (k.split("_").some(x => SKIP_PARTS.has(x))) return;
    if (/BRAND|LINK|ACCENT/.test(k)) return /TEXT|BACKGROUND|BUTTON/.test(k) ? p.accent : undefined;
    if (!isBg(k) && /^(TEXT|HEADER|INTERACTIVE|CHANNELS|ICON)/.test(k))
        return /MUTED|SECONDARY|TERTIARY|PLACEHOLDER|SUBTLE|DISABLED|FAINT|LOW/.test(k) ? p.muted : /HEADER_PRIMARY|STRONG|HIGH/.test(k) ? p.header : p.text;
    if (/^(ICON|TEXT|HEADER|INTERACTIVE|CHANNELS)/.test(k)) return; // icon/text tiles etc: keep Discord's
    // Only real surfaces: anything naming an icon/text/glyph keeps Discord's color (else chat-bar/emoji icons go black).
    if (/ICON|TEXT|GLYPH|FOREGROUND|STROKE|EMOJI|LABEL|TINT|LINE|PLACEHOLDER|THUMB|KNOB/.test(k)) return;
    if (isBg(k)) {
        if (/TERTIARY|FLOATING|BACKDROP|LOWEST|DEEP|NAV|TAB_BAR|MOBILE_SECONDARY|SECONDARY_ALT/.test(k)) return p.bg3;
        if (/SECONDARY|RAISED|OVERLAY|CARD|INPUT|MOBILE_PRIMARY|HIGHER|SURFACE|MODAL|SHEET/.test(k)) return p.bg2;
        return p.bg1;
    }
}

/** Remap Discord's grey ramp (PRIMARY_100..900 / NEUTRAL_*) onto the palette so hardcoded surfaces follow too. */
function rawScale(p: Palette) {
    const out: Record<string, string> = {};
    const mix = (a: string, b: string, f: number) => chroma.mix(a, b, Math.max(0, Math.min(1, f)), "rgb").hex();
    for (const k of rawNames()) {
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

function buildTheme(p: Palette, bg?: S["bg"], deep = true) {
    const semanticColors: Record<string, string[]> = {
        // legacy + new token names (loader maps spec 2 fallbacks)
        BACKGROUND_PRIMARY: s2(p.bg1), BG_BASE_PRIMARY: s2(p.bg1), CHAT_BACKGROUND: s2(p.bg1),
        BACKGROUND_SECONDARY: s2(p.bg2), BG_BASE_SECONDARY: s2(p.bg2), BACKGROUND_MOBILE_PRIMARY: s2(p.bg2), BG_SURFACE_RAISED: s2(p.bg2),
        BACKGROUND_TERTIARY: s2(p.bg3), BACKGROUND_SECONDARY_ALT: s2(p.bg3), BG_BASE_TERTIARY: s2(p.bg3), BACKGROUND_MOBILE_SECONDARY: s2(p.bg3),
        BACKGROUND_FLOATING: s2(p.bg2), BG_SURFACE_OVERLAY: s2(p.bg2), BG_BACKDROP: s2(p.bg3 + "cc"),
        CHAT_INPUT_CONTAINER_BACKGROUND: s2(p.bg2), BACKGROUND_NESTED_FLOATING: s2(p.bg2),
        HEADER_PRIMARY: s2(p.header), HEADER_SECONDARY: s2(p.muted),
        TEXT_NORMAL: s2(p.text), TEXT_DEFAULT: s2(p.text), TEXT_MUTED: s2(p.muted), TEXT_SECONDARY: s2(p.muted),
        INTERACTIVE_NORMAL: s2(p.text), INTERACTIVE_ACTIVE: s2(p.header), INTERACTIVE_MUTED: s2(p.muted),
        CHANNELS_DEFAULT: s2(p.muted), CHANNEL_ICON: s2(p.muted),
        TEXT_LINK: s2(p.accent), TEXT_BRAND: s2(p.accent),
        BUTTON_BACKGROUND_BRAND: s2(p.accent), REDESIGN_BUTTON_PRIMARY_BACKGROUND: s2(p.accent),
        BACKGROUND_BRAND: s2(p.accent), CONTROL_BRAND_FOREGROUND: s2(p.accent), CONTROL_BRAND_FOREGROUND_NEW: s2(p.accent),
    };
    // Cover every semantic token Discord has in this version, by name.
    try {
        const keys = tokenNames();
        for (const k of keys) {
            if (k in semanticColors) continue;
            const c = classify(k, p);
            if (c) semanticColors[k] = s2(c);
        }
    } catch (e) { logger.error("theme token scan failed", e); }
    return {
        name: "Custom Theme",
        description: "Generated by the Custom Theme plugin",
        authors: [{ name: "Custom Theme plugin", id: "0" }],
        spec: 2,
        semanticColors,
        rawColors: { ...(deep ? rawScale(p) : {}), BRAND_500: p.accent, BRAND_560: p.accent, BRAND_600: p.accent, PLUM_23: p.bg1 },
        ...(bg?.url ? { background: { url: bg.url, blur: bg.blur || 0, alpha: bg.alpha ?? 0.6 } } : {}),
    };
}

let applying = false;

function apply(st: S, notify = true) {
    const p = st.palette;
    const bad = FIELDS.find(([k]) => !HEX.test(p[k] ?? ""));
    if (bad) return void showToast(`Invalid color: ${bad[1]}`, icon("Small"));
    const data: any = { ...buildTheme(p, st.bg, st.deep), omnicord: { palette: p, bg: st.bg, deep: st.deep } };
    if (!installEngine()) return void showToast("Theme engine not supported on this Discord version");

    // Save as a real theme: listed (and selected) on the Themes page, restored on restart.
    for (const k of Object.keys(themes.themes)) if (k !== THEME_ID && themes.themes[k]?.selected) themes.themes[k].selected = false;
    themes.themes[THEME_ID] = { id: THEME_ID, selected: true, data };
    applying = true;
    try { themes.selectTheme(themes.themes[THEME_ID]); } catch (e) { logger.error(e); } finally { applying = false; }

    // Then take over the colors with the full mapping + background.
    setColors(flat(data), data.rawColors, "custom");
    setBackground(data);
    st.enabled = true;
    notify && showToast("Theme saved & applied (also listed in Themes)", icon("check"));
}

/**
 * Feed the chat-background patch directly. (updateBunnyColor touched ThemeStore, which isn't ready yet
 * when plugins start at boot, so it threw and the picture was lost after every restart.)
 */
function setBackground(data: any) {
    try {
        _colorRef.current = data?.background?.url
            ? parseColorManifest(JSON.parse(JSON.stringify({ ...data, rawColors: {} })) as any)
            : null;
    } catch (e) { logger.error("background apply failed", e); }
}

const flat = (data: { semanticColors?: Record<string, string[]>; }) => {
    const sem: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.semanticColors ?? {})) if (v?.[0]) sem[k] = v[0];
    return sem;
};

// Boot: plugin start() is async and races Discord's first render, so apply the saved theme now,
// synchronously, from the loader's stored theme file.
try {
    const saved: any = getStoredTheme();
    if (saved?.id === THEME_ID && saved.data?.semanticColors && installEngine()) {
        // Rebuild from the saved palette so mapping fixes in new releases apply immediately.
        const o = saved.data.omnicord;
        const data = o?.palette ? buildTheme(o.palette, o.bg, o.deep) : saved.data;
        setColors(flat(data), data.rawColors ?? null, "custom");
        setBackground(data);
    }
} catch (e) { logger.error("custom theme boot apply failed", e); }

/** Release ≤5 registered a Kettu theme (fake theme key), which Discord 349 ignores. Remove it. */

function reset(st: S, keepFlag = false) {
    const wasOurs = themes.themes[THEME_ID]?.selected || colorOwner() === "custom";
    if (themes.themes[THEME_ID]) themes.themes[THEME_ID].selected = false;
    if (wasOurs) {
        applying = true;
        try { themes.selectTheme(null); } catch { } finally { applying = false; }
        setColors(null, null);
        setBackground(null);
    }
    if (!keepFlag) st.enabled = false;
}

function Swatch({ color }: { color: string }) {
    return <RN.View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: HEX.test(color) ? color : "transparent", borderWidth: 1, borderColor: "#8888" }} />;
}

let current: S | undefined;
let unquick: (() => void) | undefined;

/** Read any uri (content://, file://, https://) as base64. */
async function readBase64(uri: string): Promise<string> {
    const res = await fetch(uri);
    try {
        const blob = await res.blob();
        const dataUrl: string = await new Promise((ok, fail) => {
            const r = new FileReader();
            r.onload = () => ok(String(r.result));
            r.onerror = () => fail(r.error ?? new Error("read failed"));
            r.readAsDataURL(blob);
        });
        const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        if (b64) return b64;
    } catch { }
    const res2 = await fetch(uri);
    return Buffer.from(await res2.arrayBuffer()).toString("base64");
}

/** Copy the picture into Discord's own app folder and return a file:// uri that survives restarts. */
async function saveBackgroundLocally(uri: string, previous?: string): Promise<string> {
    const ext = (/\.(png|jpe?g|gif|webp)(\?|$)/i.exec(uri)?.[1] ?? "png").toLowerCase();
    const rel = `pyoncord/omnicord/background-${Date.now()}.${ext}`;
    await NativeFileModule.writeFile("documents", rel, await readBase64(uri), "base64");
    const dir = NativeFileModule.getConstants().DocumentsDirPath;
    if (previous?.startsWith(`file://${dir}/pyoncord/omnicord/`)) {
        NativeFileModule.removeFile?.("documents", previous.slice(`file://${dir}/`.length))?.catch?.(() => { });
    }
    return `file://${dir}/${rel}`;
}

async function setPicture(storage: S, uri: string) {
    showToast("Saving picture…");
    let local = uri;
    try { local = await saveBackgroundLocally(uri, storage.bg.url); } catch (e) {
        logger.error("background copy failed", e);
        showToast("Couldn't copy the picture into the app, using it directly");
    }
    storage.bg = { ...storage.bg, url: local, source: uri } as any;
    apply(storage);
}

async function pickImage(): Promise<string | undefined> {
    const DP = findByProps("pickSingle") ?? findByProps("pick", "types");
    if (DP?.pickSingle) { const r = await DP.pickSingle({ type: ["image/*"], copyTo: "documentDirectory" }); return r?.fileCopyUri ?? r?.uri; }
    if (DP?.pick) { const [r] = await DP.pick({ type: ["image/*"], copyTo: "documentDirectory" }); return r?.fileCopyUri ?? r?.uri; }
    const IP = findByProps("launchImageLibrary");
    if (IP) { const r = await IP.launchImageLibrary({ mediaType: "photo", selectionLimit: 1 }); return r?.assets?.[0]?.uri; }
    showToast("No gallery picker in this Discord version: paste an image URL instead");
}

function Stepper({ label, value, onChange }: { label: string; value: string; onChange: (d: number) => void; }) {
    return (
        <RN.View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14 }}>
            <Txt style={{ color: "#dbdee1", fontSize: 16, flex: 1 }}>{label}: {value}</Txt>
            {[-1, 1].map(d => (
                <RN.Pressable key={d} onPress={() => onChange(d)} style={{ backgroundColor: "#4e505888", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, marginLeft: 8 }}>
                    <Txt style={{ color: "#fff", fontSize: 16 }}>{d < 0 ? "−" : "+"}</Txt>
                </RN.Pressable>
            ))}
        </RN.View>
    );
}

export default omniPlugin<S>({
    id: "custom-theme",
    name: "Custom Theme",
    description: "Pick your own colors or a preset, applied live",
    defaults,
    start(st) {
        current = st;
        // Themes page picks: our entry → turn on; another theme or none → turn off.
        themeHooks.onSelect = theme => {
            if (applying) return;
            if (theme?.id === THEME_ID) { setTimeout(() => apply(st, false)); return; }
            if (st.enabled) {
                st.enabled = false;
                if (colorOwner() === "custom") { setColors(null, null); setBackground(null); }
            }
        };
        if (st.enabled) apply(st, false);
        // Older releases stored the gallery uri itself: copy it into the app folder while it's still readable.
        if (/^(content|https?):/i.test(st.bg?.url ?? "")) setPicture(st, st.bg.url).catch(e => logger.error(e));
        const same = (a: Palette) => FIELDS.every(([k]) => a[k]?.toLowerCase() === st.palette[k]?.toLowerCase());
        unquick = addQuickActions({
            id: "theme", order: 40,
            icon: ["PaintPaletteIcon", "ThemeIcon", "ic_theme_24px", "ic_palette"],
            label: "Theme", sub: () => st.enabled ? Object.keys(PRESETS).find(n => same(PRESETS[n])) ?? "Custom" : "Off",
            choices: () => [
                ...Object.entries(PRESETS).map(([name, pal]) => ({
                    label: name, selected: st.enabled && same(pal),
                    run: () => { st.palette = { ...pal }; apply(st); },
                })),
                { label: "Off (Discord default)", selected: !st.enabled, run: () => reset(st) },
            ],
        });
    },
    stop() { unquick?.(); themeHooks.onSelect = undefined; if (current) reset(current, true); },
    Settings({ storage }) {
        useProxy(storage);
        const p = storage.palette;
        return (
            <Scroll>
                <Section title="Presets">
                    {Object.entries(PRESETS).map(([name, pal]) => (
                        <Row key={name} label={name} trailing={<Swatch color={pal.accent} />}
                            onPress={() => { storage.palette = { ...pal }; apply(storage); }} />
                    ))}
                </Section>
                <Section title="Background picture (chat)">
                    <SafeInput title="Image URL (https://… .png/.jpg/.gif)" value={storage.bg.url} placeholder="https://i.imgur.com/….png"
                        onChange={(v: string) => void (storage.bg = { ...storage.bg, url: v.trim() })} />
                    <Row label="📁 Pick from gallery" onPress={async () => {
                        try {
                            const uri = await pickImage();
                            if (uri) await setPicture(storage, uri);
                        } catch (e: any) { if (!String(e).includes("cancel")) showToast(`Picker failed: ${e}`); }
                    }} />
                    {storage.bg.url ? <RN.Image source={{ uri: storage.bg.url }} resizeMode="cover" style={{ height: 120, marginHorizontal: 14, marginBottom: 8, borderRadius: 8 }} /> : null}
                    <Stepper label="Visibility" value={`${Math.round((storage.bg.alpha ?? 0.6) * 100)}%`}
                        onChange={d => void (storage.bg = { ...storage.bg, alpha: Math.round(Math.max(0.1, Math.min(1, (storage.bg.alpha ?? 0.6) + d * 0.1)) * 10) / 10 })} />
                    <Stepper label="Blur" value={String(storage.bg.blur ?? 0)}
                        onChange={d => void (storage.bg = { ...storage.bg, blur: Math.max(0, Math.min(25, (storage.bg.blur ?? 0) + d * 2)) })} />
                    <Row label="✅ Apply background" sub="Web pictures are downloaded into the app so they load offline" onPress={() => /^https?:/i.test(storage.bg.url) ? setPicture(storage, storage.bg.url) : apply(storage)} />
                    {storage.bg.url ? <Row label="Remove background" danger onPress={() => { storage.bg = { ...storage.bg, url: "" }; apply(storage); }} /> : null}
                </Section>
                <Section title="Coverage">
                    <SafeSwitchRow label="Recolor everything" sub="Also remaps Discord's grey scale so every surface follows your colors. Restart Discord after changing."
                        value={!!storage.deep} onValueChange={v => { storage.deep = v; storage.enabled && apply(storage); }} />
                </Section>
                <Section title="Colors (hex, e.g. #1e1f22)">
                    {FIELDS.map(([k, label]) => (
                        <RN.View key={k} style={{ flexDirection: "row", alignItems: "center", paddingRight: 14 }}>
                            <RN.View style={{ flex: 1 }}>
                                <SafeInput title={label} value={p[k]} placeholder="#000000"
                                    onChange={(v: string) => void (storage.palette = { ...storage.palette, [k]: v.trim() })} />
                            </RN.View>
                            <Swatch color={p[k]} />
                        </RN.View>
                    ))}
                </Section>
                <Section>
                    <Row label="✅ Apply" onPress={() => apply(storage)} />
                    <Row label="Reset to Discord default" danger onPress={() => reset(storage)} />
                </Section>
            </Scroll>
        );
    },
});
