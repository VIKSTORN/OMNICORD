// Floating Ω bubble on top of Discord: tap for quick actions, drag to move.
// Injected with AppRegistry.setWrapperComponentProvider (RN primitives only, no Discord components).
import { useSafeColors } from "@core/ui/components/SafeUI";

import { closeQuickMenu, getMenuState, getQuickActions, openQuickMenu, QuickAction, str, subscribeQuick } from "../shared/quick";
import { Scroll, Section, Switch } from "../shared/ui";
import { logger, omniPlugin, React, ReactNative as RN, showToast, useProxy } from "../vd";

const defaults = { show: true, x: -1, y: 0.35, size: 48, opacity: 0.85 };
type S = typeof defaults;

let store: S | undefined;
let enabled = false;
const enabledListeners = new Set<() => void>();
const setEnabled = (v: boolean) => { enabled = v; enabledListeners.forEach(l => l()); };

function useTick(sub: (l: () => void) => () => void) {
    const [, force] = React.useReducer((n: number) => n + 1, 0);
    React.useEffect(() => sub(force), []);
}

function Menu({ onClose, ids, title }: { onClose: () => void; ids?: string[]; title?: string; }) {
    const col = useSafeColors();
    useTick(subscribeQuick);
    const [sub, setSub] = React.useState<QuickAction | null>(null);
    const [, rerender] = React.useReducer((n: number) => n + 1, 0);

    React.useEffect(() => {
        const h = RN.BackHandler.addEventListener("hardwareBackPress", () => {
            sub ? setSub(null) : onClose();
            return true;
        });
        return () => h.remove();
    }, [sub]);

    const exec = async (fn: () => void | Promise<void>, keepOpen?: boolean) => {
        if (!keepOpen) onClose();
        try { await fn(); } catch (e) { logger.error(e); showToast(`Failed: ${e}`); }
        if (keepOpen) rerender();
    };

    const items = sub
        ? (sub.choices?.() ?? []).map((c, i) => ({ key: String(i), label: (c.selected ? "● " : "○ ") + c.label, sub: undefined, onPress: () => exec(c.run, sub.keepOpen) }))
        : getQuickActions().filter(a => !ids || ids.includes(a.id)).map(a => ({
            key: a.id, label: str(a.label)!, sub: str(a.sub),
            onPress: () => a.choices ? setSub(a) : a.run && exec(a.run, a.keepOpen),
            more: !!a.choices,
        }));

    return (
        <RN.Pressable onPress={onClose} style={[RN.StyleSheet.absoluteFill, { backgroundColor: "#000a", justifyContent: "center", padding: 20 }]}>
            <RN.Pressable onPress={() => { }} style={{ backgroundColor: col.card, borderRadius: 16, overflow: "hidden", maxHeight: "80%" }}>
                <RN.View style={{ flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: col.border }}>
                    {sub ? <RN.Pressable onPress={() => setSub(null)} hitSlop={12}><RN.Text style={{ color: col.accent, fontSize: 18, marginRight: 10 }}>‹</RN.Text></RN.Pressable> : null}
                    <RN.Text style={{ color: col.text, fontSize: 17, fontWeight: "700", flex: 1 }}>{sub ? str(sub.label) : title ?? "Ω Omnicord"}</RN.Text>
                    <RN.Pressable onPress={onClose} hitSlop={12}><RN.Text style={{ color: col.muted, fontSize: 18 }}>✕</RN.Text></RN.Pressable>
                </RN.View>
                <RN.ScrollView>
                    {items.length ? items.map((it: any) => (
                        <RN.Pressable key={it.key} onPress={it.onPress} android_ripple={{ color: "#ffffff22" }}
                            style={{ paddingVertical: 13, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
                            <RN.View style={{ flex: 1 }}>
                                <RN.Text style={{ color: col.text, fontSize: 16, fontWeight: "600" }}>{it.label}</RN.Text>
                                {it.sub ? <RN.Text style={{ color: col.muted, fontSize: 13, marginTop: 2 }}>{it.sub}</RN.Text> : null}
                            </RN.View>
                            {it.more ? <RN.Text style={{ color: col.muted, fontSize: 18 }}>›</RN.Text> : null}
                        </RN.Pressable>
                    )) : <RN.Text style={{ color: col.muted, padding: 16 }}>No actions: enable some Omnicord plugins.</RN.Text>}
                </RN.ScrollView>
            </RN.Pressable>
        </RN.Pressable>
    );
}

function Bubble() {
    useTick(l => (enabledListeners.add(l), () => void enabledListeners.delete(l)));
    useTick(subscribeQuick);
    const m = getMenuState();
    return (
        <>
            {enabled && store && !m ? <BubbleInner s={store} /> : null}
            {m ? <RN.View style={RN.StyleSheet.absoluteFill}><Menu ids={m.ids} title={m.title} onClose={closeQuickMenu} /></RN.View> : null}
        </>
    );
}

function BubbleInner({ s }: { s: S; }) {
    useProxy(s);
    const { width, height } = RN.useWindowDimensions();
    const size = Math.max(32, Math.min(80, s?.size ?? 48));

    const pos = React.useRef(new RN.Animated.ValueXY()).current;
    const start = React.useRef({ x: 0, y: 0 });
    const cur = React.useRef({ x: 0, y: 0 });

    React.useEffect(() => {
        const x = (s?.x ?? -1) < 0 ? width - size - 8 : Math.min(s!.x * width, width - size);
        const y = Math.min((s?.y ?? 0.35) * height, height - size - 40);
        cur.current = { x, y };
        pos.setValue({ x, y });
    }, [width, height, size]);

    const pan = React.useMemo(() => RN.PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
        onPanResponderGrant: () => { start.current = { ...cur.current }; },
        onPanResponderMove: (_, g) => pos.setValue({ x: start.current.x + g.dx, y: start.current.y + g.dy }),
        onPanResponderRelease: (_, g) => {
            if (Math.abs(g.dx) + Math.abs(g.dy) < 6) {
                pos.setValue(start.current);
                return openQuickMenu();
            }
            const { width: w, height: h } = RN.Dimensions.get("window");
            // snap to nearest side
            const x = start.current.x + g.dx + size / 2 < w / 2 ? 8 : w - size - 8;
            const y = Math.max(30, Math.min(h - size - 40, start.current.y + g.dy));
            cur.current = { x, y };
            RN.Animated.spring(pos, { toValue: { x, y }, useNativeDriver: false }).start();
            if (s) { s.x = x / w; s.y = y / h; }
        },
    }), [size]);

    if (!s.show) return null;

    return (
        <RN.View pointerEvents="box-none" style={RN.StyleSheet.absoluteFill}>
            {(
                <RN.Animated.View {...pan.panHandlers} style={{
                    position: "absolute", left: 0, top: 0, transform: pos.getTranslateTransform(),
                    width: size, height: size, borderRadius: size / 2, backgroundColor: "#7c5cff", opacity: s.opacity ?? 0.85,
                    alignItems: "center", justifyContent: "center", elevation: 8,
                }}>
                    <RN.Text style={{ color: "white", fontSize: size * 0.5, fontWeight: "800", marginTop: -2 }}>Ω</RN.Text>
                </RN.Animated.View>
            )}
        </RN.View>
    );
}

