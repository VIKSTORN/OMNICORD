import { colorsPref } from "@lib/addons/themes/colors/preferences";
import { _colorRef } from "@lib/addons/themes/colors/updater";
import { after } from "@lib/api/patcher";
import { useObservable } from "@lib/api/storage";
import { findInReactTree } from "@lib/utils";
import { findByFilePathLazy } from "@metro";
import chroma from "chroma-js";
import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, useWindowDimensions, View } from "react-native";
import { logger } from "@lib/utils/logger";
import { gradientUri } from "@lib/utils/gradientPng";

const Messages = findByFilePathLazy("modules/messages/native/Messages.tsx", true);

/** Omnicord gradient: a tiny generated PNG stretched over the screen (smooth, no bands). */
const gradCache = new Map<string, string>();
function Gradient({ g, solo }: { g: any; solo: boolean; w?: number; h?: number; }) {
    const HEX = /^#([0-9a-f]{6})$/i;
    const stops = [g.c1, g.c2, g.c3].filter((c: string) => typeof c === "string" && HEX.test(c));
    if (stops.length < 2) return null;
    const dir = g.dir === "h" || g.dir === "d" ? g.dir : "v";
    const key = stops.join() + dir;
    let uri = gradCache.get(key);
    if (!uri) {
        try {
            uri = gradientUri(stops.map((c: string) => chroma(c).rgb() as [number, number, number]), dir);
            gradCache.set(key, uri);
        } catch { return null; }
    }
    const opacity = solo ? (typeof g.alpha === "number" ? Math.max(0.3, g.alpha) : 1) : (typeof g.alpha === "number" ? g.alpha : 0.35);
    return <Image source={{ uri }} resizeMode="stretch" fadeDuration={0} style={[StyleSheet.absoluteFill, { opacity, width: "100%", height: "100%" }]} />;
}

const HEXC = /^#([0-9a-f]{6})$/i;
const a2 = (o: number) => Math.round(Math.max(0, Math.min(1, o)) * 255).toString(16).padStart(2, "0");

/** Soft radial glow: stacked circles, each adding a little light (brighter in the middle). */
function Glow({ l, w, h, pos }: { l: any; w: number; h: number; pos: Animated.ValueXY; }) {
    const color = HEXC.test(l.color) ? l.color : "#ffffff";
    const R = Math.max(40, (typeof l.size === "number" ? l.size : 0.8) * Math.max(w, h) * 0.5);
    const strength = typeof l.strength === "number" ? l.strength : 0.35;
    const N = 18;
    return (
        <Animated.View pointerEvents="none" style={{
            position: "absolute", left: -R, top: -R, width: R * 2, height: R * 2,
            transform: [{ translateX: pos.x }, { translateY: pos.y }],
        }}>
            {Array.from({ length: N }, (_, i) => {
                const r = R * (1 - i / N);
                return <View key={i} style={{
                    position: "absolute", left: R - r, top: R - r, width: r * 2, height: r * 2, borderRadius: r,
                    backgroundColor: color + a2((strength / N) * (0.6 + i / N)),
                }} />;
            })}
        </Animated.View>
    );
}

/** Darker edges so the middle pops. */
function Vignette({ v }: { v: number; }) {
    const N = 10;
    const band = (side: "top" | "bottom" | "left" | "right") => Array.from({ length: N }, (_, i) => (
        <View key={side + i} style={{
            position: "absolute", backgroundColor: "#000000" + a2(v * 0.22 * (1 - i / N)),
            ...(side === "top" || side === "bottom"
                ? { left: 0, right: 0, height: `${(i + 1) * 2.2}%` as any, [side]: 0 }
                : { top: 0, bottom: 0, width: `${(i + 1) * 2.2}%` as any, [side]: 0 }),
        }} />
    ));
    return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{band("top")}{band("bottom")}{band("left")}{band("right")}</View>;
}

const lightHome = (l: any, w: number, h: number) =>
    !l ? { x: 0, y: 0 } : { x: 0.5 * w, y: (l.pos === "center" ? 0.45 : l.pos === "bottom" ? 0.9 : 0.08) * h };

