// Omnicord: drop-in replacement for Discord's Card built from React Native primitives.
import { resolveSemanticColor, semanticColors } from "@ui/color";
import { Pressable, View } from "react-native";

function bg(variant?: string) {
    try {
        const v = resolveSemanticColor(semanticColors[variant === "secondary" ? "BACKGROUND_SECONDARY_ALT" : "BACKGROUND_SECONDARY"]);
        if (typeof v === "string") return v;
    } catch { }
    return "#2b2d31";
}

export function SafeCard({ children, style, onPress, onLongPress, border, variant, start = true, end = true, shadow: _s, ...rest }: any) {
    const base = {
        backgroundColor: bg(variant),
        padding: 16,
        borderTopLeftRadius: start ? 16 : 4, borderTopRightRadius: start ? 16 : 4,
        borderBottomLeftRadius: end ? 16 : 4, borderBottomRightRadius: end ? 16 : 4,
        ...(border && border !== "none" ? { borderWidth: 1, borderColor: "#ffffff22" } : null),
    };
    if (onPress || onLongPress) {
        return <Pressable {...rest} onPress={onPress} onLongPress={onLongPress} android_ripple={{ color: "#ffffff22" }} style={[base, style]}>{children}</Pressable>;
    }
    return <View {...rest} style={[base, style]}>{children}</View>;
}