class Guard extends React.Component<{ children: any; }, { err: boolean; }> {
    state = { err: false };
    static getDerivedStateFromError() { return { err: true }; }
    componentDidCatch(e: any) { logger.error("Quick menu crashed", e); }
    render() { return this.state.err ? null : this.props.children; }
}

let installed = false;
function install() {
    if (installed) return true;
    const AR: any = RN.AppRegistry;
    if (!AR?.setWrapperComponentProvider) return false;
    let inner: any = null;
    const orig = AR.setWrapperComponentProvider.bind(AR);
    orig((params: any) => {
        const W = inner?.(params);
        return function OmnicordRoot({ children, ...rest }: any) {
            return (
                <RN.View style={{ flex: 1 }}>
                    {W ? <W {...rest}>{children}</W> : children}
                    <Guard><Bubble /></Guard>
                </RN.View>
            );
        };
    });
    // Keep Discord's own wrapper (if it sets one later) working underneath ours.
    AR.setWrapperComponentProvider = (p: any) => { inner = p; };
    installed = true;
    return true;
}

// Install at load (before Discord's app starts) so the menu also works when the bubble is off.
try { install(); } catch (e) { logger.error("Quick menu install failed", e); }

export default omniPlugin<S>({
    id: "quick-menu",
    name: "Quick Menu",
    description: "Floating Ω button with one-tap actions: Read all, Translate, Theme… (drag to move)",
    defaults,
    start(s) {
        store = s;
        if (!installed) showToast("Quick Menu: restart Discord to show the Ω button");
        setEnabled(true);
    },
    stop() { setEnabled(false); },
    Settings({ storage }) {
        useProxy(storage);
        const col = useSafeColors();
        const step = (k: "size" | "opacity", d: number, min: number, max: number) =>
            void (storage[k] = Math.round(Math.max(min, Math.min(max, storage[k] + d)) * 100) / 100);
        const Stepper = ({ label, k, d, min, max }: any) => (
            <RN.View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14 }}>
                <RN.Text style={{ color: col.text, fontSize: 16, flex: 1 }}>{label}: {storage[k as keyof S]}</RN.Text>
                {[-d, d].map(v => (
                    <RN.Pressable key={v} onPress={() => step(k, v, min, max)} style={{ backgroundColor: col.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, marginLeft: 8 }}>
                        <RN.Text style={{ color: col.text, fontSize: 16 }}>{v < 0 ? "−" : "+"}</RN.Text>
                    </RN.Pressable>
                ))}
            </RN.View>
        );
        return (
            <Scroll>
                <Section>
                    <Switch store={storage} k="show" label="Show Ω button" sub="Tap = actions, drag = move" />
                    <Stepper label="Size" k="size" d={4} min={32} max={80} />
                    <Stepper label="Opacity" k="opacity" d={0.1} min={0.3} max={1} />
                </Section>
            </Scroll>
        );
    },
});
