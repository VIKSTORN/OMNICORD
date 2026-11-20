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
        || !bg?.url
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
            <Image
                style={StyleSheet.absoluteFill}
                source={{ uri: bg.url }}
                blurRadius={bg.blur}
                resizeMode={bg.fit === "contain" || bg.fit === "stretch" ? bg.fit : "cover"}
            />
        </Animated.View>
        {children}
    </View>;
}

export default function patchChatBackground() {
    try {
        const patches = [
            after("render", Messages, (_, ret) => {
                if (!_colorRef.current || !_colorRef.current.background?.url) return;

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