function ThemeBackground({ children }: { children: React.ReactNode; }) {
    useObservable([colorsPref]);
    const { width, height } = useWindowDimensions();
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const glow = useRef(new Animated.ValueXY({ x: -9999, y: -9999 })).current;
    const bg: any = _colorRef.current?.background;
    // Omnicord parallax: 0 = off, 1..10 strength; smooth 1..10 (higher = softer, slower).
    const strength = typeof bg?.parallax === "number" ? bg.parallax : 0;
    const smooth = typeof bg?.smooth === "number" ? bg.smooth : 5;
    useEffect(() => () => pan.stopAnimation(), []);
    const lp = bg?.light?.on ? bg.light.pos : null;
    useEffect(() => { if (lp) glow.setValue(lightHome(bg.light, width, height)); }, [lp, width, height]);

    if (!_colorRef.current
        || colorsPref.customBackground === "hidden"
        || (!bg?.url && !bg?.grad?.on && !bg?.light?.on && !bg?.vignette)
        || bg?.blur && (typeof bg?.blur !== "number")
    ) {
        return children;
    }

    // Omnicord: zoom / position / fit (x, y in % of the screen, zoom ≥ 1).
    const zoom = typeof bg.zoom === "number" ? bg.zoom : 1;
    const tx = (typeof bg.x === "number" ? bg.x : 0) / 100 * width;
    const ty = (typeof bg.y === "number" ? bg.y : 0) / 100 * height;
    const range = strength * 6; // max shift in px
    const extra = range ? 1 + (2 * range) / Math.max(1, Math.min(width, height)) : 1;
    const go = (x: number, y: number) => Animated.spring(pan, {
        toValue: { x, y }, useNativeDriver: true,
        friction: 4 + smooth * 1.6, tension: Math.max(8, 60 - smooth * 5),
    }).start();
    // Light: fixed spot, or follows your finger (smoothly) and drifts back when you let go.
    const light = bg.light?.on ? bg.light : null;
    const home = lightHome(light, width, height);
    const follow = !!light && !!light.follow;
    const moveLight = (x: number, y: number) => Animated.spring(glow, { toValue: { x, y }, useNativeDriver: true, friction: 4 + smooth * 1.6, tension: Math.max(8, 60 - smooth * 5) }).start();
    const onPoint = (e: any) => {
        const { pageX, pageY } = e.nativeEvent;
        if (range) go((pageX / width - 0.5) * 2 * range, (pageY / height - 0.5) * 2 * range);
        if (follow) moveLight(pageX, pageY);
    };
    const onRelease = () => { if (range) go(0, 0); if (follow) moveLight(home.x, home.y); };
    const touch = range || follow ? { onTouchStart: onPoint, onTouchMove: onPoint, onTouchEnd: onRelease, onTouchCancel: onRelease } : {};

    return <View style={{ flex: 1, height: "100%", overflow: "hidden" }} {...touch}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
            transform: [{ translateX: tx }, { translateY: ty }, { translateX: pan.x }, { translateY: pan.y }, { scale: zoom * extra }],
        }]}>
            {bg.url ? <Image
                style={StyleSheet.absoluteFill}
                source={{ uri: bg.url }}
                blurRadius={bg.blur}
                resizeMode={bg.fit === "contain" || bg.fit === "stretch" ? bg.fit : "cover"}
            /> : null}
            {bg.grad?.on ? <Gradient g={bg.grad} solo={!bg.url} w={width} h={height} /> : null}
        </Animated.View>
        {light ? <Glow l={light} w={width} h={height} pos={glow} /> : null}
        {bg.vignette ? <Vignette v={bg.vignette} /> : null}
        {children}
    </View>;
}

export default function patchChatBackground() {
    try {
        const patches = [
            after("render", Messages, (_, ret) => {
                const b: any = _colorRef.current?.background;
                if (!_colorRef.current || (!b?.url && !b?.grad?.on && !b?.light?.on && !b?.vignette)) return;

                const messagesComponent = findInReactTree(
                    ret,
                    x => x && "HACK_fixModalInteraction" in x.props && x?.props?.style
                );

                if (messagesComponent) {
                    const flattened = StyleSheet.flatten(messagesComponent.props.style);
                    const backgroundColor = chroma(
                        flattened.backgroundColor || "black"
                    ).alpha(
                        1 - (_colorRef.current.background?.opacity ?? 1)
                    ).hex();

                    messagesComponent.props.style = StyleSheet.flatten([
                        messagesComponent.props.style,
                        { backgroundColor }
                    ]);
                }

                return <ThemeBackground>{ret}</ThemeBackground>;
            })
        ];
        return () => patches.forEach(x => x());
    } catch (e) {
        logger.error("Failed to patch chat background.", e);
        return () => { };
    }
}