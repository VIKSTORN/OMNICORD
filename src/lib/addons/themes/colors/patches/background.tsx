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

const Messages = findByFilePathLazy("modules/messages/native/Messages.tsx", true);

/** Omnicord gradient: stacked color bands (no native gradient view in RN core). */
function Gradient({ g, solo, w, h }: { g: any; solo: boolean; w: number; h: number; }) {
    const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    const stops = [g.c1, g.c2, g.c3].filter((c: string) => typeof c === "string" && HEX.test(c));
    if (stops.length < 2) return null;
    const N = 48;
    let colors: string[];
    try { colors = chroma.scale(stops).mode("lch").colors(N); } catch { return null; }
    const opacity = solo ? 1 : (typeof g.alpha === "number" ? g.alpha : 0.5);
    const horizontal = g.dir === "h";
    const diag = g.dir === "d";
    const side = Math.ceil(Math.hypot(w, h));
    return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, overflow: "hidden" }]}>
            <View style={diag
                ? { position: "absolute", width: side, height: side, left: (w - side) / 2, top: (h - side) / 2, transform: [{ rotate: "-45deg" }] }
                : StyleSheet.absoluteFill}>
                <View style={{ flex: 1, flexDirection: horizontal ? "row" : "column" }}>
                    {colors.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c, marginBottom: horizontal ? 0 : -0.5, marginRight: horizontal ? -0.5 : 0 }} />)}
                </View>
            </View>
        </View>
    );
}

function ThemeBackground({ children }: { children: React.ReactNode; }) {
    useObservable([colorsPref]);
    const { width, height } = useWindowDimensions();
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const bg: any = _colorRef.current?.background;
    // Omnicord parallax: 0 = off, 1..10 strength; smooth 1..10 (higher = softer, slower).
    const strength = typeof bg?.parallax === "number" ? bg.parallax : 0;
    const smooth = typeof bg?.smooth === "number" ? bg.smooth : 5;
    useEffect(() => () => pan.stopAnimation(), []);

    if (!_colorRef.current
        || colorsPref.customBackground === "hidden"
        || (!bg?.url && !bg?.grad?.on)
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
    const touch = range ? {
        onTouchStart: (e: any) => go((e.nativeEvent.pageX / width - 0.5) * 2 * range, (e.nativeEvent.pageY / height - 0.5) * 2 * range),
        onTouchMove: (e: any) => go((e.nativeEvent.pageX / width - 0.5) * 2 * range, (e.nativeEvent.pageY / height - 0.5) * 2 * range),
        onTouchEnd: () => go(0, 0),
        onTouchCancel: () => go(0, 0),
    } : {};

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
        {children}
    </View>;
}

export default function patchChatBackground() {
    try {
        const patches = [
            after("render", Messages, (_, ret) => {
                if (!_colorRef.current || (!_colorRef.current.background?.url && !(_colorRef.current.background as any)?.grad?.on)) return;

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