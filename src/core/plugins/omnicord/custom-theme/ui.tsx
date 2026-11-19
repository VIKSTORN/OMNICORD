// Color picker, live preview and collapsible sections (React Native primitives only).
import { SafeInput, Txt, useSafeColors } from "@core/ui/components/SafeUI";
import chroma from "chroma-js";

import { React, ReactNative as RN } from "../vd";
import { effective, HEX, onColor } from "./palette";

const HUES = [0, 15, 30, 45, 60, 90, 130, 165, 190, 210, 235, 260, 285, 310, 335];
const LIGHT = [0.85, 0.72, 0.6, 0.48, 0.36, 0.24, 0.14];
const GRID: string[][] = [
    ...LIGHT.map(l => HUES.map(h => chroma.hsl(h, l < 0.2 ? 0.4 : 0.75, l).hex())),
    Array.from({ length: HUES.length }, (_, i) => chroma.hsl(0, 0, i / (HUES.length - 1)).hex()),
];

export function Swatch({ color, size = 24, onPress, selected }: { color?: string; size?: number; onPress?: () => void; selected?: boolean; }) {
    const valid = !!color && HEX.test(color);
    return (
        <RN.Pressable onPress={onPress} disabled={!onPress} hitSlop={2}
            style={{
                width: size, height: size, borderRadius: size / 2, backgroundColor: valid ? color : "transparent",
                borderWidth: selected ? 2 : 1, borderColor: selected ? "#ffffff" : "#8888", alignItems: "center", justifyContent: "center",
            }}>
            {!valid ? <Txt style={{ color: "#8888", fontSize: size * 0.5 }}>∅</Txt> : null}
        </RN.Pressable>
    );
}

