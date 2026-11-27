import { SafeInput, SafeSwitchRow, Txt } from "@core/ui/components/SafeUI";
import * as themes from "@lib/addons/themes";
import { colorOwner, installEngine, rawNames, setColors, themeHooks, tokenNames } from "@lib/addons/themes/colors/omniEngine";
import { parseColorManifest } from "@lib/addons/themes/colors/parser";
import { _colorRef } from "@lib/addons/themes/colors/updater";
import { getStoredTheme } from "@lib/api/native/loader";
import { BundleUpdaterManager, NativeFileModule } from "@lib/api/native/modules";

import { addQuickActions } from "../shared/quick";
import { icon, Row, Scroll, Section } from "../shared/ui";
import { clipboard, findByProps, logger, omniPlugin, React, ReactNative as RN, showToast, useProxy } from "../vd";
import { buildTheme, flat } from "./build";
import { currentFont, FONT_PRESETS, fontLabel, fontsSupported, applyFont } from "./fonts";
import { Cfg, fromAccent, HEX, invalid, OPTIONAL, Palette, PRESETS, randomPalette, REQUIRED, samePalette } from "./palette";
import { Collapse, ColorField, Preview, Swatch } from "./ui";

const THEME_ID = "equicord-mobile://custom-theme";

const defaults = {
    palette: { ...PRESETS.AMOLED } as Palette,
    enabled: false,
    bg: { url: "", blur: 0, alpha: 0.6 } as NonNullable<Cfg["bg"]>,
    deep: true,                               // also recolor Discord's raw grey scale (covers every surface)
    tint: 0,
    bright: 0,
    overrides: {} as Record<string, string>,
    rawOverrides: {} as Record<string, string>,
    saved: {} as Record<string, Cfg>,
    live: true,
    schedule: { on: false, day: "Light", night: "AMOLED", dayAt: "08:00", nightAt: "20:00" },
};
type S = typeof defaults;

const cfgOf = (st: S): Cfg => ({
    palette: st.palette, bg: st.bg, deep: st.deep, tint: st.tint, bright: st.bright,
    overrides: st.overrides, rawOverrides: st.rawOverrides,
});
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

let applying = false;

function apply(st: S, notify = true) {
    const bad = invalid(st.palette);
    if (bad) return void (notify && showToast(`Invalid color: ${bad}`, icon("Small")));
    const cfg = cfgOf(st);
    const data: any = { ...buildTheme(cfg), omnicord: clone(cfg) };
    if (!installEngine()) return void showToast("Theme engine not supported on this Discord version");

    // Save as a real theme: listed (and selected) on the Themes page, restored on restart.
    for (const k of Object.keys(themes.themes)) if (k !== THEME_ID && themes.themes[k]?.selected) themes.themes[k].selected = false;
    themes.themes[THEME_ID] = { id: THEME_ID, selected: true, data };
    applying = true;
    try { themes.selectTheme(themes.themes[THEME_ID]); } catch (e) { logger.error(e); } finally { applying = false; }

    setColors(flat(data), data.rawColors, "custom");
    setBackground(data);
    st.enabled = true;
    notify && showToast("Theme saved & applied", icon("check"));
}

