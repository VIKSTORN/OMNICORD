import { colorsPref } from "@lib/addons/themes/colors/preferences";
import { _colorRef } from "@lib/addons/themes/colors/updater";
import { after } from "@lib/api/patcher";
import { useObservable } from "@lib/api/storage";
import { findInReactTree } from "@lib/utils";
import { findByFilePathLazy } from "@metro";
import chroma from "chroma-js";
import { ImageBackground, StyleSheet, useWindowDimensions } from "react-native";
import { logger } from "@lib/utils/logger";

const Messages = findByFilePathLazy("modules/messages/native/Messages.tsx", true);

function ThemeBackground({ children }: { children: React.ReactNode; }) {
    useObservable([colorsPref]);
    const { width, height } = useWindowDimensions();

    if (!_colorRef.current
        || colorsPref.customBackground === "hidden"
        || !_colorRef.current.background?.url
        || _colorRef.current.background?.blur && (typeof _colorRef.current.background?.blur !== "number")
    ) {
        return children;
    }

    // Omnicord: zoom / position / fit (x, y in % of the screen, zoom ≥ 1).
    const bg: any = _colorRef.current.background;
    const zoom = typeof bg.zoom === "number" ? bg.zoom : 1;
    const tx = (typeof bg.x === "number" ? bg.x : 0) / 100 * width;
    const ty = (typeof bg.y === "number" ? bg.y : 0) / 100 * height;
    return <ImageBackground
        style={{ flex: 1, height: "100%", overflow: "hidden" }}
        source={{ uri: bg.url }}
        blurRadius={bg.blur}
        resizeMode={bg.fit === "contain" || bg.fit === "stretch" ? bg.fit : "cover"}
        imageStyle={zoom !== 1 || tx || ty ? { transform: [{ translateX: tx }, { translateY: ty }, { scale: zoom }] } : undefined}
    >
        {children}
    </ImageBackground>;
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