function Chip({ label, onPress }: { label: string; onPress: () => void; }) {
    return (
        <RN.Pressable onPress={onPress} style={{ backgroundColor: "#4e505866", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Txt style={{ color: "#fff", fontSize: 13 }}>{label}</Txt>
        </RN.Pressable>
    );
}

const tweak = (c: string, f: (x: chroma.Color) => chroma.Color) => { try { return f(chroma(c)).hex(); } catch { return c; } };

/** A color row that expands into a picker grid + fine tuning + hex input. */
export function ColorField({ label, sub, value, onChange, optional }: {
    label: string; sub?: string; value?: string; onChange: (v: string) => void; optional?: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const col = useSafeColors();
    const v = value ?? "";
    const base = HEX.test(v) ? v : "#808080";
    return (
        <RN.View>
            <RN.Pressable onPress={() => setOpen(!open)} android_ripple={{ color: "#ffffff22" }}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 14, gap: 12 }}>
                <RN.View style={{ flex: 1 }}>
                    <Txt style={{ color: col.text, fontSize: 16 }}>{label}</Txt>
                    <Txt style={{ color: col.muted, fontSize: 12 }}>{v ? v.toUpperCase() : sub ?? "Default"}</Txt>
                </RN.View>
                <Swatch color={v} size={28} />
                <Txt style={{ color: col.muted, fontSize: 14 }}>{open ? "▾" : "▸"}</Txt>
            </RN.Pressable>
            {open ? (
                <RN.View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                    {GRID.map((row, i) => (
                        <RN.View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            {row.map(c => <Swatch key={c} color={c} size={20} selected={c.toLowerCase() === v.toLowerCase()} onPress={() => onChange(c)} />)}
                        </RN.View>
                    ))}
                    <RN.View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        <Chip label="Lighter" onPress={() => onChange(tweak(base, x => x.brighten(0.25)))} />
                        <Chip label="Darker" onPress={() => onChange(tweak(base, x => x.darken(0.25)))} />
                        <Chip label="More color" onPress={() => onChange(tweak(base, x => x.saturate(0.4)))} />
                        <Chip label="Less color" onPress={() => onChange(tweak(base, x => x.desaturate(0.4)))} />
                        <Chip label="Hue ←" onPress={() => onChange(tweak(base, x => x.set("hsl.h", ((x.get("hsl.h") || 0) + 345) % 360)))} />
                        <Chip label="Hue →" onPress={() => onChange(tweak(base, x => x.set("hsl.h", ((x.get("hsl.h") || 0) + 15) % 360)))} />
                        {optional ? <Chip label="Default" onPress={() => onChange("")} /> : null}
                    </RN.View>
                    <SafeInput title="Hex" value={v} placeholder="#000000" onChange={t => onChange(t.trim())} />
                </RN.View>
            ) : null}
        </RN.View>
    );
}

/** Collapsible section; remembers nothing on purpose (keeps the page short when opened). */
export function Collapse({ title, children, open: initial = false }: { title: string; children: React.ReactNode; open?: boolean; }) {
    const [open, setOpen] = React.useState(initial);
    const col = useSafeColors();
    return (
        <RN.View style={{ gap: 6 }}>
            <RN.Pressable onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 4 }}>
                <Txt style={{ color: col.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", flex: 1 }}>{title}</Txt>
                <Txt style={{ color: col.muted, fontSize: 14 }}>{open ? "▾" : "▸"}</Txt>
            </RN.Pressable>
            {open ? <RN.View style={{ backgroundColor: col.card, borderRadius: 12, overflow: "hidden" }}>{children}</RN.View> : null}
        </RN.View>
    );
}

/** Mini chat mock-up drawn with the palette, so changes are visible before Discord re-renders. */
export function Preview({ cfg, bgUrl }: { cfg: Parameters<typeof effective>[0]; bgUrl?: string; }) {
    const p = effective(cfg);
    const [box, setBox] = React.useState({ width: 0, height: 0 });
    const t = (c: string, s: number, w: any = "400", extra: any = {}) => ({ color: c, fontSize: s, fontWeight: w, ...extra });
    const Msg = ({ name, text, mention }: { name: string; text: React.ReactNode; mention?: boolean; }) => (
        <RN.View style={{
            flexDirection: "row", gap: 8, paddingVertical: 6, paddingHorizontal: 10,
            backgroundColor: mention ? (p.mention || "#f0b232") + "26" : undefined,
            borderLeftWidth: mention ? 2 : 0, borderLeftColor: p.mention || "#f0b232",
        }}>
            <RN.View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: p.accent }} />
            <RN.View style={{ flex: 1 }}>
                <Txt style={t(p.header, 13, "600")}>{name} <Txt style={t(p.muted, 10)}>12:34</Txt></Txt>
                <Txt style={t(p.text, 13)}>{text}</Txt>
            </RN.View>
        </RN.View>
    );
    return (
        <RN.View style={{ borderRadius: 12, overflow: "hidden", backgroundColor: p.bg3 }}>
            <RN.View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: p.bg2 }}>
                <Txt style={t(p.muted, 16, "700")}>#</Txt>
                <Txt style={t(p.header, 14, "700")}>general</Txt>
            </RN.View>
            <RN.View style={{ backgroundColor: p.bg1, paddingVertical: 4 }}>
                {bgUrl ? <RN.View style={[RN.StyleSheet.absoluteFill, { overflow: "hidden" }]} onLayout={e => setBox(e.nativeEvent.layout)}>
                    <RN.Image source={{ uri: bgUrl }} blurRadius={cfg.bg?.blur ?? 0}
                        resizeMode={cfg.bg?.fit === "contain" || cfg.bg?.fit === "stretch" ? cfg.bg.fit : "cover"}
                        style={[RN.StyleSheet.absoluteFill, {
                            opacity: cfg.bg?.alpha ?? 0.6,
                            transform: [{ translateX: (cfg.bg?.x ?? 0) / 100 * box.width }, { translateY: (cfg.bg?.y ?? 0) / 100 * box.height }, { scale: cfg.bg?.zoom ?? 1 }],
                        }]} />
                </RN.View> : null}
                <Msg name="Nova" text={<>Look at this <Txt style={t(p.link, 13, "400", { textDecorationLine: "underline" })}>link</Txt></>} />
                <Msg name="Kai" mention text={<><Txt style={{ color: p.accent, backgroundColor: p.accent + "33", fontSize: 13 }}>@you</Txt> new theme?</>} />
                <Txt style={[t(p.muted, 11), { paddingHorizontal: 10, paddingBottom: 4 }]}>Kai is typing…</Txt>
            </RN.View>
            <RN.View style={{ padding: 8, backgroundColor: p.bg1 }}>
                <RN.View style={{ backgroundColor: p.input, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}>
                    <Txt style={[t(p.muted, 13), { flex: 1 }]}>Message #general</Txt>
                    <RN.View style={{ backgroundColor: p.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
                        <Txt style={t(onColor(p.accent), 11, "700")}>Send</Txt>
                    </RN.View>
                </RN.View>
            </RN.View>
            <RN.View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, backgroundColor: p.nav }}>
                {["●", "◆", "▲", "■"].map((g, i) => <Txt key={g} style={t(i ? p.muted : p.header, 15)}>{g}</Txt>)}
            </RN.View>
        </RN.View>
    );
}