let timer: any;
/** Live apply: debounced so dragging through colors stays smooth. */
function schedule(st: S) {
    if (!st.live) return;
    clearTimeout(timer);
    timer = setTimeout(() => !invalid(st.palette) && apply(st, false), 450);
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

// Boot: plugin start() is async and races Discord's first render, so apply the saved theme now,
// synchronously, from the loader's stored theme file.
try {
    const saved: any = getStoredTheme();
    if (saved?.id === THEME_ID && saved.data?.semanticColors && installEngine()) {
        // Rebuild from the saved config so mapping fixes in new releases apply immediately.
        const o = saved.data.omnicord;
        const data = o?.palette ? buildTheme(o) : saved.data;
        setColors(flat(data), data.rawColors ?? null, "custom");
        setBackground(data);
    }
} catch (e) { logger.error("custom theme boot apply failed", e); }

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

function loadCfg(st: S, c: Partial<Cfg>, keepBg = false) {
    if (c.palette) st.palette = { ...st.palette, ...clone(c.palette) };
    if (!keepBg && c.bg) st.bg = { ...st.bg, ...clone(c.bg) };
    st.deep = c.deep ?? true;
    st.tint = c.tint ?? 0;
    st.bright = c.bright ?? 0;
    st.overrides = clone(c.overrides ?? {});
    st.rawOverrides = clone(c.rawOverrides ?? {});
}

function usePreset(st: S, pal: Palette) {
    st.palette = { ...pal };
    st.tint = 0; st.bright = 0;
    apply(st);
}

// ---------- background picture ----------

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
    storage.bg = { ...storage.bg, url: local, source: uri };
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

// ---------- import / export ----------

/** Background that makes sense on another phone: the web source, never a local file. */
const shareableBg = (bg: Cfg["bg"]) => {
    const u = /^https?:/i.test(bg?.source ?? "") ? bg!.source! : /^https?:/i.test(bg?.url ?? "") ? bg!.url : "";
    return u ? { url: u, blur: bg!.blur, alpha: bg!.alpha, zoom: bg!.zoom, x: bg!.x, y: bg!.y, fit: bg!.fit, parallax: bg!.parallax, smooth: bg!.smooth } : undefined;
};

function exportOmni(st: S) {
    const out = { omnicord: 1, ...clone(cfgOf(st)), bg: shareableBg(st.bg) };
    clipboard.setString(JSON.stringify(out));
    showToast("Theme copied: paste it to a friend", icon("check"));
}

function exportKettu(st: S) {
    const t: any = buildTheme({ ...cfgOf(st), bg: shareableBg(st.bg) });
    clipboard.setString(JSON.stringify(t));
    showToast("Kettu/Vendetta theme JSON copied", icon("check"));
}

async function importText(st: S, text: string) {
    let o: any;
    try { o = JSON.parse(text.trim()); } catch { throw new Error("That isn't theme JSON"); }
    if (o?.palette) {
        loadCfg(st, o, true);
    } else if (o?.semanticColors || o?.rawColors) {
        // Kettu / Vendetta / Bunny theme: keep every color as an override, guess the palette for editing.
        const sem = flat(o);
        const raw: Record<string, string> = {};
        for (const [k, v] of Object.entries<any>(o.rawColors ?? {})) if (typeof v === "string" && HEX.test(v)) raw[k] = v;
        const g = (...ks: string[]) => ks.map(k => sem[k] ?? raw[k]).find(v => v && HEX.test(v));
        const p = st.palette;
        st.palette = {
            ...p,
            accent: g("BACKGROUND_BRAND", "BUTTON_BACKGROUND_BRAND", "BRAND_500") ?? p.accent,
            bg1: g("BACKGROUND_PRIMARY", "BG_BASE_PRIMARY", "CHAT_BACKGROUND") ?? p.bg1,
            bg2: g("BACKGROUND_SECONDARY", "BG_BASE_SECONDARY") ?? p.bg2,
            bg3: g("BACKGROUND_TERTIARY", "BG_BASE_TERTIARY", "BACKGROUND_SECONDARY_ALT") ?? p.bg3,
            text: g("TEXT_NORMAL", "TEXT_DEFAULT") ?? p.text,
            muted: g("TEXT_MUTED", "TEXT_SECONDARY") ?? p.muted,
            header: g("HEADER_PRIMARY", "TEXT_STRONG") ?? p.header,
        };
        const ov: Record<string, string> = {};
        for (const [k, v] of Object.entries(sem)) if (HEX.test(v)) ov[k] = v;
        st.overrides = ov;
        st.rawOverrides = raw;
        st.tint = 0; st.bright = 0;
        if (o.background?.url) o.bg = { url: o.background.url, blur: o.background.blur ?? 0, alpha: o.background.alpha ?? 0.6 };
    } else throw new Error("No colors found in it");

    if (o.bg?.url && /^https?:/i.test(o.bg.url)) {
        st.bg = { ...st.bg, blur: o.bg.blur ?? 0, alpha: o.bg.alpha ?? 0.6, zoom: o.bg.zoom ?? 1, x: o.bg.x ?? 0, y: o.bg.y ?? 0, fit: o.bg.fit ?? "cover" };
        await setPicture(st, o.bg.url);
    } else apply(st);
    return o.name as string | undefined;
}

async function importFrom(st: S, source: "clipboard" | string) {
    try {
        const text = source === "clipboard" ? await clipboard.getString() : await (await fetch(source)).text();
        if (!text) return showToast("Clipboard is empty");
        const name = await importText(st, text);
        showToast(`Imported${name ? `: ${name}` : ""}`, icon("check"));
    } catch (e: any) { showToast(`Import failed: ${e?.message ?? e}`, icon("Small")); }
}

// ---------- settings pieces ----------

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

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function Overrides({ storage }: { storage: S; }) {
    const [q, setQ] = React.useState("");
    const all = React.useMemo(() => {
        try {
            return [...tokenNames().sort().map(n => ({ n, raw: false })), ...rawNames().sort().map(n => ({ n, raw: true }))];
        } catch { return []; }
    }, []);
    const key = q.trim().toUpperCase().replace(/[\s-]+/g, "_");
    const has = (x: { n: string; raw: boolean; }) => !!(x.raw ? storage.rawOverrides : storage.overrides)[x.n];
    const list = key ? all.filter(x => x.n.includes(key)).slice(0, 40) : all.filter(has);
    const set = (x: { n: string; raw: boolean; }, v: string) => {
        const field = x.raw ? "rawOverrides" : "overrides";
        const next = { ...storage[field] };
        if (v) next[x.n] = v; else delete next[x.n];
        storage[field] = next;
        if (!v || HEX.test(v)) schedule(storage);
    };
    const count = Object.keys(storage.overrides).length + Object.keys(storage.rawOverrides).length;
    return (
        <>
            <SafeInput title={`Search ${all.length} Discord colors (e.g. "chat", "input", "button")`} value={q} placeholder="BACKGROUND_PRIMARY" onChange={setQ} />
            {list.map(x => (
                <ColorField key={(x.raw ? "raw:" : "") + x.n} optional label={x.n} sub={x.raw ? "Raw color · theme default" : "Theme default"}
                    value={(x.raw ? storage.rawOverrides : storage.overrides)[x.n]} onChange={v => set(x, v)} />
            ))}
            {!list.length ? <Txt style={{ color: "#949ba4", fontSize: 13, padding: 14 }}>{key ? "No match" : "No overrides yet: search a color name above to recolor that exact element."}</Txt> : null}
            {count ? <Row label={`Clear all overrides (${count})`} danger onPress={() => { storage.overrides = {}; storage.rawOverrides = {}; apply(storage, false); }} /> : null}
        </>
    );
}

function Fonts() {
    const [sel, setSel] = React.useState(currentFont());
    const [busy, setBusy] = React.useState<string | null>(null);
    if (!fontsSupported()) return <Txt style={{ color: "#949ba4", fontSize: 13, padding: 14 }}>Fonts need the Omnicord xposed module or a manager-patched install.</Txt>;
    const pick = async (name: string | null) => {
        setBusy(name ?? "default");
        try {
            await applyFont(name);
            setSel(name);
            showToast(`${fontLabel(name)}: close Discord from recent apps and reopen it`, icon("check"));
        } catch (e: any) { showToast(`Font failed: ${e?.message ?? e}`, icon("Small")); } finally { setBusy(null); }
    };
    return (
        <>
            {[null, ...FONT_PRESETS.map(f => f.name)].map(n => (
                <Row key={n ?? "default"} label={fontLabel(n)} sub={busy === (n ?? "default") ? "Downloading…" : undefined}
                    trailing={sel === n ? <Txt style={{ color: "#fff", fontSize: 16 }}>✓</Txt> : undefined}
                    onPress={() => !busy && pick(n)} />
            ))}
        </>
    );
}

function Library({ storage }: { storage: S; }) {
    const [name, setName] = React.useState("");
    const save = () => {
        const n = name.trim() || `Theme ${Object.keys(storage.saved).length + 1}`;
        storage.saved = { ...storage.saved, [n]: clone(cfgOf(storage)) };
        setName("");
        showToast(`Saved "${n}"`, icon("check"));
    };
    return (
        <>
            <SafeInput title="Name" value={name} placeholder="My theme" onChange={setName} />
            <Row label="Save current theme" onPress={save} />
            {Object.entries(storage.saved).map(([n, c]) => (
                <RN.View key={n} style={{ flexDirection: "row", alignItems: "center", paddingRight: 10 }}>
                    <RN.View style={{ flex: 1 }}>
                        <Row label={n} sub="Tap to use" trailing={<Swatch color={c.palette?.accent} />}
                            onPress={() => { loadCfg(storage, c); apply(storage); }} />
                    </RN.View>
                    <RN.Pressable hitSlop={8} onPress={() => { const s = { ...storage.saved }; delete s[n]; storage.saved = s; }}>
                        <Txt style={{ color: "#da373c", fontSize: 14, padding: 6 }}>Delete</Txt>
                    </RN.Pressable>
                </RN.View>
            ))}
        </>
    );
}

// ---------- day / night schedule ----------
const minutes = (t: string) => { const m = /^(\d{1,2})[:h](\d{2})$/.exec(t.trim()); return m ? (+m[1] % 24) * 60 + (+m[2] % 60) : NaN; };
function slotNow(sc: S["schedule"]): "day" | "night" | null {
    const d = minutes(sc.dayAt), n = minutes(sc.nightAt);
    if (isNaN(d) || isNaN(n) || d === n) return null;
    const now = new Date(); const t = now.getHours() * 60 + now.getMinutes();
    return (d < n ? t >= d && t < n : t >= d || t < n) ? "day" : "night";
}
/** A saved theme (by name) or a preset. */
function applyNamed(st: S, name: string) {
    const c = st.saved[name];
    if (c) { loadCfg(st, c); apply(st, false); return true; }
    const p = PRESETS[name];
    if (p) { st.palette = { ...p }; st.tint = 0; st.bright = 0; apply(st, false); return true; }
    return false;
}
let lastSlot: string | null = null;
let clock: any;
function tickSchedule(st: S) {
    const sc = st.schedule;
    if (!sc?.on) { lastSlot = null; return; }
    const slot = slotNow(sc);
    if (!slot || slot === lastSlot) return;
    lastSlot = slot;
    applyNamed(st, slot === "day" ? sc.day : sc.night);
}

function Schedule({ storage }: { storage: S; }) {
    const sc = storage.schedule ?? defaults.schedule;
    const set = (patch: Partial<S["schedule"]>) => { storage.schedule = { ...sc, ...patch }; lastSlot = null; tickSchedule(storage); };
    const names = [...Object.keys(storage.saved).map(n => n), ...Object.keys(PRESETS)];
    const Pick = ({ k }: { k: "day" | "night"; }) => (
        <RN.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingBottom: 10 }}>
            {names.map(n => (
                <RN.Pressable key={n} onPress={() => set({ [k]: n })}
                    style={{ backgroundColor: sc[k] === n ? "#5865f2" : "#4e505888", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Txt style={{ color: "#fff", fontSize: 13 }}>{storage.saved[n] ? `★ ${n}` : n}</Txt>
                </RN.Pressable>
            ))}
        </RN.ScrollView>
    );
    return (
        <>
            <SafeSwitchRow label="Switch theme by time of day" sub={sc.on ? `Now: ${slotNow(sc) ?? "check the times"}` : "Off"} value={!!sc.on} onValueChange={v => set({ on: v })} />
            <SafeInput title="Day starts at (HH:MM)" value={sc.dayAt} placeholder="08:00" onChange={v => set({ dayAt: v })} />
            <Txt style={{ color: "#949ba4", fontSize: 12, paddingHorizontal: 14, paddingBottom: 6 }}>Day theme</Txt>
            <Pick k="day" />
            <SafeInput title="Night starts at (HH:MM)" value={sc.nightAt} placeholder="20:00" onChange={v => set({ nightAt: v })} />
            <Txt style={{ color: "#949ba4", fontSize: 12, paddingHorizontal: 14, paddingBottom: 6 }}>Night theme</Txt>
            <Pick k="night" />
        </>
    );
}

let current: S | undefined;
let unquick: (() => void) | undefined;

export default omniPlugin<S>({
    id: "custom-theme",
    name: "Custom Theme",
    description: "Colors, presets, every Discord color, fonts, background, saved themes, import/export",
    defaults,
    start(st) {
        current = st;
        st.schedule ??= { ...defaults.schedule };
        lastSlot = null;
        clearInterval(clock);
        clock = setInterval(() => tickSchedule(st), 60_000);
        setTimeout(() => tickSchedule(st), 1500);
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
        const presetName = () => Object.keys(PRESETS).find(n => samePalette(PRESETS[n], st.palette));
        unquick = addQuickActions(
            {
                id: "theme", order: 40,
                icon: ["PaintPaletteIcon", "ThemeIcon", "ic_theme_24px", "ic_palette"],
                label: "Theme", sub: () => st.enabled ? presetName() ?? "Custom" : "Off",
                choices: () => [
                    ...Object.entries(st.saved).map(([n, c]) => ({ label: `★ ${n}`, run: () => { loadCfg(st, c); apply(st); } })),
                    ...Object.entries(PRESETS).map(([name, pal]) => ({
                        label: name, selected: st.enabled && samePalette(pal, st.palette),
                        run: () => usePreset(st, pal),
                    })),
                    { label: "Off (Discord default)", selected: !st.enabled, run: () => reset(st) },
                ],
            },
            {
                id: "theme-random", order: 41, keepOpen: true,
                icon: ["ShuffleIcon", "DiceIcon", "ic_shuffle", "RefreshIcon"],
                label: "Random theme", sub: "Tap again for another",
                run: () => { st.palette = randomPalette(); st.tint = 0; st.bright = 0; apply(st, false); },
            },
            ...(fontsSupported() ? [{
                id: "theme-font", order: 42,
                icon: ["TextIcon", "ic_text", "PencilIcon"],
                label: "Font", sub: () => fontLabel(currentFont()),
                choices: () => [null, ...FONT_PRESETS.map(f => f.name)].map(n => ({
                    label: fontLabel(n), selected: currentFont() === n,
                    run: async () => {
                        showToast("Setting font…");
                        try { await applyFont(n); showToast(`${fontLabel(n)}: close Discord from recent apps and reopen it`); } catch (e: any) { showToast(`Font failed: ${e?.message ?? e}`); }
                    },
                })),
            }] : []),
        );
    },
    stop() { unquick?.(); clearInterval(clock); themeHooks.onSelect = undefined; clearTimeout(timer); if (current) reset(current, true); },
    Settings({ storage }) {
        useProxy(storage);
        const [url, setUrl] = React.useState("");
        const p = storage.palette;
        const setPal = (k: keyof Palette, v: string) => {
            storage.palette = { ...storage.palette, [k]: v };
            if (!v || HEX.test(v)) schedule(storage);
        };
        const nudge = (patch: Partial<S>) => { Object.assign(storage, patch); schedule(storage); };
        return (
            <Scroll>
                <Preview cfg={cfgOf(storage)} bgUrl={storage.bg.url} />
                <Section>
                    <SafeSwitchRow label="Live apply" sub="Every change shows in Discord right away"
                        value={!!storage.live} onValueChange={v => void (storage.live = v)} />
                    <Row label={storage.enabled ? "Apply again" : "Turn theme on"} onPress={() => apply(storage)} />
                    <Row label="Reload Discord" sub="Repaints every screen with the theme (takes 2 seconds)" onPress={() => BundleUpdaterManager.reload()} />
                    {storage.enabled ? <Row label="Turn off (Discord default)" danger onPress={() => reset(storage)} /> : null}
                </Section>

                <Collapse title="Presets" open>
                    {Object.entries(PRESETS).map(([name, pal]) => (
                        <Row key={name} label={name} onPress={() => usePreset(storage, pal)}
                            trailing={<RN.View style={{ flexDirection: "row", gap: 4 }}>
                                {[pal.bg1, pal.bg2, pal.text, pal.accent].map((c, i) => <Swatch key={i} color={c} size={18} />)}
                                {storage.enabled && samePalette(pal, p) ? <Txt style={{ color: "#fff", marginLeft: 6 }}>✓</Txt> : null}
                            </RN.View>} />
                    ))}
                </Collapse>

                <Collapse title="Generate">
                    <Row label="Dark theme from my accent" sub="Builds every color around the accent" onPress={() => { storage.palette = fromAccent(p.accent); apply(storage); }} />
                    <Row label="Light theme from my accent" onPress={() => { storage.palette = fromAccent(p.accent, true); apply(storage); }} />
                    <Row label="Random theme" sub="Tap again for another" onPress={() => { storage.palette = randomPalette(); storage.tint = 0; storage.bright = 0; apply(storage, false); }} />
                </Collapse>

                <Collapse title="Colors" open>
                    {REQUIRED.map(([k, label]) => <ColorField key={k} label={label} value={p[k]} onChange={v => setPal(k, v)} />)}
                    {OPTIONAL.map(([k, label, sub]) => <ColorField key={k} optional label={label} sub={sub} value={p[k]} onChange={v => setPal(k, v)} />)}
                </Collapse>

                <Collapse title="Fine tune">
                    <Stepper label="Accent tint on backgrounds" value={`${storage.tint ?? 0}%`} onChange={d => nudge({ tint: clamp((storage.tint ?? 0) + d * 10, 0, 100) })} />
                    <Stepper label="Background brightness" value={`${(storage.bright ?? 0) > 0 ? "+" : ""}${storage.bright ?? 0}`} onChange={d => nudge({ bright: clamp((storage.bright ?? 0) + d, -5, 5) })} />
                    <SafeSwitchRow label="Recolor everything" sub="Also remaps Discord's grey scale so every surface follows your colors. Restart Discord after changing."
                        value={storage.deep !== false} onValueChange={v => nudge({ deep: v })} />
                </Collapse>

                <Collapse title="Background picture (chat)">
                    <SafeInput title="Image URL (https://… .png/.jpg/.gif)" value={storage.bg.url} placeholder="https://i.imgur.com/….png"
                        onChange={(v: string) => void (storage.bg = { ...storage.bg, url: v.trim() })} />
                    <Row label="Pick from gallery" onPress={async () => {
                        try {
                            const uri = await pickImage();
                            if (uri) await setPicture(storage, uri);
                        } catch (e: any) { if (!String(e).includes("cancel")) showToast(`Picker failed: ${e}`); }
                    }} />
                    <Stepper label="Visibility" value={`${Math.round((storage.bg.alpha ?? 0.6) * 100)}%`}
                        onChange={d => nudge({ bg: { ...storage.bg, alpha: Math.round(clamp((storage.bg.alpha ?? 0.6) + d * 0.1, 0.1, 1) * 10) / 10 } })} />
                    <Stepper label="Blur" value={String(storage.bg.blur ?? 0)}
                        onChange={d => nudge({ bg: { ...storage.bg, blur: clamp((storage.bg.blur ?? 0) + d * 2, 0, 25) } })} />
                    <Stepper label="Zoom" value={`${(storage.bg.zoom ?? 1).toFixed(2)}×`}
                        onChange={d => nudge({ bg: { ...storage.bg, zoom: Math.round(clamp((storage.bg.zoom ?? 1) + d * 0.25, 1, 5) * 100) / 100 } })} />
                    <Stepper label="Move left / right" value={`${storage.bg.x ?? 0}%`}
                        onChange={d => nudge({ bg: { ...storage.bg, x: clamp((storage.bg.x ?? 0) + d * 5, -100, 100) } })} />
                    <Stepper label="Move up / down" value={`${storage.bg.y ?? 0}%`}
                        onChange={d => nudge({ bg: { ...storage.bg, y: clamp((storage.bg.y ?? 0) + d * 5, -100, 100) } })} />
                    <RN.View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingBottom: 10, alignItems: "center" }}>
                        <Txt style={{ color: "#dbdee1", fontSize: 16, flex: 1 }}>Fit</Txt>
                        {([["cover", "Fill"], ["contain", "Whole"], ["stretch", "Stretch"]] as const).map(([f, l]) => (
                            <RN.Pressable key={f} onPress={() => nudge({ bg: { ...storage.bg, fit: f } })}
                                style={{ backgroundColor: (storage.bg.fit ?? "cover") === f ? "#5865f2" : "#4e505888", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                                <Txt style={{ color: "#fff", fontSize: 14 }}>{l}</Txt>
                            </RN.Pressable>
                        ))}
                    </RN.View>
                    <Stepper label="Touch parallax" value={(storage.bg.parallax ?? 0) ? String(storage.bg.parallax) : "Off"}
                        onChange={d => nudge({ bg: { ...storage.bg, parallax: clamp((storage.bg.parallax ?? 0) + d, 0, 10) } })} />
                    <Stepper label="Parallax smoothness" value={String(storage.bg.smooth ?? 5)}
                        onChange={d => nudge({ bg: { ...storage.bg, smooth: clamp((storage.bg.smooth ?? 5) + d, 1, 10) } })} />
                    <Row label="Reset position" onPress={() => nudge({ bg: { ...storage.bg, zoom: 1, x: 0, y: 0, fit: "cover" } })} />
                    <Row label="Apply background" sub="Web pictures are downloaded into the app so they load offline" onPress={() => /^https?:/i.test(storage.bg.url) ? setPicture(storage, storage.bg.url) : apply(storage)} />
                    {storage.bg.url ? <Row label="Remove background" danger onPress={() => { storage.bg = { ...storage.bg, url: "", source: "" }; apply(storage); }} /> : null}
                </Collapse>

                <Collapse title="Every Discord color (advanced)">
                    <Overrides storage={storage} />
                </Collapse>

                <Collapse title="Font">
                    <Fonts />
                </Collapse>

                <Collapse title="Day / night schedule">
                    <Schedule storage={storage} />
                </Collapse>

                <Collapse title="My themes">
                    <Library storage={storage} />
                </Collapse>

                <Collapse title="Share / import">
                    <Row label="Copy my theme" sub="Paste it to a friend using Omnicord" onPress={() => exportOmni(storage)} />
                    <Row label="Copy as Kettu / Vendetta theme" sub="JSON for the Themes page of other mods" onPress={() => exportKettu(storage)} />
                    <Row label="Import from clipboard" sub="Omnicord, Kettu, Bunny or Vendetta theme JSON" onPress={() => importFrom(storage, "clipboard")} />
                    <SafeInput title="Theme URL (.json)" value={url} placeholder="https://…/theme.json" onChange={setUrl} />
                    <Row label="Import from URL" onPress={() => /^https?:/i.test(url.trim()) ? importFrom(storage, url.trim()) : showToast("Paste a https:// link first")} />
                </Collapse>
            </Scroll>
        );
    },
});
